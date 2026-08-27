import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase';
import { runGatheringFactory, type FactoryRepository, type IncidentSink, type SlotType } from '@/lib/gatheringFactory/inventory';
import type { GeneratedGathering, GatheringLocale } from '@/lib/gatheringFactory/contracts';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const bodySchema = z.object({
  dry_run: z.boolean(),
  max_slots: z.number().int().min(1).max(12),
  evergreen_fallbacks: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9-]{0,80}$/),
    slot_type: z.enum(['monday', 'thursday']),
    reviewed: z.literal(true),
  }).strict()).max(12),
}).strict();

type Supabase = {
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  from: (table: string) => any;
};

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = await parseBody(request);
  if (!parsed) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  return execute(parsed);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return execute({ dry_run: false, max_slots: 12, evergreen_fallbacks: [] });
}

async function execute(parsed: z.infer<typeof bodySchema>) {
  if (!process.env.OPENAI_API_KEY && !parsed.dry_run) return NextResponse.json({ error: 'Unavailable' }, { status: 503 });

  try {
    const client = createServiceClient() as unknown as Supabase;
    const result = await runGatheringFactory({
      repository: repository(client),
      incidentSink: incidentSink(client),
      now: () => new Date(),
      apiKey: process.env.OPENAI_API_KEY,
      dryRun: parsed.dry_run,
      maxSlots: parsed.max_slots,
      killSwitch: process.env.GATHERING_FACTORY_DISABLED === 'true',
      evergreenFallbacks: parsed.evergreen_fallbacks.map((fallback) => ({ key: fallback.key, slotType: fallback.slot_type, reviewed: fallback.reviewed })),
      resolveScripture: (reference) => resolveScripture(client, reference),
    });
    return NextResponse.json({ planned: result.planned, published: result.published, rejected: result.rejected, future_inventory: result.futureInventory });
  } catch {
    return NextResponse.json({ error: 'Unavailable' }, { status: 503 });
  }
}

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (!expected || !authorization?.startsWith('Bearer ')) return false;
  const provided = authorization.slice('Bearer '.length);
  return timingSafeEqual(secretDigest(provided), secretDigest(expected));
}

function secretDigest(value: string) { return createHash('sha256').update(value).digest(); }

async function parseBody(request: Request) {
  try { return bodySchema.safeParse(await request.json()).data ?? null; } catch { return null; }
}

