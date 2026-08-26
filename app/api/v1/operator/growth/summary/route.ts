import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { requireOperatorAccess } from '@/lib/operatorAuth';
import { VELLA_SUBSCRIPTION_PRODUCT_IDS } from '@/lib/iapProducts';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');

const querySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  cohort_days: z.coerce.number().int().min(1).max(30).default(14),
}).strict().refine((value) => {
  const from = Date.parse(`${value.from}T00:00:00.000Z`);
  const to = Date.parse(`${value.to}T00:00:00.000Z`);
  return from <= to && to - from <= 92 * 24 * 60 * 60 * 1000;
}, { message: 'Reporting window must be between 1 and 93 days', path: ['to'] });

function isoDateDaysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

type DiagnosticRow = Record<string, unknown>;
const MINIMUM_BREAKDOWN_INSTALLS = 20;
const FIRST_EXPERIENCE_STEP_KEYS = new Set(['arrival', 'scripture', 'reflection', 'completion']);
const NORMALIZED_PROOF_FINGERPRINT = /^[0-9a-f]{64}$/;
const PRIVACY_SAFE_UNKNOWN = 'unknown';
const IAP_CLIENT_STAGES = new Set([
  'connection',
  'products',
  'purchase_request',
  'purchase_callback',
  'receipt',
  'validation',
  'finish',
  'restore',
]);
const IAP_CLIENT_OUTCOMES = new Set([
  'started',
  'succeeded',
  'cancelled',
  'failed',
  'timed_out',
  'unavailable',
  'rejected',
  'empty',
]);
const IAP_CLIENT_ERROR_CODES = new Set([
  'activity_unavailable',
  'already_owned',
  'already_prepared',
  'billing_response_json_parse_error',
  'billing_unavailable',
  'connection_closed',
  'connection_unavailable',
  'deferred_payment',
  'developer_error',
  'duplicate_purchase',
  'empty_sku_list',
  'feature_not_supported',
  'iap_not_available',
  'init_connection',
  'interrupted',
  'item_not_owned',
  'item_unavailable',
  'network_error',
  'no_active_purchase',
  'no_products_returned',
  'not_ended',
  'not_prepared',
  'pending',
  'purchase_callback_timeout',
  'purchase_error',
  'purchase_in_progress',
  'purchase_proof_missing',
  'purchase_verification_failed',
  'purchase_verification_finish_failed',
  'purchase_verification_finished',
  'query_product',
  'receipt_failed',
  'receipt_finished',
  'receipt_finished_failed',
  'remote_error',
  'service_disconnected',
  'service_error',
  'service_timeout',
  'sku_not_found',
  'sku_offer_mismatch',
  'subscription_account_mismatch',
  'subscription_already_linked',
  'subscription_restore_needed',
  'sync_error',
  'transaction_validation_failed',
  'unknown_error',
  'user_cancelled',
  'user_error',
  'validation_rejected',
  'validation_timeout',
]);
const IAP_SERVER_SOURCES = new Set(['server_validation', 'entitlement_sync']);
const IAP_SERVER_ERROR_CODES = new Set([
  'invalid_request',
  'receipt_missing',
  'product_not_allowed',
  'iap_configuration_missing',
  'package_name_mismatch',
  'receipt_invalid',
  'product_mismatch',
  'subscription_account_mismatch',
  'subscription_already_linked',
  'entitlement_sync_failed',
  'subscription_inactive',
  'store_validation_unavailable',
]);
const IAP_PLATFORMS = new Set(['ios', 'android']);
const IAP_BILLING_PHASES = new Set(['trial', 'paid']);
const GROWTH_FUNNEL_EVENTS = new Set([
  'landing_viewed',
  'store_cta_clicked',
  'first_open',
  'onboarding_started',
  'onboarding_completed',
  'account_created',
  'vella_profile_initialized',
  'paywall_viewed',
  'checkout_started',
  'trial_started',
  'subscription_paid_started',
  'meaningful_session_completed',
]);
const CAMPAIGN_SOURCES = new Set([
  'direct',
  'google',
  'instagram',
  'vella.one',
  'vella_site',
  'whatsapp',
  'youtube',
]);
const CAMPAIGN_CODES = new Set([
  'android_first_launch',
  'android_launch_br',
  'br_android_202608_prayer_words',
  'vella_br_android_202608_prayerdaily',
]);
const STORE_PROVIDERS = new Set(['apple', 'google']);
const SUBSCRIPTION_PLANS = new Set(['monthly', 'yearly']);
const REPORT_CURRENCIES = new Set(['BRL']);
const ATTRIBUTION_SCOPES = new Set(['source_qualified', 'platform_blended']);
const ATTRIBUTION_PAGE_SIZE = 1000;
const MAX_ATTRIBUTION_TRANSITIONS = 10_000;
const SPEND_LEDGER_PAGE_SIZE = 1000;
const MAX_SPEND_LEDGER_ROWS = 5000;
const ATTRIBUTION_MATURITY_DAYS = 16;
const PROVISIONAL_CAC_CEILING_CENTS = 6000;
const APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN = 'vella_br_android_202608_prayerdaily';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SPEND_SOURCE_PATTERN = /^[a-z0-9][a-z0-9._~-]{0,31}$/;
const SPEND_CAMPAIGN_PATTERN = /^[a-z0-9][a-z0-9._~-]{0,63}$/;
const SUBSCRIPTION_TRUTH_SOURCES = new Set(['verified_store_subscriptions']);
const TRANSITION_TRUTH_SOURCES = new Set(['subscription_marketing_transitions']);
const DIAGNOSTIC_TRUTH_SOURCES = new Set(['independent_client_events']);
const PROFILE_INITIALIZATION_TRUTH_SOURCES = new Set(['vella_profile_initialized']);
const FUNNEL_VARIANTS = new Set(['legacy_v1', 'compact_v2']);
const ORDERED_STAGE_ORDERS: Record<string, ReadonlyMap<string, number>> = {
  legacy_v1: new Map([
    ['first_open', 1],
    ['onboarding_started', 2],
    ['onboarding_completed', 3],
    ['first_experience_viewed', 4],
    ['first_experience_completed', 5],
    ['auth_started', 6],
    ['paywall_viewed', 7],
    ['plan_selected', 8],
    ['checkout_started', 9],
    ['authenticated_active_subscription_bypass', 10],
  ]),
  compact_v2: new Map([
    ['first_open', 1],
    ['onboarding_started', 2],
    ['onboarding_completed', 3],
    ['first_experience_viewed', 4],
    ['first_experience_completed', 5],
    ['paywall_viewed', 6],
    ['plan_selected', 7],
    ['auth_started', 8],
    ['checkout_started', 9],
    ['authenticated_active_subscription_bypass', 10],
  ]),
};
const ONBOARDING_STEP_KEYS = new Set([
  'language',
  'goal',
  'focus',
  'minutes',
  'rhythm',
  'reminder_style',
  'preview',
  'reminders',
]);
const ONBOARDING_STEP_RESULTS = new Set(['continued', 'skipped', 'back', 'backgrounded', 'abandoned', 'error']);
const ONBOARDING_DURATION_BUCKETS = new Set(['under_5s', '5_14s', '15_29s', '30_59s', '60s_plus']);
const ONBOARDING_INTERACTIONS = new Set([
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
  'exit',
]);
const ONBOARDING_ERROR_STAGES = new Set([
  'load_state',
  'save_profile',
  'save_language',
  'change_language',
  'navigation',
]);
const ONBOARDING_ERROR_CODES = new Set([
  'storage_unavailable',
  'persistence_failed',
  'language_failed',
  'navigation_failed',
  'unknown',
]);
const ROUTE_DESTINATIONS = new Set([
  'onboarding',
  'first-experience',
  'authentication',
  'subscription-verification',
  'paywall',
  'app',
]);
const ROUTE_ONBOARDING_STATES = new Set(['incomplete', 'complete']);
const ROUTE_AUTH_STATES = new Set(['anonymous', 'authenticated']);
const ROUTE_SUBSCRIPTION_STATES = new Set(['unknown', 'inactive', 'active']);
const ROUTE_LOAD_TIME_BUCKETS = new Set(['under_500ms', '500_1499ms', '1500_2999ms', '3000ms_plus']);
const AUTH_ENTRY_POINTS = new Set(['post_onboarding', 'post_first_experience', 'premium', 'tabs', 'direct']);
const AUTH_STAGES = new Set(['credentials', 'provider', 'verification']);
const AUTH_MODES = new Set(['sign_in', 'sign_up']);
const AUTH_METHODS = new Set(['email', 'google', 'apple']);
const AUTH_OUTCOMES = new Set(['started', 'verification_required', 'succeeded', 'failed', 'cancelled']);
const SAFE_RELEASE_VALUE = /^[A-Za-z0-9._+~-]+$/;
const RHYTHMS_EVENT_NAMES = [
  'rhythms_hub_viewed', 'journey_catalog_viewed', 'journey_detail_viewed', 'journey_started',
  'practice_catalog_viewed', 'practice_selected', 'weekly_rhythm_saved', 'gathering_viewed',
  'journey_session_started', 'journey_step_completed', 'journey_session_completed', 'journey_resumed',
  'practice_session_started', 'practice_session_completed', 'practice_session_abandoned',
  'gathering_started', 'gathering_step_completed', 'gathering_resumed', 'gathering_completed',
  'journey_completed', 'journey_completion_viewed', 'journey_next_selected',
  'weekly_rhythm_completed', 'weekly_rhythm_returned', 'milestone_earned', 'milestone_revealed',
  'milestone_featured', 'milestone_unfeatured', 'milestone_shared', 'rhythms_load_failed',
  'rhythms_mutation_failed', 'session_completion_conflict', 'rhythms_asset_fallback_used',
] as const;

