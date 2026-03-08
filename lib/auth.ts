import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase';

type AuthError = { error: string };
type AuthSuccess = { userId: string };

async function resolveUserIdFromAuthHeader() {
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

  return { userId: data.user.id } as const;
}

export async function getUserIdFromAuthHeader(): Promise<AuthError | AuthSuccess> {
  return resolveUserIdFromAuthHeader();
}

export async function getOptionalUserIdFromAuthHeader() {
  const result = await resolveUserIdFromAuthHeader();
  if ('userId' in result) {
    return result.userId;
  }
  return null;
}
