#!/usr/bin/env bash
set -euo pipefail

for prerequisite in initdb pg_ctl psql; do
  command -v "$prerequisite" >/dev/null 2>&1 || {
    echo "gatherings v2 PostgreSQL integration requires $prerequisite" >&2
    exit 1
  }
done

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
TASK_1_MIGRATION="$WORKSPACE_ROOT/supabase/migrations/20260827210000_gathering_content_factory.sql"
TASK_2_MIGRATION="$WORKSPACE_ROOT/supabase/migrations/20260827210100_gathering_catalog_v2.sql"
V1_GATHERING_MIGRATION="$WORKSPACE_ROOT/supabase/migrations/20260826180539_first_vella_gathering.sql"
GATHERINGS_PG_ROOT=$(mktemp -d)
GATHERINGS_PG_DATA="$GATHERINGS_PG_ROOT/data"
GATHERINGS_PG_PORT=${GATHERINGS_PG_PORT:-55458}

[[ -f "$TASK_1_MIGRATION" && -f "$TASK_2_MIGRATION" && -f "$V1_GATHERING_MIGRATION" ]] || {
  echo "gatherings v2 migrations are missing" >&2
  exit 1
}

case "$GATHERINGS_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) exit 1 ;;
esac

cleanup_gatherings_postgres() {
  pg_ctl -D "$GATHERINGS_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$GATHERINGS_PG_ROOT"
}
trap cleanup_gatherings_postgres EXIT

gatherings_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$GATHERINGS_PG_ROOT" -p "$GATHERINGS_PG_PORT" "$@"
}

initdb -D "$GATHERINGS_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$GATHERINGS_PG_DATA" -o "-F -p $GATHERINGS_PG_PORT -k $GATHERINGS_PG_ROOT" -w start >/dev/null

gatherings_psql -d postgres >/dev/null <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create schema faith_harbor;
create extension if not exists pgcrypto;

create table auth.users (
  id uuid primary key,
  is_anonymous boolean not null default false
);

create function faith_harbor.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

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
  unique (gathering_template_id, step_order)
);

create table faith_harbor.user_gathering_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  gathering_template_id uuid not null references faith_harbor.gathering_templates(id),
  current_step smallint not null default 0,
  status text not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  last_seen_at timestamptz,
  completion_idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gathering_template_id)
);

create table faith_harbor.gamification_milestones (
  code text primary key,
  title text not null,
  description text not null,
  metric text not null check (metric in ('streak', 'completed_days', 'completed_journeys')),
  target_value integer not null,
  badge_color text not null,
  is_premium boolean not null,
  category text not null,
  tier text,
  theme_key text,
  asset_key text,
  display_priority integer not null,
  is_shareable boolean not null,
  is_active boolean not null
);

create table faith_harbor.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  anonymous_profile_id uuid,
  milestone_code text not null references faith_harbor.gamification_milestones(code),
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create unique index user_milestones_owner_code
  on faith_harbor.user_milestones(user_id, milestone_code)
  where user_id is not null;

grant usage on schema faith_harbor to service_role;
grant select, insert, update, delete on all tables in schema faith_harbor to service_role;
SQL

gatherings_psql -d postgres -c 'create database gatherings_clean'
gatherings_psql -d postgres -c 'create database gatherings_upgrade'

for database in gatherings_clean gatherings_upgrade; do
  gatherings_psql -d "$database" >/dev/null <<'SQL'
create schema auth;
create schema faith_harbor;
create extension if not exists pgcrypto;
create table auth.users (id uuid primary key, is_anonymous boolean not null default false);
create function faith_harbor.set_updated_at() returns trigger language plpgsql set search_path = '' as $$ begin new.updated_at := pg_catalog.now(); return new; end; $$;
create table faith_harbor.gathering_templates (id uuid primary key default gen_random_uuid(), slug text not null, version integer not null, locale text not null, title text not null, summary text not null, theme_key text not null, estimated_duration_seconds integer not null, status text not null, available_from timestamptz, available_until timestamptz, access_tier text not null, editorial_revision text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (slug, version, locale));
create table faith_harbor.bible_versions (id uuid primary key, code text not null);
create table faith_harbor.bible_verses (id uuid primary key, version_id uuid, language_code text not null, text_content text not null, chapter integer not null, verse integer not null);
create table faith_harbor.gathering_template_steps (id uuid primary key default gen_random_uuid(), gathering_template_id uuid not null references faith_harbor.gathering_templates(id), step_order smallint not null, section_type text not null, content_key text not null, editorial_text text, scripture_verse_id uuid, duration_seconds integer, narration_asset_key text, is_required boolean not null default true, unique (gathering_template_id, step_order));
create table faith_harbor.user_gathering_progress (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), gathering_template_id uuid not null references faith_harbor.gathering_templates(id), current_step smallint not null default 0, status text not null default 'not_started', started_at timestamptz, completed_at timestamptz, last_seen_at timestamptz, completion_idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, gathering_template_id));
create unique index if not exists idx_user_gathering_progress_completion_key on faith_harbor.user_gathering_progress(user_id, completion_idempotency_key) where completion_idempotency_key is not null;
create table faith_harbor.practice_sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), practice_code text not null, source_type text not null, source_key text not null, idempotency_key uuid not null, status text not null, timezone_name text not null, local_day date not null, local_week_start date not null, started_at timestamptz not null, completed_at timestamptz, unique (user_id, source_type, source_key));
create table faith_harbor.gamification_milestones (code text primary key, title text not null, description text not null, metric text not null check (metric in ('streak', 'completed_days', 'completed_journeys')), target_value integer not null, badge_color text not null, is_premium boolean not null, category text not null, tier text, theme_key text, asset_key text, display_priority integer not null, is_shareable boolean not null, is_active boolean not null);
create table faith_harbor.user_milestones (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), anonymous_profile_id uuid, milestone_code text not null references faith_harbor.gamification_milestones(code), earned_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb);
create unique index user_milestones_owner_code on faith_harbor.user_milestones(user_id, milestone_code) where user_id is not null;
grant usage on schema faith_harbor to service_role;
grant select, insert, update, delete on all tables in schema faith_harbor to service_role;
SQL
done

