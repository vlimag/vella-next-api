import { ok, fail } from '@/lib/http';
import { resolveJourneyActor } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';
import { localizeJourneyTemplateWithAI } from '@/lib/aiLocalizer';
import { localeSchema, parseQuery } from '@/lib/validation';
import { z } from 'zod';

const querySchema = z.object({
  lang: localeSchema.optional(),
});

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
        version: number;
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
    version: number;
      }>;
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const actorResult = await resolveJourneyActor(true);
  if (!('actor' in actorResult)) {
    return fail(actorResult.error, actorResult.status);
  }

  const actor = actorResult.actor;
  const supabase = createServiceClient();

  let query = supabase
    .from('user_journeys')
    .select(
      'id, user_id, anonymous_profile_id, template_id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date, journey_templates!inner(id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version)',
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
  const baseTemplate = Array.isArray(journey.journey_templates) ? journey.journey_templates[0] : journey.journey_templates;
  if (!baseTemplate) return fail('Journey template data is missing', 500);
  const requestedLanguage = parsed.data.lang ?? baseTemplate.language_code ?? 'en';

  let template = baseTemplate;
  if (requestedLanguage !== baseTemplate.language_code) {
    const { data: localizedTemplate, error: localizedTemplateError } = await supabase
      .from('journey_templates')
      .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version')
      .eq('slug', baseTemplate.slug)
      .eq('version', baseTemplate.version)
      .eq('is_published', true)
      .eq('language_code', requestedLanguage)
      .maybeSingle();

    if (localizedTemplateError) return fail('Could not load localized journey template', 500, localizedTemplateError.message);
    if (localizedTemplate) {
      template = localizedTemplate;
    } else {
      let sourceTemplate = baseTemplate;
      if (baseTemplate.language_code !== 'en') {
        const { data: englishTemplate, error: englishTemplateError } = await supabase
          .from('journey_templates')
          .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version')
          .eq('slug', baseTemplate.slug)
          .eq('version', baseTemplate.version)
          .eq('is_published', true)
          .eq('language_code', 'en')
          .maybeSingle();

        if (englishTemplateError) return fail('Could not load fallback journey template', 500, englishTemplateError.message);
        if (englishTemplate) {
          sourceTemplate = englishTemplate;
        }
      }

      if (sourceTemplate.language_code !== requestedLanguage) {
        try {
          const requestId = `journey_template_${requestedLanguage}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          const translated = await localizeJourneyTemplateWithAI({
            requestId,
            targetLanguage: requestedLanguage,
            sourceLanguage: sourceTemplate.language_code,
            title: sourceTemplate.title,
            subtitle: sourceTemplate.subtitle,
            description: sourceTemplate.description,
          });

          if (translated) {
            const translatedTemplate = {
              ...sourceTemplate,
              language_code: requestedLanguage,
              title: translated.title,
              subtitle: translated.subtitle,
              description: translated.description,
            };
            // Serve translated content immediately, even if cache write fails.
            template = translatedTemplate;

            const { data: cachedTemplate, error: cacheError } = await supabase
              .from('journey_templates')
              .upsert(
                {
                  slug: sourceTemplate.slug,
                  language_code: requestedLanguage,
                  title: translated.title,
                  subtitle: translated.subtitle,
                  description: translated.description,
                  theme_tags: sourceTemplate.theme_tags,
                  duration_days: sourceTemplate.duration_days,
                  is_premium: sourceTemplate.is_premium,
                  is_published: true,
                  version: sourceTemplate.version,
                },
                { onConflict: 'slug,language_code,version' },
              )
              .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version')
              .single();

            if (!cacheError && cachedTemplate) {
              template = cachedTemplate;
              console.info('[journey-localizer] template_cached', {
                requestId,
                language: requestedLanguage,
                slug: sourceTemplate.slug,
              });
            } else if (cacheError) {
              console.warn('[journey-localizer] template_cache_write_failed', {
                requestId,
                language: requestedLanguage,
                slug: sourceTemplate.slug,
                error: cacheError.message,
              });
            }
          }
        } catch (error) {
          console.error('[journey-localizer] template_localization_failed', {
            language: requestedLanguage,
            slug: sourceTemplate.slug,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (template.language_code !== requestedLanguage) {
        template = sourceTemplate;
      }
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const completedToday = journey.last_completed_on === today;
  const assignmentDay = completedToday ? Math.max(1, journey.current_day - 1) : journey.current_day;
  const nextAvailableDate = new Date();
  nextAvailableDate.setUTCDate(nextAvailableDate.getUTCDate() + 1);
  const nextAvailableOn = completedToday ? nextAvailableDate.toISOString().slice(0, 10) : null;

  const todaySteps = await getOrCreateDayAssignment(
    supabase,
    journey.id,
    journey.template_id,
    assignmentDay,
    requestedLanguage,
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
      display_day: assignmentDay,
      streak_count: journey.streak_count,
      best_streak: journey.best_streak,
      total_completed_days: journey.total_completed_days,
      consistency_score: journey.consistency_score,
      last_completed_on: journey.last_completed_on,
      completed_today: completedToday,
      can_complete_today: !completedToday,
      next_available_on: nextAvailableOn,
      start_date: journey.start_date,
      progress_percent: progressPercent,
    },
    template,
    today_steps: todaySteps,
    milestones: milestones ?? [],
  });
}
