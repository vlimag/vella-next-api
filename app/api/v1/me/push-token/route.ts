import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  expo_push_token: z.string().trim().regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,240}\]$/),
  platform: z.enum(['ios', 'android', 'web', 'unknown']).optional(),
  device_id: z.string().trim().min(8).max(120),
  locale: z.string().trim().min(2).max(10).optional(),
});

const deleteSchema = z.object({
  device_id: z.string().trim().min(8).max(120),
});

function logPushTokenFailure(
  operation: 'register' | 'deactivate',
  stage: string,
  error?: { code?: string } | null,
) {
  console.error('[push-token] operation_failed', {
    operation,
    stage,
    errorCode: error?.code ?? null,
  });
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) {
    logPushTokenFailure('register', 'validation');
    return parsed.error;
  }

  const supabase = createServiceClient();

  const { error } = await supabase.rpc('register_push_token_for_user', {
    p_user_id: auth.userId,
    p_expo_push_token: parsed.data.expo_push_token,
    p_device_id: parsed.data.device_id,
    p_platform: parsed.data.platform ?? 'unknown',
    p_locale: parsed.data.locale ?? null,
  });

  if (error) {
    logPushTokenFailure('register', 'database_registration', error);
    return fail('Could not save push token', 500, error.message);
  }

  return ok({ saved: true });
}

export async function DELETE(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(deleteSchema, body);
  if ('error' in parsed) {
    logPushTokenFailure('deactivate', 'validation');
    return parsed.error;
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('deactivate_push_token_for_user', {
    p_user_id: auth.userId,
    p_device_id: parsed.data.device_id,
  });

  if (error) {
    logPushTokenFailure('deactivate', 'database_deactivation', error);
    return fail('Could not deactivate push token', 500, error.message);
  }
  return ok({ deactivated: typeof data === 'number' ? data : 0 });
}