# Clean deployment: task dependencies must apply in release order.
gatherings_psql -d gatherings_clean -f "$TASK_1_MIGRATION" -f "$TASK_2_MIGRATION" >/dev/null

# Upgrade deployment: preserve an existing v1 row while moving from Task 1 to Task 2.
gatherings_psql -d gatherings_upgrade -f "$TASK_1_MIGRATION" >/dev/null
sed -n '/^create or replace function faith_harbor.get_current_gathering_v1(/,/^\$\$;/p' "$V1_GATHERING_MIGRATION" | gatherings_psql -d gatherings_upgrade >/dev/null
sed -n '/^create or replace function faith_harbor.save_gathering_progress_v1(/,/^\$\$;/p' "$V1_GATHERING_MIGRATION" | gatherings_psql -d gatherings_upgrade >/dev/null
gatherings_psql -d gatherings_upgrade >/dev/null <<'SQL'
insert into auth.users (id, is_anonymous) values ('11111111-1111-4111-8111-111111111111', false);
insert into faith_harbor.gathering_templates (id, slug, version, locale, title, summary, theme_key, estimated_duration_seconds, status, access_tier, editorial_revision)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'weekly-rest', 1, 'en', 'Legacy v1', 'Legacy contract', 'legacy', 900, 'published', 'premium', 'editorial.1');
insert into faith_harbor.gathering_template_steps (gathering_template_id, step_order, section_type, content_key, editorial_text, duration_seconds)
select 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', step_order, 'arrival', format('weekly-rest:v1:en:%s', step_order), 'Legacy safe step', 60
from generate_series(1, 8) as step_order;
SQL
gatherings_psql -d gatherings_upgrade >/dev/null <<'SQL'
do $verify_exact_v1_before_task_2$
declare
  result jsonb;
