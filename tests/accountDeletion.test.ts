import { describe, expect, it, vi } from 'vitest';
import {
  deleteUserApplicationData,
  removeUserFeedMedia,
  removeUserProfileAvatar,
} from '../lib/accountDeletion';
import { buildAvatarStoragePath } from '../lib/profileAvatar';

function mockClient(
  rows: Array<Record<string, unknown>>,
  queryError: string | null = null,
  mutationErrors: Record<string, { code: string; message: string }> = {},
) {
  const remove = vi.fn().mockResolvedValue({ error: null });
  const deleteCalls: Array<{ table: string; column: string; value: string }> = [];
  const updateCalls: Array<{ table: string; column: string; value: string; values: Record<string, unknown> }> = [];
  const eq = vi.fn().mockResolvedValue({
    data: rows,
    error: queryError ? { message: queryError } : null,
  });
  const select = vi.fn(() => ({ eq }));
  const fromTable = vi.fn((table: string) => ({
    select,
    delete: () => ({
      eq: (column: string, value: string) => {
        deleteCalls.push({ table, column, value });
        return Promise.resolve({ error: mutationErrors[table] ?? null });
      },
    }),
    update: (values: Record<string, unknown>) => ({
      eq: (column: string, value: string) => {
        updateCalls.push({ table, column, value, values });
        return Promise.resolve({ error: mutationErrors[table] ?? null });
      },
    }),
  }));
  const fromBucket = vi.fn(() => ({ remove }));

  return {
    client: {
      from: fromTable,
      storage: { from: fromBucket },
    },
    fromBucket,
    remove,
    deleteCalls,
    updateCalls,
  };
}

