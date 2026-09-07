import { describe, expect, it, vi } from 'vitest';

import { loadMilestoneCabinet } from '../lib/rhythms/milestones';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const EARNED_ID = '22222222-2222-4222-8222-222222222222';

function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

describe('milestone service', () => {
  it('accepts valid Supabase timestamptz offsets in earned milestones', async () => {
    const client = {
      from: vi.fn((table: string) => query(table === 'gamification_milestones'
        ? { data: [{
          code: 'first_spark', title: 'First spark', description: 'Begin.', category: 'journey',
          tier: 'spark', theme_key: null, asset_key: 'flame.spark', display_priority: 1,
          is_shareable: true, is_active: true,
        }], error: null }
        : table === 'user_milestones'
          ? { data: [{ id: EARNED_ID, user_id: USER_ID, milestone_code: 'first_spark', earned_at: '2026-08-27T12:00:00+00:00' }], error: null }
          : { data: [], error: null })),
      rpc: vi.fn(),
    };

    const cabinet = await loadMilestoneCabinet(client as never, USER_ID);

    expect(cabinet.items[0]).toMatchObject({ code: 'first_spark', earned_at: '2026-08-27T12:00:00+00:00' });
  });
});
