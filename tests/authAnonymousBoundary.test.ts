import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ auth: { getUser: mocks.getUser } }),
}));

import {
  getOptionalUserIdFromAuthHeader,
  getUserIdFromAuthHeader,
} from '@/lib/auth';

describe('Supabase anonymous auth boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.headers.mockResolvedValue({
      get: (name: string) => name === 'authorization' ? 'Bearer session-token' : null,
    });
  });

  it('rejects an anonymous Supabase session at the ordinary auth boundary', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, is_anonymous: true } },
      error: null,
    });

    await expect(getUserIdFromAuthHeader()).resolves.toEqual({
      error: 'Anonymous session is not allowed for this endpoint',
    });
    await expect(getOptionalUserIdFromAuthHeader()).resolves.toBeNull();
  });

  it('accepts a permanent Supabase user without an opt-in', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, is_anonymous: false } },
      error: null,
    });

    await expect(getUserIdFromAuthHeader()).resolves.toEqual({
      userId: USER_ID,
      isAnonymous: false,
    });
  });

  it('accepts an anonymous session only through the explicit opt-in', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: USER_ID, is_anonymous: true } },
      error: null,
    });

    await expect(getUserIdFromAuthHeader({ allowAnonymous: true })).resolves.toEqual({
      userId: USER_ID,
      isAnonymous: true,
    });
  });
});
