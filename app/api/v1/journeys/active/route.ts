import { ok, fail } from '@/lib/http';
import { resolveJourneyActor } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';

type ActiveJourneyRow = {
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
  start_date: string;
  journey_templates:
    | {
        id: string;
        slug: string;
        language_code: string;
        title: string;
        subtitle: string | null;
        description: string | null;
        duration_days: number;
        is_premium: boolean;
        theme_tags: string[];
      }
    | Array<{
    id: string;
    slug: string;
    language_code: string;
    title: string;
    subtitle: string | null;
    description: string | null;
    duration_days: number;
    is_premium: boolean;
    theme_tags: string[];
      }>;
};

export async function GET() {
  const actorResult = await resolveJourneyActor(true);
  if (!('actor' in actorResult)) {
    return fail(actorResult.error, actorResult.status);
  }

  const actor = actorResult.actor;
  const supabase = createServiceClient();

  let query = supabase
    .from('user_journeys')
    .select(
      'id, user_id, anonymous_profile_id, template_id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date, journey_templates!inner(id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags)',
    )
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1);

  if (actor.kind === 'user') {
    query = query.eq('user_id', actor.userId);
  } else {
    query = query.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) return fail('Could not load active journey', 500, error.message);
  if (!data) return ok(null);

  const journey = data as unknown as ActiveJourneyRow;
  const template = Array.isArray(journey.journey_templates) ? journey.journey_templates[0] : journey.journey_templates;
  if (!template) return fail('Journey template data is missing', 500);

  const todaySteps = await getOrCreateDayAssignment(
    supabase,
    journey.id,
    journey.template_id,
    journey.current_day,
    template.language_code ?? 'en',
  );

  let milestonesQuery = supabase
    .from('user_milestones')
    .select('milestone_code, earned_at')
    .order('earned_at', { ascending: false });

  if (actor.kind === 'user') {
    milestonesQuery = milestonesQuery.eq('user_id', actor.userId);
  } else {
    milestonesQuery = milestonesQuery.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data: milestones, error: milestonesError } = await milestonesQuery;
  if (milestonesError) return fail('Could not load milestones', 500, milestonesError.message);

  const duration = template.duration_days || 1;
  const progressPercent = Math.min(100, Number(((journey.total_completed_days / duration) * 100).toFixed(2)));

  return ok({
    journey: {
      id: journey.id,
      status: journey.status,
      current_day: journey.current_day,
      streak_count: journey.streak_count,
      best_streak: journey.best_streak,
      total_completed_days: journey.total_completed_days,
      consistency_score: journey.consistency_score,
      last_completed_on: journey.last_completed_on,
      start_date: journey.start_date,
      progress_percent: progressPercent,
    },
    template,
    today_steps: todaySteps,
    milestones: milestones ?? [],
  });
}
