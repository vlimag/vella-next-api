import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { requireOperatorAccess } from '@/lib/operatorAuth';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const querySchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const operator = requireOperatorAccess(req);
  if ('response' in operator) return operator.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    status: searchParams.get('status') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('social_reports')
    .select('id, reporter_user_id, target_type, target_post_id, target_comment_id, target_user_id, reason_code, details, status, created_at')
    .eq('status', parsed.data.status ?? 'open')
    .order('created_at', { ascending: true })
    .limit(parsed.data.limit ?? 50);

  if (error) return fail('Could not load moderation queue', 500);
  return ok({ items: data ?? [] });
}
