import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { parseQuery } from '@/lib/validation';

const bodySchema = z.object({ journey_id: z.string().uuid() }).strict();
const JOURNEY_FIELDS = 'id, user_id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date, completed_at, timezone_name, paused_at, last_resumed_at, source, completion_version';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function isUniqueViolation(error: unknown) {
  return !!error && typeof error === 'object' && (error as { code?: unknown }).code === '23505';
}

function boundedInteger(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function safeJourney(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const journey = value as Record<string, unknown>;
  const currentDay = boundedInteger(journey.current_day, 1, 1000);
  const totalCompletedDays = boundedInteger(journey.total_completed_days, 0, 1000);
  const streakCount = boundedInteger(journey.streak_count, 0, 1000);
  const bestStreak = boundedInteger(journey.best_streak, 0, 1000);
  const completionVersion = boundedInteger(journey.completion_version, 1, 1000);
  if (typeof journey.id !== 'string' || !z.string().uuid().safeParse(journey.id).success
    || !['active', 'paused', 'completed', 'abandoned'].includes(String(journey.status))
    || currentDay === null || totalCompletedDays === null || streakCount === null || bestStreak === null
    || typeof journey.timezone_name !== 'string' || journey.timezone_name.length === 0 || journey.timezone_name.length > 255
    || !['legacy', 'onboarding', 'recommendation', 'browse'].includes(String(journey.source))
    || completionVersion === null) return null;
  return {
    id: journey.id,
    status: journey.status,
    current_day: currentDay,
    streak_count: streakCount,
    best_streak: bestStreak,
    total_completed_days: totalCompletedDays,
    consistency_score: typeof journey.consistency_score === 'number' && Number.isFinite(journey.consistency_score) ? journey.consistency_score : 0,
    last_completed_on: typeof journey.last_completed_on === 'string' ? journey.last_completed_on : null,
    start_date: typeof journey.start_date === 'string' ? journey.start_date : null,
    completed_at: typeof journey.completed_at === 'string' ? journey.completed_at : null,
    timezone_name: journey.timezone_name,
    paused_at: typeof journey.paused_at === 'string' ? journey.paused_at : null,
    last_resumed_at: typeof journey.last_resumed_at === 'string' ? journey.last_resumed_at : null,
    source: journey.source,
    completion_version: completionVersion,
  };
}

export async function POST(request: Request) {
  try {
    const access = await requireActiveSubscription();
    if ('response' in access) return noStore(access.response);
    const parsed = parseQuery(bodySchema, await request.json().catch(() => null));
    if ('error' in parsed) return noStore(parsed.error);

    const supabase = createServiceClient();
    const readOwnedJourney = () => supabase
      .from('user_journeys')
      .select(JOURNEY_FIELDS)
      .eq('id', parsed.data.journey_id)
      .eq('user_id', access.userId)
      .maybeSingle();
    const existingResult = await readOwnedJourney();
    if (existingResult.error) throw existingResult.error;
    const existing = existingResult.data as Record<string, unknown> | null;
    if (!existing || existing.user_id !== access.userId) {
      return noStore(fail('Journey not found', 404, { code: 'journey_not_found' }));
    }
    const current = safeJourney(existing);
    if (!current) throw new Error('invalid_journey_projection');
    if (current.status === 'completed') {
      return noStore(fail('Journey is already completed', 409, { code: 'journey_already_completed' }));
    }
    if (current.status === 'active') return noStore(ok({ journey: current }));
    if (current.status !== 'paused') return noStore(fail('Journey not found', 404, { code: 'journey_not_found' }));

    const resumedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('user_journeys')
      .update({ status: 'active', paused_at: null, last_resumed_at: resumedAt })
      .eq('id', parsed.data.journey_id)
      .eq('user_id', access.userId)
      .eq('status', 'paused')
      .select(JOURNEY_FIELDS)
      .maybeSingle();
    if (isUniqueViolation(error)) {
      return noStore(fail('Another journey is already active', 409, { code: 'journey_active_conflict' }));
    }
    if (error) throw error;
    if (!data) {
      const reread = await readOwnedJourney();
      if (reread.error) throw reread.error;
      const authoritative = reread.data as Record<string, unknown> | null;
      if (!authoritative || authoritative.user_id !== access.userId) {
        return noStore(fail('Journey not found', 404, { code: 'journey_not_found' }));
      }
      const state = safeJourney(authoritative);
      if (!state) throw new Error('invalid_reread_projection');
      if (state.status === 'active') return noStore(ok({ journey: state }));
      if (state.status === 'completed') {
        return noStore(fail('Journey is already completed', 409, { code: 'journey_already_completed' }));
      }
      if (state.status === 'paused') {
        return noStore(fail('Journey could not be resumed', 409, { code: 'journey_resume_conflict' }));
      }
      return noStore(fail('Journey not found', 404, { code: 'journey_not_found' }));
    }
    const resumed = safeJourney(data);
    if (!resumed) throw new Error('invalid_resumed_projection');
    return noStore(ok({ journey: resumed }));
  } catch {
    console.error('[journeys-resume]', { route: 'journey_resume', stage: 'query', code: 'database_unavailable' });
    return noStore(fail('Could not resume journey', 503, { code: 'journey_resume_unavailable' }));
  }
}
