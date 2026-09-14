-- Conversion V3 removes the weak first experience and permanent-auth step from
-- the compact pre-purchase path. Preserve the previous service-only summary so
-- historical diagnostics and rollback-compatible response keys remain intact.

alter function faith_harbor.growth_analytics_summary(date, date, integer)
  rename to growth_analytics_summary_pre_conversion_v3;

revoke all on function faith_harbor.growth_analytics_summary_pre_conversion_v3(date, date, integer)
  from public, anon, authenticated;
grant execute on function faith_harbor.growth_analytics_summary_pre_conversion_v3(date, date, integer)
  to service_role;

create or replace function faith_harbor.growth_analytics_summary(
  p_from date,
  p_to date,
  p_cohort_days integer default 14
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous jsonb;
  v_ordered_funnel jsonb;
  v_release_cohorts jsonb;
  v_privacy jsonb;
  v_from timestamptz;
  v_until timestamptz;
begin
  if p_from is null or p_to is null or p_from > p_to or p_to - p_from > 92 then
    raise exception 'growth_report_window_invalid' using errcode = '22023';
  end if;
  if p_cohort_days < 1 or p_cohort_days > 30 then
    raise exception 'growth_report_cohort_days_invalid' using errcode = '22023';
  end if;

  v_from := p_from::timestamp at time zone 'UTC';
  v_until := (p_to + 1)::timestamp at time zone 'UTC';

  v_previous := faith_harbor.growth_analytics_summary_pre_conversion_v3(
    p_from,
    p_to,
    p_cohort_days
  );
  if v_previous is null or jsonb_typeof(v_previous) <> 'object' then
    raise exception 'growth_previous_summary_invalid' using errcode = '22023';
  end if;

  with stage_definitions(funnel_variant, event_name, stage_order) as (
    values
      ('legacy_v1'::text, 'first_open'::text, 1),
      ('legacy_v1', 'onboarding_started', 2),
      ('legacy_v1', 'onboarding_completed', 3),
      ('legacy_v1', 'first_experience_viewed', 4),
      ('legacy_v1', 'first_experience_completed', 5),
      ('legacy_v1', 'auth_started', 6),
      ('legacy_v1', 'paywall_viewed', 7),
      ('legacy_v1', 'plan_selected', 8),
      ('legacy_v1', 'checkout_started', 9),
      ('compact_v2', 'first_open', 1),
      ('compact_v2', 'onboarding_started', 2),
      ('compact_v2', 'onboarding_completed', 3),
      ('compact_v2', 'paywall_viewed', 4),
      ('compact_v2', 'plan_selected', 5),
      ('compact_v2', 'checkout_started', 6)
  ), eligible_first_opens as (
    select
      event.event_id,
      event.installation_id,
      event.occurred_at,
      event.platform,
      event.app_version,
      coalesce(event.build_number, 'unknown') as build_number,
      coalesce(event.runtime_version, 'unknown') as runtime_version,
      case
        when event.funnel_variant in ('legacy_v1', 'compact_v2') then event.funnel_variant
        when event.funnel_variant is null and event.runtime_version = '1.2' then 'legacy_v1'
      end as funnel_variant
    from faith_harbor.growth_analytics_events event
    where event.event_name = 'first_open'
      and event.platform in ('ios', 'android')
      and event.occurred_at >= v_from
      and event.occurred_at < v_until
      and (
        event.funnel_variant in ('legacy_v1', 'compact_v2')
        or (event.funnel_variant is null and event.runtime_version = '1.2')
      )
  ), anchors as (
    select distinct on (first_open.installation_id, first_open.funnel_variant)
      first_open.installation_id,
      first_open.occurred_at as first_opened_at,
      (first_open.occurred_at at time zone 'UTC')::date as cohort_day,
      first_open.platform,
      first_open.app_version,
      first_open.build_number,
      first_open.runtime_version,
      first_open.funnel_variant
    from eligible_first_opens first_open
    order by
      first_open.installation_id,
      first_open.funnel_variant,
      first_open.occurred_at,
      first_open.event_id
  ), stage_firsts as (
    select
      anchor.installation_id,
      anchor.first_opened_at,
      anchor.cohort_day,
      anchor.platform,
      anchor.app_version,
      anchor.build_number,
      anchor.runtime_version,
      anchor.funnel_variant,
      stage.event_name,
      stage.stage_order,
      min(event.occurred_at) as first_occurred_at
    from anchors anchor
    join stage_definitions stage
      on stage.funnel_variant = anchor.funnel_variant
    left join faith_harbor.growth_analytics_events event
      on event.installation_id = anchor.installation_id
      and event.event_name = stage.event_name
      and event.occurred_at >= anchor.first_opened_at
      and event.occurred_at <= anchor.first_opened_at + make_interval(days => p_cohort_days)
      and case
        when event.funnel_variant in ('legacy_v1', 'compact_v2') then event.funnel_variant
        when event.funnel_variant is null and event.runtime_version = '1.2' then 'legacy_v1'
      end = anchor.funnel_variant
    group by
      anchor.installation_id,
      anchor.first_opened_at,
      anchor.cohort_day,
      anchor.platform,
      anchor.app_version,
      anchor.build_number,
      anchor.runtime_version,
      anchor.funnel_variant,
      stage.event_name,
      stage.stage_order
  ), qualified_stages as (
    select current_stage.*
    from stage_firsts current_stage
    where current_stage.first_occurred_at is not null
      and not exists (
        select 1
        from stage_firsts prefix_stage
        where prefix_stage.installation_id = current_stage.installation_id
          and prefix_stage.funnel_variant = current_stage.funnel_variant
          and prefix_stage.stage_order <= current_stage.stage_order
          and (
            prefix_stage.first_occurred_at is null
            or exists (
              select 1
              from stage_firsts preceding_stage
              where preceding_stage.installation_id = prefix_stage.installation_id
                and preceding_stage.funnel_variant = prefix_stage.funnel_variant
                and preceding_stage.stage_order < prefix_stage.stage_order
                and (
                  preceding_stage.first_occurred_at is null
                  or preceding_stage.first_occurred_at > prefix_stage.first_occurred_at
                )
            )
          )
      )
  ), bypassed_installs as (
    select anchor.*
    from anchors anchor
    where exists (
      select 1
      from faith_harbor.growth_analytics_events event
      where event.installation_id = anchor.installation_id
        and event.event_name = 'route_resolved'
        and event.actor_type = 'authenticated'
        and event.properties ->> 'destination' = 'app'
        and event.properties ->> 'auth_state' = 'authenticated'
        and event.properties ->> 'subscription_state' = 'active'
        and event.occurred_at >= anchor.first_opened_at
        and event.occurred_at <= anchor.first_opened_at + make_interval(days => p_cohort_days)
        and case
          when event.funnel_variant in ('legacy_v1', 'compact_v2') then event.funnel_variant
          when event.funnel_variant is null and event.runtime_version = '1.2' then 'legacy_v1'
        end = anchor.funnel_variant
    )
  ), ordered_rows as (
    select
      stage.funnel_variant,
      stage.event_name,
      stage.stage_order,
      count(distinct qualified.installation_id)::integer as unique_installs
    from stage_definitions stage
    left join qualified_stages qualified
      on qualified.funnel_variant = stage.funnel_variant
      and qualified.event_name = stage.event_name
    group by stage.funnel_variant, stage.event_name, stage.stage_order
    union all
    select
      variant.funnel_variant,
      'authenticated_active_subscription_bypass'::text,
      case when variant.funnel_variant = 'compact_v2' then 7 else 10 end,
      count(distinct bypass.installation_id)::integer
    from (
      values ('legacy_v1'::text), ('compact_v2'::text)
    ) variant(funnel_variant)
    left join bypassed_installs bypass
      on bypass.funnel_variant = variant.funnel_variant
    group by variant.funnel_variant
  ), release_groups as (
    select
      anchor.app_version,
      anchor.build_number,
      anchor.runtime_version,
      anchor.platform,
      anchor.cohort_day,
      anchor.funnel_variant,
      count(*)::integer as cohort_installations
    from anchors anchor
    group by
      anchor.app_version,
      anchor.build_number,
      anchor.runtime_version,
      anchor.platform,
      anchor.cohort_day,
      anchor.funnel_variant
    having count(*) >= 20
  ), release_rows as (
    select
      release.app_version,
      release.build_number,
      release.runtime_version,
      release.platform,
      release.cohort_day,
      release.funnel_variant,
      stage.event_name,
      stage.stage_order,
      release.cohort_installations,
      count(distinct qualified.installation_id)::integer as unique_installs
    from release_groups release
    join anchors anchor
      on anchor.app_version = release.app_version
      and anchor.build_number = release.build_number
      and anchor.runtime_version = release.runtime_version
      and anchor.platform = release.platform
      and anchor.cohort_day = release.cohort_day
      and anchor.funnel_variant = release.funnel_variant
    join stage_definitions stage
      on stage.funnel_variant = release.funnel_variant
    left join qualified_stages qualified
      on qualified.installation_id = anchor.installation_id
      and qualified.funnel_variant = stage.funnel_variant
      and qualified.event_name = stage.event_name
    group by
      release.app_version,
      release.build_number,
      release.runtime_version,
      release.platform,
      release.cohort_day,
      release.funnel_variant,
      stage.event_name,
      stage.stage_order,
      release.cohort_installations
    union all
    select
      release.app_version,
      release.build_number,
      release.runtime_version,
      release.platform,
      release.cohort_day,
      release.funnel_variant,
      'authenticated_active_subscription_bypass'::text,
      case when release.funnel_variant = 'compact_v2' then 7 else 10 end,
      release.cohort_installations,
      count(distinct bypass.installation_id)::integer
    from release_groups release
    join anchors anchor
      on anchor.app_version = release.app_version
      and anchor.build_number = release.build_number
      and anchor.runtime_version = release.runtime_version
      and anchor.platform = release.platform
      and anchor.cohort_day = release.cohort_day
      and anchor.funnel_variant = release.funnel_variant
    left join bypassed_installs bypass
      on bypass.installation_id = anchor.installation_id
      and bypass.funnel_variant = release.funnel_variant
    group by
      release.app_version,
      release.build_number,
      release.runtime_version,
      release.platform,
      release.cohort_day,
      release.funnel_variant,
      release.cohort_installations
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'funnel_variant', ordered.funnel_variant,
        'event_name', ordered.event_name,
        'stage_order', ordered.stage_order,
        'unique_installs', ordered.unique_installs
      ) order by ordered.funnel_variant, ordered.stage_order)
      from ordered_rows ordered
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'app_version', release.app_version,
        'build_number', release.build_number,
        'runtime_version', release.runtime_version,
        'platform', release.platform,
        'cohort_day', release.cohort_day,
        'funnel_variant', release.funnel_variant,
        'event_name', release.event_name,
        'stage_order', release.stage_order,
        'cohort_installations', release.cohort_installations,
        'unique_installs', release.unique_installs
      ) order by
        release.app_version,
        release.build_number,
        release.runtime_version,
        release.platform,
        release.cohort_day,
        release.funnel_variant,
        release.stage_order
      )
      from release_rows release
    ), '[]'::jsonb)
  into v_ordered_funnel, v_release_cohorts;

  v_privacy := coalesce(v_previous -> 'privacy', '{}'::jsonb) || jsonb_build_object(
    'conversion_v3_ordered_funnel', true,
    'compact_v2_requires_permanent_auth', false,
    'compact_v2_requires_first_experience', false
  );

  return v_previous || jsonb_build_object(
    'ordered_funnel', v_ordered_funnel,
    'release_cohorts', v_release_cohorts,
    'privacy', v_privacy
  );
end;
$$;

revoke all on function faith_harbor.growth_analytics_summary(date, date, integer)
  from public, anon, authenticated;
grant execute on function faith_harbor.growth_analytics_summary(date, date, integer)
  to service_role;
