import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';

const querySchema = z.object({
  lang: localeSchema.optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    lang: searchParams.get('lang') ?? undefined,
  });

  if ('error' in parsed) return parsed.error;

  const lang = parsed.data.lang ?? 'en';

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('reading_plans')
    .select('id, slug, title, description, language_code, duration_days, is_premium')
    .eq('language_code', lang)
    .eq('is_published', true)
    .order('duration_days', { ascending: true });

  if (error) return fail('Could not load plans', 500, error.message);

  return ok(data);
}
