import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: { rpc: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

import { POST as startSession } from '../app/api/v1/rhythms/sessions/start/route';
import { POST as completeSession } from '../app/api/v1/rhythms/sessions/complete/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const SESSION_ID = '22222222-2222-4222-8222-222222222222';
const START_KEY = '33333333-3333-4333-8333-333333333333';
const COMPLETE_KEY = '44444444-4444-4444-8444-444444444444';
const PRIVATE_ID = '55555555-5555-4555-8555-555555555555';

const STARTED_SESSION = {
  id: SESSION_ID,
  practice_code: 'guided_prayer',
  status: 'started',
  local_day: '2026-01-02',
  local_week_start: '2025-12-29',
  started_at: '2026-01-01T10:30:00.000Z',
  completed_at: null,
};

const COMPLETED_SESSION = {
  ...STARTED_SESSION,
  status: 'completed',
  completed_at: '2026-01-05T00:30:00.000Z',
  local_day: '2026-01-05',
  local_week_start: '2026-01-05',
};

const WEEKLY_SUMMARY = {
  schema_version: 1,
  week_start: '2026-01-05',
  timezone_name: 'Pacific/Kiritimati',
  configured: true,
  practices: [
    { code: 'guided_prayer', weekly_target: 2, completed_sessions: 1, target_met: false },
    { code: 'scripture', weekly_target: 1, completed_sessions: 0, target_met: false },
  ],
  rhythm_met: false,
};

function request(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function body(response: Response) {
  return { response, json: await response.json() };
}

describe('direct practice session routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T10:30:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.client = { rpc: vi.fn() };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts an owned configured practice with server-derived local calendar keys', async () => {
    mocks.client.rpc.mockResolvedValue({
      data: { outcome: 'started', session: STARTED_SESSION },
      error: null,
    });

    const { response, json } = await body(await startSession(request(
      'https://vella.one/api/v1/rhythms/sessions/start',
      { practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'Pacific/Kiritimati' },
    )));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toEqual({ outcome: 'started', session: STARTED_SESSION });
    expect(mocks.client.rpc).toHaveBeenCalledWith('start_direct_practice_session', {
      p_owner_user_id: USER_ID,
      p_practice_code: 'guided_prayer',
      p_idempotency_key: START_KEY,
      p_timezone_name: 'Pacific/Kiritimati',
      p_local_day: '2026-01-02',
      p_local_week_start: '2025-12-29',
      p_started_at: '2026-01-01T10:30:00.000Z',
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('returns the same authoritative session for a safe start retry', async () => {
    mocks.client.rpc.mockResolvedValue({
      data: { outcome: 'already_started', session: STARTED_SESSION },
      error: null,
    });

    const { response, json } = await body(await startSession(request(
      'https://vella.one/api/v1/rhythms/sessions/start',
      { practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'Pacific/Kiritimati' },
    )));

    expect(response.status).toBe(200);
    expect(json.data.outcome).toBe('already_started');
    expect(json.data.session.id).toBe(SESSION_ID);
  });

  it.each([
    ['practice_unavailable', 409, 'practice_unavailable'],
    ['idempotency_conflict', 409, 'session_completion_conflict'],
    ['invalid_request', 400, 'invalid_session_request'],
  ])('maps finite start outcome %s without leaking database details', async (outcome, status, code) => {
    mocks.client.rpc.mockResolvedValue({ data: { outcome }, error: null });

    const { response, json } = await body(await startSession(request(
      'https://vella.one/api/v1/rhythms/sessions/start',
      { practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'Pacific/Kiritimati' },
    )));

    expect(response.status).toBe(status);
    expect(json.error.details.code).toBe(code);
  });

  it.each(['completed', 'already_completed'] as const)(
    'returns authoritative completion facts for %s, including a safe replay',
    async (outcome) => {
      mocks.client.rpc.mockResolvedValue({
        data: {
          outcome,
          session: COMPLETED_SESSION,
          weekly_summary: WEEKLY_SUMMARY,
          newly_earned_milestones: ['rhythm_first_week', 'rhythm_balanced'],
        },
        error: null,
      });
      vi.setSystemTime(new Date('2026-01-05T00:30:00.000Z'));

      const { response, json } = await body(await completeSession(request(
        'https://vella.one/api/v1/rhythms/sessions/complete',
        { session_id: SESSION_ID, idempotency_key: COMPLETE_KEY },
      )));

      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(json.data.outcome).toBe(outcome);
      expect(json.data.weekly_summary).toEqual(WEEKLY_SUMMARY);
      expect(json.data.newly_earned_milestones).toEqual(['rhythm_first_week', 'rhythm_balanced']);
      expect(mocks.client.rpc).toHaveBeenCalledWith('complete_direct_practice_session', {
        p_owner_user_id: USER_ID,
        p_session_id: SESSION_ID,
        p_idempotency_key: COMPLETE_KEY,
        p_completed_at: '2026-01-05T00:30:00.000Z',
      });
      expect(JSON.stringify(json)).not.toContain(USER_ID);
    },
  );

  it.each([
    ['not_found', 404, 'session_not_found'],
    ['cancelled', 409, 'session_cancelled'],
    ['idempotency_conflict', 409, 'session_completion_conflict'],
    ['invalid_request', 400, 'invalid_session_request'],
  ])('maps finite completion outcome %s', async (outcome, status, code) => {
    mocks.client.rpc.mockResolvedValue({ data: { outcome }, error: null });

    const { response, json } = await body(await completeSession(request(
      'https://vella.one/api/v1/rhythms/sessions/complete',
      { session_id: SESSION_ID, idempotency_key: COMPLETE_KEY },
    )));

    expect(response.status).toBe(status);
    expect(json.error.details.code).toBe(code);
  });

  it.each([
    [{ practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'UTC', prayer_text: 'private' }],
    [{ practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'UTC', reflection: 'private' }],
    [{ practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'UTC', gratitude_note: 'private' }],
    [{ practice_code: 'guided_prayer', idempotency_key: 'not-a-uuid', timezone_name: 'UTC' }],
    [{ practice_code: 'future_practice', idempotency_key: START_KEY, timezone_name: 'UTC' }],
    [{ practice_code: 'guided_prayer', idempotency_key: START_KEY, timezone_name: 'Mars/Olympus' }],
  ])('rejects invalid or devotional start payload before service access', async (payload) => {
    const serialized = JSON.stringify(payload);
    const { response, json } = await body(await startSession(request(
      'https://vella.one/api/v1/rhythms/sessions/start', payload,
    )));

    expect(response.status).toBe(400);
    expect(json.error.details.code).toBe('invalid_session_request');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(JSON.stringify(json)).not.toContain(serialized);
  });

  it.each([
    [{ session_id: SESSION_ID, idempotency_key: COMPLETE_KEY, prayer_text: 'private' }],
    [{ session_id: SESSION_ID, idempotency_key: COMPLETE_KEY, reflection: 'private' }],
    [{ session_id: PRIVATE_ID, idempotency_key: 'not-a-uuid' }],
  ])('rejects invalid or devotional completion payload before service access', async (payload) => {
    const response = await completeSession(request(
      'https://vella.one/api/v1/rhythms/sessions/complete', payload,
    ));

    expect(response.status).toBe(400);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });

  it('contains an RPC failure in a privacy-safe no-store response and log', async () => {
    const privateError = `database detail ${USER_ID} ${PRIVATE_ID}`;
    mocks.client.rpc.mockResolvedValue({ data: null, error: { message: privateError } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await body(await completeSession(request(
      'https://vella.one/api/v1/rhythms/sessions/complete',
      { session_id: SESSION_ID, idempotency_key: COMPLETE_KEY },
    )));

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.error.details.code).toBe('practice_session_unavailable');
    expect(JSON.stringify(json)).not.toContain(privateError);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateError);
    expect(log).toHaveBeenCalledWith('[practice-sessions]', {
      route: 'practice_session_complete', stage: 'rpc', code: 'database_unavailable',
    });
  });

  it('returns the subscription gate unchanged without touching session storage', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Subscription required' } }), { status: 402 }),
    });

    const response = await completeSession(request(
      'https://vella.one/api/v1/rhythms/sessions/complete',
      { session_id: SESSION_ID, idempotency_key: COMPLETE_KEY },
    ));

    expect(response.status).toBe(402);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

describe('practice session completion migration contract', () => {
  it('uses owner-bound service-role-only RPCs and stores no devotional content', () => {
    const migrationsPath = path.resolve(process.cwd(), '../supabase/migrations');
    const names = fs.readdirSync(migrationsPath)
      .filter((name) => name.endsWith('_practice_session_completion.sql'));
    expect(names).toHaveLength(1);
    const sql = names.length === 1 ? fs.readFileSync(path.join(migrationsPath, names[0]!), 'utf8') : '';

    expect(sql).toMatch(/create or replace function faith_harbor\.start_direct_practice_session/i);
    expect(sql).toMatch(/create or replace function faith_harbor\.complete_direct_practice_session/i);
    expect(sql.match(/security invoker/gi)).toHaveLength(2);
    expect(sql.match(/set search_path = ''/gi)).toHaveLength(2);
    expect(sql).toMatch(/where session\.user_id = p_owner_user_id[\s\S]*for update/i);
    expect(sql).toMatch(/completion_idempotency_key/i);
    expect(sql).toMatch(/unique[\s\S]*completion_idempotency_key/i);
    expect(sql).toMatch(/source_type[\s\S]*'direct'/i);
    expect(sql).toMatch(/source_key[\s\S]*direct:/i);
    expect(sql).toMatch(/local_week_start/i);
    expect(sql).toMatch(/newly_earned_milestones/i);
    expect(sql).toContain("'rhythm_first_week'");
    expect(sql).toContain("'rhythm_four_weeks'");
    expect(sql).toContain("'rhythm_balanced'");
    expect(sql).toContain("'rhythm_return'");
    expect(sql).toMatch(/revoke execute on function faith_harbor\.start_direct_practice_session[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/revoke execute on function faith_harbor\.complete_direct_practice_session[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.start_direct_practice_session[\s\S]*to service_role/i);
    expect(sql).toMatch(/grant execute on function faith_harbor\.complete_direct_practice_session[\s\S]*to service_role/i);
    expect(sql).not.toMatch(/(?:prayer|reflection|gratitude|journal|devotional)_(?:text|body|content|note)/i);
    expect(sql).not.toMatch(/\b(drop|truncate)\s+(table|schema)/i);
  });
});
