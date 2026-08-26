import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: null as unknown as { from: (table: string) => unknown },
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

import { GET } from '../app/api/v1/rhythms/summary/route';
import { resolveRhythmsCapabilities } from '../lib/rhythms/capabilities';
import {
  isBadgeAssetKey,
  isMilestoneCode,
  isStableSlug,
  type RhythmsSummary,
} from '../lib/rhythms/contracts';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PRIVATE_UUID = '22222222-2222-4222-8222-222222222222';

const FUTURE_SCHEMA_V1_SUMMARY: RhythmsSummary = {
  schema_version: 1,
  capabilities: {
    journey_v2: true,
    practices: true,
    gatherings: true,
    social_badges: true,
    long_journeys: true,
  },
  unrevealed_milestones: [{ code: 'journey_finisher', asset_key: 'flame.spark' }],
};

type TableResult = { data: unknown; error: unknown } | Error;

function summaryClient(results: Partial<Record<string, TableResult>> = {}) {
  return {
    from: vi.fn((table: string) => {
      const query: Record<string, unknown> = {};
      query.select = vi.fn(() => query);
      query.eq = vi.fn(() => query);
      query.in = vi.fn(() => query);
      query.order = vi.fn(() => query);
      query.limit = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => results[table] ?? { data: [], error: null });
      query.then = (resolve: (value: TableResult) => unknown, reject?: (error: unknown) => unknown) => {
        const result = results[table] ?? { data: [], error: null };
        return result instanceof Error ? Promise.reject(result).then(resolve, reject) : Promise.resolve(result).then(resolve);
      };
      return query;
    }),
  };
}

async function get(url = 'https://vella.one/api/v1/rhythms/summary?lang=en') {
  const response = await GET(new Request(url));
  return { response, json: await response.json() };
}

function expectNoStore(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('no-store');
}

