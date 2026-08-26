import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: null as unknown as ReturnType<typeof weeklyClient>,
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

import { GET } from '../app/api/v1/rhythms/weekly/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

type Result = { data: unknown; error: unknown };

function query(result: Result) {
  const filters: Array<[string, string, unknown]> = [];
  const value: Record<string, unknown> = { filters };
  value.select = vi.fn(() => value);
  value.eq = vi.fn((column: string, expected: unknown) => {
    filters.push(['eq', column, expected]);
    return value;
  });
  value.order = vi.fn(() => value);
  value.then = (resolve: (settled: Result) => unknown, reject?: (error: unknown) => unknown) => (
    Promise.resolve(result).then(resolve, reject)
  );
  return value;
}

function weeklyClient(options: { selected?: unknown; sessions?: unknown } = {}) {
  const queries: Record<string, ReturnType<typeof query>[]> = {};
  const from = vi.fn((table: string) => {
    const result = table === 'user_practices'
      ? { data: options.selected ?? [], error: null }
      : { data: options.sessions ?? [], error: null };
    const built = query(result);
    (queries[table] ??= []).push(built);
    return built;
  });
  return { from, queries };
}

async function get(week = '2026-08-24') {
  const response = await GET(new Request(`https://vella.one/api/v1/rhythms/weekly?week=${week}`));
  return { response, body: await response.json() };
}

describe('weekly Rhythms summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.client = weeklyClient();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns a finite empty current week before configuration', async () => {
    const response = await GET(new Request('https://vella.one/api/v1/rhythms/weekly'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      data: {
        schema_version: 1,
        week_start: '2026-08-24',
        timezone_name: 'UTC',
        configured: false,
        practices: [],
        rhythm_met: false,
      },
    });
    expect(mocks.client.queries.user_practices[0]?.filters).toContainEqual(['eq', 'user_id', USER_ID]);
    expect(mocks.client.from).toHaveBeenCalledTimes(1);
  });

  it('derives progress from completed sessions and counts journey credits once', async () => {
    mocks.client = weeklyClient({
      selected: [
        { practice_code: 'guided_prayer', weekly_target: 2, timezone_name: 'America/Sao_Paulo', status: 'active' },
        { practice_code: 'scripture', weekly_target: 1, timezone_name: 'America/Sao_Paulo', status: 'active' },
      ],
      sessions: [
        { practice_code: 'guided_prayer', source_type: 'journey', status: 'completed' },
        { practice_code: 'guided_prayer', source_type: 'direct', status: 'completed' },
        { practice_code: 'scripture', source_type: 'direct', status: 'completed' },
        { practice_code: 'scripture', source_type: 'direct', status: 'started' },
      ],
    });

    const { response, body } = await get();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      schema_version: 1,
      week_start: '2026-08-24',
      timezone_name: 'America/Sao_Paulo',
      configured: true,
      practices: [
        { code: 'guided_prayer', weekly_target: 2, completed_sessions: 2, target_met: true },
        { code: 'scripture', weekly_target: 1, completed_sessions: 1, target_met: true },
      ],
      rhythm_met: true,
    });
    expect(mocks.client.queries.practice_sessions[0]?.filters).toEqual(expect.arrayContaining([
      ['eq', 'user_id', USER_ID],
      ['eq', 'local_week_start', '2026-08-24'],
      ['eq', 'status', 'completed'],
    ]));
  });

  it('returns a prior local week without mixing current-week sessions', async () => {
    mocks.client = weeklyClient({
      selected: [
        { practice_code: 'gratitude', weekly_target: 2, timezone_name: 'Europe/Warsaw', status: 'active' },
        { practice_code: 'silence', weekly_target: 2, timezone_name: 'Europe/Warsaw', status: 'active' },
      ],
      sessions: [{ practice_code: 'gratitude', source_type: 'direct', status: 'completed' }],
    });

    const { response, body } = await get('2026-08-17');

    expect(response.status).toBe(200);
    expect(body.data.week_start).toBe('2026-08-17');
    expect(body.data.practices).toEqual([
      { code: 'gratitude', weekly_target: 2, completed_sessions: 1, target_met: false },
      { code: 'silence', weekly_target: 2, completed_sessions: 0, target_met: false },
    ]);
    expect(body.data.rhythm_met).toBe(false);
    expect(mocks.client.queries.practice_sessions[0]?.filters).toContainEqual([
      'eq', 'local_week_start', '2026-08-17',
    ]);
  });

  it.each(['2026-08-25', '2026-02-30', '26-08-24', ''])('rejects invalid or non-Monday week %j', async (week) => {
    const { response, body } = await get(week);

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error.details.code).toBe('invalid_week');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('fails closed when selected rows disagree on timezone', async () => {
    mocks.client = weeklyClient({
      selected: [
        { practice_code: 'guided_prayer', weekly_target: 2, timezone_name: 'UTC', status: 'active' },
        { practice_code: 'scripture', weekly_target: 3, timezone_name: 'Europe/Warsaw', status: 'active' },
      ],
    });

    const { response, body } = await get();

    expect(response.status).toBe(503);
    expect(body.error.details.code).toBe('weekly_summary_unavailable');
    expect(mocks.client.from).toHaveBeenCalledTimes(1);
  });

  it('does not expose account or session identifiers in the response or safe log', async () => {
    const privateError = { message: `private session for ${USER_ID}` };
    const broken = weeklyClient({ selected: [] });
    broken.from.mockImplementation(() => { throw privateError; });
    mocks.client = broken;
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, body } = await get();

    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain(USER_ID);
    expect(JSON.stringify(log.mock.calls)).not.toContain(USER_ID);
    expect(log).toHaveBeenCalledWith('[rhythms-weekly]', {
      route: 'rhythms_weekly', stage: 'load', code: 'database_unavailable',
    });
  });
});
