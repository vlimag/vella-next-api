import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  verse_voice_id: z.string().trim().min(1).max(160).nullable().optional(),
  push_notifications_enabled: z.boolean().optional(),
  daily_verse_notifications_enabled: z.boolean().optional(),
  daily_verse_notification_count: z.union([z.literal(1), z.literal(2)]).optional(),
  daily_verse_time_1: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  daily_verse_time_2: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  daily_verse_timezone: z.string().trim().min(1).max(64).optional(),
  daily_verse_language: z.enum(['en', 'pt', 'es', 'fr', 'de', 'it', 'ru', 'pl']).optional(),
  daily_verse_style: z.enum(['scripture', 'gentle']).optional(),
  daily_verse_goal: z.enum(['habit', 'peace', 'prayer', 'study', 'family']).nullable().optional(),
  daily_verse_focus: z.enum(['anxiety', 'purpose', 'relationships', 'gratitude', 'hard_season', 'general']).nullable().optional(),
});

const SETTINGS_COLUMNS = 'user_id, verse_voice_id, push_notifications_enabled, daily_verse_notifications_enabled, daily_verse_notification_count, daily_verse_time_1, daily_verse_time_2, daily_verse_timezone, daily_verse_language, daily_verse_style, daily_verse_goal, daily_verse_focus, created_at, updated_at';

async function ensureUserSettings(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { error: upsertError } = await supabase
    .from('user_settings')
    .upsert({ user_id: userId }, { onConflict: 'user_id' });

  if (upsertError) {
    throw new Error(upsertError.message);
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select(SETTINGS_COLUMNS)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Could not load settings');
  }

  return data;
}

export async function GET() {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const supabase = createServiceClient();

  try {
    const data = await ensureUserSettings(supabase, auth.userId);
    return ok(data);
  } catch (error) {
    return fail('Could not load settings', 500, error instanceof Error ? error.message : String(error));
  }
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  if (Object.values(parsed.data).every((value) => value === undefined)) {
    return fail('No settings fields provided', 400);
  }

  const supabase = createServiceClient();

  try {
    await ensureUserSettings(supabase, auth.userId);
  } catch (error) {
    return fail('Could not initialize settings', 500, error instanceof Error ? error.message : String(error));
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.verse_voice_id !== undefined) {
    payload.verse_voice_id = parsed.data.verse_voice_id;
  }
  if (parsed.data.push_notifications_enabled !== undefined) {
    payload.push_notifications_enabled = parsed.data.push_notifications_enabled;
  }
  for (const key of [
    'daily_verse_notifications_enabled',
    'daily_verse_notification_count',
    'daily_verse_time_1',
    'daily_verse_time_2',
    'daily_verse_timezone',
    'daily_verse_language',
    'daily_verse_style',
    'daily_verse_goal',
    'daily_verse_focus',
  ] as const) {
    if (parsed.data[key] !== undefined) payload[key] = parsed.data[key];
  }

  const { data, error } = await supabase
    .from('user_settings')
    .update(payload)
    .eq('user_id', auth.userId)
    .select(SETTINGS_COLUMNS)
    .single();

  if (error || !data) return fail('Could not update settings', 500, error?.message);

  if (parsed.data.push_notifications_enabled !== undefined) {
    const { error: tokenStateError } = await supabase
      .from('user_push_tokens')
      .update({
        is_active: parsed.data.push_notifications_enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', auth.userId);

    if (tokenStateError) {
      return fail('Could not sync notification token state', 500, tokenStateError.message);
    }
  }

  return ok(data);
}
