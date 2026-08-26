import { z } from 'zod';

export const GATHERING_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'pl', 'ru'] as const;
export const GATHERING_SECTION_TYPES = [
  'arrival',
  'opening_prayer',
  'scripture',
  'reflection',
  'silence',
  'private_prayer',
  'action',
  'closing',
] as const;

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
const localeSchema = z.enum(GATHERING_LOCALES);
const sectionSchema = z.enum(GATHERING_SECTION_TYPES);
const elapsedBucketSchema = z.enum(['under_30s', '30_119s', '2_4m', '5_14m', '15m_plus']);

const scriptureSchema = z.object({
  verse_id: uuidSchema,
  reference: z.string().min(1).max(160),
  version_code: z.string().min(1).max(32),
  language_code: z.string().min(1).max(16),
  is_locale_fallback: z.boolean(),
}).strict();

const stepSchema = z.object({
  id: uuidSchema,
  step_order: z.number().int().min(1).max(32),
  section_type: sectionSchema,
  content_key: z.string().min(1).max(256),
  body: z.string().min(1).max(4_000),
  duration_seconds: z.number().int().min(0).max(3_600),
  is_required: z.boolean(),
  scripture: scriptureSchema.nullable(),
}).strict();

const progressSchema = z.object({
  current_step: z.number().int().min(0).max(32),
  status: z.enum(['not_started', 'in_progress', 'completed', 'abandoned']),
  started_at: timestampSchema.nullable(),
  completed_at: timestampSchema.nullable(),
  last_seen_at: timestampSchema.nullable(),
}).strict();

const templateSchema = z.object({
  id: uuidSchema,
  slug: z.literal('weekly-rest'),
  version: z.literal(1),
  locale: localeSchema,
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(800),
  theme_key: z.literal('weekly_rest'),
  estimated_duration_seconds: z.number().int().min(720).max(1_080),
  access_tier: z.enum(['standard', 'premium']),
  editorial_revision: z.literal('editorial.1'),
  steps: z.array(stepSchema).length(8),
}).strict();

const currentGatheringSchema = z.object({
  schema_version: z.literal(1),
  template: templateSchema.nullable(),
  progress: progressSchema.nullable(),
}).strict();

const gatheringTelemetrySchema = z.discriminatedUnion('event_name', [
  z.object({
    event_name: z.literal('gathering_started'),
    properties: z.object({
      catalog_code: z.literal('weekly-rest'),
      source_surface: z.literal('gathering'),
      session_kind: z.literal('gathering'),
      session_length_bucket: z.literal('10_19m'),
    }).strict(),
  }).strict(),
  z.object({
    event_name: z.literal('gathering_step_completed'),
    properties: z.object({
      catalog_code: z.literal('weekly-rest'),
      step_index: z.number().int().min(1).max(8),
      step_type: sectionSchema,
      elapsed_bucket: elapsedBucketSchema,
    }).strict(),
  }).strict(),
  z.object({
    event_name: z.literal('gathering_completed'),
    properties: z.object({
      catalog_code: z.literal('weekly-rest'),
      completion_reason: z.enum(['completed', 'idempotent_replay']),
      elapsed_bucket: elapsedBucketSchema,
    }).strict(),
  }).strict(),
  z.object({
    event_name: z.literal('practice_session_completed'),
    properties: z.object({
      catalog_code: z.literal('guided_prayer'),
      session_kind: z.literal('guided_prayer'),
      completion_reason: z.literal('target_reached'),
      elapsed_bucket: elapsedBucketSchema,
    }).strict(),
  }).strict(),
]);

const progressFacts = {
  progress: progressSchema,
  practice_credit: z.literal('guided_prayer').nullable(),
  telemetry_events: z.array(gatheringTelemetrySchema).max(2),
};

const progressResultSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('updated'), ...progressFacts }).strict(),
  z.object({ outcome: z.literal('already_updated'), ...progressFacts }).strict(),
  z.object({ outcome: z.literal('completed'), ...progressFacts }).strict(),
  z.object({ outcome: z.literal('already_completed'), ...progressFacts }).strict(),
  z.object({ outcome: z.literal('not_found') }).strict(),
  z.object({ outcome: z.literal('idempotency_conflict') }).strict(),
  z.object({ outcome: z.literal('invalid_request') }).strict(),
]);

export const saveGatheringProgressInputSchema = z.object({
  current_step: z.number().int().min(0).max(32),
  completed: z.boolean(),
  idempotency_key: uuidSchema.optional(),
  timezone_name: z.string().min(1).max(255),
}).strict().superRefine((input, context) => {
  if (input.completed && !input.idempotency_key) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['idempotency_key'], message: 'Required' });
  }
});

type RpcResult = { data: unknown; error: unknown };
export type GatheringClient = {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type GatheringCallResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'database_unavailable' | 'invalid_response' };

export function canonicalGatheringLocale(value: string | null | undefined): typeof GATHERING_LOCALES[number] {
  const language = value?.trim().toLowerCase().split(/[-_]/, 1)[0];
  return GATHERING_LOCALES.includes(language as typeof GATHERING_LOCALES[number])
    ? language as typeof GATHERING_LOCALES[number]
    : 'en';
}

export async function loadCurrentGathering(
  client: GatheringClient,
  input: { userId: string; locale: typeof GATHERING_LOCALES[number]; now: string },
): Promise<GatheringCallResult<z.infer<typeof currentGatheringSchema>>> {
  let result: RpcResult;
  try {
    result = await client.rpc('get_current_gathering_v1', {
      p_owner_user_id: input.userId,
      p_locale: input.locale,
      p_now: input.now,
    });
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const parsed = currentGatheringSchema.safeParse(result.data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, code: 'invalid_response' };
}

export async function saveGatheringProgress(
  client: GatheringClient,
  input: {
    userId: string;
    templateId: string;
    currentStep: number;
    completed: boolean;
    idempotencyKey?: string;
    timezoneName: string;
    localDay: string;
    localWeekStart: string;
    occurredAt: string;
  },
): Promise<GatheringCallResult<z.infer<typeof progressResultSchema>>> {
  let result: RpcResult;
  try {
    result = await client.rpc('save_gathering_progress_v1', {
      p_owner_user_id: input.userId,
      p_template_id: input.templateId,
      p_current_step: input.currentStep,
      p_complete: input.completed,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_timezone_name: input.timezoneName,
      p_local_day: input.localDay,
      p_local_week_start: input.localWeekStart,
      p_occurred_at: input.occurredAt,
    });
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const parsed = progressResultSchema.safeParse(result.data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, code: 'invalid_response' };
}
