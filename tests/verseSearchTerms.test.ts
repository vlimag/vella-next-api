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

  it.each([
    ['en', 'verses about forgiveness', 'forgive'],
    ['pt', 'versículos sobre perdão', 'perdoar'],
    ['es', 'versículos sobre el perdón', 'perdonar'],
    ['fr', 'versets sur le pardon', 'pardonner'],
    ['de', 'Verse über Vergebung', 'vergeben'],
    ['it', 'versetti sul perdono', 'perdonare'],
    ['ru', 'стихи о прощении', 'простить'],
    ['pl', 'wersety o przebaczeniu', 'przebaczyć'],
  ])('resolves forgiveness deterministically in %s', (language, query, localizedTerm) => {
    const intent = resolveSearchIntent(query);

    expect(intent).toBe('forgiveness');
    expect(fallbackTermsFromQuery(query, language)).toContain(localizedTerm);
    expect(referencesForIntent(intent)).toContainEqual({ bookCode: 'MAT', chapter: 18, verse: 22 });
  });

  it('does not confuse forgiveness with grief in Portuguese', () => {
    expect(resolveSearchIntent('versículos sobre perdão')).toBe('forgiveness');
    expect(resolveSearchIntent('versículos sobre perda')).toBe('grief');
  });

  it.each([
    ['en', 'psalms about liars', 'liar'],
    ['pt', 'salmos sobre pessoas mentirosas', 'mentira'],
    ['es', 'salmos sobre personas mentirosas', 'mentira'],
    ['fr', 'psaumes sur les menteurs', 'mensonge'],
    ['de', 'Psalmen über Lügner', 'Lüge'],
    ['it', 'salmi sulle persone bugiarde', 'bugia'],
    ['ru', 'псалмы о лжецах', 'ложь'],
    ['pl', 'psalmy o kłamcach', 'kłamstwo'],
  ])('resolves lying and deception deterministically in %s', (language, query, localizedTerm) => {
    const intent = resolveSearchIntent(query);

    expect(intent).toBe('deception');
    expect(fallbackTermsFromQuery(query, language)).toContain(localizedTerm);
    expect(referencesForIntent(intent)).toContainEqual({ bookCode: 'PSA', chapter: 116, verse: 11 });
  });
});
