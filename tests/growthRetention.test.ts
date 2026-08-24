import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

import { GET } from '@/app/api/cron/growth-retention/route';

function request(authorized = true) {
  return new Request('https://vella.one/api/cron/growth-retention', {
    headers: authorized ? { Authorization: 'Bearer cron-test-secret' } : {},
  });
}

describe('growth retention cron', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    mocks.createServiceClient.mockReset();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('purges raw growth events and expired subscription transitions in bounded batches', async () => {
    const rpc = vi.fn(async (name: string) => {
      if (name === 'purge_expired_growth_analytics') return { data: 2, error: null };
      if (name === 'purge_expired_subscription_marketing_transitions') {
        return { data: 3, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    });
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deleted: 2,
      retention_days: 90,
      subscription_transitions_deleted: 3,
      subscription_transition_retention_days: 400,
    });
    expect(rpc).toHaveBeenCalledWith('purge_expired_growth_analytics', { p_limit: 50_000 });
    expect(rpc).toHaveBeenCalledWith('purge_expired_subscription_marketing_transitions', {
      p_limit: 50_000,
    });
  });

  it('returns a failure when transition retention cannot complete', async () => {
    const rpc = vi.fn(async (name: string) => (
      name === 'purge_expired_growth_analytics'
        ? { data: 0, error: null }
        : { data: null, error: { message: 'transition purge unavailable' } }
    ));
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(
      '[growth-analytics] retention_failed',
      { message: 'transition purge unavailable' },
    );
  });

  it('keeps the existing retention cron healthy before the transition purge RPC is installed', async () => {
    const rpc = vi.fn(async (name: string) => (
      name === 'purge_expired_growth_analytics'
        ? { data: 4, error: null }
        : {
            data: null,
            error: {
              code: 'PGRST202',
              message: 'Could not find the function faith_harbor.purge_expired_subscription_marketing_transitions(p_limit) in the schema cache',
            },
          }
    ));
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      deleted: 4,
      subscription_transitions_deleted: 0,
    });
  });

  it('never hides a transition-purge permission failure', async () => {
    const rpc = vi.fn(async (name: string) => (
      name === 'purge_expired_growth_analytics'
        ? { data: 0, error: null }
        : { data: null, error: { code: '42501', message: 'permission denied' } }
    ));
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(500);
  });

  it('does not hide PGRST202 for a different missing function', async () => {
    const rpc = vi.fn(async (name: string) => (
      name === 'purge_expired_growth_analytics'
        ? { data: 0, error: null }
        : {
            data: null,
            error: {
              code: 'PGRST202',
              message: 'Could not find the function faith_harbor.unrelated_retention_job',
            },
          }
    ));
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(500);
  });

  it('does not hide PGRST202 for another signature of the transition purge RPC', async () => {
    const rpc = vi.fn(async (name: string) => (
      name === 'purge_expired_growth_analytics'
        ? { data: 0, error: null }
        : {
            data: null,
            error: {
              code: 'PGRST202',
              message: 'Could not find the function faith_harbor.purge_expired_subscription_marketing_transitions(p_cutoff) in the schema cache',
            },
          }
    ));
    mocks.createServiceClient.mockReturnValue({ rpc });

    const response = await GET(request());

    expect(response.status).toBe(500);
  });

  it('rejects requests without the cron secret before creating a service client', async () => {
    const response = await GET(request(false));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
