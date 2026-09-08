import {
  ANDROID_STORE_AVAILABLE,
  IOS_STORE_AVAILABLE,
  SITE_URL,
  absoluteUrl,
  availableStoreUrls,
  type Locale,
} from '@/lib/site/config';

export function buildHomeStructuredData(locale: Locale, description: string) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Vella',
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
      email: 'hello@vella.one',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Vella',
      url: absoluteUrl(locale),
      inLanguage: locale,
      description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      name: 'Vella',
      operatingSystem: [
        ...(ANDROID_STORE_AVAILABLE ? ['Android'] : []),
        ...(IOS_STORE_AVAILABLE ? ['iOS'] : []),
      ].join(', '),
      applicationCategory: 'LifestyleApplication',
      description,
      url: absoluteUrl(locale),
      downloadUrl: availableStoreUrls(),
    },
  ];
}
