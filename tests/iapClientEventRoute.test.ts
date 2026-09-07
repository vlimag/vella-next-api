import { beforeEach, describe, expect, it, vi } from 'vitest';

const ANONYMOUS_USER_ID = '11111111-1111-4111-8111-111111111111';
const EVENT_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  getUserIdFromAuthHeader: vi.fn(),
  from: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserIdFromAuthHeader,
}));

vi.mock('@/lib/iapProducts', () => ({
  isVellaSubscriptionProduct: (productId: string) => productId === 'vella.premium.yearly',
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({ from: mocks.from }),
}));

import { POST } from '@/app/api/v1/iap/client-event/route';

function request(body: Record<string, unknown>) {
  return new Request('https://vella.one/api/v1/iap/client-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function diagnostic(overrides: Record<string, unknown> = {}) {
  return {
    eventId: EVENT_ID,
    platform: 'android',
    productId: 'vella.premium.yearly',
    stage: 'purchase_callback',
    outcome: 'cancelled',
    appVersion: '1.0.1',
    buildNumber: '26',
    runtimeVersion: '1.4',
    ...overrides,
  };
}

describe('IAP client diagnostics authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
  });

  it('records a privacy-safe diagnostic from an anonymous purchase session', async () => {
    mocks.getUserIdFromAuthHeader.mockImplementation(
      async (options?: { allowAnonymous?: boolean }) => options?.allowAnonymous === true
        ? { userId: ANONYMOUS_USER_ID, isAnonymous: true }
        : { error: 'Anonymous session is not allowed for this endpoint' },
    );

    const response = await POST(request(diagnostic()));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ data: { recorded: true } });
    expect(mocks.from).toHaveBeenCalledWith('iap_client_events');
    expect(mocks.upsert).toHaveBeenCalledWith({
      event_id: EVENT_ID,
      user_id: ANONYMOUS_USER_ID,
      platform: 'android',
      product_id: 'vella.premium.yearly',
      stage: 'purchase_callback',
      outcome: 'cancelled',
      error_code: null,
      app_version: '1.0.1',
      build_number: '26',
      runtime_version: '1.4',
    }, { onConflict: 'event_id', ignoreDuplicates: true });
  });

  it('still rejects a request without a valid bearer session', async () => {
    mocks.getUserIdFromAuthHeader.mockResolvedValue({ error: 'Missing bearer token' });

    const response = await POST(request(diagnostic()));

    expect(response.status).toBe(401);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it('rejects receipt-like fields instead of persisting purchase proof', async () => {
    mocks.getUserIdFromAuthHeader.mockResolvedValue({
      userId: ANONYMOUS_USER_ID,
      isAnonymous: true,
    });

    const response = await POST(request(diagnostic({ receiptData: 'private-purchase-proof' })));
    const visible = JSON.stringify(await response.json());

    expect(response.status).toBe(400);
    expect(visible).not.toContain('private-purchase-proof');
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
