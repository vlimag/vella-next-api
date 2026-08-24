import type { PrayerSpaceCopy } from '@/lib/site/prayerSpace';

export function PrayerSpacePreview({ copy, compact = false }: { copy: PrayerSpaceCopy; compact?: boolean }) {
  return (
    <div className={compact ? 'prayer-preview prayer-preview-compact' : 'prayer-preview'} aria-label={copy.preview.title}>
      <div className="prayer-preview-topline">
        <span className="prayer-preview-mark" aria-hidden="true">V</span>
        <div>
          <small>{copy.eyebrow}</small>
          <strong>{copy.preview.title}</strong>
        </div>
        <span className="privacy-pill"><span aria-hidden="true">●</span>{copy.preview.privateLabel}</span>
      </div>

      <div className="prayer-need-card">
        <small>{copy.preview.needLabel}</small>
        <p>{copy.preview.need}</p>
      </div>

      <div className="prayer-scripture-card">
        <small>{copy.preview.scriptureLabel}</small>
        <blockquote>{copy.preview.scripture}</blockquote>
        <span>{copy.preview.reference}</span>
      </div>

      <div className="prayer-own-words">
        <small>{copy.preview.prayerLabel}</small>
        <p>{copy.preview.prayer}</p>
      </div>

      <div className="prayer-preview-status">
        <span className="status-prayed"><i aria-hidden="true">✓</i>{copy.preview.prayedLabel}</span>
        <span><i aria-hidden="true">✦</i>{copy.preview.answeredLabel}</span>
      </div>
    </div>
  );
}

