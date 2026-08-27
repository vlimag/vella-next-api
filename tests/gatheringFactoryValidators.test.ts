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

const validCandidate = (): GeneratedGathering => ({
  schema_version: 1,
  theme_key: 'peace',
  scripture_reference: 'John 14:27',
  estimated_duration_seconds: 900,
  locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
    title: `A quiet ${locale} gathering`,
    summary: 'A gentle space to receive peace and take one faithful next step.',
    steps: GATHERING_SECTION_TYPES.map((section_type) => ({
      section_type,
      body: `A short editorial invitation for ${section_type}.`,
    })),
  }])) as GeneratedGathering['locales'],
});

describe('gathering factory validators', () => {
  it('accepts a complete safe candidate', () => {
    expect(validateGatheringCandidate(validCandidate(), {})).toEqual({ ok: true });
  });

  it('rejects model-written Scripture text', () => {
    const candidate = { ...validCandidate(), scripture_text: 'Blessed are the peacemakers.' };

    expect(validateGatheringCandidate(candidate, {})).toEqual({
      ok: false,
      code: 'scripture_text_forbidden',
    });
  });

  it('rejects a candidate missing French', () => {
    const candidate = validCandidate();
    const { fr: _missingFrench, ...locales } = candidate.locales;

    expect(validateGatheringCandidate({ ...candidate, locales }, {})).toEqual({
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
    }, {})).toEqual({
      ok: false,
      code: 'step_contract_invalid',
    });
  });

  it('rejects invalid duration and unsafe editorial patterns', () => {
    expect(validateGatheringCandidate({ ...validCandidate(), estimated_duration_seconds: 1_081 }, {})).toEqual({
      ok: false,
      code: 'duration_invalid',
    });

    const candidate = validCandidate();
    candidate.locales.en.steps[3] = {
      section_type: 'reflection',
      body: 'This practice will cure your anxiety and guarantees a perfect outcome.',
    };
    expect(validateGatheringCandidate(candidate, {})).toEqual({
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

    expect(validateGatheringCandidate(candidate, {})).toEqual({
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

    expect(validateGatheringCandidate(candidate, {})).toEqual({
      ok: false,
      code: 'prohibited_content',
    });
  });

  it('rejects a candidate too similar to one of the last twelve releases', () => {
    const candidate = validCandidate();

    expect(validateGatheringCandidate(candidate, {
      recentReleases: [candidate],
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
      scripture_reference: `  ${candidate.scripture_reference}  `,
      schema_version: candidate.schema_version,
      theme_key: candidate.theme_key,
    };

    expect(candidateContentHash(candidate)).toBe(candidateContentHash(reordered));
    expect(candidateContentHash(candidate)).toMatch(/^[0-9a-f]{64}$/);
    expect(candidateContentHash(candidate)).toBe(
      createHash('sha256').update(JSON.stringify(canonicalize(candidateContentHashInput(candidate)))).digest('hex'),
    );
  });
});

function candidateContentHashInput(candidate: GeneratedGathering) {
  return {
    estimated_duration_seconds: candidate.estimated_duration_seconds,
    locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
      steps: candidate.locales[locale].steps,
      summary: candidate.locales[locale].summary,
      title: candidate.locales[locale].title,
    }])),
    schema_version: candidate.schema_version,
    scripture_reference: candidate.scripture_reference,
    theme_key: candidate.theme_key,
  };
}

function canonicalize(value: unknown): unknown {
  if (typeof value === 'string') return value.trim().replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ');
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}
