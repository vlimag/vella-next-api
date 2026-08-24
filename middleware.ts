import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_LOCALE, type Locale, isLocale } from './lib/site/config';

const STATIC_PATHS = new Set([
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/vella-icon.png',
  '/og.png',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
]);

const CRAWLER_PATTERN = /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot/i;

function preferredLocale(request: NextRequest): Locale {
  const header = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const weighted = header
    .split(',')
    .map((part) => {
      const [tag, quality] = part.trim().split(';q=');
      return { tag: tag.split('-')[0], quality: quality ? Number(quality) : 1 };
    })
    .filter((entry) => Number.isFinite(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const entry of weighted) {
    if (isLocale(entry.tag)) return entry.tag;
  }
  return DEFAULT_LOCALE;
}

function withLanguage(response: NextResponse, locale: Locale) {
  response.headers.set('Content-Language', locale);
  response.headers.set('Vary', 'Accept-Language');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/.well-known/') ||
    STATIC_PATHS.has(pathname)
  ) {
    return NextResponse.next();
  }

  const firstSegment = pathname.split('/')[1];
  if (isLocale(firstSegment)) {
    if (firstSegment === DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
      return NextResponse.redirect(url, 308);
    }
    return withLanguage(NextResponse.next(), firstSegment);
  }

  const userAgent = request.headers.get('user-agent') ?? '';
  const detected = CRAWLER_PATTERN.test(userAgent) ? DEFAULT_LOCALE : preferredLocale(request);

  if (detected !== DEFAULT_LOCALE && pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = `/${detected}`;
    const response = withLanguage(NextResponse.redirect(url, 307), detected);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  const rewrite = request.nextUrl.clone();
  rewrite.pathname = `/${DEFAULT_LOCALE}${pathname === '/' ? '' : pathname}`;
  return withLanguage(NextResponse.rewrite(rewrite), DEFAULT_LOCALE);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
