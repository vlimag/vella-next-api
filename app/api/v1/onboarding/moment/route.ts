import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { resolveOnboardingMoment } from '@/lib/onboardingMoment';
import {
  PRAYER_MOMENT_LANGUAGES,
  PRAYER_MOMENT_REFERENCES,
  PRAYER_THEMES,
  type PrayerMomentLanguage,
  type PrayerMomentVerseRow,
} from '@/lib/prayerSpace';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const querySchema = z.object({
  theme: z.enum(PRAYER_THEMES),
  lang: z.enum(PRAYER_MOMENT_LANGUAGES),
}).strict();

const CONTENT_LOOKUP_ATTEMPTS = 2;

export async function GET(req: Request) {
  const parsed = parseQuery(querySchema, Object.fromEntries(new URL(req.url).searchParams.entries()));
  if ('error' in parsed) return parsed.error;

  const { theme, lang } = parsed.data;
  const reference = PRAYER_MOMENT_REFERENCES[theme];

  try {
    const supabase = createServiceClient();
    const moment = await resolveOnboardingMoment(
      theme,
      lang,
      async (language: PrayerMomentLanguage) => {
        for (let attempt = 1; attempt <= CONTENT_LOOKUP_ATTEMPTS; attempt += 1) {
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

          if (!error) return data as unknown as PrayerMomentVerseRow | null;
          if (attempt === CONTENT_LOOKUP_ATTEMPTS) throw error;
        }

        return null;
      },
    );

    if (!moment) {
      return fail('Approved first moment is unavailable', 404, { code: 'content_unavailable' });
    }

    return ok(moment, {
      headers: {
        'Cache-Control': 'public, s-maxage=604800, stale-while-revalidate=2592000',
      },
    });
  } catch {
    return fail('Could not load the first moment', 500, { code: 'content_lookup_failed' });
  }
}
