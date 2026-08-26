import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const milestoneCode = z.string()
  .max(64)
  .regex(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/);

const journeyState = z.object({
  id: z.string().uuid(),
  status: z.enum(['active', 'paused', 'completed', 'abandoned']),
  current_day: z.number().int().positive(),
  streak_count: z.number().int().nonnegative(),
  best_streak: z.number().int().nonnegative(),
  total_completed_days: z.number().int().nonnegative(),
  consistency_score: z.coerce.number().min(0).max(100),
  last_completed_on: isoDate.nullable(),
});

const completionProjection = z.object({
  outcome: z.enum(['completed', 'already_completed', 'inactive']),
  completed: z.boolean(),
  already_completed: z.boolean(),
  journey: journeyState,
  milestones: z.array(z.object({
    milestone_code: milestoneCode,
    earned_at: z.string().datetime({ offset: true }),
  })).max(128),
  practice_credits: z.array(z.literal('guided_prayer')).max(1),
  newly_earned_milestones: z.array(milestoneCode).max(32),
  local_day: isoDate,
});

const finiteOutcome = z.union([
  completionProjection,
  z.object({ outcome: z.literal('not_found') }),
  z.object({ outcome: z.literal('idempotency_conflict') }),
  z.object({ outcome: z.literal('invalid_request') }),
]);

export type JourneyCompletionInput = {
  userId: string;
  journeyId: string;
  reflectionNote?: string;
  gratitudeNote?: string;
  timezoneName: string;
  localDay: string;
  localWeekStart: string;
  idempotencyKey?: string;
  completedAt: string;
};

type RpcResponse = { data: unknown; error: unknown };

export type JourneyCompletionRpcClient = {
  rpc(name: string, params: Record<string, unknown>): PromiseLike<RpcResponse>;
};

export type JourneyCompletionResult =
  | { ok: true; value: z.infer<typeof finiteOutcome> }
  | { ok: false; code: 'database_unavailable' | 'invalid_response' };

export async function completeJourneySession(
  client: JourneyCompletionRpcClient,
  input: JourneyCompletionInput,
): Promise<JourneyCompletionResult> {
  let response: RpcResponse;
  try {
    response = await client.rpc('complete_journey_session_v2', {
      p_owner_user_id: input.userId,
      p_journey_id: input.journeyId,
      p_reflection_note: input.reflectionNote ?? null,
      p_gratitude_note: input.gratitudeNote ?? null,
      p_timezone_name: input.timezoneName,
      p_local_day: input.localDay,
      p_local_week_start: input.localWeekStart,
      p_idempotency_key: input.idempotencyKey ?? null,
      p_completed_at: input.completedAt,
    });
  } catch {
    return { ok: false, code: 'database_unavailable' };
  }

  const { data, error } = response;

  if (error) return { ok: false, code: 'database_unavailable' };
  const parsed = finiteOutcome.safeParse(data);
  if (!parsed.success) return { ok: false, code: 'invalid_response' };
  return { ok: true, value: parsed.data };
}
