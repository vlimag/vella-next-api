import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/site/LegalPage';
import { PageShell } from '@/components/site/PageShell';
import { isLocale } from '@/lib/site/config';
import { getCopy } from '@/lib/site/content';
import { localizedMetadata } from '@/lib/site/metadata';
import { UI_LABELS } from '@/lib/site/uiLabels';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const copy = await getCopy(locale);
  return localizedMetadata({ locale, title: copy.seo.termsTitle, description: copy.seo.termsDescription, path: '/terms' });
}

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);
  return (
    <PageShell locale={value} copy={copy} currentPath="/terms">
      <LegalPage eyebrow={copy.footer.legal} title={copy.seo.termsTitle} intro={copy.legal.termsIntro} updated={copy.legal.updated} sections={copy.legal.termsSections} navigationLabel={UI_LABELS[value].onThisPage} />
    </PageShell>
  );
}
