import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createServiceClient } from '@/lib/supabase';
import { updateIapSubscriptionState } from '@/lib/iap';
import { deriveAppleSubscriptionUpdate, verifyAppleNotification } from '@/lib/appleNotifications';
import { isVellaSubscriptionProduct } from '@/lib/iapProducts';

// App Store Server Notifications V2. The official Apple library validates the
// outer JWS and nested transaction/renewal JWS objects against Apple's pinned
// roots and Vella's bundle/App Apple ID before anything is persisted.

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { signedPayload?: string } | null;
  if (!body?.signedPayload) {
    return NextResponse.json({ error: 'Missing signedPayload' }, { status: 400 });
  }

  let verified;
  try {
    verified = await verifyAppleNotification(body.signedPayload);
  } catch (error) {
    console.warn('[apple-webhook] signature_verification_failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Invalid signedPayload' }, { status: 400 });
  }

  const payload = verified.notification;
  const eventId = payload.notificationUUID ??
    crypto.createHash('sha256').update(body.signedPayload).digest('hex');
  const supabase = createServiceClient();
  const { data: event, error: eventError } = await supabase.from('billing_events').upsert(
    {
      provider: 'apple',
      provider_event_id: eventId,
      event_type: payload.notificationType ?? 'unknown',
      payload: payload as unknown as Record<string, unknown>,
    },
    { onConflict: 'provider,provider_event_id' },
  ).select('processed_at').single();
  if (eventError) {
    console.error('[apple-webhook] event_persistence_failed', { eventId, error: eventError.message });
    return NextResponse.json({ error: 'Could not persist notification' }, { status: 503 });
  }
  if (event?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    const update = deriveAppleSubscriptionUpdate(verified);
    if (update && isVellaSubscriptionProduct(update.productId)) {
      const result = await updateIapSubscriptionState({
        provider: 'apple',
        storeTransactionId: update.originalTransactionId,
        active: update.active,
        endsAt: update.endsAt,
        eventAt: update.eventAt,
        autoRenew: update.autoRenew,
        billingPhase: update.billingPhase,
      });
      if (result.error) throw new Error(result.error);
      if (result.unlinked) throw new Error('subscription is not linked yet');
    }

    const { error: processedError } = await supabase
      .from('billing_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('provider', 'apple')
      .eq('provider_event_id', eventId);
    if (processedError) throw new Error(processedError.message);
  } catch (error) {
    console.error('[apple-webhook] notification_processing_failed', {
      eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Apple retries V2 notifications after a non-2xx response.
    return NextResponse.json({ error: 'Could not process notification' }, { status: 503 });
  }

  return NextResponse.json({ received: true });
}
