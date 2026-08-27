import { z } from 'zod';

export const GATHERING_V2_LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export type GatheringLocale = typeof GATHERING_V2_LOCALES[number];

export const GATHERING_SAFE_ERROR_CODES = [
  'account_required',
  'authentication_required',
  'conflict',
  'database_unavailable',
  'gathering_not_found',
  'invalid_request',
  'invalid_response',
  'network_unavailable',
  'not_found',
  'server_unavailable',
  'subscription_check_unavailable',
  'subscription_required',
  'unknown',
] as const;
export type GatheringSafeErrorCode = typeof GATHERING_SAFE_ERROR_CODES[number];

const uuidSchema = z.string().uuid();
const timestampSchema = z.string().datetime({ offset: true });
const localeSchema = z.enum(GATHERING_V2_LOCALES);
const slotTypeSchema = z.enum(['monday', 'thursday']);
const catalogCodeSchema = z.string().regex(/^g-[0-9]{4}w[0-9]{2}-(mon|thu)$|^evergreen-[a-z0-9-]{1,80}$/);
const themeKeySchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);

const progressSchema = z.object({
  current_step: z.number().int().min(0).max(8),
  status: z.enum(['not_started', 'in_progress', 'completed', 'abandoned']),
}).strict();

const catalogItemSchema = z.object({
  release_id: uuidSchema,
  template_id: uuidSchema,
  catalog_code: catalogCodeSchema,
  slot_type: slotTypeSchema,
  source_kind: z.enum(['generated', 'evergreen']),
  locale: localeSchema,
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(800),
  theme_key: themeKeySchema,
  estimated_duration_seconds: z.number().int().min(720).max(1_080),
  available_from: timestampSchema.nullable().optional(),
  progress: progressSchema.nullable().optional(),
}).strict();

const nextReleaseSchema = z.object({
  slot_type: slotTypeSchema,
  available_at: timestampSchema,
}).strict();

const gatheringCatalogV2Schema = z.object({
  schema_version: z.literal(2),
  timezone_name: z.string().min(1).max(255),
  generated_at: timestampSchema.nullable(),
  featured: z.array(catalogItemSchema).max(2),
  history: z.array(catalogItemSchema).max(52),
  next_release: nextReleaseSchema.nullable(),
  fallback_used: z.boolean(),
}).strict();

const milestoneCodeSchema = z.enum([
  'gathering_first_light',
  'gathering_monthly_rhythm',
  'gathering_season_keeper',
  'gathering_long_companion',
]);

const progressResultSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('saved'),
    progress: progressSchema,
    new_milestone_codes: z.array(milestoneCodeSchema).max(4),
  }).strict(),
  z.object({
    outcome: z.literal('completed'),
    progress: progressSchema,
    new_milestone_codes: z.array(milestoneCodeSchema).max(4),
  }).strict(),
  z.object({
    outcome: z.literal('already_completed'),
    progress: progressSchema,
    new_milestone_codes: z.array(milestoneCodeSchema).max(4),
  }).strict(),
  z.object({
    outcome: z.enum(['not_found', 'idempotency_conflict', 'invalid_request', 'account_required']),
    new_milestone_codes: z.array(milestoneCodeSchema).max(4),
  }).strict(),
]);

export type GatheringCatalogV2 = z.infer<typeof gatheringCatalogV2Schema>;
export type GatheringProgressResultV2 = z.infer<typeof progressResultSchema>;

export const saveGatheringProgressInputSchema = z.object({
  current_step: z.number().int().min(0).max(8),
  state: z.enum(['in_progress', 'completed']),
  idempotency_key: uuidSchema.optional(),
  timezone_name: z.string().trim().min(1).max(255),
}).strict().superRefine((input, context) => {
  if (input.state === 'completed' && (input.current_step !== 8 || !input.idempotency_key)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['idempotency_key'],
      message: 'Completed progress requires step 8 and an idempotency key',
    });
  }
});

type RpcResult = { data: unknown; error: unknown };
export type GatheringV2Client = {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type GatheringV2CallResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'database_unavailable' | 'invalid_response' };

export function decodeGatheringCatalogV2(value: unknown): GatheringCatalogV2 | null {
  const parsed = gatheringCatalogV2Schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function decodeGatheringProgressResultV2(value: unknown): GatheringProgressResultV2 | null {
  const parsed = progressResultSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function loadGatheringCatalogV2(
  client: GatheringV2Client,
  input: {
    userId: string | null;
    locale: GatheringLocale;
    timezoneName: string;
    now: string;
  },
): Promise<GatheringV2CallResult<GatheringCatalogV2>> {
  let result: RpcResult;
  try {
    result = await client.rpc('get_gathering_catalog_v2', {
      p_owner_user_id: input.userId,
      p_locale: input.locale,
      p_timezone_name: input.timezoneName,
      p_now: input.now,
    });
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const value = decodeGatheringCatalogV2(result.data);
  return value ? { ok: true, value } : { ok: false, code: 'invalid_response' };
}

export async function saveGatheringProgressV2(
  client: GatheringV2Client,
  input: {
    userId: string;
    templateId: string;
    currentStep: number;
    state: 'in_progress' | 'completed';
    idempotencyKey?: string;
    timezoneName: string;
  },
): Promise<GatheringV2CallResult<GatheringProgressResultV2>> {
  let result: RpcResult;
  try {
    result = await client.rpc('save_gathering_progress_v2', {
      p_owner_user_id: input.userId,
      p_template_id: input.templateId,
      p_current_step: input.currentStep,
      p_state: input.state,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_timezone_name: input.timezoneName,
    });
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const value = decodeGatheringProgressResultV2(result.data);
  return value ? { ok: true, value } : { ok: false, code: 'invalid_response' };
}
