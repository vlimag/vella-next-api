import { fail, ok } from '@/lib/http';
import {
  normalizePrayerAudioFile,
  normalizePrayerLanguage,
  PRAYER_RECORDING_MAX_BYTES,
  PRAYER_RECORDING_MAX_SECONDS,
  transcribePrayerAudio,
} from '@/lib/prayerTranscription';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  try {
    const form = await req.formData();
    const uploadedFile = form.get('file');
    if (!(uploadedFile instanceof File) || uploadedFile.size === 0) {
      return fail('Audio file is required', 400);
    }
    if (uploadedFile.size > PRAYER_RECORDING_MAX_BYTES) {
      return fail('Recording is too large', 413);
    }

    const durationRaw = form.get('durationSeconds');
    const durationSeconds = typeof durationRaw === 'string' ? Number(durationRaw) : Number.NaN;
    if (Number.isFinite(durationSeconds) && durationSeconds > PRAYER_RECORDING_MAX_SECONDS + 2) {
      return fail('Recording is too long', 400);
    }

    const language = normalizePrayerLanguage(form.get('language'));
    const file = normalizePrayerAudioFile(uploadedFile);
    console.info('[prayer-transcription] started', {
      bytes: file.size,
      durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : null,
      language: language ?? null,
    });

    const result = await transcribePrayerAudio(file, language);
    console.info('[prayer-transcription] completed', {
      transcriptLength: result.transcript.length,
    });
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not transcribe this recording';
    console.error('[prayer-transcription] failed', {
      message,
    });
    return fail(message, message === 'Unsupported audio format' ? 415 : 502);
  }
}
