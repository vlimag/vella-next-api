import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import {
  PRAYER_INTENTION_SELECT,
  PRAYER_STATUSES,
} from '@/lib/prayerSpace';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const paramsSchema = z.object({ prayerId: z.string().uuid() });

const patchSchema = z.object({
  status: z.enum(PRAYER_STATUSES).optional(),
  answer_note: z.string().trim().max(2500).nullable().optional(),
}).strict().refine(
  (value) => value.status !== undefined || value.answer_note !== undefined,
  { message: 'At least one field is required' },
);

type RouteParams = {
  params: Promise<{ prayerId: string }>;
};

export async function PATCH(req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid prayer intention id', 400);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(patchSchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  const { data: current, error: currentError } = await supabase
    .from('prayer_intentions')
    .select('id, status, answered_at, answer_note')
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId)
    .maybeSingle();

  // Do not reveal whether a prayer intention belongs to another user.
  if (currentError || !current) return fail('Prayer intention not found', 404);

  const targetStatus = parsed.data.status ?? current.status;
  const normalizedAnswerNote = parsed.data.answer_note?.trim() || null;
  if (normalizedAnswerNote && targetStatus !== 'answered') {
    return fail('An answer note requires answered status', 400);
  }

  const payload: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    payload.status = parsed.data.status;
    if (parsed.data.status === 'answered') {
      payload.answered_at = current.answered_at ?? new Date().toISOString();
    } else if (parsed.data.status === 'active') {
      payload.answered_at = null;
      payload.answer_note = null;
    }
  }
  if (parsed.data.answer_note !== undefined) {
    payload.answer_note = normalizedAnswerNote;
  }

  const { data, error } = await supabase
    .from('prayer_intentions')
    .update(payload)
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId)
    .select(PRAYER_INTENTION_SELECT)
    .single();

  if (error || !data) return fail('Could not update prayer intention', 500, error?.message);
  return ok(data);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return fail('Invalid prayer intention id', 400);

  const supabase = createServiceClient();
  const { data: current, error: currentError } = await supabase
    .from('prayer_intentions')
    .select('id')
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId)
    .maybeSingle();

  if (currentError || !current) return fail('Prayer intention not found', 404);

  const { error } = await supabase
    .from('prayer_intentions')
    .delete()
    .eq('id', parsedParams.data.prayerId)
    .eq('user_id', access.userId);

  if (error) return fail('Could not delete prayer intention', 500, error.message);
  return ok({ deleted: true, prayer_id: parsedParams.data.prayerId });
}
