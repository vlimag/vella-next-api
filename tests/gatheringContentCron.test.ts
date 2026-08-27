import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  runGatheringFactory: vi.fn(),
  createGatheringIncidentRepository: vi.fn(),
  openGatheringIncident: vi.fn(),
  sendGatheringAlert: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock('@/lib/gatheringFactory/inventory', () => ({ runGatheringFactory: mocks.runGatheringFactory }));
vi.mock('@/lib/gatheringFactory/alerts', () => ({
  createGatheringIncidentRepository: mocks.createGatheringIncidentRepository,
  openGatheringIncident: mocks.openGatheringIncident,
  sendGatheringAlert: mocks.sendGatheringAlert,
}));

import { GET, POST } from '@/app/api/cron/gathering-content/route';

describe('Gathering content cron', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    process.env.OPENAI_API_KEY = 'openai-key';
    mocks.createServiceClient.mockReturnValue({ rpc: vi.fn() });
    mocks.createGatheringIncidentRepository.mockReturnValue({});
    mocks.openGatheringIncident.mockResolvedValue({
      created: true,
      incident: { incidentKey: 'factory.inventory_low.inventory', alertState: 'pending' },
    });
    mocks.sendGatheringAlert.mockResolvedValue({ delivered: true, skipped: false });
    mocks.runGatheringFactory.mockResolvedValue({ planned: 1, published: 1, rejected: 0, futureInventory: 12 });
  });

  it('requires the cron bearer secret without revealing operational data', async () => {
    const response = await POST(new Request('https://vella.one/api/cron/gathering-content', { method: 'POST' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(mocks.runGatheringFactory).not.toHaveBeenCalled();
  });

  it('accepts Vercel Cron GET with the safe apply defaults', async () => {
    const response = await GET(new Request('https://vella.one/api/cron/gathering-content', {
      headers: { authorization: 'Bearer cron-secret' },
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ planned: 1, published: 1, rejected: 0, future_inventory: 12 });
    expect(mocks.runGatheringFactory).toHaveBeenCalledWith(expect.objectContaining({
      dryRun: false,
      maxSlots: 1,
      evergreenFallbacks: [
        { key: 'evergreen-monday-quiet-beginning', slotType: 'monday', reviewed: true },
        { key: 'evergreen-thursday-gentle-renewal', slotType: 'thursday', reviewed: true },
      ],
    }));
  });

  it('accepts the Task 10 sidecar body and returns only safe counts', async () => {
    const response = await POST(new Request('https://vella.one/api/cron/gathering-content', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret', 'content-type': 'application/json' },
      body: JSON.stringify({
        dry_run: false,
        max_slots: 1,
        evergreen_fallbacks: [{ key: 'evergreen-rest', slot_type: 'monday', reviewed: true }],
      }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ planned: 1, published: 1, rejected: 0, future_inventory: 12 });
    expect(mocks.runGatheringFactory).toHaveBeenCalledWith(expect.objectContaining({
      maxSlots: 1,
      dryRun: false,
      evergreenFallbacks: [{ key: 'evergreen-rest', slotType: 'monday', reviewed: true }],
    }));
  });

  it('delivers a persisted alert immediately when the factory reports an incident', async () => {
    mocks.runGatheringFactory.mockImplementationOnce(async (dependencies) => {
      await dependencies.incidentSink.report({
        severity: 'warning', code: 'inventory_low', inventoryDepth: 3,
      });
      return { planned: 0, published: 0, rejected: 0, futureInventory: 3 };
    });

    const response = await GET(new Request('https://vella.one/api/cron/gathering-content', {
      headers: { authorization: 'Bearer cron-secret' },
    }));

    expect(response.status).toBe(200);
    expect(mocks.openGatheringIncident).toHaveBeenCalledWith(expect.objectContaining({
      incidentType: 'inventory_low', safeErrorCode: 'inventory_low', inventoryDepth: 3,
    }), expect.anything());
    expect(mocks.sendGatheringAlert).toHaveBeenCalledWith(expect.objectContaining({ kind: 'open' }), expect.objectContaining({ repository: expect.anything() }));
  });

  it('rejects malformed and unknown sidecar fields without echoing fallback content', async () => {
    const response = await POST(new Request('https://vella.one/api/cron/gathering-content', {
      method: 'POST',
      headers: { authorization: 'Bearer cron-secret', 'content-type': 'application/json' },
      body: JSON.stringify({ dry_run: false, max_slots: 13, evergreen_fallbacks: [], extra: 'private' }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid request' });
    expect(mocks.runGatheringFactory).not.toHaveBeenCalled();
  });
});
