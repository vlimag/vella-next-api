import { describe, expect, it } from 'vitest';
import {
  GATHERING_LOCALES,
  GATHERING_SECTION_TYPES,
  type GeneratedGathering,
} from '@/lib/gatheringFactory/contracts';
import {
  generateGatheringDraft,
  resolveCanonicalScripture,
  reviewGatheringDraft,
  type CanonicalScriptureRepository,
  type FactoryDeps,
} from '@/lib/gatheringFactory/openai';

const validDraft = (): GeneratedGathering => ({
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
  }])) as GeneratedGathering['locales'],
});

const deps = (body: unknown, overrides: Partial<FactoryDeps> = {}): FactoryDeps => ({
  fetch: async (_input, init) => {
    expect(init?.signal).toBeDefined();
    return new Response(JSON.stringify(body), { status: 200 });
  },
  apiKey: 'test-key',
  now: () => new Date('2026-08-27T12:00:00.000Z'),
  timeoutMs: 250,
  maxInputTokens: 2_000,
  maxOutputTokens: 1_500,
  ...overrides,
});

describe('gathering factory Responses API adapter', () => {
  it('generates with the fixed model, strict schema, metadata, no user fields, and bounded usage', async () => {
    const result = await generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({
      output_text: JSON.stringify(validDraft()),
      usage: { input_tokens: 1_200, output_tokens: 900 },
    }));

    const request = result.request as Record<string, any>;
    expect(request.model).toBe('gpt-5.6-sol');
    expect(request.store).toBe(false);
    expect(request.text.format.type).toBe('json_schema');
    expect(request.text.format.strict).toBe(true);
    expect(request.metadata).toEqual({ prompt_revision: 'gathering-factory.1' });
    expect(JSON.stringify(request)).not.toContain('user_id');
    expect(result.usage).toEqual({ inputTokens: 1_200, outputTokens: 900 });
    expect(result.draft).toEqual(validDraft());
  });

  it('fails closed for timeout, HTTP failure, malformed JSON, schema failure, and token ceilings', async () => {
    const cases: Array<{ name: string; factory: () => Promise<unknown>; code: string }> = [
      {
        name: 'timeout',
        factory: () => generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({}, {
          fetch: async () => { throw new DOMException('timed out', 'TimeoutError'); },
        })),
        code: 'openai_timeout',
      },
      {
        name: 'http failure',
        factory: () => generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({}, {
          fetch: async () => new Response('upstream failure', { status: 503 }),
        })),
        code: 'openai_http',
      },
      {
        name: 'malformed JSON',
        factory: () => generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({ output_text: '{' })),
        code: 'openai_malformed_json',
      },
      {
        name: 'schema failure',
        factory: () => generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({ output_text: JSON.stringify({ nope: true }) })),
        code: 'draft_schema_invalid',
      },
      {
        name: 'token ceiling',
        factory: () => generateGatheringDraft({ themeKey: 'peace', slotType: 'monday' }, deps({
          output_text: JSON.stringify(validDraft()),
          usage: { input_tokens: 2_001, output_tokens: 900 },
        })),
        code: 'token_budget_exceeded',
      },
    ];

    for (const testCase of cases) {
      await expect(testCase.factory(), testCase.name).rejects.toMatchObject({ code: testCase.code });
    }
  });

  it('rejects a reviewer decision that is not approved', async () => {
    await expect(reviewGatheringDraft(validDraft(), deps({
      output_text: JSON.stringify({ approved: false, reasons: ['Needs a safer revision.'] }),
      usage: { input_tokens: 1_200, output_tokens: 900 },
    }))).rejects.toMatchObject({ code: 'review_rejected' });
  });

  it('resolves approved canonical Scripture for every locale and fails closed when one is missing', async () => {
    const repository: CanonicalScriptureRepository = {
      findApprovedByReference: async () => GATHERING_LOCALES.map((locale, index) => ({
        id: `verse-${index}`,
        locale,
        text: `Canonical text ${locale}`,
      })),
    };

    await expect(resolveCanonicalScripture('John 14:27', repository)).resolves.toEqual(
      Object.fromEntries(GATHERING_LOCALES.map((locale, index) => [locale, {
        id: `verse-${index}`,
        locale,
        text: `Canonical text ${locale}`,
      }])),
    );

    await expect(resolveCanonicalScripture('John 14:27', {
      findApprovedByReference: async () => [{ id: 'verse-en', locale: 'en', text: 'Canonical text' }],
    })).rejects.toMatchObject({ code: 'canonical_scripture_missing' });
  });
});
