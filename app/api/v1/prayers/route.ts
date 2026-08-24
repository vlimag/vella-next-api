import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import {
  isApprovedPrayerVerse,
  PRAYER_INTENTION_SELECT,
  PRAYER_STATUSES,
  PRAYER_THEMES,
} from '@/lib/prayerSpace';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';

const querySchema = z.object({
  status: z.enum(PRAYER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).strict();

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().max(2500).nullable().optional(),
  theme: z.enum(PRAYER_THEMES).default('hope'),
  verse_id: z.string().uuid().nullable().optional(),
}).strict();

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    status: searchParams.get('status') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  let query = supabase
    .from('prayer_intentions')
    .select(PRAYER_INTENTION_SELECT)
    .eq('user_id', access.userId)
    .order('updated_at', { ascending: false })
    .limit(parsed.data.limit ?? 50);

  if (parsed.data.status) {
    query = query.eq('status', parsed.data.status);
  }

  const { data, error } = await query;
  if (error) return fail('Could not load prayer intentions', 500, error.message);
  return ok({ items: data ?? [] });
}

export async function POST(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(createSchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  if (
    parsed.data.verse_id
    && !await isApprovedPrayerVerse(supabase, parsed.data.verse_id)
  ) {
    return fail('Verse is not available from the approved Scripture corpus', 400);
  }

  const { data, error } = await supabase
    .from('prayer_intentions')
    .insert({
      user_id: access.userId,
      title: parsed.data.title,
      body: parsed.data.body || null,
      theme: parsed.data.theme ?? 'hope',
      status: 'active',
      verse_id: parsed.data.verse_id ?? null,
    })
    .select(PRAYER_INTENTION_SELECT)
    .single();

  if (error || !data) return fail('Could not create prayer intention', 500, error?.message);
  return ok(data, { status: 201 });
}
