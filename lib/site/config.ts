export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vella.one';

export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? 'https://apps.apple.com/app/id6790616297';
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ?? 'https://play.google.com/store/apps/details?id=io.vella.app';

export function storeAvailabilityFromEnv(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'false';
}

export const IOS_STORE_AVAILABLE = storeAvailabilityFromEnv(
  process.env.NEXT_PUBLIC_IOS_STORE_AVAILABLE,
);
export const ANDROID_STORE_AVAILABLE = storeAvailabilityFromEnv(
  process.env.NEXT_PUBLIC_ANDROID_STORE_AVAILABLE,
);
export const STORE_CAMPAIGN = 'android_first_launch';
export const STORE_CTA_EVENT = 'vella:store-cta-click';

export type StoreCtaPlacement =
  | 'header-desktop'
  | 'header-mobile'
  | 'home-download'
  | 'prayer-space'
  | 'blog-article';

export function playStoreCampaignUrl(placement: StoreCtaPlacement): string {
  const url = new URL(PLAY_STORE_URL);
  const referrer = new URLSearchParams({
    utm_source: 'vella.one',
    utm_medium: 'website',
    utm_campaign: STORE_CAMPAIGN,
    utm_content: placement,
  });
  url.searchParams.set('referrer', referrer.toString());
  return url.toString();
}

export function storeCtaId(placement: StoreCtaPlacement, platform: 'android' | 'ios'): string {
  return `vella-store-cta-${placement}-${platform}`;
}

export function availableStoreUrls(): string[] {
  return [
    ...(ANDROID_STORE_AVAILABLE ? [PLAY_STORE_URL] : []),
    ...(IOS_STORE_AVAILABLE ? [APP_STORE_URL] : []),
  ];
}

export const SUPPORT_EMAIL = 'support@vella.one';
export const PRIVACY_EMAIL = 'privacy@vella.one';
export const HELLO_EMAIL = 'hello@vella.one';
export const LEGAL_OPERATOR = 'Madai Tecnologia LTDA';

export const LOCALES = ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  pt: 'Português',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  ru: 'Русский',
  pl: 'Polski',
};

export const LOCALE_OG: Record<Locale, string> = {
  en: 'en_US',
  pt: 'pt_BR',
  es: 'es_ES',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  ru: 'ru_RU',
  pl: 'pl_PL',
};

export function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function localizedPath(locale: Locale, path = ''): string {
  const normalized = path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  const prefix = locale === DEFAULT_LOCALE ? '' : `/${locale}`;
  return `${prefix}${normalized}` || '/';
}

export function absoluteUrl(locale: Locale, path = ''): string {
  return `${SITE_URL}${localizedPath(locale, path)}`;
}

export function languageAlternates(path = ''): Record<string, string> {
  return Object.fromEntries([
    ...LOCALES.map((locale) => [locale, absoluteUrl(locale, path)]),
    ['x-default', absoluteUrl(DEFAULT_LOCALE, path)],
  ]);
}
