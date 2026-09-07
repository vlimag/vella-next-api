import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';
import { resolveReadOnlyContentViewer } from '@/lib/subscriptionAccess';
import { recommendNextJourney } from '@/lib/rhythms/journeyRecommendations';

const querySchema = z.object({
  lang: localeSchema.optional(),
});

export async function GET(req: Request) {
  const access = await resolveReadOnlyContentViewer();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const language = parsed.data.lang ?? 'en';
  const supabase = createServiceClient();

  const completionResult = access.userId
    ? await supabase
        .from('user_journeys')
        .select('journey_templates!inner(slug)')
        .eq('user_id', access.userId)
        .eq('status', 'completed')
    : { data: [], error: null };
  const completed = new Set((completionResult.data ?? []).flatMap((row: Record<string, unknown>) => {
    const relation = Array.isArray(row.journey_templates) ? row.journey_templates[0] : row.journey_templates;
    return relation && typeof relation === 'object' && typeof (relation as { slug?: unknown }).slug === 'string'
      ? [(relation as { slug: string }).slug]
      : [];
  }));
  const recommendation = recommendNextJourney({ completed: [...completed], goals: [], locale: language });

  function decorate(rows: Record<string, unknown>[]) {
    const badgeBySlug: Record<string, string> = {
      'daily-faith-journey': 'journey_spark_7',
      steady_flame_14: 'journey_steady_flame_14',
      rooted_21: 'journey_rooted_21',
      pilgrim_40: 'journey_pilgrim_40',
    };
    return rows.map((row) => {
      const slug = typeof row.slug === 'string' ? row.slug : '';
      const duration = typeof row.duration_days === 'number' ? row.duration_days : null;
      const tags = Array.isArray(row.theme_tags) ? row.theme_tags : [];
      return {
        ...row,
        commitment_sessions: duration,
        estimated_session_minutes: duration === null ? null : 5,
        theme_key: typeof tags[0] === 'string' ? tags[0] : null,
        completion_state: completed.has(slug) ? 'completed' : 'available',
        badge_code: badgeBySlug[slug] ?? null,
        recommended: recommendation?.template_slug === slug,
        recommendation_reason_code: recommendation?.template_slug === slug ? recommendation.reason_code : null,
      };
    });
  }

  const { data, error } = await supabase
    .from('journey_templates')
    .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version')
    .eq('is_published', true)
    .eq('version', 1)
    .eq('language_code', language)
    .order('is_premium', { ascending: true })
    .order('duration_days', { ascending: true });

  if (error) return fail('Could not load journey templates', 500, error.message);
  if (data && data.length > 0) return ok(decorate(data));

  if (language !== 'en') {
    const { data: fallback, error: fallbackError } = await supabase
      .from('journey_templates')
      .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags, version')
      .eq('is_published', true)
      .eq('version', 1)
      .eq('language_code', 'en')
      .order('is_premium', { ascending: true })
      .order('duration_days', { ascending: true });

    if (fallbackError) return fail('Could not load fallback journey templates', 500, fallbackError.message);
    return ok(decorate(fallback ?? []));
  }

  return ok(decorate(data ?? []));
}
