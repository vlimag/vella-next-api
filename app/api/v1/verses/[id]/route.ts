import { z } from 'zod';
import { ok, fail } from '@/lib/http';
import { createServiceClient } from '@/lib/supabase';
import { resolveReadOnlyContentViewer } from '@/lib/subscriptionAccess';

const paramsSchema = z.object({ id: z.string().uuid() });

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_req: Request, { params }: RouteParams) {
  const access = await resolveReadOnlyContentViewer();
  if ('response' in access) return access.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return fail('Invalid verse identifier', 400);

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('bible_verses')
    .select('id, chapter, verse, text_content, language_code, bible_books!inner(code), bible_versions!inner(is_active)')
    .eq('id', parsed.data.id)
    .eq('bible_versions.is_active', true)
    .maybeSingle();

  if (error) return fail('Could not load verse', 500, error.message);
  if (!data) return fail('Verse not found', 404);
  return ok(data);
}
