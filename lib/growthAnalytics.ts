import { z } from 'zod';
import { fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';

export const MAX_GROWTH_EVENT_BATCH = 20;
export const MAX_GROWTH_REQUEST_BYTES = 32 * 1024;
export const GROWTH_RAW_RETENTION_DAYS = 90;

const uuidSchema = z.string().uuid();
const platformSchema = z.enum(['ios', 'android', 'web']);
const localeSchema = z.enum(['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl']);
const safeVersionSchema = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._+~-]+$/);
const safeBuildSchema = z.string().trim().min(1).max(24).regex(/^[A-Za-z0-9._+~-]+$/);
const shortCodeSchema = z.string().trim().min(1).max(32)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/)
  .transform((value) => value.toLowerCase());
const campaignCodeSchema = z.string().trim().min(1).max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/)
  .transform((value) => value.toLowerCase());
const ctaIdSchema = z.string().trim().min(1).max(48)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/)
  .transform((value) => value.toLowerCase());

const attributionShape = {
  source: shortCodeSchema.optional(),
  medium: shortCodeSchema.optional(),
  campaign: campaignCodeSchema.optional(),
  content: campaignCodeSchema.optional(),
};

function properties<T extends z.ZodRawShape>(shape: T) {
  return z.object({ ...attributionShape, ...shape }).strict();
}

function rhythmsProperties<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).strict();
}

const billingPeriodSchema = z.enum(['monthly', 'yearly']);
const onboardingStepKeySchema = z.enum([
  'language',
  'goal',
  'focus',
  'minutes',
  'rhythm',
  'reminder_style',
  'preview',
  'reminders',
]);
const onboardingDurationBucketSchema = z.enum(['under_5s', '5_14s', '15_29s', '30_59s', '60s_plus']);
const launchDurationBucketSchema = z.enum(['under_500ms', '500_1499ms', '1500_2999ms', '3000ms_plus']);
const authModeSchema = z.enum(['sign_in', 'sign_up']);
const authMethodSchema = z.enum(['email', 'google', 'apple']);
const authStageSchema = z.enum(['credentials', 'provider', 'verification']);
const authOutcomeSchema = z.enum(['started', 'verification_required', 'succeeded', 'failed', 'cancelled']);
const funnelVariantSchema = z.enum(['legacy_v1', 'compact_v2']);
const firstExperienceResultSchema = z.enum(['viewed', 'continued', 'completed', 'backgrounded', 'error']);
const diagnosticDurationBucketSchema = z.enum(['under_1s', '1_4s', '5_9s', '10s_plus']);
const diagnosticErrorCodeSchema = z.enum([
  'network_unavailable',
  'timeout',
  'persistence_failed',
  'unauthorized',
  'server_unavailable',
  'unexpected_error',
  'unknown',
]);
const rhythmsSourceSurfaceSchema = z.enum([
  'rhythms_hub', 'home', 'journey_catalog', 'journey_detail', 'journey_completion',
  'practice_catalog', 'weekly_rhythm', 'gathering', 'milestones', 'profile',
]);
const rhythmsSessionKindSchema = z.enum([
  'journey', 'guided_prayer', 'scripture', 'gratitude', 'silence',
  'daily_reflection', 'act_of_kindness', 'gathering',
]);
const journeyCatalogCodeSchema = z.enum(['hope-in-seven', 'weekly-rest']);
const practiceCatalogCodeSchema = z.enum([
  'guided_prayer', 'scripture', 'gratitude', 'silence', 'daily_reflection', 'act_of_kindness',
]);
const gatheringCatalogCodeSchema = z.literal('weekly-rest');
const milestoneCatalogCodeSchema = z.enum(['streak_3', 'streak_7', 'journey_finisher']);
const badgeCatalogCodeSchema = z.enum([
  'milestone.generic', 'flame.spark', 'flame.steady', 'flame.rooted', 'flame.pilgrim',
]);
const rhythmsJourneyLengthBucketSchema = z.enum([
  '1_day', '2_7_days', '8_14_days', '15_30_days', '31_plus_days',
]);
const rhythmsSessionLengthBucketSchema = z.enum([
  'under_2m', '2_4m', '5_9m', '10_19m', '20m_plus',
]);
const rhythmsStepTypeSchema = z.enum([
  'verse', 'reflection', 'prayer', 'action', 'challenge', 'gratitude', 'arrival',
  'opening_prayer', 'scripture', 'silence', 'private_prayer', 'closing',
]);
const rhythmsCompletionReasonSchema = z.enum(['completed', 'idempotent_replay', 'target_reached']);
const rhythmsAbandonmentReasonSchema = z.enum(['user_exit', 'backgrounded', 'superseded', 'error']);
const rhythmsElapsedBucketSchema = z.enum(['under_30s', '30_119s', '2_4m', '5_14m', '15m_plus']);
const rhythmsNetworkStateSchema = z.enum(['online', 'offline', 'degraded']);
const rhythmsCacheStateSchema = z.enum(['miss', 'fresh', 'stale', 'fallback']);
const rhythmsCapabilitySchema = z.enum([
  'journey_v2', 'practices', 'gatherings', 'social_badges', 'long_journeys',
]);
const rhythmsErrorStageSchema = z.enum([
  'summary_load', 'catalog_load', 'session_start', 'step_complete', 'session_complete',
  'weekly_save', 'gathering_load', 'milestone_mutation', 'asset_load',
]);
const rhythmsErrorCodeSchema = z.enum([
  'network_unavailable', 'timeout', 'unauthorized', 'not_found', 'conflict',
  'server_unavailable', 'invalid_response', 'capability_unavailable', 'asset_unavailable', 'unknown',
]);

