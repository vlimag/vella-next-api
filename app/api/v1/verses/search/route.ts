import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';
import { resolveReadOnlyContentViewer } from '@/lib/subscriptionAccess';
import {
  detectSearchLanguage,
  fallbackTermsFromQuery,
  normalizeSearchText,
  referencesForIntent,
  resolveSearchIntent,
} from '@/lib/verseSearchTerms';

const querySchema = z.object({
  q: z.string().trim().min(2).max(80),
  lang: localeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const SELECT_COLUMNS =
  'id, chapter, verse, text_content, language_code, bible_books!inner(code), bible_versions!inner(code, name)';

type VerseRow = {
  id: string;
  chapter: number;
  verse: number;
  text_content: string;
  language_code: string;
  bible_books: { code: string } | Array<{ code: string }>;
  bible_versions: { code: string; name: string } | Array<{ code: string; name: string }>;
};

const BOOK_ALIASES: Record<string, Record<string, string>> = {
  en: {
    genesis: 'GEN', gen: 'GEN',
    exodus: 'EXO', exo: 'EXO',
    leviticus: 'LEV', lev: 'LEV',
    numbers: 'NUM', num: 'NUM',
    deuteronomy: 'DEU', deut: 'DEU',
    joshua: 'JOS', josh: 'JOS',
    judges: 'JDG', judg: 'JDG',
    ruth: 'RUT',
    '1 samuel': '1SA', '1sa': '1SA',
    '2 samuel': '2SA', '2sa': '2SA',
    '1 kings': '1KI', '1ki': '1KI',
    '2 kings': '2KI', '2ki': '2KI',
    '1 chronicles': '1CH', '1ch': '1CH',
    '2 chronicles': '2CH', '2ch': '2CH',
    ezra: 'EZR', nehemiah: 'NEH', neh: 'NEH', esther: 'EST', job: 'JOB',
    john: 'JHN',
    jn: 'JHN',
    psalm: 'PSA',
    psalms: 'PSA',
    ps: 'PSA',
    proverbs: 'PRO', prov: 'PRO',
    ecclesiastes: 'ECC', eccl: 'ECC',
    'song of solomon': 'SNG', song: 'SNG',
    isaiah: 'ISA', isa: 'ISA',
    jeremiah: 'JER', jer: 'JER',
    lamentations: 'LAM', lam: 'LAM',
    ezekiel: 'EZK', ezek: 'EZK',
    daniel: 'DAN', dan: 'DAN',
    hosea: 'HOS', joel: 'JOL', amos: 'AMO', obadiah: 'OBA', obad: 'OBA',
    jonah: 'JON', micah: 'MIC', nahum: 'NAM', habakkuk: 'HAB', hab: 'HAB',
    zephaniah: 'ZEP', zeph: 'ZEP', haggai: 'HAG', hag: 'HAG',
    zechariah: 'ZEC', zech: 'ZEC', malachi: 'MAL', mal: 'MAL',
    matthew: 'MAT', matt: 'MAT', mark: 'MRK', mrk: 'MRK', luke: 'LUK',
    acts: 'ACT', romans: 'ROM', rom: 'ROM',
    '1 corinthians': '1CO', '1co': '1CO',
    '2 corinthians': '2CO', '2co': '2CO',
    galatians: 'GAL', gal: 'GAL', ephesians: 'EPH', eph: 'EPH',
    philippians: 'PHP', phil: 'PHP', colossians: 'COL', col: 'COL',
    '1 thessalonians': '1TH', '1th': '1TH',
    '2 thessalonians': '2TH', '2th': '2TH',
    '1 timothy': '1TI', '1ti': '1TI',
    '2 timothy': '2TI', '2ti': '2TI',
    titus: 'TIT', philemon: 'PHM', phlm: 'PHM',
    hebrews: 'HEB', heb: 'HEB', james: 'JAS', jas: 'JAS',
    '1 peter': '1PE', '1pe': '1PE', '2 peter': '2PE', '2pe': '2PE',
    '1 john': '1JN', '1jn': '1JN', '2 john': '2JN', '2jn': '2JN', '3 john': '3JN', '3jn': '3JN',
    jude: 'JUD', revelation: 'REV', rev: 'REV',
  },
  pt: {
    mateus: 'MAT',
    matheus: 'MAT',
    mt: 'MAT',
    joao: 'JHN',
    jo: 'JHN',
    salmo: 'PSA',
    salmos: 'PSA',
    sl: 'PSA',
  },
  es: {
    mateo: 'MAT',
    mt: 'MAT',
    juan: 'JHN',
    jn: 'JHN',
    salmo: 'PSA',
    salmos: 'PSA',
    sal: 'PSA',
  },
  fr: {
    matthieu: 'MAT',
    mt: 'MAT',
    jean: 'JHN',
    jn: 'JHN',
    psaume: 'PSA',
    psaumes: 'PSA',
    ps: 'PSA',
  },
  de: {
    matthaus: 'MAT',
    mt: 'MAT',
    johannes: 'JHN',
    joh: 'JHN',
    psalm: 'PSA',
    psalmen: 'PSA',
    ps: 'PSA',
  },
  it: {
    matteo: 'MAT',
    mt: 'MAT',
    giovanni: 'JHN',
    gv: 'JHN',
    salmo: 'PSA',
    salmi: 'PSA',
    sal: 'PSA',
  },
  ru: {
    'матфей': 'MAT',
    'матфея': 'MAT',
    'мф': 'MAT',
    ioann: 'JHN',
    ioan: 'JHN',
    'псалом': 'PSA',
    'псалмы': 'PSA',
    'пс': 'PSA',
    psalom: 'PSA',
    psalmy: 'PSA',
    ps: 'PSA',
  },
  pl: {
    mateusz: 'MAT',
    mateusza: 'MAT',
    mt: 'MAT',
    jan: 'JHN',
    j: 'JHN',
    psalm: 'PSA',
    psalmy: 'PSA',
    ps: 'PSA',
  },
};

const BOOK_SCOPE_CONNECTORS: Record<string, string[]> = {
  en: ['about', 'on'],
  pt: ['sobre'],
  es: ['sobre'],
  fr: ['sur'],
  de: ['uber'],
  it: ['su', 'sul', 'sulla', 'sulle', 'sui', 'sugli'],
  ru: ['о', 'об', 'про'],
  pl: ['o'],
};

function normalizeForLookup(value: string) {
  return normalizeSearchText(value);
}

function parseBookScope(query: string, lang: string) {
  const normalized = normalizeForLookup(query);
  const aliases = Object.entries({ ...BOOK_ALIASES.en, ...(BOOK_ALIASES[lang] ?? {}) })
    .map(([alias, bookCode]) => [normalizeForLookup(alias), bookCode] as const)
    .sort(([left], [right]) => right.length - left.length);

  for (const [alias, bookCode] of aliases) {
    if (normalized !== alias && !normalized.startsWith(`${alias} `)) continue;

    let semanticQuery = normalized.slice(alias.length).trim();
    for (const connector of BOOK_SCOPE_CONNECTORS[lang] ?? BOOK_SCOPE_CONNECTORS.en) {
      const normalizedConnector = normalizeForLookup(connector);
      if (semanticQuery === normalizedConnector) {
        semanticQuery = '';
        break;
      }
      if (semanticQuery.startsWith(`${normalizedConnector} `)) {
        semanticQuery = semanticQuery.slice(normalizedConnector.length).trim();
        break;
      }
    }

    return { bookCode, semanticQuery: semanticQuery || query };
  }

  return { bookCode: undefined, semanticQuery: query };
}

function uniqueById(items: VerseRow[]) {
  const seen = new Set<string>();
  const result: VerseRow[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function parseReferenceQuery(query: string, lang: string) {
  const match = query
    .trim()
    .match(/^(?:(?<book>[\p{L}0-9.\s]+?)\s+)?(?<chapter>\d{1,3})\s*[:.]\s*(?<verse>\d{1,3})$/iu);

  if (!match?.groups?.chapter || !match.groups.verse) {
    return null;
  }

  const chapter = Number(match.groups.chapter);
  const verse = Number(match.groups.verse);
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) {
    return null;
  }

  const normalizedBook = normalizeForLookup(match.groups.book ?? '');
  const bookCode = normalizedBook ? BOOK_ALIASES[lang]?.[normalizedBook] ?? BOOK_ALIASES.en[normalizedBook] : undefined;

  if (normalizedBook && !bookCode) {
    return null;
  }

  return {
    chapter,
    verse,
    bookCode,
  };
}

async function queryLexical(lang: string, term: string, limit: number, bookCode?: string) {
  const supabase = createServiceClient();
  const qb = supabase
    .from('bible_verses')
    .select(SELECT_COLUMNS)
    .eq('language_code', lang)
    .ilike('text_content', `%${term}%`)
    .limit(limit);

  const { data, error } = bookCode ? await qb.eq('bible_books.code', bookCode) : await qb;

  if (error) {
    return { error, data: [] as VerseRow[] };
  }

  return { data: (data as VerseRow[]) ?? [] };
}

async function queryByReference(lang: string, chapter: number, verse: number, bookCode?: string, limit = 8) {
  const supabase = createServiceClient();
  const qb = supabase
    .from('bible_verses')
    .select(SELECT_COLUMNS)
    .eq('language_code', lang)
    .eq('chapter', chapter)
    .eq('verse', verse)
    .limit(limit);

  const { data, error } = bookCode ? await qb.eq('bible_books.code', bookCode) : await qb;
  if (error) {
    return { error, data: [] as VerseRow[] };
  }
  return { data: (data as VerseRow[]) ?? [] };
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function buildRequestId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function logSearch(requestId: string, stage: string, details?: Record<string, unknown>) {
  console.info(`[verse-search][${requestId}] ${stage}`, details ?? {});
}

async function expandQueryWithAI(query: string, lang: string, requestId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logSearch(requestId, 'ai_skipped_missing_api_key');
    return { terms: fallbackTermsFromQuery(query, lang), provider: 'fallback' as const };
  }

  const languageNames: Record<string, string> = {
    en: 'English',
    pt: 'Portuguese',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    ru: 'Russian',
    pl: 'Polish',
  };

  try {
    logSearch(requestId, 'ai_expand_started', { model: process.env.OPENAI_MODEL ?? 'gpt-5.6' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-5.6',
        messages: [
          {
            role: 'system',
            content:
              'You expand Bible search intents. Return ONLY strict JSON with shape {"terms": string[]}. Include up to 8 terms and no markdown.',
          },
          {
            role: 'user',
            content: `User query: "${query}". App language: ${languageNames[lang] ?? 'English'}. Return concise scripture-friendly expansion terms in this app language and English when useful.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logSearch(requestId, 'ai_expand_failed_status', { status: response.status, body: errorText.slice(0, 400) });
      return { terms: fallbackTermsFromQuery(query, lang), provider: 'fallback' as const };
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content ?? '';
    const parsed = JSON.parse(content) as { terms?: unknown };
    const terms = Array.isArray(parsed.terms) ? parsed.terms.filter((term): term is string => typeof term === 'string') : [];
    logSearch(requestId, 'ai_expand_succeeded', { term_count: terms.length });
    const mergedTerms = uniqueStrings([query, ...fallbackTermsFromQuery(query, lang), ...terms]).slice(0, 24);
    logSearch(requestId, 'ai_expand_terms', { terms: mergedTerms });
    return {
      terms: mergedTerms,
      provider: 'openai' as const,
    };
  } catch (error) {
    logSearch(requestId, 'ai_expand_exception', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { terms: fallbackTermsFromQuery(query, lang), provider: 'fallback' as const };
  }
}

export async function GET(req: Request) {
  const access = await resolveReadOnlyContentViewer();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    q: searchParams.get('q') ?? '',
    lang: searchParams.get('lang') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if ('error' in parsed) return parsed.error;

  const requestId = req.headers.get('x-request-id') ?? buildRequestId();
  const limit = parsed.data.limit ?? 30;
  const query = parsed.data.q.trim();
  const requestedLang = parsed.data.lang ?? 'en';
  const lang = detectSearchLanguage(query, requestedLang);
  logSearch(requestId, 'request_received', { query, lang, requested_lang: requestedLang, limit });

  const reference = parseReferenceQuery(query, lang);
  if (reference) {
    logSearch(requestId, 'reference_detected', {
      chapter: reference.chapter,
      verse: reference.verse,
      book_code: reference.bookCode ?? null,
    });
    const { data, error } = await queryByReference(lang, reference.chapter, reference.verse, reference.bookCode, limit);
    if (error) {
      logSearch(requestId, 'reference_query_failed', { error: error.message });
      return fail('Verse reference search failed', 500, error.message);
    }
    logSearch(requestId, 'reference_query_done', { count: data.length, language: lang });

    if (data.length > 0) {
      return ok({ query, count: data.length, items: data, strategy: 'reference' as const, request_id: requestId });
    }

    if (lang !== 'en') {
      const fallbackReference = await queryByReference('en', reference.chapter, reference.verse, reference.bookCode, limit);
      if (fallbackReference.error) {
        logSearch(requestId, 'reference_fallback_failed', { error: fallbackReference.error.message });
        return fail('Verse reference fallback failed', 500, fallbackReference.error.message);
      }
      logSearch(requestId, 'reference_fallback_done', { count: fallbackReference.data.length, fallback_language: 'en' });
      if (fallbackReference.data.length > 0) {
        return ok({
          query,
          count: fallbackReference.data.length,
          items: fallbackReference.data,
          strategy: 'reference' as const,
          fallback_language: 'en',
          request_id: requestId,
        });
      }
    }
  }

  const scope = parseBookScope(query, lang);
  if (scope.bookCode) {
    logSearch(requestId, 'book_scope_detected', { book_code: scope.bookCode });
  }

  const lexical = await queryLexical(lang, scope.semanticQuery, limit, scope.bookCode);
  if (lexical.error) {
    logSearch(requestId, 'lexical_query_failed', { error: lexical.error.message });
    return fail('Verse search failed', 500, lexical.error.message);
  }
  logSearch(requestId, 'lexical_query_done', { count: lexical.data.length, language: lang });
  const intent = resolveSearchIntent(scope.semanticQuery);
  if (!intent && lexical.data.length >= Math.min(3, limit)) {
    return ok({ query, count: lexical.data.length, items: lexical.data, strategy: 'lexical' as const, request_id: requestId });
  }

  if (intent) {
    logSearch(requestId, 'intent_detected', { intent });
    const scopedReferences = referencesForIntent(intent, lang)
      .filter((reference) => !scope.bookCode || reference.bookCode === scope.bookCode);
    const intentReferenceResults = await Promise.all(
      scopedReferences.map((reference) =>
        queryByReference(lang, reference.chapter, reference.verse, reference.bookCode, 2),
      ),
    );
    let deterministicResults = uniqueById([
      ...intentReferenceResults.flatMap((result) => result.data),
      ...lexical.data,
    ]).slice(0, limit);
    let intentFallbackLanguage: string | null = null;

    if (deterministicResults.length === 0 && lang !== 'en') {
      intentFallbackLanguage = 'en';
      const englishScopedReferences = referencesForIntent(intent, 'en')
        .filter((reference) => !scope.bookCode || reference.bookCode === scope.bookCode);
      const englishReferenceResults = await Promise.all(
        englishScopedReferences.map((reference) =>
          queryByReference('en', reference.chapter, reference.verse, reference.bookCode, 2),
        ),
      );
      deterministicResults = uniqueById(englishReferenceResults.flatMap((result) => result.data)).slice(0, limit);
    }

    if (deterministicResults.length > 0) {
      logSearch(requestId, 'intent_query_done', { intent, count: deterministicResults.length });
      return ok({
        query,
        count: deterministicResults.length,
        items: deterministicResults,
        strategy: 'intent' as const,
        intent,
        fallback_language: intentFallbackLanguage ?? undefined,
        request_id: requestId,
      });
    }
  }

  const expanded = await expandQueryWithAI(scope.semanticQuery, lang, requestId);
  logSearch(requestId, 'ai_terms_ready', { provider: expanded.provider, term_count: expanded.terms.length });
  const aiResults: VerseRow[] = [...lexical.data];

  for (const term of expanded.terms) {
    if (aiResults.length >= limit) break;
    const partial = await queryLexical(lang, term, Math.max(5, limit - aiResults.length), scope.bookCode);
    if (partial.error) continue;
    aiResults.push(...partial.data);
  }

  let deduped = uniqueById(aiResults).slice(0, limit);
  let fallbackLanguage: string | null = null;

  if (deduped.length === 0 && lang !== 'en') {
    fallbackLanguage = 'en';
    for (const term of expanded.terms) {
      if (deduped.length >= limit) break;
      const partial = await queryLexical('en', term, Math.max(5, limit - deduped.length), scope.bookCode);
      if (partial.error) continue;
      deduped = uniqueById([...deduped, ...partial.data]).slice(0, limit);
    }
  }

  logSearch(requestId, 'search_completed', {
    strategy: deduped.length > 0 ? 'ai-expanded' : 'lexical',
    provider: expanded.provider,
    count: deduped.length,
    fallback_language: fallbackLanguage ?? null,
  });

  return ok({
    query,
    count: deduped.length,
    items: deduped,
    strategy: deduped.length > 0 ? ('ai-expanded' as const) : ('lexical' as const),
    ai_provider: expanded.provider,
    fallback_language: fallbackLanguage ?? undefined,
    request_id: requestId,
  });
}
