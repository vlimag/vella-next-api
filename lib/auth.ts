import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase';

type AuthError = { error: string };
type AuthSuccess = { userId: string };

export async function getUserIdFromAuthHeader(): Promise<AuthError | AuthSuccess> {
  const authHeader = (await headers()).get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing bearer token' };
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const supabase = createServiceClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { error: 'Invalid auth token' };
  }

  return { userId: data.user.id };
}
