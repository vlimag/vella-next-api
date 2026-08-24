import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { PrayerSpaceSpotlight } from '@/components/site/PrayerSpaceSpotlight';
import { isLocale, localizedPath, absoluteUrl } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import { getPrayerSpaceCopy } from '@/lib/site/prayerSpace';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = await getCopy(locale);
  return localizedMetadata({ locale, title: copy.seo.featuresTitle, description: copy.seo.featuresDescription, path: '/features' });
}

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);
  const prayerSpace = getPrayerSpaceCopy(value);

  return (
    <PageShell locale={value} copy={copy} currentPath="/features">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: copy.seo.featuresTitle,
        description: copy.seo.featuresDescription,
        url: absoluteUrl(value, '/features'),
        inLanguage: value,
        isPartOf: { '@type': 'WebSite', name: 'Vella', url: absoluteUrl(value) },
      }} />
      <section className="subpage-hero feature-page-hero">
        <div className="hero-ambient ambient-one"></div>
        <div className="shell subpage-hero-inner">
          <p className="eyebrow eyebrow-light">{copy.featuresPage.eyebrow}</p>
          <h1>{copy.featuresPage.title}</h1>
          <p>{copy.featuresPage.body}</p>
          <Link className="button button-gold" href={`${localizedPath(value)}#download`}>{copy.nav.download}<span aria-hidden="true">→</span></Link>
        </div>
      </section>
      <PrayerSpaceSpotlight locale={value} copy={prayerSpace} />
      <section className="section section-ivory">
        <div className="shell feature-detail-list">
          {copy.featuresPage.sections.map((section, index) => (
            <article key={section.title} className="feature-detail">
              <div className="feature-detail-heading">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h2>{section.title}</h2>
                <p>{section.body}</p>
              </div>
              <ul>{section.bullets.map((bullet) => <li key={bullet}><span>✓</span>{bullet}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>
      <section className="safety-banner">
        <div className="shell safety-inner">
          <span aria-hidden="true">i</span>
          <div><h2>{copy.featuresPage.safetyTitle}</h2><p>{copy.featuresPage.safetyBody}</p></div>
        </div>
      </section>
    </PageShell>
  );
}
