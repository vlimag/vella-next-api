import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const JOURNEY_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  requireActiveSubscription: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({ requireActiveSubscription: mocks.requireActiveSubscription }));

type HistoryModule = { GET?: (request: Request) => Promise<Response> };
const modulePath = '../app/api/v1/journeys/history/route';

async function historyModule(): Promise<HistoryModule> {
  return import(modulePath).catch(() => ({}));
}

function historyClient(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn> | ((resolve: (value: typeof result) => unknown) => Promise<unknown>)> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.in = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return { from: vi.fn(() => query), query };
}

async function get(path = '?limit=20') {
  const module = await historyModule();
  expect(typeof module.GET).toBe('function');
  const response = await module.GET!(new Request(`https://vella.one/api/v1/journeys/history${path}`));
  return { response, json: await response.json() };
}

describe('journey history route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.createServiceClient.mockReturnValue(historyClient({ data: [], error: null }));
  });

  it('returns a finite no-store empty history for the authenticated account', async () => {
    const { response, json } = await get();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ data: { journeys: [] } });
  });

  it.each(['1', '20', '50'])('accepts the exact bounded history limit %s', async (limit) => {
    const client = historyClient({ data: [], error: null });
    mocks.createServiceClient.mockReturnValue(client);

    const { response } = await get(`?limit=${limit}`);

    expect(response.status).toBe(200);
    expect(client.query.limit).toHaveBeenCalledWith(Number(limit));
  });

  it.each(['0', '51', '-1', '+1', '1.5', ' 1', '1 ', 'abc'])('rejects malformed history limit %s without querying', async (limit) => {
    const { response, json } = await get(`?limit=${encodeURIComponent(limit)}`);

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json.error.message).toBe('Invalid request input');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects repeated history limits without querying', async () => {
    const { response } = await get('?limit=1&limit=20');

    expect(response.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('orders owned completed rows deterministically and strips journals, owners, and arbitrary database fields', async () => {
    const privateNote = 'private reflection that must never leave the journey ledger';
    const client = historyClient({
      data: [{
        id: JOURNEY_ID,
        user_id: USER_ID,
        anonymous_profile_id: '33333333-3333-4333-8333-333333333333',
        status: 'completed',
        current_day: 7,
        start_date: '2026-08-01',
        completed_at: '2026-08-08T10:00:00.000Z',
        total_completed_days: 7,
        timezone_name: 'America/Sao_Paulo',
        reflection_note: privateNote,
        daily_sessions: [{ reflection_note: privateNote, gratitude_note: privateNote, completed_steps: [{ body: privateNote }] }],
        journey_templates: {
          slug: 'daily-faith-journey', version: 1, language_code: 'en', title: 'Seven Days',
          subtitle: 'A steady rhythm', description: 'Private-safe template summary', theme_tags: ['hope', 'gratitude'],
        },
        arbitrary_database_field: privateNote,
      }],
      error: null,
    });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await get('?limit=1');
    const serialized = JSON.stringify(json);

    expect(response.status).toBe(200);
    expect(client.query.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(client.query.eq).toHaveBeenCalledWith('status', 'completed');
    expect(client.query.order).toHaveBeenNthCalledWith(1, 'completed_at', { ascending: false });
    expect(client.query.order).toHaveBeenNthCalledWith(2, 'id', { ascending: true });
    expect(json).toEqual({
      data: {
        journeys: [{
          id: JOURNEY_ID,
          template_slug: 'daily-faith-journey',
          template_version: 1,
          locale: 'en',
          title: 'Seven Days',
          summary: 'Private-safe template summary',
          status: 'completed',
          current_session: 7,
          session_count: 7,
          started_at: '2026-08-01',
          completed_at: '2026-08-08T10:00:00.000Z',
          theme_keys: ['hope', 'gratitude'],
        }],
      },
    });
    expect(serialized).not.toContain(USER_ID);
    expect(serialized).not.toContain(privateNote);
    expect(serialized).not.toContain('anonymous_profile_id');
  });

  it('returns active, paused, and completed journeys only when the new client explicitly requests all', async () => {
    const client = historyClient({
      data: [{
        id: JOURNEY_ID,
        status: 'active',
        current_day: 3,
        start_date: '2026-08-24',
        completed_at: null,
        total_completed_days: 2,
        journey_templates: {
          slug: 'daily-faith-journey', version: 1, language_code: 'pt', title: 'Sete dias',
          description: 'Uma jornada privada e contínua', theme_tags: ['hope'],
        },
      }],
      error: null,
    });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await get('?limit=20&scope=all');

    expect(response.status).toBe(200);
    expect(client.query.in).toHaveBeenCalledWith('status', ['active', 'paused', 'completed']);
    expect(client.query.eq).not.toHaveBeenCalledWith('status', 'completed');
    expect(json.data.journeys[0]).toMatchObject({
      status: 'active', current_session: 3, session_count: 2, completed_at: null,
    });
  });

  it.each(['unknown', 'active', ' completed'])('rejects unsupported history scope %s', async (scope) => {
    const { response } = await get(`?scope=${encodeURIComponent(scope)}`);
    expect(response.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('contains database failures in a finite no-store response and safe logs', async () => {
    const privateMessage = `relation for ${USER_ID} contains private journals`;
    mocks.createServiceClient.mockReturnValue(historyClient({ data: null, error: { message: privateMessage } }));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await get();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not load journey history', details: { code: 'journey_history_unavailable' } } });
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateMessage);
  });
});
