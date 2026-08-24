import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isBlockedPair, isSocialUserSuspended } from '@/lib/social';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const paramsSchema = z.object({
  userId: z.string().uuid(),
});

type RouteParams = {
  params: Promise<{ userId: string }>;
};

export async function POST(_req: Request, { params }: RouteParams) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return fail('Invalid user id', 400, parsedParams.error.flatten());
  }

  const targetUserId = parsedParams.data.userId;
  if (targetUserId === auth.userId) {
    return fail('You cannot follow yourself', 400);
  }

  const supabase = createServiceClient();

  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community interactions are unavailable for this account.', 403, { code: 'social_suspended' });
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from('social_profiles')
    .select('user_id')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (targetError) return fail('Could not validate target user', 500, targetError.message);
  if (!targetProfile) return fail('User not found', 404);

  const blocked = await isBlockedPair(supabase, auth.userId, targetUserId);
  if (blocked) return fail('Follow is unavailable for this user', 403);

  const { data: existingFollow, error: existingError } = await supabase
    .from('social_follows')
    .select('id')
    .eq('follower_user_id', auth.userId)
    .eq('followed_user_id', targetUserId)
    .maybeSingle();

  if (existingError) return fail('Could not check follow state', 500, existingError.message);

  if (existingFollow?.id) {
    const { error: deleteError } = await supabase
      .from('social_follows')
      .delete()
      .eq('id', existingFollow.id);

    if (deleteError) return fail('Could not unfollow user', 500, deleteError.message);

    return ok({ user_id: targetUserId, following: false });
  }

  const { error: insertError } = await supabase
    .from('social_follows')
    .insert({
      follower_user_id: auth.userId,
      followed_user_id: targetUserId,
    });

  if (insertError) return fail('Could not follow user', 500, insertError.message);

  return ok({ user_id: targetUserId, following: true });
}
