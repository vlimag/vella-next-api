import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase';

function toPlanCode(sub: Stripe.Subscription) {
  return sub.items.data[0]?.price?.id ?? 'premium_individual';
}

function toEntitlementCode(planCode: string) {
  if (planCode.includes('family')) return 'premium_family';
  return 'premium_individual';
}

function isActiveStatus(status: Stripe.Subscription.Status) {
  return ['active', 'trialing', 'past_due'].includes(status);
}

export async function syncSubscriptionFromStripe(sub: Stripe.Subscription) {
  const supabase = createServiceClient();

  const metadata = sub.metadata ?? {};
  const userId = metadata.user_id || null;
  const groupId = metadata.group_id || null;
  const planCode = toPlanCode(sub);

  if (!userId && !groupId) {
    return { skipped: true, reason: 'Missing user_id/group_id metadata on subscription' as const };
  }

  const { data: upserted, error: upsertError } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        group_id: groupId,
        stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : null,
        stripe_subscription_id: sub.id,
        status: sub.status,
        plan_code: planCode,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        metadata,
      },
      { onConflict: 'stripe_subscription_id' },
    )
    .select('id')
    .single();

  if (upsertError || !upserted) {
    return { skipped: false, error: upsertError?.message ?? 'Failed to upsert subscription' };
  }

  const entitlementCode = toEntitlementCode(planCode);
  const active = isActiveStatus(sub.status);

  await supabase.from('entitlements').delete().eq('subscription_id', upserted.id).eq('entitlement_code', entitlementCode);

  const { error: entError } = await supabase.from('entitlements').insert({
    user_id: userId,
    group_id: groupId,
    subscription_id: upserted.id,
    entitlement_code: entitlementCode,
    source: 'stripe',
    starts_at: new Date(sub.current_period_start * 1000).toISOString(),
    ends_at: new Date(sub.current_period_end * 1000).toISOString(),
    active,
    metadata,
  });

  if (entError) {
    return { skipped: false, error: entError.message };
  }

  return { skipped: false, synced: true };
}
