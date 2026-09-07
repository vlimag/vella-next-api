import { beforeEach, describe, expect, it, vi } from 'vitest';

type VerseRow = {
  id: string;
  chapter: number;
  verse: number;
  text_content: string;
  language_code: string;
  bible_books: { code: string };
  bible_versions: { code: string; name: string };
};

const mocks = vi.hoisted(() => ({
  client: null as unknown as { from: (table: string) => unknown },
  resolveReadOnlyContentViewer: vi.fn(async () => ({ userId: null, isAnonymous: true })),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mocks.client,
}));
vi.mock('@/lib/subscriptionAccess', () => ({
  resolveReadOnlyContentViewer: mocks.resolveReadOnlyContentViewer,
}));

import { GET } from '../app/api/v1/verses/search/route';

const LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'];

const DECEPTION_TEXT: Record<string, string> = {
  en: 'Every person is a liar.',
  pt: 'Todo homem é mentiroso.',
  es: 'Todo hombre es mentiroso.',
  fr: 'Tout homme est menteur.',
  de: 'Alle Menschen sind Lügner.',
  it: 'Ogni uomo è bugiardo.',
  ru: 'Всякий человек ложь.',
  pl: 'Każdy człowiek jest kłamcą.',
};

function verse(language: string, book: string, chapter: number, number: number, text: string): VerseRow {
  return {
    id: `${language}-${book}-${chapter}-${number}`,
    chapter,
    verse: number,
    text_content: text,
    language_code: language,
    bible_books: { code: book },
    bible_versions: { code: 'TEST', name: 'Test edition' },
  };
}

const CORPUS = LANGUAGES.flatMap((language) => [
  verse(language, 'MAT', 18, 22, 'canonical forgiveness verse'),
  verse(language, 'JHN', 18, 22, 'another verse with the same numbers'),
  verse(language, 'EPH', 4, 32, 'verses about forgiveness lexical result one'),
  verse(language, 'COL', 3, 13, 'verses about forgiveness lexical result two'),
  verse(language, 'PSA', 130, 4, 'verses about forgiveness lexical result three'),
  verse(language, 'PSA', 116, 11, DECEPTION_TEXT[language]),
  verse(language, 'PSA', 115, 2, DECEPTION_TEXT[language]),
  verse(language, 'PSA', 34, 13, 'Keep your tongue from evil and your lips from speaking lies.'),
  verse(language, 'PSA', 101, 7, 'No one who practices deceit will dwell in my house.'),
  verse(language, 'PRO', 12, 22, 'Lying lips are an abomination.'),
  verse(language, 'LUK', 24, 44, 'The law, the prophets, and the psalms mention this text.'),
]);

function searchClient(rows: VerseRow[]) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'bible_verses') throw new Error(`Unexpected table: ${table}`);

      const equalities: Array<[string, unknown]> = [];
      const patterns: Array<[string, string]> = [];
      let resultLimit = 50;
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn((column: string, expected: unknown) => {
        equalities.push([column, expected]);
        return query;
      });
      query.ilike = vi.fn((column: string, pattern: string) => {
        patterns.push([column, pattern]);
        return query;
      });
      query.limit = vi.fn((limit: number) => {
        resultLimit = limit;
        return query;
      });
      query.then = (
        resolve: (value: { data: VerseRow[]; error: null }) => unknown,
        reject?: (error: unknown) => unknown,
      ) => {
        const filtered = rows.filter((row) => {
          const equalityMatches = equalities.every(([column, expected]) => {
            if (column === 'bible_books.code') return row.bible_books.code === expected;
            return row[column as keyof VerseRow] === expected;
          });
          const patternMatches = patterns.every(([column, pattern]) => {
            const needle = pattern.replaceAll('%', '').toLocaleLowerCase();
            return String(row[column as keyof VerseRow]).toLocaleLowerCase().includes(needle);
          });
          return equalityMatches && patternMatches;
        }).slice(0, resultLimit);

        return Promise.resolve({ data: filtered, error: null }).then(resolve, reject);
      };
      return query;
    }),
  };
}

async function search(query: string, language: string) {
  const url = new URL('https://vella.one/api/v1/verses/search');
  url.searchParams.set('q', query);
  url.searchParams.set('lang', language);
  url.searchParams.set('limit', '10');
  const response = await GET(new Request(url));
  return { response, body: await response.json() };
}

describe('GET /api/v1/verses/search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client = searchClient(CORPUS);
  });

  it.each([
    ['en', 'Matthew 18:22'],
    ['pt', 'Mateus 18:22'],
    ['pt', 'Matheus 18:22'],
    ['es', 'Mateo 18:22'],
    ['fr', 'Matthieu 18:22'],
    ['de', 'Matthäus 18:22'],
    ['it', 'Matteo 18:22'],
    ['ru', 'Матфея 18:22'],
    ['pl', 'Mateusza 18:22'],
  ])('resolves a localized Matthew reference in %s', async (language, query) => {
    const { response, body } = await search(query, language);

    expect(response.status).toBe(200);
    expect(body.data.strategy).toBe('reference');
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0]).toMatchObject({
      chapter: 18,
      verse: 22,
      bible_books: { code: 'MAT' },
    });
  });

  it('does not turn an unknown book name into matches from every book', async () => {
    const { response, body } = await search('Unknownbook 18:22', 'en');

    expect(response.status).toBe(200);
    expect(body.data.strategy).not.toBe('reference');
    expect(body.data.items).toEqual([]);
  });

  it('prioritizes canonical forgiveness verses ahead of broad lexical matches', async () => {
    const { response, body } = await search('verses about forgiveness', 'en');

    expect(response.status).toBe(200);
    expect(body.data.strategy).toBe('intent');
    expect(body.data.intent).toBe('forgiveness');
    expect(body.data.items[0]).toMatchObject({
      chapter: 18,
      verse: 22,
      bible_books: { code: 'MAT' },
    });
  });

  it.each([
    ['en', 'psalms about liars', 116, 11],
    ['pt', 'salmos sobre pessoas mentirosas', 116, 11],
    ['es', 'salmos sobre personas mentirosas', 116, 11],
    ['fr', 'psaumes sur les menteurs', 116, 11],
    ['de', 'Psalmen über Lügner', 116, 11],
    ['it', 'salmi sulle persone bugiarde', 116, 11],
    ['ru', 'псалмы о лжецах', 115, 2],
    ['pl', 'psalmy o kłamcach', 116, 11],
  ])('prioritizes the canonical Psalm and keeps book scope in %s', async (
    language,
    query,
    expectedChapter,
    expectedVerse,
  ) => {
    const { response, body } = await search(query, language);

    expect(response.status).toBe(200);
    expect(body.data.strategy).toBe('intent');
    expect(body.data.intent).toBe('deception');
    expect(body.data.items[0]).toMatchObject({
      chapter: expectedChapter,
      verse: expectedVerse,
      bible_books: { code: 'PSA' },
    });
    expect(body.data.items.every((item: VerseRow) => item.bible_books.code === 'PSA')).toBe(true);
  });
});
