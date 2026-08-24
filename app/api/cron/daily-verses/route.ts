import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import {
  processPushReceipts,
  sendDueDailyVerseNotifications,
  type DueDailyVerseNotification,
} from '@/lib/dailyVerseNotifications';
import { processGeneralPushReceipts } from '@/lib/generalPushDeliveries';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const DAILY_VERSE_RECOVERY_WINDOW_MINUTES = 120;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dry_run') === '1';
  const now = new Date();
  const supabase = createServiceClient();

  try {
    const receipts = dryRun
      ? {
          daily: { checked: 0, delivered: 0, failed: 0 },
          general: { checked: 0, delivered: 0, failed: 0 },
        }
      : {
          daily: await processPushReceipts(supabase, now),
          general: await processGeneralPushReceipts(supabase, now),
        };
    const { data, error } = await supabase.rpc('get_due_daily_verse_notifications', {
      p_at_time: now.toISOString(),
      // Keep a recovery window for delayed deployments/outages. Delivery claims
      // are unique per user, token, local day and slot, so reruns stay idempotent.
      p_window_minutes: DAILY_VERSE_RECOVERY_WINDOW_MINUTES,
    });
    if (error) throw new Error(error.message);
    const delivery = await sendDueDailyVerseNotifications(
      supabase,
      (data ?? []) as DueDailyVerseNotification[],
      { dryRun },
    );
    console.info('[daily-verse-cron] completed', {
      at: now.toISOString(),
      dryRun,
      receipts,
      delivery,
    });
    return NextResponse.json({ ok: true, at: now.toISOString(), dryRun, receipts, delivery });
  } catch (error) {
    console.error('[daily-verse-cron] failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Daily verse notification job failed' }, { status: 500 });
  }
}
