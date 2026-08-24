import type { SupabaseClient } from '@supabase/supabase-js';
import { sendTrackedPushMessages } from '@/lib/generalPushDeliveries';
import {
  avatarStoragePathBelongsToUser,
  avatarStoragePathFromPublicUrl,
} from '@/lib/profileAvatar';

export const CURRENT_SOCIAL_EULA_VERSION = '1.1';

export function safeSocialAvatarUrl(userId: string, avatarUrl: unknown) {
  if (typeof avatarUrl !== 'string' || !avatarUrl) return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const ownerSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !ownerSecret) return null;
  const bucket = process.env.SUPABASE_PROFILE_AVATARS_BUCKET?.trim()
    || 'faith-harbor-profile-avatars';
  const storagePath = avatarStoragePathFromPublicUrl(avatarUrl, supabaseUrl, bucket);
  return storagePath && avatarStoragePathBelongsToUser(storagePath, userId, ownerSecret)
    ? avatarUrl
    : null;
}

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

type MentionTarget = {
  user_id: string;
  handle: string;
  display_name: string;
  allow_mentions: boolean;
};

const HANDLE_REGEX = /(?:^|\s)@([a-z0-9_]{3,24})\b/gi;

function extractMentionHandles(body: string) {
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = HANDLE_REGEX.exec(body)) !== null) {
    const handle = match[1]?.toLowerCase();
    if (handle) {
      found.add(handle);
    }
  }
  return [...found];
}

async function loadMentionTargets(
  supabase: AppSupabaseClient,
  handles: string[],
) {
  if (handles.length === 0) return [];

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, handle, display_name, allow_mentions')
    .in('handle', handles);

  if (error || !data) {
    return [];
  }

  return data as MentionTarget[];
}

async function sendPushNotifications(
  supabase: AppSupabaseClient,
  targets: Array<{ userId: string; title: string; body: string; data: Record<string, unknown> }>,
) {
  if (targets.length === 0) return;

  const userIds = [...new Set(targets.map((t) => t.userId))];
  const { data: tokens, error: tokensError } = await supabase
    .from('user_push_tokens')
    .select('id, user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', userIds);

  if (tokensError || !tokens || tokens.length === 0) return;

  const messages = [];
  for (const target of targets) {
    const userTokens = tokens.filter((item) => item.user_id === target.userId);
    for (const item of userTokens) {
      messages.push({
        tokenId: item.id,
        userId: target.userId,
        category: 'social' as const,
        message: {
          to: item.expo_push_token,
          sound: 'default' as const,
          title: target.title,
          body: target.body,
          data: target.data,
        },
      });
    }
  }

  if (messages.length === 0) return;

  try {
    await sendTrackedPushMessages(supabase, messages);
  } catch (error) {
    console.error('[social-notifications] push_send_failed', {
      error: error instanceof Error ? error.message : String(error),
      messageCount: messages.length,
    });
  }
}

export async function ensureSocialProfile(supabase: AppSupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('social_profiles')
    .select('user_id, handle, display_name, avatar_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return {
      ...existing,
      avatar_url: safeSocialAvatarUrl(userId, existing.avatar_url),
    };
  }

  const handle = `vella_${userId.replace(/-/g, '').slice(0, 8)}`;
  const displayName = 'Vella member';

  const { data: inserted, error } = await supabase
    .from('social_profiles')
    .upsert(
      {
        user_id: userId,
        handle,
        display_name: displayName,
      },
      { onConflict: 'user_id' },
    )
    .select('user_id, handle, display_name, avatar_url')
    .single();

  if (error || !inserted) {
    throw new Error(`Could not ensure social profile: ${error?.message}`);
  }

  return {
    ...inserted,
    avatar_url: safeSocialAvatarUrl(userId, inserted.avatar_url),
  };
}

