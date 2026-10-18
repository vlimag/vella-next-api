import Link from 'next/link';
import { getPost } from '@/lib/site/blog';
import { localizedPath, type Locale } from '@/lib/site/config';
import type { SiteCopy } from '@/lib/site/types';

const GUIDE_SLUGS = [
  'how-to-start-reading-the-bible-seven-day-plan',
  'a-short-night-prayer-for-the-end-of-the-day',
  'a-gentle-daily-scripture-rhythm',
] as const;

export function PracticeGuides({ locale, copy }: { locale: Locale; copy: SiteCopy }) {
  return (
    <section className="section section-warm">
      <div className="shell">
        <div className="section-heading centered">
          <p className="eyebrow">{copy.blog.eyebrow}</p>
          <h2>{copy.blog.title}</h2>
          <p>{copy.blog.body}</p>
        </div>
        <div className="feature-grid">
          {GUIDE_SLUGS.map((slug) => {
            const post = getPost(locale, slug)!;
            return (
              <article className="feature-card" key={slug}>
                <p className="card-eyebrow">{post.category}</p>
                <h3><Link href={localizedPath(locale, `/blog/${slug}`)}>{post.title}</Link></h3>
                <p>{post.description}</p>
              </article>
            );
          })}
        </div>
        <div className="centered-action">
          <Link className="text-link" href={localizedPath(locale, '/blog')}>{copy.blog.readAll}<span aria-hidden="true">→</span></Link>
        </div>
      </div>
    </section>
  );
}
