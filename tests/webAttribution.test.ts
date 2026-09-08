import { describe, expect, it } from 'vitest';
import * as webAttribution from '@/lib/site/webAttribution';
import { STORE_CAMPAIGN } from '@/lib/site/config';

const canonicalCampaign = (webAttribution as typeof webAttribution & {
  canonicalCampaign?: (value: string | null) => string;
}).canonicalCampaign;
const { canonicalRouteClass, coarseReferrerClass } = webAttribution;

describe('web acquisition attribution', () => {
  it('reduces localized URLs to bounded canonical route classes', () => {
    expect(canonicalRouteClass('/pt/blog/a-gentle-daily-scripture-rhythm')).toBe('blog_article');
    expect(canonicalRouteClass('/features/prayer-space')).toBe('prayer_space');
    expect(canonicalRouteClass('/unrecognized-private-path')).toBe('other');
  });

  it('reduces referrers to coarse classes without retaining the URL', () => {
    expect(coarseReferrerClass('https://www.google.com/search?q=private+prayer')).toBe('search');
    expect(coarseReferrerClass('https://www.instagram.com/vella')).toBe('social');
    expect(coarseReferrerClass('https://vella.one/pt/blog')).toBe('internal');
    expect(coarseReferrerClass('https://example.com/private?q=one')).toBe('referral');
    expect(coarseReferrerClass('https://notgoogle.com/search?q=private+prayer')).toBe('referral');
    expect(coarseReferrerClass('https://example.instagram.com.evil.test/vella')).toBe('referral');
    expect(coarseReferrerClass('')).toBe('direct');
  });

  it('only keeps approved website campaigns from query parameters', () => {
    expect(canonicalCampaign?.('android_first_launch')).toBe(STORE_CAMPAIGN);
    expect(canonicalCampaign?.('unreviewed_campaign')).toBe(STORE_CAMPAIGN);
    expect(canonicalCampaign?.('android_first_launch?private=value')).toBe(STORE_CAMPAIGN);
  });
});
