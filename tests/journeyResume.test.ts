import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const JOURNEY_ID = '22222222-2222-4222-8222-222222222222';

const journey = {
  id: JOURNEY_ID,
  user_id: USER_ID,
  status: 'paused',
  current_day: 3,
  streak_count: 2,
  best_streak: 4,
  total_completed_days: 2,
  consistency_score: 66,
  last_completed_on: '2026-08-24',
  start_date: '2026-08-20',
  completed_at: null,
  timezone_name: 'America/Sao_Paulo',
  paused_at: '2026-08-25T12:00:00.000Z',
  last_resumed_at: null,
  source: 'onboarding',
  completion_version: 1,
};

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  requireActiveSubscription: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({ requireActiveSubscription: mocks.requireActiveSubscription }));

type ResumeModule = { POST?: (request: Request) => Promise<Response> };
const modulePath = '../app/api/v1/journeys/resume/route';

async function resumeModule(): Promise<ResumeModule> {
  return import(modulePath).catch(() => ({}));
}

function resumeClient(options: { existing?: Record<string, unknown> | null; updated?: Record<string, unknown> | null; updateError?: unknown } = {}) {
  const read: Record<string, unknown> = {};
  read.select = vi.fn(() => read);
  read.eq = vi.fn(() => read);
  read.maybeSingle = vi.fn(async () => ({
    data: Object.prototype.hasOwnProperty.call(options, 'existing') ? options.existing : journey,
    error: null,
  }));

  const write: Record<string, unknown> = {};
  write.update = vi.fn(() => write);
  write.eq = vi.fn(() => write);
  write.select = vi.fn(() => write);
  write.maybeSingle = vi.fn(async () => ({ data: options.updated ?? { ...journey, status: 'active', paused_at: null, last_resumed_at: '2026-08-26T12:00:00.000Z' }, error: options.updateError ?? null }));

  const from = vi.fn(() => {
    const calls = from.mock.calls.length;
    return calls === 1 ? read : write;
  });
  return { from, read, write };
}

function raceResumeClient(authoritative: Record<string, unknown> | null) {
  let reads = 0;
  const read = () => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.maybeSingle = vi.fn(async () => ({ data: ++reads === 1 ? journey : authoritative, error: null }));
    return query;
  };
  const write: Record<string, unknown> = {};
  write.update = vi.fn(() => write);
  write.eq = vi.fn(() => write);
  write.select = vi.fn(() => write);
  write.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  const from = vi.fn(() => from.mock.calls.length === 2 ? write : read());
  return { from, write };
}

async function post(body: unknown) {
  const module = await resumeModule();
  expect(typeof module.POST).toBe('function');
  const response = await module.POST!(new Request('https://vella.one/api/v1/journeys/resume', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
  return { response, json: await response.json() };
}

describe('journey resume route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T12:00:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.createServiceClient.mockReturnValue(resumeClient());
  });

  it('resumes only the owned paused journey while preserving progress and timezone metadata', async () => {
    const client = resumeClient();
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(client.read.eq).toHaveBeenCalledWith('id', JOURNEY_ID);
    expect(client.read.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(client.write.update).toHaveBeenCalledWith({ status: 'active', paused_at: null, last_resumed_at: '2026-08-26T12:00:00.000Z' });
    expect(client.write.eq).toHaveBeenCalledWith('status', 'paused');
    expect(json.data.journey).toMatchObject({
      id: JOURNEY_ID, status: 'active', current_day: 3, total_completed_days: 2,
      timezone_name: 'America/Sao_Paulo', source: 'onboarding', completion_version: 1,
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('returns the existing authoritative state without mutation for an already active owned journey', async () => {
    const client = resumeClient({ existing: { ...journey, status: 'active', paused_at: null } });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(200);
    expect(json.data.journey.status).toBe('active');
    expect(client.write.update).not.toHaveBeenCalled();
  });

  it('returns the stable completed conflict without mutating an owned completed journey', async () => {
    const client = resumeClient({ existing: { ...journey, status: 'completed', completed_at: '2026-08-25T12:00:00.000Z' } });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(409);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Journey is already completed', details: { code: 'journey_already_completed' } } });
    expect(client.write.update).not.toHaveBeenCalled();
  });

  it.each([null, { ...journey, id: '33333333-3333-4333-8333-333333333333', user_id: 'foreign-owner' }])('returns the same finite not-found response for missing and foreign journeys', async (existing) => {
    const client = resumeClient({ existing });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: { message: 'Journey not found', details: { code: 'journey_not_found' } } });
    expect(client.write.update).not.toHaveBeenCalled();
  });

  it('maps a one-active-journey uniqueness race to a finite conflict without retrying mutation', async () => {
    const client = resumeClient({ updateError: { code: '23505', message: 'private unique constraint detail' } });
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(409);
    expect(json).toEqual({ error: { message: 'This journey is already active', details: { code: 'journey_template_active' } } });
    expect(client.write.update).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ...journey, status: 'active', paused_at: null, last_resumed_at: '2026-08-26T12:00:00.000Z' }, 200, undefined],
    [{ ...journey, status: 'completed', completed_at: '2026-08-26T12:00:00.000Z' }, 409, 'journey_already_completed'],
    [null, 404, 'journey_not_found'],
    [{ ...journey, status: 'paused' }, 409, 'journey_resume_conflict'],
  ] as const)('re-reads the authoritative journey after a conditional no-row race', async (authoritative, status, code) => {
    const client = raceResumeClient(authoritative);
    mocks.createServiceClient.mockReturnValue(client);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(status);
    expect(client.write.update).toHaveBeenCalledTimes(1);
    if (status === 200) expect(json.data.journey).toMatchObject({ status: 'active', current_day: 3, total_completed_days: 2 });
    else expect(json.error.details.code).toBe(code);
  });

  it('fails closed when an owned journey projection contains an invalid source instead of echoing it', async () => {
    const privateSource = 'internal';
    const client = resumeClient({ existing: { ...journey, source: privateSource } });
    mocks.createServiceClient.mockReturnValue(client);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { response, json } = await post({ journey_id: JOURNEY_ID });

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not resume journey', details: { code: 'journey_resume_unavailable' } } });
    expect(JSON.stringify(json)).not.toContain(privateSource);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateSource);
  });

  it('rejects extra and malformed client-writable fields without querying', async () => {
    const { response, json } = await post({ journey_id: JOURNEY_ID, status: 'active', user_id: USER_ID });

    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json.error.message).toBe('Invalid request input');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