describe('Vella Rhythms summary capability boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'foundation');
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.client = summaryClient();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('denies unauthenticated access without caching or querying Rhythms data', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Authentication required' } }), { status: 401 }),
    });

    const { response, json } = await get();

    expect(response.status).toBe(401);
    expectNoStore(response);
    expect(json).not.toHaveProperty('data');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('denies inactive subscriptions without caching or querying Rhythms data', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Subscription required' } }), { status: 402 }),
    });

    const { response, json } = await get();

    expect(response.status).toBe(402);
    expectNoStore(response);
    expect(json).not.toHaveProperty('data');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it.each(['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl'])('accepts the supported %s locale', async (lang) => {
    const { response, json } = await get(`https://vella.one/api/v1/rhythms/summary?lang=${lang}`);

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json).toEqual({
      data: {
        schema_version: 1,
        capabilities: {
          journey_v2: false,
          practices: false,
          gatherings: false,
          social_badges: false,
          long_journeys: false,
        },
      },
    });
  });

  it('rejects an invalid locale without caching or querying Rhythms data', async () => {
    const { response, json } = await get('https://vella.one/api/v1/rhythms/summary?lang=ko');

    expect(response.status).toBe(400);
    expectNoStore(response);
    expect(json).toHaveProperty('error');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it.each([
    ['off', { journey_v2: false, practices: false, gatherings: false, social_badges: false, long_journeys: false }],
    ['foundation', { journey_v2: false, practices: false, gatherings: false, social_badges: false, long_journeys: false }],
    ['journey_v2', { journey_v2: true, practices: false, gatherings: false, social_badges: false, long_journeys: false }],
    ['practices', { journey_v2: true, practices: true, gatherings: false, social_badges: false, long_journeys: false }],
    ['gatherings', { journey_v2: true, practices: true, gatherings: true, social_badges: false, long_journeys: false }],
    ['social_badges', { journey_v2: true, practices: true, gatherings: true, social_badges: true, long_journeys: false }],
    ['long_journeys', { journey_v2: true, practices: true, gatherings: true, social_badges: true, long_journeys: true }],
  ] as const)('resolves the ordered %s phase without exposing it', (phase, expected) => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', phase);

    expect(resolveRhythmsCapabilities()).toEqual(expected);
  });

  it.each([undefined, '', ' FOUNDATION ', 'future_internal_rollout'])('fails closed for missing or invalid phases', (phase) => {
    if (phase === undefined) vi.unstubAllEnvs();
    else vi.stubEnv('VELLA_RHYTHMS_PHASE', phase);

    expect(resolveRhythmsCapabilities()).toEqual({
      journey_v2: false,
      practices: false,
      gatherings: false,
      social_badges: false,
      long_journeys: false,
    });
  });

  it('returns a valid empty foundation response before a user configures a rhythm', async () => {
    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json).toEqual({
      data: {
        schema_version: 1,
        capabilities: {
          journey_v2: false,
          practices: false,
          gatherings: false,
          social_badges: false,
          long_journeys: false,
        },
      },
    });
  });

  it('degrades only a failed enabled section and logs a finite safe diagnostic', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'practices');
    const privateError = { code: '42P01', message: `relation for ${USER_ID} is missing` };
    mocks.client = summaryClient({
      user_practices: { data: null, error: privateError },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json).toEqual({
      data: {
        schema_version: 1,
        capabilities: {
          journey_v2: true,
          practices: false,
          gatherings: false,
          social_badges: false,
          long_journeys: false,
        },
      },
    });
    expect(log).toHaveBeenCalledWith('[rhythms-summary]', {
      route: 'rhythms_summary', stage: 'practices', code: 'database_unavailable',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateError.message);
  });

  it('treats a missing Rhythms relation as an unavailable section instead of failing the route', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'gatherings');
    mocks.client = summaryClient({
      user_gathering_progress: {
        data: null,
        error: { code: 'PGRST205', message: 'table details are private' },
      },
    });

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.capabilities).toEqual({
      journey_v2: true, practices: true, gatherings: false, social_badges: false, long_journeys: false,
    });
    expect(json.data).not.toHaveProperty('current_gathering');
  });

  it('degrades social badges alone when milestone data is unavailable', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'social_badges');
    mocks.client = summaryClient({
      user_featured_milestones: { data: null, error: { code: '42P01', message: 'private migration detail' } },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.capabilities).toEqual({
      journey_v2: true, practices: true, gatherings: true, social_badges: false, long_journeys: false,
    });
    expect(json.data).not.toHaveProperty('unrevealed_milestones');
    expect(log).toHaveBeenCalledWith('[rhythms-summary]', {
      route: 'rhythms_summary', stage: 'milestones', code: 'database_unavailable',
    });
  });

  it('keeps valid earlier and later sections when a middle section query rejects', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'social_badges');
    mocks.client = summaryClient({
      user_journeys: {
        data: [{
          status: 'active', current_day: 2, total_completed_days: 1,
          journey_templates: { slug: 'hope-in-seven' },
        }],
        error: null,
      },
      user_practices: new Error(`practice query failed for ${USER_ID}`),
      user_gathering_progress: {
        data: [{
          current_step: 2, status: 'in_progress', gathering_templates: { slug: 'weekly-rest' },
        }],
        error: null,
      },
      user_featured_milestones: { data: [], error: null },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.capabilities).toEqual({
      journey_v2: true, practices: false, gatherings: true, social_badges: true, long_journeys: false,
    });
    expect(json.data.active_journey).toEqual({
      template_key: 'hope-in-seven', current_session: 2, completed_sessions: 1,
    });
    expect(json.data.current_gathering).toEqual({
      template_key: 'weekly-rest', current_step: 2, status: 'in_progress',
    });
    expect(log).toHaveBeenCalledWith('[rhythms-summary]', {
      route: 'rhythms_summary', stage: 'practices', code: 'database_unavailable',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
  });

  it('uses a position-only featured-milestones availability probe without fabricating unrevealed badges', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'social_badges');
    const selectCalls: Array<{ table: string; fields: unknown }> = [];
    const client = summaryClient({ user_featured_milestones: { data: [], error: null } });
    const from = vi.fn((table: string) => {
      const query = client.from(table) as Record<string, unknown>;
      const select = query.select as ReturnType<typeof vi.fn>;
      query.select = vi.fn((fields: unknown) => {
        selectCalls.push({ table, fields });
        return select(fields);
      });
      return query;
    });
    mocks.client = { from };

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.capabilities.social_badges).toBe(true);
    expect(json.data).not.toHaveProperty('unrevealed_milestones');
    expect(from).toHaveBeenCalledWith('user_featured_milestones');
    expect(selectCalls.filter(({ table }) => table === 'user_featured_milestones')).toEqual([
      { table: 'user_featured_milestones', fields: 'position' },
    ]);
  });

  it('keeps future schema-v1 milestone data assignable while current responses omit it', async () => {
    expect(FUTURE_SCHEMA_V1_SUMMARY.unrevealed_milestones).toEqual([
      { code: 'journey_finisher', asset_key: 'flame.spark' },
    ]);

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expect(json.data).not.toHaveProperty('unrevealed_milestones');
  });

  it('accepts contextual catalog keys while rejecting UUID-shaped stable keys', () => {
    expect(isMilestoneCode('streak_3')).toBe(true);
    expect(isMilestoneCode('journey_finisher')).toBe(true);
    expect(isBadgeAssetKey('flame.spark')).toBe(true);
    expect(isBadgeAssetKey('flame.steady')).toBe(true);
    expect(isStableSlug('hope-in-seven')).toBe(true);
    expect(isMilestoneCode('a1111111-1111-4111-8111-111111111111')).toBe(false);
    expect(isBadgeAssetKey('a1111111-1111-4111-8111-111111111111')).toBe(false);
    expect(isStableSlug('a1111111-1111-4111-8111-111111111111')).toBe(false);
  });

  it('omits malformed and unknown catalog rows without inventing progress or leaking private fields', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'long_journeys');
    mocks.client = summaryClient({
      user_journeys: {
        data: [{
          id: PRIVATE_UUID,
          user_id: USER_ID,
          status: 'active',
          current_day: 2,
          total_completed_days: 1,
          journey_templates: { slug: 'hope-in-seven', duration_days: 7, title: 'Private reflection text' },
        }],
        error: null,
      },
      user_practices: {
        data: [
          { id: PRIVATE_UUID, user_id: USER_ID, practice_code: 'scripture', weekly_target: 3, status: 'active', practice_definitions: { code: 'scripture' } },
          { id: 'bad-id', user_id: USER_ID, practice_code: 'unknown_future_catalog', weekly_target: 999, status: 'active', practice_definitions: { code: 'unknown_future_catalog' } },
        ],
        error: null,
      },
      user_gathering_progress: { data: [], error: null },
      user_milestones: { data: [], error: null },
    });

    const { response, json } = await get();
    const serialized = JSON.stringify(json);

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data).toMatchObject({
      schema_version: 1,
      active_journey: { template_key: 'hope-in-seven', current_session: 2, completed_sessions: 1 },
      practices: [{ code: 'scripture', weekly_target: 3, status: 'active' }],
    });
    expect(json.data.practices).toHaveLength(1);
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain(PRIVATE_UUID);
    expect(serialized).not.toContain('Private reflection text');
    expect(serialized).not.toContain('unknown_future_catalog');
    expect(serialized).not.toContain('completed_this_week');
  });

  it('returns only a validated finite next action target key', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'journey_v2');
    mocks.client = summaryClient({
      user_journeys: {
        data: [{
          status: 'completed', current_day: 7, total_completed_days: 7, completed_at: '2026-08-20T00:00:00.000Z',
          journey_templates: { slug: 'hope-in-seven', duration_days: 7 },
        }],
        error: null,
      },
    });

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.next_action).toEqual({ kind: 'choose_journey', target_key: 'journeys' });
  });

  it('returns the newest valid completed journey alongside an active journey', async () => {
    vi.stubEnv('VELLA_RHYTHMS_PHASE', 'journey_v2');
    mocks.client = summaryClient({
      user_journeys: {
        data: [
          {
            status: 'completed', current_day: 7, total_completed_days: 7, completed_at: '2026-08-01T00:00:00.000Z',
            journey_templates: { slug: 'older-path' },
          },
          {
            status: 'active', current_day: 2, total_completed_days: 1, completed_at: null,
            journey_templates: { slug: 'active-path' },
          },
          {
            status: 'completed', current_day: 14, total_completed_days: 14, completed_at: '2026-08-20T00:00:00.000Z',
            journey_templates: { slug: 'newer-path' },
          },
        ],
        error: null,
      },
    });

    const { response, json } = await get();

    expect(response.status).toBe(200);
    expectNoStore(response);
    expect(json.data.active_journey).toEqual({
      template_key: 'active-path', current_session: 2, completed_sessions: 1,
    });
    expect(json.data.latest_completed_journey).toEqual({
      template_key: 'newer-path', completed_sessions: 14,
    });
    expect(json.data.next_action).toEqual({ kind: 'continue_journey', target_key: 'active-path' });
  });

  it('returns a finite no-store response when the access gate rejects', async () => {
    mocks.requireActiveSubscription.mockRejectedValue(new Error(`private gate failure for ${USER_ID}`));

    const { response, json } = await get();

    expect(response.status).toBe(503);
    expectNoStore(response);
    expect(json).toEqual({
      error: { message: 'Could not load Rhythms summary', details: { code: 'rhythms_unavailable' } },
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });
});
