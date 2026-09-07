import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222';
const JOURNEY_ID = '33333333-3333-4333-8333-333333333333';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  createServiceClient: vi.fn(),
  getOrCreateDayAssignment: vi.fn(),
  userHasActivePremium: vi.fn(),
}));

vi.mock('../lib/subscriptionAccess', () => ({ requireActiveSubscription: mocks.requireActiveSubscription }));
vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/journeys', () => ({ getOrCreateDayAssignment: mocks.getOrCreateDayAssignment }));
vi.mock('../lib/entitlements', () => ({ userHasActivePremium: mocks.userHasActivePremium }));

import { POST } from '../app/api/v1/journeys/start/route';

function chain(result: { data: unknown; error: unknown }) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['select', 'eq', 'limit', 'insert']) query[method] = vi.fn(() => query);
  query.maybeSingle = vi.fn(async () => result);
  query.single = vi.fn(async () => result);
  return query;
}

function client(duplicate: boolean) {
  const template = chain({ data: {
    id: TEMPLATE_ID, slug: 'hope-in-seven', language_code: 'en', title: 'Hope', subtitle: null,
    description: 'Seven days of hope', duration_days: 7, is_premium: false, theme_tags: ['hope'],
  }, error: null });
  const duplicateQuery = chain({ data: duplicate ? { id: JOURNEY_ID } : null, error: null });
  const insert = chain({ data: {
    id: JOURNEY_ID, status: 'active', current_day: 1, streak_count: 0, best_streak: 0,
    total_completed_days: 0, consistency_score: 0, last_completed_on: null, start_date: '2026-08-27',
  }, error: null });
  let journeyCalls = 0;
  return {
    api: { from: vi.fn((table: string) => table === 'journey_templates' ? template : (++journeyCalls === 1 ? duplicateQuery : insert)) },
    duplicateQuery,
  };
}

async function post() {
  const response = await POST(new Request('https://vella.one/api/v1/journeys/start', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ template_slug: 'hope-in-seven', language_code: 'en' }),
  }));
  return { response, json: await response.json() };
}

describe('parallel journey starts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID, isAnonymous: false });
    mocks.getOrCreateDayAssignment.mockResolvedValue([]);
  });

  it('allows another active journey while preventing a duplicate of the same template', async () => {
    const available = client(false);
    mocks.createServiceClient.mockReturnValue(available.api);

    const started = await post();

    expect(started.response.status).toBe(201);
    expect(available.duplicateQuery.eq).toHaveBeenCalledWith('template_slug', 'hope-in-seven');

    const duplicate = client(true);
    mocks.createServiceClient.mockReturnValue(duplicate.api);
    const rejected = await post();
    expect(rejected.response.status).toBe(409);
    expect(rejected.json.error.details.code).toBe('journey_template_active');
  });

  it('replaces the owner-wide active constraint with a same-template constraint', () => {
    const migrationName = fs.readdirSync(path.resolve(process.cwd(), '../supabase/migrations'))
      .find((name) => name.endsWith('_allow_parallel_journeys.sql'));
    expect(migrationName).toBeTruthy();
    const sql = fs.readFileSync(path.resolve(process.cwd(), '../supabase/migrations', migrationName!), 'utf8');
    expect(sql).toMatch(/drop index if exists faith_harbor\.idx_user_journeys_active_user_unique/i);
    expect(sql).toMatch(/add column if not exists template_slug/i);
    expect(sql).toMatch(/user_journeys\(user_id, template_slug\)[\s\S]*where status = 'active'/i);
    expect(sql).toMatch(/user_journeys\(anonymous_profile_id, template_slug\)[\s\S]*where status = 'active'/i);
    expect(sql).not.toMatch(/drop table|truncate/i);
  });
});
