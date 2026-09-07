import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase';

type AuthError = { error: string };
type AuthSuccess = { userId: string; isAnonymous: boolean };
type AuthOptions = { allowAnonymous?: boolean };

async function resolveUserIdFromAuthHeader(options: AuthOptions = {}) {
  const authHeader = (await headers()).get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing bearer token' } as const;
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: 'Invalid auth token' } as const;
  }

  if (data.user.is_anonymous === true && options.allowAnonymous !== true) {
    return { error: 'Anonymous session is not allowed for this endpoint' } as const;
  }

  return {
    userId: data.user.id,
    isAnonymous: data.user.is_anonymous === true,
  } as const;
}

export async function getUserIdFromAuthHeader(
  options: AuthOptions = {},
): Promise<AuthError | AuthSuccess> {
  return resolveUserIdFromAuthHeader(options);
}

export async function getOptionalUserIdFromAuthHeader(options: AuthOptions = {}) {
  const result = await resolveUserIdFromAuthHeader(options);
  if ('userId' in result) {
    return result.userId;
  }
  return null;
}
