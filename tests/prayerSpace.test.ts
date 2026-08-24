import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  localDayInTimeZone,
  normalizePrayerMomentScripture,
  PRAYER_MOMENT_LANGUAGES,
  PRAYER_MOMENT_REFERENCES,
  PRAYER_THEMES,
  prayerMomentGuidance,
  resolvePrayerMomentVerse,
  type PrayerMomentVerseRow,
} from '@/lib/prayerSpace';

function verse(languageCode: string): PrayerMomentVerseRow {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    text_content: 'Approved Scripture text',
    language_code: languageCode,
    chapter: 4,
    verse: 8,
    bible_books: [{ code: 'PSA' }],
    bible_versions: [{ code: 'WEB', name: 'World English Bible', is_active: true }],
  };
}

describe('private Prayer Space', () => {
  it('has complete curated guidance for every supported theme and locale', () => {
    for (const language of PRAYER_MOMENT_LANGUAGES) {
      for (const theme of PRAYER_THEMES) {
        const content = prayerMomentGuidance(theme, language);
        expect(Object.keys(content).sort()).toEqual([
          'action',
          'prayer_prompt',
          'reflection',
          'title',
        ]);
        expect(content.title.length).toBeGreaterThan(3);
        expect(content.reflection.length).toBeGreaterThan(12);
        expect(content.prayer_prompt.length).toBeGreaterThan(12);
        expect(content.action.length).toBeGreaterThan(20);
      }
    }

    expect(PRAYER_MOMENT_REFERENCES.rest).toEqual({ book: 'PSA', chapter: 4, verse: 8 });
  });

  it('uses an exact localized verse first and only then the explicit English fallback', async () => {
    const load = vi.fn(async (language: string) => language === 'en' ? verse('en') : null);
    const resolved = await resolvePrayerMomentVerse('pt', load);

    expect(load.mock.calls.map(([language]) => language)).toEqual(['pt', 'en']);
    expect(resolved?.language_code).toBe('en');
    expect(normalizePrayerMomentScripture(resolved!, 'pt')).toMatchObject({
      language_code: 'en',
      fallback_language: 'en',
      bible_books: { code: 'PSA' },
      bible_versions: { code: 'WEB', name: 'World English Bible' },
    });

    load.mockClear();
    load.mockResolvedValue(verse('pt'));
    await expect(resolvePrayerMomentVerse('pt', load)).resolves.toMatchObject({ language_code: 'pt' });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('records the same local calendar day across UTC boundaries and falls back safely', () => {
    const now = new Date('2026-08-04T02:30:00.000Z');
    expect(localDayInTimeZone('America/Sao_Paulo', now)).toBe('2026-08-03');
    expect(localDayInTimeZone('Europe/Warsaw', now)).toBe('2026-08-04');
    expect(localDayInTimeZone('not/a-time-zone', now)).toBe('2026-08-04');
  });

  it('keeps ownership, approved Scripture, and same-day idempotency enforced in SQL', () => {
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), '../supabase/migrations/20260803223000_prayer_space.sql'),
      'utf8',
    );

    expect(migration).toContain('references auth.users(id) on delete cascade');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('auth.uid() = user_id');
    expect(migration).toContain('version.is_active = true');
    expect(migration).toContain('unique (prayer_intention_id, prayed_on)');
    expect(migration).toContain('on conflict (prayer_intention_id, prayed_on) do nothing');
    expect(migration).toContain('inserted_checkin_id is not null');
    expect(migration).toContain('to service_role');
  });
});

