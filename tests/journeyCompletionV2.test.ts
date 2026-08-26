import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const JOURNEY_ID = '22222222-2222-4222-8222-222222222222';
const IDEMPOTENCY_KEY = '33333333-3333-4333-8333-333333333333';

const rpcProjection = {
  outcome: 'completed',
  completed: true,
  already_completed: false,
  journey: {
    id: JOURNEY_ID,
    status: 'active',
    current_day: 2,
    streak_count: 1,
    best_streak: 1,
    total_completed_days: 1,
    consistency_score: 50,
    last_completed_on: '2026-08-26',
  },
  milestones: [{ milestone_code: 'streak_3', earned_at: '2026-08-26T12:00:00.000Z' }],
  practice_credits: ['guided_prayer'],
  newly_earned_milestones: ['streak_3'],
  local_day: '2026-08-26',
} as const;

function completedLegacyJourney() {
  const query: Record<string, unknown> = {};
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.limit = vi.fn(() => query);
  query.order = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => ({
    data: {
      id: JOURNEY_ID,
      user_id: USER_ID,
      anonymous_profile_id: null,
      template_id: '44444444-4444-4444-8444-444444444444',
      status: 'completed',
      current_day: 7,
      streak_count: 7,
      best_streak: 7,
      total_completed_days: 7,
      consistency_score: 100,
      last_completed_on: '2026-08-26',
      theme_preference: null,
      journey_templates: { duration_days: 7, language_code: 'en' },
    },
    error: null,
  }));
  return query;
}

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from '../app/api/v1/journeys/complete/route';

type CompletionModule = {
  completeJourneySession?: (
    client: { rpc: (name: string, params: Record<string, unknown>) => Promise<unknown> },
    input: Record<string, unknown>,
  ) => Promise<unknown>;
};

const completionModulePath = '../lib/rhythms/journeyCompletion';

async function loadCompletionModule(): Promise<CompletionModule> {
  return import(completionModulePath).catch(() => ({}));
}

function completionMigration() {
  const directory = path.resolve(process.cwd(), '../supabase/migrations');
  const matches = fs.readdirSync(directory)
    .filter((name) => name.endsWith('_journey_completion_v2.sql'));
  expect(matches).toHaveLength(1);
  if (matches.length !== 1) return '';
  return fs.readFileSync(path.join(directory, matches[0]!), 'utf8');
}

function clientWithRpc(result: unknown = { data: rpcProjection, error: null }) {
  return {
    rpc: vi.fn(async () => result),
    from: vi.fn(() => completedLegacyJourney()),
  };
}

