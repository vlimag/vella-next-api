import { createRequire } from 'node:module';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import ArticlePage, { generateMetadata } from '@/app/[locale]/blog/[slug]/page';
import { GET as feed } from '@/app/[locale]/blog/feed.xml/route';
import sitemap from '@/app/sitemap';
import { getPost, getPosts } from '@/lib/site/blog';
import { LOCALES, absoluteUrl, localizedPath } from '@/lib/site/config';

const render = createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup as (element: unknown) => string;
const slugs = ['how-to-start-reading-the-bible-seven-day-plan', 'a-short-night-prayer-for-the-end-of-the-day'];

describe('organic article cluster', () => {
  it('serves editorial image URLs without locale rewrites while still routing English articles', () => {
    for (const locale of LOCALES) for (const kind of ['reading', 'evening']) {
      const response = middleware(new NextRequest(`https://vella.one/blog/${kind}-${locale}.png`));
      expect(response.headers.get('x-middleware-next')).toBe('1');
      expect(response.headers.get('x-middleware-rewrite')).toBeNull();
    }
    const article = middleware(new NextRequest('https://vella.one/blog/how-to-start-reading-the-bible-seven-day-plan'));
    expect(article.headers.get('x-middleware-rewrite')).toBe('https://vella.one/en/blog/how-to-start-reading-the-bible-seven-day-plan');
  });

  it('provides readable, opaque, localized 1200×630 editorial images', async () => {
    for (const locale of LOCALES) for (const kind of ['reading', 'evening']) {
      const metadata = await sharp(`public/blog/${kind}-${locale}.png`).metadata();
      expect([metadata.width, metadata.height, metadata.format, metadata.hasAlpha]).toEqual([1200, 630, 'png', false]);
    }
  });
  it('provides both complete editorial articles in each supported locale', () => {
    for (const locale of LOCALES) for (const slug of slugs) {
      const post = getPost(locale, slug);
      expect(post, `${locale}/${slug}`).toBeDefined();
      expect(post?.locale).toBe(locale);
      expect(post?.sections.length).toBeGreaterThanOrEqual(4);
      expect(post?.publishedAt).toBe('2026-10-04');
    }
    for (const slug of slugs) expect(new Set(LOCALES.map((locale) => getPost(locale, slug)?.title)).size).toBe(8);
  });

  it('renders in-locale related links, real store CTAs and matching social/schema images', async () => {
    for (const locale of LOCALES) for (const slug of slugs) {
      const params = Promise.resolve({ locale, slug });
      const html = render(await ArticlePage({ params }));
      const metadata = await generateMetadata({ params });
      expect(html).toContain('data-cta-placement="blog-article"');
      const related = html.match(/<nav[^>]*class="article-related"[\s\S]*?<\/nav>/)?.[0];
      expect(related).toBeDefined();
      const hrefs = [...(related ?? '').matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
      expect(hrefs.length).toBeGreaterThanOrEqual(2);
      expect(hrefs.every((href) => href.startsWith(localizedPath(locale, '/blog/')) && !href.endsWith(slug))).toBe(true);
      const schema = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((match) => JSON.parse(match[1]));
      const article = schema.find((item) => item['@type'] === 'BlogPosting');
      expect(article.mainEntityOfPage).toBe(absoluteUrl(locale, `/blog/${slug}`));
      expect(article.image).not.toBe('https://vella.one/og.png');
      expect(JSON.stringify(metadata.openGraph)).toContain(article.image);
      expect(metadata.alternates?.canonical).toBe(article.mainEntityOfPage);
      expect(Object.keys(metadata.alternates?.languages ?? {})).toHaveLength(9);
    }
  });

  it('includes the full catalog in RSS and advances blog sitemap dates from actual content', async () => {
    const entries = sitemap();
    for (const locale of LOCALES) {
      const xml = await (await feed(new Request('https://vella.one'), { params: Promise.resolve({ locale }) })).text();
      for (const slug of slugs) expect(xml).toContain(absoluteUrl(locale, `/blog/${slug}`));
      const latest = Math.max(...getPosts(locale).map((post) => Date.parse(post.updatedAt ?? post.publishedAt)));
      const entry = entries.find((item) => item.url === absoluteUrl(locale, '/blog'));
      expect(new Date(entry!.lastModified!).getTime()).toBe(latest);
    }
    expect(entries).toHaveLength(120);
  });
});