export async function processMentions(args: {
  supabase: AppSupabaseClient;
  sourceType: 'post' | 'comment';
  sourcePostId?: string;
  sourceCommentId?: string;
  authorUserId: string;
  body: string;
}) {
  const handles = extractMentionHandles(args.body);
  if (handles.length === 0) return { count: 0 };

  const targets = await loadMentionTargets(args.supabase, handles);
  if (targets.length === 0) return { count: 0 };

  const blockedStates = await Promise.all(
    targets.map((target) => isBlockedPair(args.supabase, args.authorUserId, target.user_id)),
  );
  const reachableTargets = targets.filter((_, index) => !blockedStates[index]);

  const mentionRows = reachableTargets
    .filter((target) => target.user_id !== args.authorUserId && target.allow_mentions)
    .map((target) => ({
      source_type: args.sourceType,
      source_post_id: args.sourceType === 'post' ? args.sourcePostId ?? null : null,
      source_comment_id: args.sourceType === 'comment' ? args.sourceCommentId ?? null : null,
      mentioned_user_id: target.user_id,
      mentioned_by_user_id: args.authorUserId,
    }));

  if (mentionRows.length === 0) return { count: 0 };

  const { error: mentionError } = await args.supabase
    .from('social_mentions')
    .insert(mentionRows);

  if (mentionError) {
    console.error('[social-mentions] insert_failed', { error: mentionError.message });
  }

  const notifications = mentionRows.map((row) => ({
    user_id: row.mentioned_user_id,
    kind: args.sourceType === 'post' ? 'mention_post' : 'mention_comment',
    title: args.sourceType === 'post' ? 'You were mentioned in a post' : 'You were mentioned in a comment',
    body: 'Open Vella to see the conversation.',
    data: {
      source_type: args.sourceType,
      source_post_id: row.source_post_id,
      source_comment_id: row.source_comment_id,
      mentioned_by_user_id: row.mentioned_by_user_id,
    },
  }));

  const { error: notificationError } = await args.supabase
    .from('user_notifications')
    .insert(notifications);

  if (notificationError) {
    console.error('[social-notifications] insert_failed', { error: notificationError.message });
  }

  await sendPushNotifications(
    args.supabase,
    notifications.map((item) => ({
      userId: item.user_id,
      title: item.title,
      body: item.body,
      data: item.data as Record<string, unknown>,
    })),
  );

  return { count: mentionRows.length };
}

export async function refreshPostCounts(supabase: AppSupabaseClient, postId: string) {
  const [{ count: likeCount }, { count: commentCount }, { count: shareCount }] = await Promise.all([
    supabase
      .from('social_post_likes')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
    supabase
      .from('social_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId)
      .eq('status', 'active'),
    supabase
      .from('social_post_shares')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', postId),
  ]);

  const normalized = {
    like_count: likeCount ?? 0,
    comment_count: commentCount ?? 0,
    share_count: shareCount ?? 0,
  };

  await supabase
    .from('social_posts')
    .update(normalized)
    .eq('id', postId);

  return normalized;
}

export async function isBlockedPair(
  supabase: AppSupabaseClient,
  userId: string,
  otherUserId: string,
) {
  const { data, error } = await supabase
    .from('social_blocks')
    .select('id')
    .or(`and(blocker_user_id.eq.${userId},blocked_user_id.eq.${otherUserId}),and(blocker_user_id.eq.${otherUserId},blocked_user_id.eq.${userId})`)
    .limit(1);

  if (error) return false;
  return Boolean(data && data.length > 0);
}

export async function getBlockedUserIdsForViewer(
  supabase: AppSupabaseClient,
  viewerUserId: string,
) {
  const { data, error } = await supabase
    .from('social_blocks')
    .select('blocker_user_id, blocked_user_id')
    .or(`blocker_user_id.eq.${viewerUserId},blocked_user_id.eq.${viewerUserId}`);

  const blockedUserIds = new Set<string>();
  if (error) return blockedUserIds;

  for (const row of data ?? []) {
    const blocker = String(row.blocker_user_id ?? '');
    const blocked = String(row.blocked_user_id ?? '');
    if (blocker === viewerUserId && blocked) blockedUserIds.add(blocked);
    if (blocked === viewerUserId && blocker) blockedUserIds.add(blocker);
  }
  return blockedUserIds;
}

export async function hasAcceptedSocialEula(
  supabase: AppSupabaseClient,
  userId: string,
  version = CURRENT_SOCIAL_EULA_VERSION,
) {
  const { data, error } = await supabase
    .from('social_eula_acceptances')
    .select('id')
    .eq('user_id', userId)
    .eq('eula_version', version)
    .maybeSingle();

  if (error) return false;
  return Boolean(data?.id);
}

export async function isSocialUserSuspended(
  supabase: AppSupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase
    .from('social_profiles')
    .select('is_suspended')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[social-suspension] status_check_failed', {
      userId,
      error: error.message,
    });
    return false;
  }
  return Boolean(data?.is_suspended);
}
