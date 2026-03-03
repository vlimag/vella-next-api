import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { resolveJourneyActor } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';

const bodySchema = z.object({
  journey_id: z.string().uuid(),
  reflection_note: z.string().trim().max(1200).optional(),
  gratitude_note: z.string().trim().max(1200).optional(),
});

type JourneyRow = {
  id: string;
  user_id: string | null;
  anonymous_profile_id: string | null;
  template_id: string;
  status: string;
  current_day: number;
  streak_count: number;
  best_streak: number;
  total_completed_days: number;
  consistency_score: number;
  last_completed_on: string | null;
  journey_templates:
    | { duration_days: number; language_code: string }
    | Array<{ duration_days: number; language_code: string }>;
};

async function hasMilestone(
  supabase: ReturnType<typeof createServiceClient>,
  owner: { userId?: string; anonymousProfileId?: string },
  milestoneCode: string,
) {
  let query = supabase
    .from('user_milestones')
    .select('id')
    .eq('milestone_code', milestoneCode)
    .limit(1);

  if (owner.userId) {
    query = query.eq('user_id', owner.userId);
  } else {
    query = query.eq('anonymous_profile_id', owner.anonymousProfileId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return true;
  return Boolean(data?.id);
}

async function awardMilestone(
  supabase: ReturnType<typeof createServiceClient>,
  owner: { userId?: string; anonymousProfileId?: string },
  milestoneCode: string,
  metadata: Record<string, unknown>,
) {
  if (await hasMilestone(supabase, owner, milestoneCode)) {
    return;
  }

  await supabase.from('user_milestones').insert({
    user_id: owner.userId ?? null,
    anonymous_profile_id: owner.anonymousProfileId ?? null,
    milestone_code: milestoneCode,
    metadata,
  });
}

export async function POST(req: Request) {
  const actorResult = await resolveJourneyActor(true);
  if (!('actor' in actorResult)) {
    return fail(actorResult.error, actorResult.status);
  }
  const actor = actorResult.actor;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  let journeyQuery = supabase
    .from('user_journeys')
    .select(
      'id, user_id, anonymous_profile_id, template_id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, journey_templates!inner(duration_days, language_code)',
    )
    .eq('id', parsed.data.journey_id)
    .limit(1);

  if (actor.kind === 'user') {
    journeyQuery = journeyQuery.eq('user_id', actor.userId);
  } else {
    journeyQuery = journeyQuery.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data: journeyData, error: journeyError } = await journeyQuery.maybeSingle();
  if (journeyError || !journeyData) return fail('Journey not found', 404);

  const journey = journeyData as unknown as JourneyRow;
  const template = Array.isArray(journey.journey_templates) ? journey.journey_templates[0] : journey.journey_templates;
  if (!template) return fail('Journey template data is missing', 500);
  if (journey.status !== 'active') {
    return ok({ alreadyCompleted: journey.status === 'completed', journey });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (journey.last_completed_on === today) {
    return ok({ alreadyCompleted: true, journey });
  }

  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const currentDay = Math.max(1, journey.current_day);
  const duration = Math.max(1, template.duration_days);

  const completedSteps = await getOrCreateDayAssignment(
    supabase,
    journey.id,
    journey.template_id,
    currentDay,
    template.language_code ?? 'en',
  );

  const { error: sessionError } = await supabase
    .from('user_journey_daily_sessions')
    .upsert(
      {
        user_journey_id: journey.id,
        day_number: currentDay,
        session_date: today,
        reflection_note: parsed.data.reflection_note ?? null,
        gratitude_note: parsed.data.gratitude_note ?? null,
        completed_steps: completedSteps,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_journey_id,day_number' },
    );

  if (sessionError) return fail('Could not save journey session', 500, sessionError.message);

  const streak = journey.last_completed_on === yesterday ? journey.streak_count + 1 : 1;
  const bestStreak = Math.max(journey.best_streak, streak);
  const totalCompletedDays = journey.total_completed_days + 1;
  const isCompleted = currentDay >= duration;
  const nextDay = isCompleted ? duration : currentDay + 1;
  const consistencyScore = Math.min(100, Number(((totalCompletedDays / duration) * 100).toFixed(2)));

  const { data: updatedJourney, error: updateError } = await supabase
    .from('user_journeys')
    .update({
      current_day: nextDay,
      streak_count: streak,
      best_streak: bestStreak,
      total_completed_days: totalCompletedDays,
      consistency_score: consistencyScore,
      last_completed_on: today,
      status: isCompleted ? 'completed' : 'active',
      completed_at: isCompleted ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', journey.id)
    .select('id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on')
    .single();

  if (updateError || !updatedJourney) return fail('Could not update journey progress', 500, updateError?.message);

  const owner = actor.kind === 'user' ? { userId: actor.userId } : { anonymousProfileId: actor.anonymousProfileId };

  if (streak >= 3) {
    await awardMilestone(supabase, owner, 'streak_3', { streak, date: today });
  }
  if (streak >= 7) {
    await awardMilestone(supabase, owner, 'streak_7', { streak, date: today });
  }
  if (isCompleted) {
    await awardMilestone(supabase, owner, 'journey_finisher', { duration_days: duration, date: today });
  }

  let milestonesQuery = supabase
    .from('user_milestones')
    .select('milestone_code, earned_at')
    .order('earned_at', { ascending: false });

  if (actor.kind === 'user') {
    milestonesQuery = milestonesQuery.eq('user_id', actor.userId);
  } else {
    milestonesQuery = milestonesQuery.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data: milestones } = await milestonesQuery;

  return ok({
    completed: true,
    journey: updatedJourney,
    milestones: milestones ?? [],
  });
}
