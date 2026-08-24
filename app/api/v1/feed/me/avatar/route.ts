import { z } from 'zod';

import { getEnv } from '@/lib/env';
import { fail, ok } from '@/lib/http';
import {
  avatarStoragePathFromPublicUrl,
  avatarStoragePathBelongsToUser,
  buildAvatarStoragePath,
  decodeBase64Avatar,
  detectAvatarMimeType,
  normalizeAvatarImage,
  PROFILE_AVATAR_MAX_BYTES,
  PROFILE_AVATAR_MIME_TYPES,
} from '@/lib/profileAvatar';
import { ensureSocialProfile, isSocialUserSuspended } from '@/lib/social';
import { moderateSocialAvatarContent } from '@/lib/socialModeration';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const PROFILE_FIELDS = 'user_id, handle, display_name, bio, avatar_url, allow_mentions, is_private, created_at, updated_at';

const bodySchema = z.object({
  base64: z.string().min(24).max(8_000_000),
  mime_type: z.enum(PROFILE_AVATAR_MIME_TYPES),
  width: z.number().int().positive().max(12_000).optional(),
  height: z.number().int().positive().max(12_000).optional(),
  file_size: z.number().int().positive().max(PROFILE_AVATAR_MAX_BYTES).optional(),
});

function avatarBucket() {
  return process.env.SUPABASE_PROFILE_AVATARS_BUCKET?.trim() || 'faith-harbor-profile-avatars';
}

async function loadCurrentAvatar(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
) {
  return supabase
    .from('social_profiles')
    .select('avatar_url')
    .eq('user_id', userId)
    .single();
}

async function updateAvatar(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  avatarUrl: string | null,
  expectedAvatarUrl: string | null,
) {
  const query = supabase
    .from('social_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('user_id', userId);
  const guardedQuery = expectedAvatarUrl === null
    ? query.is('avatar_url', null)
    : query.eq('avatar_url', expectedAvatarUrl);
  return guardedQuery.select(PROFILE_FIELDS)
    .single();
}

async function removeOwnedAvatar(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  avatarUrl: string | null | undefined,
) {
  const bucket = avatarBucket();
  const storagePath = avatarStoragePathFromPublicUrl(
    avatarUrl,
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    bucket,
  );
  if (!storagePath || !avatarStoragePathBelongsToUser(
    storagePath,
    userId,
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )) return;

  const { error } = await supabase.storage.from(bucket).remove([storagePath]);
  if (error) {
    console.error('[profile-avatar] old_object_cleanup_failed', { error: error.message });
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  let imageBytes: Buffer;
  let normalizedMimeType: 'image/webp';
  try {
    imageBytes = decodeBase64Avatar(parsed.data.base64);
    detectAvatarMimeType(imageBytes);
    const normalized = await normalizeAvatarImage(imageBytes);
    imageBytes = normalized.bytes;
    normalizedMimeType = normalized.mimeType;
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Avatar image payload is invalid.', 422);
  }

  const imageDataUrl = `data:${normalizedMimeType};base64,${imageBytes.toString('base64')}`;
  const moderation = await moderateSocialAvatarContent(imageDataUrl);
  if (!moderation.allowed) {
    return fail(
      moderation.reason,
      moderation.tags.includes('moderation_unavailable') ? 503 : 422,
      { tags: moderation.tags, source: moderation.source },
    );
  }

  const supabase = createServiceClient();
  await ensureSocialProfile(supabase, auth.userId);
  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community profile updates are unavailable for this account.', 403, {
      code: 'social_suspended',
    });
  }

  const current = await loadCurrentAvatar(supabase, auth.userId);
  if (current.error) return fail('Could not load social profile', 500, current.error.message);

  const bucket = avatarBucket();
  const storagePath = buildAvatarStoragePath(
    normalizedMimeType,
    auth.userId,
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
  );
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, imageBytes, {
    contentType: normalizedMimeType,
    cacheControl: '31536000',
    upsert: false,
  });
  if (uploadError) return fail('Could not upload profile image', 500, uploadError.message);

  const avatarUrl = supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl;
  const currentAvatarUrl = current.data?.avatar_url ? String(current.data.avatar_url) : null;
  const updated = await updateAvatar(supabase, auth.userId, avatarUrl, currentAvatarUrl);
  if (updated.error || !updated.data) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return fail('Profile image changed while uploading. Try again.', 409);
  }

  await removeOwnedAvatar(supabase, auth.userId, currentAvatarUrl);
  return ok(updated.data);
}

export async function DELETE() {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const supabase = createServiceClient();
  await ensureSocialProfile(supabase, auth.userId);
  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community profile updates are unavailable for this account.', 403, {
      code: 'social_suspended',
    });
  }

  const current = await loadCurrentAvatar(supabase, auth.userId);
  if (current.error) return fail('Could not load social profile', 500, current.error.message);

  const currentAvatarUrl = current.data?.avatar_url ? String(current.data.avatar_url) : null;
  const updated = await updateAvatar(supabase, auth.userId, null, currentAvatarUrl);
  if (updated.error || !updated.data) {
    return fail('Profile image changed while removing. Try again.', 409);
  }

  await removeOwnedAvatar(supabase, auth.userId, currentAvatarUrl);
  return ok(updated.data);
}
