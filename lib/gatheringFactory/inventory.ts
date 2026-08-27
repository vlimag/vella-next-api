import { createHash } from 'node:crypto';
import {
  GATHERING_LOCALES,
  GATHERING_THEME_KEYS,
  type GeneratedGathering,
  type GatheringLocale,
} from './contracts';
import {
  GatheringFactoryError,
  generateGatheringDraft,
  resolveCanonicalScripture,
  reviewGatheringDraft,
  type CanonicalScripture,
} from './openai';
import { candidateContentHash, validateGatheringCandidate } from './validators';

export type SlotType = 'monday' | 'thursday';
export type GatheringSlot = { weekStart: string; slotType: SlotType };
export type ThemeMetric = {
  themeKey: GeneratedGathering['theme_key'];
  starts: number;
  completions: number;
};
export type FactoryTelemetry = { eventName: string; state: 'started' | 'succeeded' | 'failed' | 'skipped' };
export type IncidentSink = {
  report: (incident: { severity: 'warning' | 'critical'; code: string; inventoryDepth: number; slot?: GatheringSlot }) => Promise<void>;
};

export type FactoryRepository = {
  tryLock: () => Promise<string | null>;
  unlock: (token: string) => Promise<void>;
  listFutureSlots: (now: Date) => Promise<readonly GatheringSlot[]>;
  listRecentReleases: () => Promise<readonly { published_at: string; content: GeneratedGathering }[]>;
  listThemeMetrics: () => Promise<readonly ThemeMetric[]>;
  hasPublishedEvergreenFallbacks: (keys: readonly string[]) => Promise<boolean>;
  createRun: (slot: GatheringSlot, attempt: 1 | 2) => Promise<{ id: string }>;
  completeRun: (runId: string, outcome: { state: 'published' | 'failed'; code?: string; contentHash?: string; requestHash?: string; inputTokens?: number; outputTokens?: number }) => Promise<void>;
  publish: (input: {
    slot: GatheringSlot;
    runId: string;
    content: GeneratedGathering;
    contentHash: string;
    scriptureByLocale: Record<GatheringLocale, Pick<CanonicalScripture, 'id'>>;
  }) => Promise<{ releaseId: string; published: boolean }>;
  recordEvent: (event: { eventName: string; state: 'started' | 'succeeded' | 'failed' | 'skipped'; slot?: GatheringSlot; code?: string }) => Promise<void>;
  writeHeartbeat: (input: { state: 'healthy' | 'degraded' | 'failed'; inventoryDepth: number; code?: string; releaseId?: string }) => Promise<void>;
};

export type FactoryRunResult = {
  status: 'completed' | 'locked' | 'disabled';
  planned: number;
  published: number;
  rejected: number;
  futureInventory: number;
  lastReleaseId?: string;
  telemetry: FactoryTelemetry[];
};

export type RunGatheringFactoryDeps = {
  repository: FactoryRepository;
  now: () => Date;
  apiKey?: string;
  fetch?: typeof fetch;
  dryRun?: boolean;
  maxSlots?: number;
  killSwitch?: boolean;
  evergreenFallbacks?: readonly { key: string; slotType: SlotType; reviewed: boolean }[];
  incidentSink?: IncidentSink;
  generate?: (input: { themeKey: GeneratedGathering['theme_key']; slotType: SlotType }) => Promise<GeneratedGathering | GeneratedResult>;
  review?: (draft: GeneratedGathering) => Promise<void | { inputTokens: number; outputTokens: number }>;
  resolveScripture?: (reference: string) => Promise<Record<GatheringLocale, Pick<CanonicalScripture, 'id'>>>;
};

const TARGET_INVENTORY = 12;
const WARNING_INVENTORY = 6;
const CRITICAL_INVENTORY = 2;

