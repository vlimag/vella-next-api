export const VERSE_NARRATION_MODEL = 'gpt-4o-mini-tts';
export const VERSE_NARRATION_VOICES = ['marin', 'cedar'] as const;

export type VerseNarrationVoice = typeof VERSE_NARRATION_VOICES[number];
export type NarrationStyle = 'scripture' | 'gathering';

const MAX_INPUT_LENGTH = 4_096;
const MIN_AUDIO_BYTES = 1_024;
const MAX_AUDIO_BYTES = 4 * 1_024 * 1_024;
const PROVIDER_TIMEOUT_MS = 15_000;

const LANGUAGE_NAMES: Record<string, string> = {
  de: 'German',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  it: 'Italian',
  pl: 'Polish',
  pt: 'Brazilian Portuguese',
  ru: 'Russian',
};

export function resolveVerseNarrationVoice(value: string | null | undefined): VerseNarrationVoice {
  if (value === 'cedar' || value === 'vella-neural:cedar') return 'cedar';
  return 'marin';
}

function narrationLanguageName(language: string) {
  const base = language.trim().toLowerCase().replace('_', '-').split('-')[0];
  return LANGUAGE_NAMES[base] ?? 'English';
}

export function verseNarrationInstructions(language: string, style: NarrationStyle = 'scripture') {
  return [
    `Speak in natural ${narrationLanguageName(language)}.`,
    style === 'gathering'
      ? 'Use a warm, calm, human conversational voice suitable for a trusted reflective guide.'
      : 'Use a warm, calm, human conversational voice suitable for a quiet Scripture reading.',
    'Keep the pacing relaxed but not theatrical, whispered, sing-song, or overly solemn.',
    'Read every supplied word exactly once and add nothing.',
  ].join(' ');
}

export function isValidVerseNarrationAudio(bytes: ArrayBuffer) {
  return bytes.byteLength >= MIN_AUDIO_BYTES && bytes.byteLength <= MAX_AUDIO_BYTES;
}

export async function generateVerseNarration({
  apiKey,
  fetchImpl = fetch,
  language,
  text,
  voice,
  style = 'scripture',
}: {
  apiKey: string;
  fetchImpl?: typeof fetch;
  language: string;
  text: string;
  voice: VerseNarrationVoice;
  style?: NarrationStyle;
}) {
  const input = text.trim();
  if (!apiKey || input.length < 1 || input.length > MAX_INPUT_LENGTH) {
    throw new Error('invalid_narration_input');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: VERSE_NARRATION_MODEL,
        voice,
        input,
        instructions: verseNarrationInstructions(language, style),
        response_format: 'mp3',
        speed: 0.96,
      }),
      signal: controller.signal,
    });
  } catch {
    throw new Error(controller.signal.aborted ? 'provider_timeout' : 'narration_provider_unavailable');
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!response.ok || !contentType.startsWith('audio/')) {
    throw new Error('invalid_audio_response');
  }

  const bytes = await response.arrayBuffer();
  if (!isValidVerseNarrationAudio(bytes)) {
    throw new Error('invalid_audio_response');
  }

  return bytes;
}
