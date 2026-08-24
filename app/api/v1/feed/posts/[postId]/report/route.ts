import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  reason_code: z.string().trim().min(2).max(60),
  details: z.string().trim().max(500).optional(),
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

  const { data: post, error: postError } = await supabase
    .from('social_posts')
    .select('id, status')
    .eq('id', postId)
    .maybeSingle();

  if (postError || !post || post.status !== 'active') return fail('Post not found', 404);

  const { data: existingReport } = await supabase
    .from('social_reports')
    .select('id')
    .eq('reporter_user_id', auth.userId)
    .eq('target_type', 'post')
    .eq('target_post_id', postId)
    .in('status', ['open', 'reviewing'])
    .limit(1)
    .maybeSingle();
  if (existingReport?.id) return ok({ reported: true, duplicate: true });

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

  console.info('[social-report] queued', { targetType: 'post', targetId: postId });

  return ok({ reported: true }, { status: 201 });
}
