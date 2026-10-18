'use client';

import {
  STORE_CAMPAIGN,
  STORE_CTA_EVENT,
  playStoreCampaignUrl,
  storeCtaId,
  type StoreCtaPlacement,
  type WebFirstTouch,
} from '@/lib/site/config';
import { firstTouchContext } from '@/lib/site/webAttribution';

let firstTouch: WebFirstTouch | undefined;

export function browserFirstTouch(): WebFirstTouch {
  if (firstTouch) return firstTouch;
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Disabled storage uses the in-memory snapshot. */ }
  firstTouch = firstTouchContext(window.location.pathname, document.referrer, storage);
  return firstTouch;
}

export function browserPlayStoreUrl(placement: StoreCtaPlacement): string {
  return playStoreCampaignUrl(placement, browserFirstTouch());
}

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
