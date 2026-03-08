import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { getUserIdFromAuthHeader } from '@/lib/auth';
import { parseQuery } from '@/lib/validation';
import { ensureSocialProfile } from '@/lib/social';

const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/);

const bodySchema = z.object({
  handle: handleSchema.optional(),
  display_name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(280).optional(),
  allow_mentions: z.boolean().optional(),
});

export async function GET() {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const supabase = createServiceClient();
  await ensureSocialProfile(supabase, auth.userId);

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, handle, display_name, bio, avatar_url, allow_mentions, is_private, created_at, updated_at')
    .eq('user_id', auth.userId)
    .single();

  if (error || !data) return fail('Could not load social profile', 500, error?.message);
  return ok(data);
}

export async function POST(req: Request) {
  const auth = await getUserIdFromAuthHeader();
  if (!('userId' in auth)) return fail(auth.error, 401);

  const body = await req.json().catch(() => null);
  const parsed = parseQuery(bodySchema, body);
  if ('error' in parsed) return parsed.error;

  const supabase = createServiceClient();
  await ensureSocialProfile(supabase, auth.userId);

  const payload: Record<string, unknown> = {};
  if (parsed.data.handle !== undefined) payload.handle = parsed.data.handle;
  if (parsed.data.display_name !== undefined) payload.display_name = parsed.data.display_name;
  if (parsed.data.bio !== undefined) payload.bio = parsed.data.bio.length > 0 ? parsed.data.bio : null;
  if (parsed.data.allow_mentions !== undefined) payload.allow_mentions = parsed.data.allow_mentions;

  if (Object.keys(payload).length === 0) {
    return fail('No profile fields provided', 400);
  }

  const { data, error } = await supabase
    .from('social_profiles')
    .update(payload)
    .eq('user_id', auth.userId)
    .select('user_id, handle, display_name, bio, avatar_url, allow_mentions, is_private, created_at, updated_at')
    .single();

  if (error || !data) {
    const handleConflict = error?.message?.toLowerCase().includes('duplicate key');
    if (handleConflict) return fail('This handle is already taken', 409);
    return fail('Could not update social profile', 500, error?.message);
  }

  return ok(data);
}
