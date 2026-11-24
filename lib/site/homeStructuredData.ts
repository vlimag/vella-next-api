import {
  SITE_URL,
  absoluteUrl,
  type Locale,
} from '@/lib/site/config';
import { buildApplicationStructuredData } from './applicationStructuredData';

export function buildHomeStructuredData(locale: Locale, description: string, featureList: string[] = []) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
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
    buildApplicationStructuredData(locale, description, featureList),
  ];
}