export function planMissingSlots(now: Date, existing: readonly GatheringSlot[]): GatheringSlot[] {
  const present = new Set(existing.map((slot) => `${slot.weekStart}:${slot.slotType}`));
  const needed = Math.max(0, TARGET_INVENTORY - present.size);
  const slots: GatheringSlot[] = [];
  const date = utcDate(now);
  const daysToMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysToMonday);

  for (let week = 0; slots.length < needed && week < 12; week += 1) {
    const weekStart = dateString(addDays(date, week * 7));
    for (const slotType of ['monday', 'thursday'] as const) {
      if (!present.has(`${weekStart}:${slotType}`)) slots.push({ weekStart, slotType });
      if (slots.length === needed) break;
    }
  }
  return slots;
}

export function chooseTheme(metrics: readonly ThemeMetric[]): GeneratedGathering['theme_key'] {
  const byTheme = new Map(metrics.map((metric) => [metric.themeKey, metric]));
  const normalized = GATHERING_THEME_KEYS.map((themeKey) => byTheme.get(themeKey) ?? ({
    themeKey,
    starts: 0,
    completions: 0,
  }));
  const totalStarts = normalized.reduce((total, metric) => total + Math.max(0, metric.starts), 0);
  const allCandidatesMature = normalized.every((metric) => metric.starts >= 30);

  if (!allCandidatesMature || totalStarts < 100) {
    return normalized.reduce((best, metric) => metric.starts < best.starts
      || (metric.starts === best.starts && metric.themeKey < best.themeKey) ? metric : best).themeKey;
  }
  return normalized.reduce((best, metric) => smoothedScore(metric) > smoothedScore(best)
    || (smoothedScore(metric) === smoothedScore(best) && metric.themeKey < best.themeKey) ? metric : best).themeKey;
}

export async function runGatheringFactory(deps: RunGatheringFactoryDeps): Promise<FactoryRunResult> {
  const telemetry: FactoryTelemetry[] = [];
  if (deps.dryRun) {
    const existing = await deps.repository.listFutureSlots(deps.now());
    const maxSlots = clamp(deps.maxSlots ?? TARGET_INVENTORY, 0, TARGET_INVENTORY);
    return {
      status: 'completed',
      planned: planMissingSlots(deps.now(), existing).slice(0, maxSlots).length,
      published: 0,
      rejected: 0,
      futureInventory: existing.length,
      telemetry,
    };
  }
  const track = async (eventName: string, state: FactoryTelemetry['state'], slot?: GatheringSlot, code?: string) => {
    telemetry.push({ eventName, state });
    try {
      await deps.repository.recordEvent({ eventName: databaseEvent(eventName), state, slot, code });
    } catch {
      // Operational delivery never blocks generation or publication.
    }
  };
  const leaseToken = await deps.repository.tryLock();
  if (!leaseToken) return { status: 'locked', planned: 0, published: 0, rejected: 0, futureInventory: 0, telemetry };

  let published = 0;
  let rejected = 0;
  let inventoryDepth = 0;
  let lastReleaseId: string | undefined;
  try {
    await track('run_started', 'started');
    const existing = await deps.repository.listFutureSlots(deps.now());
    inventoryDepth = existing.length;
    await track('inventory_checked', 'succeeded');
    await reportInventory(deps, inventoryDepth);

    const requested = planMissingSlots(deps.now(), existing);
    const maxSlots = clamp(deps.maxSlots ?? TARGET_INVENTORY, 0, TARGET_INVENTORY);
    const slots = requested.slice(0, maxSlots);
    if (deps.killSwitch) {
      await track('run_disabled', 'skipped');
      await heartbeat(deps, telemetry, 'degraded', inventoryDepth, 'kill_switch');
      return { status: 'disabled', planned: 0, published: 0, rejected: 0, futureInventory: inventoryDepth, telemetry };
    }

    const metrics = await deps.repository.listThemeMetrics();
    const recent = await deps.repository.listRecentReleases();
    for (const slot of slots) {
      const themeKey = chooseTheme(metrics);
      const outcome = await generateSlot(deps, slot, themeKey, recent, inventoryDepth, track);
      if (outcome.status === 'published') {
        published += 1;
        inventoryDepth += 1;
        lastReleaseId = outcome.releaseId;
      } else if (outcome.status === 'rejected') {
        rejected += 1;
      }
    }
    await heartbeat(deps, telemetry, rejected > 0 ? 'degraded' : 'healthy', inventoryDepth, rejected > 0 ? 'generation_failed' : undefined, lastReleaseId);
    await track('run_completed', 'succeeded');
    return { status: 'completed', planned: slots.length, published, rejected, futureInventory: inventoryDepth, lastReleaseId, telemetry };
  } catch {
    await heartbeat(deps, telemetry, 'failed', inventoryDepth, 'factory_failed');
    await track('run_completed', 'failed', undefined, 'factory_failed');
    return { status: 'completed', planned: 0, published, rejected: rejected + 1, futureInventory: inventoryDepth, telemetry };
  } finally {
    try {
      await deps.repository.unlock(leaseToken);
    } catch {
      // The database session releases a leaked advisory lock when it closes.
    }
  }
}