type PropertyDimension = {
  column: string;
  allowed?: ReadonlySet<string>;
  integerRange?: { minimum: number; maximum: number };
};

function diagnosticRow(value: unknown): DiagnosticRow | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as DiagnosticRow
    : null;
}

function diagnosticRows(value: unknown): DiagnosticRow[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const row = diagnosticRow(entry);
    return row ? [row] : [];
  });
}

function safeNonnegativeInteger(value: unknown, maximum = Number.MAX_SAFE_INTEGER) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : 0;
}

function safeNullableNonnegativeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function safeDimension(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === 'string' && allowed.has(value) ? value : PRIVACY_SAFE_UNKNOWN;
}

function safeDateDimension(value: unknown) {
  return typeof value === 'string' && dateSchema.safeParse(value).success
    ? value
    : PRIVACY_SAFE_UNKNOWN;
}

function safeReleaseDimension(value: unknown, maximumLength: number) {
  return typeof value === 'string' && value.length >= 1 && value.length <= maximumLength &&
    SAFE_RELEASE_VALUE.test(value)
    ? value
    : PRIVACY_SAFE_UNKNOWN;
}

function safeOptionalReleaseDimension(value: unknown, maximumLength: number) {
  return value === null || value === undefined
    ? null
    : safeReleaseDimension(value, maximumLength);
}

function timestampInWindow(value: unknown, fromTimestamp: string, toTimestamp: string) {
  if (typeof value !== 'string') return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp >= Date.parse(fromTimestamp) && timestamp < Date.parse(toTimestamp);
}

