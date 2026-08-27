import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ANONYMOUS_ID = '22222222-2222-4222-8222-222222222222';
const TEMPLATE_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '55555555-5555-4555-8555-555555555555';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => mocks.client),
  requireActiveSubscription: vi.fn(),
  client: { rpc: vi.fn() },
  recordGatheringOperationalEvent: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));
vi.mock('@/lib/rhythms/gatheringOperationalTelemetry', () => ({
  recordGatheringOperationalEvent: mocks.recordGatheringOperationalEvent,
}));

import { GET } from '@/app/api/v2/rhythms/gatherings/catalog/route';
import { PUT } from '@/app/api/v2/rhythms/gatherings/[templateId]/progress/route';

const CATALOG = {
  schema_version: 2,
  timezone_name: 'UTC',
  generated_at: '2026-08-27T00:00:00.000Z',
  featured: [{
    release_id: '33333333-3333-4333-8333-333333333333',
    template_id: TEMPLATE_ID,
    catalog_code: 'g-2026w35-mon',
    slot_type: 'monday',
    source_kind: 'generated',
    locale: 'en',
    title: 'A quiet beginning',
    summary: 'A reviewed Gathering.',
    theme_key: 'weekly_rest',
    estimated_duration_seconds: 900,
    available_from: '2026-08-24T00:00:00.000Z',
  }],
  history: [],
  next_release: { slot_type: 'thursday', available_at: '2026-08-27T00:00:00.000Z' },
  fallback_used: false,
};

function putRequest(body: unknown) {
  return new Request(`https://vella.one/api/v2/rhythms/gatherings/${TEMPLATE_ID}/progress`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Gathering v2 routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
    mocks.client.rpc.mockReset();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID, isAnonymous: false });
  });

  it('returns entitled anonymous catalog content without account progress', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({ userId: ANONYMOUS_ID, isAnonymous: true });
    mocks.client.rpc.mockResolvedValue({ data: CATALOG, error: null });

    const response = await GET(new Request(
      'https://vella.one/api/v2/rhythms/gatherings/catalog?locale=en&timezone=UTC',
    ));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(json.data).toEqual(CATALOG);
    expect(mocks.client.rpc).toHaveBeenCalledWith('get_gathering_catalog_v2', expect.objectContaining({
      p_owner_user_id: ANONYMOUS_ID,
    }));
    expect(JSON.stringify(json)).not.toContain(ANONYMOUS_ID);
    expect(mocks.recordGatheringOperationalEvent).toHaveBeenCalledWith(
      'api_catalog_succeeded',
      expect.objectContaining({ route: 'catalog_v2', outcome: 'success', schema_version: 2 }),
    );
  });

  it('maps the server-authoritative anonymous account outcome to finite 401', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({ userId: ANONYMOUS_ID, isAnonymous: true });
    mocks.client.rpc.mockResolvedValue({
      data: { outcome: 'account_required', new_milestone_codes: [] },
      error: null,
    });

    const response = await PUT(
      putRequest({ current_step: 1, state: 'in_progress', timezone_name: 'UTC' }),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error.details).toEqual({ code: 'account_required' });
    expect(JSON.stringify(json)).not.toContain(ANONYMOUS_ID);
    expect(mocks.client.rpc).toHaveBeenCalledWith('save_gathering_progress_v2', expect.objectContaining({
      p_owner_user_id: ANONYMOUS_ID,
    }));
    expect(mocks.recordGatheringOperationalEvent).toHaveBeenCalledWith(
      'api_progress_failed',
      expect.objectContaining({
        route: 'progress_v2', outcome: 'client_error', error_code: 'account_required', schema_version: 2,
      }),
    );
  });

  it('saves permanent-account progress through the RPC and strips database errors', async () => {
    const privateDetail = `database ${USER_ID}`;
    mocks.client.rpc.mockResolvedValue({ data: null, error: { message: privateDetail } });

    const response = await PUT(
      putRequest({
        current_step: 8,
        state: 'completed',
        idempotency_key: IDEMPOTENCY_KEY,
        timezone_name: 'UTC',
      }),
      { params: Promise.resolve({ templateId: TEMPLATE_ID }) },
    );
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(json.error.details).toEqual({ code: 'gathering_unavailable' });
    expect(JSON.stringify(json)).not.toContain(privateDetail);
    expect(mocks.recordGatheringOperationalEvent).toHaveBeenCalledWith(
      'api_progress_failed',
      expect.objectContaining({
        route: 'progress_v2', outcome: 'server_error', error_code: 'database_unavailable', schema_version: 2,
      }),
    );
  });
});
