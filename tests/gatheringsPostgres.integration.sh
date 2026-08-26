#!/usr/bin/env bash
set -euo pipefail

for prerequisite in initdb pg_ctl psql; do
  if ! command -v "$prerequisite" >/dev/null 2>&1; then
    echo "missing PostgreSQL prerequisite: $prerequisite" >&2
    exit 2
  fi
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
GATHERING_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_first_vella_gathering.sql)

if [[ ${#GATHERING_MIGRATIONS[@]} -ne 1 || ! -f "${GATHERING_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one first_vella_gathering migration" >&2
  exit 1
fi

MIGRATION_PATH=${GATHERING_MIGRATIONS[0]}
GATHERING_PG_ROOT=$(mktemp -d)
GATHERING_PG_DATA="$GATHERING_PG_ROOT/data"
GATHERING_PG_PORT=${GATHERING_PG_PORT:-55482}

case "$GATHERING_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_gathering_postgres() {
  pg_ctl -D "$GATHERING_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$GATHERING_PG_ROOT"
}
trap cleanup_gathering_postgres EXIT

gathering_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$GATHERING_PG_ROOT" -p "$GATHERING_PG_PORT" postgres "$@"
}

initdb -D "$GATHERING_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$GATHERING_PG_DATA" \
  -o "-F -p $GATHERING_PG_PORT -k $GATHERING_PG_ROOT" -w start >/dev/null

gathering_psql >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create schema faith_harbor;
grant usage on schema faith_harbor to service_role;
create extension if not exists pgcrypto;

create table auth.users (id uuid primary key);
insert into auth.users values
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');

create table faith_harbor.bible_versions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  language_code text not null,
  is_active boolean not null default true
);
create table faith_harbor.bible_books (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
);
create table faith_harbor.bible_verses (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references faith_harbor.bible_versions(id),
  book_id uuid not null references faith_harbor.bible_books(id),
  chapter integer not null,
  verse integer not null,
  text_content text not null,
  language_code text not null
);

insert into faith_harbor.bible_versions (code, language_code) values
  ('WEBP', 'en'), ('BPM', 'pt');
insert into faith_harbor.bible_books (code) values ('MAT');
insert into faith_harbor.bible_verses (
  version_id, book_id, chapter, verse, text_content, language_code
)
select version.id, book.id, 11, 28,
       case version.language_code when 'pt' then 'Texto bíblico público aprovado.' else 'Approved public Scripture text.' end,
       version.language_code
from faith_harbor.bible_versions as version
cross join faith_harbor.bible_books as book;

create table faith_harbor.gathering_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  version integer not null,
  locale text not null,
  title text not null,
  summary text not null,
  theme_key text not null,
  estimated_duration_seconds integer not null,
  status text not null,
  available_from timestamptz,
  available_until timestamptz,
  access_tier text not null,
  editorial_revision text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, version, locale)
);
create table faith_harbor.gathering_template_steps (
  id uuid primary key default gen_random_uuid(),
  gathering_template_id uuid not null references faith_harbor.gathering_templates(id),
  step_order smallint not null,
  section_type text not null,
  content_key text not null,
  duration_seconds integer,
  narration_asset_key text,
  is_required boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (gathering_template_id, step_order)
);
create table faith_harbor.user_gathering_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gathering_template_id uuid not null references faith_harbor.gathering_templates(id),
  current_step smallint not null default 0,
  status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gathering_template_id)
);
create table faith_harbor.practice_definitions (code text primary key);
insert into faith_harbor.practice_definitions values ('guided_prayer');
create table faith_harbor.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  practice_code text not null references faith_harbor.practice_definitions(code),
  source_type text not null,
  source_key text not null,
  idempotency_key uuid not null,
  status text not null,
  timezone_name text not null,
  local_day date not null,
  local_week_start date not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  unique (user_id, source_type, source_key)
);

grant select on faith_harbor.bible_versions, faith_harbor.bible_books, faith_harbor.bible_verses to service_role;
grant select on faith_harbor.gathering_templates, faith_harbor.gathering_template_steps to service_role;
grant select, insert, update, delete on faith_harbor.user_gathering_progress to service_role;
grant select, insert, update, delete on faith_harbor.practice_sessions to service_role;
SQL

gathering_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null

gathering_psql >/dev/null <<'SQL'
do $verify_catalog_and_acl$
declare
  invalid_locale_count integer;
