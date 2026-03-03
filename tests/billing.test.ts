import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

const upsertMock = vi.fn();
const insertMock = vi.fn();
const deleteFinalEqMock = vi.fn();
const deleteEqMock = vi.fn(() => ({ eq: deleteFinalEqMock }));
const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

vi.mock('../lib/supabase', () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === 'subscriptions') {
        return {
          upsert: upsertMock,
        };
      }
      if (table === 'entitlements') {
        return {
          delete: deleteMock,
          insert: insertMock,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { syncSubscriptionFromStripe } from '../lib/billing';

describe('syncSubscriptionFromStripe', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    insertMock.mockReset();
    deleteMock.mockReset();
    deleteEqMock.mockReset();
    deleteFinalEqMock.mockReset();
  });

  it('upserts subscription and entitlement for user metadata', async () => {
    upsertMock.mockReturnValue({
      select: () => ({ single: async () => ({ data: { id: 'sub-db-1' }, error: null }) }),
    });

    insertMock.mockResolvedValue({ error: null });

    const stripeSub = {
      id: 'sub_123',
      customer: 'cus_123',
      status: 'active',
      current_period_start: 1735689600,
      current_period_end: 1738291200,
      cancel_at_period_end: false,
      metadata: { user_id: '11111111-1111-1111-1111-111111111111' },
      items: { data: [{ price: { id: 'price_individual' } }] },
    } as unknown as Stripe.Subscription;

    const result = await syncSubscriptionFromStripe(stripeSub);

    expect((result as { synced?: boolean }).synced).toBe(true);
    expect(upsertMock).toHaveBeenCalled();
    expect(insertMock).toHaveBeenCalled();
  });

  it('skips when no user_id/group_id metadata', async () => {
    const stripeSub = {
      id: 'sub_999',
      customer: 'cus_999',
      status: 'active',
      current_period_start: 1735689600,
      current_period_end: 1738291200,
      cancel_at_period_end: false,
      metadata: {},
      items: { data: [{ price: { id: 'price_individual' } }] },
    } as unknown as Stripe.Subscription;

    const result = await syncSubscriptionFromStripe(stripeSub);

    expect((result as { skipped?: boolean }).skipped).toBe(true);
  });
});
