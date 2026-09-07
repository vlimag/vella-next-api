import { afterEach, describe, expect, it, vi } from 'vitest';
import { localizeJourneyBlocksWithAI } from '../lib/aiLocalizer';
import {
  applyApprovedJourneyScripture,
  parseJourneyScriptureReference,
  selectApprovedJourneyScripture,
  type JourneyStepPayload,
} from '../lib/journeys';
import { steadyFlame14 } from '../content/rhythms/steadyFlame14';
import { rooted21 } from '../content/rhythms/rooted21';
import { pilgrim40 } from '../content/rhythms/pilgrim40';

const verseStep: JourneyStepPayload = {
  stepOrder: 1,
  stepType: 'verse',
  blockId: 'verse-block-id',
  blockSlug: 'verse-hope-jhn316',
  title: 'God Loves You',
  body: 'AI-authored or seeded wording must not be displayed as Scripture.',
  scriptureRef: 'AI John 3:16',
  scriptureVerseId: null,
  scriptureVersionCode: null,
  scriptureVersionName: null,
  scriptureLanguageCode: null,
  ctaText: 'Read this unverified quote',
  tag: 'hope',
  required: true,
};

function corpusRow(input: {
  id: string;
  language: string;
  text: string;
  versionCode: string;
  versionName: string;
  active?: boolean;
}) {
  return {
    id: input.id,
    chapter: 3,
    verse: 16,
    text_content: input.text,
    language_code: input.language,
    bible_books: { code: 'JHN' },
    bible_versions: {
      code: input.versionCode,
      name: input.versionName,
      is_active: input.active ?? true,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('journey Scripture provenance boundary', () => {
  it('prefers an active approved corpus row in the requested language', () => {
    const reference = parseJourneyScriptureReference('John 3:16');
    expect(reference).not.toBeNull();

    const selected = selectApprovedJourneyScripture(
      [
        corpusRow({
          id: 'english-id',
          language: 'en',
          text: 'For God so loved the world.',
          versionCode: 'KJV',
          versionName: 'King James Version',
        }),
        corpusRow({
          id: 'inactive-portuguese-id',
          language: 'pt',
          text: 'Inactive wording.',
          versionCode: 'OLD',
          versionName: 'Inactive Version',
          active: false,
        }),
        corpusRow({
          id: 'portuguese-id',
          language: 'pt',
          text: 'Porque Deus amou o mundo.',
          versionCode: 'BPM',
          versionName: 'Bíblia Portuguesa Mundial',
        }),
      ],
      'pt',
      reference!,
    );

    expect(selected).toMatchObject({
      verseId: 'portuguese-id',
      text: 'Porque Deus amou o mundo.',
      languageCode: 'pt',
      versionCode: 'BPM',
    });
  });

  it('falls back to approved English and attaches visible corpus attribution', () => {
    const reference = parseJourneyScriptureReference('John 3:16')!;
    const selected = selectApprovedJourneyScripture(
      [
        corpusRow({
          id: 'english-id',
          language: 'en',
          text: 'For God so loved the world.',
          versionCode: 'KJV',
          versionName: 'King James Version',
        }),
      ],
      'fr',
      reference,
    );

    const hydrated = applyApprovedJourneyScripture(verseStep, selected);
    expect(hydrated).toMatchObject({
      body: 'For God so loved the world.',
      scriptureRef: 'JHN 3:16',
      scriptureVerseId: 'english-id',
      scriptureVersionCode: 'KJV',
      scriptureVersionName: 'King James Version',
      scriptureLanguageCode: 'en',
    });
    expect(hydrated.body).not.toBe(verseStep.body);
  });

  it('keeps the journey step but strips unapproved stored verse content', () => {
    const sanitized = applyApprovedJourneyScripture(verseStep, null);

    expect(sanitized).toMatchObject({
      stepOrder: 1,
      stepType: 'verse',
      title: 'God Loves You',
      body: '',
      scriptureRef: null,
      scriptureVerseId: null,
      scriptureVersionCode: null,
      scriptureVersionName: null,
      scriptureLanguageCode: null,
      ctaText: null,
    });
  });

  it('uses only canonical English references to locate corpus rows', () => {
    expect(parseJourneyScriptureReference('Psalm 46:10')).toEqual({ bookCode: 'PSA', chapter: 46, verse: 10 });
    expect(parseJourneyScriptureReference('João 3:16')).toBeNull();
    expect(parseJourneyScriptureReference('Invented reference')).toBeNull();
  });

  it('never sends Scripture wording/reference fields for AI translation or accepts replacements', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body)) as { messages: Array<{ content: string }> };
      const prompt = request.messages.map((message) => message.content).join('\n');
      expect(prompt).not.toContain('Immutable approved source wording.');
      expect(prompt).not.toContain('John 3:16');

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      block_id: 'verse-block-id',
                      title: 'Título traduzido',
                      body: 'Fabricated model translation.',
                      scripture_ref: 'Referência fabricada 9:99',
                      cta_text: 'Leia devagar',
                    },
                  ],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await localizeJourneyBlocksWithAI({
      requestId: 'journey-scripture-test',
      sourceLanguage: 'en',
      targetLanguage: 'pt',
      blocks: [
        {
          block_id: 'verse-block-id',
          title: 'God Loves You',
          body: 'Immutable approved source wording.',
          scripture_ref: 'John 3:16',
          cta_text: 'Read slowly',
          is_scripture: true,
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result).toEqual([
      {
        block_id: 'verse-block-id',
        title: 'Título traduzido',
        body: 'Immutable approved source wording.',
        scripture_ref: 'John 3:16',
        cta_text: 'Leia devagar',
      },
    ]);
  });

  it('keeps every long-journey verse as a canonical corpus lookup without seeded wording', () => {
    for (const journey of [steadyFlame14, rooted21, pilgrim40]) {
      for (const session of journey.sessions) {
        const verse = session.steps[0];
        expect(verse.type).toBe('verse');
        expect(parseJourneyScriptureReference(verse.scriptureRef)).not.toBeNull();
        expect('scriptureText' in verse).toBe(false);
        for (const copy of Object.values(verse.localizations)) expect(copy.body).toBe('');
      }
    }
  });
});