async function generateSlot(
  deps: RunGatheringFactoryDeps,
  slot: GatheringSlot,
  themeKey: GeneratedGathering['theme_key'],
  recent: readonly { published_at: string; content: GeneratedGathering }[],
  inventoryDepth: number,
  track: (eventName: string, state: FactoryTelemetry['state'], slot?: GatheringSlot, code?: string) => Promise<void>,
): Promise<{ status: 'published'; releaseId: string } | { status: 'rejected' }> {
  for (const attempt of [1, 2] as const) {
    const run = await deps.repository.createRun(slot, attempt);
    try {
      await track('generation_started', 'started', slot);
      const generated = await generate(deps, { themeKey, slotType: slot.slotType });
      const candidate = generated.draft;
      const validation = validateGatheringCandidate(candidate, { recentReleases: recent });
      if (!validation.ok) throw new GatheringFactoryError('draft_schema_invalid');
      await track('validation_succeeded', 'succeeded', slot);
      const reviewUsage = await review(deps, candidate);
      await track('review_succeeded', 'succeeded', slot);
      const scriptureByLocale = await resolveScripture(deps, candidate.scripture_reference);
      const contentHash = candidateContentHash(candidate);
      const release = await deps.repository.publish({ slot, runId: run.id, content: candidate, contentHash, scriptureByLocale });
      if (!release.published) throw new GatheringFactoryError('openai_http');
      await deps.repository.completeRun(run.id, { state: 'published', contentHash, requestHash: generated.requestHash, inputTokens: generated.inputTokens + reviewUsage.inputTokens, outputTokens: generated.outputTokens + reviewUsage.outputTokens });
      await track('publish_succeeded', 'succeeded', slot);
      return { status: 'published', releaseId: release.releaseId };
    } catch (error) {
      const code = safeCode(error);
      await deps.repository.completeRun(run.id, { state: 'failed', code });
      await track('generation_failed', 'failed', slot, code);
      if (attempt === 1) {
        await track('retry_scheduled', 'succeeded', slot, code);
        continue;
      }
      await safelyReport(deps.incidentSink, { severity: 'critical', code: 'generation_failed', inventoryDepth, slot });
      return { status: 'rejected' };
    }
  }
  return { status: 'rejected' };
}

type GeneratedResult = { draft: GeneratedGathering; inputTokens: number; outputTokens: number; requestHash?: string };

async function generate(deps: RunGatheringFactoryDeps, input: { themeKey: GeneratedGathering['theme_key']; slotType: SlotType }): Promise<GeneratedResult> {
  if (deps.generate) return normalizeGenerated(await deps.generate(input));
  if (!deps.apiKey) throw new GatheringFactoryError('openai_http');
  const result = await generateGatheringDraft(input, {
    fetch: deps.fetch ?? fetch,
    apiKey: deps.apiKey,
    now: deps.now,
    timeoutMs: 45_000,
    maxInputTokens: 20_000,
    maxOutputTokens: 10_000,
  });
  return { draft: result.draft, inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens, requestHash: hash(result.request) };
}

