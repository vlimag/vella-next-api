import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { safeSocialAvatarUrl } from '@/lib/social';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

type BlockRow = {
  blocked_user_id: string;
  reason: string | null;
  created_at: string;
};

export async function GET(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const limit = parsed.data.limit ?? 80;

  const { data: rows, error } = await supabase
    .from('social_blocks')
    .select('blocked_user_id, reason, created_at')
    .eq('blocker_user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return fail('Could not load blocked users', 500, error.message);

  const blockedRows = (rows ?? []) as BlockRow[];
  const userIds = [...new Set(blockedRows.map((row) => String(row.blocked_user_id)))];

  const { data: profiles, error: profileError } = userIds.length
    ? await supabase
        .from('social_profiles')
        .select('user_id, handle, display_name, avatar_url')
        .in('user_id', userIds)
    : { data: [], error: null };

  if (profileError) return fail('Could not load blocked profile data', 500, profileError.message);

  const profileByUserId = new Map(
    (profiles ?? []).map((item) => [
      String(item.user_id),
      {
        handle: String(item.handle ?? `faith_${String(item.user_id).slice(0, 6)}`),
        display_name: String(item.display_name ?? 'Faith user'),
        avatar_url: safeSocialAvatarUrl(String(item.user_id), item.avatar_url),
      },
    ]),
  );

  return ok({
    items: blockedRows.map((row) => {
      const profile = profileByUserId.get(String(row.blocked_user_id));
      return {
        user_id: String(row.blocked_user_id),
        handle: profile?.handle ?? `faith_${String(row.blocked_user_id).slice(0, 6)}`,
        display_name: profile?.display_name ?? 'Faith user',
        avatar_url: profile?.avatar_url ?? null,
        reason: row.reason,
        blocked_at: row.created_at,
      };
    }),
  });
}
