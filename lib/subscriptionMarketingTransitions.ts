import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';

const claimedTransitionSchema = z.object({
  transition_id: z.string().uuid(),
  plan: z.enum(['monthly', 'yearly']),
  phase: z.enum(['trial', 'paid']),
  occurred_at: z.string().datetime({ offset: true }),
}).passthrough();

export const transitionAcknowledgementSchema = z.object({
  transitionId: z.string().uuid(),
}).strict();

export type SubscriptionMarketingTransition = {
  transitionId: string;
  plan: 'monthly' | 'yearly';
  phase: 'trial' | 'paid';
  occurredAt: string;
};

export async function claimSubscriptionMarketingTransition(
  userId: string,
): Promise<SubscriptionMarketingTransition | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('claim_subscription_marketing_transition', {
    p_user_id: userId,
  });
  if (error) throw new Error('Could not claim a subscription transition');
  if (!Array.isArray(data) || data.length === 0) return null;
  if (data.length !== 1) throw new Error('Malformed subscription transition claim');

  const parsed = claimedTransitionSchema.safeParse(data[0]);
  if (!parsed.success) throw new Error('Malformed subscription transition claim');
  return {
    transitionId: parsed.data.transition_id,
    plan: parsed.data.plan,
    phase: parsed.data.phase,
    occurredAt: parsed.data.occurred_at,
  };
}

export async function acknowledgeSubscriptionMarketingTransition(
  userId: string,
  transitionId: string,
): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('ack_subscription_marketing_transition', {
    p_user_id: userId,
    p_transition_id: transitionId,
  });
  if (error || typeof data !== 'boolean') {
    throw new Error('Could not acknowledge a subscription transition');
  }
  return data;
}
