import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isoDaySchema, localeSchema, parseQuery } from '@/lib/validation';

const FALLBACK_LANG = 'en';

const querySchema = z.object({
  lang: localeSchema.optional(),
  day: isoDaySchema,
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
    day: searchParams.get('day') ?? undefined,
  });

  if ('error' in parsed) return parsed.error;

  const lang = parsed.data.lang ?? FALLBACK_LANG;
  const day = parsed.data.day ?? new Date().toISOString().slice(0, 10);

  const supabase = createServiceClient();

  const selectColumns = `
    id,
    day,
    reflection_prompt,
    bible_verses!inner(
      chapter,
      verse,
      text_content,
      language_code,
      bible_books!inner(code)
    )
  `;

  const { data, error } = await supabase
    .from('daily_verses')
    .select(selectColumns)
    .eq('language_code', lang)
    .eq('day', day)
    .maybeSingle();

  if (error) return fail('Failed to fetch daily verse', 500, error.message);

  if (!data && lang !== FALLBACK_LANG) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('daily_verses')
      .select(selectColumns)
      .eq('language_code', FALLBACK_LANG)
      .eq('day', day)
      .maybeSingle();

    if (fallbackError) return fail('Fallback daily verse lookup failed', 500, fallbackError.message);
    if (fallback) return ok(fallback);
  }

  if (!data) return fail('No daily verse found for this date', 404);
  return ok(data);
}
