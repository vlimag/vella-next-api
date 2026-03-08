import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { parseQuery } from '@/lib/validation';

const bodySchema = z.object({
  expo_push_token: z.string().trim().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).optional(),
  device_id: z.string().trim().min(6).max(120).optional(),
  locale: z.string().trim().min(2).max(10).optional(),
});

export async function POST(req: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('user_push_tokens')
    .upsert(
      {
        user_id: auth.userId,
        platform: parsed.data.platform ?? 'unknown',
        expo_push_token: parsed.data.expo_push_token,
        device_id: parsed.data.device_id ?? null,
        locale: parsed.data.locale ?? null,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' },
    );

  if (error) return fail('Could not save push token', 500, error.message);
  return ok({ saved: true });
}
