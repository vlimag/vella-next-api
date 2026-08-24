import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const paramsSchema = z.object({ userId: z.string().uuid() });
const bodySchema = z.object({
  reason_code: z.string().trim().min(2).max(60),
  details: z.string().trim().max(500).optional(),
});

type RouteParams = { params: Promise<{ userId: string }> };

export async function POST(req: Request, { params }: RouteParams) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid user id', 400);
  if (parsedParams.data.userId === auth.userId) return fail('You cannot report yourself', 400);
  const parsedBody = parseQuery(bodySchema, await req.json().catch(() => null));
  if ('error' in parsedBody) return parsedBody.error;

  const supabase = createServiceClient();
  const { data: profile, error: profileError } = await supabase
    .from('social_profiles')
    .select('user_id')
    .eq('user_id', parsedParams.data.userId)
    .maybeSingle();
  if (profileError || !profile) return fail('User not found', 404);

  const { data: existingReport } = await supabase
    .from('social_reports')
    .select('id')
    .eq('reporter_user_id', auth.userId)
    .eq('target_type', 'user')
    .eq('target_user_id', parsedParams.data.userId)
    .in('status', ['open', 'reviewing'])
    .limit(1)
    .maybeSingle();
  if (existingReport?.id) return ok({ reported: true, duplicate: true });

  const { error } = await supabase.from('social_reports').insert({
    reporter_user_id: auth.userId,
    target_type: 'user',
    target_user_id: parsedParams.data.userId,
    reason_code: parsedBody.data.reason_code,
    details: parsedBody.data.details ?? null,
    status: 'open',
  });
  if (error) return fail('Could not submit report', 500, error.message);

  console.info('[social-report] queued', { targetType: 'user', targetId: parsedParams.data.userId });
  return ok({ reported: true }, { status: 201 });
}
