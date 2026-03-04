import crypto from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const SUPPORTED_LANGUAGES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export type DailyVerseCacheRow = {
  id: string;
  day: string;
  language_code: string;
  book_code: string;
  chapter: number;
  verse: number;
  text_content: string;
  reflection_prompt: string | null;
  provider: string;
  model: string | null;
};

type BaseVerse = {
  book_code: string;
  chapter: number;
  verse: number;
  text_content: string;
  reflection_prompt: string;
};

type LocalizedVerse = {
  language_code: SupportedLanguage;
  text_content: string;
  reflection_prompt: string;
};

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.2';

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
    'Que parte deste versiculo pode guiar uma decisao concreta hoje?',
    'Em que area voce sente que deve confiar mais em Deus hoje?',
    'Escreva uma oracao inspirada neste versiculo para este momento.',
  ],
  es: [
    'Que parte de este versiculo puede guiar una decision concreta hoy?',
    'En que area sientes que debes confiar mas en Dios hoy?',
    'Escribe una oracion inspirada en este versiculo para esta etapa.',
  ],
  fr: [
    'Quelle partie de ce verset peut guider une decision concrete aujourd hui?',
    'Dans quel domaine te sens-tu invite a faire plus confiance a Dieu aujourd hui?',
    'Ecris une priere inspiree de ce verset pour cette saison.',
  ],
  de: [
    'Welcher Teil dieses Verses kann heute eine konkrete Entscheidung leiten?',
    'Wo bist du heute eingeladen, Gott mehr zu vertrauen?',
    'Schreibe ein Gebet, inspiriert von diesem Vers, fuer deinen aktuellen Abschnitt.',
  ],
  it: [
    'Quale parte di questo versetto puo guidare una decisione concreta oggi?',
    'In quale area senti di dover confidare di piu in Dio oggi?',
    'Scrivi una preghiera ispirata a questo versetto per questo periodo.',
  ],
  ru: [
    'Kakaya chast etogo stikha mozhet segodnya napravit konkretnoe reshenie?',
    'V kakoy sfere ty segodnya prizvan bolshe doveryat Bogu?',
    'Napishe odnu molitvu, vdokhnovlennuyu etim stikhom, dlya etogo perioda.',
  ],
  pl: [
    'Ktora czesc tego wersetu moze dzis poprowadzic konkretna decyzje?',
    'W jakim obszarze jestes dzis zaproszony, by bardziej ufac Bogu?',
    'Napisz jedna modlitwe zainspirowana tym wersetem na ten okres.',
  ],
};

function isSupportedLanguage(value: string): value is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some((code) => code === value);
}

function stableIndex(seed: string, size: number) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const value = hash.readUInt32BE(0);
  return value % size;
}

function pickReflectionPrompt(lang: SupportedLanguage, day: string) {
  const prompts = REFLECTION_PROMPTS[lang] ?? REFLECTION_PROMPTS.en;
  return prompts[stableIndex(`${lang}:${day}:prompt`, prompts.length)];
}

function normalizeBookCode(value: unknown) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 2 || code.length > 5) return null;
  return code;
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

function validateBaseVerse(input: Record<string, unknown>): BaseVerse | null {
  const book_code = normalizeBookCode(input.book_code);
  const chapter = Number(input.chapter);
  const verse = Number(input.verse);
  const text_content = typeof input.text_content === 'string' ? input.text_content.trim() : '';
  const reflection_prompt = typeof input.reflection_prompt === 'string' ? input.reflection_prompt.trim() : '';

  if (!book_code || !Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(verse) || verse < 1) return null;
  if (text_content.length < 16 || reflection_prompt.length < 8) return null;

  return {
    book_code,
    chapter: Math.floor(chapter),
    verse: Math.floor(verse),
    text_content,
    reflection_prompt,
  };
}

function parseLocalizationItems(input: Record<string, unknown>, targetLanguages: SupportedLanguage[]) {
  const target = new Set(targetLanguages);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  const items = new Map<SupportedLanguage, LocalizedVerse>();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const payload = raw as Record<string, unknown>;
    const language_code = typeof payload.language_code === 'string' ? payload.language_code.trim().toLowerCase() : '';
    if (!isSupportedLanguage(language_code) || !target.has(language_code)) continue;

    const text_content = typeof payload.text_content === 'string' ? payload.text_content.trim() : '';
    const reflection_prompt = typeof payload.reflection_prompt === 'string' ? payload.reflection_prompt.trim() : '';

    if (text_content.length < 12 || reflection_prompt.length < 8) continue;
    items.set(language_code, { language_code, text_content, reflection_prompt });
  }

  return items;
}

function buildRequestId(day: string) {
  return `dailyverse_${day}_${Math.random().toString(36).slice(2, 8)}`;
}

