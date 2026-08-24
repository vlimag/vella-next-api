import type { SiteCopy } from '@/lib/site/types';
import { UI_LABELS } from '@/lib/site/uiLabels';

export function PhonePreview({ copy }: { copy: SiteCopy }) {
  const labels = UI_LABELS[copy.locale];

  return (
    <div className="phone-stage" aria-label={`${copy.preview.title} — Vella`}>
      <div className="orbit orbit-one"></div>
      <div className="orbit orbit-two"></div>
      <div className="phone">
        <div className="phone-top"><span></span></div>
        <div className="phone-screen">
          <div className="preview-status"><span>9:41</span><span>•••</span></div>
          <p className="preview-greeting">{copy.preview.greeting}</p>
          <div className="preview-title-row">
            <h2>{copy.preview.title}</h2>
            <span className="preview-flame">✦</span>
          </div>
          <div className="verse-card">
            <span className="verse-glow"></span>
            <p>{copy.preview.verse}</p>
            <small>{copy.preview.reference}</small>
          </div>
          <div className="journey-label"><span>{copy.preview.journey}</span><span>{copy.preview.minutes}</span></div>
          <div className="journey-card">
            <div className="journey-number">01</div>
            <div><strong>{copy.preview.journeyTitle}</strong><small>{copy.preview.reflection}</small></div>
            <span aria-hidden="true">→</span>
          </div>
          <div className="preview-nav"><span>⌂</span><span>✦</span><span>◇</span><span>○</span></div>
        </div>
      </div>
      <div className="floating-note note-one"><span>7</span><small>{labels.dayJourney}</small></div>
      <div className="floating-note note-two"><span>5</span><small>{labels.quietMinutes}</small></div>
    </div>
  );
}
