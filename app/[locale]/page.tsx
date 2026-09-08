import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { HeroStoreLinks } from '@/components/site/HeroStoreLinks';
import { PageShell } from '@/components/site/PageShell';
import { PhonePreview } from '@/components/site/PhonePreview';
import { PrayerSpaceSpotlight } from '@/components/site/PrayerSpaceSpotlight';
import { StoreLinks } from '@/components/site/StoreLinks';
import {
  isLocale,
  localizedPath,
} from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { buildHomeStructuredData } from '@/lib/site/homeStructuredData';
import { getPrayerSpaceCopy } from '@/lib/site/prayerSpace';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const locale = value;
  const copy = await getCopy(locale);
  const prayerSpace = getPrayerSpaceCopy(locale);

  const structuredData = buildHomeStructuredData(locale, copy.seo.description);

  return (
    <PageShell locale={locale} copy={copy}>
      <JsonLd data={structuredData} />

      <section className="hero-section">
        <div className="hero-ambient ambient-one"></div>
        <div className="hero-ambient ambient-two"></div>
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span></span>{copy.hero.eyebrow}</p>
            <h1>{copy.hero.title}<br /><em>{copy.hero.accent}</em></h1>
            <p className="hero-body">{copy.hero.body}</p>
            <div className="hero-actions">
              <HeroStoreLinks copy={copy.download} />
              <Link className="button button-ghost" href={localizedPath(locale, '/blog')}>{copy.hero.secondaryCta}</Link>
            </div>
            <p className="hero-note"><span aria-hidden="true">✓</span>{copy.hero.note}</p>
          </div>
          <PhonePreview copy={copy} />
        </div>
        <div className="shell proof-row">
          {copy.proof.map((item, index) => (
            <div key={item}><span>{String(index + 1).padStart(2, '0')}</span><p>{item}</p></div>
          ))}
        </div>
      </section>

      <section className="section section-ivory" id="experience">
        <div className="shell">
          <div className="section-heading centered">
            <p className="eyebrow">{copy.intro.eyebrow}</p>
            <h2>{copy.intro.title}</h2>
            <p>{copy.intro.body}</p>
          </div>
          <div className="feature-grid">
            {copy.features.map((feature, index) => (
              <article className={`feature-card feature-${index + 1}`} key={feature.title}>
                <div className="feature-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="feature-symbol" aria-hidden="true">{['✦', '◒', '⌕', '◇', '◷', '∞', '◎', '○'][index]}</div>
                <p className="card-eyebrow">{feature.eyebrow}</p>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
          <div className="centered-action">
            <Link className="text-link" href={localizedPath(locale, '/features')}>{copy.nav.features}<span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <PrayerSpaceSpotlight locale={locale} copy={prayerSpace} surface="warm" />

      <section className="section section-navy" id="how-it-works">
        <div className="shell rhythm-layout">
          <div className="rhythm-intro">
            <p className="eyebrow eyebrow-light">{copy.rhythm.eyebrow}</p>
            <h2>{copy.rhythm.title}</h2>
            <p>{copy.rhythm.body}</p>
          </div>
          <div className="rhythm-steps">
            {copy.rhythm.steps.map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <div><h3>{step.title}</h3><p>{step.body}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-warm">
        <div className="shell ai-layout">
          <div className="ai-visual" aria-hidden="true">
            <div className="ai-rings"><span></span><span></span><span></span><strong>V</strong></div>
            <p>{copy.ai.eyebrow}</p>
          </div>
          <div className="ai-copy">
            <p className="eyebrow">{copy.ai.eyebrow}</p>
            <h2>{copy.ai.title}</h2>
            <p>{copy.ai.body}</p>
            <ul>{copy.ai.points.map((point) => <li key={point}><span>✓</span>{point}</li>)}</ul>
            <div className="trust-note"><span aria-hidden="true">i</span><p>{copy.ai.trust}</p></div>
          </div>
        </div>
      </section>

      <section className="section community-section">
        <div className="shell community-grid">
          <div className="community-copy">
            <p className="eyebrow">{copy.community.eyebrow}</p>
            <h2>{copy.community.title}</h2>
            <p>{copy.community.body}</p>
            <ul>{copy.community.points.map((point) => <li key={point}>{point}</li>)}</ul>
            <Link className="text-link" href={localizedPath(locale, '/community-guidelines')}>{copy.footer.guidelines}<span aria-hidden="true">→</span></Link>
          </div>
          <div className="community-visual" aria-label={copy.community.title}>
            <div className="community-card card-back"><span>{copy.community.eyebrow}</span><p>{copy.community.points[0]}</p></div>
            <div className="community-card card-front">
              <div className="mini-profile"><span>V</span><div><strong>{copy.community.title}</strong><small>{copy.community.eyebrow}</small></div></div>
              <p>{copy.community.points[1]}</p>
              <div className="mini-actions"><span>♡ 24</span><span>◯ 6</span><span>↗</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="story-section" id="story">
        <div className="shell story-inner">
          <span className="story-mark" aria-hidden="true">“</span>
          <blockquote>{copy.story.quote}</blockquote>
          <p>{copy.story.body}</p>
        </div>
      </section>

      <section className="section journal-teaser">
        <div className="shell journal-teaser-inner">
          <div>
            <p className="eyebrow">{copy.blog.eyebrow}</p>
            <h2>{copy.blog.title}</h2>
          </div>
          <div>
            <p>{copy.blog.body}</p>
            <Link className="button button-dark" href={localizedPath(locale, '/blog')}>{copy.blog.readAll}<span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>

      <section className="download-section" id="download">
        <div className="download-glow"></div>
        <div className="shell download-inner">
          <p className="eyebrow eyebrow-light">{copy.download.eyebrow}</p>
          <h2>{copy.download.title}</h2>
          <p>{copy.download.body}</p>
          <StoreLinks copy={copy.download} placement="home-download" />
          <small>{copy.download.availability}</small>
        </div>
      </section>
    </PageShell>
  );
}
