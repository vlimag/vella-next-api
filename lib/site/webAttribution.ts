import { STORE_CAMPAIGN } from './config';

const SEARCH_HOSTS = ['google.com', 'bing.com', 'duckduckgo.com', 'yahoo.com', 'ecosia.org'];
const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'tiktok.com', 'youtube.com', 'x.com', 'twitter.com'];
const WEB_CAMPAIGNS = new Set([STORE_CAMPAIGN]);

function hostMatches(hostname: string, domains: readonly string[]) {
  return domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

export function canonicalCampaign(value: string | null): string {
  const campaign = value?.trim().toLowerCase();
  return campaign && WEB_CAMPAIGNS.has(campaign) ? campaign : STORE_CAMPAIGN;
}

export function canonicalRouteClass(pathname: string): string {
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

export function coarseReferrerClass(referrer: string, siteHost = 'vella.one'): string {
  if (!referrer) return 'direct';

  try {
    const hostname = new URL(referrer).hostname.toLowerCase();
    if (hostname === siteHost || hostname.endsWith(`.${siteHost}`)) return 'internal';
    if (hostMatches(hostname, SEARCH_HOSTS)) return 'search';
    if (hostMatches(hostname, SOCIAL_HOSTS)) return 'social';
    return 'referral';
  } catch {
    return 'direct';
  }
}
