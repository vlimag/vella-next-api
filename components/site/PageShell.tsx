import type { ReactNode } from 'react';
import type { Locale } from '@/lib/site/config';
import type { SiteCopy } from '@/lib/site/types';
import { UI_LABELS } from '@/lib/site/uiLabels';
import { Footer } from './Footer';
import { Header } from './Header';

export function PageShell({
  locale,
  copy,
  currentPath,
  children,
}: {
  locale: Locale;
  copy: SiteCopy;
  currentPath?: string;
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main-content">{UI_LABELS[locale].skipToContent}</a>
      <Header locale={locale} copy={copy} currentPath={currentPath} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} copy={copy} />
    </>
  );
}
