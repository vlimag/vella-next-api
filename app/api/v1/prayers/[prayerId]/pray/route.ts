import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import {
  localDayInTimeZone,
  PRAYER_INTENTION_SELECT,
} from '@/lib/prayerSpace';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { createServiceClient } from '@/lib/supabase';

const paramsSchema = z.object({ prayerId: z.string().uuid() });

type RouteParams = {
  params: Promise<{ prayerId: string }>;
};

export async function POST(_req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid prayer intention id', 400);

  const supabase = createServiceClient();
  const { data: current, error: currentError } = await supabase
    .from('prayer_intentions')
    .select('id, status')
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId)
    .maybeSingle();

  if (currentError || !current) return fail('Prayer intention not found', 404);
  if (current.status !== 'active') {
    return fail('Only active prayer intentions can record a prayer moment', 409);
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('daily_verse_timezone')
    .eq('user_id', access.userId)
    .maybeSingle();
  const timeZone = typeof settings?.daily_verse_timezone === 'string'
    ? settings.daily_verse_timezone
    : 'UTC';
  const prayedOn = localDayInTimeZone(timeZone);

  const { data: checkinRows, error: checkinError } = await supabase.rpc(
    'record_prayer_checkin',
    {
      p_prayer_intention_id: parsedParams.data.prayerId,
      p_user_id: access.userId,
      p_prayed_on: prayedOn,
    },
  );

  if (checkinError) {
    if (checkinError.code === 'P0002') {
      return fail('Prayer intention is no longer active', 409);
    }
    return fail('Could not record prayer moment', 500, checkinError.message);
  }

  const firstCheckin = Array.isArray(checkinRows) ? checkinRows[0] : checkinRows;
  const counted = Boolean(
    firstCheckin
    && typeof firstCheckin === 'object'
    && 'counted' in firstCheckin
    && firstCheckin.counted,
  );

  const { data: item, error: itemError } = await supabase
    .from('prayer_intentions')
    .select(PRAYER_INTENTION_SELECT)
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId)
    .single();

  if (itemError || !item) return fail('Could not reload prayer intention', 500, itemError?.message);
  return ok({ item, counted });
}

