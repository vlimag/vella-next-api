import {
  ANDROID_STORE_AVAILABLE,
  IOS_STORE_AVAILABLE,
  LOCALES,
  SITE_URL,
  absoluteUrl,
  availableStoreUrls,
  type Locale,
} from './config';

// One application identity, including on pages about an individual feature.
// Store-specific prices and verified review data are not available here. Do not
// invent offers or ratings to satisfy Google's software-app rich-result rules.
export function buildApplicationStructuredData(locale: Locale, description: string, featureList: string[] = []) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    '@id': `${SITE_URL}/#app`,
    name: 'Vella',
    operatingSystem: [
      ...(ANDROID_STORE_AVAILABLE ? ['Android'] : []),
      ...(IOS_STORE_AVAILABLE ? ['iOS'] : []),
    ].join(', '),
    applicationCategory: 'LifestyleApplication',
    description,
    url: absoluteUrl(locale),
    inLanguage: [...LOCALES],
    featureList,
    publisher: { '@type': 'Organization', '@id': `${SITE_URL}/#organization`, name: 'Vella', url: SITE_URL },
    downloadUrl: availableStoreUrls(),
  };
}
