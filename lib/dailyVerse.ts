import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type ApprovedCorpusVerse = {
  id: string;
  book_id: string;
  book_code: string;
  chapter: number;
  verse: number;
  text_content: string;
  language_code: SupportedLanguage;
  version_code: string;
};

export type DailyVerseInsert = {
  day: string;
  language_code: SupportedLanguage;
  verse_id: string;
  reflection_prompt: string;
};

type ExistingDailyVerse = {
  language_code: string;
  bible_verses: unknown;
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.6';

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
  pl: 'Polish',
};

const REFLECTION_PROMPTS: Record<SupportedLanguage, string[]> = {
  en: [
    'What part of this verse can guide one concrete decision today?',
    'Where do you feel invited to trust God more today?',
    'Write one prayer inspired by this verse for your current season.',
  ],
  pt: [
    'Que parte deste versículo pode guiar uma decisão concreta hoje?',
    'Em que área você sente que deve confiar mais em Deus hoje?',
    'Escreva uma oração inspirada neste versículo para este momento.',
  ],
  es: [
    '¿Qué parte de este versículo puede guiar una decisión concreta hoy?',
    '¿En qué área sientes que debes confiar más en Dios hoy?',
    'Escribe una oración inspirada en este versículo para esta etapa.',
  ],
  fr: [
    "Quelle partie de ce verset peut guider une décision concrète aujourd'hui ?",
    "Dans quel domaine te sens-tu invité à faire davantage confiance à Dieu aujourd'hui ?",
    'Écris une prière inspirée de ce verset pour cette période de ta vie.',
  ],
  de: [
    'Welcher Teil dieses Verses kann heute eine konkrete Entscheidung leiten?',
    'Wo bist du heute eingeladen, Gott mehr zu vertrauen?',
    'Schreibe ein Gebet, inspiriert von diesem Vers, für deinen aktuellen Lebensabschnitt.',
  ],
  it: [
    'Quale parte di questo versetto può guidare una decisione concreta oggi?',
    'In quale ambito senti di dover confidare di più in Dio oggi?',
    'Scrivi una preghiera ispirata a questo versetto per questo periodo.',
  ],
  ru: [
    'Какая часть этого стиха может направить одно конкретное решение сегодня?',
    'В какой сфере ты сегодня чувствуешь призыв больше доверять Богу?',
    'Напиши одну молитву, вдохновлённую этим стихом, для нынешнего периода жизни.',
  ],
  pl: [
    'Która część tego wersetu może dziś poprowadzić jedną konkretną decyzję?',
    'W jakim obszarze czujesz dziś zaproszenie, by bardziej ufać Bogu?',
    'Napisz jedną modlitwę zainspirowaną tym wersetem na ten czas.',
  ],
};

const CORPUS_SELECT = `
  id,
  book_id,
  chapter,
  verse,
  text_content,
  language_code,
  bible_books!inner(code),
  bible_versions!inner(code, is_active)
`;

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((code) => code === value);
}

function stableIndex(seed: string, size: number) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  return hash.readUInt32BE(0) % size;
}

function pickReflectionPrompt(lang: SupportedLanguage, day: string) {
  const prompts = REFLECTION_PROMPTS[lang] ?? REFLECTION_PROMPTS.en;
  return prompts[stableIndex(`${lang}:${day}:prompt`, prompts.length)];
}

function firstRelation(value: unknown): Record<string, unknown> | null {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === 'object' ? (relation as Record<string, unknown>) : null;
}

