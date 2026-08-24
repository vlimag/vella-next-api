import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';
import {
  CURRENT_SOCIAL_EULA_VERSION,
  ensureSocialProfile,
  getBlockedUserIdsForViewer,
  hasAcceptedSocialEula,
  isSocialUserSuspended,
  processMentions,
  safeSocialAvatarUrl,
} from '@/lib/social';
import { moderateFaithPostContent } from '@/lib/socialModeration';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const FEED_MEDIA_BUCKET = process.env.SUPABASE_FEED_MEDIA_BUCKET ?? 'faith-harbor-feed-media';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const FEED_PAGE_SIZE_DEFAULT = 15;
const FEED_SCOPES = ['general', 'following'] as const;
const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  scope: z.enum(FEED_SCOPES).optional(),
  cursor_created_at: z.string().trim().min(10).max(64).optional(),
  cursor_id: z.string().uuid().optional(),
});

const bodySchema = z
  .object({
    body: z.string().trim().max(2200).default(''),
    language_code: localeSchema.optional(),
    image: z
      .object({
        base64: z.string().min(24).max(12_000_000),
        mime_type: z.enum(SUPPORTED_IMAGE_MIME_TYPES),
        width: z.number().int().positive().max(12_000).optional(),
        height: z.number().int().positive().max(12_000).optional(),
        file_size: z.number().int().positive().max(MAX_IMAGE_BYTES).optional(),
      })
      .optional(),
  })
  .refine((value) => value.body.trim().length > 0 || Boolean(value.image), {
    message: 'Write a caption or attach an image before posting.',
    path: ['body'],
  });

type FeedPostRow = {
  id: string;
  author_user_id: string;
  body: string;
  language_code: string;
  like_count: number;
  comment_count: number;
  share_count: number;
  created_at: string;
};

type FeedPostMediaRow = {
  id: string;
  post_id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  width: number | null;
  height: number | null;
  sort_order: number;
};

function imageExtensionForMimeType(mimeType: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic') return 'heic';
  if (mimeType === 'image/heif') return 'heif';
  return 'jpg';
}