async function post(body: Record<string, unknown>) {
  const response = await POST(new Request('https://vella.one/api/v1/journeys/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  return { response, json: await response.json() };
}

describe('journey completion typed RPC boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.createServiceClient.mockReturnValue(clientWithRpc());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('makes exactly one RPC call with the finite server-owned completion projection', async () => {
    const module = await loadCompletionModule();
    expect(typeof module.completeJourneySession).toBe('function');
    const rpc = vi.fn(async () => ({ data: rpcProjection, error: null }));

    const result = await module.completeJourneySession!({ rpc }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      reflectionNote: 'private reflection',
      gratitudeNote: 'private gratitude',
      timezoneName: 'America/Sao_Paulo',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      idempotencyKey: IDEMPOTENCY_KEY,
      completedAt: '2026-08-26T12:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('complete_journey_session_v2', {
      p_owner_user_id: USER_ID,
      p_journey_id: JOURNEY_ID,
      p_reflection_note: 'private reflection',
      p_gratitude_note: 'private gratitude',
      p_timezone_name: 'America/Sao_Paulo',
      p_local_day: '2026-08-26',
      p_local_week_start: '2026-08-24',
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_completed_at: '2026-08-26T12:00:00.000Z',
    });
    expect(result).toEqual({ ok: true, value: rpcProjection });
  });

  it('maps raw database failures to a finite error without leaking details', async () => {
    const module = await loadCompletionModule();
    expect(typeof module.completeJourneySession).toBe('function');
    const privateError = `owner ${USER_ID} note private reflection violated raw SQL`;

    const result = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({ data: null, error: { code: 'XX000', message: privateError } })),
    }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      completedAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, code: 'database_unavailable' });
    expect(JSON.stringify(result)).not.toContain(privateError);
    expect(JSON.stringify(result)).not.toContain(USER_ID);
  });

  it.each([
    {
      name: 'a non-leap February 29 local day',
      data: { ...rpcProjection, local_day: '2026-02-29' },
    },
    {
      name: 'an impossible journey last-completed day',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, last_completed_on: '2026-04-31' },
      },
    },
    {
      name: 'a null consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: null },
      },
    },
    {
      name: 'a numeric-string consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: '50' },
      },
    },
    {
      name: 'a NaN consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: Number.NaN },
      },
    },
    {
      name: 'an infinite consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: Number.POSITIVE_INFINITY },
      },
    },
    {
      name: 'a negative consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: -1 },
      },
    },
    {
      name: 'an above-range consistency score',
      data: {
        ...rpcProjection,
        journey: { ...rpcProjection.journey, consistency_score: 101 },
      },
    },
  ])('rejects $name in the RPC projection', async ({ data }) => {
    const module = await loadCompletionModule();
    const result = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({ data, error: null })),
    }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      completedAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, code: 'invalid_response' });
  });

  it.each([0, 100])('accepts consistency boundary %s with a real leap day', async (consistencyScore) => {
    const module = await loadCompletionModule();
    const result = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({
        data: {
          ...rpcProjection,
          local_day: '2028-02-29',
          journey: {
            ...rpcProjection.journey,
            consistency_score: consistencyScore,
            last_completed_on: '2028-02-29',
          },
        },
        error: null,
      })),
    }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2028-02-29',
      localWeekStart: '2028-02-28',
      completedAt: '2028-02-29T12:00:00.000Z',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        local_day: '2028-02-29',
        journey: {
          consistency_score: consistencyScore,
          last_completed_on: '2028-02-29',
        },
      },
    });
  });

  it('accepts future stable milestone codes and strips additive RPC fields', async () => {
    const module = await loadCompletionModule();
    expect(typeof module.completeJourneySession).toBe('function');
    const futureProjection = {
      ...rpcProjection,
      future_rpc_field: { private: 'discard me' },
      journey: { ...rpcProjection.journey, future_journey_field: true },
      milestones: [{
        milestone_code: 'journey_rooted_21',
        earned_at: '2026-08-26T12:00:00.000Z',
        future_milestone_field: true,
      }],
      newly_earned_milestones: ['journey_rooted_21'],
    };

    const result = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({ data: futureProjection, error: null })),
    }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      completedAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        ...rpcProjection,
        journey: rpcProjection.journey,
        milestones: [{
          milestone_code: 'journey_rooted_21',
          earned_at: '2026-08-26T12:00:00.000Z',
        }],
        newly_earned_milestones: ['journey_rooted_21'],
      },
    });
  });

  it.each([
    'Journey_Rooted',
    'journey-rooted',
    'a'.repeat(65),
  ])('rejects malformed milestone code %s', async (milestoneCode) => {
    const module = await loadCompletionModule();
    const result = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({
        data: {
          ...rpcProjection,
          milestones: [{ milestone_code: milestoneCode, earned_at: '2026-08-26T12:00:00.000Z' }],
          newly_earned_milestones: [milestoneCode],
        },
        error: null,
      })),
    }, {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      completedAt: '2026-08-26T12:00:00.000Z',
    });

    expect(result).toEqual({ ok: false, code: 'invalid_response' });
  });

  it('rejects unbounded milestone arrays', async () => {
    const module = await loadCompletionModule();
    const milestone = { milestone_code: 'streak_3', earned_at: '2026-08-26T12:00:00.000Z' };
    const input = {
      userId: USER_ID,
      journeyId: JOURNEY_ID,
      timezoneName: 'UTC',
      localDay: '2026-08-26',
      localWeekStart: '2026-08-24',
      completedAt: '2026-08-26T12:00:00.000Z',
    };
    const oversizedHistory = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({
        data: { ...rpcProjection, milestones: Array.from({ length: 129 }, () => milestone) },
        error: null,
      })),
    }, input);
    const oversizedNew = await module.completeJourneySession!({
      rpc: vi.fn(async () => ({
        data: {
          ...rpcProjection,
          newly_earned_milestones: Array.from({ length: 33 }, () => 'streak_3'),
        },
        error: null,
      })),
    }, input);

    expect(oversizedHistory).toEqual({ ok: false, code: 'invalid_response' });
    expect(oversizedNew).toEqual({ ok: false, code: 'invalid_response' });
  });

  it('returns the exact previous-client success payload', async () => {
    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({
      data: {
        completed: true,
        journey: rpcProjection.journey,
        milestones: rpcProjection.milestones,
        practice_credits: rpcProjection.practice_credits,
        newly_earned_milestones: rpcProjection.newly_earned_milestones,
        local_day: rpcProjection.local_day,
      },
    });
  });

  it.each([
    {
      name: 'already-completed',
      projection: { ...rpcProjection, outcome: 'already_completed', completed: false, already_completed: true },
      expected: {
        alreadyCompleted: true,
        journey: rpcProjection.journey,
        milestones: rpcProjection.milestones,
        practice_credits: rpcProjection.practice_credits,
        newly_earned_milestones: rpcProjection.newly_earned_milestones,
        local_day: rpcProjection.local_day,
      },
    },
    {
      name: 'inactive',
      projection: {
        ...rpcProjection,
        outcome: 'inactive',
        completed: false,
        already_completed: false,
        journey: { ...rpcProjection.journey, status: 'paused' },
      },
      expected: {
        alreadyCompleted: false,
        journey: { ...rpcProjection.journey, status: 'paused' },
        milestones: rpcProjection.milestones,
        practice_credits: rpcProjection.practice_credits,
        newly_earned_milestones: rpcProjection.newly_earned_milestones,
        local_day: rpcProjection.local_day,
      },
    },
  ])('returns the exact previous-client $name payload', async ({ projection, expected }) => {
    mocks.createServiceClient.mockReturnValue(clientWithRpc({ data: projection, error: null }));

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ data: expected });
  });

  it('returns the exact not-found response', async () => {
    mocks.createServiceClient.mockReturnValue(clientWithRpc({ data: { outcome: 'not_found' }, error: null }));

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Journey not found' } });
  });

  it('returns the exact malformed-input response without creating a client', async () => {
    const { response, json } = await post({ journey_id: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({
      error: {
        message: 'Invalid request input',
        details: {
          formErrors: [],
          fieldErrors: { journey_id: ['Invalid uuid'] },
        },
      },
    });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('returns the access-gate rejection unchanged with no-store', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({
        error: { message: 'Subscription required' },
      }), { status: 402, headers: { 'content-type': 'application/json' } }),
    });

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(402);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Subscription required' } });
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('accepts optional timezone and idempotency fields and exposes additive completion facts', async () => {
    const { response, json } = await post({
      journey_id: JOURNEY_ID,
      timezone_name: 'America/Sao_Paulo',
      idempotency_key: IDEMPOTENCY_KEY,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toMatchObject({
      practice_credits: ['guided_prayer'],
      newly_earned_milestones: ['streak_3'],
      local_day: '2026-08-26',
    });
  });

  it.each([
    ['+01:00', '2026-01-04T23:30:00.000Z', '2026-01-04', '2025-12-29'],
    ['-12:00', '2026-01-05T00:30:00.000Z', '2026-01-05', '2026-01-05'],
  ])('sends fixed offset %s to the RPC as a UTC completion boundary', async (
    timezoneName,
    instant,
    expectedDay,
    expectedWeek,
  ) => {
    vi.setSystemTime(new Date(instant));
    const client = clientWithRpc();
    mocks.createServiceClient.mockReturnValue(client);

    const { response } = await post({
      journey_id: JOURNEY_ID,
      timezone_name: timezoneName,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(client.rpc).toHaveBeenCalledWith('complete_journey_session_v2', expect.objectContaining({
      p_timezone_name: 'UTC',
      p_local_day: expectedDay,
      p_local_week_start: expectedWeek,
    }));
  });

  it('keeps Etc/GMT+12 as a valid route timezone', async () => {
    vi.setSystemTime(new Date('2026-01-01T10:30:00.000Z'));
    const client = clientWithRpc();
    mocks.createServiceClient.mockReturnValue(client);

    const { response } = await post({
      journey_id: JOURNEY_ID,
      timezone_name: 'Etc/GMT+12',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(client.rpc).toHaveBeenCalledWith('complete_journey_session_v2', expect.objectContaining({
      p_timezone_name: 'Etc/GMT+12',
      p_local_day: '2025-12-31',
      p_local_week_start: '2025-12-29',
    }));
  });

  it('rejects a malformed idempotency key without invoking the database', async () => {
    const client = clientWithRpc();
    mocks.createServiceClient.mockReturnValue(client);

    const { response } = await post({ journey_id: JOURNEY_ID, idempotency_key: 'not-a-uuid' });

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('does not leak database errors, owners, or notes through response or logs', async () => {
    const privateError = `owner ${USER_ID} note private reflection raw SQL failure`;
    mocks.createServiceClient.mockReturnValue(clientWithRpc({
      data: null,
      error: { code: 'XX000', message: privateError },
    }));
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await post({
      journey_id: JOURNEY_ID,
      reflection_note: 'private reflection',
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not complete journey' } });
    const visible = JSON.stringify({ json, logs: errorLog.mock.calls });
    expect(visible).not.toContain(privateError);
    expect(visible).not.toContain(USER_ID);
    expect(visible).not.toContain('private reflection');
  });

  it.each(['rpc', 'create-client'])('contains thrown %s failures with the exact safe response', async (source) => {
    const privateError = `owner ${USER_ID} note private reflection raw SQL failure`;
    if (source === 'rpc') {
      mocks.createServiceClient.mockReturnValue({
        rpc: vi.fn(async () => { throw new Error(privateError); }),
        from: vi.fn(() => completedLegacyJourney()),
      });
    } else {
      mocks.createServiceClient.mockImplementation(() => { throw new Error(privateError); });
    }
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await post({
      journey_id: JOURNEY_ID,
      reflection_note: 'private reflection',
    });

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not complete journey' } });
    const visible = JSON.stringify({ json, logs: errorLog.mock.calls });
    expect(visible).not.toContain(privateError);
    expect(visible).not.toContain(USER_ID);
    expect(visible).not.toContain('private reflection');
  });

  it('maps an idempotency conflict to a finite 409 response', async () => {
    mocks.createServiceClient.mockReturnValue(clientWithRpc({
      data: { outcome: 'idempotency_conflict' },
      error: null,
    }));

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(409);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Completion request conflicts with an existing session' } });
  });
});

describe('journey completion v2 migration contract', () => {
  it('is additive and exposes only a service-role SECURITY INVOKER RPC', () => {
    const sql = completionMigration();

    expect(sql).toMatch(/create or replace function faith_harbor\.complete_journey_session_v2/i);
    expect(sql).toMatch(/security invoker/i);
    expect(sql).toMatch(/set search_path = ''/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.complete_journey_session_v2[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.complete_journey_session_v2[\s\S]*to service_role/i);
    expect(sql).not.toMatch(/security definer|drop\s+(?:table|column|schema)|truncate|rename\s+column/i);
  });

  it('keeps notes only in daily sessions and returns a finite projection', () => {
    const sql = completionMigration();
    const ledgerWrites = sql.match(/insert into faith_harbor\.practice_sessions[\s\S]*?;/gi) ?? [];

    expect(ledgerWrites).toHaveLength(1);
    expect(ledgerWrites[0]).not.toMatch(/reflection|gratitude|note|user_id.*jsonb/i);
    expect(sql).not.toMatch(/row_to_json|to_jsonb\([^)]*user_journeys|select\s+\*/i);
    expect(sql).not.toMatch(/raise exception[^;]*(?:user|note|sql)/i);
  });

  it('compares replay semantics and projects the latest completion into the declared timezone', () => {
    const sql = completionMigration();

    expect(sql).toMatch(/idempotency_conflict/i);
    expect(sql).toMatch(/reflection_note\s+is not distinct from\s+p_reflection_note/i);
    expect(sql).toMatch(/gratitude_note\s+is not distinct from\s+p_gratitude_note/i);
    expect(sql).toMatch(/order by\s+(?:session\.)?completed_at\s+desc[\s\S]*limit 1/i);
    expect(sql).toMatch(/at time zone\s+p_timezone_name/i);
  });
});
