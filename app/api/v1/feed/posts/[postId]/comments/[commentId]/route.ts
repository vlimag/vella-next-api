import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { refreshPostCounts } from '@/lib/social';

const paramsSchema = z.object({
  postId: z.string().uuid(),
  commentId: z.string().uuid(),
});

type RouteParams = {
  params: Promise<{ postId: string; commentId: string }>;
};

export async function DELETE(_req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return fail('Invalid comment id', 400);

  const supabase = createServiceClient();
  const { data: comment, error: commentError } = await supabase
    .from('social_comments')
    .select('id, post_id, author_user_id')
    .eq('id', parsed.data.commentId)
    .eq('post_id', parsed.data.postId)
    .eq('author_user_id', access.userId)
    .maybeSingle();

  // Do not reveal whether another user owns the requested comment.
  if (commentError || !comment) return fail('Comment not found', 404);

  const { error: deleteError } = await supabase
    .from('social_comments')
    .delete()
    .eq('id', comment.id)
    .eq('author_user_id', access.userId);
  if (deleteError) return fail('Could not delete comment', 500);

  await refreshPostCounts(supabase, String(comment.post_id));
  return ok({
    deleted: true,
    post_id: String(comment.post_id),
    comment_id: String(comment.id),
  });
}
