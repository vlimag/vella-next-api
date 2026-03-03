import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { localeSchema, parseQuery } from '@/lib/validation';
import { resolveJourneyActor, ownerFilter } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';

const bodySchema = z.object({
  template_slug: z.string().trim().min(3).max(120),
  language_code: localeSchema.optional(),
});

type TemplateRow = {
  id: string;
  slug: string;
  language_code: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  duration_days: number;
  is_premium: boolean;
  theme_tags: string[];
};

export async function POST(req: Request) {
  const actorResult = await resolveJourneyActor(true);
  if (!('actor' in actorResult)) {
    return fail(actorResult.error, actorResult.status);
  }
  const actor = actorResult.actor;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const language = parsed.data.language_code ?? 'en';
  const supabase = createServiceClient();

  let currentJourneyQuery = supabase
    .from('user_journeys')
    .select('id')
    .eq('status', 'active')
    .limit(1);

  if (actor.kind === 'user') {
    currentJourneyQuery = currentJourneyQuery.eq('user_id', actor.userId);
  } else {
    currentJourneyQuery = currentJourneyQuery.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data: currentJourney, error: currentJourneyError } = await currentJourneyQuery.maybeSingle();

  if (currentJourneyError) return fail('Could not check active journey', 500, currentJourneyError.message);
  if (currentJourney?.id) {
    return fail('You already have an active journey. Complete or abandon it first.', 409);
  }

  let templateQuery = supabase
    .from('journey_templates')
    .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags')
    .eq('slug', parsed.data.template_slug)
    .eq('is_published', true)
    .eq('version', 1)
    .eq('language_code', language)
    .limit(1)
    .maybeSingle();

  let { data: template, error: templateError } = await templateQuery;

  if ((templateError || !template) && language !== 'en') {
    const fallbackQuery = supabase
      .from('journey_templates')
      .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags')
      .eq('slug', parsed.data.template_slug)
      .eq('is_published', true)
      .eq('version', 1)
      .eq('language_code', 'en')
      .limit(1)
      .maybeSingle();

    const fallbackResult = await fallbackQuery;
    template = fallbackResult.data;
    templateError = fallbackResult.error;
  }

  if (templateError || !template) return fail('Journey template not found', 404);

  const { data: insertedJourney, error: insertError } = await supabase
    .from('user_journeys')
    .insert({
      ...ownerFilter(actor),
      template_id: template.id,
      status: 'active',
      start_date: new Date().toISOString().slice(0, 10),
      current_day: 1,
    })
    .select('id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date')
    .single();

  if (insertError || !insertedJourney) {
    return fail('Could not start journey', 500, insertError?.message);
  }

  const typedTemplate = template as TemplateRow;
  const todaySteps = await getOrCreateDayAssignment(
    supabase,
    insertedJourney.id,
    typedTemplate.id,
    insertedJourney.current_day,
    typedTemplate.language_code,
  );

  return ok({
    journey: insertedJourney,
    template: typedTemplate,
    today_steps: todaySteps,
  }, { status: 201 });
}
