import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  processPushReceipts: vi.fn(),
  processGeneralPushReceipts: vi.fn(),
  sendDueDailyVerseNotifications: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock('@/lib/dailyVerseNotifications', () => ({
  processPushReceipts: mocks.processPushReceipts,
  sendDueDailyVerseNotifications: mocks.sendDueDailyVerseNotifications,
}));

vi.mock('@/lib/generalPushDeliveries', () => ({
  processGeneralPushReceipts: mocks.processGeneralPushReceipts,
}));

import { GET } from '@/app/api/cron/daily-verses/route';

describe('daily verse cron route', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'cron-test-secret');
    mocks.processPushReceipts.mockReset().mockResolvedValue({ checked: 0, delivered: 0, failed: 0 });
    mocks.processGeneralPushReceipts.mockReset().mockResolvedValue({ checked: 0, delivered: 0, failed: 0 });
    mocks.sendDueDailyVerseNotifications.mockReset().mockResolvedValue({
      due: 0,
      activeTokens: 0,
      cacheDays: 0,
      cachePrepared: 0,
      cacheFailed: 0,
      claimed: 0,
      accepted: 0,
      failed: 0,
      skipped: {
        noActiveToken: 0,
        noVerse: 0,
        verseLookupFailed: 0,
        alreadyClaimed: 0,
        dryRun: 0,
        claimFailed: 0,
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses the outage-recovery window and emits a structured completion log', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    mocks.createServiceClient.mockReturnValue({ rpc });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const response = await GET(new Request('https://vella.one/api/cron/daily-verses', {
      headers: { Authorization: 'Bearer cron-test-secret' },
    }));

    expect(rpc).toHaveBeenCalledWith('get_due_daily_verse_notifications', {
      p_at_time: expect.any(String),
      p_window_minutes: 120,
    });
    expect(response.status).toBe(200);
    expect(infoSpy).toHaveBeenCalledWith(
      '[daily-verse-cron] completed',
      expect.objectContaining({ dryRun: false, delivery: expect.objectContaining({ due: 0 }) }),
    );
  });

  it('rejects requests that do not carry the Vercel cron secret', async () => {
    const response = await GET(new Request('https://vella.one/api/cron/daily-verses'));

    expect(response.status).toBe(401);
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
