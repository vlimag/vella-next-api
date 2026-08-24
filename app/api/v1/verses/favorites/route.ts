import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { parseQuery } from '@/lib/validation';
import { authenticatedJourneyActor } from '@/lib/actor';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  verse_id: z.string().uuid(),
});

export async function GET() {
  const access = await requireActiveSubscription();
  if ('response' in access) return access.response;

  const actor = authenticatedJourneyActor(access.userId);
  const supabase = createServiceClient();

  let query = supabase
    .from('verse_favorites')
    .select(
      'id, verse_id, created_at, bible_verses!inner(id, chapter, verse, text_content, language_code, bible_books!inner(code))',
    )
    .order('created_at', { ascending: false });

  if (actor.kind === 'user') {
    query = query.eq('user_id', actor.userId);
  } else {
    query = query.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data, error } = await query;
  if (error) return fail('Could not load verse favorites', 500, error.message);
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

  let existingQuery = supabase
    .from('verse_favorites')
    .select('id')
    .eq('verse_id', parsed.data.verse_id);

  if (actor.kind === 'user') {
    existingQuery = existingQuery.eq('user_id', actor.userId);
  } else {
    existingQuery = existingQuery.eq('anonymous_profile_id', actor.anonymousProfileId);
  }

  const { data: existing } = await existingQuery.maybeSingle();

  if (existing?.id) {
    const { error: deleteError } = await supabase
      .from('verse_favorites')
      .delete()
      .eq('id', existing.id);
    if (deleteError) return fail('Could not remove favorite', 500, deleteError.message);
    return ok({ verse_id: parsed.data.verse_id, favorited: false });
  }

  const insertPayload =
    actor.kind === 'user'
      ? {
          user_id: actor.userId,
          anonymous_profile_id: null,
          verse_id: parsed.data.verse_id,
        }
      : {
          user_id: null,
          anonymous_profile_id: actor.anonymousProfileId,
          verse_id: parsed.data.verse_id,
        };

  const { error: insertError } = await supabase
    .from('verse_favorites')
    .insert(insertPayload);

  if (insertError) return fail('Could not add favorite', 500, insertError.message);
  return ok({ verse_id: parsed.data.verse_id, favorited: true }, { status: 201 });
}
