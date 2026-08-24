import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import '@/app/globals.css';
import {
  APP_STORE_URL,
  IOS_STORE_AVAILABLE,
  LOCALE_OG,
  LOCALES,
  SITE_URL,
  absoluteUrl,
  isLocale,
  languageAlternates,
} from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { GrowthTracker } from '@/components/site/GrowthTracker';

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale: value } = await params;
  if (!isLocale(value)) return {};
  const copy = await getCopy(value);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: copy.seo.title,
      template: `%s · Vella`,
    },
    description: copy.seo.description,
    applicationName: 'Vella',
    authors: [{ name: 'Vella', url: SITE_URL }],
    creator: 'Vella',
    publisher: 'Vella',
    category: 'Lifestyle',
    alternates: {
      canonical: absoluteUrl(value),
      languages: languageAlternates(),
      types: {
        'application/rss+xml': [{ url: absoluteUrl(value, '/blog/feed.xml'), title: copy.blog.title }],
      },
    },
    openGraph: {
      type: 'website',
      siteName: 'Vella',
      title: copy.seo.title,
      description: copy.seo.description,
      url: absoluteUrl(value),
      locale: LOCALE_OG[value],
      alternateLocale: LOCALES.filter((locale) => locale !== value).map((locale) => LOCALE_OG[locale]),
      images: [{ url: '/og.png', width: 1200, height: 630, alt: copy.seo.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.seo.title,
      description: copy.seo.description,
      images: ['/og.png'],
    },
    icons: {
      icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon-192.png', type: 'image/png', sizes: '192x192' }],
      apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: 'Vella',
      statusBarStyle: 'black-translucent',
    },
    other: IOS_STORE_AVAILABLE
      ? { 'apple-itunes-app': `app-id=6790616297, app-argument=${APP_STORE_URL}` }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf8f1' },
    { media: '(prefers-color-scheme: dark)', color: '#071225' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <html lang={locale}>
      <body>
        <GrowthTracker locale={locale} />
        {children}
      </body>
    </html>
  );
}
