import Link from 'next/link';
import type { Locale } from '@/lib/site/config';
import { LOCALE_LABELS, LOCALES, localizedPath } from '@/lib/site/config';
import type { SiteCopy } from '@/lib/site/types';
import { Logo } from './Logo';
import { StoreHeaderCta } from './StoreHeaderCta';

type HeaderProps = {
  locale: Locale;
  copy: SiteCopy;
  currentPath?: string;
};

function LanguageMenu({ locale, label, currentPath = '' }: { locale: Locale; label: string; currentPath?: string }) {
  return (
    <details className="language-menu">
      <summary aria-label={label}>
        <span className="language-code">{locale.toUpperCase()}</span>
        <span className="chevron" aria-hidden="true">⌄</span>
      </summary>
      <div className="language-popover" role="list">
        {LOCALES.map((item) => (
          <Link
            href={localizedPath(item, currentPath)}
            key={item}
            hrefLang={item}
            lang={item}
            className={item === locale ? 'is-current' : undefined}
          >
            <span>{LOCALE_LABELS[item]}</span>
            <span aria-hidden="true">{item === locale ? '✓' : ''}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}

export function Header({ locale, copy, currentPath = '' }: HeaderProps) {
  const home = localizedPath(locale);
  const nav = [
    { href: localizedPath(locale, '/features'), label: copy.nav.features },
    { href: `${home}#how-it-works`, label: copy.nav.howItWorks },
    { href: localizedPath(locale, '/blog'), label: copy.nav.blog },
    { href: localizedPath(locale, '/support'), label: copy.nav.support },
  ];

  return (
    <header className="site-header">
      <div className="header-inner shell">
        <Logo href={home} priority label={`${copy.footer.home} — Vella`} />
        <nav className="desktop-nav" aria-label={copy.nav.menu}>
          {nav.map((item) => (
            <Link href={item.href} key={item.href}>{item.label}</Link>
          ))}
        </nav>
        <div className="header-actions">
          <LanguageMenu locale={locale} label={copy.nav.language} currentPath={currentPath} />
          <StoreHeaderCta
            className="button button-small button-gold desktop-cta"
            label={copy.nav.download}
            iosUnavailableLabel={copy.download.appStoreSoon}
            fallbackHref={`${home}#download`}
            placement="header-desktop"
          />
          <details className="mobile-menu">
            <summary aria-label={copy.nav.menu}>
              <span></span><span></span><span></span>
            </summary>
            <div className="mobile-menu-panel">
              {nav.map((item) => (
                <Link href={item.href} key={item.href}>{item.label}</Link>
              ))}
              <StoreHeaderCta
                className="button button-gold"
                label={copy.nav.download}
                iosUnavailableLabel={copy.download.appStoreSoon}
                fallbackHref={`${home}#download`}
                placement="header-mobile"
              />
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
