import { STORE_CAMPAIGN, isWebFirstTouch, type WebFirstTouch } from './config';

// Explicit regional domains, not a "google.*" suffix pattern: arbitrary
// lookalikes must remain referrals. Include the site's language markets.
const SEARCH_HOSTS = [
  'google.com', 'google.com.br', 'google.co.uk', 'google.pt', 'google.es',
  'google.fr', 'google.de', 'google.it', 'google.ru', 'google.pl',
  'google.ca', 'google.com.au', 'google.co.nz', 'google.co.in',
  'google.co.jp', 'google.com.mx', 'google.com.ar', 'google.com.co',
  'bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org',
];
const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com'];
const WEB_CAMPAIGNS = new Set([STORE_CAMPAIGN]);

function hostMatches(hostname: string, domains: readonly string[]) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function canonicalCampaign(value: string | null): string {
  const campaign = value?.trim().toLowerCase();
  return campaign && WEB_CAMPAIGNS.has(campaign) ? campaign : STORE_CAMPAIGN;
}

export function canonicalRouteClass(pathname: string): WebFirstTouch['content'] {
  const path = pathname.replace(/^\/(?:en|pt|es|fr|de|it|ru|pl)(?=\/|$)/u, '') || '/';
  if (path === '/') return 'home';
  if (path === '/features') return 'features';
  if (path === '/features/prayer-space') return 'prayer_space';
  if (path === '/blog') return 'blog_index';
  if (path.startsWith('/blog/')) return 'blog_article';
  if (path === '/support') return 'support';
  if (['/privacy', '/terms', '/community-guidelines', '/delete-account'].includes(path)) return 'legal';
  return 'other';
}

// Call this when the CTA is activated, rather than when a page effect first mounts.
export function storeClickRouteClass(pathname: string): string {
  return canonicalRouteClass(pathname);
}

// No visitor-provided path segment becomes a content identifier.
const ARTICLE_CODES: Record<string, WebFirstTouch['content']> = {
  'how-to-start-reading-the-bible-seven-day-plan': 'guide_bible_start',
  'a-short-night-prayer-for-the-end-of-the-day': 'guide_night_prayer',
  'a-daily-prayer-space-for-real-life': 'guide_prayer_space',
  'a-gentle-daily-scripture-rhythm': 'guide_daily_scripture',
  'praying-when-your-mind-will-not-slow-down': 'guide_distracted_prayer',
  'read-scripture-with-curiosity': 'guide_scripture_curiosity',
};

export function publicContentCode(pathname: string): WebFirstTouch['content'] {
  const path = pathname.replace(/^\/(?:en|pt|es|fr|de|it|ru|pl)(?=\/|$)/u, '') || '/';
  const slug = path.startsWith('/blog/') ? path.slice('/blog/'.length) : '';
  return Object.hasOwn(ARTICLE_CODES, slug)
    ? ARTICLE_CODES[slug]!
    : canonicalRouteClass(pathname);
}

const FIRST_TOUCH_KEY = 'vella.web-growth.first-touch.v1';
type ContextStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function firstTouchContext(pathname: string, referrer: string, storage?: ContextStorage): WebFirstTouch {
  try {
    const raw = storage?.getItem(FIRST_TOUCH_KEY);
    const saved: unknown = raw && raw.length <= 256 ? JSON.parse(raw) : null;
    if (isWebFirstTouch(saved)) return { source: saved.source, content: saved.content };
  } catch { /* Untrusted or unavailable storage never affects navigation. */ }
  const context: WebFirstTouch = {
    source: coarseReferrerClass(referrer),
    content: publicContentCode(pathname),
  };
  try { storage?.setItem(FIRST_TOUCH_KEY, JSON.stringify(context)); } catch { /* Memory-only fallback. */ }
  return context;
}

export function coarseReferrerClass(referrer: string, siteHost = 'vella.one'): WebFirstTouch['source'] {
  if (!referrer) return 'direct';

  try {
    const url = new URL(referrer);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'direct';
    const hostname = url.hostname.toLowerCase();
    if (hostname === siteHost || hostname.endsWith(`.${siteHost}`)) return 'internal';
    if (hostMatches(hostname, SEARCH_HOSTS)) return 'search';
    if (hostMatches(hostname, SOCIAL_HOSTS)) return 'social';
    return 'referral';
  } catch {
    return 'direct';
  }
}
