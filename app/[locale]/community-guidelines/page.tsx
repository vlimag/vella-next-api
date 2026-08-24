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
  return localizedMetadata({ locale, title: copy.seo.guidelinesTitle, description: copy.seo.guidelinesDescription, path: '/community-guidelines' });
}

export default async function GuidelinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: value } = await params;
  if (!isLocale(value)) notFound();
  const copy = await getCopy(value);
  return (
    <PageShell locale={value} copy={copy} currentPath="/community-guidelines">
      <LegalPage eyebrow={copy.community.eyebrow} title={copy.seo.guidelinesTitle} intro={copy.legal.guidelinesIntro} updated={copy.legal.updated} sections={copy.legal.guidelinesSections} navigationLabel={UI_LABELS[value].onThisPage} />
    </PageShell>
  );
}
