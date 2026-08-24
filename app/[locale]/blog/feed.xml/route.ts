import { getPosts } from '@/lib/site/blog';
import { absoluteUrl, isLocale } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(_: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return new Response('Not found', { status: 404 });
  const copy = await getCopy(locale);
  const posts = getPosts(locale).sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  const items = posts.map((post) => {
    const url = absoluteUrl(locale, `/blog/${post.slug}`);
    return `<item><title>${escapeXml(post.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><description>${escapeXml(post.description)}</description><pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate><category>${escapeXml(post.category)}</category></item>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(copy.seo.blogTitle)}</title><link>${absoluteUrl(locale, '/blog')}</link><description>${escapeXml(copy.seo.blogDescription)}</description><language>${locale}</language>${items}</channel></rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
