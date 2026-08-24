import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageShell } from '@/components/site/PageShell';
import { SUPPORT_EMAIL, isLocale } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import { UI_LABELS } from '@/lib/site/uiLabels';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = await getCopy(locale);
  return localizedMetadata({
    locale,
    title: `${copy.support.deleteTitle} · Vella`,
    description: copy.support.deleteBody,
    path: '/delete-account',
  });
}

export default async function DeleteAccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);
  const subject = encodeURIComponent(copy.support.deleteTitle);

  return (
    <PageShell locale={value} copy={copy} currentPath="/delete-account">
      <section className="subpage-hero support-hero">
        <div className="hero-ambient ambient-one"></div>
        <div className="shell subpage-hero-inner">
          <p className="eyebrow eyebrow-light">{UI_LABELS[value].accountData}</p>
          <h1>{copy.support.deleteTitle}</h1>
          <p>{copy.support.deleteBody}</p>
        </div>
      </section>
      <section className="section section-ivory">
        <div className="shell delete-page-card">
          <p>{copy.support.eligibilityNotice}</p>
          <div className="divider"></div>
          <ol>{copy.support.deleteSteps.map((step) => <li key={step}>{step}</li>)}</ol>
          <div className="divider"></div>
          <h2>{copy.support.partialDeletionTitle}</h2>
          <p>{copy.support.partialDeletionBody}</p>
          <ul>{copy.support.partialDeletionSteps.map((step) => <li key={step}>{step}</li>)}</ul>
          <div className="divider"></div>
          <p>{copy.support.responseNote}</p>
          <a className="button button-dark" href={`mailto:${SUPPORT_EMAIL}?subject=${subject}`}>{copy.support.emailCta}<span aria-hidden="true">→</span></a>
        </div>
      </section>
    </PageShell>
  );
}
