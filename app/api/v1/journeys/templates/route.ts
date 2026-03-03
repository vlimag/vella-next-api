import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';

const querySchema = z.object({
  lang: localeSchema.optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const language = parsed.data.lang ?? 'en';
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('journey_templates')
    .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags')
    .eq('is_published', true)
    .eq('version', 1)
    .eq('language_code', language)
    .order('is_premium', { ascending: true })
    .order('duration_days', { ascending: true });

  if (error) return fail('Could not load journey templates', 500, error.message);
  if (data && data.length > 0) return ok(data);

  if (language !== 'en') {
    const { data: fallback, error: fallbackError } = await supabase
      .from('journey_templates')
      .select('id, slug, language_code, title, subtitle, description, duration_days, is_premium, theme_tags')
      .eq('is_published', true)
      .eq('version', 1)
      .eq('language_code', 'en')
      .order('is_premium', { ascending: true })
      .order('duration_days', { ascending: true });

    if (fallbackError) return fail('Could not load fallback journey templates', 500, fallbackError.message);
    return ok(fallback ?? []);
  }

  return ok(data ?? []);
}
