import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getOptionalUserIdFromAuthHeader, getUserIdFromAuthHeader } from '@/lib/auth';
import { localeSchema, parseQuery } from '@/lib/validation';
import { ensureSocialProfile, processMentions } from '@/lib/social';
import { moderateFaithPostContent } from '@/lib/socialModeration';

const FEED_MEDIA_BUCKET = 'feed-media';
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
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
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const limit = parsed.data.limit ?? 20;
  const viewerUserId = await getOptionalUserIdFromAuthHeader();
  const supabase = createServiceClient();

  const { data: posts, error } = await supabase
    .from('social_posts')
    .select('id, author_user_id, body, language_code, like_count, comment_count, share_count, created_at')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return fail('Could not load feed posts', 500, error.message);

  let filteredPosts = (posts ?? []) as FeedPostRow[];

  if (viewerUserId && filteredPosts.length > 0) {
    const { data: blockRows } = await supabase
      .from('social_blocks')
      .select('blocker_user_id, blocked_user_id')
      .or(`blocker_user_id.eq.${viewerUserId},blocked_user_id.eq.${viewerUserId}`);

    const blockedUserIds = new Set<string>();
    for (const row of blockRows ?? []) {
      const blocker = String(row.blocker_user_id ?? '');
      const blocked = String(row.blocked_user_id ?? '');
      if (blocker === viewerUserId && blocked) {
        blockedUserIds.add(blocked);
      }
      if (blocked === viewerUserId && blocker) {
        blockedUserIds.add(blocker);
      }
    }

    filteredPosts = filteredPosts.filter((post) => !blockedUserIds.has(post.author_user_id));
  }

  const authorIds = [...new Set(filteredPosts.map((post) => post.author_user_id))];
  const postIds = filteredPosts.map((post) => post.id);

  const [{ data: profiles }, { data: likedRows }, { data: mediaRows }] = await Promise.all([
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
  ]);

  const profileById = new Map<string, { handle: string; display_name: string; avatar_url: string | null }>();
  for (const profile of profiles ?? []) {
    profileById.set(String(profile.user_id), {
      handle: String(profile.handle ?? 'faith_user'),
      display_name: String(profile.display_name ?? 'Faith user'),
      avatar_url: profile.avatar_url ? String(profile.avatar_url) : null,
    });
  }

  const likedSet = new Set((likedRows ?? []).map((row) => String(row.post_id)));

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

  return ok({
    items: filteredPosts.map((post) => {
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
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

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

  const supabase = createServiceClient();
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
    media: mediaPayload,
    author: {
      user_id: post.author_user_id,
      handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: null,
    },
  }, { status: 201 });
}
