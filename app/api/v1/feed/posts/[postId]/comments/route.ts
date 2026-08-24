import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import {
  CURRENT_SOCIAL_EULA_VERSION,
  ensureSocialProfile,
  getBlockedUserIdsForViewer,
  hasAcceptedSocialEula,
  isBlockedPair,
  isSocialUserSuspended,
  processMentions,
  refreshPostCounts,
  safeSocialAvatarUrl,
} from '@/lib/social';
import { moderateFaithContent } from '@/lib/socialModeration';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  body: z.string().trim().min(1).max(1200),
});

type RouteParams = {
  params: Promise<{ postId: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { postId } = await params;
  const viewerUserId = access.userId;
  const supabase = createServiceClient();

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id, author_user_id, status')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post || post.status !== 'active') return fail('Post not found', 404);

  if (viewerUserId) {
    const blocked = await isBlockedPair(supabase, viewerUserId, post.author_user_id);
    if (blocked) return ok({ items: [] });
  }

  const { data: comments, error } = await supabase
    .from('social_comments')
    .select('id, post_id, author_user_id, body, like_count, created_at')
    .eq('post_id', postId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) return fail('Could not load comments', 500, error.message);

  const blockedUserIds = viewerUserId
    ? await getBlockedUserIdsForViewer(supabase, viewerUserId)
    : new Set<string>();
  const visibleComments = (comments ?? []).filter(
    (comment) => !blockedUserIds.has(String(comment.author_user_id)),
  );

  const authorIds = [...new Set(visibleComments.map((comment) => String(comment.author_user_id)))];
  const commentIds = visibleComments.map((comment) => String(comment.id));

  const [{ data: profiles }, { data: likedRows }] = await Promise.all([
    authorIds.length > 0
      ? supabase
          .from('social_profiles')
          .select('user_id, handle, display_name, avatar_url')
          .in('user_id', authorIds)
      : Promise.resolve({ data: [], error: null }),
    viewerUserId && commentIds.length > 0
      ? supabase
          .from('social_comment_likes')
          .select('comment_id')
          .eq('user_id', viewerUserId)
          .in('comment_id', commentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileById = new Map<string, { handle: string; display_name: string; avatar_url: string | null }>();
  for (const profile of profiles ?? []) {
    profileById.set(String(profile.user_id), {
      handle: String(profile.handle ?? 'faith_user'),
      display_name: String(profile.display_name ?? 'Faith user'),
      avatar_url: safeSocialAvatarUrl(String(profile.user_id), profile.avatar_url),
    });
  }

  const likedSet = new Set((likedRows ?? []).map((row) => String(row.comment_id)));

  return ok({
    items: visibleComments.map((comment) => {
      const author = profileById.get(String(comment.author_user_id));
      return {
        id: comment.id,
        post_id: comment.post_id,
        body: comment.body,
        like_count: comment.like_count,
        created_at: comment.created_at,
        liked_by_me: likedSet.has(String(comment.id)),
        author: {
          user_id: comment.author_user_id,
          handle: author?.handle ?? `faith_${String(comment.author_user_id).slice(0, 6)}`,
          display_name: author?.display_name ?? 'Faith user',
          avatar_url: author?.avatar_url ?? null,
        },
      };
    }),
  });
}

export async function POST(req: Request, { params }: RouteParams) {
  const { postId } = await params;
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();

  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community commenting is unavailable for this account.', 403, { code: 'social_suspended' });
  }

  const acceptedEula = await hasAcceptedSocialEula(
    supabase,
    auth.userId,
    CURRENT_SOCIAL_EULA_VERSION,
  );
  if (!acceptedEula) {
    return fail('You must accept the community terms before commenting.', 403, {
      code: 'social_eula_required',
      required_version: CURRENT_SOCIAL_EULA_VERSION,
    });
  }

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id, author_user_id, status')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post || post.status !== 'active') return fail('Post not found', 404);

  const blocked = await isBlockedPair(supabase, auth.userId, post.author_user_id);
  if (blocked) return fail('You cannot comment on this post', 403);

  const moderation = await moderateFaithContent(parsed.data.body);
  if (!moderation.allowed) {
    return fail(moderation.reason, 422, {
      tags: moderation.tags,
      source: moderation.source,
    });
  }

  const profile = await ensureSocialProfile(supabase, auth.userId);

  const { data: comment, error } = await supabase
    .from('social_comments')
    .insert({
      post_id: postId,
      author_user_id: auth.userId,
      body: parsed.data.body,
      moderation_state: 'approved',
      moderation_reason: moderation.reason,
    })
    .select('id, post_id, author_user_id, body, like_count, created_at')
    .single();

  if (error || !comment) return fail('Could not create comment', 500, error?.message);

  await Promise.all([
    refreshPostCounts(supabase, postId),
    processMentions({
      supabase,
      sourceType: 'comment',
      sourceCommentId: comment.id,
      authorUserId: auth.userId,
      body: comment.body,
    }),
  ]);

  return ok({
    id: comment.id,
    post_id: comment.post_id,
    body: comment.body,
    like_count: comment.like_count,
    created_at: comment.created_at,
    liked_by_me: false,
    author: {
      user_id: comment.author_user_id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: null,
    },
  }, { status: 201 });
}