function matchingPracticeProperties<T extends z.ZodRawShape>(shape: T) {
  return rhythmsProperties({
    catalog_code: practiceCatalogCodeSchema,
    session_kind: z.enum([
      'guided_prayer', 'scripture', 'gratitude', 'silence', 'daily_reflection', 'act_of_kindness',
    ]),
    ...shape,
  }).refine((value) => value.catalog_code === value.session_kind, {
    message: 'practice catalog_code must match session_kind',
    path: ['session_kind'],
  });
}

const legacyFirstExperienceStepSchema = z.object({
  step_number: z.number().int().min(1).max(4),
  total_steps: z.literal(4),
  step_key: z.enum(['arrival', 'scripture', 'reflection', 'completion']),
  result: firstExperienceResultSchema,
}).strict();

const compactFirstExperienceStepSchema = z.object({
  variant: z.literal('compact_v2'),
  step_number: z.number().int().min(1).max(2),
  total_steps: z.literal(2),
  step_key: z.enum(['moment', 'completion']),
  result: firstExperienceResultSchema,
}).strict();

const onboardingStepPropertiesSchema = properties({
  step_number: z.number().int().min(1).max(20),
  total_steps: z.number().int().min(1).max(20),
  step_key: onboardingStepKeySchema,
}).refine((value) => value.step_number <= value.total_steps, {
  message: 'step_number cannot exceed total_steps',
  path: ['step_number'],
});

const onboardingStepResultPropertiesSchema = properties({
  step_number: z.number().int().min(1).max(20),
  total_steps: z.number().int().min(1).max(20),
  step_key: onboardingStepKeySchema,
  result: z.enum(['continued', 'skipped', 'back', 'backgrounded', 'abandoned', 'error']),
  selection_count: z.number().int().min(0).max(6).optional(),
  duration_bucket: onboardingDurationBucketSchema.optional(),
}).refine((value) => value.step_number <= value.total_steps, {
  message: 'step_number cannot exceed total_steps',
  path: ['step_number'],
});

const eventBase = z.object({
  event_id: uuidSchema,
  install_id: uuidSchema,
  occurred_at: z.string().datetime({ offset: true }),
  platform: platformSchema,
  app_version: safeVersionSchema,
  build_number: safeBuildSchema.optional(),
  runtime_version: safeVersionSchema.optional(),
  funnel_variant: funnelVariantSchema.optional(),
  locale: localeSchema.optional(),
  session_id: uuidSchema.optional(),
}).strict();

