import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { localeSchema, parseQuery } from '@/lib/validation';

const querySchema = z.object({
  q: z.string().trim().min(2).max(80),
  lang: localeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsed = parseQuery(querySchema, {
    q: searchParams.get('q') ?? '',
    lang: searchParams.get('lang') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  });

  if ('error' in parsed) return parsed.error;

  const lang = parsed.data.lang ?? 'en';
  const limit = parsed.data.limit ?? 30;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bible_verses')
    .select('id, chapter, verse, text_content, language_code, bible_books!inner(code), bible_versions!inner(code, name)')
    .eq('language_code', lang)
    .ilike('text_content', `%${parsed.data.q}%`)
    .limit(limit);

  if (error) return fail('Verse search failed', 500, error.message);

  return ok({ query: parsed.data.q, count: data.length, items: data });
}
