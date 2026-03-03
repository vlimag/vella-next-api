import { z } from 'zod';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getStripe } from '@/lib/stripe';
import { parseQuery } from '@/lib/validation';

const bodySchema = z.object({
  priceId: z.string().trim().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  scope: z.enum(['user', 'group']).default('user'),
  groupId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const scope = parsed.data.scope ?? 'user';
  const groupId = parsed.data.groupId;

  if (scope === 'group' && !groupId) {
    return fail('groupId is required when scope is group', 400);
  }

  const supabase = createServiceClient();

  if (scope === 'group' && groupId) {
    const { data: membership, error } = await supabase
      .from('group_members')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', auth.userId)
      .maybeSingle();

    if (error) return fail('Failed to validate group membership', 500, error.message);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return fail('Only owner/admin can purchase for group', 403);
    }
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    success_url: parsed.data.successUrl,
    cancel_url: parsed.data.cancelUrl,
    line_items: [{ price: parsed.data.priceId, quantity: 1 }],
    metadata: {
      user_id: scope === 'user' ? auth.userId : '',
      group_id: scope === 'group' ? groupId ?? '' : '',
      scope,
    },
    subscription_data: {
      metadata: {
        user_id: scope === 'user' ? auth.userId : '',
        group_id: scope === 'group' ? groupId ?? '' : '',
      },
    },
  });

  return ok({ id: session.id, url: session.url });
}
