import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { localeSchema, parseQuery } from '@/lib/validation';
import { authenticatedJourneyActor, ownerFilter } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';
import { userHasActivePremium } from '@/lib/entitlements';
import { isMissingJourneyThemePreference } from '@/lib/journeyCompatibility';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  template_slug: z.string().trim().min(3).max(120),
  language_code: localeSchema.optional(),
  theme_preference: z.enum(['hope', 'peace', 'gratitude', 'family', 'trust']).optional(),
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
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const actor = authenticatedJourneyActor(access.userId);

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

  const templateQuery = supabase
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

  // Paywall gate: premium journeys require an active premium entitlement.
  // Anonymous (guest) actors can never start a premium journey.
  if ((template as TemplateRow).is_premium) {
    let isPremium = false;
    if (actor.kind === 'user') {
      try {
        isPremium = await userHasActivePremium(actor.userId);
      } catch (error) {
        return fail('Could not verify premium access', 500, String(error));
      }
    }
    if (!isPremium) {
      return fail('This journey is available to premium members.', 402, { code: 'premium_required' });
    }
  }

  const journeyValues = {
    ...ownerFilter(actor),
    template_id: template.id,
    status: 'active',
    start_date: new Date().toISOString().slice(0, 10),
    current_day: 1,
  };
  const insertJourney = (includeThemePreference: boolean) =>
    supabase
      .from('user_journeys')
      .insert(
        includeThemePreference
          ? { ...journeyValues, theme_preference: parsed.data.theme_preference ?? null }
          : journeyValues,
      )
      .select('id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date')
      .single();

  let { data: insertedJourney, error: insertError } = await insertJourney(true);
  if (isMissingJourneyThemePreference(insertError)) {
    console.warn('[journeys] theme_preference_missing_using_default', { route: 'start' });
    ({ data: insertedJourney, error: insertError } = await insertJourney(false));
  }

  if (insertError || !insertedJourney) {
    return fail('Could not start journey', 500, insertError?.message);
  }

  const typedTemplate = template as TemplateRow;
  const todaySteps = await getOrCreateDayAssignment(
    supabase,
    insertedJourney.id,
    typedTemplate.id,
    insertedJourney.current_day,
    language,
    parsed.data.theme_preference,
  );

  return ok({
    journey: insertedJourney,
    template: typedTemplate,
    today_steps: todaySteps,
  }, { status: 201 });
}
