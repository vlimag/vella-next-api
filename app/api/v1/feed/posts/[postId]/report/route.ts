import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { parseQuery } from '@/lib/validation';

const bodySchema = z.object({
  reason_code: z.string().trim().min(2).max(60),
  details: z.string().trim().max(500).optional(),
});

type RouteParams = {
  params: Promise<{ postId: string }>;
};

export async function POST(req: Request, { params }: RouteParams) {
  const { postId } = await params;
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post) return fail('Post not found', 404);

  const { error } = await supabase
    .from('social_reports')
    .insert({
      reporter_user_id: auth.userId,
      target_type: 'post',
      target_post_id: postId,
      reason_code: parsed.data.reason_code,
      details: parsed.data.details ?? null,
      status: 'open',
    });

  if (error) return fail('Could not submit report', 500, error.message);

  return ok({ reported: true }, { status: 201 });
}
