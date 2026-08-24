import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActiveSubscription: vi.fn(),
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/subscriptionAccess', () => ({
  requireActiveSubscription: mocks.requireActiveSubscription,
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { POST } from '@/app/api/v1/me/push-token/route';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const PUSH_TOKEN = 'ExponentPushToken[abcdefghij]';
const DEVICE_ID = 'device-identifier-123';

function request() {
  return new Request('https://vella.one/api/v1/me/push-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      expo_push_token: PUSH_TOKEN,
      device_id: DEVICE_ID,
      platform: 'ios',
      locale: 'pt-BR',
    }),
  });
}

describe('push token registration route', () => {
  beforeEach(() => {
    mocks.requireActiveSubscription.mockReset().mockResolvedValue({ userId: USER_ID });
    mocks.createServiceClient.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activates the installation without re-deactivating it from stale settings', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: 'token-row-id', error: null });
    // Deliberately expose no `from` method: registration must not read stale
    // user_settings or deactivate the token before the settings sync follows.
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ data: { saved: true } });
    expect(rpc).toHaveBeenCalledWith('register_push_token_for_user', {
      p_user_id: USER_ID,
      p_expo_push_token: PUSH_TOKEN,
      p_device_id: DEVICE_ID,
      p_platform: 'ios',
      p_locale: 'pt-BR',
    });
  });

  it('logs registration failures without including user, device or token values', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'XX001', message: `failure for ${PUSH_TOKEN} and ${DEVICE_ID}` },
    });
    mocks.createServiceClient.mockReturnValue({ rpc });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await POST(request());

    expect(response.status).toBe(500);
    expect(errorSpy).toHaveBeenCalledWith('[push-token] operation_failed', {
      operation: 'register',
      stage: 'database_registration',
      errorCode: 'XX001',
    });
    const serializedLog = JSON.stringify(errorSpy.mock.calls);
    expect(serializedLog).not.toContain(USER_ID);
    expect(serializedLog).not.toContain(PUSH_TOKEN);
    expect(serializedLog).not.toContain(DEVICE_ID);
  });
});