function decodeBase64Image(base64: string) {
  const normalized = base64.replace(/\s/g, '');
  const bytes = Buffer.from(normalized, 'base64');
  if (!bytes || bytes.length === 0) {
    throw new Error('Image payload is invalid.');
  }
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error('Image is too large. Max size is 6 MB.');
  }
  return bytes;
}

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    limit: searchParams.get('limit') ?? undefined,
    scope: searchParams.get('scope') ?? undefined,
    cursor_created_at: searchParams.get('cursor_created_at') ?? undefined,
    cursor_id: searchParams.get('cursor_id') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  if (
    (parsed.data.cursor_created_at && !parsed.data.cursor_id) ||
    (!parsed.data.cursor_created_at && parsed.data.cursor_id)
  ) {
    return fail('Invalid cursor: cursor_created_at and cursor_id must be provided together', 400);
  }

  const limit = parsed.data.limit ?? FEED_PAGE_SIZE_DEFAULT;
  const scope = parsed.data.scope ?? 'general';
  const cursorCreatedAt = parsed.data.cursor_created_at ?? null;
  const cursorId = parsed.data.cursor_id ?? null;
  const viewerUserId = access.userId;
  const supabase = createServiceClient();

  if (scope === 'following' && !viewerUserId) {
    return ok({
      scope,
      has_more: false,
      next_cursor_created_at: null,
      next_cursor_id: null,
      items: [],
    });
  }

  let authorFilter: string[] | null = null;
  if (scope === 'following' && viewerUserId) {
    const { data: followingRows, error: followingError } = await supabase
      .from('social_follows')
      .select('followed_user_id')
      .eq('follower_user_id', viewerUserId);

    if (followingError) return fail('Could not load following feed', 500, followingError.message);

    const followedUserIds = new Set<string>((followingRows ?? []).map((row) => String(row.followed_user_id)));
    followedUserIds.add(viewerUserId);
    authorFilter = [...followedUserIds];
  }

  if (authorFilter && authorFilter.length === 0) {
    return ok({
      scope,
      has_more: false,
      next_cursor_created_at: null,
      next_cursor_id: null,
      items: [],
    });
  }

  const blockedUserIds = viewerUserId
    ? await getBlockedUserIdsForViewer(supabase, viewerUserId)
    : new Set<string>();

  let postsQuery = supabase
    .from('social_posts')
    .select('id, author_user_id, body, language_code, like_count, comment_count, share_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (authorFilter && authorFilter.length > 0) {
    postsQuery = postsQuery.in('author_user_id', authorFilter);
  }

  if (cursorCreatedAt) {
    postsQuery = postsQuery.lte('created_at', cursorCreatedAt);
  }

  const { data: rawPosts, error } = await postsQuery;
  if (error) return fail('Could not load feed posts', 500, error.message);

  let filteredPosts = (rawPosts ?? []) as FeedPostRow[];
  if (blockedUserIds.size > 0) {
    filteredPosts = filteredPosts.filter((post) => !blockedUserIds.has(post.author_user_id));
  }
  if (cursorCreatedAt && cursorId) {
    filteredPosts = filteredPosts.filter((post) => (
      post.created_at < cursorCreatedAt ||
      (post.created_at === cursorCreatedAt && post.id < cursorId)
    ));
  }

  const hasMore = filteredPosts.length > limit;
  const pagePosts = hasMore ? filteredPosts.slice(0, limit) : filteredPosts;

  const authorIds = [...new Set(pagePosts.map((post) => post.author_user_id))];
  const postIds = pagePosts.map((post) => post.id);

  const [{ data: profiles }, { data: likedRows }, { data: mediaRows }, { data: followRows }] = await Promise.all([
    authorIds.length > 0
      ? supabase
          .from('social_profiles')
          .select('user_id, handle, display_name, avatar_url')
          .in('user_id', authorIds)
      : Promise.resolve({ data: [], error: null }),
    viewerUserId && postIds.length > 0
      ? supabase
          .from('social_post_likes')
          .select('post_id')
          .eq('user_id', viewerUserId)
          .in('post_id', postIds)
      : Promise.resolve({ data: [], error: null }),
    postIds.length > 0
      ? supabase
          .from('social_post_media')
          .select('id, post_id, storage_bucket, storage_path, mime_type, width, height, sort_order')
          .in('post_id', postIds)
          .eq('moderation_state', 'approved')
          .order('sort_order', { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    viewerUserId && authorIds.length > 0
      ? supabase
          .from('social_follows')
          .select('followed_user_id')
          .eq('follower_user_id', viewerUserId)
          .in('followed_user_id', authorIds)
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

  const likedSet = new Set((likedRows ?? []).map((row) => String(row.post_id)));
  const followingSet = new Set((followRows ?? []).map((row) => String(row.followed_user_id)));

  const mediaByPostId = new Map<
    string,
    Array<{
      id: string;
      type: 'image';
      mime_type: string;
      width: number | null;
      height: number | null;
      url: string;
    }>
  >();

  for (const row of (mediaRows ?? []) as FeedPostMediaRow[]) {
    const mediaUrl = supabase.storage
      .from(row.storage_bucket)
      .getPublicUrl(row.storage_path).data.publicUrl;

    const current = mediaByPostId.get(row.post_id) ?? [];
    current.push({
      id: row.id,
      type: 'image',
      mime_type: row.mime_type,
      width: row.width,
      height: row.height,
      url: mediaUrl,
    });
    mediaByPostId.set(row.post_id, current);
  }

  const nextCursorPost = hasMore ? pagePosts[pagePosts.length - 1] : null;

  return ok({
    scope,
    has_more: hasMore,
    next_cursor_created_at: nextCursorPost?.created_at ?? null,
    next_cursor_id: nextCursorPost?.id ?? null,
    items: pagePosts.map((post) => {
      const author = profileById.get(post.author_user_id);
      return {
        id: post.id,
        body: post.body,
        language_code: post.language_code,
        like_count: post.like_count,
        comment_count: post.comment_count,
        share_count: post.share_count,
        created_at: post.created_at,
        liked_by_me: likedSet.has(post.id),
        is_following_author: viewerUserId
          ? post.author_user_id === viewerUserId || followingSet.has(post.author_user_id)
          : false,
        media: mediaByPostId.get(post.id) ?? [],
        author: {
          user_id: post.author_user_id,
          handle: author?.handle ?? `faith_${post.author_user_id.slice(0, 6)}`,
          display_name: author?.display_name ?? 'Faith user',
          avatar_url: author?.avatar_url ?? null,
        },
      };
    }),
  });
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;
  const supabase = createServiceClient();

  if (await isSocialUserSuspended(supabase, auth.userId)) {
    return fail('Community posting is unavailable for this account.', 403, { code: 'social_suspended' });
  }

  const acceptedEula = await hasAcceptedSocialEula(
    supabase,
    auth.userId,
    CURRENT_SOCIAL_EULA_VERSION,
  );
  if (!acceptedEula) {
    return fail('You must accept the community terms before posting.', 403, {
      code: 'social_eula_required',
      required_version: CURRENT_SOCIAL_EULA_VERSION,
    });
  }

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;
  const postBody = parsed.data.body ?? '';

  let imageDataUrl: string | undefined;
  let imageBytes: Buffer | null = null;
  let imageMimeType: string | null = null;
  let imageWidth: number | null = null;
  let imageHeight: number | null = null;

  if (parsed.data.image) {
    try {
      imageBytes = decodeBase64Image(parsed.data.image.base64);
      imageMimeType = parsed.data.image.mime_type;
      imageWidth = parsed.data.image.width ?? null;
      imageHeight = parsed.data.image.height ?? null;
      imageDataUrl = `data:${imageMimeType};base64,${parsed.data.image.base64.replace(/\s/g, '')}`;
    } catch (error) {
      return fail(
        error instanceof Error ? error.message : 'Image payload is invalid.',
        422,
      );
    }
  }

  const moderation = await moderateFaithPostContent({
    text: postBody,
    imageDataUrl,
  });

  if (!moderation.allowed) {
    return fail(moderation.reason, 422, {
      tags: moderation.tags,
      source: moderation.source,
    });
  }

  if (parsed.data.image && moderation.source !== 'openai') {
    return fail('Image moderation is temporarily unavailable. Try again in a moment.', 503);
  }

  const profile = await ensureSocialProfile(supabase, auth.userId);

  const { data: post, error } = await supabase
    .from('social_posts')
    .insert({
      author_user_id: auth.userId,
      body: postBody,
      language_code: parsed.data.language_code ?? 'en',
      moderation_state: moderation.allowed ? 'approved' : 'rejected',
      moderation_reason: moderation.reason,
    })
    .select('id, author_user_id, body, language_code, like_count, comment_count, share_count, created_at')
    .single();

  if (error || !post) return fail('Could not create feed post', 500, error?.message);

  let mediaPayload: Array<{
    id: string;
    type: 'image';
    mime_type: string;
    width: number | null;
    height: number | null;
    url: string;
  }> = [];

  if (imageBytes && imageMimeType) {
    const extension = imageExtensionForMimeType(imageMimeType);
    const storagePath = `${auth.userId}/${post.id}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(FEED_MEDIA_BUCKET)
      .upload(storagePath, imageBytes, {
        contentType: imageMimeType,
        upsert: false,
        cacheControl: '3600',
      });

    if (uploadError) {
      await supabase.from('social_posts').delete().eq('id', post.id);
      return fail('Could not upload image', 500, uploadError.message);
    }

    const { data: mediaRow, error: mediaError } = await supabase
      .from('social_post_media')
      .insert({
        post_id: post.id,
        storage_bucket: FEED_MEDIA_BUCKET,
        storage_path: storagePath,
        media_type: 'image',
        mime_type: imageMimeType,
        width: imageWidth,
        height: imageHeight,
        moderation_state: moderation.allowed ? 'approved' : 'rejected',
        moderation_reason: moderation.reason,
      })
      .select('id, storage_bucket, storage_path, mime_type, width, height')
      .single();

    if (mediaError || !mediaRow) {
      await supabase.storage.from(FEED_MEDIA_BUCKET).remove([storagePath]);
      await supabase.from('social_posts').delete().eq('id', post.id);
      return fail('Could not store media metadata', 500, mediaError?.message);
    }

    const mediaUrl = supabase.storage
      .from(String(mediaRow.storage_bucket))
      .getPublicUrl(String(mediaRow.storage_path)).data.publicUrl;

    mediaPayload = [
      {
        id: String(mediaRow.id),
        type: 'image',
        mime_type: String(mediaRow.mime_type),
        width: mediaRow.width ? Number(mediaRow.width) : null,
        height: mediaRow.height ? Number(mediaRow.height) : null,
        url: mediaUrl,
      },
    ];
  }

  await processMentions({
    supabase,
    sourceType: 'post',
    sourcePostId: post.id,
    authorUserId: auth.userId,
    body: post.body,
  });

  return ok({
    id: post.id,
    body: post.body,
    language_code: post.language_code,
    like_count: post.like_count,
    comment_count: post.comment_count,
    share_count: post.share_count,
    created_at: post.created_at,
    liked_by_me: false,
    is_following_author: true,
    media: mediaPayload,
    author: {
      user_id: post.author_user_id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url ?? null,
    },
  }, { status: 201 });
}
