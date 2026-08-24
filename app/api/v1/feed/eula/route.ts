import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { CURRENT_SOCIAL_EULA_VERSION } from '@/lib/social';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  version: z.string().trim().min(1).max(24).optional(),
});

function extractClientIp(req: Request) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') ?? null;
}

export async function GET(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(bodySchema, {
    version: searchParams.get('version') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const version = parsed.data.version ?? CURRENT_SOCIAL_EULA_VERSION;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('social_eula_acceptances')
    .select('accepted_at')
    .eq('user_id', auth.userId)
    .eq('eula_version', version)
    .maybeSingle();

  if (error) return fail('Could not load EULA acceptance status', 500, error.message);

  return ok({
    version,
    accepted: Boolean(data?.accepted_at),
    accepted_at: data?.accepted_at ?? null,
  });
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const version = parsed.data.version ?? CURRENT_SOCIAL_EULA_VERSION;
  if (version !== CURRENT_SOCIAL_EULA_VERSION) {
    return fail('Unsupported EULA version', 400, {
      current_version: CURRENT_SOCIAL_EULA_VERSION,
    });
  }

  const supabase = createServiceClient();
  const acceptedAt = new Date().toISOString();
  const ipAddress = extractClientIp(req);
  const userAgent = req.headers.get('user-agent');

  const { error } = await supabase
    .from('social_eula_acceptances')
    .upsert(
      {
        user_id: auth.userId,
        eula_version: version,
        accepted_at: acceptedAt,
        ip_address: ipAddress,
        user_agent: userAgent,
      },
      { onConflict: 'user_id,eula_version' },
    );

  if (error) return fail('Could not record EULA acceptance', 500, error.message);

  return ok({
    version,
    accepted: true,
    accepted_at: acceptedAt,
  });
}
