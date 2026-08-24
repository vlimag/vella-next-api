import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getExpoPushReceipts,
  sendExpoPushMessages,
  type ExpoPushMessage,
} from '@/lib/expoPush';

type AppSupabaseClient = SupabaseClient<any, any, any, any, any>;

export type TrackedPushMessage = {
  tokenId: string;
  userId: string;
  category: 'social' | 'system';
  message: ExpoPushMessage;
};

export async function sendTrackedPushMessages(
  supabase: AppSupabaseClient,
  items: TrackedPushMessage[],
) {
  const claims: Array<{ id: string; tokenId: string }> = [];
  const messages: ExpoPushMessage[] = [];

  for (const item of items) {
    const { data, error } = await supabase
      .from('push_notification_deliveries')
      .insert({
        user_id: item.userId,
        push_token_id: item.tokenId,
        category: item.category,
      })
      .select('id')
      .single();
    if (error || !data) continue;
    claims.push({ id: data.id as string, tokenId: item.tokenId });
    messages.push(item.message);
  }

  if (messages.length === 0) return;

  let tickets;
  try {
    tickets = await sendExpoPushMessages(messages);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await Promise.all(claims.map((claim) => supabase
      .from('push_notification_deliveries')
      .update({ status: 'failed', error_code: 'expo_request_failed', error_message: message })
      .eq('id', claim.id)));
    return;
  }

  for (let index = 0; index < claims.length; index += 1) {
    const claim = claims[index];
    const ticket = tickets[index];
    const errorCode = ticket?.details?.error ?? null;
    await supabase
      .from('push_notification_deliveries')
      .update(ticket?.status === 'ok' && ticket.id
        ? { status: 'accepted', expo_ticket_id: ticket.id }
        : {
            status: 'failed',
            error_code: errorCode ?? 'expo_ticket_error',
            error_message: ticket?.message ?? 'Expo rejected the notification',
          })
      .eq('id', claim.id);
    if (errorCode === 'DeviceNotRegistered') {
      await supabase.from('user_push_tokens').update({ is_active: false }).eq('id', claim.tokenId);
    }
  }
}

export async function processGeneralPushReceipts(
  supabase: AppSupabaseClient,
  now = new Date(),
) {
  const cutoff = new Date(now.getTime() - 15 * 60_000).toISOString();
  const { data } = await supabase
    .from('push_notification_deliveries')
    .select('id, push_token_id, expo_ticket_id')
    .eq('status', 'accepted')
    .lt('attempted_at', cutoff)
    .not('expo_ticket_id', 'is', null)
    .limit(500);
  const pending = (data ?? []).filter((row) => typeof row.expo_ticket_id === 'string');
  if (pending.length === 0) return { checked: 0, delivered: 0, failed: 0 };

  const receipts = await getExpoPushReceipts(pending.map((row) => row.expo_ticket_id as string));
  let delivered = 0;
  let failed = 0;
  for (const row of pending) {
    const receipt = receipts[row.expo_ticket_id as string];
    if (!receipt) continue;
    const errorCode = receipt.details?.error ?? null;
    await supabase
      .from('push_notification_deliveries')
      .update({
        status: receipt.status === 'ok' ? 'delivered' : 'failed',
        receipt_checked_at: now.toISOString(),
        error_code: errorCode,
        error_message: receipt.message ?? null,
      })
      .eq('id', row.id);
    if (receipt.status === 'ok') delivered += 1;
    else failed += 1;
    if (errorCode === 'DeviceNotRegistered') {
      await supabase.from('user_push_tokens').update({ is_active: false }).eq('id', row.push_token_id);
    }
  }
  return { checked: pending.length, delivered, failed };
}
