import Link from 'next/link';
import type { Locale } from '@/lib/site/config';
import { LEGAL_OPERATOR, LOCALE_LABELS, LOCALES, localizedPath } from '@/lib/site/config';
import type { SiteCopy } from '@/lib/site/types';
import { Logo } from './Logo';

export function Footer({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  const home = localizedPath(locale);
  const year = new Date().getUTCFullYear();

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <Logo href={home} label={`${copy.footer.home} — Vella`} />
          <p>{copy.footer.mission}</p>
        </div>
        <div className="footer-column">
          <h2>{copy.footer.product}</h2>
          <Link href={home}>{copy.footer.home}</Link>
          <Link href={localizedPath(locale, '/features')}>{copy.footer.features}</Link>
          <Link href={localizedPath(locale, '/blog')}>{copy.footer.blog}</Link>
          <Link href={localizedPath(locale, '/support')}>{copy.footer.support}</Link>
        </div>
        <div className="footer-column">
          <h2>{copy.footer.company}</h2>
          <Link href={`${home}#story`}>{copy.footer.about}</Link>
          <Link href={`${home}#download`}>{copy.nav.download}</Link>
          <a href="mailto:hello@vella.one">hello@vella.one</a>
        </div>
        <div className="footer-column">
          <h2>{copy.footer.legal}</h2>
          <Link href={localizedPath(locale, '/privacy')}>{copy.footer.privacy}</Link>
          <Link href={localizedPath(locale, '/terms')}>{copy.footer.terms}</Link>
          <Link href={localizedPath(locale, '/community-guidelines')}>{copy.footer.guidelines}</Link>
          <Link href={localizedPath(locale, '/delete-account')}>{copy.support.deleteTitle}</Link>
        </div>
      </div>
      <div className="shell footer-languages" aria-label={copy.footer.languages}>
        {LOCALES.map((item) => (
          <Link href={localizedPath(item)} hrefLang={item} lang={item} key={item} className={item === locale ? 'is-current' : undefined}>
            {LOCALE_LABELS[item]}
          </Link>
        ))}
      </div>
      <div className="shell footer-bottom">
        <p>© {year} {LEGAL_OPERATOR}. {copy.footer.rights}</p>
        <p>{copy.footer.madeWith}</p>
      </div>
    </footer>
  );
}