describe('account media deletion', () => {
  it('removes the owned profile avatar before deleting profile metadata', async () => {
    const userId = 'user-1';
    const ownerSecret = 'server-only-test-secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = ownerSecret;
    process.env.SUPABASE_PROFILE_AVATARS_BUCKET = 'faith-harbor-profile-avatars';
    const avatarPath = buildAvatarStoragePath('image/jpeg', userId, ownerSecret, () => 'avatar');
    const remove = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                avatar_url: `https://example.supabase.co/storage/v1/object/public/faith-harbor-profile-avatars/${avatarPath}`,
              },
              error: null,
            }),
          }),
        }),
      }),
      storage: { from: () => ({ remove }) },
    };

    await expect(removeUserProfileAvatar(client as never, userId)).resolves.toEqual({ removed: 1 });
    expect(remove).toHaveBeenCalledWith([avatarPath]);
  });

  it('removes only the explicit object paths resolved from the user posts', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, fromBucket, remove } = mockClient([
      { storage_bucket: 'faith-harbor-feed-media', storage_path: `${userId}/post-1/image.jpg` },
      { storage_bucket: 'faith-harbor-feed-media', storage_path: `${userId}/post-2/image.webp` },
    ]);

    const result = await removeUserFeedMedia(client as never, userId);

    expect(result).toEqual({ removed: 2 });
    expect(fromBucket).toHaveBeenCalledWith('faith-harbor-feed-media');
    expect(remove).toHaveBeenCalledWith([
      `${userId}/post-1/image.jpg`,
      `${userId}/post-2/image.webp`,
    ]);
  });

  it('fails closed instead of deleting a path outside the user folder', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, remove } = mockClient([
      { storage_bucket: 'faith-harbor-feed-media', storage_path: 'another-user/post/image.jpg' },
    ]);

    const result = await removeUserFeedMedia(client as never, userId);

    expect(result.error).toContain('unsafe storage path');
    expect(remove).not.toHaveBeenCalled();
  });

  it('does not report success when media metadata cannot be resolved', async () => {
    const { client, remove } = mockClient([], 'database unavailable');

    await expect(removeUserFeedMedia(client as never, 'user-1')).resolves.toEqual({
      removed: 0,
      error: 'database unavailable',
    });
    expect(remove).not.toHaveBeenCalled();
  });

  it('removes Vella-owned account data and preserves billing audit rows without user linkage', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls, updateCalls } = mockClient([]);

    const result = await deleteUserApplicationData(client as never, userId);

    expect(result).toEqual({});
    expect(deleteCalls).toEqual(
      expect.arrayContaining([
        { table: 'growth_install_profile_links', column: 'user_id', value: userId },
        { table: 'profiles', column: 'id', value: userId },
        { table: 'social_posts', column: 'author_user_id', value: userId },
        { table: 'user_settings', column: 'user_id', value: userId },
        { table: 'entitlements', column: 'user_id', value: userId },
        { table: 'subscriptions', column: 'user_id', value: userId },
      ]),
    );
    expect(deleteCalls.some(({ table }) => table === 'growth_install_attribution')).toBe(false);
    expect(updateCalls).toEqual(
      expect.arrayContaining([
        { table: 'in_app_purchase_receipts', column: 'user_id', value: userId, values: { user_id: null } },
        {
          table: 'subscription_marketing_transitions',
          column: 'user_id',
          value: userId,
          values: { user_id: null },
        },
      ]),
    );
  });

  it('deletes only the requested account Rhythms rows in dependency order', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const anotherUserId = '22222222-2222-2222-2222-222222222222';
    const { client, deleteCalls } = mockClient([]);

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({});

    const rhythmsCalls = deleteCalls.filter(({ table }) => [
      'user_featured_milestones',
      'user_gathering_progress',
      'practice_sessions',
      'user_practices',
    ].includes(table));
    expect(rhythmsCalls).toEqual([
      { table: 'user_featured_milestones', column: 'user_id', value: userId },
      { table: 'user_gathering_progress', column: 'user_id', value: userId },
      { table: 'practice_sessions', column: 'user_id', value: userId },
      { table: 'user_practices', column: 'user_id', value: userId },
    ]);
    expect(deleteCalls.some(({ value }) => value === anotherUserId)).toBe(false);
  });

  it.each([
    ['PGRST205', "Could not find the table 'faith_harbor.practice_sessions' in the schema cache"],
    ['42P01', 'relation "faith_harbor.practice_sessions" does not exist'],
  ])('keeps deletion available before a Rhythms table exists (%s)', async (code, message) => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls } = mockClient([], null, {
      practice_sessions: { code, message },
    });

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({});
    expect(deleteCalls).toContainEqual({ table: 'profiles', column: 'id', value: userId });
  });

  it.each([
    ['PGRST205', "Could not find the table 'faith_harbor.unrelated_table' in the schema cache"],
    ['42P01', 'relation "faith_harbor.unrelated_table" does not exist'],
    ['42501', 'permission denied for table practice_sessions'],
  ])('does not hide non-Rhythms missing-relation or permission errors (%s)', async (code, message) => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls } = mockClient([], null, {
      practice_sessions: { code, message },
    });

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({
      error: `Could not delete practice_sessions.user_id: ${message}`,
    });
    expect(deleteCalls).toContainEqual({ table: 'practice_sessions', column: 'user_id', value: userId });
    expect(deleteCalls.some(({ table }) => table === 'user_practices')).toBe(false);
  });

  it.each([
    [
      'PGRST205',
      "Could not find the table 'faith_harbor.subscription_marketing_transitions' in the schema cache",
    ],
    ['42P01', 'relation "faith_harbor.subscription_marketing_transitions" does not exist'],
  ])(
    'keeps account deletion available before the transition table migration is installed (%s)',
    async (code, message) => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const { client, deleteCalls } = mockClient([], null, {
        subscription_marketing_transitions: { code, message },
      });

      await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({});
      expect(deleteCalls).toContainEqual({ table: 'subscriptions', column: 'user_id', value: userId });
    },
  );

  it('keeps account deletion available before the attribution migration is installed', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls } = mockClient([], null, {
      growth_install_profile_links: {
        code: 'PGRST205',
        message: "Could not find the table 'faith_harbor.growth_install_profile_links' in the schema cache",
      },
    });

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({});
    expect(deleteCalls).toContainEqual({ table: 'profiles', column: 'id', value: userId });
  });

  it.each([
    ['PGRST205', "Could not find the table 'faith_harbor.another_table' in the schema cache"],
    ['42P01', 'relation "faith_harbor.trigger_dependency" does not exist'],
  ])('does not hide unrelated %s errors while clearing transition ownership', async (code, message) => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls } = mockClient([], null, {
      subscription_marketing_transitions: { code, message },
    });

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({
      error: `Could not clear subscription_marketing_transitions.user_id: ${message}`,
    });
    expect(deleteCalls).toEqual([]);
  });

  it('never hides a transition-table permission or database failure', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const { client, deleteCalls } = mockClient([], null, {
      subscription_marketing_transitions: { code: '42501', message: 'permission denied' },
    });

    await expect(deleteUserApplicationData(client as never, userId)).resolves.toEqual({
      error: 'Could not clear subscription_marketing_transitions.user_id: permission denied',
    });
    expect(deleteCalls).toEqual([]);
  });
});
