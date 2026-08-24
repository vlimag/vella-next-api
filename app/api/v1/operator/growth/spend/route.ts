import { z } from 'zod';
import { fail, ok } from '@/lib/http';
import { requireOperatorAccess } from '@/lib/operatorAuth';
import { createServiceClient } from '@/lib/supabase';

const MAX_SPEND_REQUEST_BYTES = 24 * 1024;

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Invalid calendar date');
const sourceSchema = z.string().trim().min(1).max(32)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/)
  .transform((value) => value.toLowerCase());
const campaignSchema = z.string().trim().min(1).max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._~-]*$/)
  .transform((value) => value.toLowerCase());

const bodySchema = z.object({
  items: z.array(z.object({
    date: dateSchema,
    source: sourceSchema,
    campaign: campaignSchema,
    currency: z.literal('BRL'),
    spend_cents: z.number().int().min(0).max(1_000_000_000_000),
  }).strict()).min(1).max(100),
}).strict();

export async function POST(req: Request) {
  const operator = requireOperatorAccess(req);
  if ('response' in operator) return operator.response;

  if (!req.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return fail('Content-Type must be application/json', 415, { code: 'content_type_required' });
  }
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SPEND_REQUEST_BYTES) {
    return fail('Spend request is too large', 413, { code: 'request_too_large' });
  }

  const text = await req.text().catch(() => '');
  if (Buffer.byteLength(text, 'utf8') > MAX_SPEND_REQUEST_BYTES) {
    return fail('Spend request is too large', 413, { code: 'request_too_large' });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail('Invalid campaign spend input', 400, { code: 'invalid_json' });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return fail('Invalid campaign spend input', 400, parsed.error.flatten());
  }

  // Last value wins for duplicate keys in one request, while database upsert
  // makes retries idempotent.
  const uniqueItems = new Map<string, (typeof parsed.data.items)[number]>();
  for (const item of parsed.data.items) {
    uniqueItems.set(`${item.date}\u0000${item.source}\u0000${item.campaign}\u0000${item.currency}`, item);
  }
  const rows = [...uniqueItems.values()].map((item) => ({
    spend_date: item.date,
    source: item.source,
    campaign: item.campaign,
    currency: item.currency,
    spend_cents: item.spend_cents,
  }));

  const supabase = createServiceClient();
  const { error } = await supabase.from('growth_campaign_spend_daily').upsert(rows, {
    onConflict: 'spend_date,source,campaign,currency',
  });
  if (error) {
    console.error('[growth-analytics] spend_upsert_failed', {
      errorCode: typeof error.code === 'string' ? error.code : 'unknown',
      itemCount: rows.length,
    });
    return fail('Could not save campaign spend', 503, { code: 'growth_spend_unavailable' });
  }

  return ok({ saved: rows.length }, { headers: { 'Cache-Control': 'no-store' } });
}
