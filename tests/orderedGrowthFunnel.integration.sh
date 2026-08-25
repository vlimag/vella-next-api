#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
WORKSPACE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)
shopt -s nullglob
TASK5_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_ordered_growth_funnel_summary.sql)
if [[ ${#TASK5_MIGRATIONS[@]} -ne 1 ]]; then
  echo "expected exactly one ordered growth funnel migration, found ${#TASK5_MIGRATIONS[@]}" >&2
  exit 2
fi
MIGRATION_PATH=${TASK5_MIGRATIONS[0]}
TASK5_INDEX_MIGRATIONS=("$WORKSPACE_ROOT"/supabase/migrations/*_ordered_growth_funnel_index.sql)
if [[ ${#TASK5_INDEX_MIGRATIONS[@]} -ne 1 ]]; then
  echo "expected exactly one ordered growth funnel index migration, found ${#TASK5_INDEX_MIGRATIONS[@]}" >&2
  exit 2
fi
INDEX_MIGRATION_PATH=${TASK5_INDEX_MIGRATIONS[0]}

TASK5_PG_ROOT=$(mktemp -d)
TASK5_PG_DATA="$TASK5_PG_ROOT/data"
TASK5_PG_PORT=${TASK5_PG_PORT:-55441}

case "$TASK5_PG_ROOT" in
  /tmp/*|/var/folders/*) ;;
  *) echo "refusing unsafe temporary PostgreSQL path" >&2; exit 2 ;;
esac

cleanup_task5_postgres() {
  pg_ctl -D "$TASK5_PG_DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -r -- "$TASK5_PG_ROOT"
}
trap cleanup_task5_postgres EXIT

task5_psql() {
  psql -v ON_ERROR_STOP=1 -h "$TASK5_PG_ROOT" -p "$TASK5_PG_PORT" postgres "$@"
}

initdb -D "$TASK5_PG_DATA" --no-locale --encoding=UTF8 >/dev/null
pg_ctl -D "$TASK5_PG_DATA" -o "-F -p $TASK5_PG_PORT -k $TASK5_PG_ROOT" -w start >/dev/null

task5_psql >/dev/null <<'SQL'
alter database postgres set timezone = 'UTC';
create extension if not exists pgcrypto;
create role anon noinherit;
create role authenticated noinherit;
create role service_role noinherit bypassrls;
create schema faith_harbor;
grant usage on schema faith_harbor to service_role;

create table faith_harbor.growth_analytics_events (
  event_id uuid primary key,
  installation_id uuid not null,
  actor_type text not null,
  event_name text not null,
  occurred_at timestamptz not null,
  received_at timestamptz not null,
  platform text not null,
  app_version text not null,
  build_number text,
  runtime_version text,
  funnel_variant text,
  properties jsonb not null default '{}'::jsonb
);

create table faith_harbor.growth_campaign_spend_daily (
  spend_date date not null,
  source text not null,
  campaign text not null,
  spend_cents bigint not null,
  primary key (spend_date, source, campaign)
);

create table faith_harbor.subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  store_product_id text,
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

create table faith_harbor.billing_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  created_at timestamptz not null default clock_timestamp(),
  processed_at timestamptz
);

create table faith_harbor.subscription_marketing_transitions (
  transition_id uuid primary key default gen_random_uuid(),
  user_id uuid,
  subscription_id uuid not null,
  provider text not null,
  plan text not null,
  phase text not null,
  environment text not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (subscription_id, phase)
);

grant select on all tables in schema faith_harbor to service_role;

-- Reproduce the currently deployed three-argument diagnostic RPC. Task 5
-- renames this exact function and wraps it, preserving every legacy key while
-- adding ordered truth.
create function faith_harbor.growth_analytics_summary(
  p_from date,
  p_to date,
  p_cohort_days integer default 14
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  with stages(event_name, stage_order) as (
    values
      ('landing_viewed'::text, 1), ('store_cta_clicked', 2),
      ('first_open', 3), ('onboarding_started', 4),
      ('onboarding_completed', 5), ('account_created', 6),
      ('paywall_viewed', 7), ('checkout_started', 8),
      ('trial_started', 9), ('subscription_paid_started', 10),
      ('meaningful_session_completed', 11)
  ), metrics as (
    select
      event.event_name,
      count(distinct event.installation_id)::integer as unique_installs,
      count(*)::integer as event_count
    from faith_harbor.growth_analytics_events event
    where event.occurred_at >= p_from::timestamptz
      and event.occurred_at < (p_to + 1)::timestamptz
    group by event.event_name
  ), funnel as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'event_name', stage.event_name,
      'unique_installs', coalesce(metric.unique_installs, 0),
      'event_count', coalesce(metric.event_count, 0)
    ) order by stage.stage_order), '[]'::jsonb) as value
    from stages stage
    left join metrics metric using (event_name)
  )
  select jsonb_build_object(
    'window', jsonb_build_object('from', p_from, 'to', p_to, 'cohort_days', p_cohort_days),
    'funnel', funnel.value,
    'daily', '[]'::jsonb,
    'cohorts', '[]'::jsonb,
    'campaigns', '[]'::jsonb,
    'authoritative_subscriptions', jsonb_build_object(
      'verified_starts', 0, 'active_now', 0, 'auto_renew_off_now', 0,
      'ended_updates', 0, 'by_provider_product', '[]'::jsonb,
      'source_of_truth', 'verified_store_subscriptions'
    ),
    'webhook_health', jsonb_build_object(
      'received', 0, 'processed', 0, 'pending', 0, 'by_provider', '[]'::jsonb
    ),
    'privacy', jsonb_build_object(
      'raw_retention_days', 90,
      'minimum_breakdown_installs', 20,
      'small_cohorts_omitted', true,
      'small_campaign_metrics_suppressed', true,
      'small_subscription_product_groups_omitted', true,
      'contains_ip_or_raw_content', false,
      'contains_account_identifier', false,
      'client_subscription_events_are_authoritative', false
    )
  )
  from funnel;
$$;

revoke all on function faith_harbor.growth_analytics_summary(date, date, integer)
  from public, anon, authenticated;
grant execute on function faith_harbor.growth_analytics_summary(date, date, integer)
  to service_role;
SQL

task5_psql -f "$MIGRATION_PATH" >/dev/null
task5_psql -1 -f "$INDEX_MIGRATION_PATH" >/dev/null

task5_psql >/dev/null <<'SQL'
create function faith_harbor.task5_event(
  p_installation_id uuid,
  p_event_name text,
  p_occurred_at timestamptz,
  p_received_at timestamptz,
  p_funnel_variant text,
  p_actor_type text default 'anonymous',
  p_properties jsonb default '{}'::jsonb,
  p_app_version text default '1.2.0',
  p_build_number text default '100',
  p_runtime_version text default '1.2',
  p_platform text default 'android'
)
returns void
language sql
as $$
  insert into faith_harbor.growth_analytics_events (
    event_id, installation_id, actor_type, event_name, occurred_at, received_at,
    platform, app_version, build_number, runtime_version, funnel_variant, properties
  ) values (
    gen_random_uuid(), p_installation_id, p_actor_type, p_event_name,
    p_occurred_at, p_received_at, p_platform, p_app_version, p_build_number,
    p_runtime_version, p_funnel_variant, p_properties
  );
$$;

-- Complete legacy sequence. Receipt timestamps are deliberately reversed;
-- qualification must use occurrence time exclusively.
with stages(event_name, stage_order) as (
  values
    ('first_open'::text, 1), ('onboarding_started', 2),
    ('onboarding_completed', 3), ('first_experience_viewed', 4),
    ('first_experience_completed', 5), ('auth_started', 6),
    ('paywall_viewed', 7), ('plan_selected', 8), ('checkout_started', 9)
)
select faith_harbor.task5_event(
  '10000000-0000-4000-8000-000000000001', event_name,
  '2026-07-01 00:00:00+00'::timestamptz + make_interval(hours => stage_order),
  '2026-07-20 00:00:00+00'::timestamptz - make_interval(hours => stage_order),
  'legacy_v1'
)
from stages;

-- This install reaches every legacy stage, but its first checkout occurrence
-- precedes auth/paywall/plan and must never be repaired by receipt ordering.
with stages(event_name, occurred_offset) as (
  values
    ('first_open'::text, interval '1 hour'),
    ('onboarding_started', interval '2 hours'),
    ('onboarding_completed', interval '3 hours'),
    ('first_experience_viewed', interval '4 hours'),
    ('first_experience_completed', interval '5 hours'),
    ('auth_started', interval '6 hours'),
    ('paywall_viewed', interval '7 hours'),
    ('plan_selected', interval '8 hours'),
    ('checkout_started', interval '5 hours 30 minutes')
)
select faith_harbor.task5_event(
  '10000000-0000-4000-8000-000000000002', event_name,
  '2026-07-02 00:00:00+00'::timestamptz + occurred_offset,
  '2026-07-02 12:00:00+00'::timestamptz + occurred_offset,
  'legacy_v1'
)
from stages;

-- A non-terminal inversion has stage occurrence times 1,2,4,3,5. Stage 4
-- breaks the prefix; later stage 5 must not re-enter the qualified funnel.
with stages(event_name, occurred_offset) as (
  values
    ('first_open'::text, interval '1 hour'),
    ('onboarding_started', interval '2 hours'),
    ('onboarding_completed', interval '4 hours'),
    ('first_experience_viewed', interval '3 hours'),
    ('first_experience_completed', interval '5 hours')
)
select faith_harbor.task5_event(
  '10000000-0000-4000-8000-000000000003', event_name,
  '2026-07-02 00:00:00+00'::timestamptz + occurred_offset,
  '2026-07-02 12:00:00+00'::timestamptz + occurred_offset,
  'legacy_v1'
)
from stages;

-- Compact v2 proves the pre-auth offer order.
with stages(event_name, stage_order) as (
  values
    ('first_open'::text, 1), ('onboarding_started', 2),
    ('onboarding_completed', 3), ('first_experience_viewed', 4),
    ('first_experience_completed', 5), ('paywall_viewed', 6),
    ('plan_selected', 7), ('auth_started', 8), ('checkout_started', 9)
)
select faith_harbor.task5_event(
  '20000000-0000-4000-8000-000000000001', event_name,
  '2026-07-03 00:00:00+00'::timestamptz + make_interval(hours => stage_order),
  '2026-07-18 00:00:00+00'::timestamptz - make_interval(hours => stage_order),
  'compact_v2', 'anonymous', '{}'::jsonb, '2.0.0', '200', '2.0'
)
from stages;

-- A compact envelope cannot borrow a paywall from the legacy graph.
select faith_harbor.task5_event(
  '20000000-0000-4000-8000-000000000002', 'first_open',
  '2026-07-04 01:00:00+00', '2026-07-04 01:00:00+00', 'compact_v2'
);
select faith_harbor.task5_event(
  '20000000-0000-4000-8000-000000000002', 'paywall_viewed',
  '2026-07-04 02:00:00+00', '2026-07-04 02:00:00+00', 'legacy_v1'
);
select faith_harbor.task5_event(
  '20000000-0000-4000-8000-000000000002', 'checkout_started',
  '2026-07-04 03:00:00+00', '2026-07-04 03:00:00+00', 'compact_v2'
);

-- A real upgraded installation may emit a first-open envelope under each
-- closed variant. It belongs to both variant cohorts, but neither graph may
-- borrow the other variant's predecessor events.
select faith_harbor.task5_event(
  '21000000-0000-4000-8000-000000000001', 'first_open',
  '2026-07-10 01:00:00+00', '2026-07-10 01:00:00+00', 'legacy_v1'
);
select faith_harbor.task5_event(
  '21000000-0000-4000-8000-000000000001', 'first_open',
  '2026-07-11 01:00:00+00', '2026-07-11 01:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '2.1.0', '210', '2.1'
);

-- Only an authenticated, exact active-app route is a subscriber bypass.
select faith_harbor.task5_event(
  '30000000-0000-4000-8000-000000000001', 'first_open',
  '2026-07-05 01:00:00+00', '2026-07-05 01:00:00+00', 'legacy_v1'
);
select faith_harbor.task5_event(
  '30000000-0000-4000-8000-000000000001', 'route_resolved',
  '2026-07-05 02:00:00+00', '2026-07-05 02:00:00+00', 'legacy_v1', 'authenticated',
  '{"destination":"app","auth_state":"authenticated","subscription_state":"active"}'::jsonb
);
select faith_harbor.task5_event(
  '30000000-0000-4000-8000-000000000002', 'first_open',
  '2026-07-05 01:00:00+00', '2026-07-05 01:00:00+00', 'legacy_v1'
);
select faith_harbor.task5_event(
  '30000000-0000-4000-8000-000000000002', 'route_resolved',
  '2026-07-05 02:00:00+00', '2026-07-05 02:00:00+00', 'legacy_v1', 'anonymous',
  '{"destination":"app","auth_state":"authenticated","subscription_state":"active"}'::jsonb
);

-- Duplicate client trial signals remain diagnostics only.
select faith_harbor.task5_event(
  '40000000-0000-4000-8000-000000000001', 'trial_started',
  '2026-07-06 01:00:00+00', '2026-07-06 01:00:00+00', 'legacy_v1'
);

-- Profile initialization is the insert-winner acquisition truth. It is an
-- explicit diagnostic metric, not a mandatory ordered-funnel predecessor.
select faith_harbor.task5_event(
  '41000000-0000-4000-8000-000000000001', 'vella_profile_initialized',
  '2026-07-06 03:00:00+00', '2026-07-06 03:00:00+00', 'legacy_v1',
  'authenticated'
);
select faith_harbor.task5_event(
  '41000000-0000-4000-8000-000000000001', 'vella_profile_initialized',
  '2026-07-06 04:00:00+00', '2026-07-06 04:00:00+00', 'legacy_v1',
  'authenticated'
);
select faith_harbor.task5_event(
  '41000000-0000-4000-8000-000000000002', 'vella_profile_initialized',
  '2026-07-06 05:00:00+00', '2026-07-06 05:00:00+00', 'legacy_v1',
  'anonymous'
);
select faith_harbor.task5_event(
  '40000000-0000-4000-8000-000000000001', 'trial_started',
  '2026-07-06 02:00:00+00', '2026-07-06 02:00:00+00', 'legacy_v1'
);

insert into faith_harbor.subscription_marketing_transitions (
  subscription_id, provider, plan, phase, environment, occurred_at
) values (
  '50000000-0000-4000-8000-000000000001', 'google', 'yearly', 'paid',
  'production', '2026-07-07 00:00:00+00'
);

-- Release privacy boundary: exactly 20 first opens report, 19 do not.
select faith_harbor.task5_event(
  md5('release-20-' || series)::uuid, 'first_open',
  '2026-07-08 00:00:00+00', '2026-07-08 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '3.0.0', '20', '3.0'
)
from generate_series(1, 20) series;
select faith_harbor.task5_event(
  md5('release-19-' || series)::uuid, 'first_open',
  '2026-07-09 00:00:00+00', '2026-07-09 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '3.0.0', '19', '3.0'
)
from generate_series(1, 19) series;

-- Platform is part of the privacy cohort. Combining 19 iOS with 19 Android
-- must not manufacture a reportable 38-install release row.
select faith_harbor.task5_event(
  md5('platform-ios-19-' || series)::uuid, 'first_open',
  '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '4.0.0', '38', '4.0', 'ios'
)
from generate_series(1, 19) series;
select faith_harbor.task5_event(
  md5('platform-android-19-' || series)::uuid, 'first_open',
  '2026-07-12 00:00:00+00', '2026-07-12 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '4.0.0', '38', '4.0', 'android'
)
from generate_series(1, 19) series;

-- First-open day is also part of the release cohort. Ten installs on each of
-- two days remain two suppressed cohorts instead of one reportable group.
select faith_harbor.task5_event(
  md5('day-split-a-' || series)::uuid, 'first_open',
  '2026-07-13 00:00:00+00', '2026-07-13 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '4.1.0', '20d', '4.1', 'android'
)
from generate_series(1, 10) series;
select faith_harbor.task5_event(
  md5('day-split-b-' || series)::uuid, 'first_open',
  '2026-07-14 00:00:00+00', '2026-07-14 00:00:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '4.1.0', '20d', '4.1', 'android'
)
from generate_series(1, 10) series;

-- Cohort day is UTC, not the caller/session timezone. In São Paulo this UTC
-- instant is still the prior local calendar day.
select faith_harbor.task5_event(
  md5('utc-boundary-' || series)::uuid, 'first_open',
  '2026-07-15 00:30:00+00', '2026-07-15 00:30:00+00', 'compact_v2',
  'anonymous', '{}'::jsonb, '4.2.0', 'tz20', '4.2', 'ios'
)
from generate_series(1, 20) series;
SQL

task5_psql >/dev/null <<'SQL'
do $$
declare
  summary jsonb;
begin
  set local role service_role;
  perform set_config('TimeZone', 'America/Sao_Paulo', true);
  summary := faith_harbor.growth_analytics_summary('2026-07-01', '2026-07-31', 14);

  if (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'legacy_v1' and item ->> 'event_name' = 'checkout_started') <> 1 then
    raise exception 'legacy checkout occurrence ordering invariant failed';
  end if;
  if (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'legacy_v1' and item ->> 'event_name' = 'first_experience_viewed') <> 2
     or (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'legacy_v1' and item ->> 'event_name' = 'first_experience_completed') <> 2 then
    raise exception 'non-terminal inversion re-entered the ordered prefix';
  end if;
  if (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'compact_v2' and item ->> 'event_name' = 'checkout_started') <> 1 then
    raise exception 'compact pre-auth offer ordering invariant failed';
  end if;
  if (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'legacy_v1' and item ->> 'event_name' = 'first_open') <> 6
     or (select (item ->> 'unique_installs')::integer from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'funnel_variant' = 'compact_v2' and item ->> 'event_name' = 'first_open') <> 120 then
    raise exception 'dual-variant installation anchor invariant failed';
  end if;
  if (select sum((item ->> 'unique_installs')::integer) from jsonb_array_elements(summary -> 'ordered_funnel') item
      where item ->> 'event_name' = 'authenticated_active_subscription_bypass') <> 1 then
    raise exception 'authenticated subscriber bypass gate failed';
  end if;
  if (summary #>> '{authoritative_transitions,paid_started}')::integer <> 1
     or (summary #>> '{authoritative_transitions,trial_started}')::integer <> 0 then
    raise exception 'authoritative transition totals used client events';
  end if;
  if (select (item ->> 'event_count')::integer from jsonb_array_elements(summary #> '{diagnostic_totals,funnel}') item
      where item ->> 'event_name' = 'trial_started') <> 2 then
    raise exception 'duplicate client trial diagnostic invariant failed';
  end if;
  if (summary #>> '{diagnostic_totals,vella_profile_initialized,event_count}')::integer <> 2
     or (summary #>> '{diagnostic_totals,vella_profile_initialized,unique_installs}')::integer <> 1
     or summary #>> '{diagnostic_totals,vella_profile_initialized,source_of_truth}' <> 'vella_profile_initialized' then
    raise exception 'Vella profile initialization acquisition metric failed';
  end if;
  if not (summary ?& array[
    'window', 'funnel', 'daily', 'cohorts', 'campaigns',
    'authoritative_subscriptions', 'webhook_health', 'privacy',
    'ordered_funnel', 'diagnostic_totals', 'release_cohorts', 'authoritative_transitions'
  ]) then
    raise exception 'legacy migration-skew keys or Task 5 blocks missing';
  end if;
  if exists (
    select 1 from jsonb_array_elements(summary -> 'release_cohorts') item
    where item ->> 'build_number' in ('19', '38', '20d')
  ) then
    raise exception 'release platform/day minimum-20 boundary failed';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(summary -> 'release_cohorts') item
    where item ->> 'build_number' = '20'
      and (item ->> 'cohort_installations')::integer = 20
      and item ->> 'platform' = 'android'
      and item ->> 'cohort_day' = '2026-07-08'
      and item ->> 'event_name' = 'first_open'
      and (item ->> 'unique_installs')::integer = 20
  ) then
    raise exception '20-install release was not reported';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(summary -> 'release_cohorts') item
    where item ->> 'build_number' = 'tz20'
      and item ->> 'platform' = 'ios'
      and item ->> 'cohort_day' = '2026-07-15'
      and item ->> 'event_name' = 'first_open'
      and (item ->> 'cohort_installations')::integer = 20
  ) then
    raise exception 'release cohort day was not fixed to UTC';
  end if;
  if summary::text ~ 'installation_id|subscription_id|user_id|30000000-0000-4000-8000-000000000001' then
    raise exception 'aggregate response exposed an identifier';
  end if;
end;
$$;
SQL

task5_psql >/dev/null <<'SQL'
-- Segmented transition threshold: 19 remains visible only in overall totals;
-- exactly 20 is included in the day and provider/plan segments.
insert into faith_harbor.subscription_marketing_transitions (
  subscription_id, provider, plan, phase, environment, occurred_at
)
select md5('aug-paid-' || series)::uuid, 'google', 'yearly', 'paid', 'production',
       '2026-08-01 00:00:00+00'
from generate_series(1, 20) series;

insert into faith_harbor.subscription_marketing_transitions (
  subscription_id, provider, plan, phase, environment, occurred_at
)
select md5('aug-trial-' || series)::uuid, 'apple', 'monthly', 'trial', 'production',
       '2026-08-02 00:00:00+00'
from generate_series(1, 19) series;

insert into faith_harbor.subscription_marketing_transitions (
  subscription_id, provider, plan, phase, environment, occurred_at
) values (
  '50000000-0000-4000-8000-000000000002', 'google', 'yearly', 'paid',
  'test', '2026-08-01 00:00:00+00'
);

do $$
declare
  summary jsonb;
begin
  set local role service_role;
  summary := faith_harbor.growth_analytics_summary('2026-08-01', '2026-08-31', 14);
  if (summary #>> '{authoritative_transitions,paid_started}')::integer <> 20
     or (summary #>> '{authoritative_transitions,trial_started}')::integer <> 19 then
    raise exception 'overall transition totals were suppressed or included nonproduction';
  end if;
  if jsonb_array_length(summary #> '{authoritative_transitions,by_day}') <> 1
     or jsonb_array_length(summary #> '{authoritative_transitions,by_provider_plan}') <> 1 then
    raise exception 'transition segment minimum-20 boundary failed';
  end if;
end;
$$;
SQL

task5_psql >/dev/null <<'SQL'
do $$
declare
  function_count integer;
  is_definer boolean;
  function_config text[];
begin
  select count(*), bool_or(prosecdef), max(proconfig)
  into function_count, is_definer, function_config
  from pg_proc procedure
  join pg_namespace namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'faith_harbor'
    and procedure.proname = 'growth_analytics_summary'
    and pg_get_function_identity_arguments(procedure.oid) = 'p_from date, p_to date, p_cohort_days integer';

  if function_count <> 1 or coalesce(is_definer, true) then
    raise exception 'summary signature or security-invoker mode failed';
  end if;
  if not ('search_path=""' = any(function_config)) then
    raise exception 'summary search_path is not empty';
  end if;
  if not has_function_privilege('service_role', 'faith_harbor.growth_analytics_summary(date,date,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'faith_harbor.growth_analytics_summary(date,date,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'faith_harbor.growth_analytics_summary(date,date,integer)', 'EXECUTE') then
    raise exception 'summary grants are not service-role-only';
  end if;
  if not has_function_privilege('service_role', 'faith_harbor.growth_analytics_diagnostic_summary(date,date,integer)', 'EXECUTE')
     or has_function_privilege('anon', 'faith_harbor.growth_analytics_diagnostic_summary(date,date,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'faith_harbor.growth_analytics_diagnostic_summary(date,date,integer)', 'EXECUTE') then
    raise exception 'diagnostic helper grants are not service-role-only';
  end if;
  if not exists (
    select 1
    from pg_index index_state
    join pg_class index_relation on index_relation.oid = index_state.indexrelid
    join pg_namespace index_namespace on index_namespace.oid = index_relation.relnamespace
    where index_namespace.nspname = 'faith_harbor'
      and index_relation.relname = 'idx_growth_analytics_installation_occurred_event'
      and index_state.indisvalid
      and index_state.indisready
      and pg_get_indexdef(index_state.indexrelid)
        like '%(installation_id, occurred_at, event_name)%'
  ) then
    raise exception 'ordered event index missing, invalid, not ready, or malformed';
  end if;
end;
$$;
SQL

echo "ordered growth funnel integration checks passed"
