import type { MetadataRoute } from 'next';
import { BLOG_SLUGS, getPost } from '@/lib/site/blog';
import { LOCALES, absoluteUrl, languageAlternates } from '@/lib/site/config';
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

const HOME_UPDATED_AT = new Date('2026-09-07T00:00:00.000Z');
const PREVIOUS_STATIC_UPDATED_AT = new Date('2026-08-24T00:00:00.000Z');
const STATIC_UPDATED_AT: Record<(typeof STATIC_PATHS)[number], Date> = {
  '': HOME_UPDATED_AT,
  '/features': PREVIOUS_STATIC_UPDATED_AT,
  [PRAYER_SPACE_PATH]: PREVIOUS_STATIC_UPDATED_AT,
  '/blog': PREVIOUS_STATIC_UPDATED_AT,
  '/support': PREVIOUS_STATIC_UPDATED_AT,
  '/privacy': PREVIOUS_STATIC_UPDATED_AT,
  '/terms': PREVIOUS_STATIC_UPDATED_AT,
  '/community-guidelines': PREVIOUS_STATIC_UPDATED_AT,
  '/delete-account': PREVIOUS_STATIC_UPDATED_AT,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(locale, path),
      lastModified: STATIC_UPDATED_AT[path],
      changeFrequency: path === '' ? ('weekly' as const) : path === '/blog' ? ('weekly' as const) : ('monthly' as const),
      priority: path === '' ? 1 : path === PRAYER_SPACE_PATH ? 0.95 : path === '/features' ? 0.9 : path === '/blog' ? 0.8 : 0.6,
      alternates: { languages: languageAlternates(path) },
    })),
  );

  const blogEntries: MetadataRoute.Sitemap = BLOG_SLUGS.flatMap((slug) =>
    LOCALES.map((locale) => {
      const path = `/blog/${slug}`;
      const post = getPost(locale, slug);
      const lastModified = post
        ? new Date(post.updatedAt ?? post.publishedAt)
        : PREVIOUS_STATIC_UPDATED_AT;
      return {
        url: absoluteUrl(locale, path),
        lastModified,
        changeFrequency: 'yearly' as const,
        priority: 0.75,
        alternates: { languages: languageAlternates(path) },
      };
    }),
  );

  return [...staticEntries, ...blogEntries];
}
