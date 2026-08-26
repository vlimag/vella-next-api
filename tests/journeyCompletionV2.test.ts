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

  it('keeps the previous-client payload valid and returns all established fields', async () => {
    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toMatchObject({
      completed: true,
      journey: rpcProjection.journey,
      milestones: rpcProjection.milestones,
    });
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
    const visible = JSON.stringify({ json, logs: errorLog.mock.calls });
    expect(visible).not.toContain(privateError);
    expect(visible).not.toContain(USER_ID);
    expect(visible).not.toContain('private reflection');
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
});
