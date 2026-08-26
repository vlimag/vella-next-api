import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: null as unknown as ReturnType<typeof practiceClient>,
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

import { GET, PUT } from '../app/api/v1/rhythms/practices/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
const CATALOG = [
  {
    code: 'guided_prayer', asset_key: 'practice_guided_prayer', session_kind: 'guided_prayer',
    recommended_weekly_target: 2, is_active: true, version: 1,
  },
  {
    code: 'scripture', asset_key: 'practice_scripture', session_kind: 'scripture',
    recommended_weekly_target: 3, is_active: true, version: 1,
  },
  {
    code: 'gratitude', asset_key: 'practice_gratitude', session_kind: 'gratitude',
    recommended_weekly_target: 2, is_active: true, version: 1,
  },
  {
    code: 'silence', asset_key: 'practice_silence', session_kind: 'silence',
    recommended_weekly_target: 2, is_active: true, version: 1,
  },
] as const;

type Result = { data: unknown; error: unknown };

function query(result: Result) {
  const filters: Array<[string, string, unknown]> = [];
  const value: Record<string, unknown> = { filters };
  value.select = vi.fn(() => value);
  value.eq = vi.fn((column: string, expected: unknown) => {
    filters.push(['eq', column, expected]);
    return value;
  });
  value.in = vi.fn((column: string, expected: unknown) => {
    filters.push(['in', column, expected]);
    return value;
  });
  value.order = vi.fn(() => value);
  value.then = (resolve: (settled: Result) => unknown, reject?: (error: unknown) => unknown) => (
    Promise.resolve(result).then(resolve, reject)
  );
  return value;
}

function practiceClient(options: {
  catalog?: unknown;
  selected?: unknown;
  rpcData?: unknown;
  rpcError?: unknown;
} = {}) {
  const queries: Record<string, ReturnType<typeof query>[]> = {};
  const from = vi.fn((table: string) => {
    const result = table === 'practice_definitions'
      ? { data: options.catalog ?? CATALOG, error: null }
      : { data: options.selected ?? [], error: null };
    const built = query(result);
    (queries[table] ??= []).push(built);
    return built;
  });
  const rpc = vi.fn(async () => ({ data: options.rpcData ?? [], error: options.rpcError ?? null }));
  return { from, rpc, queries };
}

