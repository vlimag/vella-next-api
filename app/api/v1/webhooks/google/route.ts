import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';
import {
  getGooglePlaySubscription,
  subscriptionStateFromPlaySubscription,
  verifyGooglePubSubRequest,
} from '@/lib/googlePlay';
import { updateIapSubscriptionState } from '@/lib/iap';
import { VELLA_SUBSCRIPTION_PRODUCT_IDS } from '@/lib/iapProducts';

// Google Play Real-Time Developer Notifications, delivered as an authenticated
// Pub/Sub push. RTDN SubscriptionNotification contains a purchaseToken but no
// product ID; the current state and line-item product IDs must be loaded from
// purchases.subscriptionsv2.get before changing access.

type RtdnData = {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    purchaseToken?: string;
    notificationType?: number;
  };
  voidedPurchaseNotification?: {
    purchaseToken?: string;
    orderId?: string;
    productType?: number;
    refundType?: number;
  };
  testNotification?: { version?: string };
};

function eventTimestamp(eventTimeMillis: string | undefined): string {
  const milliseconds = Number(eventTimeMillis);
  return Number.isFinite(milliseconds) && milliseconds > 0
    ? new Date(milliseconds).toISOString()
    : new Date().toISOString();
}

export async function POST(req: Request) {
  const pushAuth = await verifyGooglePubSubRequest(req.headers.get('authorization'));
  if (!pushAuth.ok) {
    return NextResponse.json({ error: pushAuth.error }, { status: pushAuth.status });
  }

  const body = (await req.json().catch(() => null)) as
    | { message?: { data?: string; messageId?: string } }
    | null;
  const dataB64 = body?.message?.data;
  if (!dataB64) return NextResponse.json({ error: 'Missing message.data' }, { status: 400 });

  let decoded: RtdnData;
  try {
    decoded = JSON.parse(Buffer.from(dataB64, 'base64').toString('utf8')) as RtdnData;
  } catch {
    return NextResponse.json({ error: 'Invalid message.data' }, { status: 400 });
  }

  const configuredPackageName = process.env.ANDROID_PACKAGE_NAME?.trim();
  if (!configuredPackageName) {
    return NextResponse.json({ error: 'Google Play validation is not configured' }, { status: 503 });
  }

  const eventId = body?.message?.messageId ??
    crypto.createHash('sha256').update(dataB64).digest('hex');
  const eventAt = eventTimestamp(decoded.eventTimeMillis);
  const supabase = createServiceClient();
  const { data: event, error: eventError } = await supabase.from('billing_events').upsert(
    {
      provider: 'google',
      provider_event_id: eventId,
      event_type: String(
        decoded.subscriptionNotification?.notificationType ??
        (decoded.voidedPurchaseNotification ? 'voided_purchase' : 'unknown'),
      ),
      payload: decoded as unknown as Record<string, unknown>,
    },
    { onConflict: 'provider,provider_event_id' },
  ).select('processed_at').single();
  if (eventError) {
    console.error('[google-webhook] event_persistence_failed', { eventId, error: eventError.message });
    return NextResponse.json({ error: 'Could not persist notification' }, { status: 503 });
  }
  if (event?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    if (decoded.packageName !== configuredPackageName) {
      // Authenticated topics may be shared across apps; safely acknowledge an
      // event that cannot belong to Vella after recording it for audit.
    } else if (
      decoded.voidedPurchaseNotification?.productType === 1 &&
      decoded.voidedPurchaseNotification.purchaseToken
    ) {
      const update = await updateIapSubscriptionState({
        provider: 'google',
        storeTransactionId: decoded.voidedPurchaseNotification.purchaseToken,
        active: false,
        endsAt: eventAt,
        eventAt,
        autoRenew: false,
      });
      if (update.error) throw new Error(update.error);
    } else if (decoded.subscriptionNotification?.purchaseToken) {
      const purchaseToken = decoded.subscriptionNotification.purchaseToken;
      const subscription = await getGooglePlaySubscription({
        packageName: configuredPackageName,
        purchaseToken,
      });
      const state = subscriptionStateFromPlaySubscription(
        subscription,
        VELLA_SUBSCRIPTION_PRODUCT_IDS,
      );
      if (state) {
        const update = await updateIapSubscriptionState({
          provider: 'google',
          storeTransactionId: purchaseToken,
          active: state.active,
          endsAt: state.expiresAt?.toISOString() ?? null,
          eventAt,
          autoRenew: state.autoRenew,
        });
        if (update.error) throw new Error(update.error);
      }
    }

    const { error: processedError } = await supabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'google')
      .eq('provider_event_id', eventId);
    if (processedError) throw new Error(processedError.message);
  } catch (error) {
    console.error('[google-webhook] notification_processing_failed', {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Any non-ack status causes Pub/Sub to retry rather than silently revoking
    // access on a transient Play API or database failure.
    return NextResponse.json({ error: 'Could not process notification' }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
