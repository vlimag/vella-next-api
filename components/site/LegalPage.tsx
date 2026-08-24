import type { LegalSection } from '@/lib/site/types';

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  navigationLabel,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  navigationLabel: string;
}) {
  return (
    <article className="legal-page shell">
      <header className="legal-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-intro">{intro}</p>
        <p className="legal-updated">{updated}</p>
      </header>
      <div className="legal-layout">
        <aside className="legal-aside" aria-label={navigationLabel}>
          <p>Vella</p>
          <span>{updated}</span>
        </aside>
        <div className="legal-content">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets ? (
                <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              ) : null}
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
