import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isoDaySchema, localeSchema, parseQuery } from '@/lib/validation';
import { ensureDailyVersesForDay } from '@/lib/dailyVerse';

const FALLBACK_LANG = 'en';

const querySchema = z.object({
  lang: localeSchema.optional(),
  day: isoDaySchema,
});

type DailyVerseCacheLookupRow = {
  id: string;
  day: string;
  language_code: string;
  book_code: string;
  chapter: number;
  verse: number;
  text_content: string;
  reflection_prompt: string | null;
};

function toDailyVersePayload(row: DailyVerseCacheLookupRow) {
  return {
    id: row.id,
    day: row.day,
    reflection_prompt: row.reflection_prompt,
    bible_verses: {
      chapter: row.chapter,
      verse: row.verse,
      text_content: row.text_content,
      language_code: row.language_code,
      bible_books: { code: row.book_code },
    },
  };
}

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
  let cacheError: string | null = null;

  try {
    const ensureResult = await ensureDailyVersesForDay(supabase, day);
    if (ensureResult.generated > 0) {
      console.info('[daily-verse] cache_generated', { day, generated: ensureResult.generated, lang });
    }
  } catch (error) {
    cacheError = error instanceof Error ? error.message : String(error);
    console.error('[daily-verse] cache_prepare_failed', { day, lang, error: cacheError });
  }

  const selectColumns = 'id, day, language_code, book_code, chapter, verse, text_content, reflection_prompt';

  const { data, error } = await supabase
    .from('daily_verse_ai_cache')
    .select(selectColumns)
    .eq('language_code', lang)
    .eq('day', day)
    .maybeSingle();

  if (error) return fail('Failed to fetch daily verse', 500, error.message);

  if (!data && lang !== FALLBACK_LANG) {
    const { data: fallback, error: fallbackError } = await supabase
      .from('daily_verse_ai_cache')
      .select(selectColumns)
      .eq('language_code', FALLBACK_LANG)
      .eq('day', day)
      .maybeSingle();

    if (fallbackError) return fail('Fallback daily verse lookup failed', 500, fallbackError.message);
    const fallbackRow = fallback as DailyVerseCacheLookupRow | null;
    if (fallbackRow) {
      return ok(toDailyVersePayload(fallbackRow));
    }
  }

  if (!data && cacheError) return fail('Could not generate daily verse cache', 500, cacheError);
  if (!data) return fail('No daily verse found for this date', 404);
  const row = data as unknown as DailyVerseCacheLookupRow;
  return ok(toDailyVersePayload(row));
}
