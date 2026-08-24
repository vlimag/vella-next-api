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
]);
const STORE_PROVIDERS = new Set(['apple', 'google']);
const SUBSCRIPTION_PLANS = new Set(['monthly', 'yearly']);
const REPORT_CURRENCIES = new Set(['BRL']);
const SUBSCRIPTION_TRUTH_SOURCES = new Set(['verified_store_subscriptions']);
const TRANSITION_TRUTH_SOURCES = new Set(['subscription_marketing_transitions']);
const DIAGNOSTIC_TRUTH_SOURCES = new Set(['independent_client_events']);
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
  return Array.isArray(report.ordered_funnel) &&
    diagnostics !== null &&
    diagnostics.source_of_truth === 'independent_client_events' &&
    Array.isArray(diagnostics.funnel) &&
    Array.isArray(diagnostics.daily) &&
    Array.isArray(diagnostics.cohorts) &&
    Array.isArray(diagnostics.campaigns) &&
    diagnosticRow(diagnostics.authoritative_subscriptions) !== null &&
    diagnosticRow(diagnostics.webhook_health) !== null &&
    Array.isArray(report.release_cohorts) &&
    transitions !== null &&
    Number.isSafeInteger(transitions.trial_started) &&
    Number(transitions.trial_started) >= 0 &&
    Number.isSafeInteger(transitions.paid_started) &&
    Number(transitions.paid_started) >= 0 &&
    Array.isArray(transitions.by_day) &&
    Array.isArray(transitions.by_provider_plan) &&
    transitions.source_of_truth === 'subscription_marketing_transitions';
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
  const transitions = diagnosticRow(report.authoritative_transitions) ?? {};

  return {
    ...legacy,
    ordered_funnel: projectOrderedRows(report.ordered_funnel),
    diagnostic_totals: {
      source_of_truth: safeDimension(
        diagnosticTotalsRaw.source_of_truth,
        DIAGNOSTIC_TRUTH_SOURCES,
      ),
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

  return ok({
    ...projectGrowthSummary(data, {
      ...parsed.data,
      cohort_days: parsed.data.cohort_days ?? 14,
    }),
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
