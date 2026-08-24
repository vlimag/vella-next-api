import { describe, expect, it } from 'vitest';
import {
  detectSearchLanguage,
  fallbackTermsFromQuery,
  normalizeSearchText,
  referencesForIntent,
  resolveSearchIntent,
} from '../lib/verseSearchTerms';

describe('deterministic verse search intent', () => {
  it('corrects the common strength typo without depending on AI', () => {
    const intent = resolveSearchIntent('verse about strengh');
    expect(intent).toBe('strength');
    expect(fallbackTermsFromQuery('verse about strengh', 'en')).toEqual(
      expect.arrayContaining(['strength', 'courage']),
    );
    expect(referencesForIntent(intent).length).toBeGreaterThanOrEqual(3);
  });

  it('understands localized, accented intent queries', () => {
    expect(resolveSearchIntent('versículo sobre força')).toBe('strength');
    expect(fallbackTermsFromQuery('versículo sobre força', 'pt')).toContain('força');
  });

  it('prefers the query language and falls back to the selected app language', () => {
    expect(detectSearchLanguage('verso sobre força', 'en')).toBe('pt');
    expect(detectSearchLanguage('verso sobre fuerza', 'pt')).toBe('es');
    expect(detectSearchLanguage('verse about strength', 'pt')).toBe('en');
    expect(detectSearchLanguage('Isaías 41:10', 'pt-BR')).toBe('pt');
  });

  it('preserves non-Latin text during normalization', () => {
    expect(normalizeSearchText('Стихи о силе!')).toBe('стихи о силе');
    expect(resolveSearchIntent('стихи о силе')).toBe('strength');
  });
});
