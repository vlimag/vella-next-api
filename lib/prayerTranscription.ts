const OPENAI_TRANSCRIPTIONS_URL = 'https://api.openai.com/v1/audio/transcriptions';

export const PRAYER_RECORDING_MAX_BYTES = 15 * 1024 * 1024;
export const PRAYER_RECORDING_MAX_SECONDS = 180;

const SUPPORTED_EXTENSIONS = new Set(['m4a', 'mp4', 'mp3', 'mpeg', 'mpga', 'wav', 'webm']);
const CONTENT_TYPES: Record<string, string> = {
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  mp3: 'audio/mpeg',
  mpeg: 'audio/mpeg',
  mpga: 'audio/mpeg',
  wav: 'audio/wav',
  webm: 'audio/webm',
};

export function normalizePrayerLanguage(language: unknown) {
  if (typeof language !== 'string') return undefined;
  const normalized = language.trim().replace(/_/gu, '-').toLowerCase();
  const base = normalized.split('-')[0];
  return ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'].includes(base) ? base : undefined;
}

export function prayerAudioExtension(file: File) {
  const namedExtension = file.name.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (namedExtension && SUPPORTED_EXTENSIONS.has(namedExtension)) return namedExtension;

  const type = file.type.toLowerCase();
  if (type.includes('webm')) return 'webm';
  if (type.includes('wav')) return 'wav';
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('mp4') || type.includes('m4a')) return 'm4a';
  return null;
}

export function normalizePrayerAudioFile(file: File) {
  const extension = prayerAudioExtension(file);
  if (!extension) throw new Error('Unsupported audio format');
  return new File([file], `prayer-recording.${extension}`, {
    type: CONTENT_TYPES[extension],
  });
}

export async function transcribePrayerAudio(file: File, language?: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error('Voice transcription is temporarily unavailable');

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-transcribe';
  const form = new FormData();
  form.append('file', file, file.name);
  form.append('model', model);
  form.append('response_format', 'json');
  form.append(
    'prompt',
    'A private personal prayer spoken by one person. Preserve the speaker’s language, meaning, names, and Scripture references. Add punctuation, but do not add or rewrite content.',
  );
  if (language) form.append('languages[]', language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 50_000);
  try {
    const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const requestId = response.headers.get('x-request-id');
      console.error('[prayer-transcription] provider_failed', {
        status: response.status,
        requestId,
        model,
      });
      throw new Error('Could not transcribe this recording. Please try again.');
    }

    const result = await response.json() as { text?: unknown; languages?: unknown };
    const transcript = typeof result.text === 'string' ? result.text.trim() : '';
    if (!transcript) throw new Error('No speech was detected. Please record again.');
    return { transcript, languages: Array.isArray(result.languages) ? result.languages : [] };
  } catch (error) {
    if (
      error instanceof Error
      && [
        'Could not transcribe this recording. Please try again.',
        'No speech was detected. Please record again.',
      ].includes(error.message)
    ) {
      throw error;
    }
    throw new Error('Could not transcribe this recording. Please try again.');
  } finally {
    clearTimeout(timeout);
  }
}
