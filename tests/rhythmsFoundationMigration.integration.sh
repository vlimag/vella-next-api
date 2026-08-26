#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
RHYTHMS_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_vella_rhythms_foundation.sql)

if [[ ${#RHYTHMS_MIGRATIONS[@]} -ne 1 || ! -f "${RHYTHMS_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one Vella Rhythms foundation migration" >&2
  exit 1
fi

MIGRATION_PATH=${RHYTHMS_MIGRATIONS[0]}
RHYTHMS_PG_ROOT=$(mktemp -d)
RHYTHMS_PG_DATA="$RHYTHMS_PG_ROOT/data"
RHYTHMS_PG_PORT=${RHYTHMS_PG_PORT:-55476}

case "$RHYTHMS_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_rhythms_postgres() {
  pg_ctl -D "$RHYTHMS_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$RHYTHMS_PG_ROOT"
}
trap cleanup_rhythms_postgres EXIT

rhythms_psql() {
  psql -v ON_ERROR_STOP=1 -h "$RHYTHMS_PG_ROOT" -p "$RHYTHMS_PG_PORT" postgres "$@"
}

initdb -D "$RHYTHMS_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$RHYTHMS_PG_DATA" -o "-F -p $RHYTHMS_PG_PORT -k $RHYTHMS_PG_ROOT" -w start >/dev/null

rhythms_psql >/dev/null <<'SQL'
create extension if not exists pgcrypto;
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid()
returns uuid
language sql
stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create schema faith_harbor;
grant usage on schema faith_harbor to anon, authenticated, service_role;

create function faith_harbor.set_updated_at()
returns trigger
language plpgsql
as $$ begin new.updated_at = now(); return new; end $$;

create table faith_harbor.gamification_milestones (
  code text primary key,
  title text not null,
  description text not null,
  metric text not null,
  target_value integer not null,
  badge_color text not null default 'gold',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);
create table faith_harbor.user_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  milestone_code text not null references faith_harbor.gamification_milestones(code) on delete cascade
);
create table faith_harbor.user_journeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  start_date date not null default current_date,
  current_day integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into auth.users (id) values
  ('11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-222222222222');
insert into faith_harbor.gamification_milestones (code, title, description, metric, target_value)
values
  ('streak_3', 'Original streak', 'old metadata remains compatible', 'streak', 3),
  ('streak_7', 'Original week', 'old metadata remains compatible', 'streak', 7),
  ('journey_finisher', 'Original finisher', 'old metadata remains compatible', 'completed_journeys', 1);
insert into faith_harbor.user_journeys (id, user_id, status, current_day)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'active', 2);
SQL

rhythms_psql -f "$MIGRATION_PATH" >/dev/null

rhythms_psql >/dev/null <<'SQL'
do $verify_rhythms_foundation$
declare
  relation_name text;
  policy_name text;
