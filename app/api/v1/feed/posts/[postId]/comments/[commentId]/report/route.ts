import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const paramsSchema = z.object({
  postId: z.string().uuid(),
  commentId: z.string().uuid(),
});
const bodySchema = z.object({
  reason_code: z.string().trim().min(2).max(60),
  details: z.string().trim().max(500).optional(),
});

type RouteParams = {
  params: Promise<{ postId: string; commentId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid comment id', 400);
  const parsedBody = parseQuery(bodySchema, await req.json().catch(() => null));
  if ('error' in parsedBody) return parsedBody.error;

  const supabase = createServiceClient();
  const { data: comment, error: commentError } = await supabase
    .from('social_comments')
    .select('id, status, social_posts!inner(status)')
    .eq('id', parsedParams.data.commentId)
    .eq('post_id', parsedParams.data.postId)
    .maybeSingle();
  const parentPost = Array.isArray(comment?.social_posts)
    ? comment?.social_posts[0]
    : comment?.social_posts;
  if (commentError || !comment || comment.status !== 'active' || parentPost?.status !== 'active') {
    return fail('Comment not found', 404);
  }

  const { data: existingReport } = await supabase
    .from('social_reports')
    .select('id')
    .eq('reporter_user_id', auth.userId)
    .eq('target_type', 'comment')
    .eq('target_comment_id', comment.id)
    .in('status', ['open', 'reviewing'])
    .limit(1)
    .maybeSingle();
  if (existingReport?.id) return ok({ reported: true, duplicate: true });

  const { error } = await supabase.from('social_reports').insert({
    reporter_user_id: auth.userId,
    target_type: 'comment',
    target_comment_id: comment.id,
    reason_code: parsedBody.data.reason_code,
    details: parsedBody.data.details ?? null,
    status: 'open',
  });
  if (error) return fail('Could not submit report', 500, error.message);

  console.info('[social-report] queued', { targetType: 'comment', targetId: comment.id });
  return ok({ reported: true }, { status: 201 });
}
