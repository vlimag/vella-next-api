import { describe, expect, it, vi } from 'vitest';
import {
  projectFeaturedMilestones,
  tryLoadFeaturedMilestonesByUser,
} from '../lib/rhythms/milestones';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const M1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const M2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('public milestone projection', () => {
  it('contains only explicitly featured, earned, active, shareable badges for the same owner', () => {
    const result = projectFeaturedMilestones(
      [U1],
      [
        { user_id: U1, user_milestone_id: M1, position: 1 },
        { user_id: U1, user_milestone_id: M2, position: 2 },
        { user_id: U2, user_milestone_id: M2, position: 1 },
      ],
      [
        { id: M1, user_id: U1, milestone_code: 'streak_3' },
        { id: M2, user_id: U2, milestone_code: 'streak_7' },
      ],
      [
        {
          code: 'streak_3', title: '3 Day Flame', tier: 'spark', theme_key: null,
          asset_key: 'flame.spark', is_active: true, is_shareable: true,
        },
        {
          code: 'streak_7', title: '7 Day Anchor', tier: 'steady_flame', theme_key: null,
          asset_key: 'flame.steady', is_active: true, is_shareable: true,
        },
      ],
    );

    expect(result.get(U1)).toEqual([{
      code: 'streak_3', title: '3 Day Flame', tier: 'spark', theme_key: null,
      asset_key: 'flame.spark', position: 1,
    }]);
    expect(JSON.stringify(result)).not.toContain(M1);
    expect(JSON.stringify(result)).not.toContain(U1);
  });

  it('uses a finite generic asset fallback and excludes inactive or non-shareable catalog rows', () => {
    const result = projectFeaturedMilestones(
      [U1],
      [
        { user_id: U1, user_milestone_id: M1, position: 1 },
        { user_id: U1, user_milestone_id: M2, position: 2 },
      ],
      [
        { id: M1, user_id: U1, milestone_code: 'streak_3' },
        { id: M2, user_id: U1, milestone_code: 'streak_7' },
      ],
      [
        {
          code: 'streak_3', title: '3 Day Flame', tier: null, theme_key: null,
          asset_key: null, is_active: true, is_shareable: true,
        },
        {
          code: 'streak_7', title: '7 Day Anchor', tier: 'steady_flame', theme_key: null,
          asset_key: 'flame.steady', is_active: false, is_shareable: true,
        },
      ],
    );
    expect(result.get(U1)).toEqual([{
      code: 'streak_3', title: '3 Day Flame', tier: 'spark', theme_key: null,
      asset_key: 'milestone.generic', position: 1,
    }]);
  });

  it('degrades to null and logs only a finite code when a badge query fails', async () => {
    const query: Record<string, unknown> = {};
    query.select = vi.fn(() => query);
    query.in = vi.fn(() => query);
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
      data: null,
      error: { message: `private ${U1}` },
    }).then(resolve);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await tryLoadFeaturedMilestonesByUser({ from: vi.fn(() => query) } as never, [U1], 'feed');
    expect(result).toBeNull();
    expect(JSON.stringify(log.mock.calls)).not.toContain(U1);
    expect(log).toHaveBeenCalledWith('[rhythms-milestones]', {
      route: 'social_projection', stage: 'feed', code: 'database_unavailable',
    });
  });
});