begin
  select faith_harbor.save_gathering_progress_v1(
    '11111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    1, false, null, 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  ) into result;
  if result ->> 'outcome' <> 'updated'
    or result #>> '{progress,status}' <> 'in_progress'
    or not exists (
      select 1
      from pg_catalog.pg_indexes as index_definition
      where index_definition.schemaname = 'faith_harbor'
        and index_definition.indexname = 'idx_user_gathering_progress_completion_key'
        and index_definition.indexdef like '%WHERE (completion_idempotency_key IS NOT NULL)%'
    ) then
    raise exception 'exact v1 progress function or partial index was not executable';
  end if;
end
$verify_exact_v1_before_task_2$;
SQL
gatherings_psql -d gatherings_upgrade -f "$TASK_2_MIGRATION" >/dev/null

gatherings_psql -d gatherings_upgrade >/dev/null <<'SQL'
do $verify_v1_preserved$
begin
  if not exists (
    select 1 from faith_harbor.gathering_templates
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      and slug = 'weekly-rest' and version = 1 and editorial_revision = 'editorial.1' and release_id is null
  ) then
    raise exception 'v1 contract was not preserved during upgrade';
  end if;
  if (faith_harbor.get_current_gathering_v1(
    '11111111-1111-4111-8111-111111111111', 'en', '2026-08-27T00:00:00Z'
  ) ->> 'schema_version') <> '1'
  or faith_harbor.get_current_gathering_v1(
    '11111111-1111-4111-8111-111111111111', 'en', '2026-08-27T00:00:00Z'
  ) #>> '{template,slug}' <> 'weekly-rest'
  or jsonb_array_length(faith_harbor.get_current_gathering_v1(
    '11111111-1111-4111-8111-111111111111', 'en', '2026-08-27T00:00:00Z'
  ) #> '{template,steps}') <> 8 then
    raise exception 'v1 weekly-rest response was not executable';
  end if;
end
$verify_v1_preserved$;
SQL

gatherings_psql -d gatherings_clean >/dev/null <<'SQL'
insert into auth.users (id, is_anonymous) values
  ('11111111-1111-4111-8111-111111111111', false),
  ('22222222-2222-4222-8222-222222222222', true),
  ('33333333-3333-4333-8333-333333333333', false),
  ('44444444-4444-4444-8444-444444444444', false),
  ('55555555-5555-4555-8555-555555555555', false),
  ('66666666-6666-4666-8666-666666666666', false),
  ('77777777-7777-4777-8777-777777777777', false),
  ('88888888-8888-4888-8888-888888888888', false),
  ('99999999-9999-4999-8999-999999999999', false),
  ('12121212-1212-4121-8121-121212121212', false),
  ('13131313-1313-4131-8131-131313131313', false),
  ('14141414-1414-4141-8141-141414141414', false);

insert into faith_harbor.gathering_releases (id, catalog_code, release_week, slot_type, source_kind, status, content_hash, prompt_revision, editorial_revision, published_at)
values
  ('a0000000-0000-4000-8000-000000000001', 'g-2026w10-mon', '2026-03-02', 'monday', 'generated', 'published', repeat('a', 64), 'v1', 'v1', '2026-01-01T00:00:00Z'),
  ('a0000000-0000-4000-8000-000000000002', 'g-2026w10-thu', '2026-03-02', 'thursday', 'generated', 'published', repeat('b', 64), 'v1', 'v1', '2026-01-01T00:00:00Z');

insert into faith_harbor.gathering_releases (id, catalog_code, release_week, slot_type, source_kind, status, content_hash, prompt_revision, editorial_revision, published_at)
select
  format('a0000000-0000-4000-8000-%s', lpad(release_number::text, 12, '0'))::uuid,
  format('g-2025w%s-%s', lpad(release_number::text, 2, '0'), case when release_number % 2 = 0 then 'thu' else 'mon' end),
  ('2025-01-06'::date + ((release_number - 3) / 2) * 7),
  case when release_number % 2 = 0 then 'thursday' else 'monday' end,
  'generated', 'published', lpad(release_number::text, 64, 'c'), 'v1', 'v1', '2025-01-01T00:00:00Z'
from generate_series(3, 52) as release_number;

insert into faith_harbor.gathering_templates (id, slug, version, locale, title, summary, theme_key, estimated_duration_seconds, status, access_tier, editorial_revision, release_id)
select
  gen_random_uuid(),
  format('gathering-%s', release_number), 1, locale, format('Gathering %s', release_number), 'Safe catalog copy', 'steady', 900, 'published', 'premium', 'v1',
  format('a0000000-0000-4000-8000-%s', lpad(release_number::text, 12, '0'))::uuid
from generate_series(1, 52) as release_number
cross join (values ('en'), ('pt')) as supported(locale);

update faith_harbor.gathering_templates
set release_id = case slug
  when 'gathering-1' then 'a0000000-0000-4000-8000-000000000001'::uuid
  when 'gathering-2' then 'a0000000-0000-4000-8000-000000000002'::uuid
  else release_id
end
where slug in ('gathering-1', 'gathering-2');

insert into faith_harbor.gathering_templates (
  id, slug, version, locale, title, summary, theme_key,
  estimated_duration_seconds, status, available_from, access_tier, editorial_revision
) values (
  'b0000000-0000-4000-8000-000000000001', 'weekly-rest', 1, 'en', 'Legacy v1',
  'Legacy compatibility template', 'legacy', 900, 'published', '2026-01-01T00:00:00Z', 'premium', 'editorial.1'
);

insert into faith_harbor.gathering_template_steps (gathering_template_id, step_order, section_type, content_key)
select template.id, step_order, 'arrival', format('safe.%s.%s', template.slug, step_order)
from faith_harbor.gathering_templates template cross join generate_series(1, 8) step_order;

do $verify_timezone_catalog$
declare
  result jsonb;
begin
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'UTC', '2026-03-02T00:00:00Z') into result;
  if result ->> 'timezone_name' <> 'UTC' or jsonb_array_length(result -> 'featured') < 1 then
    raise exception 'UTC Monday boundary was not available: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'America/Sao_Paulo', '2026-03-02T02:59:59Z') into result;
  if result::text like '%g-2026w10-mon%' then
    raise exception 'Sao Paulo Monday release arrived before local midnight: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'America/Sao_Paulo', '2026-03-02T03:00:00Z') into result;
  if result::text not like '%g-2026w10-mon%' then
    raise exception 'Sao Paulo Monday boundary was not available: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'Europe/Paris', '2026-03-04T22:59:59Z') into result;
  if result::text like '%g-2026w10-thu%' then
    raise exception 'Paris Thursday release arrived before local midnight: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'Europe/Paris', '2026-03-04T23:00:00Z') into result;
  if result::text not like '%g-2026w10-thu%' then
    raise exception 'Paris Thursday boundary was not available: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'Europe/Paris', '2026-01-04T22:59:59Z') into result;
  if (result #>> '{next_release,available_at}')::timestamptz <> '2026-01-04T23:00:00Z'::timestamptz then
    raise exception 'Paris winter available_at did not use IANA data: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'Europe/Paris', '2026-07-05T21:59:59Z') into result;
  if (result #>> '{next_release,available_at}')::timestamptz <> '2026-07-05T22:00:00Z'::timestamptz then
    raise exception 'Paris summer available_at did not use IANA data: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2(null, 'en', 'Invalid/Zone', '2026-03-02T00:00:00Z') into result;
  if result ->> 'timezone_name' <> 'UTC' or result ->> 'fallback_used' <> 'true' then
    raise exception 'invalid timezone did not use UTC fallback: %', result;
  end if;
  select faith_harbor.get_gathering_catalog_v2('22222222-2222-4222-8222-222222222222', 'en', 'UTC', '2026-03-02T00:00:00Z') into result;
  if result::text ~ 'completed_at|current_step' then
    raise exception 'anonymous catalog read resolved account progress: %', result;
  end if;
end
$verify_timezone_catalog$;

do $verify_milestones$
declare
  release_number integer;
  template_id uuid;
  result jsonb;
  awarded text[];
begin
  for release_number in 1..52 loop
    select id into template_id from faith_harbor.gathering_templates
    where slug = format('gathering-%s', release_number) and locale = 'en';
    select faith_harbor.save_gathering_progress_v2(
      '11111111-1111-4111-8111-111111111111', template_id, 8, 'completed', gen_random_uuid(), 'UTC'
    ) into result;
    if release_number = 1 and not (result -> 'new_milestone_codes' ? 'gathering_first_light') then
      raise exception 'first milestone missing: %', result;
    end if;
    if release_number in (8, 24, 52) and jsonb_array_length(result -> 'new_milestone_codes') <> 1 then
      raise exception 'milestone threshold was not awarded exactly once: %', result;
    end if;
  end loop;

  select faith_harbor.save_gathering_progress_v2(
    '11111111-1111-4111-8111-111111111111',
    (select id from faith_harbor.gathering_templates where slug = 'gathering-1' and locale = 'en'),
    8, 'completed', gen_random_uuid(), 'UTC'
  ) into result;
  if result ->> 'outcome' <> 'already_completed' or jsonb_array_length(result -> 'new_milestone_codes') <> 0 then
    raise exception 'same release completion was counted twice: %', result;
  end if;

  select array_agg(milestone_code order by milestone_code) into awarded
  from faith_harbor.user_milestones
  where user_id = '11111111-1111-4111-8111-111111111111'
    and milestone_code like 'gathering_%';
  if awarded <> array['gathering_first_light', 'gathering_long_companion', 'gathering_monthly_rhythm', 'gathering_season_keeper'] then
    raise exception 'new_milestone_codes leaked an unexpected value: %', awarded;
  end if;
  if (select count(distinct release_id) from faith_harbor.gathering_templates template join faith_harbor.user_gathering_progress progress on progress.gathering_template_id = template.id where progress.user_id = '11111111-1111-4111-8111-111111111111' and progress.status = 'completed') <> 52 then
    raise exception 'count(distinct release_id) was not 52';
  end if;
end
$verify_milestones$;

do $verify_cross_template_idempotency$
declare
  first_template_id uuid;
  second_template_id uuid;
  completion_key uuid := '90000000-0000-4000-8000-000000000001';
  first_result jsonb;
  retry_result jsonb;
  conflict_result jsonb;
begin
  select id into first_template_id from faith_harbor.gathering_templates where slug = 'gathering-1' and locale = 'en';
  select id into second_template_id from faith_harbor.gathering_templates where slug = 'gathering-2' and locale = 'en';
  select faith_harbor.save_gathering_progress_v2(
    '66666666-6666-4666-8666-666666666666', first_template_id, 8, 'completed', completion_key, 'UTC'
  ) into first_result;
  select faith_harbor.save_gathering_progress_v2(
    '66666666-6666-4666-8666-666666666666', first_template_id, 8, 'completed', completion_key, 'UTC'
  ) into retry_result;
  select faith_harbor.save_gathering_progress_v2(
    '66666666-6666-4666-8666-666666666666', second_template_id, 8, 'completed', completion_key, 'UTC'
  ) into conflict_result;

  if first_result ->> 'outcome' <> 'completed'
    or retry_result ->> 'outcome' <> 'already_completed' then
    raise exception 'same-template idempotent retry was not preserved: first %, retry %', first_result, retry_result;
  end if;
  if conflict_result ->> 'outcome' <> 'idempotency_conflict'
    or jsonb_array_length(conflict_result -> 'new_milestone_codes') <> 0 then
    raise exception 'cross-template idempotency key did not return a finite conflict: %', conflict_result;
  end if;
  if (select count(*) from faith_harbor.user_gathering_progress where user_id = '66666666-6666-4666-8666-666666666666' and status = 'completed') <> 1
    or (select count(*) from faith_harbor.user_gathering_progress where user_id = '66666666-6666-4666-8666-666666666666' and completion_idempotency_key = completion_key) <> 1
    or (select count(*) from faith_harbor.user_milestones where user_id = '66666666-6666-4666-8666-666666666666' and milestone_code = 'gathering_first_light') <> 1 then
    raise exception 'cross-template idempotency key created an extra completion or badge';
  end if;
end
$verify_cross_template_idempotency$;

do $verify_cross_version_idempotency$
declare
  v1_template_id uuid := 'b0000000-0000-4000-8000-000000000001';
  v2_template_id uuid;
  v1_first jsonb;
  v1_retry jsonb;
  v2_conflict jsonb;
  v2_first jsonb;
  v1_conflict jsonb;
begin
  select id into v2_template_id from faith_harbor.gathering_templates where slug = 'gathering-1' and locale = 'en';

  select faith_harbor.save_gathering_progress_v1(
    '88888888-8888-4888-8888-888888888888', v1_template_id, 8, true,
    '90000000-0000-4000-8000-000000000003', 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  ) into v1_first;
  select faith_harbor.save_gathering_progress_v1(
    '88888888-8888-4888-8888-888888888888', v1_template_id, 8, true,
    '90000000-0000-4000-8000-000000000003', 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  ) into v1_retry;
  select faith_harbor.save_gathering_progress_v2(
    '88888888-8888-4888-8888-888888888888', v2_template_id, 8, 'completed',
    '90000000-0000-4000-8000-000000000003', 'UTC'
  ) into v2_conflict;
  if v1_first ->> 'outcome' <> 'completed'
    or v1_retry ->> 'outcome' <> 'already_completed'
    or v1_retry ->> 'practice_credit' <> 'guided_prayer' then
    raise exception 'v1 compatibility response or same-template retry changed: first %, retry %', v1_first, v1_retry;
  end if;
  if v2_conflict ->> 'outcome' <> 'idempotency_conflict' then
    raise exception 'sequential v1-v2 idempotency key did not return a finite conflict: %', v2_conflict;
  end if;
  if (select count(*) from faith_harbor.user_gathering_progress where user_id = '88888888-8888-4888-8888-888888888888' and status = 'completed') <> 1
    or (select count(*) from faith_harbor.user_gathering_progress where user_id = '88888888-8888-4888-8888-888888888888' and completion_idempotency_key = '90000000-0000-4000-8000-000000000003') <> 1
    or (select count(*) from faith_harbor.user_milestones where user_id = '88888888-8888-4888-8888-888888888888' and milestone_code = 'gathering_first_light') > 1 then
    raise exception 'sequential v1-v2 idempotency key duplicated progress, completion, or badge';
  end if;

  select faith_harbor.save_gathering_progress_v2(
    '99999999-9999-4999-8999-999999999999', v2_template_id, 8, 'completed',
    '90000000-0000-4000-8000-000000000004', 'UTC'
  ) into v2_first;
  select faith_harbor.save_gathering_progress_v1(
    '99999999-9999-4999-8999-999999999999', v1_template_id, 8, true,
    '90000000-0000-4000-8000-000000000004', 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  ) into v1_conflict;
  if v2_first ->> 'outcome' <> 'completed'
    or v1_conflict ->> 'outcome' <> 'idempotency_conflict' then
    raise exception 'sequential v2-v1 idempotency key did not return a finite conflict: v2 %, v1 %', v2_first, v1_conflict;
  end if;
  if (select count(*) from faith_harbor.user_gathering_progress where user_id = '99999999-9999-4999-8999-999999999999' and status = 'completed') <> 1
    or (select count(*) from faith_harbor.user_gathering_progress where user_id = '99999999-9999-4999-8999-999999999999' and completion_idempotency_key = '90000000-0000-4000-8000-000000000004') <> 1
    or (select count(*) from faith_harbor.user_milestones where user_id = '99999999-9999-4999-8999-999999999999' and milestone_code = 'gathering_first_light') <> 1 then
    raise exception 'sequential v2-v1 idempotency key duplicated progress, completion, or badge';
  end if;

  perform faith_harbor.save_gathering_progress_v1(
    '14141414-1414-4141-8141-141414141414', v1_template_id, 8, true,
    '90000000-0000-4000-8000-000000000007', 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  );
  perform faith_harbor.save_gathering_progress_v2(
    '14141414-1414-4141-8141-141414141414', v2_template_id, 8, 'completed',
    '90000000-0000-4000-8000-000000000008', 'UTC'
  );
  select faith_harbor.save_gathering_progress_v1(
    '14141414-1414-4141-8141-141414141414', v1_template_id, 8, true,
    '90000000-0000-4000-8000-000000000008', 'UTC', '2026-08-27', '2026-08-24', '2026-08-27T00:00:00Z'
  ) into v1_conflict;
  if v1_conflict ->> 'outcome' <> 'already_completed'
    or v1_conflict ->> 'practice_credit' <> 'guided_prayer' then
    raise exception 'v1 completed-row precedence was not preserved: %', v1_conflict;
  end if;
end
$verify_cross_version_idempotency$;

do $verify_service_rpcs$
declare
  result jsonb;
begin
  if has_function_privilege('public', 'faith_harbor.get_gathering_catalog_v2(uuid,text,text,timestamp with time zone)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.get_gathering_catalog_v2(uuid,text,text,timestamp with time zone)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.get_gathering_catalog_v2(uuid,text,text,timestamp with time zone)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.get_gathering_catalog_v2(uuid,text,text,timestamp with time zone)', 'execute') then
    raise exception 'unexpected catalog RPC ACL';
  end if;
  select faith_harbor.record_gathering_operational_event_v1('inventory_checked', 'succeeded', 'monday', 'en', 'under_1s', null) into result;
  if result ->> 'outcome' <> 'recorded' then raise exception 'operational event not recorded'; end if;
  if faith_harbor.record_gathering_operational_event_v1(null, 'succeeded', 'monday', 'en', null, null) ->> 'outcome' <> 'invalid_request'
    or faith_harbor.record_gathering_operational_event_v1('inventory_checked', null, 'monday', 'en', null, null) ->> 'outcome' <> 'invalid_request'
    or faith_harbor.record_gathering_operational_event_v1('inventory_checked', 'succeeded', null, 'en', null, null) ->> 'outcome' <> 'invalid_request'
    or faith_harbor.record_gathering_operational_event_v1('inventory_checked', 'succeeded', 'monday', null, null, null) ->> 'outcome' <> 'invalid_request' then
    raise exception 'operational NULL dimensions were not rejected';
  end if;
  select faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'view', 1, 'd0000000-0000-4000-8000-000000000001') into result;
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'start', 1, 'd0000000-0000-4000-8000-000000000002');
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'completion', 1, 'd0000000-0000-4000-8000-000000000003');
  if (select array[views, starts, completions, resumes, step_dropoffs] from faith_harbor.gathering_content_metrics_daily where metric_date = current_date and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'en') <> array[1, 1, 1, 0, 0] then
    raise exception 'requested metrics did not remain independent';
  end if;
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'pt', 'resume', 1, 'd0000000-0000-4000-8000-000000000004');
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date + 1, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'step_dropout', 1, 'd0000000-0000-4000-8000-000000000005');
  if (select array[views, starts, completions, resumes, step_dropoffs] from faith_harbor.gathering_content_metrics_daily where metric_date = current_date and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'pt') <> array[0, 0, 0, 1, 0]
    or (select array[views, starts, completions, resumes, step_dropoffs] from faith_harbor.gathering_content_metrics_daily where metric_date = current_date + 1 and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'en') <> array[0, 0, 0, 0, 1] then
    raise exception 'isolated metrics fabricated other counters';
  end if;
  select faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'es', 'view', 2, 'd0000000-0000-4000-8000-000000000006') into result;
  if result ->> 'outcome' <> 'recorded'
    or faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'es', 'view', 2, 'd0000000-0000-4000-8000-000000000006') ->> 'outcome' <> 'already_recorded' then
    raise exception 'metric retry did not remain idempotent';
  end if;
  if faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'es', 'view', 3, 'd0000000-0000-4000-8000-000000000006') ->> 'outcome' <> 'idempotency_conflict'
    or (select array[views, starts, completions, resumes, step_dropoffs] from faith_harbor.gathering_content_metrics_daily where metric_date = current_date and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'es') <> array[2, 0, 0, 0, 0] then
    raise exception 'metric idempotency key conflict incremented a counter';
  end if;
  if faith_harbor.aggregate_gathering_metrics_v1(current_date, 'ffffffff-ffff-4fff-8fff-ffffffffffff', 'monday', 'fr', 'view', 1, 'd0000000-0000-4000-8000-000000000007') ->> 'outcome' <> 'not_found'
    or faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'fr', 'view', 1, 'd0000000-0000-4000-8000-000000000007') ->> 'outcome' <> 'recorded' then
    raise exception 'failed validation permanently consumed a metric idempotency key';
  end if;
  if faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', null, 1, 'd0000000-0000-4000-8000-000000000008') ->> 'outcome' <> 'invalid_request' then
    raise exception 'NULL metric_name was not rejected';
  end if;
  if has_function_privilege('public', 'faith_harbor.aggregate_gathering_metrics_v1(date,uuid,text,text,text,integer,uuid)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.aggregate_gathering_metrics_v1(date,uuid,text,text,text,integer,uuid)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.aggregate_gathering_metrics_v1(date,uuid,text,text,text,integer,uuid)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.aggregate_gathering_metrics_v1(date,uuid,text,text,text,integer,uuid)', 'execute')
    or not exists (select 1 from pg_catalog.pg_class as relation join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace where namespace.nspname = 'faith_harbor' and relation.relname = 'gathering_metric_idempotency_keys' and relation.relrowsecurity)
    or has_table_privilege('public', 'faith_harbor.gathering_metric_idempotency_keys', 'select')
    or has_table_privilege('anon', 'faith_harbor.gathering_metric_idempotency_keys', 'insert')
    or has_table_privilege('authenticated', 'faith_harbor.gathering_metric_idempotency_keys', 'delete')
    or not has_table_privilege('service_role', 'faith_harbor.gathering_metric_idempotency_keys', 'insert') then
    raise exception 'metric idempotency storage ACL or RLS was not private';
  end if;
  select faith_harbor.purge_gathering_metric_idempotency_keys_v1(pg_catalog.clock_timestamp() + interval '31 days') into result;
  if result ->> 'outcome' <> 'purged'
    or exists (select 1 from faith_harbor.gathering_metric_idempotency_keys) then
    raise exception 'metric idempotency retention purge did not clear expired keys: result %, remaining %', result, (select count(*) from faith_harbor.gathering_metric_idempotency_keys);
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'faith_harbor' and table_name = 'gathering_content_metrics_daily' and column_name in ('user_id', 'account_id', 'email')) then
    raise exception 'daily metrics retained identity';
  end if;