function normalizeCorpusVerse(input: unknown): ApprovedCorpusVerse | null {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const book = firstRelation(row.bible_books);
  const version = firstRelation(row.bible_versions);
  const language = typeof row.language_code === 'string' ? row.language_code : '';
  const chapter = Number(row.chapter);
  const verse = Number(row.verse);

  if (
    typeof row.id !== 'string' ||
    typeof row.book_id !== 'string' ||
    typeof row.text_content !== 'string' ||
    !isSupportedLanguage(language) ||
    !Number.isInteger(chapter) ||
    chapter < 1 ||
    !Number.isInteger(verse) ||
    verse < 1 ||
    typeof book?.code !== 'string' ||
    typeof version?.code !== 'string' ||
    version.is_active !== true
  ) {
    return null;
  }

  return {
    id: row.id,
    book_id: row.book_id,
    book_code: book.code,
    chapter,
    verse,
    text_content: row.text_content,
    language_code: language,
    version_code: version.code,
  };
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function parseReflectionItems(input: Record<string, unknown>, languages: SupportedLanguage[]) {
  const target = new Set(languages);
  const prompts = new Map<SupportedLanguage, string>();
  const items = Array.isArray(input.items) ? input.items : [];

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const payload = item as Record<string, unknown>;
    const language = typeof payload.language_code === 'string' ? payload.language_code.toLowerCase() : '';
    const prompt = typeof payload.reflection_prompt === 'string' ? payload.reflection_prompt.trim() : '';
    if (isSupportedLanguage(language) && target.has(language) && prompt.length >= 8) {
      prompts.set(language, prompt);
    }
  }

  return prompts;
}

/**
 * The AI payload is deliberately unable to set any Scripture field. Only its
 * reflection_prompt is accepted; identity, locale and reference stay attached
 * to the approved corpus row selected by the server.
 */
export function buildDailyVerseInsert(
  day: string,
  verse: ApprovedCorpusVerse,
  aiPayload?: Record<string, unknown> | null,
): DailyVerseInsert {
  const generatedPrompt = typeof aiPayload?.reflection_prompt === 'string' ? aiPayload.reflection_prompt.trim() : '';
  return {
    day,
    language_code: verse.language_code,
    verse_id: verse.id,
    reflection_prompt: generatedPrompt.length >= 8 ? generatedPrompt : pickReflectionPrompt(verse.language_code, day),
  };
}

