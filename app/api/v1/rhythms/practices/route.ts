import { fail, ok } from '@/lib/http';
import {
  canonicalTimeZone,
  loadPracticeConfiguration,
  practiceConfigurationInputSchema,
  replacePracticeConfiguration,
  type PracticeClient,
} from '@/lib/rhythms/practices';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function safeLog(stage: 'load' | 'replace') {
  console.error('[rhythms-practices]', {
    route: 'rhythms_practices',
    stage,
    code: 'database_unavailable',
  });
}

export async function GET() {
  try {
    const access = await requireActiveSubscription();
    if ('response' in access) return noStore(access.response);
    const client = createServiceClient() as unknown as PracticeClient;
    return noStore(ok(await loadPracticeConfiguration(client, access.userId)));
  } catch {
    safeLog('load');
    return noStore(fail('Could not load practice configuration', 503, { code: 'practices_unavailable' }));
  }
}

export async function PUT(request: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return noStore(access.response);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return noStore(fail('Invalid request input', 400, { code: 'invalid_practice_configuration' }));
  }

  const parsed = practiceConfigurationInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    return noStore(fail('Invalid request input', 400, { code: 'invalid_practice_configuration' }));
  }
  const timezone = canonicalTimeZone(parsed.data.timezone_name);
  if (!timezone) {
    return noStore(fail('Invalid request input', 400, { code: 'invalid_practice_configuration' }));
  }

  try {
    const client = createServiceClient() as unknown as PracticeClient;
    const result = await replacePracticeConfiguration(client, access.userId, {
      ...parsed.data,
      timezone_name: timezone,
    });
    if (!result.ok) {
      if (result.code === 'inactive_practice') {
        return noStore(fail('Selected practice is unavailable', 400, { code: result.code }));
      }
      safeLog('replace');
      return noStore(fail('Could not save practice configuration', 503, { code: 'practices_unavailable' }));
    }
    return noStore(ok(result.value));
  } catch {
    safeLog('replace');
    return noStore(fail('Could not save practice configuration', 503, { code: 'practices_unavailable' }));
  }
}