end
$verify_service_rpcs$;
SQL

run_concurrent_threshold() {
  local account_id=$1
  local seeded_release=$2
  local first_release=$3
  local second_release=$4
  local milestone_code=$5
  local first_output="$GATHERINGS_PG_ROOT/${milestone_code}.first"
  local second_output="$GATHERINGS_PG_ROOT/${milestone_code}.second"
  local first_key
  local second_key
  printf -v first_key '70000000-0000-4000-8000-%012d' "$first_release"
  printf -v second_key '80000000-0000-4000-8000-%012d' "$second_release"

  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "do \$\$ declare release_number integer; template_id uuid; begin for release_number in 1..$seeded_release loop select id into template_id from faith_harbor.gathering_templates where slug = format('gathering-%s', release_number) and locale = 'en'; perform faith_harbor.save_gathering_progress_v2('$account_id', template_id, 8, 'completed', gen_random_uuid(), 'UTC'); end loop; end \$\$;" >/dev/null

  gatherings_psql -At -d gatherings_clean -c "select pg_sleep(0.25); select faith_harbor.save_gathering_progress_v2('$account_id', (select id from faith_harbor.gathering_templates where slug = 'gathering-$first_release' and locale = 'en'), 8, 'completed', '$first_key'::uuid, 'UTC');" >"$first_output" &
  local first_pid=$!
  gatherings_psql -At -d gatherings_clean -c "select pg_sleep(0.25); select faith_harbor.save_gathering_progress_v2('$account_id', (select id from faith_harbor.gathering_templates where slug = 'gathering-$second_release' and locale = 'en'), 8, 'completed', '$second_key'::uuid, 'UTC');" >"$second_output" &
  local second_pid=$!
  wait "$first_pid"
  wait "$second_pid"

  gatherings_psql -d gatherings_clean -c "do \$\$ begin if (select count(*) from faith_harbor.user_milestones where user_id = '$account_id' and milestone_code = '$milestone_code') <> 1 then raise exception 'concurrent threshold badge was missed or duplicated: $milestone_code'; end if; end \$\$;" >/dev/null
}

