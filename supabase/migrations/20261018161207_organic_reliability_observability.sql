-- Add release observability without rewriting or classifying historical events.
-- Prerequisites: installed growth validator v10 / checkout lifecycle telemetry,
-- and the vella_profile_initialization_v2 ingestion body. No auth schema changes.
alter table faith_harbor.growth_analytics_events
  add column update_id uuid,
  add column traffic_type text
    constraint growth_analytics_traffic_type_check check (traffic_type in ('production', 'test'));

create or replace function faith_harbor.growth_event_properties_are_safe_v11(
  p_event_name text,
  p_properties jsonb
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(case
    when p_event_name <> 'first_experience_error' then
      faith_harbor.growth_event_properties_are_safe_v10(p_event_name, p_properties)
    else
      jsonb_typeof(p_properties) = 'object'
      and faith_harbor.growth_event_properties_are_safe_v10(
        p_event_name,
        p_properties - array['reason_code', 'duration_bucket', 'attempt_count']::text[]
      )
      and (
        not (p_properties ?| array['reason_code', 'duration_bucket', 'attempt_count'])
        or p_properties ->> 'stage' = 'content_load'
      )
      and (
        not (p_properties ? 'reason_code')
        or (
          jsonb_typeof(p_properties -> 'reason_code') = 'string'
          and p_properties ->> 'reason_code' in (
            'timeout', 'network_unavailable', 'server_unavailable', 'unauthorized',
            'invalid_response', 'content_unavailable', 'unknown'
          )
        )
      )
      and (
        not (p_properties ? 'duration_bucket')
        or (
          jsonb_typeof(p_properties -> 'duration_bucket') = 'string'
          and p_properties ->> 'duration_bucket' in ('under_1s', '1_4s', '5_9s', '10s_plus')
        )
      )
      and (
        not (p_properties ? 'attempt_count')
        or (
          jsonb_typeof(p_properties -> 'attempt_count') = 'number'
          and p_properties -> 'attempt_count' in ('1'::jsonb, '2'::jsonb)
        )
      )
  end, false);
$$;

revoke all on function faith_harbor.growth_event_properties_are_safe_v11(text, jsonb)
  from public, anon, authenticated;
grant execute on function faith_harbor.growth_event_properties_are_safe_v11(text, jsonb)
  to service_role;

-- Keep historical rows untouched: the prior v10 properties constraint is NOT
-- VALID, and the replacement likewise enforces new writes without a backfill.
alter table faith_harbor.growth_analytics_events
  add constraint growth_analytics_properties_v11_check check (
    faith_harbor.growth_event_properties_are_safe_v11(event_name, properties)
  ) not valid;
alter table faith_harbor.growth_analytics_events
  drop constraint growth_analytics_properties_check;
alter table faith_harbor.growth_analytics_events
  rename constraint growth_analytics_properties_v11_check to growth_analytics_properties_check;

-- This is the existing ingestion body with only pre-insert metadata validation
-- and the two nullable insert fields added. Locks, retention, limits, actor
-- derivation, event-id idempotency, and the result contract stay unchanged.
create or replace function faith_harbor.ingest_growth_analytics_events(
  p_events jsonb,
  p_authenticated boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = faith_harbor, pg_catalog
as $$
declare
  v_requested integer;
  v_installation_id uuid;
  v_new_events integer;
  v_recent_minute integer;
  v_recent_day integer;
  v_global_recent_minute integer;
  v_global_recent_day integer;
  v_inserted integer := 0;
begin
  if jsonb_typeof(p_events) <> 'array' then
    raise exception 'growth_events_array_required' using errcode = '22023';
  end if;

  v_requested := jsonb_array_length(p_events);
  if v_requested < 1 or v_requested > 20 then
    raise exception 'growth_events_batch_size_invalid' using errcode = '22023';
  end if;

  -- Optional metadata is absent for legacy clients; explicit null, malformed
  -- UUIDs, and unknown traffic labels are rejected, including on duplicates.
  if exists (
    select 1 from jsonb_array_elements(p_events) incoming
    where (
      incoming ? 'update_id' and (
        jsonb_typeof(incoming -> 'update_id') is distinct from 'string'
        or not coalesce(incoming ->> 'update_id' ~
          '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', false)
      )
    ) or (
      incoming ? 'traffic_type' and (
        jsonb_typeof(incoming -> 'traffic_type') is distinct from 'string'
        or not coalesce(incoming ->> 'traffic_type' in ('production', 'test'), false)
      )
    )
  ) then
    raise exception 'growth_events_release_metadata_invalid' using errcode = '22023';
  end if;

  v_installation_id := (p_events -> 0 ->> 'install_id')::uuid;
  if exists (
    select 1
    from jsonb_array_elements(p_events) incoming
    where (incoming ->> 'install_id')::uuid <> v_installation_id
  ) then
    raise exception 'growth_events_mixed_installations' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('growth_analytics_global_circuit_breaker', 0));
  perform pg_advisory_xact_lock(hashtextextended(v_installation_id::text, 0));
  perform faith_harbor.purge_expired_growth_analytics(500);

  select count(distinct incoming ->> 'event_id')::integer
  into v_new_events
  from jsonb_array_elements(p_events) incoming
  where not exists (
    select 1
    from faith_harbor.growth_analytics_events existing
    where existing.event_id = (incoming ->> 'event_id')::uuid
  );

  select count(*)::integer into v_recent_minute
  from faith_harbor.growth_analytics_events existing
  where existing.installation_id = v_installation_id
    and existing.received_at >= clock_timestamp() - interval '1 minute';

  select count(*)::integer into v_recent_day
  from faith_harbor.growth_analytics_events existing
  where existing.installation_id = v_installation_id
    and existing.received_at >= clock_timestamp() - interval '24 hours';

  select count(*)::integer into v_global_recent_minute
  from faith_harbor.growth_analytics_events existing
  where existing.received_at >= clock_timestamp() - interval '1 minute';

  select count(*)::integer into v_global_recent_day
  from faith_harbor.growth_analytics_events existing
  where existing.received_at >= clock_timestamp() - interval '24 hours';

  if v_recent_minute + v_new_events > 120 or v_recent_day + v_new_events > 2000 then
    raise exception 'growth_rate_limit_exceeded' using errcode = 'P0001';
  end if;

  if v_global_recent_minute + v_new_events > 10000
      or v_global_recent_day + v_new_events > 500000 then
    raise exception 'growth_global_circuit_breaker_open' using errcode = 'P0001';
  end if;

  insert into faith_harbor.growth_analytics_events (
    event_id,
    installation_id,
    actor_type,
    event_name,
    occurred_at,
    platform,
    app_version,
    build_number,
    runtime_version,
    funnel_variant,
    locale,
    session_id,
    update_id,
    traffic_type,
    properties
  )
  select
    (incoming ->> 'event_id')::uuid,
    (incoming ->> 'install_id')::uuid,
    case when p_authenticated then 'authenticated' else 'anonymous' end,
    incoming ->> 'event_name',
    (incoming ->> 'occurred_at')::timestamptz,
    incoming ->> 'platform',
    incoming ->> 'app_version',
    nullif(incoming ->> 'build_number', ''),
    nullif(incoming ->> 'runtime_version', ''),
    nullif(incoming ->> 'funnel_variant', ''),
    nullif(incoming ->> 'locale', ''),
    nullif(incoming ->> 'session_id', '')::uuid,
    (incoming ->> 'update_id')::uuid,
    incoming ->> 'traffic_type',
    coalesce(incoming -> 'properties', '{}'::jsonb)
  from jsonb_array_elements(p_events) incoming
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object(
    'accepted', v_requested,
    'inserted', v_inserted,
    'duplicates', v_requested - v_inserted,
    'retention_policy', 'raw_90_days'
  );
end;
$$;

revoke all on function faith_harbor.ingest_growth_analytics_events(jsonb, boolean)
  from public, anon, authenticated;
grant execute on function faith_harbor.ingest_growth_analytics_events(jsonb, boolean)
  to service_role;

notify pgrst, 'reload schema';
