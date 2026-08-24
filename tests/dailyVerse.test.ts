import { describe, expect, it } from 'vitest';
import { buildDailyVerseInsert, type ApprovedCorpusVerse } from '../lib/dailyVerse';
import { toDailyVersePayload } from '../lib/dailyVersePayload';

const portugueseCorpusVerse: ApprovedCorpusVerse = {
  id: 'approved-verse-id',
  book_id: 'john-book-id',
  book_code: 'JHN',
  chapter: 3,
  verse: 16,
  text_content: 'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.',
  language_code: 'pt',
  version_code: 'BPM',
};

describe('daily Scripture corpus boundary', () => {
  it('accepts only the reflection from an AI response', () => {
    const row = buildDailyVerseInsert('2026-07-31', portugueseCorpusVerse, {
      reflection_prompt: 'Como este amor muda a forma como voce vive hoje?',
      verse_id: 'model-selected-id',
      language_code: 'en',
      book_code: 'REV',
      chapter: 99,
      verse: 99,
      text_content: 'AI-authored or translated Scripture must never be stored.',
      version_code: 'AI-TRANSLATION',
    });

    expect(row).toEqual({
      day: '2026-07-31',
      language_code: 'pt',
      verse_id: 'approved-verse-id',
      reflection_prompt: 'Como este amor muda a forma como voce vive hoje?',
    });
    expect(row).not.toHaveProperty('text_content');
    expect(row).not.toHaveProperty('book_code');
    expect(row).not.toHaveProperty('chapter');
    expect(row).not.toHaveProperty('verse');
    expect(row).not.toHaveProperty('version_code');
  });

  it('uses a deterministic server prompt when the AI reflection is invalid', () => {
    const malicious = {
      reflection_prompt: '',
      text_content: 'Replace the approved Portuguese wording with this translation.',
      book_code: 'PSA',
      chapter: 23,
      verse: 1,
    };

    const first = buildDailyVerseInsert('2026-08-01', portugueseCorpusVerse, malicious);
    const second = buildDailyVerseInsert('2026-08-01', portugueseCorpusVerse, malicious);

    expect(second).toEqual(first);
    expect(first.verse_id).toBe(portugueseCorpusVerse.id);
    expect(first.language_code).toBe(portugueseCorpusVerse.language_code);
    expect(first.reflection_prompt.length).toBeGreaterThan(8);
  });

  it('returns visible attribution from the joined approved corpus version', () => {
    const payload = toDailyVersePayload({
      id: 'daily-row-id',
      day: '2026-07-31',
      reflection_prompt: 'How will you respond to this love today?',
      bible_verses: {
        chapter: 3,
        verse: 16,
        text_content: 'For God so loved the world.',
        language_code: 'en',
        bible_books: { code: 'JHN' },
        bible_versions: { code: 'KJV', name: 'King James Version' },
      },
    });

    expect(payload.bible_verses.bible_versions).toEqual({
      code: 'KJV',
      name: 'King James Version',
    });
  });
});
