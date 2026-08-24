import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isBlockedPair, isSocialUserSuspended, refreshPostCounts } from '@/lib/social';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

type RouteParams = {
  params: Promise<{ postId: string }>;
};

export async function POST(_req: Request, { params }: RouteParams) {
  const { postId } = await params;
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const supabase = createServiceClient();

  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community interactions are unavailable for this account.', 403, { code: 'social_suspended' });
  }

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id, author_user_id, status')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post || post.status !== 'active') return fail('Post not found', 404);

  const blocked = await isBlockedPair(supabase, auth.userId, post.author_user_id);
  if (blocked) return fail('You cannot interact with this post', 403);

  const { data: existing } = await supabase
    .from('social_post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', auth.userId)
    .maybeSingle();

  let liked = false;
  if (existing?.id) {
    const { error: deleteError } = await supabase
      .from('social_post_likes')
      .delete()
      .eq('id', existing.id);
    if (deleteError) return fail('Could not remove like', 500, deleteError.message);
    liked = false;
  } else {
    const { error: insertError } = await supabase
      .from('social_post_likes')
      .insert({
        post_id: postId,
        user_id: auth.userId,
      });
    if (insertError) return fail('Could not like this post', 500, insertError.message);
    liked = true;
  }

  const counts = await refreshPostCounts(supabase, postId);
  return ok({
    post_id: postId,
    liked,
    like_count: counts.like_count,
  });
}
