import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getUserIdFromAuthHeader } from '@/lib/auth';

export async function GET() {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: ownEntitlements, error: ownError } = await supabase
    .from('entitlements')
    .select('id, entitlement_code, source, starts_at, ends_at, active, group_id')
    .eq('user_id', auth.userId)
    .eq('active', true)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (ownError) return fail('Failed loading user entitlements', 500, ownError.message);

  const { data: memberships, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', auth.userId);

  if (membershipError) return fail('Failed loading group memberships', 500, membershipError.message);

  const groupIds = (memberships ?? []).map((m) => m.group_id);

  let groupEntitlements: Array<Record<string, unknown>> = [];
  if (groupIds.length > 0) {
    const { data: groupData, error: groupError } = await supabase
      .from('entitlements')
      .select('id, entitlement_code, source, starts_at, ends_at, active, group_id')
      .in('group_id', groupIds)
      .eq('active', true)
      .lte('starts_at', nowIso)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (groupError) return fail('Failed loading group entitlements', 500, groupError.message);
    groupEntitlements = groupData ?? [];
  }

  const merged = [...(ownEntitlements ?? []), ...groupEntitlements];
  const hasPremium = merged.some((ent) => String(ent.entitlement_code).startsWith('premium'));

  return ok({ hasPremium, items: merged });
}
