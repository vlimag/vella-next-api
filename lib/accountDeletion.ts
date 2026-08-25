import type { createServiceClient } from '@/lib/supabase';
import {
  avatarStoragePathBelongsToUser,
  avatarStoragePathFromPublicUrl,
} from '@/lib/profileAvatar';

type ServiceClient = ReturnType<typeof createServiceClient>;

const REMOVE_BATCH_SIZE = 100;

const USER_ROW_DELETE_TARGETS = [
  { table: 'social_mentions', column: 'mentioned_by_user_id' },
  { table: 'social_mentions', column: 'mentioned_user_id' },
  { table: 'social_reports', column: 'reporter_user_id' },
  { table: 'social_reports', column: 'target_user_id' },
  { table: 'social_comment_likes', column: 'user_id' },
  { table: 'social_comments', column: 'author_user_id' },
  { table: 'social_post_likes', column: 'user_id' },
  { table: 'social_post_shares', column: 'user_id' },
  { table: 'social_blocks', column: 'blocker_user_id' },
  { table: 'social_blocks', column: 'blocked_user_id' },
  { table: 'social_follows', column: 'follower_user_id' },
  { table: 'social_follows', column: 'followed_user_id' },
  { table: 'social_eula_acceptances', column: 'user_id' },
  { table: 'social_posts', column: 'author_user_id' },
  { table: 'social_profiles', column: 'user_id' },
  { table: 'prayer_checkins', column: 'user_id' },
  { table: 'prayer_intentions', column: 'user_id' },
  { table: 'daily_verse_notification_deliveries', column: 'user_id' },
  { table: 'push_notification_deliveries', column: 'user_id' },
  { table: 'user_push_tokens', column: 'user_id' },
  { table: 'group_plan_assignments', column: 'assigned_by_user_id' },
  { table: 'group_members', column: 'user_id' },
  { table: 'groups', column: 'owner_user_id' },
  { table: 'user_milestones', column: 'user_id' },
  { table: 'user_journeys', column: 'user_id' },
  { table: 'user_plan_progress', column: 'user_id' },
  { table: 'verse_favorites', column: 'user_id' },
  { table: 'verse_notes', column: 'user_id' },
  { table: 'bookmarks', column: 'user_id' },
  { table: 'highlights', column: 'user_id' },
  { table: 'notes', column: 'user_id' },
  { table: 'user_notifications', column: 'user_id' },
  { table: 'user_settings', column: 'user_id' },
  { table: 'entitlements', column: 'user_id' },
  { table: 'subscriptions', column: 'user_id' },
  { table: 'growth_install_profile_links', column: 'user_id' },
  { table: 'profiles', column: 'id' },
] as const;

const USER_ROW_SET_NULL_TARGETS = [
  { table: 'subscription_marketing_transitions', column: 'user_id' },
  { table: 'in_app_purchase_receipts', column: 'user_id' },
  { table: 'failed_receipts', column: 'user_id' },
  { table: 'iap_client_events', column: 'user_id' },
] as const;

function optionalMigrationTableIsNotInstalled(
  error: { code?: string; message?: string } | null,
  table: 'subscription_marketing_transitions' | 'growth_install_profile_links',
): boolean {
  const message = error?.message ?? '';
  const target = `faith_harbor.${table}`;
  if (!message.includes(target)) return false;
  if (error?.code === 'PGRST205') {
    return message.includes('Could not find the table') && message.includes('schema cache');
  }
  if (error?.code === '42P01') {
    return message.includes('relation') && message.includes('does not exist');
  }
  return false;
}

function allowedFeedMediaBuckets() {
  return new Set([
    process.env.SUPABASE_FEED_MEDIA_BUCKET?.trim() || 'faith-harbor-feed-media',
    // Legacy migration default; keep deletion compatible with older uploads.
    'feed-media',
  ]);
}

