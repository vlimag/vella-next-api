import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase';

export type JourneyActor =
  | { kind: 'user'; userId: string }
  | { kind: 'anonymous'; deviceId: string; anonymousProfileId: string };

type ActorResult =
  | { actor: JourneyActor }
  | { error: string; status: number };

export async function resolveJourneyActor(allowAnonymous = true): Promise<ActorResult> {
  const supabase = createServiceClient();
  const requestHeaders = await headers();
  const authHeader = requestHeaders.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return { error: 'Invalid auth token', status: 401 };
    }
    return { actor: { kind: 'user', userId: data.user.id } };
  }

  if (!allowAnonymous) {
    return { error: 'Missing bearer token', status: 401 };
  }

  const deviceId = requestHeaders.get('x-device-id')?.trim();
  if (!deviceId) {
    return { error: 'Missing x-device-id header for anonymous actor', status: 401 };
  }

  const { data: anonymousProfile, error: anonymousError } = await supabase
    .from('anonymous_profiles')
    .select('id, device_id')
    .eq('device_id', deviceId)
    .single();

  if (anonymousError || !anonymousProfile) {
    return { error: 'Anonymous profile not found for this device', status: 401 };
  }

  return {
    actor: {
      kind: 'anonymous',
      deviceId,
      anonymousProfileId: anonymousProfile.id,
    },
  };
}

export function ownerFilter(actor: JourneyActor) {
  if (actor.kind === 'user') {
    return { user_id: actor.userId, anonymous_profile_id: null };
  }
  return { user_id: null, anonymous_profile_id: actor.anonymousProfileId };
}