function privacyThresholdedCohorts(
  rows: DiagnosticRow[],
  dimension: 'app_version' | 'runtime_version' | 'build_number',
) {
  const groups = new Map<string, { installations: Set<string>; eventCount: number }>();
  for (const row of rows) {
    const installationId = typeof row.installation_id === 'string' && UUID_PATTERN.test(row.installation_id)
      ? row.installation_id
      : null;
    const maximumLength = dimension === 'build_number' ? 24 : 32;
    const value = safeReleaseDimension(row[dimension], maximumLength);
    if (!installationId || value === PRIVACY_SAFE_UNKNOWN) continue;
    const group = groups.get(value) ?? { installations: new Set<string>(), eventCount: 0 };
    group.installations.add(installationId);
    group.eventCount += 1;
    groups.set(value, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.installations.size >= MINIMUM_BREAKDOWN_INSTALLS)
    .map(([value, group]) => ({
      [dimension]: value,
      installations: group.installations.size,
      event_count: group.eventCount,
    }))
    .sort((left, right) => right.installations - left.installations ||
      String(left[dimension]).localeCompare(String(right[dimension])));
}

async function loadRhythmsDiagnostics(
  supabase: ReturnType<typeof createServiceClient>,
  fromTimestamp: string,
  toTimestamp: string,
) {
  const loadEvent = (eventName: string) => supabase
    .from('growth_analytics_events')
    .select('installation_id,event_name,platform,app_version,build_number,runtime_version')
    .eq('event_name', eventName)
    .gte('received_at', fromTimestamp)
    .lt('received_at', toTimestamp)
    .limit(5001);
  const loadProductRows = (table: string, columns: string, dateColumn: string) => supabase
    .from(table)
    .select(columns)
    .gte(dateColumn, fromTimestamp)
    .lt(dateColumn, toTimestamp)
    .limit(5001);
  const firstAnalyticsQuery = supabase
    .from('growth_analytics_events')
    .select('installation_id,event_name,platform,app_version,build_number,runtime_version');
  const analyticsLoads = typeof firstAnalyticsQuery.in === 'function'
    ? [firstAnalyticsQuery
        .in('event_name', [...RHYTHMS_EVENT_NAMES])
        .gte('received_at', fromTimestamp)
        .lt('received_at', toTimestamp)
        .limit(5001)]
    : [
        firstAnalyticsQuery
          .eq('event_name', RHYTHMS_EVENT_NAMES[0])
          .gte('received_at', fromTimestamp)
          .lt('received_at', toTimestamp)
          .limit(5001),
        ...RHYTHMS_EVENT_NAMES.slice(1).map((eventName) => loadEvent(eventName)),
      ];
  const results = await Promise.all([
    ...analyticsLoads,
    loadProductRows('user_journeys', 'id,created_at', 'created_at'),
    loadProductRows('user_journeys', 'id,completed_at', 'completed_at'),
    loadProductRows('user_journey_daily_sessions', 'user_journey_id,day_number,completed_at', 'completed_at'),
    loadProductRows('user_practices', 'user_id,practice_code,created_at', 'created_at'),
    loadProductRows('practice_sessions', 'user_id,practice_code,local_week_start,status,completed_at', 'completed_at'),
    loadProductRows('user_gathering_progress', 'started_at', 'started_at'),
    loadProductRows('user_gathering_progress', 'completed_at,status', 'completed_at'),
    loadProductRows('user_milestones', 'milestone_code,earned_at', 'earned_at'),
    loadProductRows('user_featured_milestones', 'created_at', 'created_at'),
  ]);
  const unavailable = results.some((result) => result.error || !Array.isArray(result.data) || result.data.length >= 5001);
  if (unavailable) {
    console.error('[operator.growth] rhythms_diagnostics_unavailable', {
      query_failed: results.some((result) => Boolean(result.error) || !Array.isArray(result.data)),
      row_limit_reached: results.some((result) => Array.isArray(result.data) && result.data.length >= 5001),
    });
    return { audit_available: false as const };
  }

  const eventResults = results.slice(0, analyticsLoads.length);
  const productResults = results.slice(analyticsLoads.length);
  const analyticsRows = eventResults.flatMap((result) => diagnosticRows(result.data));
  const eventCount = (eventName: string) => analyticsRows.filter((row) => row.event_name === eventName).length;
  const productRows = (index: number) => diagnosticRows(productResults[index]?.data);
  const journeyStarts = productRows(0)
    .filter((row) => timestampInWindow(row.created_at, fromTimestamp, toTimestamp));
  const journeyCompletions = productRows(1)
    .filter((row) => timestampInWindow(row.completed_at, fromTimestamp, toTimestamp));
  const firstSessionCompletions = productRows(2)
    .filter((row) => row.day_number === 1 && timestampInWindow(row.completed_at, fromTimestamp, toTimestamp));
  const weeklyRhythms = productRows(3)
    .filter((row) => timestampInWindow(row.created_at, fromTimestamp, toTimestamp));
  const practiceCompletions = productRows(4)
    .filter((row) => row.status === 'completed' && timestampInWindow(row.completed_at, fromTimestamp, toTimestamp));
  const completedWeeks = new Set(practiceCompletions.flatMap((row) => (
    typeof row.user_id === 'string' && typeof row.practice_code === 'string' && typeof row.local_week_start === 'string'
      ? [`${row.user_id}:${row.practice_code}:${row.local_week_start}`]
      : []
  ))).size;
  const gatheringStarts = productRows(5)
    .filter((row) => timestampInWindow(row.started_at, fromTimestamp, toTimestamp));
  const gatheringCompletions = productRows(6)
    .filter((row) => row.status === 'completed' && timestampInWindow(row.completed_at, fromTimestamp, toTimestamp));
  const milestonesEarned = productRows(7)
    .filter((row) => timestampInWindow(row.earned_at, fromTimestamp, toTimestamp));
  const milestonesFeatured = productRows(8)
    .filter((row) => timestampInWindow(row.created_at, fromTimestamp, toTimestamp));

  return {
    audit_available: true as const,
    source_of_truth: {
      discovery_and_presentation: 'growth_analytics_events' as const,
      completions_and_awards: 'rhythms_product_tables' as const,
    },
    journey_funnel: {
      hub_views: eventCount('rhythms_hub_viewed'),
      catalog_views: eventCount('journey_catalog_viewed'),
      detail_views: eventCount('journey_detail_viewed'),
      starts: journeyStarts.length,
      first_session_completions: firstSessionCompletions.length,
      journey_completions: journeyCompletions.length,
    },
    practice: {
      catalog_views: eventCount('practice_catalog_viewed'),
      weekly_rhythms_saved: weeklyRhythms.length,
      session_completions: practiceCompletions.length,
      completed_weeks: completedWeeks,
    },
    gathering: {
      views: eventCount('gathering_viewed'),
      starts: gatheringStarts.length,
      completions: gatheringCompletions.length,
    },
    milestones: {
      earned: milestonesEarned.length,
      revealed: eventCount('milestone_revealed'),
      featured: milestonesFeatured.length,
    },
    failures: {
      idempotency_conflicts: eventCount('session_completion_conflict'),
      server_errors: eventCount('rhythms_load_failed') + eventCount('rhythms_mutation_failed'),
    },
    cohorts: {
      minimum_installations: MINIMUM_BREAKDOWN_INSTALLS,
      releases: privacyThresholdedCohorts(analyticsRows, 'app_version'),
      runtimes: privacyThresholdedCohorts(analyticsRows, 'runtime_version'),
      builds: privacyThresholdedCohorts(analyticsRows, 'build_number'),
    },
  };
}

function safePropertyDimension(properties: DiagnosticRow | null, dimension: PropertyDimension) {
  const value = properties?.[dimension.column];
  if (dimension.allowed) return safeDimension(value, dimension.allowed);
  if (dimension.integerRange) {
    return typeof value === 'number' && Number.isSafeInteger(value) &&
      value >= dimension.integerRange.minimum && value <= dimension.integerRange.maximum
      ? String(value)
      : PRIVACY_SAFE_UNKNOWN;
  }
  return PRIVACY_SAFE_UNKNOWN;
}

function projectDiagnosticSummary(
  raw: unknown,
  requestedWindow: { from: string; to: string; cohort_days: number },
) {
  const report = diagnosticRow(raw) ?? {};
  const subscriptions = diagnosticRow(report.authoritative_subscriptions) ?? {};
  const webhooks = diagnosticRow(report.webhook_health) ?? {};
  const privacy = diagnosticRow(report.privacy) ?? {};

  return {
    window: {
      from: requestedWindow.from,
      to: requestedWindow.to,
      cohort_days: requestedWindow.cohort_days,
    },
    funnel: diagnosticRows(report.funnel).map((row) => ({
      event_name: safeDimension(row.event_name, GROWTH_FUNNEL_EVENTS),
      unique_installs: safeNonnegativeInteger(row.unique_installs),
      event_count: safeNonnegativeInteger(row.event_count),
    })),
    daily: diagnosticRows(report.daily).map((row) => ({
      day: safeDateDimension(row.day),
      unique_installs: safeNonnegativeInteger(row.unique_installs),
      event_count: safeNonnegativeInteger(row.event_count),
      first_open: safeNonnegativeInteger(row.first_open),
      onboarding_completed: safeNonnegativeInteger(row.onboarding_completed),
      account_created: safeNonnegativeInteger(row.account_created),
      paywall_viewed: safeNonnegativeInteger(row.paywall_viewed),
      trial_started: safeNonnegativeInteger(row.trial_started),
      subscription_paid_started: safeNonnegativeInteger(row.subscription_paid_started),
      meaningful_session_completed: safeNonnegativeInteger(row.meaningful_session_completed),
    })),
    cohorts: diagnosticRows(report.cohorts).map((row) => ({
      cohort_day: safeDateDimension(row.cohort_day),
      installs: safeNonnegativeInteger(row.installs),
      onboarding_completed: safeNonnegativeInteger(row.onboarding_completed),
      account_created: safeNonnegativeInteger(row.account_created),
      trial_started: safeNonnegativeInteger(row.trial_started),
      subscription_paid_started: safeNonnegativeInteger(row.subscription_paid_started),
      activated_24h: safeNonnegativeInteger(row.activated_24h),
      d1_retained: safeNonnegativeInteger(row.d1_retained),
      d7_retained: safeNonnegativeInteger(row.d7_retained),
    })).filter((row) => row.installs >= MINIMUM_BREAKDOWN_INSTALLS),
    campaigns: diagnosticRows(report.campaigns).map((row) => {
      const attributedInstalls = safeNullableNonnegativeInteger(row.attributed_installs);
      const hasNoAttributedInstalls = attributedInstalls === 0;
      const eventMetricsReportable = attributedInstalls !== null &&
        attributedInstalls >= MINIMUM_BREAKDOWN_INSTALLS;
      const eventMetric = (value: unknown) => {
        if (hasNoAttributedInstalls) return 0;
        return eventMetricsReportable ? safeNullableNonnegativeInteger(value) : null;
      };
      return {
        source: safeDimension(row.source, CAMPAIGN_SOURCES),
        campaign: safeDimension(row.campaign, CAMPAIGN_CODES),
        spend_cents: safeNonnegativeInteger(row.spend_cents),
        currency: safeDimension(row.currency, REPORT_CURRENCIES),
        attributed_installs: hasNoAttributedInstalls || eventMetricsReportable ? attributedInstalls : null,
        attribution_suppressed: row.attribution_suppressed === true ||
          (attributedInstalls !== null &&
            attributedInstalls > 0 &&
            attributedInstalls < MINIMUM_BREAKDOWN_INSTALLS),
        landing_views: eventMetric(row.landing_views),
        store_cta_clicks: eventMetric(row.store_cta_clicks),
        first_opens: eventMetric(row.first_opens),
        trial_starts: eventMetric(row.trial_starts),
        paid_starts: eventMetric(row.paid_starts),
        cost_per_first_open_cents: eventMetricsReportable
          ? safeNullableNonnegativeInteger(row.cost_per_first_open_cents)
          : null,
        cost_per_trial_cents: eventMetricsReportable
          ? safeNullableNonnegativeInteger(row.cost_per_trial_cents)
          : null,
        cost_per_paid_start_cents: eventMetricsReportable
          ? safeNullableNonnegativeInteger(row.cost_per_paid_start_cents)
          : null,
      };
    }),
    authoritative_subscriptions: {
      verified_starts: safeNonnegativeInteger(subscriptions.verified_starts),
      active_now: safeNonnegativeInteger(subscriptions.active_now),
      auto_renew_off_now: safeNonnegativeInteger(subscriptions.auto_renew_off_now),
      ended_updates: safeNonnegativeInteger(subscriptions.ended_updates),
      by_provider_product: diagnosticRows(subscriptions.by_provider_product).map((row) => ({
        provider: safeDimension(row.provider, STORE_PROVIDERS),
        product_id: safeDimension(row.product_id, VELLA_SUBSCRIPTION_PRODUCT_IDS),
        subscriptions: safeNonnegativeInteger(row.subscriptions),
        active_now: safeNonnegativeInteger(row.active_now),
      })).filter((row) => row.subscriptions >= MINIMUM_BREAKDOWN_INSTALLS),
      source_of_truth: safeDimension(subscriptions.source_of_truth, SUBSCRIPTION_TRUTH_SOURCES),
    },
    webhook_health: {
      received: safeNonnegativeInteger(webhooks.received),
      processed: safeNonnegativeInteger(webhooks.processed),
      pending: safeNonnegativeInteger(webhooks.pending),
      by_provider: diagnosticRows(webhooks.by_provider).map((row) => ({
        provider: safeDimension(row.provider, STORE_PROVIDERS),
        received: safeNonnegativeInteger(row.received),
        processed: safeNonnegativeInteger(row.processed),
        pending: safeNonnegativeInteger(row.pending),
      })),
    },
    privacy: {
      raw_retention_days: safeNonnegativeInteger(privacy.raw_retention_days, 3650),
      minimum_breakdown_installs: MINIMUM_BREAKDOWN_INSTALLS,
      small_cohorts_omitted: privacy.small_cohorts_omitted === true,
      small_campaign_metrics_suppressed: privacy.small_campaign_metrics_suppressed === true,
      small_subscription_product_groups_omitted: privacy.small_subscription_product_groups_omitted === true,
      contains_ip_or_raw_content: privacy.contains_ip_or_raw_content === false ? false : true,
      contains_account_identifier: privacy.contains_account_identifier === false ? false : true,
      client_subscription_events_are_authoritative: privacy.client_subscription_events_are_authoritative === true,
    },
  };
}

function hasOrderedSummaryBlocks(raw: unknown) {
  const report = diagnosticRow(raw);
  if (report === null) return false;
  const diagnostics = diagnosticRow(report.diagnostic_totals);
  const transitions = diagnosticRow(report.authoritative_transitions);
  const profileInitialized = diagnosticRow(diagnostics?.vella_profile_initialized);
  return Array.isArray(report.ordered_funnel) &&
    diagnostics !== null &&
    diagnostics.source_of_truth === 'independent_client_events' &&
    profileInitialized !== null &&
    Number.isSafeInteger(profileInitialized.unique_installs) &&
    Number(profileInitialized.unique_installs) >= 0 &&
    Number.isSafeInteger(profileInitialized.event_count) &&
    Number(profileInitialized.event_count) >= 0 &&
    profileInitialized.source_of_truth === 'vella_profile_initialized' &&
    Array.isArray(diagnostics.funnel) &&
    Array.isArray(diagnostics.daily) &&
    Array.isArray(diagnostics.cohorts) &&
    Array.isArray(diagnostics.campaigns) &&
    diagnosticRow(diagnostics.authoritative_subscriptions) !== null &&
    diagnosticRow(diagnostics.webhook_health) !== null &&
    hasValidReleaseCohorts(report.release_cohorts) &&
    transitions !== null &&
    Number.isSafeInteger(transitions.trial_started) &&
    Number(transitions.trial_started) >= 0 &&
    Number.isSafeInteger(transitions.paid_started) &&
    Number(transitions.paid_started) >= 0 &&
    Array.isArray(transitions.by_day) &&
    Array.isArray(transitions.by_provider_plan) &&
    transitions.source_of_truth === 'subscription_marketing_transitions';
}

function hasValidReleaseCohorts(value: unknown) {
  if (!Array.isArray(value)) return false;
  return value.every((entry) => {
    const row = diagnosticRow(entry);
    if (row === null || typeof row.funnel_variant !== 'string' ||
      typeof row.event_name !== 'string') return false;
    const expectedOrder = ORDERED_STAGE_ORDERS[row.funnel_variant]?.get(row.event_name);
    const cohortInstallations = row.cohort_installations;
    const uniqueInstalls = row.unique_installs;
    return typeof row.platform === 'string' && IAP_PLATFORMS.has(row.platform) &&
      typeof row.cohort_day === 'string' && dateSchema.safeParse(row.cohort_day).success &&
      expectedOrder !== undefined && row.stage_order === expectedOrder &&
      typeof cohortInstallations === 'number' && Number.isSafeInteger(cohortInstallations) &&
      cohortInstallations >= 0 &&
      typeof uniqueInstalls === 'number' && Number.isSafeInteger(uniqueInstalls) &&
      uniqueInstalls >= 0 && uniqueInstalls <= cohortInstallations;
  });
}

function projectOrderedRows(value: unknown) {
  return diagnosticRows(value).flatMap((row) => {
    const funnelVariant = safeDimension(row.funnel_variant, FUNNEL_VARIANTS);
    if (funnelVariant === PRIVACY_SAFE_UNKNOWN || typeof row.event_name !== 'string') return [];
    const expectedOrder = ORDERED_STAGE_ORDERS[funnelVariant]?.get(row.event_name);
    if (expectedOrder === undefined || row.stage_order !== expectedOrder) return [];
    return [{
      funnel_variant: funnelVariant,
      event_name: row.event_name,
      stage_order: expectedOrder,
      unique_installs: safeNonnegativeInteger(row.unique_installs),
    }];
  });
}

function projectGrowthSummary(
  raw: unknown,
  requestedWindow: { from: string; to: string; cohort_days: number },
) {
  const report = diagnosticRow(raw) ?? {};
  const legacy = projectDiagnosticSummary(report, requestedWindow);
  const diagnosticTotalsRaw = diagnosticRow(report.diagnostic_totals) ?? {};
  const diagnosticTotals = projectDiagnosticSummary(diagnosticTotalsRaw, requestedWindow);
  const profileInitialized = diagnosticRow(
    diagnosticTotalsRaw.vella_profile_initialized,
  ) ?? {};
  const transitions = diagnosticRow(report.authoritative_transitions) ?? {};

  return {
    ...legacy,
    privacy: {
      ...legacy.privacy,
      ordered_by_occurred_at: true,
      minimum_release_installs: MINIMUM_BREAKDOWN_INSTALLS,
      minimum_transition_subscriptions: MINIMUM_BREAKDOWN_INSTALLS,
      small_release_cohorts_omitted: true,
      small_transition_segments_omitted: true,
    },
    ordered_funnel: projectOrderedRows(report.ordered_funnel),
    diagnostic_totals: {
      source_of_truth: safeDimension(
        diagnosticTotalsRaw.source_of_truth,
        DIAGNOSTIC_TRUTH_SOURCES,
      ),
      vella_profile_initialized: {
        unique_installs: safeNonnegativeInteger(profileInitialized.unique_installs),
        event_count: safeNonnegativeInteger(profileInitialized.event_count),
        source_of_truth: safeDimension(
          profileInitialized.source_of_truth,
          PROFILE_INITIALIZATION_TRUTH_SOURCES,
        ),
      },
      funnel: diagnosticTotals.funnel,
      daily: diagnosticTotals.daily,
      cohorts: diagnosticTotals.cohorts,
      campaigns: diagnosticTotals.campaigns,
      authoritative_subscriptions: diagnosticTotals.authoritative_subscriptions,
      webhook_health: diagnosticTotals.webhook_health,
    },
    release_cohorts: diagnosticRows(report.release_cohorts).flatMap((row) => {
      const cohortInstallations = safeNonnegativeInteger(row.cohort_installations);
      if (cohortInstallations < MINIMUM_BREAKDOWN_INSTALLS) return [];
      const ordered = projectOrderedRows([row]);
      if (ordered.length !== 1) return [];
      return [{
        app_version: safeReleaseDimension(row.app_version, 32),
        build_number: safeReleaseDimension(row.build_number, 24),
        runtime_version: safeReleaseDimension(row.runtime_version, 32),
        platform: safeDimension(row.platform, IAP_PLATFORMS),
        cohort_day: safeDateDimension(row.cohort_day),
        ...ordered[0],
        cohort_installations: cohortInstallations,
      }];
    }),
    authoritative_transitions: {
      trial_started: safeNonnegativeInteger(transitions.trial_started),
      paid_started: safeNonnegativeInteger(transitions.paid_started),
      by_day: diagnosticRows(transitions.by_day).map((row) => ({
        day: safeDateDimension(row.day),
        phase: safeDimension(row.phase, IAP_BILLING_PHASES),
        transitions: safeNonnegativeInteger(row.transitions),
        distinct_subscriptions: safeNonnegativeInteger(row.distinct_subscriptions),
      })).filter((row) => row.distinct_subscriptions >= MINIMUM_BREAKDOWN_INSTALLS),
      by_provider_plan: diagnosticRows(transitions.by_provider_plan).map((row) => ({
        provider: safeDimension(row.provider, STORE_PROVIDERS),
        plan: safeDimension(row.plan, SUBSCRIPTION_PLANS),
        phase: safeDimension(row.phase, IAP_BILLING_PHASES),
        transitions: safeNonnegativeInteger(row.transitions),
        distinct_subscriptions: safeNonnegativeInteger(row.distinct_subscriptions),
      })).filter((row) => row.distinct_subscriptions >= MINIMUM_BREAKDOWN_INSTALLS),
      source_of_truth: safeDimension(
        transitions.source_of_truth,
        TRANSITION_TRUTH_SOURCES,
      ),
    },
  };
}

type AttributionLoadResult = {
  rows: DiagnosticRow[];
  rpcQueryFailed: boolean;
  rowLimitReached: boolean;
  malformedResult: boolean;
};

type SpendLedgerLoadResult = {
  rows: DiagnosticRow[];
  queryFailed: boolean;
  rowLimitReached: boolean;
  malformedResult: boolean;
};

type NormalizedAttributionTransition = {
  transitionId: string;
  attributionLabel: 'source-qualified' | 'platform-blended';
  subscriptionProvider: 'apple' | 'google';
  plan: 'monthly' | 'yearly';
  phase: 'trial' | 'paid';
  occurredAtMs: number;
  platform: 'ios' | 'android' | null;
  attributionProvider: 'apple_ads' | 'play_install_referrer' | null;
  source: 'google' | null;
  medium: 'cpc' | null;
  campaign: typeof APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN | null;
  appleCampaignId: number | null;
};

type ProjectedCampaign = ReturnType<typeof projectDiagnosticSummary>['campaigns'][number];

async function loadSubscriptionAttributionTruth(
  supabase: ReturnType<typeof createServiceClient>,
  fromTimestamp: string,
  toTimestamp: string,
): Promise<AttributionLoadResult> {
  const rows: DiagnosticRow[] = [];
  let expectedCount: number | null = null;

  for (let offset = 0; offset <= MAX_ATTRIBUTION_TRANSITIONS; offset += ATTRIBUTION_PAGE_SIZE) {
    const result = await supabase
      .rpc('growth_subscription_attribution_truth', {
        p_from: fromTimestamp,
        p_to: toTimestamp,
      }, { count: 'exact' })
      .order('occurred_at', { ascending: true })
      .order('transition_id', { ascending: true })
      .range(offset, offset + ATTRIBUTION_PAGE_SIZE - 1);

    if (result.error) {
      return { rows: [], rpcQueryFailed: true, rowLimitReached: false, malformedResult: false };
    }
    if (!Array.isArray(result.data) ||
      !Number.isSafeInteger(result.count) || Number(result.count) < 0) {
      return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    if (expectedCount === null) {
      expectedCount = Number(result.count);
      if (expectedCount > MAX_ATTRIBUTION_TRANSITIONS) {
        return { rows: [], rpcQueryFailed: false, rowLimitReached: true, malformedResult: false };
      }
    } else if (result.count !== expectedCount) {
      return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
    }

    const pageRows = diagnosticRows(result.data);
    if (pageRows.length !== result.data.length) {
      return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    rows.push(...pageRows);
    if (rows.length >= expectedCount) break;
    if (pageRows.length === 0) {
      return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
    }
  }

  if (expectedCount === null || rows.length !== expectedCount) {
    return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
  }
  const fromMs = Date.parse(fromTimestamp);
  const toExclusiveMs = Date.parse(toTimestamp);
  const transitionIds = new Set<string>();
  for (const row of rows) {
    const normalized = normalizeAttributionTransition(row, fromMs, toExclusiveMs);
    if (normalized === null || transitionIds.has(normalized.transitionId)) {
      return { rows: [], rpcQueryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    transitionIds.add(normalized.transitionId);
  }
  return { rows, rpcQueryFailed: false, rowLimitReached: false, malformedResult: false };
}

async function loadSpendLedger(
  supabase: ReturnType<typeof createServiceClient>,
  fromDate: string,
  toExclusiveDate: string,
): Promise<SpendLedgerLoadResult> {
  const rows: DiagnosticRow[] = [];
  let expectedCount: number | null = null;

  for (let offset = 0; offset <= MAX_SPEND_LEDGER_ROWS; offset += SPEND_LEDGER_PAGE_SIZE) {
    const result = await supabase
      .from('growth_campaign_spend_daily')
      .select('spend_date,source,campaign,currency,spend_cents', { count: 'exact' })
      .gte('spend_date', fromDate)
      .lt('spend_date', toExclusiveDate)
      .order('spend_date', { ascending: true })
      .order('source', { ascending: true })
      .order('campaign', { ascending: true })
      .order('currency', { ascending: true })
      .range(offset, offset + SPEND_LEDGER_PAGE_SIZE - 1);
    if (result.error) {
      return { rows: [], queryFailed: true, rowLimitReached: false, malformedResult: false };
    }
    if (!Array.isArray(result.data) ||
      !Number.isSafeInteger(result.count) || Number(result.count) < 0) {
      return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    if (expectedCount === null) {
      expectedCount = Number(result.count);
      if (expectedCount > MAX_SPEND_LEDGER_ROWS) {
        return { rows: [], queryFailed: false, rowLimitReached: true, malformedResult: false };
      }
    } else if (result.count !== expectedCount) {
      return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    const pageRows = diagnosticRows(result.data);
    if (pageRows.length !== result.data.length) {
      return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    rows.push(...pageRows);
    if (rows.length >= expectedCount) break;
    if (pageRows.length === 0) {
      return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
    }
  }

  if (expectedCount === null || rows.length !== expectedCount) {
    return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
  }
  const ledgerKeys = new Set<string>();
  if (rows.some((row) => (
    typeof row.spend_date !== 'string' || !dateSchema.safeParse(row.spend_date).success ||
    row.spend_date < fromDate || row.spend_date >= toExclusiveDate ||
    typeof row.source !== 'string' || !SPEND_SOURCE_PATTERN.test(row.source) ||
    typeof row.campaign !== 'string' || !SPEND_CAMPAIGN_PATTERN.test(row.campaign) ||
    row.currency !== 'BRL' || typeof row.spend_cents !== 'number' ||
    !Number.isSafeInteger(row.spend_cents) || row.spend_cents < 0 ||
    row.spend_cents > 1_000_000_000_000
  ))) {
    return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
  }
  for (const row of rows) {
    const key = `${row.spend_date}\u0000${row.source}\u0000${row.campaign}\u0000${row.currency}`;
    if (ledgerKeys.has(key)) {
      return { rows: [], queryFailed: false, rowLimitReached: false, malformedResult: true };
    }
    ledgerKeys.add(key);
  }
  return { rows, queryFailed: false, rowLimitReached: false, malformedResult: false };
}

function positiveSafeInteger(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function normalizeAttributionTransition(
  row: DiagnosticRow,
  fromMs: number,
  toExclusiveMs: number,
): NormalizedAttributionTransition | null {
  if (typeof row.transition_id !== 'string' || !UUID_PATTERN.test(row.transition_id)) return null;
  const scope = safeDimension(row.attribution_scope, ATTRIBUTION_SCOPES);
  const subscriptionProvider = safeDimension(row.subscription_provider, STORE_PROVIDERS);
  const plan = safeDimension(row.plan, SUBSCRIPTION_PLANS);
  const phase = safeDimension(row.phase, IAP_BILLING_PHASES);
  if (scope === PRIVACY_SAFE_UNKNOWN || subscriptionProvider === PRIVACY_SAFE_UNKNOWN ||
    plan === PRIVACY_SAFE_UNKNOWN || phase === PRIVACY_SAFE_UNKNOWN ||
    typeof row.occurred_at !== 'string') return null;
  const occurredAtMs = Date.parse(row.occurred_at);
  if (!Number.isFinite(occurredAtMs) || occurredAtMs < fromMs || occurredAtMs >= toExclusiveMs) {
    return null;
  }

  const base = {
    transitionId: row.transition_id,
    subscriptionProvider: subscriptionProvider as 'apple' | 'google',
    plan: plan as 'monthly' | 'yearly',
    phase: phase as 'trial' | 'paid',
    occurredAtMs,
  };
  const googleSourceQualified = scope === 'source_qualified' &&
    subscriptionProvider === 'google' && row.platform === 'android' &&
    row.attribution_provider === 'play_install_referrer' && row.source === 'google' &&
    row.medium === 'cpc' && row.campaign === APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN;
  const appleCampaignId = positiveSafeInteger(row.campaign_id);
  const appleSourceQualified = scope === 'source_qualified' &&
    subscriptionProvider === 'apple' && row.platform === 'ios' &&
    row.attribution_provider === 'apple_ads' && appleCampaignId !== null;

  if (googleSourceQualified) {
    return {
      ...base,
      attributionLabel: 'source-qualified',
      platform: 'android',
      attributionProvider: 'play_install_referrer',
      source: 'google',
      medium: 'cpc',
      campaign: APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN,
      appleCampaignId: null,
    };
  }
  if (appleSourceQualified) {
    return {
      ...base,
      attributionLabel: 'source-qualified',
      platform: 'ios',
      attributionProvider: 'apple_ads',
      source: null,
      medium: null,
      campaign: null,
      appleCampaignId,
    };
  }
  return {
    ...base,
    attributionLabel: 'platform-blended',
    platform: null,
    attributionProvider: null,
    source: null,
    medium: null,
    campaign: null,
    appleCampaignId: null,
  };
}

function matureCount(count: number) {
  if (count === 0) return 0;
  return count >= MINIMUM_BREAKDOWN_INSTALLS ? count : null;
}

function projectAttributionEconomics(
  attributionLoad: AttributionLoadResult,
  spendLoad: SpendLedgerLoadResult,
  campaigns: ProjectedCampaign[],
  requestedWindow: { from: string; toExclusive: string },
) {
  const auditAvailable = !attributionLoad.rpcQueryFailed && !attributionLoad.rowLimitReached &&
    !attributionLoad.malformedResult;
  const spendAuditAvailable = !spendLoad.queryFailed && !spendLoad.rowLimitReached &&
    !spendLoad.malformedResult;
  const emptyReport = {
    audit_available: auditAvailable,
    spend_audit_available: spendAuditAvailable,
    row_limit_reached: attributionLoad.rowLimitReached,
    spend_row_limit_reached: spendLoad.rowLimitReached,
    minimum_breakdown_transitions: MINIMUM_BREAKDOWN_INSTALLS,
    mature_after_days: ATTRIBUTION_MATURITY_DAYS,
    provisional_cac_ceiling_cents: PROVISIONAL_CAC_CEILING_CENTS,
    source_qualified: [] as DiagnosticRow[],
    platform_blended: [] as DiagnosticRow[],
    campaign_economics: [] as DiagnosticRow[],
    not_attributable_campaigns: [] as DiagnosticRow[],
  };
  if (!auditAvailable) return emptyReport;

  const fromMs = Date.parse(`${requestedWindow.from}T00:00:00.000Z`);
  const toExclusiveMs = Date.parse(requestedWindow.toExclusive);
  const maturityAsOfMs = Math.min(toExclusiveMs, Date.now());
  const maturityCutoffMs = maturityAsOfMs - ATTRIBUTION_MATURITY_DAYS * 24 * 60 * 60 * 1000;
  const maturityCutoffDate = new Date(maturityCutoffMs).toISOString().slice(0, 10);
  const deduplicated = new Map<string, NormalizedAttributionTransition>();
  for (const rawRow of attributionLoad.rows) {
    const row = normalizeAttributionTransition(rawRow, fromMs, toExclusiveMs);
    if (row && !deduplicated.has(row.transitionId)) deduplicated.set(row.transitionId, row);
  }
  const transitions = [...deduplicated.values()];

  const sourceGroups = new Map<string, {
    dimensions: Omit<NormalizedAttributionTransition, 'transitionId' | 'occurredAtMs'>;
    transitions: number;
    matureTransitions: number;
  }>();
  const blendedGroups = new Map<string, {
    subscriptionProvider: 'apple' | 'google';
    plan: 'monthly' | 'yearly';
    phase: 'trial' | 'paid';
    transitions: number;
    matureTransitions: number;
  }>();

  for (const row of transitions) {
    if (row.attributionLabel === 'source-qualified') {
      const key = [
        row.subscriptionProvider, row.plan, row.phase, row.platform,
        row.attributionProvider, row.source, row.medium, row.campaign, row.appleCampaignId,
      ].join('\u0000');
      const group = sourceGroups.get(key) ?? {
        dimensions: {
          attributionLabel: row.attributionLabel,
          subscriptionProvider: row.subscriptionProvider,
          plan: row.plan,
          phase: row.phase,
          platform: row.platform,
          attributionProvider: row.attributionProvider,
          source: row.source,
          medium: row.medium,
          campaign: row.campaign,
          appleCampaignId: row.appleCampaignId,
        },
        transitions: 0,
        matureTransitions: 0,
      };
      group.transitions += 1;
      if (row.occurredAtMs <= maturityCutoffMs) group.matureTransitions += 1;
      sourceGroups.set(key, group);
      continue;
    }
    const key = [row.subscriptionProvider, row.plan, row.phase].join('\u0000');
    const group = blendedGroups.get(key) ?? {
      subscriptionProvider: row.subscriptionProvider,
      plan: row.plan,
      phase: row.phase,
      transitions: 0,
      matureTransitions: 0,
    };
    group.transitions += 1;
    if (row.occurredAtMs <= maturityCutoffMs) group.matureTransitions += 1;
    blendedGroups.set(key, group);
  }

  const sourceQualified = [...sourceGroups.values()]
    .filter((group) => group.transitions >= MINIMUM_BREAKDOWN_INSTALLS)
    .map((group) => ({
      attribution_label: 'source-qualified',
      subscription_provider: group.dimensions.subscriptionProvider,
      plan: group.dimensions.plan,
      phase: group.dimensions.phase,
      platform: group.dimensions.platform,
      attribution_provider: group.dimensions.attributionProvider,
      source: group.dimensions.source,
      medium: group.dimensions.medium,
      campaign: group.dimensions.campaign,
      apple_campaign_id: group.dimensions.appleCampaignId,
      transitions: group.transitions,
      mature_transitions: matureCount(group.matureTransitions),
      maturity_suppressed: group.matureTransitions > 0 &&
        group.matureTransitions < MINIMUM_BREAKDOWN_INSTALLS,
    }))
    .sort((a, b) => b.transitions - a.transitions ||
      `${a.subscription_provider}:${a.campaign ?? a.apple_campaign_id ?? ''}`
        .localeCompare(`${b.subscription_provider}:${b.campaign ?? b.apple_campaign_id ?? ''}`));
  const platformBlended = [...blendedGroups.values()]
    .filter((group) => group.transitions >= MINIMUM_BREAKDOWN_INSTALLS)
    .map((group) => ({
      attribution_label: 'platform-blended',
      subscription_provider: group.subscriptionProvider,
      plan: group.plan,
      phase: group.phase,
      transitions: group.transitions,
      mature_transitions: matureCount(group.matureTransitions),
      maturity_suppressed: group.matureTransitions > 0 &&
        group.matureTransitions < MINIMUM_BREAKDOWN_INSTALLS,
    }))
    .sort((a, b) => b.transitions - a.transitions ||
      `${a.subscription_provider}:${a.plan}:${a.phase}`
        .localeCompare(`${b.subscription_provider}:${b.plan}:${b.phase}`));

  const spendByCampaign = new Map<string, number>();
  if (spendAuditAvailable) {
    for (const row of spendLoad.rows) {
      if (typeof row.spend_date !== 'string' || !dateSchema.safeParse(row.spend_date).success ||
        row.spend_date < requestedWindow.from || row.spend_date >= maturityCutoffDate ||
        row.currency !== 'BRL' || row.source !== 'google' ||
        row.campaign !== APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN) continue;
      const spendCents = safeNullableNonnegativeInteger(row.spend_cents);
      if (spendCents === null) continue;
      const key = `${row.source}\u0000${row.campaign}`;
      const next = (spendByCampaign.get(key) ?? 0) + spendCents;
      if (Number.isSafeInteger(next)) spendByCampaign.set(key, next);
    }
  }

  const paidCampaignGroups = new Map<string, {
    source: 'google';
    campaign: typeof APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN;
    transitions: number;
    matureTransitions: number;
  }>();
  for (const row of transitions) {
    if (row.attributionLabel !== 'source-qualified' || row.phase !== 'paid' ||
      row.source !== 'google' || row.campaign !== APPROVED_GOOGLE_ATTRIBUTION_CAMPAIGN) continue;
    const key = `${row.source}\u0000${row.campaign}`;
    const group = paidCampaignGroups.get(key) ?? {
      source: row.source,
      campaign: row.campaign,
      transitions: 0,
      matureTransitions: 0,
    };
    group.transitions += 1;
    if (row.occurredAtMs <= maturityCutoffMs) group.matureTransitions += 1;
    paidCampaignGroups.set(key, group);
  }
  const campaignsByKey = new Map(campaigns.map((campaign) => [
    `${campaign.source}\u0000${campaign.campaign}`,
    campaign,
  ]));
  const campaignEconomics = [...paidCampaignGroups.entries()]
    .filter(([, group]) => group.transitions >= MINIMUM_BREAKDOWN_INSTALLS)
    .map(([key, group]) => {
      const spendCents = spendAuditAvailable && spendByCampaign.has(key)
        ? spendByCampaign.get(key) ?? null
        : null;
      const reportableMatureTransitions = matureCount(group.matureTransitions);
      const cacCents = spendCents !== null &&
        reportableMatureTransitions !== null && reportableMatureTransitions > 0
        ? Math.round(spendCents / reportableMatureTransitions)
        : null;
      const campaign = campaignsByKey.get(key);
      return {
        attribution_label: 'source-qualified',
        source: group.source,
        campaign: group.campaign,
        paid_transitions: group.transitions,
        mature_paid_transitions: reportableMatureTransitions,
        maturity_suppressed: group.matureTransitions > 0 &&
          group.matureTransitions < MINIMUM_BREAKDOWN_INSTALLS,
        mature_spend_cents: spendCents,
        currency: 'BRL',
        mature_paid_cac_cents: cacCents,
        provisional_cac_ceiling_cents: PROVISIONAL_CAC_CEILING_CENTS,
        within_provisional_cac_ceiling: cacCents === null
          ? null
          : cacCents <= PROVISIONAL_CAC_CEILING_CENTS,
        diagnostic_attributed_installs: campaign?.attributed_installs ?? null,
        diagnostic_first_opens: campaign?.first_opens ?? null,
        diagnostic_trial_starts: campaign?.trial_starts ?? null,
        diagnostic_paid_starts: campaign?.paid_starts ?? null,
      };
    })
    .sort((a, b) => b.paid_transitions - a.paid_transitions || a.campaign.localeCompare(b.campaign));
  const reportableCampaignKeys = new Set(sourceQualified.flatMap((row) => (
    row.source && row.campaign ? [`${row.source}\u0000${row.campaign}`] : []
  )));
  const notAttributableCampaigns = campaigns
    .filter((campaign) => !reportableCampaignKeys.has(`${campaign.source}\u0000${campaign.campaign}`))
    .map((campaign) => ({
      attribution_label: 'not attributable',
      source: campaign.source,
      campaign: campaign.campaign,
      spend_cents: campaign.spend_cents,
      currency: campaign.currency,
      attributed_installs: campaign.attributed_installs,
      first_opens: campaign.first_opens,
      trial_starts: campaign.trial_starts,
      paid_starts: campaign.paid_starts,
    }));

  return {
    ...emptyReport,
    source_qualified: sourceQualified,
    platform_blended: platformBlended,
    campaign_economics: campaignEconomics,
    not_attributable_campaigns: notAttributableCampaigns,
  };
}

function countBy(
  rows: DiagnosticRow[],
  dimensions: Array<{ column: string; allowed: ReadonlySet<string> }>,
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = dimensions.map(({ column, allowed }) => {
      const value = row[column];
      return typeof value === 'string' && allowed.has(value) ? value : PRIVACY_SAFE_UNKNOWN;
    }).join(':');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function iapConflictDiagnostics(rows: DiagnosticRow[]) {
  const conflicts = rows.filter((row) => row.error_code === 'subscription_already_linked');
  const distinctProofs = new Set<string>();
  let fingerprintedAttempts = 0;
  let unfingerprintedAttempts = 0;

  for (const row of conflicts) {
    const proofFingerprint = row.proof_fingerprint;
    if (typeof proofFingerprint === 'string' && NORMALIZED_PROOF_FINGERPRINT.test(proofFingerprint)) {
      distinctProofs.add(proofFingerprint);
      fingerprintedAttempts += 1;
    } else {
      unfingerprintedAttempts += 1;
    }
  }

  return {
    conflict_attempts: conflicts.length,
    distinct_conflict_proofs: distinctProofs.size,
    repeated_conflict_attempts: fingerprintedAttempts - distinctProofs.size,
    unfingerprinted_conflict_attempts: unfingerprintedAttempts,
  };
}

function onboardingStepBreakdown(rows: DiagnosticRow[]) {
  const steps = new Map<string, { event_count: number; installs: Set<string> }>();
  for (const row of rows) {
    const properties = diagnosticRow(row.properties);
    const stepKey = safeDimension(properties?.step_key, ONBOARDING_STEP_KEYS);
    const current = steps.get(stepKey) ?? { event_count: 0, installs: new Set<string>() };
    current.event_count += 1;
    const installationId = row.installation_id;
    if (typeof installationId === 'string') current.installs.add(installationId);
    steps.set(stepKey, current);
  }

  return [...steps.entries()]
    .map(([step_key, value]) => ({
      step_key,
      unique_installs: value.installs.size,
      event_count: value.event_count,
    }))
    .sort((a, b) => b.unique_installs - a.unique_installs || a.step_key.localeCompare(b.step_key));
}

function uniqueInstallations(rows: DiagnosticRow[]) {
  return new Set(rows.flatMap((row) => (
    typeof row.installation_id === 'string' ? [row.installation_id] : []
  ))).size;
}

function propertyBreakdown(rows: DiagnosticRow[], dimensions: PropertyDimension[]) {
  const values = new Map<string, { event_count: number; installs: Set<string> }>();
  for (const row of rows) {
    const properties = diagnosticRow(row.properties);
    const key = dimensions.map((dimension) => safePropertyDimension(properties, dimension)).join(':');
    const current = values.get(key) ?? { event_count: 0, installs: new Set<string>() };
    current.event_count += 1;
    if (typeof row.installation_id === 'string') current.installs.add(row.installation_id);
    values.set(key, current);
  }

  return [...values.entries()]
    .map(([key, value]) => ({
      key,
      unique_installs: value.installs.size,
      event_count: value.event_count,
    }))
    .sort((a, b) => b.unique_installs - a.unique_installs || a.key.localeCompare(b.key));
}

function releaseFunnel(groups: Array<{ eventName: string; rows: DiagnosticRow[] }>) {
  const releases = new Map<string, {
    app_version: string;
    build_number: string;
    runtime_version: string;
    events: Map<string, Set<string>>;
  }>();

  for (const group of groups) {
    for (const row of group.rows) {
      const appVersion = safeReleaseDimension(row.app_version, 32);
      const buildNumber = safeReleaseDimension(row.build_number, 24);
      const runtimeVersion = safeReleaseDimension(row.runtime_version, 32);
      const releaseKey = `${appVersion}:${buildNumber}:${runtimeVersion}`;
      const release = releases.get(releaseKey) ?? {
        app_version: appVersion,
        build_number: buildNumber,
        runtime_version: runtimeVersion,
        events: new Map<string, Set<string>>(),
      };
      const installs = release.events.get(group.eventName) ?? new Set<string>();
      if (typeof row.installation_id === 'string') installs.add(row.installation_id);
      release.events.set(group.eventName, installs);
      releases.set(releaseKey, release);
    }
  }

  return [...releases.values()].map((release) => ({
    app_version: release.app_version,
    build_number: release.build_number,
    runtime_version: release.runtime_version,
    first_open: release.events.get('first_open')?.size ?? 0,
    onboarding_started: release.events.get('onboarding_started')?.size ?? 0,
    onboarding_completed: release.events.get('onboarding_completed')?.size ?? 0,
  }))
    .filter((release) => release.first_open >= MINIMUM_BREAKDOWN_INSTALLS)
    .sort((a, b) => b.first_open - a.first_open || b.onboarding_started - a.onboarding_started);
}

function firstExperienceDiagnostics(groups: {
  viewed: DiagnosticRow[];
  steps: DiagnosticRow[];
  completed: DiagnosticRow[];
  errors: DiagnosticRow[];
}) {
  const steps = new Map<string, { installs: Set<string>; events: number }>();
  for (const row of groups.steps) {
    const properties = row.properties as Record<string, unknown> | null | undefined;
    const stepKey = properties?.step_key;
    if (typeof stepKey !== 'string' || !FIRST_EXPERIENCE_STEP_KEYS.has(stepKey)) continue;
    const value = steps.get(stepKey) ?? { installs: new Set<string>(), events: 0 };
    value.events += 1;
    if (typeof row.installation_id === 'string') value.installs.add(row.installation_id);
    steps.set(stepKey, value);
  }

  const releases = new Map<string, {
    platform: 'android' | 'ios';
    build_number: string | null;
    runtime_version: string | null;
    viewed: Set<string>;
    completed: Set<string>;
    errors: Set<string>;
    installs: Set<string>;
  }>();
  const viewedInstallIds = new Set(groups.viewed.flatMap((row) => (
    typeof row.installation_id === 'string' ? [row.installation_id] : []
  )));
  const completedRows = groups.completed.filter((row) => (
    typeof row.installation_id === 'string' && viewedInstallIds.has(row.installation_id)
  ));
  const releaseGroups: Array<{ name: 'viewed' | 'completed' | 'errors'; rows: DiagnosticRow[] }> = [
    { name: 'viewed', rows: groups.viewed },
    { name: 'completed', rows: completedRows },
    { name: 'errors', rows: groups.errors },
  ];
  for (const { name, rows } of releaseGroups) {
    for (const row of rows) {
      if ((row.platform !== 'android' && row.platform !== 'ios') || typeof row.installation_id !== 'string') continue;
      const buildNumber = safeOptionalReleaseDimension(row.build_number, 24);
      const runtimeVersion = safeOptionalReleaseDimension(row.runtime_version, 32);
      const releaseKey = `${row.platform}:${buildNumber ?? ''}:${runtimeVersion ?? ''}`;
      const release = releases.get(releaseKey) ?? {
        platform: row.platform,
        build_number: buildNumber,
        runtime_version: runtimeVersion,
        viewed: new Set<string>(),
        completed: new Set<string>(),
        errors: new Set<string>(),
        installs: new Set<string>(),
      };
      release[name].add(row.installation_id);
      release.installs.add(row.installation_id);
      releases.set(releaseKey, release);
    }
  }

  const viewedInstalls = viewedInstallIds.size;
  const completedInstalls = uniqueInstallations(completedRows);
  return {
    viewed_installs: viewedInstalls,
    completed_installs: completedInstalls,
    error_installs: uniqueInstallations(groups.errors),
    completion_rate: viewedInstalls === 0 ? null : completedInstalls / viewedInstalls,
    steps: [...steps.entries()]
      .map(([step_key, value]) => ({ step_key, installs: value.installs.size, events: value.events }))
      .filter((value) => value.installs >= MINIMUM_BREAKDOWN_INSTALLS)
      .sort((a, b) => b.installs - a.installs || a.step_key.localeCompare(b.step_key)),
    releases: [...releases.values()]
      .filter((release) => release.installs.size >= MINIMUM_BREAKDOWN_INSTALLS)
      .map((release) => ({
        platform: release.platform,
        build_number: release.build_number,
        runtime_version: release.runtime_version,
        viewed_installs: release.viewed.size,
        completed_installs: release.completed.size,
        error_installs: release.errors.size,
      }))
      .sort((a, b) => b.viewed_installs - a.viewed_installs || a.platform.localeCompare(b.platform) ||
        (a.build_number ?? '').localeCompare(b.build_number ?? '') ||
        (a.runtime_version ?? '').localeCompare(b.runtime_version ?? '')),
  };
}

export async function GET(req: Request) {
  const operator = requireOperatorAccess(req);
  if ('response' in operator) return operator.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    from: searchParams.get('from') ?? isoDateDaysAgo(29),
    to: searchParams.get('to') ?? isoDateDaysAgo(0),
    cohort_days: searchParams.get('cohort_days') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('growth_analytics_summary', {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
    p_cohort_days: parsed.data.cohort_days,
  });

  if (error || !data) {
    return fail('Could not load growth summary', 503, { code: 'growth_report_unavailable' });
  }
  if (!hasOrderedSummaryBlocks(data)) {
    return fail('Could not load growth summary', 503, { code: 'growth_report_unavailable' });
  }

  const fromTimestamp = `${parsed.data.from}T00:00:00.000Z`;
  const toExclusive = new Date(`${parsed.data.to}T00:00:00.000Z`);
  toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
  const loadDiagnostics = (table: string, columns: string) => supabase
    .from(table)
    .select(columns)
    .gte('created_at', fromTimestamp)
    .lt('created_at', toExclusive.toISOString())
    .limit(5000);
  const loadGrowthEvent = (eventName: string) => supabase
    .from('growth_analytics_events')
    .select('installation_id,platform,app_version,build_number,runtime_version,properties')
    .eq('event_name', eventName)
    .gte('received_at', fromTimestamp)
    .lt('received_at', toExclusive.toISOString())
    .limit(5000);
  const [
    attributionTruthResult,
    spendLedgerResult,
    clientResult,
    failureResult,
    receiptResult,
    onboardingStepResult,
    onboardingStepResultResult,
    onboardingInteractionResult,
    onboardingErrorResult,
    onboardingCompletedResult,
    routeResolvedResult,
    firstOpenResult,
    onboardingStartedResult,
    authStartedResult,
    authAttemptResult,
    firstExperienceViewedResult,
    firstExperienceStepResult,
    firstExperienceCompletedResult,
    firstExperienceErrorResult,
  ] = await Promise.all([
    loadSubscriptionAttributionTruth(supabase, fromTimestamp, toExclusive.toISOString()),
    loadSpendLedger(supabase, parsed.data.from, toExclusive.toISOString().slice(0, 10)),
    loadDiagnostics('iap_client_events', 'stage,outcome,error_code,platform'),
    loadDiagnostics('failed_receipts', 'error_code,source,platform,retryable,proof_fingerprint'),
    loadDiagnostics('in_app_purchase_receipts', 'platform,billing_phase'),
    loadGrowthEvent('onboarding_step'),
    loadGrowthEvent('onboarding_step_result'),
    loadGrowthEvent('onboarding_interaction'),
    loadGrowthEvent('onboarding_error'),
    loadGrowthEvent('onboarding_completed'),
    loadGrowthEvent('route_resolved'),
    loadGrowthEvent('first_open'),
    loadGrowthEvent('onboarding_started'),
    loadGrowthEvent('auth_started'),
    loadGrowthEvent('auth_attempt'),
    loadGrowthEvent('first_experience_viewed'),
    loadGrowthEvent('first_experience_step'),
    loadGrowthEvent('first_experience_completed'),
    loadGrowthEvent('first_experience_error'),
  ]);
  const rhythmsDiagnostics = await loadRhythmsDiagnostics(
    supabase,
    fromTimestamp,
    toExclusive.toISOString(),
  );
  const attributionAuditAvailable = !attributionTruthResult.rpcQueryFailed &&
    !attributionTruthResult.rowLimitReached && !attributionTruthResult.malformedResult;
  if (!attributionAuditAvailable) {
    console.error('[operator.growth] attribution_truth_unavailable', {
      rpcQueryFailed: attributionTruthResult.rpcQueryFailed,
      rowLimitReached: attributionTruthResult.rowLimitReached,
      malformedResult: attributionTruthResult.malformedResult,
    });
  }
  const spendAuditAvailable = !spendLedgerResult.queryFailed &&
    !spendLedgerResult.rowLimitReached && !spendLedgerResult.malformedResult;
  if (!spendAuditAvailable) {
    console.error('[operator.growth] attribution_spend_unavailable', {
      queryFailed: spendLedgerResult.queryFailed,
      rowLimitReached: spendLedgerResult.rowLimitReached,
      malformedResult: spendLedgerResult.malformedResult,
    });
  }
  const iapAuditAvailable = !clientResult.error && !failureResult.error && !receiptResult.error;
  const funnelAuditAvailable = !onboardingStepResult.error && !onboardingStepResultResult.error &&
    !onboardingInteractionResult.error && !onboardingErrorResult.error && !onboardingCompletedResult.error &&
    !routeResolvedResult.error && !firstOpenResult.error && !onboardingStartedResult.error &&
    !authStartedResult.error && !authAttemptResult.error;
  const firstExperienceAuditAvailable = !firstExperienceViewedResult.error && !firstExperienceStepResult.error &&
    !firstExperienceCompletedResult.error && !firstExperienceErrorResult.error;
  if (!iapAuditAvailable) {
    console.error('[operator.growth] iap_diagnostics_unavailable', {
      clientQueryFailed: Boolean(clientResult.error),
      failureQueryFailed: Boolean(failureResult.error),
      receiptQueryFailed: Boolean(receiptResult.error),
    });
  }
  if (!funnelAuditAvailable) {
    console.error('[operator.growth] funnel_diagnostics_unavailable', {
      onboardingStepQueryFailed: Boolean(onboardingStepResult.error),
      onboardingStepResultQueryFailed: Boolean(onboardingStepResultResult.error),
      onboardingInteractionQueryFailed: Boolean(onboardingInteractionResult.error),
      onboardingErrorQueryFailed: Boolean(onboardingErrorResult.error),
      onboardingCompletedQueryFailed: Boolean(onboardingCompletedResult.error),
      routeResolvedQueryFailed: Boolean(routeResolvedResult.error),
      firstOpenQueryFailed: Boolean(firstOpenResult.error),
      onboardingStartedQueryFailed: Boolean(onboardingStartedResult.error),
      authStartedQueryFailed: Boolean(authStartedResult.error),
      authAttemptQueryFailed: Boolean(authAttemptResult.error),
    });
  }
  if (!firstExperienceAuditAvailable) {
    return fail('Could not load growth summary', 503, { code: 'growth_report_unavailable' });
  }
  const clientRows = (clientResult.data ?? []) as unknown as DiagnosticRow[];
  const failureRows = (failureResult.data ?? []) as unknown as DiagnosticRow[];
  const receiptRows = (receiptResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingStepRows = (onboardingStepResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingStepResultRows = (onboardingStepResultResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingInteractionRows = (onboardingInteractionResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingErrorRows = (onboardingErrorResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingCompletedRows = (onboardingCompletedResult.data ?? []) as unknown as DiagnosticRow[];
  const routeResolvedRows = (routeResolvedResult.data ?? []) as unknown as DiagnosticRow[];
  const firstOpenRows = (firstOpenResult.data ?? []) as unknown as DiagnosticRow[];
  const onboardingStartedRows = (onboardingStartedResult.data ?? []) as unknown as DiagnosticRow[];
  const authStartedRows = (authStartedResult.data ?? []) as unknown as DiagnosticRow[];
  const authAttemptRows = (authAttemptResult.data ?? []) as unknown as DiagnosticRow[];
  const firstExperienceViewedRows = (firstExperienceViewedResult.data ?? []) as unknown as DiagnosticRow[];
  const firstExperienceStepRows = (firstExperienceStepResult.data ?? []) as unknown as DiagnosticRow[];
  const firstExperienceCompletedRows = (firstExperienceCompletedResult.data ?? []) as unknown as DiagnosticRow[];
  const firstExperienceErrorRows = (firstExperienceErrorResult.data ?? []) as unknown as DiagnosticRow[];
  const clientFailures = clientRows.filter((row) => !['started', 'succeeded'].includes(String(row.outcome)));

  const projectedSummary = projectGrowthSummary(data, {
    ...parsed.data,
    cohort_days: parsed.data.cohort_days ?? 14,
  });

  return ok({
    ...projectedSummary,
    rhythms_diagnostics: rhythmsDiagnostics,
    attribution_economics: projectAttributionEconomics(
      attributionTruthResult,
      spendLedgerResult,
      projectedSummary.campaigns,
      { from: parsed.data.from, toExclusive: toExclusive.toISOString() },
    ),
    onboarding_steps: onboardingStepBreakdown(onboardingStepRows),
    onboarding_step_results: propertyBreakdown(onboardingStepResultRows, [
      { column: 'step_key', allowed: ONBOARDING_STEP_KEYS },
      { column: 'result', allowed: ONBOARDING_STEP_RESULTS },
    ]),
    onboarding_diagnostics: {
      audit_available: funnelAuditAvailable,
      by_step_duration: propertyBreakdown(onboardingStepResultRows, [
        { column: 'step_key', allowed: ONBOARDING_STEP_KEYS },
        { column: 'result', allowed: ONBOARDING_STEP_RESULTS },
        { column: 'duration_bucket', allowed: ONBOARDING_DURATION_BUCKETS },
      ]),
      by_interaction: propertyBreakdown(onboardingInteractionRows, [
        { column: 'step_key', allowed: ONBOARDING_STEP_KEYS },
        { column: 'action', allowed: ONBOARDING_INTERACTIONS },
        { column: 'selection_count', integerRange: { minimum: 0, maximum: 6 } },
      ]),
      by_error: propertyBreakdown(onboardingErrorRows, [
        { column: 'step_key', allowed: ONBOARDING_STEP_KEYS },
        { column: 'stage', allowed: ONBOARDING_ERROR_STAGES },
        { column: 'error_code', allowed: ONBOARDING_ERROR_CODES },
      ]),
      completion_profiles: propertyBreakdown(onboardingCompletedRows, [
        { column: 'duration_bucket', allowed: ONBOARDING_DURATION_BUCKETS },
        { column: 'goal_count', integerRange: { minimum: 1, maximum: 5 } },
        { column: 'focus_count', integerRange: { minimum: 0, maximum: 6 } },
      ]),
    },
    routing_diagnostics: {
      audit_available: funnelAuditAvailable,
      decisions: routeResolvedRows.length,
      installs: uniqueInstallations(routeResolvedRows),
      by_destination: propertyBreakdown(routeResolvedRows, [
        { column: 'destination', allowed: ROUTE_DESTINATIONS },
        { column: 'onboarding_state', allowed: ROUTE_ONBOARDING_STATES },
        { column: 'auth_state', allowed: ROUTE_AUTH_STATES },
        { column: 'subscription_state', allowed: ROUTE_SUBSCRIPTION_STATES },
      ]),
      by_load_time: propertyBreakdown(routeResolvedRows, [
        { column: 'destination', allowed: ROUTE_DESTINATIONS },
        { column: 'load_time_bucket', allowed: ROUTE_LOAD_TIME_BUCKETS },
      ]),
    },
    first_experience_diagnostics: firstExperienceDiagnostics({
      viewed: firstExperienceViewedRows,
      steps: firstExperienceStepRows,
      completed: firstExperienceCompletedRows,
      errors: firstExperienceErrorRows,
    }),
    release_funnel: releaseFunnel([
      { eventName: 'first_open', rows: firstOpenRows },
      { eventName: 'onboarding_started', rows: onboardingStartedRows },
      { eventName: 'onboarding_completed', rows: onboardingCompletedRows },
    ]),
    auth_diagnostics: {
      audit_available: funnelAuditAvailable,
      screen_views: authStartedRows.length,
      screen_installs: uniqueInstallations(authStartedRows),
      attempt_events: authAttemptRows.length,
      attempt_installs: uniqueInstallations(authAttemptRows),
      by_entry_point: propertyBreakdown(authStartedRows, [
        { column: 'entry_point', allowed: AUTH_ENTRY_POINTS },
      ]),
      by_attempt: propertyBreakdown(authAttemptRows, [
        { column: 'stage', allowed: AUTH_STAGES },
        { column: 'mode', allowed: AUTH_MODES },
        { column: 'method', allowed: AUTH_METHODS },
        { column: 'outcome', allowed: AUTH_OUTCOMES },
      ]),
      row_limit_reached: [
        onboardingStepRows,
        onboardingStepResultRows,
        onboardingInteractionRows,
        onboardingErrorRows,
        onboardingCompletedRows,
        routeResolvedRows,
        firstOpenRows,
        onboardingStartedRows,
        authStartedRows,
        authAttemptRows,
        firstExperienceViewedRows,
        firstExperienceStepRows,
        firstExperienceCompletedRows,
        firstExperienceErrorRows,
      ]
        .some((rows) => rows.length >= 5000),
    },
    iap_diagnostics: {
      audit_available: iapAuditAvailable,
      client_events: clientRows.length,
      client_failures: clientFailures.length,
      server_failures: failureRows.length,
      verified_receipts: receiptRows.length,
      ...iapConflictDiagnostics(failureRows),
      by_client_issue: countBy(clientFailures, [
        { column: 'stage', allowed: IAP_CLIENT_STAGES },
        { column: 'outcome', allowed: IAP_CLIENT_OUTCOMES },
        { column: 'error_code', allowed: IAP_CLIENT_ERROR_CODES },
      ]),
      by_server_error: countBy(failureRows, [
        { column: 'source', allowed: IAP_SERVER_SOURCES },
        { column: 'error_code', allowed: IAP_SERVER_ERROR_CODES },
      ]),
      by_verified_phase: countBy(receiptRows, [
        { column: 'platform', allowed: IAP_PLATFORMS },
        { column: 'billing_phase', allowed: IAP_BILLING_PHASES },
      ]),
      row_limit_reached: [clientRows, failureRows, receiptRows].some((rows) => rows.length >= 5000),
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
