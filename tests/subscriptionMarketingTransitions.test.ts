import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserIdFromAuthHeader,
}));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));

import { POST as claimTransition } from '../app/api/v1/me/subscription-transitions/claim/route';
import { POST as acknowledgeTransition } from '../app/api/v1/me/subscription-transitions/ack/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const TRANSITION_ID = '22222222-2222-4222-8222-222222222222';

function request(path: 'claim' | 'ack', body?: unknown) {
  return new Request(`https://vella.one/api/v1/me/subscription-transitions/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

describe('subscription marketing transition delivery routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserIdFromAuthHeader.mockResolvedValue({ userId: USER_ID });
  });

  it.each([
    ['claim', (req: Request) => claimTransition(req)],
    ['ack', (req: Request) => acknowledgeTransition(req)],
  ] as const)('rejects unauthenticated %s requests with no-store', async (path, handler) => {
    mocks.getUserIdFromAuthHeader.mockResolvedValue({ error: 'Missing bearer token' });

    const response = await handler(request(path, path === 'ack' ? { transitionId: TRANSITION_ID } : undefined));

    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('returns an empty claim without inventing a transition', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });

    const response = await claimTransition(request('claim'));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ data: { transition: null } });
    expect(mocks.rpc).toHaveBeenCalledWith('claim_subscription_marketing_transition', {
      p_user_id: USER_ID,
    });
  });

  it('maps only the four coarse transition fields', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        transition_id: TRANSITION_ID,
        plan: 'yearly',
        phase: 'paid',
        occurred_at: '2026-08-24T18:00:00.000Z',
        user_id: USER_ID,
        receipt: 'must-not-leave-server',
        claimed_at: '2026-08-24T18:01:00.000Z',
      }],
      error: null,
    });

    const response = await claimTransition(request('claim'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        transition: {
          transitionId: TRANSITION_ID,
          plan: 'yearly',
          phase: 'paid',
          occurredAt: '2026-08-24T18:00:00.000Z',
        },
      },
    });
  });

  it('fails closed with no-store for malformed database rows', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{
        transition_id: TRANSITION_ID,
        plan: 'weekly',
        phase: 'paid',
        occurred_at: '2026-08-24T18:00:00.000Z',
      }],
      error: null,
    });

    const response = await claimTransition(request('claim'));

    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('validates the ACK UUID and binds the RPC to the authenticated user', async () => {
    const invalid = await acknowledgeTransition(request('ack', { transitionId: 'not-a-uuid' }));
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('cache-control')).toBe('no-store');
    expect(mocks.rpc).not.toHaveBeenCalled();

    mocks.rpc.mockResolvedValue({ data: true, error: null });
    const response = await acknowledgeTransition(request('ack', { transitionId: TRANSITION_ID }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ data: { acknowledged: true } });
    expect(mocks.rpc).toHaveBeenCalledWith('ack_subscription_marketing_transition', {
      p_user_id: USER_ID,
      p_transition_id: TRANSITION_ID,
    });
  });

  it('does not report success when the transition is not owned by the user', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });

    const response = await acknowledgeTransition(request('ack', { transitionId: TRANSITION_ID }));

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
