import { describe, expect, it } from 'vitest';
import { resolveOnboardingMoment } from '@/lib/onboardingMoment';
import type { PrayerMomentVerseRow } from '@/lib/prayerSpace';

const approvedPortugueseRow: PrayerMomentVerseRow = {
  id: '11111111-1111-4111-8111-111111111111',
  text_content: 'Deixo-lhes a paz; a minha paz lhes dou.',
  language_code: 'pt',
  chapter: 14,
  verse: 27,
  bible_books: { code: 'JHN' },
  bible_versions: { code: 'NVI', name: 'Nova Versão Internacional', is_active: true },
};

const approvedEnglishRow: PrayerMomentVerseRow = {
  id: '22222222-2222-4222-8222-222222222222',
  text_content: 'Peace I leave with you; my peace I give you.',
  language_code: 'en',
  chapter: 14,
  verse: 27,
  bible_books: { code: 'JHN' },
  bible_versions: { code: 'WEB', name: 'World English Bible', is_active: true },
};

describe('resolveOnboardingMoment', () => {
  it('returns only normalized approved Scripture and localized guidance', async () => {
    const result = await resolveOnboardingMoment('peace', 'pt', async () => approvedPortugueseRow);

    expect(result).toMatchObject({
      theme: 'peace',
      requested_language: 'pt',
      scripture_language: 'pt',
      scripture_fallback: false,
    });
    expect(result?.scripture.text_content).toBe(approvedPortugueseRow.text_content);
    expect(result?.content.title).toBe('Um momento de paz');
    expect(result?.scripture).toEqual({
      id: approvedPortugueseRow.id,
      text_content: approvedPortugueseRow.text_content,
      chapter: 14,
      verse: 27,
      language_code: 'pt',
      bible_books: { code: 'JHN' },
      bible_versions: { code: 'NVI', name: 'Nova Versão Internacional' },
    });
  });

  it('falls back to approved English Scripture when the requested corpus has no verse', async () => {
    const requestedLanguages: string[] = [];

    const result = await resolveOnboardingMoment('peace', 'pt', async (language) => {
      requestedLanguages.push(language);
      return language === 'en' ? approvedEnglishRow : null;
    });

    expect(requestedLanguages).toEqual(['pt', 'en']);
    expect(result).toMatchObject({
      requested_language: 'pt',
      scripture_language: 'en',
      scripture_fallback: true,
      scripture: { text_content: approvedEnglishRow.text_content },
    });
  });

  it('returns null when approved Scripture is unavailable', async () => {
    await expect(resolveOnboardingMoment('peace', 'pt', async () => null)).resolves.toBeNull();
  });

  it('rejects a row that does not match the theme approved reference', async () => {
    const wrongReferenceRow = {
      ...approvedPortugueseRow,
      chapter: 3,
      verse: 5,
      bible_books: { code: 'PRO' },
    };

    await expect(resolveOnboardingMoment('peace', 'pt', async () => wrongReferenceRow)).resolves.toBeNull();
  });

  it('rejects rows outside the supported approved language and version state', async () => {
    const unsupportedLanguageRow = {
      ...approvedPortugueseRow,
      language_code: 'la',
    };
    const inactiveVersionRow = {
      ...approvedPortugueseRow,
      bible_versions: { code: 'NVI', name: 'Nova Versão Internacional', is_active: false },
    };

    await expect(resolveOnboardingMoment('peace', 'pt', async () => unsupportedLanguageRow)).resolves.toBeNull();
    await expect(resolveOnboardingMoment('peace', 'pt', async () => inactiveVersionRow)).resolves.toBeNull();
  });
});
