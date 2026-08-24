'use client';

import React, { useEffect, useState } from 'react';
import {
  ANDROID_STORE_AVAILABLE,
  APP_STORE_URL,
  IOS_STORE_AVAILABLE,
  STORE_CAMPAIGN,
  playStoreCampaignUrl,
  storeCtaId,
  type StoreCtaPlacement,
} from '@/lib/site/config';
import type { SiteCopy } from '@/lib/site/types';
import { detectVisitorPlatform, reportStoreCta, type VisitorPlatform } from './storeCtaClient';

export function StoreLinks({
  copy,
  compact = false,
  placement = 'home-download',
}: {
  copy: SiteCopy['download'];
  compact?: boolean;
  placement?: StoreCtaPlacement;
}) {
  const [platform, setPlatform] = useState<VisitorPlatform>('desktop');

  useEffect(() => {
    setPlatform(detectVisitorPlatform());
  }, []);

  const androidButton = ANDROID_STORE_AVAILABLE ? (
    <a
      id={storeCtaId(placement, 'android')}
      key="android"
      className="store-button store-button-primary"
      href={playStoreCampaignUrl(placement)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.playStore}
      data-vella-cta="store"
      data-cta-platform="android"
      data-cta-placement={placement}
      data-cta-campaign={STORE_CAMPAIGN}
      onClick={() => reportStoreCta(placement, 'android')}
    >
      <span className="store-mark store-mark-play" aria-hidden="true">▶</span>
      <span><small>Android</small>{copy.playStore}</span>
    </a>
  ) : null;

  const iosButton = IOS_STORE_AVAILABLE ? (
    <a
      id={storeCtaId(placement, 'ios')}
      key="ios"
      className="store-button"
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={copy.appStore}
      data-vella-cta="store"
      data-cta-platform="ios"
      data-cta-placement={placement}
      data-cta-campaign={STORE_CAMPAIGN}
      onClick={() => reportStoreCta(placement, 'ios')}
    >
      <span className="store-mark" aria-hidden="true">●</span>
      <span><small>Apple</small>{copy.appStore}</span>
    </a>
  ) : (
    <span
      id={storeCtaId(placement, 'ios')}
      key="ios-unavailable"
      className="store-button store-button-unavailable"
      role="link"
      aria-label={copy.appStoreSoon}
      aria-disabled="true"
      data-vella-cta="store-unavailable"
      data-cta-platform="ios"
      data-cta-placement={placement}
    >
      <span className="store-mark" aria-hidden="true">●</span>
      <span><small>Apple</small>{copy.appStoreSoon}</span>
    </span>
  );

  const buttons = platform === 'android'
    ? [androidButton]
    : platform === 'ios'
      ? [iosButton, androidButton]
      : [androidButton, iosButton];

  return (
    <div
      className={compact ? 'store-links store-links-compact' : 'store-links'}
      data-visitor-platform={platform}
    >
      {buttons}
      {platform === 'desktop' && (ANDROID_STORE_AVAILABLE || IOS_STORE_AVAILABLE) ? (
        <p className="store-desktop-hint">{copy.desktopHint}</p>
      ) : null}
    </div>
  );
}
