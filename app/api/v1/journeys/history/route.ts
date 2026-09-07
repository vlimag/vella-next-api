import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { isStableKey, isStableSlug } from '@/lib/rhythms/contracts';
import { createServiceClient } from '@/lib/supabase';
import { requireActiveSubscription } from '@/lib/subscriptionAccess';

const historyQuerySchema = z.object({
  limit: z.string().regex(/^(?:[1-9]|[1-4]\d|50)$/).transform(Number).optional().default('20'),
  scope: z.enum(['completed', 'all']).optional().default('completed'),
}).strict();
const uuidSchema = z.string().uuid();
const dateSchema = /^\d{4}-\d{2}-\d{2}$/;
const timestampSchema = /^\d{4}-\d{2}-\d{2}T/;

function noStore(response: Response) {
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function boundedText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function historyEntry(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const template = Array.isArray(row.journey_templates) ? row.journey_templates[0] : row.journey_templates;
  if (!template || typeof template !== 'object') return null;
  const templateRow = template as Record<string, unknown>;
  const id = typeof row.id === 'string' && uuidSchema.safeParse(row.id).success ? row.id : null;
  const slug = templateRow.slug;
  const version = templateRow.version;
  const locale = templateRow.language_code;
  const title = boundedText(templateRow.title, 160);
  const summary = boundedText(templateRow.description, 800);
  const startedAt = typeof row.start_date === 'string' && dateSchema.test(row.start_date) ? row.start_date : null;
  const completedAt = typeof row.completed_at === 'string' && timestampSchema.test(row.completed_at) && Number.isFinite(Date.parse(row.completed_at))
    ? row.completed_at : null;
  const status = row.status === 'active' || row.status === 'paused' || row.status === 'completed' ? row.status : null;
  const currentSession = typeof row.current_day === 'number' && Number.isInteger(row.current_day)
    && row.current_day >= 1 && row.current_day <= 1000 ? row.current_day : null;
  const sessionCount = typeof row.total_completed_days === 'number' && Number.isInteger(row.total_completed_days)
    && row.total_completed_days >= 0 && row.total_completed_days <= 1000 ? row.total_completed_days : null;
  if (!id || !isStableSlug(slug) || typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version > 1000
    || typeof locale !== 'string' || !['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'].includes(locale)
    || !title || !summary || !startedAt || !status || currentSession === null || sessionCount === null
    || (status === 'completed' && !completedAt)) return null;
  const themeKeys = Array.isArray(templateRow.theme_tags)
    ? templateRow.theme_tags.filter((key): key is string => isStableKey(key)).slice(0, 12)
    : [];
  return {
    id,
    template_slug: slug,
    template_version: version,
    locale,
    title,
    summary,
    status,
    current_session: currentSession,
    session_count: sessionCount,
    started_at: startedAt,
    completed_at: completedAt,
    theme_keys: themeKeys,
  };
}

export async function GET(request: Request) {
  try {
    const access = await requireActiveSubscription();
    if ('response' in access) return noStore(access.response);

    const params = new URL(request.url).searchParams;
    if (params.getAll('limit').length > 1 || params.getAll('scope').length > 1) {
      return noStore(fail('Invalid request input', 400, { code: 'invalid_history_query' }));
    }
    const parsed = historyQuerySchema.safeParse({
      limit: params.get('limit') ?? undefined,
      scope: params.get('scope') ?? undefined,
    });
    if (!parsed.success) return noStore(fail('Invalid request input', 400, parsed.error.flatten()));

    let historyQuery = createServiceClient()
      .from('user_journeys')
      .select('id, status, current_day, start_date, completed_at, updated_at, total_completed_days, journey_templates!inner(slug, version, language_code, title, description, theme_tags)')
      .eq('user_id', access.userId);
    historyQuery = parsed.data.scope === 'all'
      ? historyQuery.in('status', ['active', 'paused', 'completed']).order('updated_at', { ascending: false })
      : historyQuery.eq('status', 'completed').order('completed_at', { ascending: false });
    const { data, error } = await historyQuery.order('id', { ascending: true }).limit(parsed.data.limit);
    if (error || !Array.isArray(data)) throw new Error('history_query_failed');

    return noStore(ok({ journeys: data.map(historyEntry).filter((entry): entry is NonNullable<typeof entry> => entry !== null) }));
  } catch {
    console.error('[journeys-history]', { route: 'journey_history', stage: 'query', code: 'database_unavailable' });
    return noStore(fail('Could not load journey history', 503, { code: 'journey_history_unavailable' }));
  }
}
