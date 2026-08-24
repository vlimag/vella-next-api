import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { PrayerSpacePreview } from '@/components/site/PrayerSpacePreview';
import { StoreLinks } from '@/components/site/StoreLinks';
import { ANDROID_STORE_AVAILABLE, IOS_STORE_AVAILABLE, absoluteUrl, isLocale, localizedPath } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import {
  PRAYER_SPACE_ARTICLE_PATH,
  PRAYER_SPACE_PATH,
  getPrayerSpaceCopy,
} from '@/lib/site/prayerSpace';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const prayer = getPrayerSpaceCopy(locale);
  return localizedMetadata({
    locale,
    title: prayer.seoTitle,
    description: prayer.seoDescription,
    path: PRAYER_SPACE_PATH,
  });
}

export default async function PrayerSpacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const siteCopy = await getCopy(value);
  const prayer = getPrayerSpaceCopy(value);
  const pageUrl = absoluteUrl(value, PRAYER_SPACE_PATH);

  return (
    <PageShell locale={value} copy={siteCopy} currentPath={PRAYER_SPACE_PATH}>
      <JsonLd data={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: prayer.seoTitle,
          description: prayer.seoDescription,
          url: pageUrl,
          inLanguage: value,
          isPartOf: { '@type': 'WebSite', name: 'Vella', url: absoluteUrl(value) },
          about: {
            '@type': 'SoftwareApplication',
            name: 'Vella Prayer Space',
            applicationCategory: 'LifestyleApplication',
            operatingSystem: [
              ...(ANDROID_STORE_AVAILABLE ? ['Android'] : []),
              ...(IOS_STORE_AVAILABLE ? ['iOS'] : []),
            ].join(', '),
            featureList: prayer.promise.points,
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: siteCopy.footer.home, item: absoluteUrl(value) },
            { '@type': 'ListItem', position: 2, name: siteCopy.footer.features, item: absoluteUrl(value, '/features') },
            { '@type': 'ListItem', position: 3, name: prayer.eyebrow, item: pageUrl },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: prayer.faq.items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ]} />

      <section className="prayer-page-hero">
        <div className="hero-ambient ambient-one"></div>
        <div className="hero-ambient ambient-two"></div>
        <div className="shell prayer-page-hero-grid">
          <div className="prayer-page-hero-copy">
            <p className="eyebrow eyebrow-light">{prayer.eyebrow}</p>
            <h1>{prayer.title}<br /><em>{prayer.accent}</em></h1>
            <p>{prayer.body}</p>
            <div className="hero-actions">
              <Link className="button button-gold" href="#how-prayer-space-works">{prayer.primaryCta}<span aria-hidden="true">↓</span></Link>
              <Link className="button button-ghost" href={localizedPath(value, PRAYER_SPACE_ARTICLE_PATH)}>{prayer.articleCta}</Link>
            </div>
            <p className="prayer-page-trust"><span aria-hidden="true">◇</span>{prayer.trustLine}</p>
          </div>
          <PrayerSpacePreview copy={prayer} />
        </div>
      </section>

      <section className="section prayer-promise-section">
        <div className="shell prayer-promise-grid">
          <div>
            <p className="eyebrow">{prayer.promise.eyebrow}</p>
            <h2>{prayer.promise.title}</h2>
            <p>{prayer.promise.body}</p>
          </div>
          <ul>
            {prayer.promise.points.map((point, index) => (
              <li key={point}><span>{String(index + 1).padStart(2, '0')}</span><p>{point}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section prayer-flow-section" id="how-prayer-space-works">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow">{prayer.flow.eyebrow}</p>
            <h2>{prayer.flow.title}</h2>
            <p>{prayer.flow.body}</p>
          </div>
          <div className="prayer-flow-grid">
            {prayer.flow.steps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section prayer-privacy-section">
        <div className="shell prayer-privacy-grid">
          <div className="prayer-privacy-seal" aria-hidden="true"><span>V</span><i>◇</i></div>
          <div>
            <p className="eyebrow eyebrow-light">{prayer.privacy.eyebrow}</p>
            <h2>{prayer.privacy.title}</h2>
            <p>{prayer.privacy.body}</p>
            <ul>{prayer.privacy.points.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section prayer-complements-section">
        <div className="shell">
          <div className="section-heading">
            <p className="eyebrow">{prayer.complements.eyebrow}</p>
            <h2>{prayer.complements.title}</h2>
            <p>{prayer.complements.body}</p>
          </div>
          <div className="prayer-complements-grid">
            {prayer.complements.items.map((item, index) => (
              <article key={item.title}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section prayer-faq-section">
        <div className="shell support-layout">
          <div className="support-heading">
            <p className="eyebrow">{prayer.faq.eyebrow}</p>
            <h2>{prayer.faq.title}</h2>
          </div>
          <div className="faq-list">
            {prayer.faq.items.map((item, index) => (
              <details key={item.question} open={index === 0}>
                <summary><span>{item.question}</span><span aria-hidden="true">+</span></summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="prayer-closing-section">
        <div className="shell prayer-closing-inner">
          <p className="eyebrow eyebrow-light">{prayer.closing.eyebrow}</p>
          <h2>{prayer.closing.title}</h2>
          <p>{prayer.closing.body}</p>
          <div className="hero-actions">
            <Link className="button button-gold" href={localizedPath(value, PRAYER_SPACE_ARTICLE_PATH)}>{prayer.closing.primaryCta}<span aria-hidden="true">→</span></Link>
            <Link className="button button-ghost" href={localizedPath(value, '/features')}>{prayer.closing.secondaryCta}</Link>
          </div>
          <div className="contextual-store-cta contextual-store-cta-dark">
            <p className="eyebrow eyebrow-light">{siteCopy.download.contextualEyebrow}</p>
            <h3>{siteCopy.download.contextualTitle}</h3>
            <p>{siteCopy.download.contextualBody}</p>
            <StoreLinks copy={siteCopy.download} compact placement="prayer-space" />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
