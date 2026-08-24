import type { MetadataRoute } from 'next';
import { BLOG_SLUGS, getPost } from '@/lib/site/blog';
import { DEFAULT_LOCALE, LOCALES, absoluteUrl, languageAlternates } from '@/lib/site/config';
import { PRAYER_SPACE_PATH } from '@/lib/site/prayerSpace';

const STATIC_PATHS = [
  '',
  '/features',
  PRAYER_SPACE_PATH,
  '/blog',
  '/support',
  '/privacy',
  '/terms',
  '/community-guidelines',
  '/delete-account',
] as const;

const UPDATED_AT = new Date('2026-08-03T12:00:00.000Z');

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified: UPDATED_AT,
      changeFrequency: path === '' ? ('weekly' as const) : path === '/blog' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '' ? 1 : path === PRAYER_SPACE_PATH ? 0.95 : path === '/features' ? 0.9 : path === '/blog' ? 0.8 : 0.6,
      alternates: { languages: languageAlternates(path) },
    })),
  );

  const blogEntries: MetadataRoute.Sitemap = BLOG_SLUGS.flatMap((slug) => {
    const path = `/blog/${slug}`;
    const post = getPost(DEFAULT_LOCALE, slug);
    const lastModified = post ? new Date(post.updatedAt ?? post.publishedAt) : UPDATED_AT;
    return LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified,
      changeFrequency: 'yearly' as const,
      priority: 0.75,
      alternates: { languages: languageAlternates(path) },
    }));
  });

  return [...staticEntries, ...blogEntries];
}