begin
  foreach relation_name in array array[
    'practice_definitions', 'user_practices', 'practice_sessions',
    'gathering_templates', 'gathering_template_steps',
    'user_gathering_progress', 'user_featured_milestones'
  ] loop
    if not exists (
      select 1 from pg_class as relation
      join pg_namespace as namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'faith_harbor'
        and relation.relname = relation_name
        and relation.relrowsecurity
    ) then
      raise exception 'RLS missing for %', relation_name;
    end if;
    if has_table_privilege('anon', format('faith_harbor.%I', relation_name), 'select')
      or has_table_privilege('authenticated', format('faith_harbor.%I', relation_name), 'select') then
      raise exception 'public data API role retained a Rhythms grant for %', relation_name;
    end if;
  end loop;

  foreach relation_name in array array['practice_definitions', 'gathering_templates', 'gathering_template_steps'] loop
    if not has_table_privilege('service_role', format('faith_harbor.%I', relation_name), 'select')
      or has_table_privilege('service_role', format('faith_harbor.%I', relation_name), 'insert') then
      raise exception 'catalog service grant drifted for %', relation_name;
    end if;
  end loop;
  foreach relation_name in array array['user_practices', 'practice_sessions', 'user_gathering_progress', 'user_featured_milestones'] loop
    if not has_table_privilege('service_role', format('faith_harbor.%I', relation_name), 'select, insert, update, delete')
      or has_table_privilege('service_role', format('faith_harbor.%I', relation_name), 'truncate') then
      raise exception 'account service grant drifted for %', relation_name;
    end if;
    foreach policy_name in array array['select', 'insert', 'update', 'delete'] loop
      if not exists (
        select 1 from pg_policies
        where schemaname = 'faith_harbor'
          and tablename = relation_name
          and policyname = relation_name || ' owner ' || policy_name
          and roles = array['authenticated']::name[]
          and coalesce(qual, with_check) like '%auth.uid()%user_id%'
      ) then
        raise exception 'owner policy missing or unsafe for %.%', relation_name, policy_name;
      end if;
    end loop;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'faith_harbor'
        and tablename = relation_name
        and policyname = relation_name || ' owner update'
        and qual like '%auth.uid()%user_id%'
        and with_check like '%auth.uid()%user_id%'
    ) then
      raise exception 'owner update policy lacks using or with check for %', relation_name;
    end if;
  end loop;

  if (select count(*) from faith_harbor.practice_definitions) <> 6 then
    raise exception 'practice seeds drifted';
  end if;
  if (select array_agg(code order by code) from faith_harbor.practice_definitions) <> array[
    'act_of_kindness', 'daily_reflection', 'gratitude', 'guided_prayer', 'scripture', 'silence'
  ] then
    raise exception 'practice codes drifted';
  end if;
  if not exists (
    select 1 from faith_harbor.gamification_milestones
    where code = 'journey_finisher' and category = 'journey' and tier = 'spark'
      and asset_key = 'flame.spark'
      and is_active and is_shareable
  ) then
    raise exception 'canonical milestone upsert drifted';
  end if;
  if exists (
    select 1
    from (values
      ('streak_3'::text, 'flame.spark'::text),
      ('streak_7'::text, 'flame.steady'::text),
      ('journey_finisher'::text, 'flame.spark'::text)
    ) as expected(code, asset_key)
    left join faith_harbor.gamification_milestones as milestone
      on milestone.code = expected.code and milestone.asset_key = expected.asset_key
    where milestone.code is null
  ) then
    raise exception 'canonical milestone asset-key seed drifted';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'faith_harbor' and table_name = 'user_journeys'
      and column_name = 'timezone_name' and column_default like '%UTC%'
  ) then
    raise exception 'old journey compatibility default missing';
  end if;
  if (select count(*) from faith_harbor.user_journeys where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') <> 1 then
    raise exception 'migration changed a pre-existing journey row';
  end if;
end
$verify_rhythms_foundation$;

do $verify_milestone_asset_keys$
declare
  candidate_asset_key text;
begin
  foreach candidate_asset_key in array array[
    'milestone.generic', 'flame.spark', 'flame.steady', 'flame.rooted', 'flame.pilgrim', 'future.server.badge'
  ] loop
    insert into faith_harbor.gamification_milestones (
      code, title, description, metric, target_value, asset_key
    ) values (
      'fixture_' || replace(candidate_asset_key, '.', '_'),
      'Fixture',
      'Valid bounded dotted asset key',
      'streak',
      1,
      candidate_asset_key
    );
  end loop;

  if (select count(*) from faith_harbor.gamification_milestones where code in (
    'fixture_milestone_generic', 'fixture_flame_spark', 'fixture_flame_steady',
    'fixture_flame_rooted', 'fixture_flame_pilgrim', 'fixture_future_server_badge'
  ) and asset_key in (
    'milestone.generic', 'flame.spark', 'flame.steady', 'flame.rooted', 'flame.pilgrim', 'future.server.badge'
  )) <> 6 then
    raise exception 'canonical or future dotted asset key was rejected';
  end if;
  if exists (
    select 1
    from (values
      ('streak_3'::text, 'flame.spark'::text),
      ('streak_7'::text, 'flame.steady'::text),
      ('journey_finisher'::text, 'flame.spark'::text)
    ) as expected(code, asset_key)
    left join faith_harbor.gamification_milestones as milestone
      on milestone.code = expected.code and milestone.asset_key = expected.asset_key
    where milestone.code is null
  ) then
    raise exception 'fixture changed canonical milestone asset-key seeds';
  end if;
end
$verify_milestone_asset_keys$;

insert into faith_harbor.user_journeys (user_id, status, current_day)
values ('11111111-1111-1111-1111-111111111111', 'active', 3);

do $verify_constraints$
declare
  template_id uuid;
  milestone_id uuid;
begin
  insert into faith_harbor.user_practices (user_id, practice_code, weekly_target)
  values ('11111111-1111-1111-1111-111111111111', 'scripture', 3);
  begin
    insert into faith_harbor.user_practices (user_id, practice_code, weekly_target)
    values ('11111111-1111-1111-1111-111111111111', 'scripture', 3);
    raise exception 'duplicate user practice accepted';
  exception when unique_violation then null;
  end;

  insert into faith_harbor.practice_sessions (
    user_id, practice_code, source_type, source_key, idempotency_key, status, local_day, local_week_start, completed_at
  ) values (
    '11111111-1111-1111-1111-111111111111', 'scripture', 'direct', 'direct:one',
    '33333333-3333-3333-3333-333333333333', 'completed', current_date, date_trunc('week', current_date)::date, now()
  );
  begin
    insert into faith_harbor.practice_sessions (
      user_id, practice_code, source_type, source_key, idempotency_key, status, local_day, local_week_start, completed_at
    ) values (
      '11111111-1111-1111-1111-111111111111', 'scripture', 'direct', 'direct:two',
      '33333333-3333-3333-3333-333333333333', 'completed', current_date, date_trunc('week', current_date)::date, now()
    );
    raise exception 'duplicate idempotency key accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into faith_harbor.practice_sessions (
      user_id, practice_code, source_type, source_key, idempotency_key, status, local_day, local_week_start, completed_at
    ) values (
      '11111111-1111-1111-1111-111111111111', 'scripture', 'direct', 'direct:one',
      '44444444-4444-4444-4444-444444444444', 'completed', current_date, date_trunc('week', current_date)::date, now()
    );
    raise exception 'duplicate source credit accepted';
  exception when unique_violation then null;
  end;

  insert into faith_harbor.gathering_templates (
    slug, version, locale, title, summary, theme_key, estimated_duration_seconds, status, editorial_revision
  ) values ('first-gathering', 1, 'en', 'Fixture', 'Fixture only', 'hope', 900, 'draft', 'fixture-1')
  returning id into template_id;
  insert into faith_harbor.user_gathering_progress (user_id, gathering_template_id, status)
  values ('11111111-1111-1111-1111-111111111111', template_id, 'in_progress');
  begin
    insert into faith_harbor.user_gathering_progress (user_id, gathering_template_id, status)
    values ('11111111-1111-1111-1111-111111111111', template_id, 'in_progress');
    raise exception 'duplicate gathering progress accepted';
  exception when unique_violation then null;
  end;

  insert into faith_harbor.user_milestones (user_id, milestone_code)
  values ('11111111-1111-1111-1111-111111111111', 'journey_finisher')
  returning id into milestone_id;
  insert into faith_harbor.user_featured_milestones (user_id, user_milestone_id, position)
  values ('11111111-1111-1111-1111-111111111111', milestone_id, 1);
  begin
    insert into faith_harbor.user_featured_milestones (user_id, user_milestone_id, position)
    values ('22222222-2222-2222-2222-222222222222', milestone_id, 2);
    raise exception 'another account featured a milestone it did not earn';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into faith_harbor.user_featured_milestones (user_id, user_milestone_id, position)
    values ('11111111-1111-1111-1111-111111111111', milestone_id, 2);
    raise exception 'duplicate featured milestone accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into faith_harbor.user_featured_milestones (user_id, user_milestone_id, position)
    values ('22222222-2222-2222-2222-222222222222', milestone_id, 4);
    raise exception 'out-of-range featured position accepted';
  exception when check_violation then null;
  end;
end
$verify_constraints$;

grant select, insert, update, delete on table
  faith_harbor.user_practices,
  faith_harbor.practice_sessions,
  faith_harbor.user_gathering_progress,
  faith_harbor.user_featured_milestones
to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
do $verify_rls$
begin
  if exists (
    select 1 from faith_harbor.user_practices
    where user_id = '22222222-2222-2222-2222-222222222222'
  ) then
    raise exception 'another account became visible through RLS';
  end if;
  begin
    insert into faith_harbor.user_practices (user_id, practice_code, weekly_target)
    values ('22222222-2222-2222-2222-222222222222', 'gratitude', 2);
    raise exception 'RLS accepted another account insert';
  exception when insufficient_privilege then null;
  end;
end
$verify_rls$;
reset role;
SQL
