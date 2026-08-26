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
TELEMETRY_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_vella_rhythms_telemetry.sql)
MILESTONE_EXTENSION_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_extend_rhythm_milestone_telemetry.sql)

if [[ ${#TELEMETRY_MIGRATIONS[@]} -ne 1 || ! -f "${TELEMETRY_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one Vella Rhythms telemetry migration" >&2
  exit 1
fi

if [[ ${#MILESTONE_EXTENSION_MIGRATIONS[@]} -ne 1 || ! -f "${MILESTONE_EXTENSION_MIGRATIONS[0]}" ]]; then
  echo "expected exactly one Rhythms milestone telemetry extension migration" >&2
  exit 1
fi

MIGRATION_PATH=${TELEMETRY_MIGRATIONS[0]}
MILESTONE_EXTENSION_PATH=${MILESTONE_EXTENSION_MIGRATIONS[0]}
TELEMETRY_PG_ROOT=$(mktemp -d)
TELEMETRY_PG_DATA="$TELEMETRY_PG_ROOT/data"
TELEMETRY_PG_PORT=${TELEMETRY_PG_PORT:-55478}

case "$TELEMETRY_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing to clean an unsafe temporary PostgreSQL path" >&2; exit 1 ;;
esac

cleanup_telemetry_postgres() {
  pg_ctl -D "$TELEMETRY_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$TELEMETRY_PG_ROOT"
}
trap cleanup_telemetry_postgres EXIT

telemetry_psql() {
  psql -X -v ON_ERROR_STOP=1 -h "$TELEMETRY_PG_ROOT" -p "$TELEMETRY_PG_PORT" postgres "$@"
}

initdb -D "$TELEMETRY_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$TELEMETRY_PG_DATA" \
  -o "-F -p $TELEMETRY_PG_PORT -k $TELEMETRY_PG_ROOT" -w start >/dev/null

telemetry_psql >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema faith_harbor;

create function faith_harbor.growth_event_properties_are_safe_v7(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select p_event_name = 'onboarding_started' and p_properties = '{}'::jsonb;
$$;

create table faith_harbor.growth_analytics_events (
  id integer primary key,
  event_name text not null,
  properties jsonb not null,
  audit_marker integer not null default 0
);

-- This row represents the known historical population that predates v7. It is
-- intentionally inserted before the NOT VALID v7 constraints and fails v7.
insert into faith_harbor.growth_analytics_events (id, event_name, properties)
values (1, 'onboarding_step', '{"historical_payload":"predates-v7"}');

alter table faith_harbor.growth_analytics_events
  add constraint growth_analytics_events_event_name_check
  check (event_name in ('onboarding_started', 'onboarding_step')) not valid;
alter table faith_harbor.growth_analytics_events
  add constraint growth_analytics_properties_check
  check (faith_harbor.growth_event_properties_are_safe_v7(event_name, properties)) not valid;

alter table faith_harbor.growth_analytics_events enable row level security;
revoke all on faith_harbor.growth_analytics_events from public, anon, authenticated;
grant all on faith_harbor.growth_analytics_events to service_role;

do $verify_legacy_fixture$
begin
  if faith_harbor.growth_event_properties_are_safe_v7(
      'onboarding_step',
      '{"historical_payload":"predates-v7"}'::jsonb
    ) is distinct from false then
    raise exception 'historical fixture does not fail v7';
  end if;

  if not exists (
      select 1 from pg_constraint
      where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_events_event_name_check'
        and not convalidated
    ) or not exists (
      select 1 from pg_constraint
      where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_properties_check'
        and not convalidated
    ) then
    raise exception 'synthetic v7 constraints are not truthfully NOT VALID';
  end if;

  begin
    insert into faith_harbor.growth_analytics_events (id, event_name, properties)
    values (99, 'onboarding_step', '{"historical_payload":"new-write"}');
    raise exception 'v7 NOT VALID properties constraint did not enforce a new write';
  exception
    when check_violation then null;
  end;
end
$verify_legacy_fixture$;
SQL

telemetry_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null
telemetry_psql --single-transaction -f "$MILESTONE_EXTENSION_PATH" >/dev/null

telemetry_psql >/dev/null <<'SQL'
do $verify_function_acl$
begin
  if has_function_privilege('public', 'faith_harbor.growth_event_properties_are_safe_v8(text,jsonb)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.growth_event_properties_are_safe_v8(text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.growth_event_properties_are_safe_v8(text,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.growth_event_properties_are_safe_v8(text,jsonb)', 'execute')
    or not has_function_privilege(current_user, 'faith_harbor.growth_event_properties_are_safe_v8(text,jsonb)', 'execute') then
    raise exception 'unexpected v8 function execute ACL';
  end if;
end
$verify_function_acl$;

do $verify_v9_function_acl$
begin
  if has_function_privilege('public', 'faith_harbor.growth_event_properties_are_safe_v9(text,jsonb)', 'execute')
    or has_function_privilege('anon', 'faith_harbor.growth_event_properties_are_safe_v9(text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'faith_harbor.growth_event_properties_are_safe_v9(text,jsonb)', 'execute')
    or not has_function_privilege('service_role', 'faith_harbor.growth_event_properties_are_safe_v9(text,jsonb)', 'execute')
    or not has_function_privilege(current_user, 'faith_harbor.growth_event_properties_are_safe_v9(text,jsonb)', 'execute') then
    raise exception 'unexpected v9 function execute ACL';
  end if;
end
$verify_v9_function_acl$;

do $verify_recurring_milestone_contracts$
declare
  catalog_code text;
  source_surface text;
begin
  foreach catalog_code in array array[
    'rhythm_first_week', 'rhythm_four_weeks', 'rhythm_balanced', 'rhythm_return'
  ] loop
    if faith_harbor.growth_event_properties_are_safe_v9(
      'milestone_earned', jsonb_build_object('catalog_code', catalog_code)
    ) is distinct from true then
      raise exception 'valid recurring milestone rejected: %', catalog_code;
    end if;

    foreach source_surface in array array[
      'rhythms_hub', 'home', 'journey_catalog', 'journey_detail',
      'journey_completion', 'practice_catalog', 'weekly_rhythm',
      'gathering', 'milestones', 'profile'
    ] loop
      if faith_harbor.growth_event_properties_are_safe_v9(
        'milestone_revealed',
        jsonb_build_object('catalog_code', catalog_code, 'source_surface', source_surface)
      ) is distinct from true then
        raise exception 'valid recurring milestone surface rejected: % %', catalog_code, source_surface;
      end if;
    end loop;
  end loop;

  if faith_harbor.growth_event_properties_are_safe_v9(
      'milestone_earned', '{"catalog_code":"arbitrary-code"}'::jsonb
    ) is distinct from false
    or faith_harbor.growth_event_properties_are_safe_v9(
      'milestone_earned', '{"catalog_code":"rhythm_first_week","user_id":"private"}'::jsonb
    ) is distinct from false
    or faith_harbor.growth_event_properties_are_safe_v9(
      'milestone_revealed', '{"catalog_code":"rhythm_first_week","source_surface":"arbitrary"}'::jsonb
    ) is distinct from false then
    raise exception 'invalid recurring milestone contract accepted';
  end if;
end
$verify_recurring_milestone_contracts$;

do $verify_indexed_step_contracts$
declare
  candidate record;
begin
  for candidate in
    select * from (values
      ('journey_step_completed', '{"catalog_code":"hope-in-seven","step_index":1,"step_type":"verse","elapsed_bucket":"under_30s"}'::jsonb),
      ('journey_step_completed', '{"catalog_code":"hope-in-seven","step_index":32,"step_type":"closing","elapsed_bucket":"15m_plus"}'::jsonb),
      ('journey_resumed', '{"catalog_code":"hope-in-seven","source_surface":"home","step_index":1}'::jsonb),
      ('journey_resumed', '{"catalog_code":"hope-in-seven","source_surface":"home","step_index":32}'::jsonb),
      ('gathering_step_completed', '{"catalog_code":"weekly-rest","step_index":1,"step_type":"arrival","elapsed_bucket":"under_30s"}'::jsonb),
      ('gathering_step_completed', '{"catalog_code":"weekly-rest","step_index":32,"step_type":"closing","elapsed_bucket":"15m_plus"}'::jsonb),
      ('gathering_resumed', '{"catalog_code":"weekly-rest","source_surface":"gathering","step_index":1}'::jsonb),
      ('gathering_resumed', '{"catalog_code":"weekly-rest","source_surface":"gathering","step_index":32}'::jsonb)
    ) as accepted(event_name, properties)
  loop
    if faith_harbor.growth_event_properties_are_safe_v8(candidate.event_name, candidate.properties)
      is distinct from true then
      raise exception 'valid indexed contract rejected: % %', candidate.event_name, candidate.properties;
    end if;
  end loop;

  for candidate in
    select event_name, jsonb_set(properties, '{step_index}', invalid_step, false) as properties
    from (values
      ('journey_step_completed', '{"catalog_code":"hope-in-seven","step_index":1,"step_type":"verse","elapsed_bucket":"under_30s"}'::jsonb),
      ('journey_resumed', '{"catalog_code":"hope-in-seven","source_surface":"home","step_index":1}'::jsonb),
      ('gathering_step_completed', '{"catalog_code":"weekly-rest","step_index":1,"step_type":"arrival","elapsed_bucket":"under_30s"}'::jsonb),
      ('gathering_resumed', '{"catalog_code":"weekly-rest","source_surface":"gathering","step_index":1}'::jsonb)
    ) as indexed(event_name, properties)
    cross join (values
      ('"1"'::jsonb),
      ('"32"'::jsonb),
      ('0'::jsonb),
      ('33'::jsonb),
      ('1.5'::jsonb),
      ('999999999999999999999999999999999999'::jsonb)
    ) as invalid(invalid_step)
  loop
    if faith_harbor.growth_event_properties_are_safe_v8(candidate.event_name, candidate.properties)
      is distinct from false then
      raise exception 'invalid indexed contract accepted: % %', candidate.event_name, candidate.properties;
    end if;
  end loop;
end
$verify_indexed_step_contracts$;

do $verify_complete_cross_layer_contract$
declare
  candidate record;
  property_key text;
  forbidden_key text;
begin
  create temporary table accepted_rhythms_contracts(event_name text primary key, properties jsonb) on commit drop;
  insert into accepted_rhythms_contracts values
    ('rhythms_hub_viewed', '{"source_surface":"rhythms_hub"}'),
    ('journey_catalog_viewed', '{"source_surface":"rhythms_hub"}'),
    ('journey_detail_viewed', '{"catalog_code":"hope-in-seven","source_surface":"journey_catalog","journey_length_bucket":"2_7_days"}'),
    ('journey_started', '{"catalog_code":"hope-in-seven","source_surface":"journey_detail","journey_length_bucket":"2_7_days"}'),
    ('practice_catalog_viewed', '{"source_surface":"rhythms_hub"}'),
    ('practice_selected', '{"catalog_code":"guided_prayer","source_surface":"practice_catalog","session_kind":"guided_prayer"}'),
    ('weekly_rhythm_saved', '{"catalog_code":"guided_prayer","session_kind":"guided_prayer"}'),
    ('gathering_viewed', '{"catalog_code":"weekly-rest","source_surface":"rhythms_hub","session_length_bucket":"10_19m"}'),
    ('journey_session_started', '{"catalog_code":"hope-in-seven","source_surface":"home","session_kind":"journey","journey_length_bucket":"2_7_days","cache_state":"fresh"}'),
    ('journey_step_completed', '{"catalog_code":"hope-in-seven","step_index":1,"step_type":"verse","elapsed_bucket":"under_30s"}'),
    ('journey_session_completed', '{"catalog_code":"hope-in-seven","completion_reason":"completed","elapsed_bucket":"2_4m"}'),
    ('journey_resumed', '{"catalog_code":"hope-in-seven","source_surface":"home","step_index":1}'),
    ('practice_session_started', '{"catalog_code":"scripture","source_surface":"weekly_rhythm","session_kind":"scripture","network_state":"online"}'),
    ('practice_session_completed', '{"catalog_code":"scripture","session_kind":"scripture","completion_reason":"completed","elapsed_bucket":"5_14m"}'),
    ('practice_session_abandoned', '{"catalog_code":"silence","session_kind":"silence","abandonment_reason":"user_exit","elapsed_bucket":"30_119s"}'),
    ('gathering_started', '{"catalog_code":"weekly-rest","source_surface":"gathering","session_kind":"gathering","session_length_bucket":"10_19m"}'),
    ('gathering_step_completed', '{"catalog_code":"weekly-rest","step_index":1,"step_type":"arrival","elapsed_bucket":"under_30s"}'),
    ('gathering_resumed', '{"catalog_code":"weekly-rest","source_surface":"gathering","step_index":2}'),
    ('gathering_completed', '{"catalog_code":"weekly-rest","completion_reason":"idempotent_replay","elapsed_bucket":"15m_plus"}'),
    ('journey_completed', '{"catalog_code":"hope-in-seven","completion_reason":"target_reached","journey_length_bucket":"2_7_days"}'),
    ('journey_completion_viewed', '{"catalog_code":"hope-in-seven","source_surface":"journey_completion"}'),
    ('journey_next_selected', '{"catalog_code":"weekly-rest","source_surface":"journey_completion"}'),
    ('weekly_rhythm_completed', '{"catalog_code":"gratitude","session_kind":"gratitude","completion_reason":"target_reached"}'),
    ('weekly_rhythm_returned', '{"catalog_code":"gratitude","source_surface":"weekly_rhythm","session_kind":"gratitude"}'),
    ('milestone_earned', '{"catalog_code":"journey_finisher"}'),
    ('milestone_revealed', '{"catalog_code":"streak_3","source_surface":"milestones"}'),
    ('milestone_featured', '{"catalog_code":"streak_7","source_surface":"profile"}'),
    ('milestone_unfeatured', '{"catalog_code":"streak_7","source_surface":"profile"}'),
    ('milestone_shared', '{"catalog_code":"journey_finisher","source_surface":"milestones"}'),
    ('rhythms_load_failed', '{"source_surface":"rhythms_hub","error_stage":"summary_load","error_code":"network_unavailable","network_state":"offline","cache_state":"miss","schema_version":1,"capability":"journey_v2"}'),
    ('rhythms_mutation_failed', '{"source_surface":"weekly_rhythm","error_stage":"weekly_save","error_code":"server_unavailable","network_state":"degraded","cache_state":"stale","schema_version":1,"capability":"practices"}'),
    ('session_completion_conflict', '{"session_kind":"gathering","error_stage":"session_complete","error_code":"conflict"}'),
    ('rhythms_asset_fallback_used', '{"catalog_code":"flame.spark","source_surface":"milestones","error_stage":"asset_load","error_code":"asset_unavailable","cache_state":"fallback"}');

  if (select count(*) from accepted_rhythms_contracts) <> 33 then
    raise exception 'accepted fixture does not cover all 33 Rhythms events';
  end if;
  for candidate in select * from accepted_rhythms_contracts loop
    if faith_harbor.growth_event_properties_are_safe_v8(candidate.event_name, candidate.properties)
      is distinct from true then
      raise exception 'accepted cross-layer contract rejected: % %', candidate.event_name, candidate.properties;
    end if;

    for forbidden_key in select * from unnest(array[
      'extra','campaign','user_id','install_id','account_id','content',
      'reflection_text','gratitude_note','raw_error'
    ]) loop
      if faith_harbor.growth_event_properties_are_safe_v8(
        candidate.event_name,
        candidate.properties || jsonb_build_object(forbidden_key, 'private-value')
      ) is distinct from false then
        raise exception 'forbidden extra key accepted: % %', candidate.event_name, forbidden_key;
      end if;
    end loop;

    for property_key in select jsonb_object_keys(candidate.properties) loop
      if faith_harbor.growth_event_properties_are_safe_v8(
        candidate.event_name,
        jsonb_set(candidate.properties, array[property_key], '{"wrong":"type"}'::jsonb, false)
      ) is distinct from false then
        raise exception 'wrong property type accepted: % %', candidate.event_name, property_key;
      end if;
    end loop;
  end loop;

  for candidate in select * from accepted_rhythms_contracts where properties ? 'catalog_code' loop
    if faith_harbor.growth_event_properties_are_safe_v8(
      candidate.event_name,
      jsonb_set(candidate.properties, '{catalog_code}', '"arbitrary-catalog"'::jsonb, false)
    ) is distinct from false then
      raise exception 'arbitrary catalog accepted: %', candidate.event_name;
    end if;
  end loop;

  if faith_harbor.growth_event_properties_are_safe_v8(
      'rhythms_load_failed',
      (select properties from accepted_rhythms_contracts where event_name = 'rhythms_load_failed') ||
        '{"schema_version":2}'::jsonb
    ) is distinct from false
    or faith_harbor.growth_event_properties_are_safe_v8(
      'rhythms_mutation_failed',
      (select properties from accepted_rhythms_contracts where event_name = 'rhythms_mutation_failed') ||
        '{"capability":"arbitrary_capability"}'::jsonb
    ) is distinct from false then
    raise exception 'invalid schema/capability accepted';
  end if;

  if faith_harbor.growth_event_properties_are_safe_v8('onboarding_started', '{}'::jsonb) is distinct from true
    or faith_harbor.growth_event_properties_are_safe_v8('onboarding_started', '{"extra":true}'::jsonb) is distinct from false
    or faith_harbor.growth_event_properties_are_safe_v8('legacy_unknown', '{}'::jsonb) is distinct from false then
    raise exception 'v7 delegation behavior changed';
  end if;

  if not exists (
      select 1 from pg_constraint where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_events_event_name_check' and convalidated
        and pg_get_constraintdef(oid) like '%rhythms_hub_viewed%'
    ) or not exists (
      select 1 from pg_constraint where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_properties_check' and not convalidated
        and pg_get_constraintdef(oid) like '%growth_event_properties_are_safe_v9%'
    ) or exists (
      select 1 from pg_constraint where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname in (
          'growth_analytics_events_event_name_v8_check',
          'growth_analytics_properties_v8_check',
          'growth_analytics_properties_v9_check'
        )
    ) then
    raise exception 'final v9 constraint catalog state is incorrect';
  end if;

  if not exists (
      select 1 from faith_harbor.growth_analytics_events
      where id = 1 and event_name = 'onboarding_step'
        and properties = '{"historical_payload":"predates-v7"}'::jsonb
        and audit_marker = 0
    ) then
    raise exception 'v7-invalid historical row was not preserved unchanged';
  end if;

  if not (select relrowsecurity from pg_class where oid = 'faith_harbor.growth_analytics_events'::regclass)
    or has_table_privilege('public', 'faith_harbor.growth_analytics_events', 'select')
    or has_table_privilege('anon', 'faith_harbor.growth_analytics_events', 'select')
    or has_table_privilege('authenticated', 'faith_harbor.growth_analytics_events', 'select')
    or not has_table_privilege('service_role', 'faith_harbor.growth_analytics_events', 'select') then
    raise exception 'table RLS or ACL changed';
  end if;
end
$verify_complete_cross_layer_contract$;

insert into faith_harbor.growth_analytics_events (id, event_name, properties)
values
  (2, 'rhythms_hub_viewed', '{"source_surface":"rhythms_hub"}'),
  (3, 'onboarding_started', '{}');

do $verify_future_constraint_enforcement$
begin
  begin
    insert into faith_harbor.growth_analytics_events (id, event_name, properties)
    values (4, 'rhythms_hub_viewed', '{"source_surface":"rhythms_hub","extra":true}');
    raise exception 'invalid Rhythms insert was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (id, event_name, properties)
    values (5, 'onboarding_started', '{"extra":true}');
    raise exception 'invalid delegated v7 insert was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into faith_harbor.growth_analytics_events (id, event_name, properties)
    values (6, 'unapproved_event', '{}');
    raise exception 'invalid event-name insert was accepted';
  exception
    when check_violation then null;
  end;

  begin
    update faith_harbor.growth_analytics_events
    set properties = properties || '{"extra":true}'::jsonb
    where id = 2;
    raise exception 'invalid Rhythms update was accepted';
  exception
    when check_violation then null;
  end;

  begin
    update faith_harbor.growth_analytics_events set audit_marker = 1 where id = 1;
    raise exception 'v7-invalid historical row was updated without satisfying v9';
  exception
    when check_violation then null;
  end;

  update faith_harbor.growth_analytics_events
  set properties = '{"source_surface":"home"}'::jsonb
  where id = 2;

  if not exists (
      select 1 from faith_harbor.growth_analytics_events
      where id = 2 and properties = '{"source_surface":"home"}'::jsonb
    ) or not exists (
      select 1 from faith_harbor.growth_analytics_events
      where id = 1 and audit_marker = 0
    ) then
    raise exception 'valid update or historical-row rollback behavior changed';
  end if;
end
$verify_future_constraint_enforcement$;
SQL

catalog_state=$(telemetry_psql -At -F '|' -c "
  select
    (select convalidated from pg_constraint
      where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_events_event_name_check'),
    (select convalidated from pg_constraint
      where conrelid = 'faith_harbor.growth_analytics_events'::regclass
        and conname = 'growth_analytics_properties_check'),
    count(*) filter (where id = 1 and audit_marker = 0)
  from faith_harbor.growth_analytics_events;
")

if [[ "$catalog_state" != "t|f|1" ]]; then
  echo "unexpected final constraint/historical-row catalog state" >&2
  exit 1
fi

echo "Rhythms telemetry PostgreSQL integration passed: event_name_validated=t properties_validated=f historical_rows=1"
