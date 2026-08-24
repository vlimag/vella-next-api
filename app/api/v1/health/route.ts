import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export async function GET() {
  const appleIap = Boolean(process.env.APPLE_SHARED_SECRET?.trim());
  const googleIap = Boolean(
    process.env.ANDROID_PACKAGE_NAME?.trim() &&
    process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON?.trim(),
  );
  const googleWebhook = Boolean(
    process.env.GOOGLE_PUBSUB_AUDIENCE?.trim() &&
    process.env.GOOGLE_PUBSUB_SERVICE_ACCOUNT_EMAIL?.trim(),
  );

  let databaseSchema = false;
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from('subscriptions')
      .select('id, provider, store_product_id, store_transaction_id, store_event_at')
      .limit(0);
    databaseSchema = !error;
  } catch {
    databaseSchema = false;
  }

  const ready = appleIap && googleIap && googleWebhook && databaseSchema;
  return NextResponse.json({
    status: ready ? 'ok' : 'degraded',
    service: 'vella-api',
    checks: {
      apple_iap: appleIap,
      google_iap: googleIap,
      google_webhook: googleWebhook,
      database_schema: databaseSchema,
    },
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503 });
}
