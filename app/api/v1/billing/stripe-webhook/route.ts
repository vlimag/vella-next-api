import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase';
import { syncSubscriptionFromStripe } from '@/lib/billing';
import { getStripe, getStripeWebhookSecret } from '@/lib/stripe';

export async function POST(req: Request) {
  let stripe;
  let webhookSecret;

  try {
    stripe = getStripe();
    webhookSecret = getStripeWebhookSecret();
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const payload = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: 'Invalid webhook signature', details: String(error) }, { status: 400 });
  }

  const supabase = createServiceClient();
  await supabase.from('billing_events').upsert(
    {
      provider: 'stripe',
      provider_event_id: event.id,
      event_type: event.type,
      payload: event,
      processed_at: new Date().toISOString(),
    },
    { onConflict: 'provider,provider_event_id' },
  );

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const result = await syncSubscriptionFromStripe(event.data.object as Stripe.Subscription);

    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;

    const { data: existing } = await supabase
      .from('subscriptions')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle();

    if (existing?.id) {
      await supabase
        .from('subscriptions')
        .update({ status: 'canceled', cancel_at_period_end: true })
        .eq('id', existing.id);

      await supabase
        .from('entitlements')
        .update({ active: false, ends_at: new Date().toISOString() })
        .eq('subscription_id', existing.id)
        .eq('source', 'stripe');
    }
  }

  return NextResponse.json({ received: true, eventType: event.type });
}
