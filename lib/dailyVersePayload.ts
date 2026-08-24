export type DailyVerseLookupRow = {
  id: string;
  day: string;
  reflection_prompt: string | null;
  bible_verses: {
    chapter: number;
    verse: number;
    text_content: string;
    language_code: string;
    bible_books: { code: string };
    bible_versions: { code: string; name: string };
  };
};

export function toDailyVersePayload(row: DailyVerseLookupRow) {
  return {
    id: row.id,
    day: row.day,
    reflection_prompt: row.reflection_prompt,
    bible_verses: {
      chapter: row.bible_verses.chapter,
      verse: row.bible_verses.verse,
      text_content: row.bible_verses.text_content,
      language_code: row.bible_verses.language_code,
      bible_books: row.bible_verses.bible_books,
      bible_versions: row.bible_verses.bible_versions,
    },
  };
}
