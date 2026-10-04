import { LOCALES, STORE_CAMPAIGN, storeCtaId, type Locale, type StoreCtaPlacement } from './config';

export type WebGrowthEvent = {
  event_id: string;
  install_id: string;
  session_id: string;
  occurred_at: string;
  event_name: 'landing_viewed' | 'store_cta_clicked';
  platform: 'web';
  app_version: 'site';
  locale: Locale;
  properties: { source?: string; medium?: string; campaign?: string; content?: string; cta_id?: string; store?: 'android' | 'ios' };
};

export const WEB_GROWTH_STORAGE_KEY = 'vella.web-growth.outbox.v1';
const MAX_EVENTS = 20;
const MAX_BYTES = 65_536;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const SOURCES = new Set(['direct', 'search', 'social', 'referral', 'internal']);
const ROUTES = new Set(['home', 'features', 'prayer_space', 'blog_index', 'blog_article', 'support', 'legal', 'other']);
const PLACEMENTS: StoreCtaPlacement[] = ['hero', 'header-desktop', 'header-mobile', 'home-download', 'prayer-space', 'blog-article'];
const EVENT_KEYS = new Set(['event_id', 'install_id', 'session_id', 'occurred_at', 'event_name', 'platform', 'app_version', 'locale', 'properties']);
const PROPERTY_KEYS = new Set(['source', 'medium', 'campaign', 'content', 'cta_id', 'store']);

export function isKnownStoreCta(id: unknown, store: 'android' | 'ios'): id is string {
  return PLACEMENTS.some((placement) => id === storeCtaId(placement, store));
}

// Cached browser data is untrusted. Only our fixed coarse vocabulary may be sent.
function validEvent(value: unknown): value is WebGrowthEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  if (Object.keys(event).some((key) => !EVENT_KEYS.has(key))) return false;
  if (![event.event_id, event.install_id, event.session_id].every((id) => typeof id === 'string' && UUID.test(id))) return false;
  if (event.install_id !== event.session_id || event.platform !== 'web' || event.app_version !== 'site') return false;
  if (!LOCALES.includes(event.locale as Locale) || typeof event.occurred_at !== 'string') return false;
  // Date.parse accepts comments and human-readable dates. Never transmit those
  // strings from untrusted storage: our producer only emits canonical ISO UTC.
  if (event.occurred_at.length !== 24) return false;
  const occurredAt = Date.parse(event.occurred_at);
  const age = Date.now() - occurredAt;
  if (!Number.isFinite(age) || age < -300_000 || age > MAX_AGE_MS || new Date(occurredAt).toISOString() !== event.occurred_at) return false;
  const properties = event.properties;
  if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return false;
  const p = properties as Record<string, unknown>;
  if (Object.keys(p).some((key) => !PROPERTY_KEYS.has(key))) return false;
  if (!SOURCES.has(p.source as string) || p.medium !== 'website' || p.campaign !== STORE_CAMPAIGN || !ROUTES.has(p.content as string)) return false;
  if (event.event_name === 'landing_viewed') return p.cta_id === undefined && p.store === undefined;
  return event.event_name === 'store_cta_clicked' && (p.store === 'android' || p.store === 'ios') && isKnownStoreCta(p.cta_id, p.store);
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type Sender = (events: WebGrowthEvent[]) => Promise<{ ok: boolean; status: number }>;

export function createWebGrowthQueue(storage: Storage | undefined, send: Sender) {
  let queue: WebGrowthEvent[] = [];
  let flushing = false;
  const persist = () => {
    try { storage?.setItem(WEB_GROWTH_STORAGE_KEY, JSON.stringify(queue)); } catch { /* Storage may be disabled or full. */ }
  };
  try {
    const raw = storage?.getItem(WEB_GROWTH_STORAGE_KEY);
    const parsed: unknown = raw && raw.length <= MAX_BYTES ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      const unique = new Map<string, WebGrowthEvent>();
      for (const event of parsed) if (validEvent(event)) unique.set(event.event_id, event);
      queue = [...unique.values()].slice(-MAX_EVENTS);
    }
  } catch { /* A damaged cache must never affect navigation. */ }
  persist();

  return {
    enqueue(event: WebGrowthEvent) {
      if (!validEvent(event) || queue.some((item) => item.event_id === event.event_id)) return;
      queue = [...queue.filter(validEvent), event].slice(-MAX_EVENTS);
      persist();
    },
    async flush() {
      if (flushing) return;
      flushing = true;
      try {
        queue = queue.filter(validEvent);
        persist();
        while (queue.length) {
          // The API rejects mixed install IDs. A restored tab can contain an older
          // page session alongside the freshly created one after a full reload.
          const batch = queue.filter((event) => event.install_id === queue[0]!.install_id);
          const response = await send(batch);
          // Retain failures for the next online/visible/page lifecycle event.
          if (!response.ok) break;
          const delivered = new Set(batch.map((event) => event.event_id));
          queue = queue.filter((event) => !delivered.has(event.event_id));
          persist();
          // A click enqueued during the previous request is sent in the next batch.
        }
      } catch { /* Retry the same IDs later; server ingestion is idempotent. */ }
      finally { flushing = false; }
    },
  };
}
