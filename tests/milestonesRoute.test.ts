import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  loadMilestoneCabinet: vi.fn(),
  replaceFeaturedMilestones: vi.fn(),
}));

vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));
vi.mock('../lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('../lib/rhythms/milestones', () => ({
  loadMilestoneCabinet: mocks.loadMilestoneCabinet,
  replaceFeaturedMilestones: mocks.replaceFeaturedMilestones,
}));

import { GET as getMilestones } from '../app/api/v1/rhythms/milestones/route';
import { PUT as putFeatured } from '../app/api/v1/rhythms/milestones/featured/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function request(body: unknown) {
  return new Request('https://vella.one/api/v1/rhythms/milestones/featured', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('milestone cabinet and featuring routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
    mocks.loadMilestoneCabinet.mockResolvedValue({ schema_version: 1, items: [] });
    mocks.replaceFeaturedMilestones.mockResolvedValue({
      ok: true,
      value: { schema_version: 1, featured_milestones: [] },
    });
  });

  it('returns the private cabinet without caching it', async () => {
    const response = await getMilestones();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ data: { schema_version: 1, items: [] } });
    expect(mocks.loadMilestoneCabinet).toHaveBeenCalledWith({}, USER_ID);
  });

  it.each<[string[]]>([
    [[]],
    [['streak_3']],
    [['journey_finisher', 'streak_7', 'streak_3']],
  ])('atomically replaces zero-to-three featured codes in order: %j', async (codes) => {
    mocks.replaceFeaturedMilestones.mockResolvedValue({
      ok: true,
      value: {
        schema_version: 1,
        featured_milestones: codes.map((code, index) => ({ code, position: index + 1 })),
      },
    });
    const response = await putFeatured(request({ codes }));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.replaceFeaturedMilestones).toHaveBeenCalledWith({}, USER_ID, codes);
  });

  it.each([
    { codes: ['a', 'b', 'c', 'd'] },
    { codes: ['streak_3', 'streak_3'] },
    { codes: ['UPPERCASE'] },
    { codes: ['streak_3'], progress: 'private' },
  ])('rejects invalid, duplicate, oversized, or extra fields: %j', async (payload) => {
    const response = await putFeatured(request(payload));
    expect(response.status).toBe(400);
    expect(mocks.replaceFeaturedMilestones).not.toHaveBeenCalled();
  });

  it.each(['unearned', 'inactive', 'not_shareable', 'foreign_owner'])(
    'rejects a %s milestone without exposing storage details',
    async (reason) => {
      mocks.replaceFeaturedMilestones.mockResolvedValue({ ok: false, code: 'invalid_milestone' });
      const response = await putFeatured(request({ codes: ['streak_3'] }));
      const json = await response.json();
      expect(response.status).toBe(400);
      expect(json.error.details.code).toBe('invalid_featured_milestone');
      expect(JSON.stringify(json)).not.toContain(reason);
    },
  );

  it('contains storage failure in a finite privacy-safe response', async () => {
    mocks.replaceFeaturedMilestones.mockResolvedValue({ ok: false, code: 'database_unavailable' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await putFeatured(request({ codes: ['streak_3'] }));
    expect(response.status).toBe(503);
    expect((await response.json()).error.details.code).toBe('milestones_unavailable');
    expect(log).toHaveBeenCalledWith('[rhythms-milestones]', {
      route: 'featured_milestones', stage: 'replace', code: 'database_unavailable',
    });
  });

  it('preserves the subscription gate without touching milestone storage', async () => {
    mocks.requireActiveSubscription.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: 'Subscription required' } }), { status: 402 }),
    });
    const response = await putFeatured(request({ codes: [] }));
    expect(response.status).toBe(402);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});

describe('featured milestone transaction contract', () => {
  it('validates ownership/shareability and replaces all positions in one service-only RPC', () => {
    const migrations = fs.readdirSync(path.resolve(process.cwd(), '../supabase/migrations'))
      .filter((name) => name.endsWith('_replace_featured_milestones.sql'));
    expect(migrations).toHaveLength(1);
    const sql = fs.readFileSync(path.resolve(process.cwd(), '../supabase/migrations', migrations[0]), 'utf8');
    expect(sql).toMatch(/create or replace function faith_harbor\.replace_featured_milestones/i);
    expect(sql).toMatch(/security definer/i);
    expect(sql).toMatch(/cardinality\(v_codes\).*between 0 and 3/is);
    expect(sql).toMatch(/user_milestones[\s\S]*user_id\s*=\s*p_user_id/i);
    expect(sql).toMatch(/is_shareable\s*=\s*true[\s\S]*is_active\s*=\s*true/i);
    expect(sql).toMatch(/delete from faith_harbor\.user_featured_milestones/i);
    expect(sql).toMatch(/with ordinality/i);
    expect(sql).toMatch(/revoke all on function[\s\S]*from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function[\s\S]*to service_role/i);
  });
});
