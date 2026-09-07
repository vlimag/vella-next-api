import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  resolveReadOnlyContentViewer: vi.fn(),
  client: null as unknown as {
    from: (table: string) => unknown;
    rpc: (...args: unknown[]) => unknown;
  },
}));

vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
  resolveReadOnlyContentViewer: mocks.resolveReadOnlyContentViewer,
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => mocks.client,
}));

import { GET as getPrayerMoment } from '../app/api/v1/prayers/moment/route';
import { POST as recordPrayerMoment } from '../app/api/v1/prayers/[prayerId]/pray/route';
import { PATCH as patchPrayer } from '../app/api/v1/prayers/[prayerId]/route';
import { POST as createPrayer } from '../app/api/v1/prayers/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRAYER_ID = '22222222-2222-4222-8222-222222222222';

function chain(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => result);
  builder.single = vi.fn(async () => result);
  return builder;
}

describe('Prayer Space routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.resolveReadOnlyContentViewer.mockResolvedValue({ userId: USER_ID, isAnonymous: false });
  });

  it('returns the stable PrayerMoment shape and declares an English Scripture fallback', async () => {
    let requestedLanguage = '';
    const verseBuilder: Record<string, unknown> = {};
    verseBuilder.select = vi.fn(() => verseBuilder);
    verseBuilder.eq = vi.fn((field: string, value: unknown) => {
      if (field === 'language_code') requestedLanguage = String(value);
      return verseBuilder;
    });
    verseBuilder.order = vi.fn(() => verseBuilder);
    verseBuilder.limit = vi.fn(() => verseBuilder);
    verseBuilder.maybeSingle = vi.fn(async () => requestedLanguage === 'pt'
      ? { data: null, error: null }
      : {
          data: {
            id: '33333333-3333-4333-8333-333333333333',
            text_content: 'In peace I will lie down and sleep.',
            language_code: 'en',
            chapter: 4,
            verse: 8,
            bible_books: { code: 'PSA' },
            bible_versions: { code: 'WEB', name: 'World English Bible', is_active: true },
          },
          error: null,
        });

    mocks.client = {
      from: (table) => {
        if (table !== 'bible_verses') throw new Error(`Unexpected table: ${table}`);
        return verseBuilder;
      },
      rpc: vi.fn(),
    };

    const response = await getPrayerMoment(
      new Request('https://vella.one/api/v1/prayers/moment?theme=rest&lang=pt'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      theme: 'rest',
      requested_language: 'pt',
      scripture_language: 'en',
      scripture_fallback: true,
      content: {
        title: expect.any(String),
        reflection: expect.any(String),
        prayer_prompt: expect.any(String),
        action: expect.any(String),
      },
      scripture: {
        id: '33333333-3333-4333-8333-333333333333',
        chapter: 4,
        verse: 8,
        language_code: 'en',
        bible_books: { code: 'PSA' },
        bible_versions: { code: 'WEB', name: 'World English Bible' },
      },
    });
    expect(Object.keys(json.data).sort()).toEqual([
      'content',
      'requested_language',
      'scripture',
      'scripture_fallback',
      'scripture_language',
      'theme',
    ]);
  });

  it('returns {item, counted} for both a new check-in and a same-day retry', async () => {
    const item = {
      id: PRAYER_ID,
      title: 'Family',
      body: null,
      theme: 'family',
      status: 'active',
      verse_id: null,
      prayed_count: 1,
      last_prayed_on: '2026-08-03',
      answered_at: null,
      answer_note: null,
      created_at: '2026-08-03T12:00:00.000Z',
      updated_at: '2026-08-03T12:00:00.000Z',
      bible_verses: null,
    };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ counted: true }], error: null })
      .mockResolvedValueOnce({ data: [{ counted: false }], error: null });

    mocks.client = {
      from: (table) => {
        if (table === 'prayer_intentions') {
          const builder: Record<string, unknown> = {};
          builder.select = vi.fn((columns: string) => {
            const selected = columns === 'id, status'
              ? { data: { id: PRAYER_ID, status: 'active' }, error: null }
              : { data: item, error: null };
            return chain(selected);
          });
          return builder;
        }
        if (table === 'user_settings') {
          return {
            select: () => chain({ data: { daily_verse_timezone: 'America/Sao_Paulo' }, error: null }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      rpc,
    };

    const call = () => recordPrayerMoment(
      new Request(`https://vella.one/api/v1/prayers/${PRAYER_ID}/pray`, { method: 'POST' }),
      { params: Promise.resolve({ prayerId: PRAYER_ID }) },
    );

    const first = await call();
    const second = await call();
    await expect(first.json()).resolves.toEqual({ data: { item, counted: true } });
    await expect(second.json()).resolves.toEqual({ data: { item, counted: false } });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledWith('record_prayer_checkin', expect.objectContaining({
      p_prayer_intention_id: PRAYER_ID,
      p_user_id: USER_ID,
    }));
  });

  it('creates a private intention with a stable item response', async () => {
    const item = {
      id: PRAYER_ID,
      title: 'Wisdom for a decision',
      body: 'Help me recognize the next faithful step.',
      theme: 'guidance',
      status: 'active',
      verse_id: null,
      prayed_count: 0,
      last_prayed_on: null,
      answered_at: null,
      answer_note: null,
      created_at: '2026-08-03T12:00:00.000Z',
      updated_at: '2026-08-03T12:00:00.000Z',
      bible_verses: null,
    };
    const insert = vi.fn(() => chain({ data: item, error: null }));
    mocks.client = {
      from: vi.fn(() => ({ insert })),
      rpc: vi.fn(),
    };

    const response = await createPrayer(
      new Request('https://vella.one/api/v1/prayers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: 'Wisdom for a decision',
          body: 'Help me recognize the next faithful step.',
          theme: 'guidance',
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: item });
    expect(insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      title: 'Wisdom for a decision',
      body: 'Help me recognize the next faithful step.',
      theme: 'guidance',
      status: 'active',
      verse_id: null,
    });
  });

  it('keeps PATCH limited to status and answer_note', async () => {
    mocks.client = {
      from: vi.fn(() => chain({ data: null, error: null })),
      rpc: vi.fn(),
    };

    const response = await patchPrayer(
      new Request(`https://vella.one/api/v1/prayers/${PRAYER_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Private text must not be accepted here' }),
      }),
      { params: Promise.resolve({ prayerId: PRAYER_ID }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.client.from).not.toHaveBeenCalled();
  });

  it('marks an owned intention answered and returns the updated item directly', async () => {
    const updatedItem = {
      id: PRAYER_ID,
      title: 'A private intention',
      body: null,
      theme: 'hope',
      status: 'answered',
      verse_id: null,
      prayed_count: 4,
      last_prayed_on: '2026-08-03',
      answered_at: '2026-08-03T22:00:00.000Z',
      answer_note: 'Grateful for a wise next step.',
      created_at: '2026-07-30T12:00:00.000Z',
      updated_at: '2026-08-03T22:00:00.000Z',
      bible_verses: null,
    };
    const update = vi.fn(() => chain({ data: updatedItem, error: null }));
    let callCount = 0;
    const from = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return {
          select: () => chain({
            data: { id: PRAYER_ID, status: 'active', answered_at: null, answer_note: null },
            error: null,
          }),
        };
      }
      return { update };
    });
    mocks.client = { from, rpc: vi.fn() };

    const response = await patchPrayer(
      new Request(`https://vella.one/api/v1/prayers/${PRAYER_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          status: 'answered',
          answer_note: 'Grateful for a wise next step.',
        }),
      }),
      { params: Promise.resolve({ prayerId: PRAYER_ID }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: updatedItem });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'answered',
      answer_note: 'Grateful for a wise next step.',
      answered_at: expect.any(String),
    }));
  });
});
