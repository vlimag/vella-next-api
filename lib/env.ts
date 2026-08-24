type RequiredEnv =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'SUPABASE_SERVICE_ROLE_KEY'
  | 'SUPABASE_ANON_KEY'
  | 'SUPABASE_DB_SCHEMA';

export function getEnv(key: RequiredEnv): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}