function request(body: unknown) {
  return new Request('https://vella.one/api/v1/rhythms/practices', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function json(response: Response) {
  return { response, body: await response.json() };
}

describe('Rhythms practice configuration route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.client = practiceClient();
  });

  afterEach(() => vi.restoreAllMocks());

  it('returns the active catalog and only the authenticated account configuration', async () => {
    mocks.client = practiceClient({
      selected: [
        { user_id: USER_ID, practice_code: 'scripture', weekly_target: 3, timezone_name: 'America/Sao_Paulo', status: 'active' },
        { user_id: USER_ID, practice_code: 'guided_prayer', weekly_target: 2, timezone_name: 'America/Sao_Paulo', status: 'active' },
      ],
    });

    const { response, body } = await json(await GET());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.data.schema_version).toBe(1);
    expect(body.data.timezone_name).toBe('America/Sao_Paulo');
    expect(body.data.catalog).toHaveLength(4);
    expect(body.data.selected).toEqual([
      { code: 'guided_prayer', weekly_target: 2, status: 'active' },
      { code: 'scripture', weekly_target: 3, status: 'active' },
    ]);
    expect(JSON.stringify(body)).not.toContain(USER_ID);
    expect(JSON.stringify(body)).not.toContain(OTHER_USER_ID);
    expect(mocks.client.queries.user_practices[0]?.filters).toContainEqual(['eq', 'user_id', USER_ID]);
  });

  it.each([
    [
      'two',
      [
        { code: 'guided_prayer', weekly_target: 2 },
        { code: 'scripture', weekly_target: 3 },
      ],
    ],
    [
      'four',
      [
        { code: 'guided_prayer', weekly_target: 2 },
        { code: 'scripture', weekly_target: 3 },
        { code: 'gratitude', weekly_target: 2 },
        { code: 'silence', weekly_target: 1 },
      ],
    ],
  ])('atomically replaces %s valid selections', async (_label, practices) => {
    mocks.client = practiceClient({
      rpcData: practices.map((item) => ({
        practice_code: item.code,
        weekly_target: item.weekly_target,
        timezone_name: 'America/Sao_Paulo',
        status: 'active',
      })),
    });

    const { response, body } = await json(await PUT(request({
      timezone_name: 'America/Sao_Paulo',
      practices,
    })));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.data.selected).toHaveLength(practices.length);
    expect(mocks.client.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.client.rpc).toHaveBeenCalledWith('replace_user_practices', {
      p_owner_user_id: USER_ID,
      p_timezone_name: 'America/Sao_Paulo',
      p_practices: practices,
    });
  });

  it.each([
    [[{ code: 'scripture', weekly_target: 3 }], 'one selection'],
    [[
      { code: 'guided_prayer', weekly_target: 2 },
      { code: 'scripture', weekly_target: 3 },
      { code: 'gratitude', weekly_target: 2 },
      { code: 'silence', weekly_target: 1 },
      { code: 'daily_reflection', weekly_target: 2 },
    ], 'five selections'],
    [[
      { code: 'scripture', weekly_target: 3 },
      { code: 'scripture', weekly_target: 2 },
    ], 'duplicate code'],
    [[
      { code: 'scripture', weekly_target: 0 },
      { code: 'guided_prayer', weekly_target: 2 },
    ], 'target below range'],
    [[
      { code: 'scripture', weekly_target: 8 },
      { code: 'guided_prayer', weekly_target: 2 },
    ], 'target above range'],
  ])('rejects %s before touching the database', async (practices) => {
    const { response, body } = await json(await PUT(request({ timezone_name: 'UTC', practices })));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.error.details.code).toBe('invalid_practice_configuration');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('accepts and canonicalizes a real IANA timezone', async () => {
    mocks.client = practiceClient({
      rpcData: [
        { practice_code: 'guided_prayer', weekly_target: 2, timezone_name: 'America/Sao_Paulo', status: 'active' },
        { practice_code: 'scripture', weekly_target: 3, timezone_name: 'America/Sao_Paulo', status: 'active' },
      ],
    });

    const response = await PUT(request({
      timezone_name: 'America/Sao_Paulo',
      practices: [
        { code: 'guided_prayer', weekly_target: 2 },
        { code: 'scripture', weekly_target: 3 },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.client.rpc).toHaveBeenCalledWith('replace_user_practices', expect.objectContaining({
      p_timezone_name: 'America/Sao_Paulo',
    }));
  });

  it.each(['Mars/Olympus', '+03:00', ' UTC ', '', 42])('rejects invalid or non-canonical timezone %j', async (timezone_name) => {
    const response = await PUT(request({
      timezone_name,
      practices: [
        { code: 'guided_prayer', weekly_target: 2 },
        { code: 'scripture', weekly_target: 3 },
      ],
    }));

    expect(response.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('rejects an inactive catalog code without invoking the replace transaction', async () => {
    mocks.client = practiceClient({
      catalog: [CATALOG[0], { ...CATALOG[1], is_active: false }],
    });

    const { response, body } = await json(await PUT(request({
      timezone_name: 'UTC',
      practices: [
        { code: 'guided_prayer', weekly_target: 2 },
        { code: 'scripture', weekly_target: 3 },
      ],
    })));

    expect(response.status).toBe(400);
    expect(body.error.details.code).toBe('inactive_practice');
    expect(mocks.client.rpc).not.toHaveBeenCalled();
  });

  it('returns the access gate unchanged and never queries practice data', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Subscription required' } }), { status: 402 }),
    });

    const response = await GET();

    expect(response.status).toBe(402);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

describe('replace_user_practices migration contract', () => {
  it('is additive, transactional, service-role-only, and validates ownership and catalog input', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const names = fs.readdirSync(migrationsPath)
      .filter((name) => name.endsWith('_replace_user_practices.sql'));
    expect(names).toHaveLength(1);
    const sql = names.length === 1 ? fs.readFileSync(path.join(migrationsPath, names[0]!), 'utf8') : '';

    expect(sql).toMatch(/create or replace function faith_harbor\.replace_user_practices/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/jsonb_array_length\(p_practices\) not between 2 and 4/i);
    expect(sql).toMatch(/pg_catalog\.pg_timezone_names/i);
    expect(sql).toMatch(/faith_harbor\.practice_definitions/i);
    expect(sql).toMatch(/is_active = true/i);
    expect(sql).toMatch(/delete from faith_harbor\.user_practices[\s\S]*user_id = p_owner_user_id/i);
    expect(sql).toMatch(/insert into faith_harbor\.user_practices/i);
    expect(sql).toMatch(/on conflict \(user_id, practice_code\) do update/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.replace_user_practices[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.replace_user_practices[\s\S]*to service_role/i);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+(table|schema)/i);
  });
});
