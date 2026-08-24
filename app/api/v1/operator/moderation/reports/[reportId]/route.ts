import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { parseQuery } from '@/lib/validation';
import { requireOperatorAccess } from '@/lib/operatorAuth';
import { createServiceClient } from '@/lib/supabase';
import { removeFeedMediaObjects } from '@/lib/accountDeletion';
import { refreshPostCounts } from '@/lib/social';

const paramsSchema = z.object({ reportId: z.string().uuid() });
const bodySchema = z.object({ action: z.enum(['reviewing', 'dismiss', 'remove']) });

type RouteParams = {
  params: Promise<{ reportId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const operator = requireOperatorAccess(req);
  if ('response' in operator) return operator.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid report id', 400);
  const parsedBody = parseQuery(bodySchema, await req.json().catch(() => null));
  if ('error' in parsedBody) return parsedBody.error;

  const supabase = createServiceClient();
  const { data: report, error: reportError } = await supabase
    .from('social_reports')
    .select('id, target_type, target_post_id, target_comment_id, target_user_id, reason_code, status')
    .eq('id', parsedParams.data.reportId)
    .maybeSingle();
  if (reportError || !report) return fail('Report not found', 404);

  if (parsedBody.data.action === 'reviewing' || parsedBody.data.action === 'dismiss') {
    const status = parsedBody.data.action === 'reviewing' ? 'reviewing' : 'dismissed';
    const { error } = await supabase.from('social_reports').update({ status }).eq('id', report.id);
    if (error) return fail('Could not update report', 500);
    return ok({ report_id: String(report.id), status });
  }

  if (report.target_type === 'post' && report.target_post_id) {
    const { data: post, error: postError } = await supabase
      .from('social_posts')
      .select('id, author_user_id')
      .eq('id', report.target_post_id)
      .maybeSingle();
    if (postError || !post) return fail('Reported post not found', 404);

    const { data: media, error: mediaError } = await supabase
      .from('social_post_media')
      .select('storage_bucket, storage_path')
      .eq('post_id', post.id);
    if (mediaError) return fail('Could not resolve reported media', 500);
    const cleanup = await removeFeedMediaObjects(supabase, String(post.author_user_id), media ?? []);
    if (cleanup.error) return fail('Could not remove reported media', 500);

    const { error: removeError } = await supabase
      .from('social_posts')
      .update({
        status: 'removed',
        moderation_state: 'rejected',
        moderation_reason: `operator_report:${String(report.reason_code)}`,
      })
      .eq('id', post.id);
    if (removeError) return fail('Could not remove reported post', 500);
  } else if (report.target_type === 'comment' && report.target_comment_id) {
    const { data: comment, error: commentError } = await supabase
      .from('social_comments')
      .select('id, post_id')
      .eq('id', report.target_comment_id)
      .maybeSingle();
    if (commentError || !comment) return fail('Reported comment not found', 404);

    const { error: removeError } = await supabase
      .from('social_comments')
      .update({
        status: 'removed',
        moderation_state: 'rejected',
        moderation_reason: `operator_report:${String(report.reason_code)}`,
      })
      .eq('id', comment.id);
    if (removeError) return fail('Could not remove reported comment', 500);
    await refreshPostCounts(supabase, String(comment.post_id));
  } else if (report.target_type === 'user' && report.target_user_id) {
    const targetUserId = String(report.target_user_id);
    const [{ data: media, error: mediaError }, { data: comments, error: commentsError }] = await Promise.all([
      supabase
        .from('social_post_media')
        .select('storage_bucket, storage_path, social_posts!inner(author_user_id)')
        .eq('social_posts.author_user_id', targetUserId),
      supabase
        .from('social_comments')
        .select('post_id')
        .eq('author_user_id', targetUserId)
        .eq('status', 'active'),
    ]);
    if (mediaError || commentsError) return fail('Could not resolve reported account content', 500);

    const cleanup = await removeFeedMediaObjects(supabase, targetUserId, media ?? []);
    if (cleanup.error) return fail('Could not remove reported account media', 500);

    const moderationReason = `operator_report:${String(report.reason_code)}`;
    const [{ error: postsError }, { error: commentsRemoveError }, { error: profileError }] = await Promise.all([
      supabase
        .from('social_posts')
        .update({ status: 'removed', moderation_state: 'rejected', moderation_reason: moderationReason })
        .eq('author_user_id', targetUserId),
      supabase
        .from('social_comments')
        .update({ status: 'removed', moderation_state: 'rejected', moderation_reason: moderationReason })
        .eq('author_user_id', targetUserId),
      supabase
        .from('social_profiles')
        .update({
          is_suspended: true,
          suspension_reason: moderationReason,
          suspended_at: new Date().toISOString(),
          allow_mentions: false,
        })
        .eq('user_id', targetUserId),
    ]);
    if (postsError || commentsRemoveError || profileError) {
      return fail('Could not suspend reported account', 500);
    }

    const affectedPostIds = [...new Set((comments ?? []).map((comment) => String(comment.post_id)))];
    await Promise.all(affectedPostIds.map((postId) => refreshPostCounts(supabase, postId)));
    await supabase
      .from('social_follows')
      .delete()
      .or(`follower_user_id.eq.${targetUserId},followed_user_id.eq.${targetUserId}`);
  } else {
    return fail('This report target cannot be removed automatically', 422);
  }

  const { error: resolveError } = await supabase
    .from('social_reports')
    .update({ status: 'resolved' })
    .eq('id', report.id);
  if (resolveError) return fail('Content removed but report status could not be updated', 500);

  return ok({ report_id: String(report.id), status: 'resolved', content_removed: true });
}
