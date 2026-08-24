import { describe, expect, it } from 'vitest';
import {
  gentleNotificationBody,
  notificationBody,
  notificationFallbackBody,
  notificationTheme,
  notificationTitle,
  type DueDailyVerseNotification,
} from '@/lib/dailyVerseNotifications';

function due(overrides: Partial<DueDailyVerseNotification> = {}): DueDailyVerseNotification {
  return {
    user_id: '00000000-0000-4000-8000-000000000001',
    slot: 1,
    local_day: '2026-08-03',
    language_code: 'en',
    reminder_style: 'scripture',
    goal: 'habit',
    focus: null,
    ...overrides,
  };
}

describe('daily verse notification personalization', () => {
  it('prioritizes the current season over the broad goal', () => {
    expect(notificationTheme(due({ goal: 'study', focus: 'anxiety' }))).toBe('peace');
    expect(notificationTheme(due({ goal: 'family', focus: 'relationships' }))).toBe('relationships');
    expect(notificationTheme(due({ goal: 'prayer', focus: null }))).toBe('prayer');
  });

  it('localizes titles and falls back safely', () => {
    expect(notificationTitle('pt', 'scripture')).toContain('versículo');
    expect(notificationTitle('unknown', 'gentle')).toBe('A quiet word for you');
  });

  it('keeps notification bodies concise and includes an authoritative reference', () => {
    const body = notificationBody('word '.repeat(100), { book: 'PSA', chapter: 46, verse: 1 });
    expect(body.length).toBeLessThan(210);
    expect(body).toContain('PSA 46:1');
    expect(body).toContain('…');
  });

  it('never falls back to English copy for a localized notification', () => {
    const body = notificationFallbackBody('pt', { book: 'PSA', chapter: 46, verse: 1 });
    expect(body).toContain('Seu versículo está pronto');
    expect(body).toContain('PSA 46:1');
  });

  it('delivers localized encouragement directly instead of an open-app prompt', () => {
    const body = gentleNotificationBody('pt', due({ focus: 'anxiety' }));
    expect(body).toContain('Respire devagar');
    expect(body).not.toContain('Abra');
    expect(gentleNotificationBody('unknown', due({ focus: 'purpose' }))).toContain('next step');
  });
});
