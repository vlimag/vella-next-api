import { z } from 'zod';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { isVellaSubscriptionProduct } from '@/lib/iapProducts';
import { createServiceClient } from '@/lib/supabase';

const safeVersion = z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9._+~-]+$/);
const safeBuild = z.string().trim().min(1).max(24).regex(/^[A-Za-z0-9._+~-]+$/);
const safeErrorCode = z.string().trim().min(1).max(64).regex(/^[a-z0-9][a-z0-9_]{0,63}$/);

const bodySchema = z.object({
  eventId: z.string().uuid(),
  platform: z.enum(['ios', 'android']),
  productId: z.string().trim().min(1).optional(),
  stage: z.enum([
    'connection',
    'products',
    'purchase_request',
    'purchase_callback',
    'receipt',
    'validation',
    'finish',
    'restore',
  ]),
  outcome: z.enum([
    'started',
    'succeeded',
    'cancelled',
    'failed',
    'timed_out',
    'unavailable',
    'rejected',
    'empty',
  ]),
  errorCode: safeErrorCode.optional(),
  appVersion: safeVersion.optional(),
  buildNumber: safeBuild.optional(),
  runtimeVersion: safeVersion.optional(),
}).strict();

export async function POST(req: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid IAP diagnostic event', 400, { code: 'invalid_iap_event' });
  }
  if (parsed.data.productId && !isVellaSubscriptionProduct(parsed.data.productId)) {
    return fail('Unknown subscription product', 400, { code: 'product_not_allowed' });
  }

  const supabase = createServiceClient();
  const { error } = await supabase.from('iap_client_events').upsert({
    event_id: parsed.data.eventId,
    user_id: auth.userId,
    platform: parsed.data.platform,
    product_id: parsed.data.productId ?? null,
    stage: parsed.data.stage,
    outcome: parsed.data.outcome,
    error_code: parsed.data.errorCode ?? null,
    app_version: parsed.data.appVersion ?? null,
    build_number: parsed.data.buildNumber ?? null,
    runtime_version: parsed.data.runtimeVersion ?? null,
  }, { onConflict: 'event_id', ignoreDuplicates: true });

  if (error) {
    console.error('[iap.client-event] write_failed', {
      stage: parsed.data.stage,
      outcome: parsed.data.outcome,
      databaseErrorCode: typeof error.code === 'string' ? error.code : 'unknown',
    });
    return fail('Could not record IAP diagnostic event', 503, {
      code: 'iap_diagnostics_unavailable',
    });
  }

  return ok({ recorded: true }, {
    status: 202,
    headers: { 'Cache-Control': 'no-store' },
  });
}