const growthEventUnionSchema = z.union([
  eventBase.extend({
    event_name: z.literal('landing_viewed'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('store_cta_clicked'),
    properties: properties({
      cta_id: ctaIdSchema,
      store: z.enum(['android', 'ios']),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('first_open'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('app_session_started'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('app_error'),
    properties: z.object({
      surface: z.enum(['global_js', 'unhandled_promise', 'react_render']),
      stage: z.enum(['bootstrap', 'render', 'background_task', 'unknown']),
      error_code: diagnosticErrorCodeSchema,
      severity: z.enum(['fatal', 'recoverable']),
      fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('startup_update_result'),
    properties: z.object({
      outcome: z.enum(['disabled', 'current', 'reloading', 'failed', 'timed_out']),
      duration_bucket: diagnosticDurationBucketSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('data_operation_failed'),
    properties: z.object({
      operation: z.enum(['query', 'mutation']),
      domain: z.enum([
        'home', 'feed', 'profile', 'plans', 'prayer', 'search', 'settings', 'auth',
        'subscription', 'attribution', 'unknown',
      ]),
      error_code: diagnosticErrorCodeSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('route_resolved'),
    properties: properties({
      destination: z.enum(['onboarding', 'first-experience', 'offer', 'authentication', 'subscription-verification', 'paywall', 'app']),
      onboarding_state: z.enum(['incomplete', 'complete']),
      auth_state: z.enum(['anonymous', 'authenticated']),
      subscription_state: z.enum(['unknown', 'inactive', 'active']),
      load_time_bucket: launchDurationBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('first_experience_viewed'),
    properties: z.object({
      variant: z.enum(['v1', 'compact_v2']),
      content_source: z.enum(['remote', 'fallback']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('first_experience_step'),
    properties: z.union([
      legacyFirstExperienceStepSchema,
      compactFirstExperienceStepSchema,
    ]),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('first_experience_completed'),
    properties: z.object({
      duration_bucket: onboardingDurationBucketSchema,
      content_source: z.enum(['remote', 'fallback']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('first_experience_error'),
    properties: z.object({
      stage: z.enum(['content_load', 'state_save', 'navigation']),
      error_code: z.enum([
        'network_unavailable',
        'content_unavailable',
        'persistence_failed',
        'navigation_failed',
        'unknown',
      ]),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_started'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_step'),
    properties: onboardingStepPropertiesSchema,
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_step_result'),
    properties: onboardingStepResultPropertiesSchema,
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_completed'),
    properties: z.union([
      properties({}),
      properties({
        duration_bucket: onboardingDurationBucketSchema,
        goal_count: z.number().int().min(1).max(5),
        focus_count: z.number().int().min(0).max(6),
      }),
    ]),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_interaction'),
    properties: properties({
      step_key: onboardingStepKeySchema,
      action: z.enum([
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
      ]),
      selection_count: z.number().int().min(0).max(6),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('onboarding_error'),
    properties: properties({
      step_key: onboardingStepKeySchema,
      stage: z.enum(['load_state', 'save_profile', 'save_language', 'change_language', 'navigation']),
      error_code: z.enum(['storage_unavailable', 'persistence_failed', 'language_failed', 'navigation_failed', 'unknown']),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('auth_started'),
    properties: properties({
      entry_point: z.enum(['post_onboarding', 'post_first_experience', 'premium', 'tabs', 'direct']).optional(),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('auth_attempt'),
    properties: properties({
      mode: authModeSchema,
      method: authMethodSchema,
      stage: authStageSchema,
      outcome: authOutcomeSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('account_created'),
    properties: properties({
      method: z.enum(['email', 'apple', 'google']),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('vella_profile_initialized'),
    properties: z.object({
      provider_class: z.enum(['email', 'apple', 'google']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('profile_initialization_result'),
    properties: z.object({
      outcome: z.enum(['created', 'existing', 'failed', 'provider_unknown']),
      provider_class: z.enum(['email', 'apple', 'google']).optional(),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('paywall_viewed'),
    properties: z.object({}).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('paywall_catalog_result'),
    properties: z.object({
      outcome: z.enum(['loaded', 'empty', 'failed']),
      product_count: z.number().int().min(0).max(2),
      duration_bucket: diagnosticDurationBucketSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('paywall_cta_tapped'),
    properties: z.object({
      plan: billingPeriodSchema,
      auth_state: z.enum(['anonymous', 'authenticated']),
      offer_kind: z.enum(['annual_trial', 'monthly', 'unavailable']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('pending_checkout_result'),
    properties: z.object({
      stage: z.enum(['save', 'resume', 'clear']),
      outcome: z.enum(['succeeded', 'empty', 'failed', 'expired']),
      plan: billingPeriodSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('subscription_ownership_flow'),
    properties: z.object({
      stage: z.enum(['conflict_presented', 'sign_in_requested', 'transfer_requested']),
      outcome: z.enum(['shown', 'opened', 'failed']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('attribution_install_result'),
    properties: z.object({
      outcome: z.enum(['succeeded', 'pending', 'failed']),
      reason: z.enum([
        'captured', 'provider_not_ready', 'network_unavailable', 'server_unavailable',
        'unsupported', 'unknown',
      ]),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('trial_terms_viewed'),
    properties: z.object({
      plan: z.literal('yearly'),
      trial_days_bucket: z.enum(['14_days', 'other']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('subscription_management_opened'),
    properties: z.object({
      source: z.enum(['paywall', 'settings']),
      result: z.enum(['opened', 'failed']),
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('plan_selected'),
    properties: z.object({
      plan: billingPeriodSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('checkout_started'),
    properties: z.object({
      plan: billingPeriodSchema,
    }).strict(),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('purchase_validation_result'),
    properties: properties({
      result: z.enum(['verified_active', 'rejected']),
      plan: billingPeriodSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('trial_started'),
    properties: properties({ plan: billingPeriodSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('subscription_paid_started'),
    properties: properties({ plan: billingPeriodSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('meaningful_session_completed'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('notification_permission_result'),
    properties: properties({
      result: z.enum(['granted', 'denied', 'unavailable', 'error']),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('notification_opened'),
    properties: properties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('rhythms_hub_viewed'),
    properties: rhythmsProperties({ source_surface: rhythmsSourceSurfaceSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_catalog_viewed'),
    properties: rhythmsProperties({ source_surface: rhythmsSourceSurfaceSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_detail_viewed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      journey_length_bucket: rhythmsJourneyLengthBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_started'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      journey_length_bucket: rhythmsJourneyLengthBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('practice_catalog_viewed'),
    properties: rhythmsProperties({ source_surface: rhythmsSourceSurfaceSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('practice_selected'),
    properties: matchingPracticeProperties({ source_surface: rhythmsSourceSurfaceSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('weekly_rhythm_saved'),
    properties: matchingPracticeProperties({}),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('gathering_viewed'),
    properties: rhythmsProperties({
      catalog_code: gatheringCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      session_length_bucket: rhythmsSessionLengthBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_session_started'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      session_kind: z.literal('journey'),
      journey_length_bucket: rhythmsJourneyLengthBucketSchema,
      cache_state: rhythmsCacheStateSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_step_completed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      step_index: z.number().int().min(1).max(32),
      step_type: rhythmsStepTypeSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_session_completed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      completion_reason: rhythmsCompletionReasonSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_resumed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      step_index: z.number().int().min(1).max(32),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('practice_session_started'),
    properties: matchingPracticeProperties({
      source_surface: rhythmsSourceSurfaceSchema,
      network_state: rhythmsNetworkStateSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('practice_session_completed'),
    properties: matchingPracticeProperties({
      completion_reason: rhythmsCompletionReasonSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('practice_session_abandoned'),
    properties: matchingPracticeProperties({
      abandonment_reason: rhythmsAbandonmentReasonSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('gathering_started'),
    properties: rhythmsProperties({
      catalog_code: gatheringCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      session_kind: z.literal('gathering'),
      session_length_bucket: rhythmsSessionLengthBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('gathering_step_completed'),
    properties: rhythmsProperties({
      catalog_code: gatheringCatalogCodeSchema,
      step_index: z.number().int().min(1).max(32),
      step_type: rhythmsStepTypeSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('gathering_resumed'),
    properties: rhythmsProperties({
      catalog_code: gatheringCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      step_index: z.number().int().min(1).max(32),
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('gathering_completed'),
    properties: rhythmsProperties({
      catalog_code: gatheringCatalogCodeSchema,
      completion_reason: rhythmsCompletionReasonSchema,
      elapsed_bucket: rhythmsElapsedBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_completed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      completion_reason: rhythmsCompletionReasonSchema,
      journey_length_bucket: rhythmsJourneyLengthBucketSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_completion_viewed'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('journey_next_selected'),
    properties: rhythmsProperties({
      catalog_code: journeyCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('weekly_rhythm_completed'),
    properties: matchingPracticeProperties({ completion_reason: rhythmsCompletionReasonSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('weekly_rhythm_returned'),
    properties: matchingPracticeProperties({ source_surface: rhythmsSourceSurfaceSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('milestone_earned'),
    properties: rhythmsProperties({ catalog_code: milestoneCatalogCodeSchema }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('milestone_revealed'),
    properties: rhythmsProperties({
      catalog_code: milestoneCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('milestone_featured'),
    properties: rhythmsProperties({
      catalog_code: milestoneCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('milestone_unfeatured'),
    properties: rhythmsProperties({
      catalog_code: milestoneCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('milestone_shared'),
    properties: rhythmsProperties({
      catalog_code: milestoneCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('rhythms_load_failed'),
    properties: rhythmsProperties({
      source_surface: rhythmsSourceSurfaceSchema,
      error_stage: rhythmsErrorStageSchema,
      error_code: rhythmsErrorCodeSchema,
      network_state: rhythmsNetworkStateSchema,
      cache_state: rhythmsCacheStateSchema,
      schema_version: z.literal(1),
      capability: rhythmsCapabilitySchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('rhythms_mutation_failed'),
    properties: rhythmsProperties({
      source_surface: rhythmsSourceSurfaceSchema,
      error_stage: rhythmsErrorStageSchema,
      error_code: rhythmsErrorCodeSchema,
      network_state: rhythmsNetworkStateSchema,
      cache_state: rhythmsCacheStateSchema,
      schema_version: z.literal(1),
      capability: rhythmsCapabilitySchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('session_completion_conflict'),
    properties: rhythmsProperties({
      session_kind: rhythmsSessionKindSchema,
      error_stage: rhythmsErrorStageSchema,
      error_code: rhythmsErrorCodeSchema,
    }),
  }).strict(),
  eventBase.extend({
    event_name: z.literal('rhythms_asset_fallback_used'),
    properties: rhythmsProperties({
      catalog_code: badgeCatalogCodeSchema,
      source_surface: rhythmsSourceSurfaceSchema,
      error_stage: z.literal('asset_load'),
      error_code: rhythmsErrorCodeSchema,
      cache_state: z.literal('fallback'),
    }),
  }).strict(),
]);

export const GROWTH_EVENT_NAMES = growthEventUnionSchema.options.map((option) => (
  option.shape.event_name.value
));

export const growthEventSchema = growthEventUnionSchema.superRefine((event, context) => {
  if (event.event_name === 'first_experience_viewed') {
    const matchesEnvelope = event.properties.variant === 'compact_v2'
      ? event.funnel_variant === 'compact_v2'
      : event.funnel_variant === undefined || event.funnel_variant === 'legacy_v1';
    if (!matchesEnvelope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'first-experience variant must match funnel_variant',
        path: ['funnel_variant'],
      });
    }
  }

  if (event.event_name === 'first_experience_step') {
    const compactProperties = 'variant' in event.properties &&
      event.properties.variant === 'compact_v2';
    const matchesEnvelope = compactProperties
      ? event.funnel_variant === 'compact_v2'
      : event.funnel_variant === undefined || event.funnel_variant === 'legacy_v1';
    if (!matchesEnvelope) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'first-experience variant must match funnel_variant',
        path: ['funnel_variant'],
      });
    }
  }
});

export type GrowthEvent = z.infer<typeof growthEventSchema>;

export const growthEventBatchSchema = z.object({
  events: z.array(growthEventSchema).min(1).max(MAX_GROWTH_EVENT_BATCH),
}).strict();

export const ANONYMOUS_GROWTH_EVENTS = new Set<GrowthEvent['event_name']>([
  'landing_viewed',
  'store_cta_clicked',
  'first_open',
  'app_session_started',
  'app_error',
  'startup_update_result',
  'data_operation_failed',
  'route_resolved',
  'first_experience_viewed',
  'first_experience_step',
  'first_experience_completed',
  'first_experience_error',
  'onboarding_started',
  'onboarding_step',
  'onboarding_step_result',
  'onboarding_interaction',
  'onboarding_error',
  'onboarding_completed',
  'auth_started',
  'auth_attempt',
  'paywall_viewed',
  'paywall_catalog_result',
  'paywall_cta_tapped',
  'pending_checkout_result',
  'attribution_install_result',
  'trial_terms_viewed',
  'plan_selected',
]);

type AnalyticsFailure = { response: ReturnType<typeof fail> };

function inputFailure(details: unknown): AnalyticsFailure {
  return { response: fail('Invalid analytics event input', 400, details) };
}

export async function parseGrowthEventRequest(request: Request): Promise<
  | { events: GrowthEvent[] }
  | AnalyticsFailure
> {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return { response: fail('Content-Type must be application/json', 415, { code: 'content_type_required' }) };
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_GROWTH_REQUEST_BYTES) {
    return { response: fail('Analytics request is too large', 413, { code: 'request_too_large' }) };
  }

  const text = await request.text().catch(() => '');
  if (Buffer.byteLength(text, 'utf8') > MAX_GROWTH_REQUEST_BYTES) {
    return { response: fail('Analytics request is too large', 413, { code: 'request_too_large' }) };
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return inputFailure({ code: 'invalid_json' });
  }

  const parsed = growthEventBatchSchema.safeParse(body);
  if (!parsed.success) return inputFailure(parsed.error.flatten());

  const events = parsed.data.events;
  const installationId = events[0]!.install_id;
  if (events.some((event) => event.install_id !== installationId)) {
    return inputFailure({ code: 'mixed_installations' });
  }

  const now = Date.now();
  const oldest = now - 7 * 24 * 60 * 60 * 1000;
  const newest = now + 5 * 60 * 1000;
  if (events.some((event) => {
    const occurredAt = Date.parse(event.occurred_at);
    return !Number.isFinite(occurredAt) || occurredAt < oldest || occurredAt > newest;
  })) {
    return inputFailure({ code: 'event_time_out_of_range' });
  }

  if (events.some((event) => {
    const webEvent = event.event_name === 'landing_viewed' || event.event_name === 'store_cta_clicked';
    return webEvent ? event.platform !== 'web' || event.app_version !== 'site' : event.platform === 'web';
  })) {
    return inputFailure({ code: 'platform_event_mismatch' });
  }

  return { events };
}

async function resolveAnalyticsAuthentication(
  request: Request,
  supabase: ReturnType<typeof createServiceClient>,
): Promise<{ authenticated: boolean } | AnalyticsFailure> {
  const authorization = request.headers.get('authorization');
  if (!authorization) return { authenticated: false };
  if (authorization.length > 8192) {
    return { response: fail('Invalid bearer token', 401, { code: 'authentication_invalid' }) };
  }

  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);
  if (!match) return { response: fail('Invalid bearer token', 401, { code: 'authentication_invalid' }) };

  const { data, error } = await supabase.auth.getUser(match[1]);
  if (error || !data.user) {
    return { response: fail('Invalid bearer token', 401, { code: 'authentication_invalid' }) };
  }
  // Authentication gates post-auth event names, but the account identifier is
  // intentionally not persisted or passed to the analytics RPC.
  return { authenticated: true };
}

type IngestionResult = {
  accepted: number;
  inserted: number;
  duplicates: number;
  rejected: number;
  rejection_codes: { contract_mismatch: number };
  retention_policy: 'raw_90_days';
};

type RpcIngestionResult = Omit<IngestionResult, 'rejected' | 'rejection_codes'>;

function isRpcIngestionResult(value: unknown): value is RpcIngestionResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<RpcIngestionResult>;
  return typeof result.accepted === 'number' && typeof result.inserted === 'number' &&
    typeof result.duplicates === 'number';
}

function mergeIngestionResults(left: IngestionResult, right: IngestionResult): IngestionResult {
  return {
    accepted: left.accepted + right.accepted,
    inserted: left.inserted + right.inserted,
    duplicates: left.duplicates + right.duplicates,
    rejected: left.rejected + right.rejected,
    rejection_codes: {
      contract_mismatch: left.rejection_codes.contract_mismatch + right.rejection_codes.contract_mismatch,
    },
    retention_policy: 'raw_90_days',
  };
}

async function ingestValidatedBatch(
  supabase: ReturnType<typeof createServiceClient>,
  events: GrowthEvent[],
  authenticated: boolean,
): Promise<{ data: IngestionResult } | { error: unknown }> {
  const { data, error } = await supabase.rpc('ingest_growth_analytics_events', {
    p_events: events,
    p_authenticated: authenticated,
  });
  if (!error && isRpcIngestionResult(data)) {
    return {
      data: {
        accepted: data.accepted,
        inserted: data.inserted,
        duplicates: data.duplicates,
        rejected: 0,
        rejection_codes: { contract_mismatch: 0 },
        retention_policy: 'raw_90_days',
      },
    };
  }
  if (!error) return { error: { code: 'invalid_rpc_result', message: 'invalid_rpc_result' } };
  const code = typeof error.code === 'string' ? error.code : 'unknown';
  if (code !== '23514') return { error };
  if (events.length === 1) {
    const rejected = events[0]!;
    console.error('[growth-analytics] contract_event_rejected', {
      errorCode: '23514',
      eventName: rejected.event_name,
      platform: rejected.platform,
      appVersion: rejected.app_version,
      buildNumber: rejected.build_number ?? 'unknown',
      runtimeVersion: rejected.runtime_version ?? 'unknown',
      funnelVariant: rejected.funnel_variant ?? 'unknown',
    });
    return {
      data: {
        accepted: 0,
        inserted: 0,
        duplicates: 0,
        rejected: 1,
        rejection_codes: { contract_mismatch: 1 },
        retention_policy: 'raw_90_days',
      },
    };
  }
  const midpoint = Math.floor(events.length / 2);
  const left = await ingestValidatedBatch(supabase, events.slice(0, midpoint), authenticated);
  if ('error' in left) return left;
  const right = await ingestValidatedBatch(supabase, events.slice(midpoint), authenticated);
  if ('error' in right) return right;
  return { data: mergeIngestionResults(left.data, right.data) };
}

export async function ingestGrowthEvents(request: Request): Promise<
  | { data: IngestionResult }
  | AnalyticsFailure
> {
  const parsed = await parseGrowthEventRequest(request);
  if ('response' in parsed) return parsed;

  const supabase = createServiceClient();
  const identity = await resolveAnalyticsAuthentication(request, supabase);
  if ('response' in identity) return identity;

  if (
    !identity.authenticated &&
    parsed.events.some((event) => !ANONYMOUS_GROWTH_EVENTS.has(event.event_name))
  ) {
    return { response: fail('Authentication is required for this analytics event', 401, {
      code: 'analytics_authentication_required',
    }) };
  }

  const ingestion = await ingestValidatedBatch(supabase, parsed.events, identity.authenticated);

  if ('error' in ingestion) {
    const error = ingestion.error as { code?: unknown; message?: unknown } | null;
    const errorCode = typeof error?.code === 'string' ? error.code : 'unknown';
    console.error('[growth-analytics] ingest_failed', {
      errorCode,
      eventCount: parsed.events.length,
    });
    if (error?.message === 'growth_rate_limit_exceeded') {
      return { response: fail('Too many analytics events', 429, { code: 'analytics_rate_limited' }) };
    }
    if (error?.message === 'growth_global_circuit_breaker_open') {
      return { response: fail('Analytics ingestion is temporarily at capacity', 503, {
        code: 'analytics_capacity_limited',
      }) };
    }
    return { response: fail('Could not record analytics events', 503, {
      code: 'analytics_ingestion_unavailable',
    }) };
  }

  return { data: ingestion.data };
}
