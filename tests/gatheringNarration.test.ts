import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  generateVerseNarration: vi.fn(),
  requireActiveSubscription: vi.fn(),
  row: null as unknown,
  queryError: null as unknown,
  client: {} as Record<string, unknown>,
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));
vi.mock('../lib/verseNarration', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/verseNarration')>();
  return { ...original, generateVerseNarration: mocks.generateVerseNarration };
});

import { GET as getGatheringAudio } from '../app/api/v1/rhythms/gatherings/[templateId]/steps/[stepId]/audio/route';
import {
  createGatheringNarrationCacheKey,
  resolveApprovedGatheringNarration,
} from '../lib/gatheringNarration';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const STEP_ID = '33333333-3333-4333-8333-333333333333';
const VERSE_ID = '44444444-4444-4444-8444-444444444444';
const audio = new Uint8Array(2_048).fill(7).buffer;

function activeEditorialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: STEP_ID,
    section_type: 'reflection',
    editorial_text: 'Approved Vella editorial reflection.',
    scripture_verse_id: null,
    narration_asset_key: 'gathering_weekly_rest_v1_en_reflection',
    gathering_templates: {
      id: TEMPLATE_ID,
      slug: 'weekly-rest',
      version: 1,
      locale: 'en',
      status: 'published',
      available_from: '2026-08-26T00:00:00.000Z',
      available_until: null,
      editorial_revision: 'editorial.1',
    },
    bible_verses: null,
    ...overrides,
  };
}

function storageWith(cached: ArrayBuffer | null = null) {
  const download = vi.fn(async () => ({
    data: cached ? new Blob([cached], { type: 'audio/mpeg' }) : null,
    error: cached ? null : { message: 'not found', statusCode: '404' },
  }));
  const upload = vi.fn(async () => ({ data: {}, error: null }));
  return { from: vi.fn(() => ({ download, upload })), download, upload };
}

function queryClient(row: unknown, storage = storageWith()) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq']) builder[method] = vi.fn(() => builder);
  builder.maybeSingle = vi.fn(async () => ({ data: row, error: mocks.queryError }));
  const client = { from: vi.fn(() => builder), storage };
  return { client, builder, storage };
}

function routeContext() {
  return { params: Promise.resolve({ templateId: TEMPLATE_ID, stepId: STEP_ID }) };
}

describe('Gathering narration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.generateVerseNarration.mockResolvedValue(audio);
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    mocks.queryError = null;
    mocks.client = queryClient(activeEditorialRow()).client;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('deduplicates equal approved content while invalidating a new content version', () => {
    const base = {
      contentVersion: 'weekly-rest:1:editorial.1',
      language: 'en',
      style: 'gathering',
      text: 'Approved Vella editorial reflection.',
      voice: 'marin' as const,
    };
    const first = createGatheringNarrationCacheKey(base);
    const equalContentFromAnotherStep = createGatheringNarrationCacheKey({ ...base });
    const newVersion = createGatheringNarrationCacheKey({
      ...base,
      contentVersion: 'weekly-rest:2:editorial.2',
    });

    expect(first).toMatch(/^v1\/gathering\/en\/marin\/[a-f0-9]{64}\.mp3$/);
    expect(equalContentFromAnotherStep).toBe(first);
    expect(newVersion).not.toBe(first);
    expect(first).not.toContain(base.text);
  });

  it('resolves only active, approved stored editorial or Scripture content', () => {
    const editorial = resolveApprovedGatheringNarration(activeEditorialRow(), new Date());
    expect(editorial).toEqual(expect.objectContaining({
      contentVersion: 'weekly-rest:1:editorial.1',
      language: 'en',
      text: 'Approved Vella editorial reflection.',
    }));

    const scripture = resolveApprovedGatheringNarration(activeEditorialRow({
      section_type: 'scripture',
      editorial_text: null,
      scripture_verse_id: VERSE_ID,
      narration_asset_key: 'gathering_weekly_rest_v1_en_scripture',
      bible_verses: {
        id: VERSE_ID,
        text_content: 'Approved public Scripture text.',
        language_code: 'en',
        bible_versions: { is_active: true },
      },
    }), new Date());
    expect(scripture?.text).toBe('Approved public Scripture text.');
    expect(JSON.stringify(scripture)).not.toContain(USER_ID);
  });

  it.each([
    activeEditorialRow({ section_type: 'private_prayer' }),
    activeEditorialRow({ narration_asset_key: null }),
    activeEditorialRow({ gathering_templates: { ...activeEditorialRow().gathering_templates, status: 'draft' } }),
    activeEditorialRow({ gathering_templates: { ...activeEditorialRow().gathering_templates, available_from: '2026-08-27T00:00:00.000Z' } }),
    activeEditorialRow({ gathering_templates: { ...activeEditorialRow().gathering_templates, available_until: '2026-08-26T11:59:59.000Z' } }),
  ])('rejects private, unavailable, or inactive content', (row) => {
    expect(resolveApprovedGatheringNarration(row, new Date())).toBeNull();
  });

  it('serves a cache hit without calling the speech provider', async () => {
    const fixture = queryClient(activeEditorialRow(), storageWith(audio));
    mocks.client = fixture.client;

    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=marin`),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('x-vella-audio-cache')).toBe('hit');
    expect(mocks.generateVerseNarration).not.toHaveBeenCalled();
    expect(fixture.storage.upload).not.toHaveBeenCalled();
  });

  it('generates and caches a miss using only server-loaded approved content', async () => {
    const fixture = queryClient(activeEditorialRow());
    mocks.client = fixture.client;

    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=cedar`),
      routeContext(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-vella-audio-cache')).toBe('miss');
    expect(mocks.generateVerseNarration).toHaveBeenCalledWith(expect.objectContaining({
      language: 'en',
      text: 'Approved Vella editorial reflection.',
      voice: 'cedar',
    }));
    expect(fixture.storage.upload).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.generateVerseNarration.mock.calls)).not.toContain(USER_ID);
  });

  it.each([
    activeEditorialRow({ section_type: 'private_prayer' }),
    activeEditorialRow({ gathering_templates: { ...activeEditorialRow().gathering_templates, status: 'retired' } }),
  ])('returns not found for excluded content without calling the provider', async (row) => {
    mocks.client = queryClient(row).client;
    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=marin`),
      routeContext(),
    );
    expect(response.status).toBe(404);
    expect(mocks.generateVerseNarration).not.toHaveBeenCalled();
  });

  it('returns the subscription gate without loading approved content', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Subscription required' } }), { status: 402 }),
    });
    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=marin`),
      routeContext(),
    );
    expect(response.status).toBe(402);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('contains provider timeout without logging approved content', async () => {
    const privateText = 'Approved content that must not enter logs';
    mocks.client = queryClient(activeEditorialRow({ editorial_text: privateText })).client;
    mocks.generateVerseNarration.mockRejectedValue(new Error('provider_timeout'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=marin`),
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error.details.code).toBe('narration_unavailable');
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateText);
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
  });

  it('contains a database failure without logging provider detail or identifiers', async () => {
    const privateDetail = `database detail ${USER_ID}`;
    mocks.queryError = { message: privateDetail };
    mocks.client = queryClient(null).client;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getGatheringAudio(
      new Request(`https://vella.one/audio?voice=marin`),
      routeContext(),
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error.details.code).toBe('narration_unavailable');
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateDetail);
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
  });
});