async function review(deps: RunGatheringFactoryDeps, candidate: GeneratedGathering): Promise<{ inputTokens: number; outputTokens: number }> {
  if (deps.review) return (await deps.review(candidate)) ?? { inputTokens: 0, outputTokens: 0 };
  if (!deps.apiKey) throw new GatheringFactoryError('openai_http');
  const result = await reviewGatheringDraft(candidate, {
    fetch: deps.fetch ?? fetch,
    apiKey: deps.apiKey,
    now: deps.now,
    timeoutMs: 45_000,
    maxInputTokens: 20_000,
    maxOutputTokens: 10_000,
  });
  return result.usage;
}

async function resolveScripture(deps: RunGatheringFactoryDeps, reference: string) {
  if (deps.resolveScripture) return deps.resolveScripture(reference);
  return resolveCanonicalScripture(reference, {
    findApprovedByReference: async () => { throw new GatheringFactoryError('canonical_scripture_query_failed'); },
  });
}

async function reportInventory(deps: RunGatheringFactoryDeps, inventoryDepth: number) {
  const fallbackKeys = deps.evergreenFallbacks?.map((fallback) => fallback.key) ?? [];
  const hasFallbacks = fallbackKeys.length > 0 && await deps.repository.hasPublishedEvergreenFallbacks(fallbackKeys);
  if (inventoryDepth < CRITICAL_INVENTORY && !hasFallbacks) {
    await safelyReport(deps.incidentSink, { severity: 'critical', code: 'inventory_critical', inventoryDepth });
  } else if (inventoryDepth < WARNING_INVENTORY) {
    await safelyReport(deps.incidentSink, { severity: 'warning', code: 'inventory_low', inventoryDepth });
  }
}

async function heartbeat(
  deps: RunGatheringFactoryDeps,
  telemetry: FactoryTelemetry[],
  state: 'healthy' | 'degraded' | 'failed',
  inventoryDepth: number,
  code?: string,
  releaseId?: string,
) {
  try {
    await deps.repository.writeHeartbeat({ state, inventoryDepth, code, releaseId });
    telemetry.push({ eventName: 'heartbeat_written', state: 'succeeded' });
  } catch {
    telemetry.push({ eventName: 'heartbeat_written', state: 'failed' });
  }
}

async function safelyReport(sink: IncidentSink | undefined, incident: Parameters<IncidentSink['report']>[0]) {
  try {
    await sink?.report(incident);
  } catch {
    // Alert delivery is deliberately decoupled from content publication.
  }
}

function databaseEvent(eventName: string) {
  const map: Record<string, string> = {
    inventory_checked: 'inventory_checked', generation_started: 'generation_started', generation_failed: 'generation_finished',
    validation_succeeded: 'validation_finished', review_succeeded: 'review_finished', publish_succeeded: 'publish_finished',
    retry_scheduled: 'retry_scheduled', heartbeat_written: 'heartbeat_recorded', run_started: 'inventory_checked',
    run_completed: 'inventory_checked', run_disabled: 'inventory_checked',
  };
  return map[eventName] ?? 'inventory_checked';
}

function smoothedScore(metric: ThemeMetric) { return (metric.completions + 1) / (metric.starts + 2); }
function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.floor(value) : max)); }
function utcDate(date: Date) { return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); }
function addDays(date: Date, days: number) { const result = new Date(date); result.setUTCDate(result.getUTCDate() + days); return result; }
function dateString(date: Date) { return date.toISOString().slice(0, 10); }
function safeCode(error: unknown) {
  return error instanceof GatheringFactoryError ? error.code : 'generation_failed';
}
function normalizeGenerated(value: GeneratedGathering | GeneratedResult): GeneratedResult {
  return 'draft' in value ? value : { draft: value, inputTokens: 0, outputTokens: 0 };
}
function hash(value: unknown) { return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex'); }
