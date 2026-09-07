import { describe, expect, it } from 'vitest';
import { entitlementIsUsableForIdentity } from '@/lib/entitlements';

describe('store entitlement identity boundary', () => {
  const canonical = {
    entitlement_code: 'premium_individual',
    metadata: { platform: 'ios' },
  };
  const storeGuest = {
    entitlement_code: 'premium_individual',
    metadata: { platform: 'ios', access_scope: 'store_guest' },
  };

  it('lets an anonymous installation use canonical or guest store access', () => {
    expect(entitlementIsUsableForIdentity(canonical, { isAnonymous: true })).toBe(true);
    expect(entitlementIsUsableForIdentity(storeGuest, { isAnonymous: true })).toBe(true);
  });

  it('never lets a new permanent account inherit a guest entitlement', () => {
    expect(entitlementIsUsableForIdentity(canonical, { isAnonymous: false })).toBe(true);
    expect(entitlementIsUsableForIdentity(storeGuest, { isAnonymous: false })).toBe(false);
  });
});
