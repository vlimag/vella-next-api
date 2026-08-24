import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  invite_code: z.string().trim().min(4).max(20),
});

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id, name, description, language_code, invite_code')
    .eq('invite_code', parsed.data.invite_code.toUpperCase())
    .single();

  if (groupError || !group) return fail('Invalid invite code', 404);

  const { error: membershipError } = await supabase.from('group_members').upsert(
    {
      group_id: group.id,
      user_id: auth.userId,
      role: 'member',
    },
    { onConflict: 'group_id,user_id', ignoreDuplicates: true },
  );

  if (membershipError) return fail('Unable to join group', 500, membershipError.message);

  return ok(group, { status: 201 });
}
