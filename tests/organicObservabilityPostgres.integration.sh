#!/usr/bin/env bash
# Isolated local cluster only. Never reads DATABASE_URL or the linked project.
set -euo pipefail
for prerequisite in initdb pg_ctl psql awk; do
  command -v "$prerequisite" >/dev/null || { echo "missing prerequisite: $prerequisite" >&2; exit 2; }
done
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
MIGRATION_PATH="$SCRIPT_DIR/../supabase/migrations/20261018161207_organic_reliability_observability.sql"
ORGANIC_PG_ROOT=$(mktemp -d)
ORGANIC_PG_DATA="$ORGANIC_PG_ROOT/data"
ORGANIC_PG_PORT=${ORGANIC_PG_PORT:-55489}
case "$ORGANIC_PG_ROOT" in /tmp/*|/var/folders/*) ;; *) exit 1 ;; esac
cleanup_organic_postgres() {
  pg_ctl -D "$ORGANIC_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$ORGANIC_PG_ROOT"
}
trap cleanup_organic_postgres EXIT
organic_psql() { psql -X -v ON_ERROR_STOP=1 -h "$ORGANIC_PG_ROOT" -p "$ORGANIC_PG_PORT" postgres "$@"; }
extract_function() {
  awk -v name="$1" 'index($0,"create or replace function faith_harbor." name "(") == 1 { emit=1 } emit { print } emit && /^\$\$;/ { emit=0 }' "$2"
}
initdb -D "$ORGANIC_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
# A unique Unix socket and no TCP listener prevent accidental external access.
pg_ctl -D "$ORGANIC_PG_DATA" -o "-F -p $ORGANIC_PG_PORT -k $ORGANIC_PG_ROOT -c listen_addresses=''" -w start >/dev/null
organic_psql >/dev/null <<'SQL'
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema faith_harbor;
grant usage on schema faith_harbor to service_role;
SQL

# Execute the real installed validator chain in migration order, not a mock.
for source in "$WORKSPACE_ROOT"/supabase/migrations/*.sql; do
  awk '/^create or replace function faith_harbor.growth_event_properties_are_safe[_(]/ { emit=1 } emit { print } emit && /^\$\$;/ { emit=0 }' "$source" | organic_psql >/dev/null
done
BASE_PATH="$WORKSPACE_ROOT/supabase/migrations/20260806155202_growth_analytics.sql"
awk '/^create table if not exists faith_harbor.growth_analytics_events / { emit=1 } emit { print } emit && /^\);/ { emit=0 }' "$BASE_PATH" | organic_psql >/dev/null
extract_function purge_expired_growth_analytics "$BASE_PATH" | organic_psql >/dev/null
organic_psql >/dev/null <<'SQL'
alter table faith_harbor.growth_analytics_events add column funnel_variant text;
alter table faith_harbor.growth_analytics_events enable row level security;
revoke all on faith_harbor.growth_analytics_events from public, anon, authenticated;
grant all on faith_harbor.growth_analytics_events to service_role;
revoke all on function faith_harbor.purge_expired_growth_analytics(integer) from public, anon, authenticated;
grant execute on function faith_harbor.purge_expired_growth_analytics(integer) to service_role;
SQL
sed -n '/^alter table faith_harbor.growth_analytics_events$/,$p' "$WORKSPACE_ROOT/supabase/migrations/20260828132000_checkout_lifecycle_telemetry.sql" | organic_psql >/dev/null
sed -n '/^  drop constraint if exists growth_analytics_first_experience_variant_check;/,$p' "$WORKSPACE_ROOT/supabase/migrations/20260825012605_compact_v2_growth_contract.sql" | {
  printf '%s\n' 'alter table faith_harbor.growth_analytics_events'
  cat
} | organic_psql >/dev/null
extract_function ingest_growth_analytics_events "$WORKSPACE_ROOT/supabase/migrations/20260824213418_vella_profile_initialization_v2.sql" | organic_psql >/dev/null
organic_psql >/dev/null <<'SQL'
revoke all on function faith_harbor.ingest_growth_analytics_events(jsonb,boolean) from public, anon, authenticated;
grant execute on function faith_harbor.ingest_growth_analytics_events(jsonb,boolean) to service_role;
create function faith_harbor.test_event(p_id uuid default gen_random_uuid(), p_properties jsonb default '{"stage":"content_load","error_code":"network_unavailable"}')
returns jsonb language sql as $$ select jsonb_build_object(
 'event_id',p_id,'install_id','11111111-1111-4111-8111-111111111111',
 'event_name','first_experience_error','occurred_at',now(),'platform','ios',
 'app_version','1.2','properties',p_properties
); $$;
select faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event('22222222-2222-4222-8222-222222222222')));
create table faith_harbor.test_before as select to_jsonb(e) as snapshot from faith_harbor.growth_analytics_events e;
create table faith_harbor.test_security_before as select relacl,relrowsecurity,relforcerowsecurity
  from pg_class where oid='faith_harbor.growth_analytics_events'::regclass;
SQL
organic_psql --single-transaction -f "$MIGRATION_PATH" >/dev/null
organic_psql >/dev/null <<'SQL'
do $verify$
declare
  event jsonb;
  result jsonb;
  bad jsonb;
  candidate jsonb;
  before_count integer;
begin
  if not exists (select 1 from information_schema.columns where table_schema='faith_harbor' and table_name='growth_analytics_events' and column_name='update_id' and data_type='uuid' and is_nullable='YES') then
    raise exception 'update_id metadata missing';
  end if;
  if not exists (select 1 from faith_harbor.growth_analytics_events e cross join faith_harbor.test_before b
    where to_jsonb(e) - 'update_id' - 'traffic_type' = b.snapshot and e.update_id is null and e.traffic_type is null) then
    raise exception 'historical event changed or was relabeled';
  end if;
  event := faith_harbor.test_event('33333333-3333-4333-8333-333333333333',
    '{"stage":"content_load","error_code":"network_unavailable","reason_code":"timeout","duration_bucket":"5_9s","attempt_count":2}')
    || '{"update_id":"44444444-4444-4444-8444-444444444444","traffic_type":"production"}';
  result := faith_harbor.ingest_growth_analytics_events(jsonb_build_array(event));
  if result->>'inserted' <> '1' or not exists (select 1 from faith_harbor.growth_analytics_events e
    where e.event_id=(event->>'event_id')::uuid and e.update_id='44444444-4444-4444-8444-444444444444' and e.traffic_type='production'
      and e.actor_type='anonymous' and e.properties=event->'properties') then raise exception 'new metadata or diagnostics not persisted'; end if;
  result := faith_harbor.ingest_growth_analytics_events(jsonb_build_array(event || '{"traffic_type":"test","update_id":"55555555-5555-4555-8555-555555555555"}'), true);
  if result->>'duplicates' <> '1' or exists (select 1 from faith_harbor.growth_analytics_events e where e.event_id=(event->>'event_id')::uuid and (e.traffic_type<>'production' or e.actor_type<>'anonymous' or e.update_id is distinct from '44444444-4444-4444-8444-444444444444'::uuid or e.properties is distinct from event->'properties')) then raise exception 'dedupe mutated existing metadata or actor'; end if;
  result := faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event() || '{"traffic_type":"test"}'), true);
  if result->>'inserted'<>'1' or not exists (select 1 from faith_harbor.growth_analytics_events where traffic_type='test' and actor_type='authenticated' and update_id is null) then raise exception 'test traffic or authenticated actor not persisted'; end if;
  perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
  if (select count(*) from faith_harbor.growth_analytics_events where traffic_type is null and update_id is null) <> 2 then raise exception 'legacy client defaults changed'; end if;
  for bad in select value from jsonb_array_elements('[{"update_id":null},{"update_id":"invalid"},{"update_id":4},{"update_id":""},{"update_id":"AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA"},{"update_id":"aaaaaaaa-aaaa-9aaa-8aaa-aaaaaaaaaaaa"},{"update_id":"aaaaaaaa-aaaa-4aaa-7aaa-aaaaaaaaaaaa"},{"traffic_type":null},{"traffic_type":"organic"},{"traffic_type":true},{"traffic_type":""}]') loop
    before_count := (select count(*) from faith_harbor.growth_analytics_events);
    begin
      perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event(), faith_harbor.test_event() || bad));
      raise exception 'invalid metadata accepted';
    exception when sqlstate '22023' then null;
    end;
    if (select count(*) from faith_harbor.growth_analytics_events) <> before_count then raise exception 'invalid batch partially persisted'; end if;
  end loop;
  for candidate in select value from jsonb_array_elements('[
    {"stage":"content_load","error_code":"network_unavailable","attempt_count":"1"},
    {"stage":"content_load","error_code":"network_unavailable","attempt_count":1.5},
    {"stage":"content_load","error_code":"network_unavailable","attempt_count":0},
    {"stage":"content_load","error_code":"network_unavailable","attempt_count":3},
    {"stage":"content_load","error_code":"network_unavailable","attempt_count":null},
    {"stage":"content_load","error_code":"network_unavailable","reason_code":"private text"},
    {"stage":"content_load","error_code":"network_unavailable","reason_code":null},
    {"stage":"content_load","error_code":"network_unavailable","duration_bucket":"60s"},
    {"stage":"content_load","error_code":"network_unavailable","raw_error":"private"},
    {"stage":"state_save","error_code":"persistence_failed","attempt_count":1},
    {"stage":"navigation","error_code":"navigation_failed","reason_code":"unknown"},
    {"stage":"state_save","error_code":"persistence_failed","duration_bucket":"under_1s"}
  ]') loop
    begin
      perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event(gen_random_uuid(),candidate)));
      raise exception 'invalid diagnostic properties accepted';
    exception when check_violation then null;
    end;
  end loop;
  if not faith_harbor.growth_event_properties_are_safe_v11('checkout_started','{"plan":"yearly"}')
    or faith_harbor.growth_event_properties_are_safe_v11('checkout_started','{"plan":"yearly","private":true}') then raise exception 'v10 delegation changed'; end if;
  -- Existing authentication constraint must still reject anonymous checkout.
  begin
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event() || '{"event_name":"checkout_started","properties":{"plan":"yearly"}}'));
    raise exception 'anonymous checkout accepted';
  exception when check_violation then null; end;
  -- Metadata must be rejected even when an event would otherwise deduplicate.
  begin
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(event || '{"traffic_type":null}'));
    raise exception 'invalid duplicate metadata accepted';
  exception when sqlstate '22023' then null; end;
  -- Independently enumerate every newly accepted bounded value.
  for candidate in
    select jsonb_build_object('reason_code',value) from unnest(array['timeout','network_unavailable','server_unavailable','unauthorized','invalid_response','content_unavailable','unknown']) value
    union all select jsonb_build_object('duration_bucket',value) from unnest(array['under_1s','1_4s','5_9s','10s_plus']) value
    union all select jsonb_build_object('attempt_count',value) from unnest(array[1,2]) value
  loop
    if faith_harbor.growth_event_properties_are_safe_v11('first_experience_error',
      '{"stage":"content_load","error_code":"network_unavailable"}'::jsonb || candidate) is distinct from true then raise exception 'bounded diagnostic enum rejected'; end if;
  end loop;
end $verify$;

-- The real v1-v11 property checks have been exercised above. Saturation rows
-- below use fixed '{}' first_open fixtures; omit only that expensive check
-- during the rate tests so thousands of fixtures do not re-run the full chain.
alter table faith_harbor.growth_analytics_events drop constraint growth_analytics_properties_check;
do $preserved_ingestion_guards$
declare events jsonb;
begin
  begin
    perform faith_harbor.ingest_growth_analytics_events('[]');
    raise exception 'empty batch accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'growth_events_batch_size_invalid' then raise; end if;
  end;
  select jsonb_agg(faith_harbor.test_event()) into events from generate_series(1,21);
  begin
    perform faith_harbor.ingest_growth_analytics_events(events);
    raise exception 'oversized batch accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'growth_events_batch_size_invalid' then raise; end if;
  end;
  begin
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event(),faith_harbor.test_event() || '{"install_id":"77777777-7777-4777-8777-777777777777"}'));
    raise exception 'mixed installation batch accepted';
  exception when sqlstate '22023' then
    if sqlerrm <> 'growth_events_mixed_installations' then raise; end if;
  end;
  -- Each expected exception rolls the saturation fixtures back in its own
  -- subtransaction, so the subsequent limit check starts clean.
  begin
    insert into faith_harbor.growth_analytics_events(event_id,installation_id,actor_type,event_name,occurred_at,platform,app_version,properties)
      select gen_random_uuid(),'11111111-1111-4111-8111-111111111111','anonymous','first_open',now(),'ios','1.2','{}' from generate_series(1,120);
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
    raise exception 'installation minute limit lost';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'growth_rate_limit_exceeded' then raise; end if;
  end;
  begin
    insert into faith_harbor.growth_analytics_events(event_id,installation_id,actor_type,event_name,occurred_at,received_at,platform,app_version,properties)
      select gen_random_uuid(),'11111111-1111-4111-8111-111111111111','anonymous','first_open',now(),now()-interval '2 hours','ios','1.2','{}' from generate_series(1,2000);
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
    raise exception 'installation day limit lost';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'growth_rate_limit_exceeded' then raise; end if;
  end;
  begin
    insert into faith_harbor.growth_analytics_events(event_id,installation_id,actor_type,event_name,occurred_at,platform,app_version,properties)
      select gen_random_uuid(),'77777777-7777-4777-8777-777777777777','anonymous','first_open',now(),'ios','1.2','{}' from generate_series(1,10000);
    perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
    raise exception 'global minute limit lost';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'growth_global_circuit_breaker_open' then raise; end if;
  end;
end $preserved_ingestion_guards$;
alter table faith_harbor.growth_analytics_events add constraint growth_analytics_properties_check
  check (faith_harbor.growth_event_properties_are_safe_v11(event_name,properties)) not valid;

insert into faith_harbor.growth_analytics_events(event_id,installation_id,actor_type,event_name,occurred_at,received_at,delete_after,platform,app_version,properties)
  values(gen_random_uuid(),'77777777-7777-4777-8777-777777777777','anonymous','first_open',now()-interval '100 days',now()-interval '100 days',now()-interval '10 days','ios','1.2','{}');
do $retention$
begin
  perform faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
  if exists(select 1 from faith_harbor.growth_analytics_events where delete_after < now()) then raise exception 'ingestion retention purge lost'; end if;
end $retention$;

do $security$
declare fn text;
begin
  foreach fn in array array['ingest_growth_analytics_events(jsonb,boolean)','growth_event_properties_are_safe_v11(text,jsonb)'] loop
    if has_function_privilege('public','faith_harbor.'||fn,'execute') or has_function_privilege('anon','faith_harbor.'||fn,'execute') or has_function_privilege('authenticated','faith_harbor.'||fn,'execute') or not has_function_privilege('service_role','faith_harbor.'||fn,'execute') then raise exception 'RPC ACL widened'; end if;
  end loop;
  if not (select relrowsecurity from pg_class where oid='faith_harbor.growth_analytics_events'::regclass)
    or has_table_privilege('anon','faith_harbor.growth_analytics_events','select') or has_table_privilege('authenticated','faith_harbor.growth_analytics_events','insert') then raise exception 'table ACL or RLS changed'; end if;
  if exists(select 1 from pg_class c cross join faith_harbor.test_security_before b
    where c.oid='faith_harbor.growth_analytics_events'::regclass and
      (c.relacl is distinct from b.relacl or c.relrowsecurity is distinct from b.relrowsecurity or c.relforcerowsecurity is distinct from b.relforcerowsecurity)) then raise exception 'table security catalog changed'; end if;
end $security$;
-- Execute with the actual permitted role, not only a catalog privilege check.
set role service_role;
select faith_harbor.ingest_growth_analytics_events(jsonb_build_array(faith_harbor.test_event()));
reset role;
SQL
echo 'organic observability PostgreSQL integration passed (local-only)'
