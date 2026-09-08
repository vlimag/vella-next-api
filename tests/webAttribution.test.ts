import { describe, expect, it } from 'vitest';
import { canonicalRouteClass, coarseReferrerClass } from '@/lib/site/webAttribution';

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
    expect(coarseReferrerClass('')).toBe('direct');
  });
});
