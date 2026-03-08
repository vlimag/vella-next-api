import type { SupabaseClient } from '@supabase/supabase-js';

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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
  targets: Array<{ userId: string; title: string; body: string; data: Record<string, unknown> }>,
) {
  if (targets.length === 0) return;

  const userIds = [...new Set(targets.map((t) => t.userId))];
  const { data: tokens, error: tokensError } = await supabase
    .from('user_push_tokens')
    .select('user_id, expo_push_token')
    .eq('is_active', true)
    .in('user_id', userIds);

  if (tokensError || !tokens || tokens.length === 0) return;

  const messages: Array<Record<string, unknown>> = [];
  for (const target of targets) {
    const userTokens = tokens.filter((item) => item.user_id === target.userId);
    for (const item of userTokens) {
      messages.push({
        to: item.expo_push_token,
        sound: 'default',
        title: target.title,
        body: target.body,
        data: target.data,
      });
    }
  }

  if (messages.length === 0) return;

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });
  } catch (error) {
    console.error('[social-notifications] push_send_failed', {
      error: error instanceof Error ? error.message : String(error),
      messageCount: messages.length,
    });
  }
}

export async function ensureSocialProfile(supabase: SupabaseClient, userId: string) {
  const { data: existing } = await supabase
    .from('social_profiles')
    .select('user_id, handle, display_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    return existing;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, email')
    .eq('id', userId)
    .maybeSingle();

  const baseHandle = String(
    profile?.email?.split?.('@')?.[0] ??
      profile?.display_name ??
      'faith_user',
  )
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16) || 'faithuser';
  const handle = `${baseHandle}_${userId.replace(/-/g, '').slice(0, 6)}`;
  const displayName = (profile?.display_name || profile?.email?.split?.('@')?.[0] || 'Faith user').slice(0, 80);

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
    .select('user_id, handle, display_name')
    .single();

  if (error || !inserted) {
    throw new Error(`Could not ensure social profile: ${error?.message}`);
  }

  return inserted;
}

export async function processMentions(args: {
  supabase: SupabaseClient;
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

  const mentionRows = targets
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
    body: 'Open FaithHarbor to see the conversation.',
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

export async function refreshPostCounts(supabase: SupabaseClient, postId: string) {
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
  supabase: SupabaseClient,
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
