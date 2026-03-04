import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';

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
    john: 'JHN',
    jn: 'JHN',
    psalm: 'PSA',
    psalms: 'PSA',
    ps: 'PSA',
  },
  pt: {
    joao: 'JHN',
    jo: 'JHN',
    salmo: 'PSA',
    salmos: 'PSA',
    sl: 'PSA',
  },
  es: {
    juan: 'JHN',
    jn: 'JHN',
    salmo: 'PSA',
    salmos: 'PSA',
    sal: 'PSA',
  },
  fr: {
    jean: 'JHN',
    jn: 'JHN',
    psaume: 'PSA',
    psaumes: 'PSA',
    ps: 'PSA',
  },
  de: {
    johannes: 'JHN',
    joh: 'JHN',
    psalm: 'PSA',
    psalmen: 'PSA',
    ps: 'PSA',
  },
  it: {
    giovanni: 'JHN',
    gv: 'JHN',
    salmo: 'PSA',
    salmi: 'PSA',
    sal: 'PSA',
  },
  ru: {
    ioann: 'JHN',
    ioan: 'JHN',
    psalom: 'PSA',
    psalmy: 'PSA',
    ps: 'PSA',
  },
  pl: {
    jan: 'JHN',
    j: 'JHN',
    psalm: 'PSA',
    psalmy: 'PSA',
    ps: 'PSA',
  },
};

const INTENT_ALIASES: Record<string, Record<string, string[]>> = {
  en: {
    jesus: ['son', 'christ', 'messiah', 'lord', 'savior'],
    optimism: ['hope', 'joy', 'peace', 'trust'],
  },
  pt: {
    jesus: ['filho', 'cristo', 'senhor', 'salvador'],
    otimismo: ['esperanca', 'alegria', 'paz', 'confianca'],
  },
  es: {
    jesus: ['hijo', 'cristo', 'senor', 'salvador'],
    optimismo: ['esperanza', 'gozo', 'paz', 'confianza'],
  },
  fr: {
    jesus: ['fils', 'christ', 'seigneur', 'sauveur'],
    optimisme: ['esperance', 'joie', 'paix', 'confiance'],
  },
  de: {
    jesus: ['sohn', 'christus', 'herr', 'retter'],
    optimismus: ['hoffnung', 'freude', 'frieden', 'vertrauen'],
  },
  it: {
    gesu: ['figlio', 'cristo', 'signore', 'salvatore'],
    ottimismo: ['speranza', 'gioia', 'pace', 'fiducia'],
  },
  ru: {
    iisus: ['syn', 'khristos', 'gospod', 'spasitel'],
    optimizm: ['nadezhda', 'radost', 'mir', 'doverie'],
  },
  pl: {
    jezus: ['syn', 'chrystus', 'pan', 'zbawiciel'],
    optymizm: ['nadzieja', 'radosc', 'pokoj', 'zaufanie'],
  },
};

const SEARCH_STOPWORDS: Record<string, Set<string>> = {
  en: new Set(['some', 'verse', 'verses', 'about', 'the', 'and', 'for', 'with', 'that', 'this', 'what', 'which']),
  pt: new Set(['algum', 'verso', 'versos', 'sobre', 'com', 'para', 'que', 'este', 'esta', 'qual']),
  es: new Set(['algun', 'verso', 'versos', 'sobre', 'con', 'para', 'que', 'este', 'esta', 'cual']),
  fr: new Set(['quelque', 'verset', 'versets', 'sur', 'avec', 'pour', 'que', 'ce', 'cette', 'quel']),
  de: new Set(['einige', 'vers', 'verse', 'uber', 'mit', 'fur', 'dass', 'dies', 'welche']),
  it: new Set(['alcuni', 'versetto', 'versetti', 'su', 'con', 'per', 'che', 'questo', 'quale']),
  ru: new Set(['nekotorye', 'stikh', 'stikhi', 'pro', 's', 'dlya', 'chto', 'kakoy']),
  pl: new Set(['jakis', 'werset', 'wersety', 'o', 'z', 'dla', 'ze', 'jaki']),
};

function normalizeForLookup(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
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
    .match(/^(?:(?<book>[A-Za-zÀ-ÿ0-9.\s]+?)\s+)?(?<chapter>\d{1,3})\s*[:.]\s*(?<verse>\d{1,3})$/i);

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

  return {
    chapter,
    verse,
    bookCode,
  };
}

async function queryLexical(lang: string, term: string, limit: number) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bible_verses')
    .select(SELECT_COLUMNS)
    .eq('language_code', lang)
    .ilike('text_content', `%${term}%`)
    .limit(limit);

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

function fallbackTermsFromQuery(query: string, lang: string) {
  const stopwords = SEARCH_STOPWORDS[lang] ?? SEARCH_STOPWORDS.en;
  const compact = normalizeForLookup(query)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopwords.has(token));

  const aliases = INTENT_ALIASES[lang] ?? INTENT_ALIASES.en;
  const expandedAliases = compact.flatMap((token) => aliases[token] ?? []);

  return uniqueStrings([query, ...expandedAliases, ...compact]).slice(0, 20);
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
    logSearch(requestId, 'ai_expand_started', { model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini' });
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
        temperature: 0.2,
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
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    q: searchParams.get('q') ?? '',
    lang: searchParams.get('lang') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if ('error' in parsed) return parsed.error;

  const requestId = req.headers.get('x-request-id') ?? buildRequestId();
  const lang = parsed.data.lang ?? 'en';
  const limit = parsed.data.limit ?? 30;
  const query = parsed.data.q.trim();
  logSearch(requestId, 'request_received', { query, lang, limit });

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

  const lexical = await queryLexical(lang, query, limit);
  if (lexical.error) {
    logSearch(requestId, 'lexical_query_failed', { error: lexical.error.message });
    return fail('Verse search failed', 500, lexical.error.message);
  }
  logSearch(requestId, 'lexical_query_done', { count: lexical.data.length, language: lang });
  if (lexical.data.length >= Math.min(3, limit)) {
    return ok({ query, count: lexical.data.length, items: lexical.data, strategy: 'lexical' as const, request_id: requestId });
  }

  const expanded = await expandQueryWithAI(query, lang, requestId);
  logSearch(requestId, 'ai_terms_ready', { provider: expanded.provider, term_count: expanded.terms.length });
  const aiResults: VerseRow[] = [...lexical.data];

  for (const term of expanded.terms) {
    if (aiResults.length >= limit) break;
    const partial = await queryLexical(lang, term, Math.max(5, limit - aiResults.length));
    if (partial.error) continue;
    aiResults.push(...partial.data);
  }

  let deduped = uniqueById(aiResults).slice(0, limit);
  let fallbackLanguage: string | null = null;

  if (deduped.length === 0 && lang !== 'en') {
    fallbackLanguage = 'en';
    for (const term of expanded.terms) {
      if (deduped.length >= limit) break;
      const partial = await queryLexical('en', term, Math.max(5, limit - deduped.length));
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
