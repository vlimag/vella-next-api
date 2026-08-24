import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isBlockedPair, isSocialUserSuspended } from '@/lib/social';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const paramsSchema = z.object({
  postId: z.string().uuid(),
  commentId: z.string().uuid(),
});

type RouteParams = {
  params: Promise<{ postId: string; commentId: string }>;
};

export async function POST(_req: Request, { params }: RouteParams) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return fail('Invalid comment id', 400);

  const supabase = createServiceClient();
  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community interactions are unavailable for this account.', 403, { code: 'social_suspended' });
  }
  const { data: comment, error: commentError } = await supabase
    .from('social_comments')
    .select('id, post_id, author_user_id, status, social_posts!inner(author_user_id, status)')
    .eq('id', parsed.data.commentId)
    .eq('post_id', parsed.data.postId)
    .maybeSingle();

  const parentPost = Array.isArray(comment?.social_posts)
    ? comment?.social_posts[0]
    : comment?.social_posts;
  if (
    commentError ||
    !comment ||
    comment.status !== 'active' ||
    !parentPost ||
    parentPost.status !== 'active'
  ) {
    return fail('Comment not found', 404);
  }

  const [blockedAuthor, blockedPostAuthor] = await Promise.all([
    isBlockedPair(supabase, auth.userId, String(comment.author_user_id)),
    isBlockedPair(supabase, auth.userId, String(parentPost.author_user_id)),
  ]);
  if (blockedAuthor || blockedPostAuthor) return fail('You cannot interact with this comment', 403);

  const { data: existing, error: existingError } = await supabase
    .from('social_comment_likes')
    .select('id')
    .eq('comment_id', comment.id)
    .eq('user_id', auth.userId)
    .maybeSingle();
  if (existingError) return fail('Could not check comment like', 500, existingError.message);

  let liked: boolean;
  if (existing?.id) {
    const { error } = await supabase.from('social_comment_likes').delete().eq('id', existing.id);
    if (error) return fail('Could not remove comment like', 500, error.message);
    liked = false;
  } else {
    const { error } = await supabase.from('social_comment_likes').insert({
      comment_id: comment.id,
      user_id: auth.userId,
    });
    if (error) return fail('Could not like comment', 500, error.message);
    liked = true;
  }

  const { count, error: countError } = await supabase
    .from('social_comment_likes')
    .select('id', { count: 'exact', head: true })
    .eq('comment_id', comment.id);
  if (countError) return fail('Could not refresh comment like count', 500, countError.message);

  const likeCount = count ?? 0;
  await supabase.from('social_comments').update({ like_count: likeCount }).eq('id', comment.id);

  return ok({
    post_id: parsed.data.postId,
    comment_id: parsed.data.commentId,
    liked,
    like_count: likeCount,
  });
}
