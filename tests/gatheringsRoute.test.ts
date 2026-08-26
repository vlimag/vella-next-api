import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: { rpc: vi.fn() },
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

import { GET as getCurrentGathering } from '../app/api/v1/rhythms/gatherings/current/route';
import { PUT as saveGatheringProgress } from '../app/api/v1/rhythms/gatherings/[templateId]/progress/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const VERSE_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';
const SECTIONS = [
  'arrival', 'opening_prayer', 'scripture', 'reflection',
  'silence', 'private_prayer', 'action', 'closing',
] as const;
const STEPS = SECTIONS.map((section, index) => ({
  id: `${index + 1}0000000-0000-4000-8000-000000000000`,
  step_order: index + 1,
  section_type: section,
  content_key: `weekly-rest:v1:pt:${section.replace('_', '-')}`,
  body: section === 'scripture' ? 'Approved public Scripture text' : `Reviewed ${section} copy`,
  duration_seconds: [75, 75, 120, 210, 180, 120, 60, 60][index]!,
  is_required: section !== 'private_prayer',
  scripture: section === 'scripture' ? {
    verse_id: VERSE_ID,
    reference: 'Matthew 11:28 · WEBP',
    version_code: 'WEBP',
    language_code: 'en',
    is_locale_fallback: true,
  } : null,
}));

const CURRENT = {
  schema_version: 1,
  template: {
    id: TEMPLATE_ID,
    slug: 'weekly-rest',
    version: 1,
    locale: 'pt',
    title: 'Descanso para a semana',
    summary: 'Um encontro guiado para chegar, escutar e seguir com paz.',
    theme_key: 'weekly_rest',
    estimated_duration_seconds: 900,
    access_tier: 'premium',
    editorial_revision: 'editorial.1',
    steps: STEPS,
  },
  progress: {
    current_step: 3,
    status: 'in_progress',
    started_at: '2026-08-26T10:00:00.000Z',
    completed_at: null,
    last_seen_at: '2026-08-26T10:04:00.000Z',
  },
};

const COMPLETED = {
  outcome: 'completed',
  progress: {
    current_step: 8,
    status: 'completed',
    started_at: '2026-08-26T10:00:00.000Z',
    completed_at: '2026-08-26T10:15:00.000Z',
    last_seen_at: '2026-08-26T10:15:00.000Z',
  },
  practice_credit: 'guided_prayer',
  telemetry_events: [
    {
      event_name: 'gathering_completed',
      properties: {
        catalog_code: 'weekly-rest',
        completion_reason: 'completed',
        elapsed_bucket: '15m_plus',
      },
    },
    {
      event_name: 'practice_session_completed',
      properties: {
        catalog_code: 'guided_prayer',
        session_kind: 'guided_prayer',
        completion_reason: 'target_reached',
        elapsed_bucket: '15m_plus',
      },
    },
  ],
};

