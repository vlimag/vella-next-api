import { z } from 'zod';
import { fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { generateVerseNarration } from '@/lib/verseNarration';
import {
  getOrCreateVerseNarration,
  type VerseNarrationStorage,
} from '@/lib/verseNarrationCache';

const querySchema = z.object({
  language: z.enum(['de', 'en', 'es', 'fr', 'it', 'pl', 'pt', 'ru']),
  voice: z.enum(['marin', 'cedar']),
});

const SAMPLES: Record<string, string> = {
  de: 'Der Herr ist mein Hirte; mir wird nichts mangeln.',
  en: 'The Lord is my shepherd; I shall not want.',
  es: 'El Señor es mi pastor; nada me faltará.',
  fr: 'Le Seigneur est mon berger ; je ne manquerai de rien.',
  it: 'Il Signore è il mio pastore; nulla mi mancherà.',
  pl: 'Pan jest moim pasterzem, niczego mi nie braknie.',
  pt: 'O Senhor é o meu pastor; nada me faltará.',
  ru: 'Господь — Пастырь мой; я ни в чем не буду нуждаться.',
};

export const maxDuration = 20;

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const language = (searchParams.get('language') ?? '').toLowerCase().split('-')[0];
  const parsed = querySchema.safeParse({
    language,
    voice: searchParams.get('voice'),
  });
  if (!parsed.success) return fail('Invalid narration preview', 400);

  try {
    const supabase = createServiceClient();
    const text = SAMPLES[parsed.data.language];
    const narration = await getOrCreateVerseNarration({
      language: parsed.data.language,
      storage: supabase.storage as VerseNarrationStorage,
      text,
      voice: parsed.data.voice,
      generate: async () => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) throw new Error('narration_unavailable');
        return generateVerseNarration({
          apiKey,
          language: parsed.data.language,
          text,
          voice: parsed.data.voice,
        });
      },
    });
    return new Response(narration.audio, {
      headers: {
        'Cache-Control': 'private, max-age=86400',
        'Content-Length': String(narration.audio.byteLength),
        'Content-Type': 'audio/mpeg',
        'X-Vella-Audio-Cache': narration.cacheStatus,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[verse-narration] preview_failed', {
      code: error instanceof Error ? error.message : 'unknown',
    });
    return fail('Natural narration is temporarily unavailable', 503, {
      code: 'narration_unavailable',
    });
  }
}