function repository(client: Supabase): FactoryRepository {
  return {
    tryLock: async () => (await rpc(client, 'gathering_factory_claim_lease') as { token?: string }[] | null)?.[0]?.token ?? null,
    unlock: async (token) => { await rpc(client, 'gathering_factory_release_lease', { p_token: token }); },
    listFutureSlots: async (now) => {
      const result = await client.from('gathering_releases').select('release_week,slot_type')
        .eq('status', 'published').gte('release_week', now.toISOString().slice(0, 10));
      if (result.error) throw new Error('db');
      return (result.data ?? []).flatMap((row: { release_week: string | null; slot_type: string }) => row.release_week && (row.slot_type === 'monday' || row.slot_type === 'thursday')
        ? [{ weekStart: row.release_week, slotType: row.slot_type }] : []);
    },
    listRecentReleases: async () => {
      const result = await client.from('gathering_releases').select('published_at,content').eq('status', 'published').not('content', 'is', null).order('published_at', { ascending: false }).limit(12);
      if (result.error) throw new Error('db');
      return (result.data ?? []).flatMap((row: { published_at: string | null; content: unknown }) => typeof row.published_at === 'string'
        ? [{ published_at: row.published_at, content: row.content as GeneratedGathering }] : []);
    },
    listThemeMetrics: async () => {
      const rows = await rpc(client, 'gathering_factory_theme_metrics') as { theme_key: GeneratedGathering['theme_key']; starts: number; completions: number }[] | null;
      return (rows ?? []).map((row) => ({ themeKey: row.theme_key, starts: row.starts, completions: row.completions }));
    },
    hasPublishedEvergreenFallbacks: async (keys) => {
      const result = await client.from('gathering_releases').select('catalog_code').eq('status', 'published').eq('source_kind', 'evergreen').in('catalog_code', keys);
      if (result.error) throw new Error('db');
      return (result.data ?? []).length === keys.length;
    },
    createRun: async (slot, attempt) => {
      const result = await client.from('gathering_generation_runs').insert({
        target_week: slot.weekStart, slot_type: slot.slotType, attempt, lifecycle_state: 'started',
        model_identifier: 'gpt-5.6-sol', prompt_revision: 'gathering-factory.1', validation_result: 'pending', reviewer_result: 'pending',
      }).select('id').single();
      if (result.error || !result.data?.id) throw new Error('db');
      return { id: result.data.id as string };
    },
    completeRun: async (runId, outcome) => {
      const result = await client.from('gathering_generation_runs').update({ lifecycle_state: outcome.state, request_hash: outcome.requestHash ?? null, response_hash: outcome.contentHash ?? null, input_tokens: outcome.inputTokens ?? 0, output_tokens: outcome.outputTokens ?? 0, safe_error_code: outcome.code ?? null, completed_at: new Date().toISOString(), validation_result: outcome.state === 'published' ? 'accepted' : 'rejected', reviewer_result: outcome.state === 'published' ? 'approved' : 'not_run' }).eq('id', runId);
      if (result.error) throw new Error('db');
    },
    publish: async (input) => {
      const ids = Object.fromEntries(Object.entries(input.scriptureByLocale).map(([locale, scripture]) => [locale, scripture.id]));
      const row = await rpc(client, 'publish_generated_gathering', { p_release_week: input.slot.weekStart, p_slot_type: input.slot.slotType, p_generation_run_id: input.runId, p_content_hash: input.contentHash, p_content: input.content, p_scripture_ids: ids }) as { release_id: string; published: boolean }[] | null;
      if (!row?.[0]) throw new Error('db');
      return { releaseId: row[0].release_id, published: row[0].published };
    },
    recordEvent: async (event) => { await client.from('gathering_operational_events').insert({ event_name: event.eventName, event_state: event.state, slot_type: event.slot?.slotType ?? null, safe_error_code: event.code ?? null }); },
    writeHeartbeat: async (input) => { await client.from('gathering_automation_heartbeats').insert({ heartbeat_source: 'vercel_cron', heartbeat_state: input.state, inventory_depth: input.inventoryDepth, safe_error_code: input.code ?? null, last_successful_release_id: input.releaseId ?? null }); },
  };
}

function incidentSink(client: Supabase): IncidentSink {
  return { report: async (incident) => {
    await client.from('gathering_generation_incidents').upsert({ incident_key: `factory.${incident.code}.${incident.slot?.weekStart ?? 'inventory'}`, incident_type: incident.code === 'generation_failed' ? 'generation_failed' : 'inventory_low', incident_state: 'open', safe_error_code: incident.code, inventory_depth: incident.inventoryDepth }, { onConflict: 'incident_key' });
  } };
}

async function resolveScripture(client: Supabase, reference: string): Promise<Record<GatheringLocale, { id: string }>> {
  const rows = await rpc(client, 'gathering_factory_resolve_scripture', { p_reference: reference }) as { id: string; locale: GatheringLocale; text: string }[] | null;
  const resolved = new Map((rows ?? []).filter((row) => row.id && row.text?.trim()).map((row) => [row.locale, { id: row.id }]));
  const locales: GatheringLocale[] = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl'];
  if (locales.some((locale) => !resolved.has(locale))) throw new Error('canonical_scripture_missing');
  return Object.fromEntries(locales.map((locale) => [locale, resolved.get(locale)!])) as Record<GatheringLocale, { id: string }>;
}

async function rpc(client: Supabase, name: string, args?: Record<string, unknown>) {
  const result = await client.rpc(name, args);
  if (result.error) throw new Error('db');
  return result.data;
}
