import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const JOURNEY_ID = '22222222-2222-4222-8222-222222222222';
const TEMPLATE_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  getOrCreateDayAssignment: vi.fn(),
  requireActiveSubscription: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/journeys', () => ({ getOrCreateDayAssignment: mocks.getOrCreateDayAssignment }));
vi.mock('../lib/subscriptionAccess', () => ({ requireActiveSubscription: mocks.requireActiveSubscription }));

type ActiveModule = { GET?: (request: Request) => Promise<Response> };
const modulePath = '../app/api/v1/journeys/active/route';

async function activeModule(): Promise<ActiveModule> {
  return import(modulePath).catch(() => ({}));
}

function activeClient(error: unknown = null) {
  const active = {
    id: JOURNEY_ID, user_id: USER_ID, anonymous_profile_id: null, template_id: TEMPLATE_ID, status: 'active',
    current_day: 3, streak_count: 2, best_streak: 4, total_completed_days: 2, consistency_score: 66,
    last_completed_on: '2026-08-25', start_date: '2026-08-23', theme_preference: 'hope',
    timezone_name: 'America/Sao_Paulo', completed_at: null, paused_at: null, last_resumed_at: '2026-08-24T12:00:00.000Z',
    source: 'onboarding', completion_version: 1,
    journey_templates: {
      id: TEMPLATE_ID, slug: 'daily-faith-journey', language_code: 'en', title: 'Seven Days', subtitle: null,
      description: 'A finite summary', duration_days: 7, is_premium: false, theme_tags: ['hope'], version: 1,
    },
  };
  const first: Record<string, unknown> = {};
  first.select = vi.fn(() => first);
  first.eq = vi.fn(() => first);
  first.order = vi.fn(() => first);
  first.limit = vi.fn(() => first);
  first.maybeSingle = vi.fn(async () => ({ data: error ? null : active, error }));
  const milestones: Record<string, unknown> = {};
  milestones.select = vi.fn(() => milestones);
  milestones.eq = vi.fn(() => milestones);
  milestones.order = vi.fn(() => milestones);
  milestones.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
  const from = vi.fn(() => from.mock.calls.length === 1 ? first : milestones);
  return { from };
}

describe('active journey continuity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-26T01:00:00.000Z'));
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.createServiceClient.mockReturnValue(activeClient());
    mocks.getOrCreateDayAssignment.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('uses the Task 8 timezone boundary and adds only finite continuity metadata without changing legacy fields', async () => {
    const module = await activeModule();
    expect(typeof module.GET).toBe('function');

    const response = await module.GET!(new Request('https://vella.one/api/v1/journeys/active?lang=en'));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json.data.journey).toMatchObject({
      id: JOURNEY_ID, status: 'active', current_day: 3, display_day: 2, total_completed_days: 2,
      completed_today: true, can_complete_today: false, next_available_on: '2026-08-26',
      timezone_name: 'America/Sao_Paulo', last_resumed_at: '2026-08-24T12:00:00.000Z',
      source: 'onboarding', completion_version: 1,
    });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('contains an active-journey dependency failure in a finite no-store response', async () => {
    mocks.getOrCreateDayAssignment.mockRejectedValue(new Error(`private assignment failure for ${USER_ID}`));
    const module = await activeModule();
    expect(typeof module.GET).toBe('function');

    const response = await module.GET!(new Request('https://vella.one/api/v1/journeys/active?lang=en'));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not load active journey', details: { code: 'journey_unavailable' } } });
    expect(JSON.stringify(json)).not.toContain(USER_ID);
  });

  it('does not expose a database error from the active-journey query', async () => {
    const privateMessage = `private relation failure for ${USER_ID}`;
    mocks.createServiceClient.mockReturnValue(activeClient({ message: privateMessage }));
    const module = await activeModule();
    expect(typeof module.GET).toBe('function');

    const response = await module.GET!(new Request('https://vella.one/api/v1/journeys/active?lang=en'));
    const json = await response.json();

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(json).toEqual({ error: { message: 'Could not load active journey', details: { code: 'journey_unavailable' } } });
    expect(JSON.stringify(json)).not.toContain(privateMessage);
  });
});