run_concurrent_threshold '33333333-3333-4333-8333-333333333333' 6 7 8 gathering_monthly_rhythm
run_concurrent_threshold '44444444-4444-4444-8444-444444444444' 22 23 24 gathering_season_keeper
run_concurrent_threshold '55555555-5555-4555-8555-555555555555' 50 51 52 gathering_long_companion

run_concurrent_cross_template_idempotency() {
  local account_id='77777777-7777-4777-8777-777777777777'
  local completion_key='90000000-0000-4000-8000-000000000002'
  local first_output="$GATHERINGS_PG_ROOT/cross-template-idempotency.first"
  local second_output="$GATHERINGS_PG_ROOT/cross-template-idempotency.second"

  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); select faith_harbor.save_gathering_progress_v2('$account_id', (select id from faith_harbor.gathering_templates where slug = 'gathering-1' and locale = 'en'), 8, 'completed', '$completion_key'::uuid, 'UTC');" >"$first_output" 2>&1 &
  local first_pid=$!
  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); select faith_harbor.save_gathering_progress_v2('$account_id', (select id from faith_harbor.gathering_templates where slug = 'gathering-2' and locale = 'en'), 8, 'completed', '$completion_key'::uuid, 'UTC');" >"$second_output" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  wait "$second_pid"

  if rg -q 'ERROR|23505' "$first_output" "$second_output"; then
    echo 'concurrent cross-template idempotency key leaked a raw database error' >&2
    return 1
  fi
  if [[ $(rg -l '"outcome": "idempotency_conflict"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]]; then
    echo 'concurrent cross-template idempotency key did not produce exactly one conflict' >&2
    return 1
  fi
  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from faith_harbor.user_gathering_progress where user_id = '$account_id' and status = 'completed') <> 1 or (select count(*) from faith_harbor.user_gathering_progress where user_id = '$account_id' and completion_idempotency_key = '$completion_key'::uuid) <> 1 or (select count(*) from faith_harbor.user_milestones where user_id = '$account_id' and milestone_code = 'gathering_first_light') <> 1 then raise exception 'concurrent cross-template idempotency key did not produce exactly one completion and one conflict'; end if; end \$\$;" >/dev/null
}

run_concurrent_cross_template_idempotency

run_concurrent_cross_version_idempotency() {
  local account_id=$1
  local completion_key=$2
  local first_kind=$3
  local second_kind=$4
  local first_output="$GATHERINGS_PG_ROOT/cross-version-${first_kind}-${second_kind}.first"
  local second_output="$GATHERINGS_PG_ROOT/cross-version-${first_kind}-${second_kind}.second"
  local v1_call="select faith_harbor.save_gathering_progress_v1('$account_id', 'b0000000-0000-4000-8000-000000000001'::uuid, 8, true, '$completion_key'::uuid, 'UTC', '2026-08-27'::date, '2026-08-24'::date, '2026-08-27T00:00:00Z'::timestamptz);"
  local v2_call="select faith_harbor.save_gathering_progress_v2('$account_id', (select id from faith_harbor.gathering_templates where slug = 'gathering-1' and locale = 'en'), 8, 'completed', '$completion_key'::uuid, 'UTC');"
  local first_call=$v1_call
  local second_call=$v2_call

  if [[ "$first_kind" == 'v2' ]]; then first_call=$v2_call; fi
  if [[ "$second_kind" == 'v1' ]]; then second_call=$v1_call; fi

  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "begin; select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('$account_id', 1)); select pg_sleep(0.25); $first_call commit;" >"$first_output" 2>&1 &
  local first_pid=$!
  wait_for_account_lock "$account_id"
  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "$second_call" >"$second_output" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  wait "$second_pid"

  if rg -q 'ERROR|23505' "$first_output" "$second_output"; then
    echo 'concurrent cross-version idempotency key leaked a raw database error' >&2
    return 1
  fi
  if [[ $(rg -l '"outcome": "idempotency_conflict"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]]; then
    echo 'concurrent cross-version idempotency key did not produce exactly one finite conflict' >&2
    return 1
  fi
  if ! rg -q '"outcome": "completed"' "$first_output" \
    || ! rg -q '"outcome": "idempotency_conflict"' "$second_output"; then
    echo 'designated first completion did not win the lock handshake' >&2
    return 1
  fi
  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select count(*) from faith_harbor.user_gathering_progress where user_id = '$account_id' and status = 'completed') <> 1 or (select count(*) from faith_harbor.user_gathering_progress where user_id = '$account_id' and completion_idempotency_key = '$completion_key'::uuid) <> 1 or (select count(*) from faith_harbor.user_milestones where user_id = '$account_id' and milestone_code = 'gathering_first_light') > 1 then raise exception 'concurrent cross-version idempotency key did not produce exactly one completion and one conflict'; end if; end \$\$;" >/dev/null
}

wait_for_account_lock() {
  local account_id=$1
  local attempt
  local lock_state

  for attempt in $(seq 1 100); do
    lock_state=$(gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select case when pg_catalog.pg_try_advisory_lock(pg_catalog.hashtextextended('$account_id', 1)) then pg_catalog.pg_advisory_unlock(pg_catalog.hashtextextended('$account_id', 1))::text else 'held' end;")
    if [[ "$lock_state" == 'held' ]]; then
      return 0
    fi
    sleep 0.02
  done

  echo "account lock handshake timed out for $account_id" >&2
  return 1
}

run_concurrent_v1_v2_idempotency() {
  run_concurrent_cross_version_idempotency '12121212-1212-4121-8121-121212121212' '90000000-0000-4000-8000-000000000005' v1 v2
}

run_concurrent_v2_v1_idempotency() {
  run_concurrent_cross_version_idempotency '13131313-1313-4131-8131-131313131313' '90000000-0000-4000-8000-000000000006' v2 v1
}

run_concurrent_v1_v2_idempotency
run_concurrent_v2_v1_idempotency

run_concurrent_metric_retry() {
  local metric_key='e0000000-0000-4000-8000-000000000001'
  local first_output="$GATHERINGS_PG_ROOT/metric-retry.first"
  local second_output="$GATHERINGS_PG_ROOT/metric-retry.second"
  local metric_call="select faith_harbor.aggregate_gathering_metrics_v1(current_date + 2, 'a0000000-0000-4000-8000-000000000001'::uuid, 'monday', 'de', 'view', 1, '$metric_key'::uuid);"

  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); $metric_call" >"$first_output" 2>&1 &
  local first_pid=$!
  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); $metric_call" >"$second_output" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  wait "$second_pid"

  if rg -q 'ERROR|23505' "$first_output" "$second_output" \
    || [[ $(rg -l '"outcome": "recorded"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]] \
    || [[ $(rg -l '"outcome": "already_recorded"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]]; then
    echo 'concurrent metric retry did not return one record and one duplicate outcome' >&2
    return 1
  fi
  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select array[views, starts, completions, resumes, step_dropoffs] from faith_harbor.gathering_content_metrics_daily where metric_date = current_date + 2 and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'de') <> array[1, 0, 0, 0, 0] then raise exception 'concurrent metric retry did not increment exactly once'; end if; end \$\$;" >/dev/null
}

run_concurrent_metric_conflict() {
  local metric_key='e0000000-0000-4000-8000-000000000002'
  local first_output="$GATHERINGS_PG_ROOT/metric-conflict.first"
  local second_output="$GATHERINGS_PG_ROOT/metric-conflict.second"
  local view_call="select faith_harbor.aggregate_gathering_metrics_v1(current_date + 3, 'a0000000-0000-4000-8000-000000000001'::uuid, 'monday', 'de', 'view', 1, '$metric_key'::uuid);"
  local start_call="select faith_harbor.aggregate_gathering_metrics_v1(current_date + 3, 'a0000000-0000-4000-8000-000000000001'::uuid, 'monday', 'de', 'start', 1, '$metric_key'::uuid);"

  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); $view_call" >"$first_output" 2>&1 &
  local first_pid=$!
  gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select pg_sleep(0.25); $start_call" >"$second_output" 2>&1 &
  local second_pid=$!
  wait "$first_pid"
  wait "$second_pid"

  if rg -q 'ERROR|23505' "$first_output" "$second_output" \
    || [[ $(rg -l '"outcome": "recorded"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]] \
    || [[ $(rg -l '"outcome": "idempotency_conflict"' "$first_output" "$second_output" | wc -l | tr -d ' ') -ne 1 ]]; then
    echo 'concurrent metric conflict did not return one record and one finite conflict' >&2
    return 1
  fi
  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "do \$\$ begin if (select views + starts + completions + resumes + step_dropoffs from faith_harbor.gathering_content_metrics_daily where metric_date = current_date + 3 and release_id = 'a0000000-0000-4000-8000-000000000001' and locale = 'de') <> 1 then raise exception 'concurrent metric conflict fabricated a counter'; end if; end \$\$;" >/dev/null
}

run_failed_metric_write_rollback() {
  local metric_key='e0000000-0000-4000-8000-000000000003'
  local failure_output="$GATHERINGS_PG_ROOT/metric-write-failure"

  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "insert into faith_harbor.gathering_content_metrics_daily (metric_date, release_id, slot_type, locale, views) values (current_date + 4, 'a0000000-0000-4000-8000-000000000002', 'thursday', 'de', 100000000);" >/dev/null
  if gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select faith_harbor.aggregate_gathering_metrics_v1(current_date + 4, 'a0000000-0000-4000-8000-000000000002'::uuid, 'thursday', 'de', 'view', 1, '$metric_key'::uuid);" >"$failure_output" 2>&1; then
    echo 'metric write overflow unexpectedly succeeded' >&2
    return 1
  fi
  if ! rg -q 'gathering_content_metrics_daily_independent_counters_check' "$failure_output"; then
    echo 'metric write failure did not reach the bounded counter constraint' >&2
    return 1
  fi
  gatherings_psql -d gatherings_clean -v ON_ERROR_STOP=1 -c "update faith_harbor.gathering_content_metrics_daily set views = 0 where metric_date = current_date + 4 and release_id = 'a0000000-0000-4000-8000-000000000002' and locale = 'de';" >/dev/null
  if ! gatherings_psql -At -d gatherings_clean -v ON_ERROR_STOP=1 -c "select faith_harbor.aggregate_gathering_metrics_v1(current_date + 4, 'a0000000-0000-4000-8000-000000000002'::uuid, 'thursday', 'de', 'view', 1, '$metric_key'::uuid);" | rg -q '"outcome": "recorded"'; then
    echo 'failed metric write permanently consumed its idempotency key' >&2
    return 1
  fi
}

run_concurrent_metric_retry
run_concurrent_metric_conflict
run_failed_metric_write_rollback

echo "gatherings v2 PostgreSQL integration passed"
