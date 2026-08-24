import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('user_notifications')
    .select('id, kind, title, body, data, is_read, created_at')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit ?? 30);

  if (error) return fail('Could not load notifications', 500, error.message);
  return ok({ items: data ?? [] });
}
