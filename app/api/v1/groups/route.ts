import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const bodySchema = z.object({
  name: z.string().trim().min(3).max(80),
  description: z.string().trim().max(240).optional(),
  language_code: localeSchema.optional(),
});

function newInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function GET() {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('group_members')
    .select('role, joined_at, groups!inner(id, name, description, language_code, invite_code)')
    .eq('user_id', auth.userId)
    .order('joined_at', { ascending: false });

  if (error) return fail('Could not load groups', 500, error.message);

  return ok(data);
}

export async function POST(req: Request) {
  const auth = await requireActiveSubscription();
  if ('response' in auth) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();

  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      owner_user_id: auth.userId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      language_code: parsed.data.language_code ?? 'en',
      invite_code: newInviteCode(),
    })
    .select('id, name, description, language_code, invite_code')
    .single();

  if (groupError || !group) {
    return fail('Could not create group', 500, groupError?.message);
  }

  const { error: memberError } = await supabase.from('group_members').insert({
    group_id: group.id,
    user_id: auth.userId,
    role: 'owner',
  });

  if (memberError) return fail('Group created but owner membership failed', 500, memberError.message);

  return ok(group, { status: 201 });
}
