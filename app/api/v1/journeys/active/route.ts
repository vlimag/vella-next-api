import { ok, fail } from '@/lib/http';
import { authenticatedJourneyActor } from '@/lib/actor';
import { createServiceClient } from '@/lib/supabase';
import { getOrCreateDayAssignment } from '@/lib/journeys';
import { isMissingJourneyThemePreference } from '@/lib/journeyCompatibility';
import { localizeJourneyTemplateWithAI } from '@/lib/aiLocalizer';
import { localeSchema, parseQuery } from '@/lib/validation';
import { z } from 'zod';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { localDateKey, normalizeTimeZone } from '@/lib/rhythms/time';

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
  theme_preference: string | null;
  timezone_name: string | null;
  completed_at: string | null;
  paused_at: string | null;
  last_resumed_at: string | null;
  source: string | null;
  completion_version: number | null;
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

const ACTIVE_JOURNEY_FIELDS =
  'id, user_id, anonymous_profile_id, template_id, status, current_day, streak_count, best_streak, total_completed_days, consistency_score, last_completed_on, start_date, timezone_name, completed_at, paused_at, last_resumed_at, source, completion_version';
const ACTIVE_JOURNEY_TEMPLATE =
  'journey_templates!inner(id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version)';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function nextLocalDate(localDay: string) {
  const date = new Date(`${localDay}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function finiteTimestamp(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)) ? value : null;
}

function finiteSource(value: unknown): 'legacy' | 'onboarding' | 'recommendation' | 'browse' | null {
  return value === 'legacy' || value === 'onboarding' || value === 'recommendation' || value === 'browse' ? value : null;
}

function finiteVersion(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000 ? value : null;
}

async function getActiveJourney(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return noStore(parsed.error);

  const actor = authenticatedJourneyActor(access.userId);
  const supabase = createServiceClient();

  const loadActiveJourney = async (includeThemePreference: boolean) => {
    const fields = includeThemePreference
      ? `${ACTIVE_JOURNEY_FIELDS}, theme_preference, ${ACTIVE_JOURNEY_TEMPLATE}`
      : `${ACTIVE_JOURNEY_FIELDS}, ${ACTIVE_JOURNEY_TEMPLATE}`;
    let query = supabase
      .from('user_journeys')
      .select(fields)
      .eq('status', 'active')
      .order('updated_at', { ascending: false })
      .limit(1);

    if (actor.kind === 'user') {
      query = query.eq('user_id', actor.userId);
    } else {
      query = query.eq('anonymous_profile_id', actor.anonymousProfileId);
    }

    return query.maybeSingle();
  };

  let { data, error } = await loadActiveJourney(true);
  if (isMissingJourneyThemePreference(error)) {
    console.warn('[journeys] theme_preference_missing_using_default', { route: 'active' });
    ({ data, error } = await loadActiveJourney(false));
  }
  if (error) return noStore(fail('Could not load active journey', 500, { code: 'journey_unavailable' }));
  if (!data) return noStore(ok(null));

  const journey = data as unknown as ActiveJourneyRow;
  const baseTemplate = Array.isArray(journey.journey_templates) ? journey.journey_templates[0] : journey.journey_templates;
  if (!baseTemplate) return noStore(fail('Journey template data is missing', 500));
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

    if (localizedTemplateError) return noStore(fail('Could not load localized journey template', 500, { code: 'journey_unavailable' }));
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

        if (englishTemplateError) return noStore(fail('Could not load fallback journey template', 500, { code: 'journey_unavailable' }));
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
                code: 'cache_write_failed',
              });
            }
          }
        } catch (error) {
          console.error('[journey-localizer] template_localization_failed', {
            language: requestedLanguage,
            slug: sourceTemplate.slug,
            code: 'localization_failed',
          });
        }
      }

      if (template.language_code !== requestedLanguage) {
        template = sourceTemplate;
      }
    }
  }

  const timezoneName = normalizeTimeZone(journey.timezone_name);
  const today = localDateKey(new Date(), timezoneName);
  const completedToday = journey.last_completed_on === today;
  const assignmentDay = completedToday ? Math.max(1, journey.current_day - 1) : journey.current_day;
  const nextAvailableOn = completedToday ? nextLocalDate(today) : null;

  const todaySteps = await getOrCreateDayAssignment(
    supabase,
    journey.id,
    journey.template_id,
    assignmentDay,
    requestedLanguage,
    journey.theme_preference ?? null,
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
  if (milestonesError) return noStore(fail('Could not load milestones', 500, { code: 'journey_unavailable' }));

  const duration = template.duration_days || 1;
  const progressPercent = Math.min(100, Number(((journey.total_completed_days / duration) * 100).toFixed(2)));

  const continuity = {
    completed_at: finiteTimestamp(journey.completed_at),
    paused_at: finiteTimestamp(journey.paused_at),
    last_resumed_at: finiteTimestamp(journey.last_resumed_at),
    source: finiteSource(journey.source),
    completion_version: finiteVersion(journey.completion_version),
  };
  return noStore(ok({
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
      timezone_name: timezoneName,
      ...(continuity.completed_at ? { completed_at: continuity.completed_at } : {}),
      ...(continuity.paused_at ? { paused_at: continuity.paused_at } : {}),
      ...(continuity.last_resumed_at ? { last_resumed_at: continuity.last_resumed_at } : {}),
      ...(continuity.source ? { source: continuity.source } : {}),
      ...(continuity.completion_version !== null ? { completion_version: continuity.completion_version } : {}),
    },
    template,
    today_steps: todaySteps,
    milestones: milestones ?? [],
  }));
}

export async function GET(req: Request) {
  try {
    return await getActiveJourney(req);
  } catch {
    console.error('[journeys-active]', { route: 'journey_active', stage: 'query', code: 'database_unavailable' });
    return noStore(fail('Could not load active journey', 500, { code: 'journey_unavailable' }));
  }
}
