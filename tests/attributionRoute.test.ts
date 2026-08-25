import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleInstall: vi.fn(),
  handleLink: vi.fn(),
  getUserId: vi.fn(),
}));

vi.mock('@/lib/acquisitionAttribution', () => ({
  handleInstallAttributionRequest: mocks.handleInstall,
  handleLinkAttributionRequest: mocks.handleLink,
}));

vi.mock('@/lib/auth', () => ({
  getUserIdFromAuthHeader: mocks.getUserId,
}));

import {
  POST as install,
  dynamic as installDynamic,
  maxDuration as installMaxDuration,
  runtime as installRuntime,
} from '@/app/api/v1/attribution/install/route';
import { POST as link } from '@/app/api/v1/attribution/install/link/route';

const USER_ID = '22222222-2222-4222-8222-222222222222';

describe('attribution routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handleInstall.mockResolvedValue(new Response(null, { status: 202 }));
    mocks.handleLink.mockResolvedValue(new Response(null, { status: 202 }));
    mocks.getUserId.mockResolvedValue({ userId: USER_ID });
  });

  it('passes the anonymous install request to the strict attribution boundary', async () => {
    const request = new Request('https://vella.one/api/v1/attribution/install', { method: 'POST' });

    const response = await install(request);

    expect(response.status).toBe(202);
    expect(mocks.handleInstall).toHaveBeenCalledWith(request);
  });

  it('reserves enough Node runtime for Apple\'s bounded official retry window', () => {
    expect(installRuntime).toBe('nodejs');
    expect(installDynamic).toBe('force-dynamic');
    expect(installMaxDuration).toBeGreaterThanOrEqual(30);
  });

  it('rejects a link without authenticated server identity before reading the body', async () => {
    mocks.getUserId.mockResolvedValue({ error: 'Missing bearer token' });
    const request = new Request('https://vella.one/api/v1/attribution/install/link', { method: 'POST' });

    const response = await link(request);

    expect(response.status).toBe(401);
    expect(mocks.handleLink).not.toHaveBeenCalled();
  });

  it('passes only the server-authenticated user to the link boundary', async () => {
    const request = new Request('https://vella.one/api/v1/attribution/install/link', { method: 'POST' });

    const response = await link(request);

    expect(response.status).toBe(202);
    expect(mocks.handleLink).toHaveBeenCalledWith(request, USER_ID);
  });
});
