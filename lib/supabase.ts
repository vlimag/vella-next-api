import { createClient } from '@supabase/supabase-js';
import { getEnv } from '@/lib/env';

export function createServiceClient() {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
    db: { schema: getEnv('SUPABASE_DB_SCHEMA') },
  });
}

export function createAnonClient() {
  return createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
    db: { schema: getEnv('SUPABASE_DB_SCHEMA') },
  });
}