async function runChatCompletion(requestId: string, messages: Array<{ role: 'system' | 'user'; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI daily verse request failed (${response.status}): ${body.slice(0, 260)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonObject(content);
  if (!parsed) throw new Error('OpenAI returned invalid JSON for daily verse');

  console.info('[daily-verse-ai] completion_ok', { requestId, model: OPENAI_MODEL });
  return parsed;
}

async function generateBaseVerse(day: string, requestId: string) {
  const parsed = await runChatCompletion(requestId, [
    {
      role: 'system',
      content:
        'You select one biblical verse for the day and return STRICT JSON only. Never include markdown. Keep book_code canonical (e.g., JHN, PSA, ROM, MAT).',
    },
    {
      role: 'user',
      content: [
        `Target day: ${day}.`,
        'Pick one meaningful Bible verse for broad encouragement and faith.',
        'Return JSON with exact shape:',
        '{"book_code":"PSA","chapter":23,"verse":1,"text_content":"...","reflection_prompt":"..."}',
        'Rules:',
        '- Use a real Bible verse.',
        '- reflection_prompt should be one concise sentence in English.',
      ].join('\n'),
    },
  ]);

  const base = validateBaseVerse(parsed);
  if (!base) throw new Error('Daily verse base output failed validation');
  return base;
}

async function localizeBaseVerse(base: BaseVerse, languages: SupportedLanguage[], requestId: string) {
  if (languages.length === 0) return new Map<SupportedLanguage, LocalizedVerse>();

  const parsed = await runChatCompletion(requestId, [
    {
      role: 'system',
      content:
        'You localize biblical verse text and reflection prompts. Return STRICT JSON only, no markdown.',
    },
    {
      role: 'user',
      content: [
        `Reference: ${base.book_code} ${base.chapter}:${base.verse}`,
        `English verse text: "${base.text_content}"`,
        `English reflection prompt: "${base.reflection_prompt}"`,
        `Target languages: ${languages.map((lang) => `${lang} (${LANGUAGE_LABELS[lang]})`).join(', ')}`,
        'Return JSON in this exact shape:',
        '{"items":[{"language_code":"pt","text_content":"...","reflection_prompt":"..."}]}',
        'Rules:',
        '- Return one item per target language.',
        '- Keep meaning faithful to the original verse.',
        '- reflection_prompt should be one concise sentence in each language.',
      ].join('\n'),
    },
  ]);

  return parseLocalizationItems(parsed, languages);
}

export async function ensureDailyVersesForDay(supabase: SupabaseClient, day: string) {
  const requestId = buildRequestId(day);
  const selectColumns = 'id, day, language_code, book_code, chapter, verse, text_content, reflection_prompt, provider, model';

  const { data: existingRows, error: existingError } = await supabase
    .from('daily_verse_ai_cache')
    .select(selectColumns)
    .eq('day', day);

  if (existingError) {
    throw new Error(`Failed to inspect daily verse AI cache: ${existingError.message}`);
  }

  const existingByLanguage = new Map<string, DailyVerseCacheRow>();
  for (const row of (existingRows ?? []) as DailyVerseCacheRow[]) {
    existingByLanguage.set(row.language_code, row);
  }

  const missing = SUPPORTED_LANGUAGES.filter((lang) => !existingByLanguage.has(lang));
  if (missing.length === 0) {
    return { generated: 0, provider: 'cache' as const };
  }

  const englishExisting = existingByLanguage.get('en');
  const baseVerse: BaseVerse = englishExisting
    ? {
        book_code: englishExisting.book_code,
        chapter: englishExisting.chapter,
        verse: englishExisting.verse,
        text_content: englishExisting.text_content,
        reflection_prompt: englishExisting.reflection_prompt ?? pickReflectionPrompt('en', day),
      }
    : await generateBaseVerse(day, requestId);

  const rowsToUpsert: Array<{
    day: string;
    language_code: SupportedLanguage;
    book_code: string;
    chapter: number;
    verse: number;
    text_content: string;
    reflection_prompt: string;
    provider: string;
    model: string;
  }> = [];

  if (missing.includes('en')) {
    rowsToUpsert.push({
      day,
      language_code: 'en',
      book_code: baseVerse.book_code,
      chapter: baseVerse.chapter,
      verse: baseVerse.verse,
      text_content: baseVerse.text_content,
      reflection_prompt: baseVerse.reflection_prompt,
      provider: 'openai',
      model: OPENAI_MODEL,
    });
  }

  const nonEnglishMissing = missing.filter((lang) => lang !== 'en');
  let localizedMap = new Map<SupportedLanguage, LocalizedVerse>();
  if (nonEnglishMissing.length > 0) {
    try {
      localizedMap = await localizeBaseVerse(baseVerse, nonEnglishMissing, requestId);
    } catch (error) {
      console.error('[daily-verse-ai] localization_failed', {
        requestId,
        day,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  for (const lang of nonEnglishMissing) {
    const localized = localizedMap.get(lang);
    rowsToUpsert.push({
      day,
      language_code: lang,
      book_code: baseVerse.book_code,
      chapter: baseVerse.chapter,
      verse: baseVerse.verse,
      text_content: localized?.text_content ?? baseVerse.text_content,
      reflection_prompt: localized?.reflection_prompt ?? pickReflectionPrompt(lang, day),
      provider: 'openai',
      model: OPENAI_MODEL,
    });
  }

  const { error: upsertError } = await supabase
    .from('daily_verse_ai_cache')
    .upsert(rowsToUpsert, { onConflict: 'day,language_code' });

  if (upsertError) {
    throw new Error(`Failed to persist daily verse AI cache: ${upsertError.message}`);
  }

  return {
    generated: rowsToUpsert.length,
    provider: 'openai' as const,
    reference: {
      book_code: baseVerse.book_code,
      chapter: baseVerse.chapter,
      verse: baseVerse.verse,
    },
  };
}
