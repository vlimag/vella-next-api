import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  client: null as unknown as { from: (table: string) => unknown },
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from '../app/api/v1/onboarding/moment/route';

const approvedPortugueseVerse = {
  id: '33333333-3333-4333-8333-333333333333',
  text_content: 'Deixo-lhes a paz; a minha paz lhes dou.',
  language_code: 'pt',
  chapter: 14,
  verse: 27,
  bible_books: { code: 'JHN' },
  bible_versions: { code: 'NVI', name: 'Nova Versão Internacional', is_active: true },
};

function verseClient(result: { data: unknown; error: unknown }) {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);

  return { from: vi.fn(() => query) };
}

describe('GET /api/v1/onboarding/moment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.client = verseClient({ data: approvedPortugueseVerse, error: null });
  });

  it.each([
    'https://vella.one/api/v1/onboarding/moment?theme=unknown&lang=pt',
    'https://vella.one/api/v1/onboarding/moment?theme=peace&lang=unknown',
  ])('rejects an unsupported required enum value', async (url) => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
  });

  it.each([
    ['a missing theme', 'https://vella.one/api/v1/onboarding/moment?lang=pt'],
    ['a missing language', 'https://vella.one/api/v1/onboarding/moment?theme=peace'],
    ['an extra query field', 'https://vella.one/api/v1/onboarding/moment?theme=peace&lang=pt&extra=value'],
  ])('rejects %s', async (_case, url) => {
    const response = await GET(new Request(url));

    expect(response.status).toBe(400);
  });

  it('does not require a subscription for the single onboarding moment', async () => {
    const response = await GET(
      new Request('https://vella.one/api/v1/onboarding/moment?theme=peace&lang=pt'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      theme: 'peace',
      requested_language: 'pt',
      scripture_language: 'pt',
      scripture_fallback: false,
      scripture: {
        id: approvedPortugueseVerse.id,
        text_content: approvedPortugueseVerse.text_content,
        language_code: 'pt',
      },
    });
  });

  it('returns a coarse 404 when approved content is unavailable', async () => {
    mocks.client = verseClient({ data: null, error: null });

    const response = await GET(
      new Request('https://vella.one/api/v1/onboarding/moment?theme=peace&lang=pt'),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Approved first moment is unavailable',
        details: { code: 'content_unavailable' },
      },
    });
    expect(response.status).toBe(404);
  });

  it('returns a coarse 500 without the database error message', async () => {
    const databaseMessage = 'database credential details must not be public';
    mocks.client = verseClient({ data: null, error: { message: databaseMessage } });

    const response = await GET(
      new Request('https://vella.one/api/v1/onboarding/moment?theme=peace&lang=pt'),
    );
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json).toEqual({
      error: {
        message: 'Could not load the first moment',
        details: { code: 'content_lookup_failed' },
      },
    });
    expect(JSON.stringify(json)).not.toContain(databaseMessage);
  });

  it('returns a coarse 500 when service client initialization fails', async () => {
    mocks.createServiceClient.mockImplementationOnce(() => {
      throw new Error('service client initialization details must not be public');
    });

    const response = await GET(
      new Request('https://vella.one/api/v1/onboarding/moment?theme=peace&lang=pt'),
    );

    await expect(response.json()).resolves.toEqual({
      error: {
        message: 'Could not load the first moment',
        details: { code: 'content_lookup_failed' },
      },
    });
    expect(response.status).toBe(500);
  });
});
