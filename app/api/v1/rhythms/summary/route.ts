import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { loadRhythmsSummary } from '@/lib/rhythms/summary';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { localeSchema, parseQuery } from '@/lib/validation';

const querySchema = z.object({ lang: localeSchema.optional() }).strict();

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  const parsed = parseQuery(querySchema, {
    lang: new URL(request.url).searchParams.get('lang') ?? undefined,
  });
  if ('error' in parsed) return noStore(fail('Invalid request input', 400, { code: 'invalid_locale' }));

  try {
    return noStore(ok(await loadRhythmsSummary(access.userId, parsed.data.lang ?? 'en')));
  } catch {
    return noStore(fail('Could not load Rhythms summary', 503, { code: 'rhythms_unavailable' }));
  }
}
