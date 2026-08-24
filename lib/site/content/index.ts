import type { Locale } from '../config';
import type { SiteCopy } from '../types';
import { en } from './en';

const loaders: Record<Locale, () => Promise<{ default?: SiteCopy; copy?: SiteCopy }>> = {
  en: async () => ({ copy: en }),
  pt: () => import('./pt'),
  es: () => import('./es'),
  fr: () => import('./fr'),
  de: () => import('./de'),
  it: () => import('./it'),
  ru: () => import('./ru'),
  pl: () => import('./pl'),
};

export async function getCopy(locale: Locale): Promise<SiteCopy> {
  if (locale === 'en') return en;
  const loaded = await loaders[locale]();
  const copy = loaded.copy ?? loaded.default;
  if (!copy) throw new Error(`Missing site copy for locale: ${locale}`);
  return copy;
}
