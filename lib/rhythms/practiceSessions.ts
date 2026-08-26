import { z } from 'zod';
import { PRACTICE_CODES } from '@/lib/rhythms/contracts';

const practiceCodeSchema = z.enum(PRACTICE_CODES);
const uuidSchema = z.string().uuid();
const dateSchema = z.string().date();
const timestampSchema = z.string().datetime({ offset: true });
const milestoneCodeSchema = z.enum([
  'rhythm_first_week',
  'rhythm_four_weeks',
  'rhythm_balanced',
  'rhythm_return',
]);

export const startPracticeSessionInputSchema = z.object({
  practice_code: practiceCodeSchema,
  idempotency_key: uuidSchema,
  timezone_name: z.string().min(1).max(255),
}).strict();

export const completePracticeSessionInputSchema = z.object({
  session_id: uuidSchema,
  idempotency_key: uuidSchema,
}).strict();

const sessionSchema = z.object({
  id: uuidSchema,
  practice_code: practiceCodeSchema,
  status: z.enum(['started', 'completed', 'cancelled']),
  local_day: dateSchema,
  local_week_start: dateSchema,
  started_at: timestampSchema,
  completed_at: timestampSchema.nullable(),
}).strict();

const weeklySummarySchema = z.object({
  schema_version: z.literal(1),
  week_start: dateSchema,
  timezone_name: z.string().min(1).max(255),
  configured: z.boolean(),
  practices: z.array(z.object({
    code: practiceCodeSchema,
    weekly_target: z.number().int().min(1).max(7),
    completed_sessions: z.number().int().min(0),
    target_met: z.boolean(),
  }).strict()).min(0).max(4),
  rhythm_met: z.boolean(),
}).strict();

const startResultSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('started'), session: sessionSchema }).strict(),
  z.object({ outcome: z.literal('already_started'), session: sessionSchema }).strict(),
  z.object({ outcome: z.literal('cancelled'), session: sessionSchema }).strict(),
  z.object({ outcome: z.literal('practice_unavailable') }).strict(),
  z.object({ outcome: z.literal('idempotency_conflict') }).strict(),
  z.object({ outcome: z.literal('invalid_request') }).strict(),
]);

const completionFacts = {
  session: sessionSchema,
  weekly_summary: weeklySummarySchema,
  newly_earned_milestones: z.array(milestoneCodeSchema).max(4),
};

const completeResultSchema = z.discriminatedUnion('outcome', [
  z.object({ outcome: z.literal('completed'), ...completionFacts }).strict(),
  z.object({ outcome: z.literal('already_completed'), ...completionFacts }).strict(),
  z.object({ outcome: z.literal('not_found') }).strict(),
  z.object({ outcome: z.literal('cancelled') }).strict(),
  z.object({ outcome: z.literal('idempotency_conflict') }).strict(),
  z.object({ outcome: z.literal('invalid_request') }).strict(),
]);

type RpcResult = { data: unknown; error: unknown };
export type PracticeSessionClient = {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<RpcResult>;
};

export type PracticeSessionCallResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: 'database_unavailable' | 'invalid_response' };

export async function startDirectPracticeSession(
  client: PracticeSessionClient,
  params: {
    userId: string;
    practiceCode: z.infer<typeof practiceCodeSchema>;
    idempotencyKey: string;
    timezoneName: string;
    localDay: string;
    localWeekStart: string;
    startedAt: string;
  },
): Promise<PracticeSessionCallResult<z.infer<typeof startResultSchema>>> {
  const result = await client.rpc('start_direct_practice_session', {
    p_owner_user_id: params.userId,
    p_practice_code: params.practiceCode,
    p_idempotency_key: params.idempotencyKey,
    p_timezone_name: params.timezoneName,
    p_local_day: params.localDay,
    p_local_week_start: params.localWeekStart,
    p_started_at: params.startedAt,
  });
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const parsed = startResultSchema.safeParse(result.data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, code: 'invalid_response' };
}

export async function completeDirectPracticeSession(
  client: PracticeSessionClient,
  params: { userId: string; sessionId: string; idempotencyKey: string; completedAt: string },
): Promise<PracticeSessionCallResult<z.infer<typeof completeResultSchema>>> {
  const result = await client.rpc('complete_direct_practice_session', {
    p_owner_user_id: params.userId,
    p_session_id: params.sessionId,
    p_idempotency_key: params.idempotencyKey,
    p_completed_at: params.completedAt,
  });
  if (result.error) return { ok: false, code: 'database_unavailable' };
  const parsed = completeResultSchema.safeParse(result.data);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, code: 'invalid_response' };
}
