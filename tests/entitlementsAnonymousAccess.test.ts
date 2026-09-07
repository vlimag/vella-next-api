import { beforeEach, describe, expect, it, vi } from 'vitest';

const USER_ID = '11111111-1111-4111-8111-111111111111';

const mocks = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserIdFromAuthHeader,
}));
vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ from: mocks.from }),
}));

import { GET } from '@/app/api/v1/me/entitlements/route';

function terminalChain(result: unknown, terminal: 'or' | 'eq') {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => terminal === 'eq' ? Promise.resolve(result) : chain);
  chain.lte = vi.fn(() => chain);
  chain.or = vi.fn(() => Promise.resolve(result));
  return chain;
}

describe('anonymous entitlement reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserIdFromAuthHeader.mockResolvedValue({ userId: USER_ID });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'entitlements') {
        return terminalChain({
          data: [{ entitlement_code: 'premium_individual', active: true }],
          error: null,
        }, 'or');
      }
      if (table === 'group_members') {
        return terminalChain({ data: [], error: null }, 'eq');
      }
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('uses the explicit anonymous opt-in and returns the server-authoritative entitlement', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(mocks.getUserIdFromAuthHeader).toHaveBeenCalledWith({ allowAnonymous: true });
    await expect(response.json()).resolves.toMatchObject({
      data: { hasPremium: true },
    });
  });
});
