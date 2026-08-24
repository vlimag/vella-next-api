import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;
}

function transitionPurgeRpcIsNotInstalled(error: { code?: string; message?: string } | null) {
  const message = error?.message ?? '';
  return error?.code === 'PGRST202' &&
    message.includes(
      'Could not find the function faith_harbor.' +
      'purge_expired_subscription_marketing_transitions(p_limit)',
    ) &&
    message.includes('schema cache');
}

function transitionTableIsNotInstalled(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST205' &&
    error.message ===
      "Could not find the table 'faith_harbor.subscription_marketing_transitions' in the schema cache";
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  let deleted = 0;
  let subscriptionTransitionsDeleted = 0;
  try {
    // Bound work per run while allowing a delayed job to catch up safely.
    for (let batch = 0; batch < 10; batch += 1) {
      const { data, error } = await supabase.rpc('purge_expired_growth_analytics', {
        p_limit: 50_000,
      });
      if (error) throw new Error(error.message);
      const batchDeleted = typeof data === 'number' ? data : Number(data ?? 0);
      if (!Number.isFinite(batchDeleted) || batchDeleted < 0) throw new Error('invalid purge result');
      deleted += batchDeleted;
      if (batchDeleted < 50_000) break;
    }

    for (let batch = 0; batch < 10; batch += 1) {
      const { data, error } = await supabase.rpc(
        'purge_expired_subscription_marketing_transitions',
        { p_limit: 50_000 },
      );
      if (transitionPurgeRpcIsNotInstalled(error)) {
        const { error: tableProbeError } = await supabase
          .from('subscription_marketing_transitions')
          .select('transition_id')
          .limit(1);
        if (transitionTableIsNotInstalled(tableProbeError)) break;
        if (tableProbeError) throw new Error(tableProbeError.message);
        throw new Error(error?.message ?? 'transition purge RPC unavailable');
      }
      if (error) throw new Error(error.message);
      const batchDeleted = typeof data === 'number' ? data : Number(data ?? 0);
      if (!Number.isFinite(batchDeleted) || batchDeleted < 0) throw new Error('invalid purge result');
      subscriptionTransitionsDeleted += batchDeleted;
      if (batchDeleted < 50_000) break;
    }

    console.info('[growth-analytics] retention_completed', {
      deleted,
      subscriptionTransitionsDeleted,
    });
    return NextResponse.json({
      ok: true,
      deleted,
      retention_days: 90,
      subscription_transitions_deleted: subscriptionTransitionsDeleted,
      subscription_transition_retention_days: 400,
    });
  } catch (error) {
    console.error('[growth-analytics] retention_failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Growth analytics retention job failed' }, { status: 500 });
  }
}
