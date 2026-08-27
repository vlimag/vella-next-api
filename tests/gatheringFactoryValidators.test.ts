import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  type GeneratedGathering,
} from '@/lib/gatheringFactory/contracts';
import {
  candidateContentHash,
  validateGatheringCandidate,
} from '@/lib/gatheringFactory/validators';

type LooseCandidate = {
  schema_version: number;
  theme_key: string;
  scripture_reference: string;
  estimated_duration_seconds: number;
  locales: Record<string, { title: string; summary: string; steps: Array<Record<string, string | undefined>> }>;
};

const validCandidate = (): LooseCandidate => ({
  schema_version: 1,
  theme_key: 'peace',
  scripture_reference: 'John 14:27',
  estimated_duration_seconds: 900,
  locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
    title: `A quiet ${locale} gathering`,
    summary: 'A gentle space to receive peace and take one faithful next step.',
    steps: GATHERING_SECTION_TYPES.map((section_type) => section_type === 'scripture'
      ? { section_type }
      : { section_type, body: `A short editorial invitation for ${section_type}.` }),
  }])),
});

const release = (content: LooseCandidate, published_at: string) => ({
  published_at,
  content: content as unknown as GeneratedGathering,
});

describe('gathering factory validators', () => {
  it('accepts a complete safe candidate', () => {
    expect(validateGatheringCandidate(validCandidate(), { recentReleases: [] })).toEqual({ ok: true });
  });

  it('rejects model-written Scripture text', () => {
    const candidate = { ...validCandidate(), scripture_text: 'Blessed are the peacemakers.' };

    expect(validateGatheringCandidate(candidate, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'scripture_text_forbidden',
    });

    const plainVerse = validCandidate();
    plainVerse.locales.en.steps[2] = {
      section_type: 'scripture',
      body: 'Blessed are the peacemakers, for they shall be called children of God.',
    };
    expect(validateGatheringCandidate(plainVerse, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'scripture_text_forbidden',
    });
  });

  it('rejects a candidate missing French', () => {
    const candidate = validCandidate();
    const { fr: _missingFrench, ...locales } = candidate.locales;

    expect(validateGatheringCandidate({ ...candidate, locales }, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'locale_incomplete',
    });
  });

  it('rejects a candidate with seven steps', () => {
    const candidate = validCandidate();
    const steps = candidate.locales.en.steps.slice(0, 7);

    expect(validateGatheringCandidate({
      ...candidate,
      locales: { ...candidate.locales, en: { ...candidate.locales.en, steps } },
    }, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'step_contract_invalid',
    });
  });

  it('rejects invalid duration and unsafe editorial patterns', () => {
    expect(validateGatheringCandidate({ ...validCandidate(), estimated_duration_seconds: 1_081 }, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'duration_invalid',
    });

    const candidate = validCandidate();
    candidate.locales.en.steps[3] = {
      section_type: 'reflection',
      body: 'This practice will cure your anxiety and guarantees a perfect outcome.',
    };
    expect(validateGatheringCandidate(candidate, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'prohibited_content',
    });
  });

  it('rejects private identifiers and personal contact details', () => {
    const candidate = validCandidate();
    candidate.locales.de.steps[0] = {
      section_type: 'arrival',
      body: 'Please contact private@example.com and include your user_id in the prayer.',
    };

    expect(validateGatheringCandidate(candidate, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'prohibited_content',
    });
  });

  it('rejects prohibited claims in localized editorial copy', () => {
    const candidate = validCandidate();
    candidate.locales.es.steps[3] = {
      section_type: 'reflection',
      body: 'Esta práctica te curará y está garantizada para resolver toda ansiedad.',
    };

    expect(validateGatheringCandidate(candidate, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'prohibited_content',
    });
  });

  it('rejects a candidate too similar to one of the last twelve releases', () => {
    const candidate = validCandidate();

    expect(validateGatheringCandidate(candidate, {
      recentReleases: [release(candidate, '2026-08-27T00:00:00Z')],
    })).toEqual({
      ok: false,
      code: 'similarity_too_high',
    });
  });

  it('hashes canonical content deterministically', () => {
    const candidate = validCandidate();
    const reordered = {
      estimated_duration_seconds: candidate.estimated_duration_seconds,
      locales: Object.fromEntries([...GATHERING_LOCALES].reverse().map((locale) => [
        locale,
        {
          steps: [...candidate.locales[locale].steps].reverse().reverse(),
          summary: `  ${candidate.locales[locale].summary}  `,
          title: candidate.locales[locale].title,
        },
      ])),
      scripture_reference: candidate.scripture_reference,
      schema_version: candidate.schema_version,
      theme_key: candidate.theme_key,
    };

    expect(candidateContentHash(candidate)).toBe(candidateContentHash(reordered));
    expect(candidateContentHash(candidate)).toMatch(/^[0-9a-f]{64}$/);
    expect(candidateContentHash(candidate)).toBe(
      createHash('sha256').update(JSON.stringify(canonicalize(candidateContentHashInput(candidate)))).digest('hex'),
    );
    expect(() => candidateContentHash({ ...candidate, unapproved_metadata: 'ignored' })).toThrow();
  });

  it('scans the Scripture reference and localized strings for private identifiers', () => {
    const emailReference = { ...validCandidate(), scripture_reference: 'John 14:27 private@example.com' };
    expect(validateGatheringCandidate(emailReference, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'prohibited_content',
    });

    const verseReference = { ...validCandidate(), scripture_reference: 'In the beginning God created the heavens and the earth.' };
    expect(validateGatheringCandidate(verseReference, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'scripture_reference_invalid',
    });

    const phone = validCandidate();
    phone.locales.fr.steps[0] = { section_type: 'arrival', body: 'Call +1 415 555 0132 for a private prayer.' };
    expect(validateGatheringCandidate(phone, { recentReleases: [] })).toEqual({
      ok: false,
      code: 'prohibited_content',
    });
  });

  it('rejects malformed, unsorted, oversized, or caller-scored release history', () => {
    const candidate = validCandidate();
    const newest = release(candidate, '2026-08-27T00:00:00Z');
    const older = release({ ...candidate, theme_key: 'hope' }, '2026-08-26T00:00:00Z');

    expect(validateGatheringCandidate(candidate, {
      recentReleases: [older, newest],
    })).toEqual({ ok: false, code: 'release_history_invalid' });
    expect(validateGatheringCandidate(candidate, {
      recentReleases: Array.from({ length: 13 }, (_, index) => release(
        { ...candidate, theme_key: index % 2 ? 'hope' : 'peace' },
        `2026-08-${String(27 - index).padStart(2, '0')}T00:00:00Z`,
      )),
    })).toEqual({ ok: false, code: 'release_history_invalid' });
    expect(validateGatheringCandidate(candidate, {
      recentReleases: [{ published_at: newest.published_at, content: candidate, similarity: 1 }],
    } as never)).toEqual({ ok: false, code: 'release_history_invalid' });
    expect(validateGatheringCandidate(candidate, {} as never)).toEqual({ ok: false, code: 'release_history_invalid' });
  });

  it('normalizes Unicode NFC, NBSP, and all whitespace in the explicit content hash', () => {
    const candidate = validCandidate();
    const equivalent = validCandidate();
    equivalent.locales.pt.summary = 'A\u00a0gentle\nspace\tto receive peace and take one faithful next step.';
    candidate.locales.pt.summary = 'A gentle space to receive peace and take one faithful next step.';
    expect(candidateContentHash(candidate)).toBe(candidateContentHash(equivalent));

    const decomposed = validCandidate();
    const composed = validCandidate();
    decomposed.locales.it.title = 'Preghiera e\u0301 pace';
    composed.locales.it.title = 'Preghiera é pace';
    expect(candidateContentHash(decomposed)).toBe(candidateContentHash(composed));
  });
});

function candidateContentHashInput(candidate: LooseCandidate) {
  return {
    theme_key: candidate.theme_key,
    scripture_reference: candidate.scripture_reference,
    estimated_duration_seconds: candidate.estimated_duration_seconds,
    locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
      steps: candidate.locales[locale].steps,
      summary: candidate.locales[locale].summary,
      title: candidate.locales[locale].title,
    }])),
  };
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') return value.normalize('NFC').replace(/\u00a0/gu, ' ').replace(/\s+/gu, ' ').trim();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}
