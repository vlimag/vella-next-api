import { describe, expect, it } from 'vitest';
import * as webAttribution from '@/lib/site/webAttribution';
import { STORE_CAMPAIGN } from '@/lib/site/config';

const canonicalCampaign = (webAttribution as typeof webAttribution & {
  canonicalCampaign?: (value: string | null) => string;
}).canonicalCampaign;
const { canonicalRouteClass, coarseReferrerClass, storeClickRouteClass } = webAttribution;
const { publicContentCode, firstTouchContext } = webAttribution;

describe('web acquisition attribution', () => {
  it('reduces localized URLs to bounded canonical route classes', () => {
    expect(canonicalRouteClass('/pt/blog/a-gentle-daily-scripture-rhythm')).toBe('blog_article');
    expect(canonicalRouteClass('/features/prayer-space')).toBe('prayer_space');
    expect(canonicalRouteClass('/unrecognized-private-path')).toBe('other');
  });

  it('uses the pathname at CTA click time after a same-locale soft navigation', () => {
    let pathname = '/pt';
    const routeClassAtClick = () => storeClickRouteClass(pathname);

    expect(routeClassAtClick()).toBe('home');
    pathname = '/pt/blog/a-gentle-daily-scripture-rhythm';
    expect(routeClassAtClick()).toBe('blog_article');
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

  it('recognizes regional search hosts without accepting lookalike domains', () => {
    for (const host of ['www.google.com.br', 'www.google.co.uk', 'google.de', 'br.search.yahoo.com', 'www.bing.com']) {
      expect(coarseReferrerClass(`https://${host}/search?q=private`), host).toBe('search');
    }
    for (const host of ['google.evil.test', 'google.com.br.evil.test', 'notgoogle.co.uk', 'google.invalid', 'googleusercontent.com']) {
      expect(coarseReferrerClass(`https://${host}/search?q=private`), host).toBe('referral');
    }
    expect(coarseReferrerClass('javascript://google.com/private')).toBe('direct');
  });

  it('only keeps approved website campaigns from query parameters', () => {
    expect(canonicalCampaign?.('android_first_launch')).toBe(STORE_CAMPAIGN);
    expect(canonicalCampaign?.('unreviewed_campaign')).toBe(STORE_CAMPAIGN);
    expect(canonicalCampaign?.('android_first_launch?private=value')).toBe(STORE_CAMPAIGN);
  });

  it('identifies only catalogued public articles rather than recording arbitrary URL slugs', () => {
    expect(publicContentCode('/pt/blog/how-to-start-reading-the-bible-seven-day-plan')).toBe('guide_bible_start');
    expect(publicContentCode('/blog/a-short-night-prayer-for-the-end-of-the-day')).toBe('guide_night_prayer');
    expect(publicContentCode('/de/blog/a-daily-prayer-space-for-real-life')).toBe('guide_prayer_space');
    expect(publicContentCode('/es/blog/a-gentle-daily-scripture-rhythm')).toBe('guide_daily_scripture');
    expect(publicContentCode('/pl/blog/praying-when-your-mind-will-not-slow-down')).toBe('guide_distracted_prayer');
    expect(publicContentCode('/it/blog/read-scripture-with-curiosity')).toBe('guide_scripture_curiosity');
    expect(publicContentCode('/fr/features/prayer-space')).toBe('prayer_space');
    expect(publicContentCode('/blog/a-private-prayer')).toBe('blog_article');
    expect(publicContentCode('/blog/__proto__')).toBe('blog_article');
    expect(publicContentCode('/operator/growth')).toBe('other');
  });

  it('preserves only coarse first-touch source and public content through navigation and reload', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const first = firstTouchContext('/pt/blog/a-short-night-prayer-for-the-end-of-the-day', 'https://www.google.com.br/search?q=private+prayer', storage);
    expect(first).toEqual({ source: 'search', content: 'guide_night_prayer' });
    expect(firstTouchContext('/pt/features/prayer-space', 'https://vella.one/pt/blog/private', storage)).toEqual(first);
    expect([...values.values()].join('')).not.toMatch(/https|private|\/pt|search\?/);
  });

  it('rejects private values or extra properties restored from first-touch storage', () => {
    for (const value of [
      { source: 'search', content: 'private-prayer' },
      { source: 'search', content: 'home', prayer: 'secret' },
      { source: 'https://google.com/private', content: 'home' },
    ]) {
      const storage = { getItem: () => JSON.stringify(value), setItem() {} };
      expect(firstTouchContext('/pt', '', storage)).toEqual({ source: 'direct', content: 'home' });
    }
    const blocked = { getItem() { throw new Error('disabled'); }, setItem() { throw new Error('disabled'); } };
    expect(firstTouchContext('/fr/features', 'https://www.instagram.com/private', blocked)).toEqual({ source: 'social', content: 'features' });
  });
});
