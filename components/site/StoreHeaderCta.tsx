'use client';

import { useEffect, useState } from 'react';
import {
  ANDROID_STORE_AVAILABLE,
  APP_STORE_URL,
  IOS_STORE_AVAILABLE,
  STORE_CAMPAIGN,
  playStoreCampaignUrl,
  storeCtaId,
  type StoreCtaPlacement,
} from '@/lib/site/config';
import { detectVisitorPlatform, reportStoreCta, type VisitorPlatform } from './storeCtaClient';

export function StoreHeaderCta({
  className,
  label,
  iosUnavailableLabel,
  fallbackHref,
  placement,
}: {
  className: string;
  label: string;
  iosUnavailableLabel: string;
  fallbackHref: string;
  placement: Extract<StoreCtaPlacement, 'header-desktop' | 'header-mobile'>;
}) {
  const [platform, setPlatform] = useState<VisitorPlatform | 'unknown'>('unknown');

  useEffect(() => {
    setPlatform(detectVisitorPlatform());
  }, []);

  const iosDirect = platform === 'ios' && IOS_STORE_AVAILABLE;
  const androidDirect = platform !== 'unknown'
    && platform !== 'ios'
    && ANDROID_STORE_AVAILABLE;
  const isDirect = iosDirect || androidDirect;
  const storePlatform = iosDirect ? 'ios' : 'android';
  const href = iosDirect
    ? APP_STORE_URL
    : androidDirect
      ? playStoreCampaignUrl(placement)
      : fallbackHref;
  const displayedLabel = platform === 'ios' && !IOS_STORE_AVAILABLE
    ? iosUnavailableLabel
    : label;

  return (
    <a
      id={isDirect ? storeCtaId(placement, storePlatform) : `vella-store-availability-${placement}`}
      className={className}
      href={href}
      target={isDirect ? '_blank' : undefined}
      rel={isDirect ? 'noopener noreferrer' : undefined}
      data-vella-cta={isDirect ? 'store' : 'store-availability'}
      data-cta-platform={isDirect ? storePlatform : platform}
      data-cta-placement={placement}
      data-cta-campaign={STORE_CAMPAIGN}
      onClick={isDirect ? () => reportStoreCta(placement, storePlatform) : undefined}
    >
      {displayedLabel}
    </a>
  );
}
