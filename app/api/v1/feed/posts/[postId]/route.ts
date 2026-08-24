import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { removeFeedMediaObjects } from '@/lib/accountDeletion';

const paramsSchema = z.object({ postId: z.string().uuid() });

type RouteParams = {
  params: Promise<{ postId: string }>;
};

export async function DELETE(_req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return fail('Invalid post id', 400);

  const supabase = createServiceClient();
  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id, author_user_id')
    .eq('id', parsed.data.postId)
    .eq('author_user_id', access.userId)
    .maybeSingle();

  // Do not reveal whether another user owns the requested post.
  if (postError || !post) return fail('Post not found', 404);

  const { data: media, error: mediaError } = await supabase
    .from('social_post_media')
    .select('storage_bucket, storage_path')
    .eq('post_id', post.id);
  if (mediaError) return fail('Could not resolve post media', 500);

  const cleanup = await removeFeedMediaObjects(supabase, access.userId, media ?? []);
  if (cleanup.error) return fail('Could not delete post media', 500);

  const { error: deleteError } = await supabase
    .from('social_posts')
    .delete()
    .eq('id', post.id)
    .eq('author_user_id', access.userId);
  if (deleteError) return fail('Could not delete post', 500);

  return ok({ deleted: true, post_id: String(post.id) });
}
