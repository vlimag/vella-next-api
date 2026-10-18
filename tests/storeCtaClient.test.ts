import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('browser store attribution', () => {
  it('keeps the first public article and coarse search source when the visitor moves to a feature', async () => {
    const values = new Map<string, string>();
    const location = { pathname: '/pt/blog/how-to-start-reading-the-bible-seven-day-plan' };
    vi.stubGlobal('window', { location, sessionStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    vi.stubGlobal('document', { referrer: 'https://www.google.com.br/search?q=private+prayer' });
    const client = await import('@/components/site/storeCtaClient');
    const creative = (url: string) => new URLSearchParams(new URL(url).searchParams.get('referrer')!).get('utm_content');
    expect(creative(client.browserPlayStoreUrl('hero'))).toBe('search.guide_bible_start.hero');
    location.pathname = '/pt/features/prayer-space';
    expect(creative(client.browserPlayStoreUrl('prayer-space'))).toBe('search.guide_bible_start.prayer-space');
    expect([...values.values()].join('')).not.toMatch(/https|private|\/pt/);
  });
});
