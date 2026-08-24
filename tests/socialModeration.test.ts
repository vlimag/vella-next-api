import { afterEach, describe, expect, it, vi } from 'vitest';
import { moderateFaithContent } from '../lib/socialModeration';

const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;

afterEach(() => {
  if (originalOpenAiApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAiApiKey;
  globalThis.fetch = originalFetch;
});

describe('social moderation', () => {
  it.each([
    ['Catholic', 'Hoje rezei o terço e participei da Eucaristia.'],
    ['Orthodox', 'Χριστὸς ἀνέστη ἐκ νεκρῶν, θανάτῳ θάνατον πατήσας.'],
    ['Arabic', 'المسيح قام! حقاً قام!'],
    ['Polish liturgical', 'Chwała Ojcu i Synowi, i Duchowi Świętemu.'],
    ['English liturgical', 'The Divine Liturgy and Eucharist brought such peace this morning.'],
  ])('does not hard-reject %s content without a dictionary keyword', async (_tradition, text) => {
    process.env.OPENAI_API_KEY = 'test-key';
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ flagged: false, categories: {} }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          allowed: true,
          reason: 'Faith-related reflection.',
          tags: ['faith'],
        }) } }],
      }), { status: 200 })) as typeof fetch;

    const verdict = await moderateFaithContent(text);

    expect(verdict).toMatchObject({
      allowed: true,
      source: 'openai',
    });
    expect(verdict.tags).not.toContain('off_topic_not_faith_related');
  });

  it('sends ordinary text without an English faith keyword to provider moderation', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ flagged: false, categories: {} }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              allowed: true,
              reason: 'Faith-related liturgical reflection.',
              tags: ['liturgical'],
            }),
          },
        }],
      }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const verdict = await moderateFaithContent('Ave Maria, gratia plena; Dominus tecum.');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(verdict).toMatchObject({
      allowed: true,
      source: 'openai',
      tags: ['liturgical'],
    });
  });

  it('keeps a deterministic block for an unambiguous spam solicitation', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as typeof fetch;

    const verdict = await moderateFaithContent('Buy now and DM me for the price.');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(verdict).toMatchObject({
      allowed: false,
      source: 'heuristic',
      tags: ['selling_or_spam'],
    });
  });

  it('honors a provider rejection for clearly off-topic content', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        results: [{ flagged: false, categories: {} }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{
          message: {
            content: JSON.stringify({
              allowed: false,
              reason: 'This is clearly unrelated to the faith community.',
              tags: ['off_topic'],
            }),
          },
        }],
      }), { status: 200 })) as typeof fetch;

    const verdict = await moderateFaithContent('Here are my fantasy football picks.');

    expect(verdict).toMatchObject({
      allowed: false,
      source: 'openai',
      tags: ['off_topic'],
    });
  });

  it('rejects harassment before the faith classifier runs', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      results: [{ flagged: true, categories: { harassment: true } }],
    }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;

    const verdict = await moderateFaithContent('You are worthless and nobody wants you here.');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(verdict).toMatchObject({
      allowed: false,
      source: 'openai_moderation',
      tags: ['harassment'],
    });
  });

  it('fails closed when moderation is unavailable', async () => {
    delete process.env.OPENAI_API_KEY;

    const verdict = await moderateFaithContent('A peaceful reflection about prayer.');

    expect(verdict).toMatchObject({
      allowed: false,
      source: 'unavailable',
      tags: ['moderation_unavailable'],
    });
  });
});
