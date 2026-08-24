import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  user_id: z.string().uuid(),
  reason: z.string().trim().max(300).optional(),
});

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  if (parsed.data.user_id === auth.userId) {
    return fail('You cannot block yourself', 400);
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('social_blocks')
    .upsert(
      {
        blocker_user_id: auth.userId,
        blocked_user_id: parsed.data.user_id,
        reason: parsed.data.reason ?? null,
      },
      { onConflict: 'blocker_user_id,blocked_user_id' },
    );

  if (error) return fail('Could not block this user', 500, error.message);

  const { error: followCleanupError } = await supabase
    .from('social_follows')
    .delete()
    .or(
      `and(follower_user_id.eq.${auth.userId},followed_user_id.eq.${parsed.data.user_id}),` +
      `and(follower_user_id.eq.${parsed.data.user_id},followed_user_id.eq.${auth.userId})`,
    );
  if (followCleanupError) {
    console.error('[social-block] follow_cleanup_failed', {
      blockerUserId: auth.userId,
      blockedUserId: parsed.data.user_id,
      error: followCleanupError.message,
    });
  }

  return ok({ blocked: true });
}
