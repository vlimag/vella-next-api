const SEARCH_HOSTS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.'];
const SOCIAL_HOSTS = ['instagram.', 'facebook.', 'tiktok.', 'youtube.', 'x.com', 'twitter.'];

function hostMatches(hostname: string, fragments: readonly string[]) {
  return fragments.some((fragment) => hostname === fragment || hostname.endsWith(`.${fragment}`) || hostname.includes(fragment));
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
