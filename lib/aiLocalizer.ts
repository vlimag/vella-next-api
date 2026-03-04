const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-5.2';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  ru: 'Russian',
  pl: 'Polish',
};

type BlockSource = {
  block_id: string;
  title: string;
  body: string;
  scripture_ref: string | null;
  cta_text: string | null;
};

type LocalizedBlock = BlockSource;

type LocalizedTemplate = {
  title: string;
  subtitle: string | null;
  description: string | null;
};

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

function languageLabel(code: string) {
  return LANGUAGE_LABELS[code] ?? code;
}

async function runJsonCompletion(requestId: string, messages: Array<{ role: 'system' | 'user'; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI localization failed (${response.status}): ${body.slice(0, 260)}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content ?? '';
  const parsed = parseJsonObject(content);
  if (!parsed) {
    throw new Error('OpenAI localization returned invalid JSON');
  }

  console.info('[journey-localizer] completion_ok', { requestId, model: OPENAI_MODEL });
  return parsed;
}

export async function localizeJourneyTemplateWithAI(input: {
  requestId: string;
  targetLanguage: string;
  sourceLanguage: string;
  title: string;
  subtitle: string | null;
  description: string | null;
}): Promise<LocalizedTemplate | null> {
  const parsed = await runJsonCompletion(input.requestId, [
    {
      role: 'system',
      content: 'You localize Christian app copy for journey templates. Return STRICT JSON only.',
    },
    {
      role: 'user',
      content: [
        `Translate from ${languageLabel(input.sourceLanguage)} to ${languageLabel(input.targetLanguage)}.`,
        'Keep tone warm, clear, and natural for native speakers.',
        `title: "${input.title}"`,
        `subtitle: ${input.subtitle === null ? 'null' : `"${input.subtitle}"`}`,
        `description: ${input.description === null ? 'null' : `"${input.description}"`}`,
        'Return EXACT JSON shape:',
        '{"title":"...","subtitle":"... or null","description":"... or null"}',
      ].join('\n'),
    },
  ]);

  if (!parsed) {
    return null;
  }

  const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
  const subtitle = parsed.subtitle === null ? null : typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : null;
  const description = parsed.description === null ? null : typeof parsed.description === 'string' ? parsed.description.trim() : null;

  if (title.length < 3) {
    return null;
  }

  return { title, subtitle, description };
}

export async function localizeJourneyBlocksWithAI(input: {
  requestId: string;
  targetLanguage: string;
  sourceLanguage: string;
  blocks: BlockSource[];
}): Promise<LocalizedBlock[]> {
  if (input.blocks.length === 0) {
    return [];
  }

  const parsed = await runJsonCompletion(input.requestId, [
    {
      role: 'system',
      content:
        'You localize Christian journey content. Return STRICT JSON only and preserve each block_id.',
    },
    {
      role: 'user',
      content: [
        `Translate from ${languageLabel(input.sourceLanguage)} to ${languageLabel(input.targetLanguage)}.`,
        'Do not change theology or intent. Keep meaning faithful.',
        'If scripture_ref is present, localize naturally for the target language.',
        'Return EXACT JSON shape:',
        '{"items":[{"block_id":"...","title":"...","body":"...","scripture_ref":"... or null","cta_text":"... or null"}]}',
        `Source items JSON: ${JSON.stringify(input.blocks)}`,
      ].join('\n'),
    },
  ]);

  if (!parsed) {
    return [];
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const byId = new Map<string, LocalizedBlock>();

  for (const raw of rawItems) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const block_id = typeof item.block_id === 'string' ? item.block_id : '';
    const title = typeof item.title === 'string' ? item.title.trim() : '';
    const body = typeof item.body === 'string' ? item.body.trim() : '';
    const scripture_ref = item.scripture_ref === null ? null : typeof item.scripture_ref === 'string' ? item.scripture_ref.trim() : null;
    const cta_text = item.cta_text === null ? null : typeof item.cta_text === 'string' ? item.cta_text.trim() : null;

    if (!block_id || title.length < 2 || body.length < 6) continue;
    byId.set(block_id, { block_id, title, body, scripture_ref, cta_text });
  }

  return input.blocks.map((block) => byId.get(block.block_id)).filter((item): item is LocalizedBlock => Boolean(item));
}
