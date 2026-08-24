import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { isBlockedPair, isSocialUserSuspended, refreshPostCounts } from '@/lib/social';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  share_channel: z.enum(['copy_link', 'system_share']).optional(),
});

type RouteParams = {
  params: Promise<{ postId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { postId } = await params;
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

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

  const { error: insertError } = await supabase
    .from('social_post_shares')
    .insert({
      post_id: postId,
      user_id: auth.userId,
      share_channel: parsed.data.share_channel ?? 'copy_link',
    });

  if (insertError) return fail('Could not register share', 500, insertError.message);

  const counts = await refreshPostCounts(supabase, postId);
  return ok({
    post_id: postId,
    share_count: counts.share_count,
  });
}
