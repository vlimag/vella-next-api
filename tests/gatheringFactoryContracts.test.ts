import { describe, expect, it } from 'vitest';
import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  generatedGatheringSchema,
  reviewDecisionSchema,
} from '@/lib/gatheringFactory/contracts';

const validStep = (section_type: (typeof GATHERING_SECTION_TYPES)[number]) => section_type === 'scripture'
  ? { section_type }
  : { section_type, body: `A short editorial invitation for ${section_type}.` };

const validCandidate = {
  schema_version: 1,
  theme_key: 'peace',
  scripture_reference: 'John 14:27',
  estimated_duration_seconds: 900,
  locales: Object.fromEntries(GATHERING_LOCALES.map((locale) => [locale, {
    title: `A quiet ${locale} gathering`,
    summary: 'A gentle space to receive peace and take one faithful next step.',
    steps: GATHERING_SECTION_TYPES.map(validStep),
  }])),
};

describe('gathering factory contracts', () => {
  it('accepts exactly eight supported locales and the canonical eight sections', () => {
    const parsed = generatedGatheringSchema.parse(validCandidate);

    expect(Object.keys(parsed.locales)).toEqual([...GATHERING_LOCALES]);
    expect(parsed.locales.en.steps.map((step) => step.section_type)).toEqual([...GATHERING_SECTION_TYPES]);
  });

  it('rejects duplicate and reordered section types at schema parse time', () => {
    const reordered = GATHERING_SECTION_TYPES.map((section_type, index) => index === 0
      ? 'opening_prayer'
      : index === 1 ? 'arrival' : section_type);
    const duplicate = GATHERING_SECTION_TYPES.map((section_type, index) => index === 7
      ? 'action' : section_type);

    for (const sections of [reordered, duplicate]) {
      expect(() => generatedGatheringSchema.parse({
        ...validCandidate,
        locales: {
          ...validCandidate.locales,
          en: { ...validCandidate.locales.en, steps: sections.map(validStep) },
        },
      })).toThrow();
    }
  });

  it('contains a strict canonical Scripture reference and no Scripture body field', () => {
    expect(generatedGatheringSchema.parse(validCandidate)).toMatchObject({
      scripture_reference: 'John 14:27',
    });
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      scripture_text: 'In the beginning...',
    })).toThrow();
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      scripture_reference: 'In the beginning God created the heavens and the earth.',
    })).toThrow();
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      locales: {
        ...validCandidate.locales,
        en: {
          ...validCandidate.locales.en,
          steps: validCandidate.locales.en.steps.map((step, index) => index === 2
            ? { section_type: 'scripture', body: 'Blessed are the peacemakers.' }
            : step),
        },
      },
    })).toThrow();
  });

  it('bounds duration, editorial copy, and theme keys', () => {
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      estimated_duration_seconds: 719,
    })).toThrow();
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      theme_key: 'invented_theme',
    })).toThrow();
    expect(() => generatedGatheringSchema.parse({
      ...validCandidate,
      locales: {
        ...validCandidate.locales,
        en: { ...validCandidate.locales.en, title: 'x'.repeat(161) },
      },
    })).toThrow();
  });

  it('accepts an explicit reviewer decision with bounded reasons', () => {
    expect(reviewDecisionSchema.parse({
      approved: true,
      reasons: ['All locales and safety checks passed.'],
    })).toEqual({
      approved: true,
      reasons: ['All locales and safety checks passed.'],
    });
    expect(() => reviewDecisionSchema.parse({ approved: true, unexpected: true })).toThrow();
  });
});
