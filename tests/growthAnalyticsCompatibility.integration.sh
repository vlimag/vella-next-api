#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MIGRATION_PATH="$SCRIPT_DIR/../../supabase/migrations/20260824232220_restore_runtime_1_2_onboarding_analytics.sql"
COMPAT_PG_ROOT=$(mktemp -d)
COMPAT_PG_DATA="$COMPAT_PG_ROOT/data"
COMPAT_PG_PORT=${COMPAT_PG_PORT:-55442}

case "$COMPAT_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) exit 1 ;;
esac

cleanup_compat_postgres() {
  pg_ctl -D "$COMPAT_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$COMPAT_PG_ROOT"
}
trap cleanup_compat_postgres EXIT

compat_psql() {
  psql -v ON_ERROR_STOP=1 -h "$COMPAT_PG_ROOT" -p "$COMPAT_PG_PORT" postgres "$@"
}

initdb -D "$COMPAT_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$COMPAT_PG_DATA" -o "-F -p $COMPAT_PG_PORT -k $COMPAT_PG_ROOT" -w start >/dev/null

compat_psql >/dev/null <<'SQL'
create schema faith_harbor;

create function faith_harbor.growth_event_properties_are_safe_v4(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_event_name = 'legacy_passthrough';
$$;

create table faith_harbor.growth_analytics_events (
  event_name text not null,
  properties jsonb not null
);
SQL

compat_psql -f "$MIGRATION_PATH" >/dev/null

compat_psql >/dev/null <<'SQL'
do $verify_runtime_compatibility$
declare
  v_step_key text;
  v_action text;
begin
  if not faith_harbor.growth_event_properties_are_safe_v5(
    'legacy_passthrough',
    '{}'::jsonb
  ) then
    raise exception 'v5 stopped delegating to v4';
  end if;

  foreach v_step_key in array array[
    'language',
    'goal',
    'focus',
    'minutes',
    'rhythm',
    'reminder_style',
    'preview',
    'reminders'
  ] loop
    if not faith_harbor.growth_event_properties_are_safe_v5(
      'onboarding_step',
      jsonb_build_object(
        'step_number', 4,
        'total_steps', 7,
        'step_key', v_step_key
      )
    ) then
      raise exception 'runtime-1.2 step rejected: %', v_step_key;
    end if;

    if not faith_harbor.growth_event_properties_are_safe_v5(
      'onboarding_step_result',
      jsonb_build_object(
        'step_number', 4,
        'total_steps', 7,
        'step_key', v_step_key,
        'result', 'continued',
        'selection_count', 1,
        'duration_bucket', '5_14s'
      )
    ) then
      raise exception 'runtime-1.2 step result rejected: %', v_step_key;
    end if;
  end loop;

  foreach v_action in array array[
    'selected',
    'deselected',
    'continue_tapped',
    'skip_tapped',
    'retry_tapped',
    'cta_visible',
    'scroll_25',
    'scroll_50',
    'scroll_75',
    'scroll_100',
    'exit'
  ] loop
    if not faith_harbor.growth_event_properties_are_safe_v5(
      'onboarding_interaction',
      jsonb_build_object(
        'step_key', 'minutes',
        'action', v_action,
        'selection_count', 1
      )
    ) then
      raise exception 'runtime-1.2 interaction rejected: %', v_action;
    end if;
  end loop;

  if not faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_error',
    '{"step_key":"rhythm","stage":"save_profile","error_code":"persistence_failed"}'::jsonb
  ) then
    raise exception 'runtime-1.2 onboarding error rejected';
  end if;

  if not faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_completed',
    '{"duration_bucket":"30_59s","goal_count":3,"focus_count":2}'::jsonb
  ) then
    raise exception 'runtime-1.2 onboarding completion rejected';
  end if;

  if faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_step',
    '{"step_number":4,"total_steps":7,"step_key":"minutes","prayer_text":"private"}'::jsonb
  ) then
    raise exception 'private extra property was accepted';
  end if;

  if faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_step',
    '{"step_number":4,"total_steps":7,"step_key":"unknown"}'::jsonb
  ) then
    raise exception 'unknown step key was accepted';
  end if;

  if faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_step',
    '{"step_number":8,"total_steps":7,"step_key":"minutes"}'::jsonb
  ) then
    raise exception 'out-of-order step number was accepted';
  end if;

  if faith_harbor.growth_event_properties_are_safe_v5(
    'onboarding_interaction',
    '{"step_key":"minutes","action":"selected","selection_count":{"answer":1}}'::jsonb
  ) then
    raise exception 'nested property was accepted';
  end if;
end
$verify_runtime_compatibility$;

insert into faith_harbor.growth_analytics_events (event_name, properties)
values (
  'onboarding_step',
  '{"step_number":4,"total_steps":7,"step_key":"minutes"}'::jsonb
);

do $verify_constraint$
begin
  begin
    insert into faith_harbor.growth_analytics_events (event_name, properties)
    values (
      'onboarding_step',
      '{"step_number":4,"total_steps":7,"step_key":"minutes","email_address":"private"}'::jsonb
    );
    raise exception 'database constraint accepted a private property';
  exception
    when check_violation then null;
  end;

  if (
    select count(*)
    from faith_harbor.growth_analytics_events
  ) <> 1 then
    raise exception 'database constraint fixture count drifted';
  end if;

  if not exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'faith_harbor'
      and procedure.proname = 'growth_event_properties_are_safe_v5'
      and procedure.provolatile = 'i'
      and procedure.proconfig = array['search_path=""']
  ) then
    raise exception 'validator volatility or search_path drifted';
  end if;
end
$verify_constraint$;
SQL
