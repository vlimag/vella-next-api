import { z } from 'zod';
import { fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { resolveReadOnlyContentViewer } from '@/lib/subscriptionAccess';
import {
  generateVerseNarration,
  resolveVerseNarrationVoice,
} from '@/lib/verseNarration';
import {
  getOrCreateVerseNarration,
  type VerseNarrationStorage,
} from '@/lib/verseNarrationCache';

const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ voice: z.enum(['marin', 'cedar']).default('marin') });

type RouteParams = {
  params: Promise<{ id: string }>;
};

export const maxDuration = 20;

export async function GET(req: Request, { params }: RouteParams) {
  const access = await resolveReadOnlyContentViewer();
  if ('response' in access) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid verse identifier', 400);

  const url = new URL(req.url);
  const parsedQuery = querySchema.safeParse({ voice: url.searchParams.get('voice') ?? undefined });
  if (!parsedQuery.success) return fail('Invalid narration voice', 400);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bible_verses')
    .select('text_content, language_code, bible_versions!inner(is_active)')
    .eq('id', parsedParams.data.id)
    .eq('bible_versions.is_active', true)
    .maybeSingle();

  if (error) return fail('Could not load verse narration', 500);
  if (!data) return fail('Verse not found', 404);

  try {
    const voice = resolveVerseNarrationVoice(parsedQuery.data.voice);
    const narration = await getOrCreateVerseNarration({
      language: String(data.language_code),
      storage: supabase.storage as VerseNarrationStorage,
      text: String(data.text_content),
      voice,
      generate: async () => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) throw new Error('narration_unavailable');
        return generateVerseNarration({
          apiKey,
          language: String(data.language_code),
          text: String(data.text_content),
          voice,
        });
      },
    });

    return new Response(narration.audio, {
      status: 200,
      headers: {
        'Cache-Control': 'private, max-age=86400',
        'Content-Length': String(narration.audio.byteLength),
        'Content-Type': 'audio/mpeg',
        'X-Vella-Audio-Cache': narration.cacheStatus,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[verse-narration] generation_failed', {
      code: error instanceof Error ? error.message : 'unknown',
    });
    return fail('Natural narration is temporarily unavailable', 503, {
      code: 'narration_unavailable',
    });
  }
}
