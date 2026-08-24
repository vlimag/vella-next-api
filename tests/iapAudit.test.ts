import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  insert: vi.fn(),
  upsert: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ from: mocks.from }),
}));

import {
  purchaseProofFingerprint,
  recordFailedIapAttempt,
  recordValidIapReceipt,
} from '@/lib/iapAudit';

describe('IAP audit privacy boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insert.mockResolvedValue({ error: null });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === 'failed_receipts') return { insert: mocks.insert };
      if (table === 'in_app_purchase_receipts') return { upsert: mocks.upsert };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  it('correlates retries with a one-way fingerprint without persisting purchase proof', async () => {
    const proof = 'private-play-purchase-token';
    expect(purchaseProofFingerprint(proof)).toMatch(/^[a-f0-9]{64}$/);

    await recordFailedIapAttempt({
      requestId: '00000000-0000-4000-8000-000000000001',
      userId: 'user-1',
      platform: 'android',
      productId: 'vella.premium.yearly',
      errorCode: 'receipt_invalid',
      proof,
    });

    const row = mocks.insert.mock.calls[0][0];
    expect(row.proof_fingerprint).toBe(purchaseProofFingerprint(proof));
    expect(JSON.stringify(row)).not.toContain(proof);
    expect(row).not.toHaveProperty('receipt_data');
    expect(row).not.toHaveProperty('error_message');
  });

  it('stores only normalized successful receipt metadata', async () => {
    const proof = 'private-apple-receipt';
    await recordValidIapReceipt({
      requestId: '00000000-0000-4000-8000-000000000002',
      userId: 'user-1',
      platform: 'ios',
      productId: 'vella.premium.yearly',
      environment: 'Production',
      originalTransactionId: 'transaction-1',
      proof,
      expiresAt: '2026-08-24T00:00:00.000Z',
      autoRenew: true,
      billingPhase: 'trial',
    });

    const row = mocks.upsert.mock.calls[0][0];
    expect(row.billing_phase).toBe('trial');
    expect(JSON.stringify(row)).not.toContain(proof);
    expect(row).not.toHaveProperty('validation_response');
    expect(row).not.toHaveProperty('purchase_token');
  });
});

