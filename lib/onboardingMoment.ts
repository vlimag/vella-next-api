import {
  normalizePrayerMomentScripture,
  PRAYER_MOMENT_REFERENCES,
  prayerMomentGuidance,
  resolvePrayerMomentVerse,
  type PrayerMomentLanguage,
  type PrayerMomentVerseRow,
  type PrayerTheme,
} from '@/lib/prayerSpace';

export type OnboardingMomentPayload = {
  theme: PrayerTheme;
  requested_language: PrayerMomentLanguage;
  scripture_language: PrayerMomentLanguage;
  scripture_fallback: boolean;
  content: ReturnType<typeof prayerMomentGuidance>;
  scripture: {
    id: string;
    text_content: string;
    chapter: number;
    verse: number;
    language_code: PrayerMomentLanguage;
    bible_books: { code: string };
    bible_versions: { code: string; name: string };
  };
};

export async function resolveOnboardingMoment(
  theme: PrayerTheme,
  language: PrayerMomentLanguage,
  lookup: (language: PrayerMomentLanguage) => Promise<PrayerMomentVerseRow | null>,
): Promise<OnboardingMomentPayload | null> {
  const verseRow = await resolvePrayerMomentVerse(language, lookup);
  if (!verseRow) return null;

  const scripture = normalizePrayerMomentScripture(verseRow, language);
  if (!scripture) return null;

  const reference = PRAYER_MOMENT_REFERENCES[theme];
  if (
    scripture.bible_books.code !== reference.book
    || scripture.chapter !== reference.chapter
    || scripture.verse !== reference.verse
  ) {
    return null;
  }

  return {
    theme,
    requested_language: language,
    scripture_language: scripture.language_code,
    scripture_fallback: scripture.fallback_language !== null,
    content: prayerMomentGuidance(theme, language),
    scripture: {
      id: scripture.id,
      text_content: scripture.text_content,
      chapter: scripture.chapter,
      verse: scripture.verse,
      language_code: scripture.language_code,
      bible_books: scripture.bible_books,
      bible_versions: scripture.bible_versions,
    },
  };
}