function putRequest(body: unknown) {
  return new Request(`https://vella.one/api/v1/rhythms/gatherings/${TEMPLATE_ID}/progress`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Gathering routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T10:15:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.client = { rpc: vi.fn() };
  });

  it('loads the current locale-aware immutable Gathering and checkpoint', async () => {
    mocks.client.rpc.mockResolvedValue({ data: CURRENT, error: null });

    const response = await getCurrentGathering(
      new Request('https://vella.one/api/v1/rhythms/gatherings/current?locale=pt-BR'),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toEqual(CURRENT);
    expect(mocks.client.rpc).toHaveBeenCalledWith('get_current_gathering_v1', {
      p_owner_user_id: USER_ID,
      p_locale: 'pt',
      p_now: '2026-08-26T10:15:00.000Z',
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('falls back to English for an unsupported locale without widening the catalog', async () => {
    mocks.client.rpc.mockResolvedValue({ data: { ...CURRENT, template: { ...CURRENT.template, locale: 'en' } }, error: null });
    const response = await getCurrentGathering(
      new Request('https://vella.one/api/v1/rhythms/gatherings/current?locale=ja'),
    );
    expect(response.status).toBe(200);
    expect(mocks.client.rpc).toHaveBeenCalledWith('get_current_gathering_v1', expect.objectContaining({
      p_locale: 'en',
    }));
  });

  it('completes through the owner-bound RPC with server-derived time keys', async () => {
    mocks.client.rpc.mockResolvedValue({ data: COMPLETED, error: null });

    const response = await saveGatheringProgress(
      putRequest({
        current_step: 8,
        completed: true,
        idempotency_key: IDEMPOTENCY_KEY,
        timezone_name: 'Pacific/Kiritimati',
      }),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toEqual(COMPLETED);
    expect(mocks.client.rpc).toHaveBeenCalledWith('save_gathering_progress_v1', {
      p_owner_user_id: USER_ID,
      p_template_id: TEMPLATE_ID,
      p_current_step: 8,
      p_complete: true,
      p_idempotency_key: IDEMPOTENCY_KEY,
      p_timezone_name: 'Pacific/Kiritimati',
      p_local_day: '2026-08-27',
      p_local_week_start: '2026-08-24',
      p_occurred_at: '2026-08-26T10:15:00.000Z',
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('returns an idempotent completed replay without duplicate client facts', async () => {
    mocks.client.rpc.mockResolvedValue({
      data: {
        ...COMPLETED,
        outcome: 'already_completed',
        telemetry_events: [{
          event_name: 'gathering_completed',
          properties: {
            catalog_code: 'weekly-rest',
            completion_reason: 'idempotent_replay',
            elapsed_bucket: '15m_plus',
          },
        }],
      },
      error: null,
    });

    const response = await saveGatheringProgress(
      putRequest({
        current_step: 8,
        completed: true,
        idempotency_key: IDEMPOTENCY_KEY,
        timezone_name: 'UTC',
      }),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data.outcome).toBe('already_completed');
    expect(json.data.telemetry_events).toHaveLength(1);
  });

  it.each([
    { current_step: 6, completed: false, timezone_name: 'UTC', private_prayer: 'never store me' },
    { current_step: 6, completed: false, timezone_name: 'UTC', answer: 'never store me' },
    { current_step: 6, completed: false, timezone_name: 'UTC', reflection: 'never store me' },
    { current_step: 33, completed: false, timezone_name: 'UTC' },
    { current_step: 8, completed: true, timezone_name: 'UTC' },
    { current_step: 4, completed: false, timezone_name: 'Mars/Olympus' },
  ])('rejects private or invalid progress payload before database access', async (payload) => {
    const response = await saveGatheringProgress(
      putRequest(payload),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error.details.code).toBe('invalid_gathering_progress');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
    expect(JSON.stringify(json)).not.toContain('never store me');
  });

  it.each([
    ['not_found', 404, 'gathering_not_found'],
    ['idempotency_conflict', 409, 'gathering_completion_conflict'],
    ['invalid_request', 400, 'invalid_gathering_progress'],
  ])('maps finite progress outcome %s', async (outcome, status, code) => {
    mocks.client.rpc.mockResolvedValue({ data: { outcome }, error: null });
    const response = await saveGatheringProgress(
      putRequest({ current_step: 3, completed: false, timezone_name: 'UTC' }),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(status);
    expect(json.error.details.code).toBe(code);
  });

  it('contains database errors in privacy-safe responses and logs', async () => {
    const privateDetail = `database ${USER_ID}`;
    mocks.client.rpc.mockResolvedValue({ data: null, error: { message: privateDetail } });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getCurrentGathering(
      new Request('https://vella.one/api/v1/rhythms/gatherings/current?locale=en'),
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error.details.code).toBe('gathering_unavailable');
    expect(JSON.stringify(json)).not.toContain(privateDetail);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateDetail);
  });
});
