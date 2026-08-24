import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  user_id: z.string().uuid(),
});

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('social_blocks')
    .delete()
    .eq('blocker_user_id', auth.userId)
    .eq('blocked_user_id', parsed.data.user_id);

  if (error) return fail('Could not unblock this user', 500, error.message);

  return ok({
    unblocked: true,
    user_id: parsed.data.user_id,
  });
}
