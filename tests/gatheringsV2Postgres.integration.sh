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
GATHERINGS_PG_ROOT=$(mktemp -d)
GATHERINGS_PG_DATA="$GATHERINGS_PG_ROOT/data"
GATHERINGS_PG_PORT=${GATHERINGS_PG_PORT:-55458}

[[ -f "$TASK_1_MIGRATION" && -f "$TASK_2_MIGRATION" ]] || {
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
create table faith_harbor.gathering_template_steps (id uuid primary key default gen_random_uuid(), gathering_template_id uuid not null references faith_harbor.gathering_templates(id), step_order smallint not null, section_type text not null, content_key text not null, unique (gathering_template_id, step_order));
create table faith_harbor.user_gathering_progress (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), gathering_template_id uuid not null references faith_harbor.gathering_templates(id), current_step smallint not null default 0, status text not null default 'not_started', started_at timestamptz, completed_at timestamptz, last_seen_at timestamptz, completion_idempotency_key uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (user_id, gathering_template_id));
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
gatherings_psql -d gatherings_upgrade >/dev/null <<'SQL'
insert into auth.users (id, is_anonymous) values ('11111111-1111-4111-8111-111111111111', false);
insert into faith_harbor.gathering_templates (id, slug, version, locale, title, summary, theme_key, estimated_duration_seconds, status, access_tier, editorial_revision)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'weekly-rest', 1, 'en', 'Legacy v1', 'Legacy contract', 'legacy', 900, 'published', 'premium', 'editorial.1');
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
end
$verify_v1_preserved$;
SQL

gatherings_psql -d gatherings_clean >/dev/null <<'SQL'
insert into auth.users (id, is_anonymous) values
  ('11111111-1111-4111-8111-111111111111', false),
  ('22222222-2222-4222-8222-222222222222', true);

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
  select faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'view', 1) into result;
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'start', 1);
  perform faith_harbor.aggregate_gathering_metrics_v1(current_date, 'a0000000-0000-4000-8000-000000000001', 'monday', 'en', 'completion', 1);
  if (select completions from faith_harbor.gathering_content_metrics_daily where metric_date = current_date and release_id = 'a0000000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'aggregate metric was not recorded';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'faith_harbor' and table_name = 'gathering_content_metrics_daily' and column_name in ('user_id', 'account_id', 'email')) then
    raise exception 'daily metrics retained identity';
  end if;
end
$verify_service_rpcs$;
SQL

echo "gatherings v2 PostgreSQL integration passed"