begin
  if (select count(*) from faith_harbor.gathering_templates where slug = 'weekly-rest' and version = 1) <> 8
     or (select count(*) from faith_harbor.gathering_template_steps) <> 64 then
    raise exception 'unexpected Gathering catalog cardinality';
  end if;

  select count(*) into invalid_locale_count
  from (
    select template.locale,
           array_agg(step.section_type order by step.step_order) as sections,
           sum(step.duration_seconds) as total_duration,
           count(step.scripture_verse_id) as scripture_count
    from faith_harbor.gathering_templates as template
    join faith_harbor.gathering_template_steps as step on step.gathering_template_id = template.id
    group by template.locale
  ) as locale_contract
  where sections <> array[
      'arrival', 'opening_prayer', 'scripture', 'reflection',
      'silence', 'private_prayer', 'action', 'closing'
    ]::text[]
     or total_duration <> 900
     or scripture_count <> 1;
  if invalid_locale_count <> 0 then
    raise exception 'invalid localized Gathering contract';
  end if;

  if has_function_privilege('public', 'faith_harbor.get_current_gathering_v1(uuid,text,timestamptz)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.get_current_gathering_v1(uuid,text,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.get_current_gathering_v1(uuid,text,timestamptz)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.get_current_gathering_v1(uuid,text,timestamptz)', 'execute')
    or has_function_privilege('public', 'faith_harbor.save_gathering_progress_v1(uuid,uuid,integer,boolean,uuid,text,date,date,timestamptz)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.save_gathering_progress_v1(uuid,uuid,integer,boolean,uuid,text,date,date,timestamptz)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.save_gathering_progress_v1(uuid,uuid,integer,boolean,uuid,text,date,date,timestamptz)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.save_gathering_progress_v1(uuid,uuid,integer,boolean,uuid,text,date,date,timestamptz)', 'execute') then
    raise exception 'unexpected Gathering RPC ACL';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'faith_harbor' and table_name = 'user_gathering_progress'
      and column_name ~ '(private|prayer|reflection|journal).*(answer|response|text|body|content|note)'
  ) then
    raise exception 'private content column exists in Gathering progress';
  end if;
end
$verify_catalog_and_acl$;

set role service_role;

do $verify_checkpoint_completion$
declare
  template_id uuid;
  current_payload jsonb;
  result jsonb;
begin
  select id into template_id
  from faith_harbor.gathering_templates
  where slug = 'weekly-rest' and version = 1 and locale = 'pt';

  select faith_harbor.get_current_gathering_v1(
    '11111111-1111-4111-8111-111111111111', 'pt', '2026-08-26T10:00:00Z'
  ) into current_payload;
  if current_payload #>> '{template,locale}' <> 'pt'
     or jsonb_array_length(current_payload #> '{template,steps}') <> 8
     or current_payload #>> '{progress,status}' <> 'not_started'
     or current_payload::text like '%11111111-1111-4111-8111-111111111111%' then
    raise exception 'invalid current Gathering response';
  end if;

  select faith_harbor.save_gathering_progress_v1(
    '11111111-1111-4111-8111-111111111111', template_id, 1, false, null,
    'UTC', '2026-08-26', '2026-08-24', '2026-08-26T10:00:00Z'
  ) into result;
  if result ->> 'outcome' <> 'updated'
     or result #>> '{telemetry_events,0,event_name}' <> 'gathering_started' then
    raise exception 'Gathering start was not authoritative';
  end if;

  select faith_harbor.save_gathering_progress_v1(
    '11111111-1111-4111-8111-111111111111', template_id, 6, false, null,
    'UTC', '2026-08-26', '2026-08-24', '2026-08-26T10:09:00Z'
  ) into result;
  if result ->> 'outcome' <> 'updated'
     or result #>> '{progress,current_step}' <> '6' then
    raise exception 'Gathering checkpoint did not advance';
  end if;

  select faith_harbor.save_gathering_progress_v1(
    '11111111-1111-4111-8111-111111111111', template_id, 8, true,
    '33333333-3333-4333-8333-333333333333', 'UTC',
    '2026-08-26', '2026-08-24', '2026-08-26T10:15:00Z'
  ) into result;
  if result ->> 'outcome' <> 'completed'
     or result ->> 'practice_credit' <> 'guided_prayer'
     or jsonb_array_length(result -> 'telemetry_events') <> 2 then
    raise exception 'Gathering completion facts are invalid';
  end if;

  select faith_harbor.save_gathering_progress_v1(
    '11111111-1111-4111-8111-111111111111', template_id, 8, true,
    '33333333-3333-4333-8333-333333333333', 'UTC',
    '2026-08-26', '2026-08-24', '2026-08-26T10:16:00Z'
  ) into result;
  if result ->> 'outcome' <> 'already_completed'
     or (select count(*) from faith_harbor.practice_sessions where user_id = '11111111-1111-4111-8111-111111111111') <> 1 then
    raise exception 'Gathering completion replay duplicated credit';
  end if;
end
$verify_checkpoint_completion$;
SQL

echo "Gathering PostgreSQL integration passed"
