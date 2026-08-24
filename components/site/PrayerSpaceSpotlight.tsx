import Link from 'next/link';
import type { Locale } from '@/lib/site/config';
import { localizedPath } from '@/lib/site/config';
import type { PrayerSpaceCopy } from '@/lib/site/prayerSpace';
import { PRAYER_SPACE_ARTICLE_PATH, PRAYER_SPACE_PATH } from '@/lib/site/prayerSpace';
import { PrayerSpacePreview } from './PrayerSpacePreview';

export function PrayerSpaceSpotlight({
  locale,
  copy,
  surface = 'light',
}: {
  locale: Locale;
  copy: PrayerSpaceCopy;
  surface?: 'light' | 'warm';
}) {
  return (
    <section className={`prayer-spotlight prayer-spotlight-${surface}`} id="prayer-space">
      <div className="shell prayer-spotlight-grid">
        <div className="prayer-spotlight-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}<br /><em>{copy.accent}</em></h2>
          <p>{copy.body}</p>
          <ul>
            {copy.promise.points.map((point) => <li key={point}><span aria-hidden="true">✓</span>{point}</li>)}
          </ul>
          <div className="prayer-spotlight-actions">
            <Link className="button button-dark" href={localizedPath(locale, PRAYER_SPACE_PATH)}>
              {copy.primaryCta}<span aria-hidden="true">→</span>
            </Link>
            <Link className="text-link" href={localizedPath(locale, PRAYER_SPACE_ARTICLE_PATH)}>
              {copy.articleCta}<span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="prayer-trust-line"><span aria-hidden="true">◇</span>{copy.trustLine}</p>
        </div>
        <PrayerSpacePreview copy={copy} compact />
      </div>
    </section>
  );
}