async function runReflectionCompletion(verses: ApprovedCorpusVerse[], day: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || verses.length === 0) return new Map<SupportedLanguage, string>();

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Write reflection prompts about the supplied Scripture. Return JSON only. Scripture text, reference, edition, and language are immutable source data: do not rewrite, translate, correct, or return them.',
        },
        {
          role: 'user',
          content: [
            `Day: ${day}`,
            'For each source below, write one concise reflection question in its language.',
            ...verses.map(
              (verse) =>
                `${verse.language_code} (${LANGUAGE_LABELS[verse.language_code]}), ${verse.book_code} ${verse.chapter}:${verse.verse}, ${verse.version_code}: ${JSON.stringify(verse.text_content)}`,
            ),
            'Return exactly: {"items":[{"language_code":"en","reflection_prompt":"..."}]}',
          ].join('\n'),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI reflection request failed (${response.status})`);
  }

  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const parsed = parseJsonObject(payload.choices?.[0]?.message?.content ?? '');
  if (!parsed) throw new Error('OpenAI returned invalid JSON for daily reflection');
  return parseReflectionItems(parsed, verses.map((verse) => verse.language_code));
}

async function selectDeterministicEnglishVerse(supabase: AppSupabaseClient, day: string) {
  const countResult = await supabase
    .from('bible_verses')
    .select('id, bible_versions!inner(is_active)', { count: 'exact', head: true })
    .eq('language_code', 'en')
    .eq('bible_versions.is_active', true);

  if (countResult.error) throw new Error(`Failed to count approved Scripture corpus: ${countResult.error.message}`);
  if (!countResult.count) throw new Error('Approved Scripture corpus has no active English verse');

  const offset = stableIndex(`daily-verse:${day}`, countResult.count);
  const { data, error } = await supabase
    .from('bible_verses')
    .select(CORPUS_SELECT)
    .eq('language_code', 'en')
    .eq('bible_versions.is_active', true)
    .order('id', { ascending: true })
    .range(offset, offset)
    .maybeSingle();

  if (error) throw new Error(`Failed to select approved Scripture verse: ${error.message}`);
  const verse = normalizeCorpusVerse(data);
  if (!verse) throw new Error('Selected Scripture row is not an active approved corpus verse');
  return verse;
}

function existingReference(rows: ExistingDailyVerse[]) {
  const normalized = rows
    .map((row) => normalizeCorpusVerse(row.bible_verses))
    .filter((row): row is ApprovedCorpusVerse => row !== null)
    .sort((left, right) => {
      if (left.language_code === 'en') return -1;
      if (right.language_code === 'en') return 1;
      return left.language_code.localeCompare(right.language_code);
    });
  return normalized[0] ?? null;
}

async function translatedCorpusRows(supabase: AppSupabaseClient, base: ApprovedCorpusVerse) {
  const { data, error } = await supabase
    .from('bible_verses')
    .select(CORPUS_SELECT)
    .eq('book_id', base.book_id)
    .eq('chapter', base.chapter)
    .eq('verse', base.verse)
    .eq('bible_versions.is_active', true)
    .in('language_code', [...SUPPORTED_LANGUAGES]);

  if (error) throw new Error(`Failed to load approved Scripture localizations: ${error.message}`);

  const verses = (data ?? [])
    .map(normalizeCorpusVerse)
    .filter((row): row is ApprovedCorpusVerse => row !== null)
    .sort((left, right) =>
      `${left.language_code}:${left.version_code}:${left.id}`.localeCompare(
        `${right.language_code}:${right.version_code}:${right.id}`,
      ),
    );
  const byLanguage = new Map<SupportedLanguage, ApprovedCorpusVerse>([[base.language_code, base]]);
  for (const verse of verses) {
    if (!byLanguage.has(verse.language_code)) byLanguage.set(verse.language_code, verse);
  }
  return [...byLanguage.values()];
}

export async function ensureDailyVersesForDay(supabase: AppSupabaseClient, day: string) {
  const existingSelect = `
    language_code,
    bible_verses!inner(${CORPUS_SELECT})
  `;
  const { data: existingData, error: existingError } = await supabase
    .from('daily_verses')
    .select(existingSelect)
    .eq('day', day)
    .eq('bible_verses.bible_versions.is_active', true);

  if (existingError) throw new Error(`Failed to inspect daily verses: ${existingError.message}`);
  const existingRows = (existingData ?? []) as unknown as ExistingDailyVerse[];
  const base = existingReference(existingRows) ?? (await selectDeterministicEnglishVerse(supabase, day));
  const corpusRows = await translatedCorpusRows(supabase, base);
  const existingLanguages = new Set(existingRows.map((row) => row.language_code));
  const missingRows = corpusRows.filter((row) => !existingLanguages.has(row.language_code));

  if (missingRows.length === 0) return { generated: 0, provider: 'cache' as const };

  let aiPrompts = new Map<SupportedLanguage, string>();
  try {
    aiPrompts = await runReflectionCompletion(missingRows, day);
  } catch (error) {
    console.error('[daily-verse-ai] reflection_failed', {
      day,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const inserts = missingRows.map((verse) =>
    buildDailyVerseInsert(day, verse, { reflection_prompt: aiPrompts.get(verse.language_code) }),
  );
  const { error: upsertError } = await supabase.from('daily_verses').upsert(inserts, {
    onConflict: 'language_code,day',
  });
  if (upsertError) throw new Error(`Failed to persist daily verses: ${upsertError.message}`);

  return {
    generated: inserts.length,
    provider: aiPrompts.size > 0 ? ('openai-reflection' as const) : ('fallback-reflection' as const),
    reference: { book_code: base.book_code, chapter: base.chapter, verse: base.verse },
  };
}
