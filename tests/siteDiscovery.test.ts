import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import HomePage from '@/app/[locale]/page';
import FeaturesPage, { generateMetadata as featuresMetadata } from '@/app/[locale]/features/page';
import PrayerSpacePage, { generateMetadata as prayerMetadata } from '@/app/[locale]/features/prayer-space/page';
import BlogPage, { generateMetadata as blogMetadata } from '@/app/[locale]/blog/page';
import { LOCALES, type Locale } from '@/lib/site/config';

const { renderToStaticMarkup } = createRequire(import.meta.url)('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string;
};

function jsonLd(markup: string): Array<Record<string, any>> {
  return [...markup.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gu)]
    .flatMap((match) => JSON.parse(match[1]));
}

describe('localized organic discovery', () => {
  it.each(LOCALES)('links each %s reading feature to a relevant guide in the same language', async (locale) => {
    const markup = renderToStaticMarkup(await FeaturesPage({ params: Promise.resolve({ locale }) }));
    const sections = [...markup.matchAll(/<article[^>]*class="feature-detail"[^>]*>(.*?)<\/article>/gu)];
    const prefix = locale === 'en' ? '' : `/${locale}`;
    const guides = [
      'a-gentle-daily-scripture-rhythm',
      'read-scripture-with-curiosity',
      'how-to-start-reading-the-bible-seven-day-plan',
    ];

    guides.forEach((slug, index) => {
      // The link must be beside its feature, not only in the generic footer guide cards.
      expect(sections[index]?.[1]).toMatch(new RegExp(`<a[^>]*href="${prefix}/blog/${slug}"[^>]*>[^<]{12,}`));
    });
  });

  it.each(LOCALES)('uses descriptive article-title links in the %s guide index', async (locale) => {
    const markup = renderToStaticMarkup(await BlogPage({ params: Promise.resolve({ locale }) }));
    const titleLinks = [...markup.matchAll(/<h2><a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>/gu)];
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect(titleLinks).toHaveLength(6);
    expect(new Set(titleLinks.map((match) => match[1])).size).toBe(6);
    for (const [, href, text] of titleLinks) {
      expect(href).toMatch(new RegExp(`^${prefix}/blog/[^/]+$`));
      expect(text.length).toBeGreaterThan(12);
    }
  });

  it.each(LOCALES)('describes one real mobile app across %s product pages without invented offers or ratings', async (locale) => {
    const params = Promise.resolve({ locale });
    const homeData = jsonLd(renderToStaticMarkup(await HomePage({ params })));
    const homeApp = homeData.find((entry) => entry['@type'] === 'MobileApplication');
    const featureData = jsonLd(renderToStaticMarkup(await FeaturesPage({ params })));
    const prayerData = jsonLd(renderToStaticMarkup(await PrayerSpacePage({ params })));
    const apps = [homeApp, featureData[0]?.about, prayerData[0]?.about];

    for (const app of apps) {
      expect(app).toMatchObject({
        '@type': 'MobileApplication',
        '@id': 'https://vella.one/#app',
        name: 'Vella',
        publisher: { '@id': 'https://vella.one/#organization', name: 'Vella' },
      });
      expect(app.inLanguage).toEqual(['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl']);
      expect(app.featureList.length).toBeGreaterThanOrEqual(4);
      expect(app).not.toHaveProperty('offers');
      expect(app).not.toHaveProperty('aggregateRating');
      expect(app).not.toHaveProperty('review');
    }
  });

  it.each(LOCALES)('keeps %s discovery metadata canonical and reciprocal to every translated page', async (locale) => {
    const prefix = locale === 'en' ? '' : `/${locale}`;
    for (const [generate, path] of [
      [featuresMetadata, '/features'],
      [prayerMetadata, '/features/prayer-space'],
      [blogMetadata, '/blog'],
    ] as const) {
      const metadata = await generate({ params: Promise.resolve({ locale }) });
      expect(metadata.alternates?.canonical).toBe(`https://vella.one${prefix}${path}`);
      expect(metadata.openGraph).toMatchObject({ url: `https://vella.one${prefix}${path}` });
      const languages = metadata.alternates?.languages;
      for (const translation of ['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'] as Locale[]) {
        const translatedPrefix = translation === 'en' ? '' : `/${translation}`;
        expect(languages?.[translation]).toBe(`https://vella.one${translatedPrefix}${path}`);
      }
      expect(languages?.['x-default']).toBe(`https://vella.one${path}`);
    }
  });
});
