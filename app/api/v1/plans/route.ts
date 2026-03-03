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

  const lang = parsed.data.lang ?? 'en';

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('reading_plans')
    .select('id, slug, title, description, language_code, duration_days, is_premium')
    .eq('language_code', lang)
    .eq('is_published', true)
    .order('duration_days', { ascending: true });

  if (error) return fail('Could not load plans', 500, error.message);
  if (data && data.length > 0) return ok(data);

  if (lang !== 'en') {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('reading_plans')
      .select('id, slug, title, description, language_code, duration_days, is_premium')
      .eq('language_code', 'en')
      .eq('is_published', true)
      .order('duration_days', { ascending: true });
    if (fallbackError) return fail('Could not load fallback plans', 500, fallbackError.message);
    return ok(fallbackData ?? []);
  }

  return ok(data ?? []);
}
