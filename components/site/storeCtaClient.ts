'use client';

import {
  STORE_CAMPAIGN,
  STORE_CTA_EVENT,
  storeCtaId,
  type StoreCtaPlacement,
} from '@/lib/site/config';

export type VisitorPlatform = 'android' | 'ios' | 'desktop';

export function detectVisitorPlatform(): VisitorPlatform {
  const userAgent = navigator.userAgent ?? '';
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/i.test(userAgent)) return 'ios';
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios';
  return 'desktop';
}

export function reportStoreCta(placement: StoreCtaPlacement, platform: 'android' | 'ios') {
  // Analytics can subscribe to this first-party event later without coupling
  // website conversion paths to a specific vendor SDK.
  window.dispatchEvent(new CustomEvent(STORE_CTA_EVENT, {
    detail: {
      id: storeCtaId(placement, platform),
      placement,
      platform,
      campaign: STORE_CAMPAIGN,
    },
  }));
}
