import { createServiceClient } from '@/lib/supabase';

/**
 * Server-side source of truth for premium access.
 *
 * Returns true when the user (or a group they belong to) has an active
 * entitlement whose code starts with "premium". Anonymous actors (no userId)
 * are never premium.
 *
 * This mirrors the logic in `GET /api/v1/me/entitlements` so paywall gating and
 * the client-facing status endpoint can never drift apart.
 */
type EntitlementIdentityOptions = {
  isAnonymous?: boolean;
};

type EntitlementAccessRow = {
  entitlement_code: unknown;
  metadata?: unknown;
};

export function entitlementIsUsableForIdentity(
  entitlement: EntitlementAccessRow,
  options: EntitlementIdentityOptions = {},
) {
  const metadata = entitlement.metadata && typeof entitlement.metadata === 'object'
    ? entitlement.metadata as Record<string, unknown>
    : null;
  const isStoreGuest = metadata?.access_scope === 'store_guest';
  return options.isAnonymous === true || !isStoreGuest;
}

export async function userHasActivePremium(
  userId: string | null | undefined,
  options: EntitlementIdentityOptions = {},
): Promise<boolean> {
  if (!userId) return false;

  const supabase = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: own, error: ownError } = await supabase
    .from('entitlements')
    .select('entitlement_code, metadata')
    .eq('user_id', userId)
    .eq('active', true)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (ownError) {
    throw new Error(`Failed to load user entitlements: ${ownError.message}`);
  }

  if ((own ?? []).some((e) => (
    entitlementIsUsableForIdentity(e, options)
    && String(e.entitlement_code).startsWith('premium')
  ))) {
    return true;
  }

  // Group-shared entitlements (e.g. premium_family) cover every member.
  const { data: memberships, error: membershipError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId);

  if (membershipError) {
    throw new Error(`Failed to load group memberships: ${membershipError.message}`);
  }

  const groupIds = (memberships ?? []).map((m) => m.group_id);
  if (groupIds.length === 0) return false;

  const { data: groupEnts, error: groupError } = await supabase
    .from('entitlements')
    .select('entitlement_code')
    .in('group_id', groupIds)
    .eq('active', true)
    .lte('starts_at', nowIso)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (groupError) {
    throw new Error(`Failed to load group entitlements: ${groupError.message}`);
  }

  return (groupEnts ?? []).some((e) => String(e.entitlement_code).startsWith('premium'));
}
