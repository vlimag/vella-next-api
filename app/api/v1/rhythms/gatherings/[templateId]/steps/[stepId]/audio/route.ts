import { z } from 'zod';
import { fail } from '@/lib/http';
import {
  getOrCreateGatheringNarration,
  loadApprovedGatheringNarration,
  type GatheringNarrationClient,
} from '@/lib/gatheringNarration';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import {
  generateVerseNarration,
  resolveVerseNarrationVoice,
} from '@/lib/verseNarration';
import type { VerseNarrationStorage } from '@/lib/verseNarrationCache';

const paramsSchema = z.object({
  templateId: z.string().uuid(),
  stepId: z.string().uuid(),
});
const querySchema = z.object({ voice: z.enum(['marin', 'cedar']).default('marin') });
type RouteParams = { params: Promise<{ templateId: string; stepId: string }> };

export const maxDuration = 20;

export async function GET(request: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid Gathering audio identifier', 400);
  const parsedQuery = querySchema.safeParse({
    voice: new URL(request.url).searchParams.get('voice') ?? undefined,
  });
  if (!parsedQuery.success) return fail('Invalid narration voice', 400);

  const supabase = createServiceClient();
  const content = await loadApprovedGatheringNarration(
    supabase as unknown as GatheringNarrationClient,
    parsedParams.data.templateId,
    parsedParams.data.stepId,
  );
  if (!content.ok) {
    console.error('[gathering-narration]', {
      route: 'gathering_audio', stage: 'content_load', code: 'database_unavailable',
    });
    return fail('Could not load Gathering narration', 503, { code: 'narration_unavailable' });
  }
  if (!content.value) return fail('Gathering narration not found', 404);

  try {
    const voice = resolveVerseNarrationVoice(parsedQuery.data.voice);
    const narration = await getOrCreateGatheringNarration({
      ...content.value,
      storage: supabase.storage as VerseNarrationStorage,
      voice,
      generate: async () => {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) throw new Error('narration_unavailable');
        return generateVerseNarration({
          apiKey,
          language: content.value!.language,
          style: 'gathering',
          text: content.value!.text,
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
    console.error('[gathering-narration]', {
      route: 'gathering_audio',
      stage: 'generation',
      code: error instanceof Error && error.message === 'provider_timeout'
        ? 'provider_timeout'
        : 'narration_unavailable',
    });
    return fail('Natural narration is temporarily unavailable', 503, {
      code: 'narration_unavailable',
    });
  }
}