export async function removeUserProfileAvatar(
  supabase: ServiceClient,
  userId: string,
): Promise<{ removed: number; error?: string }> {
  const { data, error } = await supabase
    .from('social_profiles')
    .select('avatar_url')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return { removed: 0, error: error.message };
  if (!data?.avatar_url) return { removed: 0 };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) return { removed: 0, error: 'Profile avatar storage is not configured' };
  const ownerSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!ownerSecret) return { removed: 0, error: 'Profile avatar ownership is not configured' };
  const bucket = process.env.SUPABASE_PROFILE_AVATARS_BUCKET?.trim() || 'faith-harbor-profile-avatars';
  const storagePath = avatarStoragePathFromPublicUrl(String(data.avatar_url), supabaseUrl, bucket);
  if (!storagePath || !avatarStoragePathBelongsToUser(storagePath, userId, ownerSecret)) {
    return { removed: 0 };
  }

  const { error: removeError } = await supabase.storage.from(bucket).remove([storagePath]);
  if (removeError) return { removed: 0, error: removeError.message };
  return { removed: 1 };
}

export type FeedMediaObject = {
  storage_bucket: unknown;
  storage_path: unknown;
};

export async function removeFeedMediaObjects(
  supabase: ServiceClient,
  userId: string,
  objects: FeedMediaObject[],
): Promise<{ removed: number; error?: string }> {
  const allowedBuckets = allowedFeedMediaBuckets();
  const pathsByBucket = new Map<string, string[]>();
  for (const row of objects) {
    const bucket = String(row.storage_bucket ?? '');
    const storagePath = String(row.storage_path ?? '');
    if (!allowedBuckets.has(bucket) || !storagePath.startsWith(`${userId}/`)) {
      return { removed: 0, error: 'Account media metadata contains an unsafe storage path' };
    }
    const paths = pathsByBucket.get(bucket) ?? [];
    paths.push(storagePath);
    pathsByBucket.set(bucket, paths);
  }

  let removed = 0;
  for (const [bucket, paths] of pathsByBucket) {
    for (let start = 0; start < paths.length; start += REMOVE_BATCH_SIZE) {
      const batch = paths.slice(start, start + REMOVE_BATCH_SIZE);
      const { error: removeError } = await supabase.storage.from(bucket).remove(batch);
      if (removeError) return { removed, error: removeError.message };
      removed += batch.length;
    }
  }

  return { removed };
}

/** Remove public feed-media objects before the database rows cascade away. */
export async function removeUserFeedMedia(
  supabase: ServiceClient,
  userId: string,
): Promise<{ removed: number; error?: string }> {
  const { data, error } = await supabase
    .from('social_post_media')
    .select('storage_bucket, storage_path, social_posts!inner(author_user_id)')
    .eq('social_posts.author_user_id', userId);

  if (error) return { removed: 0, error: error.message };

  return removeFeedMediaObjects(supabase, userId, data ?? []);
}

export async function deleteUserApplicationData(
  supabase: ServiceClient,
  userId: string,
): Promise<{ error?: string }> {
  // Preserve retained coarse billing history without its account link
  // before deleting the live subscription and entitlement records.
  for (const target of USER_ROW_SET_NULL_TARGETS) {
    const { error } = await supabase
      .from(target.table)
      .update({ [target.column]: null })
      .eq(target.column, userId);

    if (
      error &&
      target.table === 'subscription_marketing_transitions' &&
      optionalMigrationTableIsNotInstalled(error, 'subscription_marketing_transitions')
    ) {
      continue;
    }
    if (error) {
      return { error: `Could not clear ${target.table}.${target.column}: ${error.message}` };
    }
  }

  // The database BEFORE DELETE trigger on growth_install_profile_links
  // atomically seals retained installs and erases their profile-derived
  // digests before the current associations are removed.
  for (const target of USER_ROW_DELETE_TARGETS) {
    const { error } = await supabase
      .from(target.table)
      .delete()
      .eq(target.column, userId);

    if (
      error &&
      target.table === 'growth_install_profile_links' &&
      optionalMigrationTableIsNotInstalled(error, 'growth_install_profile_links')
    ) {
      continue;
    }
    if (error) {
      return { error: `Could not delete ${target.table}.${target.column}: ${error.message}` };
    }
  }

  return {};
}
