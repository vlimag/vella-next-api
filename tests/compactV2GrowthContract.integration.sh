#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
COMPACT_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_compact_v2_growth_contract.sql)

if [[ ${#COMPACT_MIGRATIONS[@]} -ne 1 || ! -f "${COMPACT_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one compact-v2 growth contract migration" >&2
  exit 1
fi

MIGRATION_PATH=${COMPACT_MIGRATIONS[0]}
COMPACT_PG_ROOT=$(mktemp -d)
COMPACT_PG_DATA="$COMPACT_PG_ROOT/data"
COMPACT_PG_PORT=${COMPACT_PG_PORT:-55444}

case "$COMPACT_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) exit 1 ;;
esac

cleanup_compact_postgres() {
  pg_ctl -D "$COMPACT_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$COMPACT_PG_ROOT"
}
trap cleanup_compact_postgres EXIT

compact_psql() {
  psql -v ON_ERROR_STOP=1 -h "$COMPACT_PG_ROOT" -p "$COMPACT_PG_PORT" postgres "$@"
}

initdb -D "$COMPACT_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$COMPACT_PG_DATA" -o "-F -p $COMPACT_PG_PORT -k $COMPACT_PG_ROOT" -w start >/dev/null

compact_psql >/dev/null <<'SQL'
create schema faith_harbor;

create function faith_harbor.growth_event_properties_are_safe_v5(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_event_name = 'legacy_passthrough' then p_properties = '{}'::jsonb
    when p_event_name = 'first_experience_viewed' then
      p_properties = jsonb_build_object(
        'variant', p_properties ->> 'variant',
        'content_source', p_properties ->> 'content_source'
      )
      and p_properties ->> 'variant' = 'v1'
      and p_properties ->> 'content_source' in ('remote', 'fallback')
    when p_event_name = 'first_experience_step' then
      p_properties = jsonb_build_object(
        'step_number', p_properties -> 'step_number',
        'total_steps', p_properties -> 'total_steps',
        'step_key', p_properties ->> 'step_key',
        'result', p_properties ->> 'result'
      )
      and jsonb_typeof(p_properties -> 'step_number') = 'number'
      and (p_properties ->> 'step_number')::numeric between 1 and 4
      and (p_properties ->> 'total_steps')::numeric = 4
      and p_properties ->> 'step_key' in ('arrival', 'scripture', 'reflection', 'completion')
      and p_properties ->> 'result' in ('viewed', 'continued', 'completed', 'backgrounded', 'error')
    when p_event_name in ('paywall_viewed', 'plan_selected', 'checkout_started') then true
    when p_event_name = 'trial_terms_viewed' then
      p_properties = jsonb_build_object(
        'plan', p_properties ->> 'plan',
        'trial_days_bucket', p_properties ->> 'trial_days_bucket'
      )
      and p_properties ->> 'plan' = 'yearly'
      and p_properties ->> 'trial_days_bucket' in ('14_days', 'other')
    else false
  end;
$$;

create table faith_harbor.growth_analytics_events (
  actor_type text not null check (actor_type in ('anonymous', 'authenticated')),
  event_name text not null,
  funnel_variant text,
  properties jsonb not null
);
SQL

compact_psql -f "$MIGRATION_PATH" >/dev/null

compact_psql >/dev/null <<'SQL'
do $verify_compact_contract$
declare
  v_case record;
begin
  if not faith_harbor.growth_event_properties_are_safe_v6(
    'legacy_passthrough',
    '{}'::jsonb
  ) then
    raise exception 'v6 stopped delegating to v5';
  end if;

  for v_case in
    select * from (values
      ('first_experience_viewed', '{"variant":"v1","content_source":"fallback"}'::jsonb),
      ('first_experience_step', '{"step_number":4,"total_steps":4,"step_key":"completion","result":"completed"}'::jsonb),
      ('first_experience_viewed', '{"variant":"compact_v2","content_source":"remote"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"moment","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":2,"total_steps":2,"step_key":"completion","result":"completed"}'::jsonb),
      ('route_resolved', '{"destination":"offer","onboarding_state":"complete","auth_state":"anonymous","subscription_state":"unknown","load_time_bucket":"under_500ms"}'::jsonb),
      ('route_resolved', '{"source":"google","destination":"offer","onboarding_state":"complete","auth_state":"anonymous","subscription_state":"unknown","load_time_bucket":"under_500ms"}'::jsonb),
      ('paywall_viewed', '{}'::jsonb),
      ('plan_selected', '{"plan":"monthly"}'::jsonb),
      ('checkout_started', '{"plan":"yearly"}'::jsonb),
      ('trial_terms_viewed', '{"plan":"yearly","trial_days_bucket":"14_days"}'::jsonb)
    ) as accepted(event_name, properties)
  loop
    if faith_harbor.growth_event_properties_are_safe_v6(
      v_case.event_name,
      v_case.properties
    ) is distinct from true then
      raise exception 'valid compact contract rejected: % %', v_case.event_name, v_case.properties;
    end if;
  end loop;

  for v_case in
    select * from (values
      ('first_experience_viewed', '{"variant":"compact_v3","content_source":"remote"}'::jsonb),
      ('first_experience_viewed', '{"variant":"compact_v2","content_source":"remote","scripture":"private"}'::jsonb),
      ('first_experience_step', '{"step_number":1,"total_steps":2,"step_key":"moment","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":4,"step_key":"arrival","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"arrival","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":4,"step_key":"moment","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"step_number":1,"total_steps":2,"step_key":"arrival","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"step_number":1,"total_steps":4,"step_key":"moment","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"v1","step_number":1,"total_steps":4,"step_key":"arrival","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v3","step_number":1,"total_steps":2,"step_key":"moment","result":"viewed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":3,"total_steps":2,"step_key":"completion","result":"completed"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"moment","result":"viewed","goal":"private"}'::jsonb),
      ('first_experience_step', '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"moment","result":null}'::jsonb),
      ('first_experience_viewed', '{"variant":"compact_v2"}'::jsonb),
      ('route_resolved', '{"destination":"offer","onboarding_state":"complete","auth_state":"anonymous","load_time_bucket":"under_500ms"}'::jsonb),
      ('route_resolved', '{"destination":"offer","onboarding_state":"complete","auth_state":"anonymous","subscription_state":"unknown","load_time_bucket":"under_500ms","email":"private"}'::jsonb),
      ('paywall_viewed', '{"source":"google"}'::jsonb),
      ('plan_selected', '{"plan":null}'::jsonb),
      ('plan_selected', '{"plan":"yearly","campaign":"launch_br"}'::jsonb),
      ('checkout_started', '{"plan":"monthly","content":"creative_1"}'::jsonb),
      ('trial_terms_viewed', '{"plan":"yearly","trial_days_bucket":"14_days","source":"google"}'::jsonb)
    ) as rejected(event_name, properties)
  loop
    if faith_harbor.growth_event_properties_are_safe_v6(
      v_case.event_name,
      v_case.properties
    ) is distinct from false then
      raise exception 'invalid compact contract accepted: % %', v_case.event_name, v_case.properties;
    end if;
  end loop;
end
$verify_compact_contract$;

insert into faith_harbor.growth_analytics_events (actor_type, event_name, funnel_variant, properties)
values
  ('anonymous', 'first_experience_step', 'compact_v2', '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"moment","result":"viewed"}'::jsonb),
  ('anonymous', 'first_experience_step', null, '{"step_number":4,"total_steps":4,"step_key":"completion","result":"completed"}'::jsonb),
  ('anonymous', 'paywall_viewed', 'compact_v2', '{}'::jsonb),
  ('anonymous', 'plan_selected', 'compact_v2', '{"plan":"yearly"}'::jsonb),
  ('anonymous', 'trial_terms_viewed', 'compact_v2', '{"plan":"yearly","trial_days_bucket":"14_days"}'::jsonb),
  ('authenticated', 'checkout_started', 'compact_v2', '{"plan":"yearly"}'::jsonb);

do $verify_constraints$
begin
  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, properties)
    values ('anonymous', 'checkout_started', '{"plan":"yearly"}'::jsonb);
    raise exception 'anonymous checkout was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, funnel_variant, properties)
    values (
      'anonymous',
      'first_experience_step',
      'legacy_v1',
      '{"variant":"compact_v2","step_number":1,"total_steps":2,"step_key":"moment","result":"viewed"}'::jsonb
    );
    raise exception 'compact event properties entered the legacy cohort';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, funnel_variant, properties)
    values (
      'anonymous',
      'first_experience_step',
      'compact_v2',
      '{"step_number":1,"total_steps":4,"step_key":"arrival","result":"viewed"}'::jsonb
    );
    raise exception 'legacy event properties entered the compact cohort';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, funnel_variant, properties)
    values (
      'anonymous',
      'route_resolved',
      'compact_v2',
      '{"destination":"offer","onboarding_state":"complete","auth_state":"anonymous","load_time_bucket":"under_500ms"}'::jsonb
    );
    raise exception 'missing offer route field entered through a null CHECK result';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, funnel_variant, properties)
    values ('anonymous', 'plan_selected', 'compact_v2', '{"plan":null}'::jsonb);
    raise exception 'JSON-null Premium field entered through a null CHECK result';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (actor_type, event_name, properties)
    values ('anonymous', 'plan_selected', '{"plan":"yearly","source":"google"}'::jsonb);
    raise exception 'Premium attribution property was accepted';
  exception
    when check_violation then null;
  end;

  if (select count(*) from faith_harbor.growth_analytics_events) <> 6 then
    raise exception 'compact constraint fixture count drifted';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'faith_harbor'
      and procedure.proname = 'growth_event_properties_are_safe_v6'
      and procedure.provolatile = 'i'
      and procedure.proconfig = array['search_path=""']
  ) then
    raise exception 'v6 volatility or search_path drifted';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'faith_harbor'
      and relation.relname = 'growth_analytics_events'
      and constraint_record.conname = 'growth_analytics_properties_check'
      and not constraint_record.convalidated
  ) then
    raise exception 'property constraint validation mode drifted';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'faith_harbor'
      and relation.relname = 'growth_analytics_events'
      and constraint_record.conname = 'growth_analytics_checkout_actor_check'
      and not constraint_record.convalidated
  ) then
    raise exception 'checkout actor constraint validation mode drifted';
  end if;

  if not exists (
    select 1
    from pg_constraint as constraint_record
    join pg_class as relation on relation.oid = constraint_record.conrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'faith_harbor'
      and relation.relname = 'growth_analytics_events'
      and constraint_record.conname = 'growth_analytics_first_experience_variant_check'
      and not constraint_record.convalidated
  ) then
    raise exception 'first-experience variant constraint validation mode drifted';
  end if;
end
$verify_constraints$;
SQL
