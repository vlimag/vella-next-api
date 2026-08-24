import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { safeSocialAvatarUrl } from '@/lib/social';

const querySchema = z.object({
  q: z.string().trim().min(1).max(24),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    q: searchParams.get('q') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const viewerUserId = access.userId;

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, handle, display_name, avatar_url')
    .ilike('handle', `${parsed.data.q.toLowerCase()}%`)
    .order('handle', { ascending: true })
    .limit(parsed.data.limit ?? 8);

  if (error) return fail('Could not search users', 500, error.message);

  const blockedSet = new Set<string>();
  if (viewerUserId) {
    const { data: blocks } = await supabase
      .from('social_blocks')
      .select('blocker_user_id, blocked_user_id')
      .or(`blocker_user_id.eq.${viewerUserId},blocked_user_id.eq.${viewerUserId}`);
    for (const row of blocks ?? []) {
      const blocker = String(row.blocker_user_id ?? '');
      const blocked = String(row.blocked_user_id ?? '');
      if (blocker === viewerUserId && blocked) blockedSet.add(blocked);
      if (blocked === viewerUserId && blocker) blockedSet.add(blocker);
    }
  }

  return ok({
    items: (data ?? [])
      .filter((item) => !blockedSet.has(String(item.user_id)))
      .map((item) => ({
        user_id: item.user_id,
        handle: item.handle,
        display_name: item.display_name,
        avatar_url: safeSocialAvatarUrl(String(item.user_id), item.avatar_url),
      })),
  });
}
