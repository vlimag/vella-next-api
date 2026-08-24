import type { Metadata } from 'next';
import type { Locale } from './config';
import { LOCALE_OG, LOCALES, absoluteUrl, languageAlternates } from './config';

export function localizedMetadata({
  locale,
  title,
  description,
  path,
  type = 'website',
  image = '/og.png',
  publishedTime,
  modifiedTime,
  authors,
  rssTitle,
}: {
  locale: Locale;
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
  image?: string;
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  rssTitle?: string;
}): Metadata {
  const url = absoluteUrl(locale, path);
  const titleMetadata: Metadata['title'] = /vella/i.test(title) ? { absolute: title } : title;
  const alternateLocale = LOCALES.filter((item) => item !== locale).map((item) => LOCALE_OG[item]);
  const openGraph: Metadata['openGraph'] = type === 'article'
    ? {
        type: 'article',
        title,
        description,
        url,
        siteName: 'Vella',
        locale: LOCALE_OG[locale],
        alternateLocale,
        publishedTime,
        modifiedTime,
        authors,
        images: [{ url: image, width: 1200, height: 630, alt: title }],
      }
    : {
        type: 'website',
        title,
        description,
        url,
        siteName: 'Vella',
        locale: LOCALE_OG[locale],
        alternateLocale,
        images: [{ url: image, width: 1200, height: 630, alt: title }],
      };

  return {
    title: titleMetadata,
    description,
    alternates: {
      canonical: url,
      languages: languageAlternates(path),
      ...(rssTitle ? {
        types: {
          'application/rss+xml': [{ url: absoluteUrl(locale, '/blog/feed.xml'), title: rssTitle }],
        },
      } : {}),
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
