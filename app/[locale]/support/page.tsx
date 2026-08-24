import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/site/JsonLd';
import { PageShell } from '@/components/site/PageShell';
import { SUPPORT_EMAIL, absoluteUrl, isLocale } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import { UI_LABELS } from '@/lib/site/uiLabels';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = await getCopy(locale);
  return localizedMetadata({ locale, title: copy.seo.supportTitle, description: copy.seo.supportDescription, path: '/support' });
}

export default async function SupportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);

  return (
    <PageShell locale={value} copy={copy} currentPath="/support">
      <JsonLd data={[
        {
          '@context': 'https://schema.org',
          '@type': 'ContactPage',
          name: copy.seo.supportTitle,
          description: copy.seo.supportDescription,
          url: absoluteUrl(value, '/support'),
          inLanguage: value,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: copy.support.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
      ]} />
      <section className="subpage-hero support-hero">
        <div className="hero-ambient ambient-two"></div>
        <div className="shell subpage-hero-inner">
          <p className="eyebrow eyebrow-light">{copy.support.eyebrow}</p>
          <h1>{copy.support.title}</h1>
          <p>{copy.support.body}</p>
          <a className="button button-gold" href={`mailto:${SUPPORT_EMAIL}`}>{copy.support.emailCta}<span aria-hidden="true">→</span></a>
        </div>
      </section>
      <section className="section section-ivory">
        <div className="shell support-layout">
          <div className="support-heading"><p className="eyebrow">FAQ</p><h2>{copy.support.faqTitle}</h2></div>
          <div className="faq-list">
            {copy.support.faqs.map((faq, index) => (
              <details key={faq.question} open={index === 0}>
                <summary><span>{faq.question}</span><span aria-hidden="true">+</span></summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="delete-section">
        <div className="shell delete-card">
          <div><p className="eyebrow">{UI_LABELS[value].accountData}</p><h2>{copy.support.deleteTitle}</h2><p>{copy.support.deleteBody}</p></div>
          <ol>{copy.support.deleteSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          <p className="delete-note">{copy.support.responseNote}</p>
        </div>
      </section>
    </PageShell>
  );
}
