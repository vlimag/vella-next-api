import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  client: null as unknown as { from: (table: string) => unknown },
}));

vi.mock('../lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => mocks.client,
}));

import { GET as listGroups, POST as createGroup } from '../app/api/v1/groups/route';
import { POST as joinGroup } from '../app/api/v1/groups/join/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const GROUP = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Family prayer',
  description: 'A trusted circle',
  language_code: 'en',
  invite_code: 'VELLA7',
};

describe('groups routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActiveSubscription.mockResolvedValue({ userId: USER_ID });
  });

  it('lists the current user groups with newest memberships first', async () => {
    const order = vi.fn(async () => ({
      data: [{ role: 'owner', joined_at: '2026-08-12T18:00:00.000Z', groups: GROUP }],
      error: null,
    }));
    const eq = vi.fn(() => ({ order }));
    const select = vi.fn(() => ({ eq }));
    mocks.client = { from: vi.fn(() => ({ select })) };

    const response = await listGroups();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: [{ role: 'owner', joined_at: '2026-08-12T18:00:00.000Z', groups: GROUP }],
    });
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(order).toHaveBeenCalledWith('joined_at', { ascending: false });
  });

  it('creates a group and records its creator as owner', async () => {
    const ownerInsert = vi.fn(async () => ({ data: null, error: null }));
    const groupInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: GROUP, error: null })),
      })),
    }));
    mocks.client = {
      from: vi.fn((table: string) => {
        if (table === 'groups') return { insert: groupInsert };
        if (table === 'group_members') return { insert: ownerInsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const response = await createGroup(new Request('https://vella.one/api/v1/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Family prayer', description: 'A trusted circle', language_code: 'en' }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: GROUP });
    expect(groupInsert).toHaveBeenCalledWith(expect.objectContaining({
      owner_user_id: USER_ID,
      name: 'Family prayer',
      description: 'A trusted circle',
      language_code: 'en',
      invite_code: expect.stringMatching(/^[A-Z0-9]{6}$/),
    }));
    expect(ownerInsert).toHaveBeenCalledWith({
      group_id: GROUP.id,
      user_id: USER_ID,
      role: 'owner',
    });
  });

  it('joins by normalized invite code without downgrading an existing owner or admin role', async () => {
    const single = vi.fn(async () => ({ data: GROUP, error: null }));
    const groupEqCode = vi.fn(() => ({ single }));
    const groupSelect = vi.fn(() => ({ eq: groupEqCode }));
    const membershipUpsert = vi.fn(async () => ({ data: null, error: null }));
    mocks.client = {
      from: vi.fn((table: string) => {
        if (table === 'groups') return { select: groupSelect };
        if (table === 'group_members') return { upsert: membershipUpsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const response = await joinGroup(new Request('https://vella.one/api/v1/groups/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite_code: ' vella7 ' }),
    }));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ data: GROUP });
    expect(groupEqCode).toHaveBeenCalledWith('invite_code', 'VELLA7');
    expect(membershipUpsert).toHaveBeenCalledWith(
      { group_id: GROUP.id, user_id: USER_ID, role: 'member' },
      { onConflict: 'group_id,user_id', ignoreDuplicates: true },
    );
  });

  it('rejects an unknown invite code without writing a membership', async () => {
    const membershipUpsert = vi.fn();
    mocks.client = {
      from: vi.fn((table: string) => {
        if (table === 'groups') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          };
        }
        if (table === 'group_members') return { upsert: membershipUpsert };
        throw new Error(`Unexpected table: ${table}`);
      }),
    };

    const response = await joinGroup(new Request('https://vella.one/api/v1/groups/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invite_code: 'NOPE99' }),
    }));

    expect(response.status).toBe(404);
    expect(membershipUpsert).not.toHaveBeenCalled();
  });
});
