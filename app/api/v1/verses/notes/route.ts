import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { authenticatedJourneyActor } from '@/lib/actor';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const bodySchema = z.object({
  verse_id: z.string().uuid().optional(),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(2500),
});

export async function GET(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    limit: searchParams.get('limit') ?? undefined,
  });
  if ('error' in parsed) return parsed.error;

  const actor = authenticatedJourneyActor(access.userId);
  const supabase = createServiceClient();

  let query = supabase
    .from('verse_notes')
    .select(
      'id, verse_id, title, body, created_at, updated_at, bible_verses(id, chapter, verse, text_content, language_code, bible_books(code))',
    )
    .order('created_at', { ascending: false })
    .limit(parsed.data.limit ?? 50);

  if (actor.kind === 'user') {
    query = query.eq('user_id', actor.userId);
  } else {
    query = query.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data, error } = await query;
  if (error) return fail('Could not load verse notes', 500, error.message);
  return ok({ items: data ?? [] });
}

export async function POST(req: Request) {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const actor = authenticatedJourneyActor(access.userId);
  const supabase = createServiceClient();

  const payload =
    actor.kind === 'user'
      ? {
          user_id: actor.userId,
          anonymous_profile_id: null,
          verse_id: parsed.data.verse_id ?? null,
          title: parsed.data.title ?? null,
          body: parsed.data.body,
        }
      : {
          user_id: null,
          anonymous_profile_id: actor.anonymousProfileId,
          verse_id: parsed.data.verse_id ?? null,
          title: parsed.data.title ?? null,
          body: parsed.data.body,
        };

  const { data, error } = await supabase
    .from('verse_notes')
    .insert(payload)
    .select('id, verse_id, title, body, created_at, updated_at')
    .single();

  if (error || !data) return fail('Could not save verse note', 500, error?.message);
  return ok(data, { status: 201 });
}
