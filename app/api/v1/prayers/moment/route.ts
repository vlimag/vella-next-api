import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import {
  normalizePrayerMomentScripture,
  PRAYER_MOMENT_LANGUAGES,
  PRAYER_MOMENT_REFERENCES,
  PRAYER_THEMES,
  prayerMomentGuidance,
  resolvePrayerMomentVerse,
  type PrayerMomentLanguage,
  type PrayerMomentVerseRow,
} from '@/lib/prayerSpace';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const querySchema = z.object({
  theme: z.enum(PRAYER_THEMES).default('hope'),
  lang: z.enum(PRAYER_MOMENT_LANGUAGES).default('en'),
}).strict();

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    theme: searchParams.get('theme') ?? undefined,
    lang: searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const theme = parsed.data.theme ?? 'hope';
  const lang = parsed.data.lang ?? 'en';
  const reference = PRAYER_MOMENT_REFERENCES[theme];
  const supabase = createServiceClient();

  let verseRow: PrayerMomentVerseRow | null;
  try {
    verseRow = await resolvePrayerMomentVerse(
      lang,
      async (language: PrayerMomentLanguage) => {
        const { data, error } = await supabase
          .from('bible_verses')
          .select(
            'id, text_content, language_code, chapter, verse, bible_books!inner(code), bible_versions!inner(code, name, is_active)',
          )
          .eq('language_code', language)
          .eq('chapter', reference.chapter)
          .eq('verse', reference.verse)
          .eq('bible_books.code', reference.book)
          .eq('bible_versions.is_active', true)
          .order('id', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (error) throw new Error(error.message);
        return data as unknown as PrayerMomentVerseRow | null;
      },
    );
  } catch (error) {
    return fail(
      'Could not load approved Scripture for this prayer moment',
      500,
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!verseRow) {
    return fail('Approved Scripture is unavailable for this prayer moment', 404, { theme, reference });
  }

  const scripture = normalizePrayerMomentScripture(verseRow, lang);
  if (!scripture) {
    return fail('Approved Scripture is unavailable for this prayer moment', 404, { theme, reference });
  }

  return ok({
    theme,
    requested_language: lang,
    scripture_language: scripture.language_code,
    scripture_fallback: scripture.language_code !== lang,
    content: prayerMomentGuidance(theme, lang),
    scripture: {
      id: scripture.id,
      text_content: scripture.text_content,
      chapter: scripture.chapter,
      verse: scripture.verse,
      language_code: scripture.language_code,
      bible_books: scripture.bible_books,
      bible_versions: scripture.bible_versions,
    },
  });
}
