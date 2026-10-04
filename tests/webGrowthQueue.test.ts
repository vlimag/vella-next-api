import { describe, expect, it } from 'vitest';
import { createWebGrowthQueue, WEB_GROWTH_STORAGE_KEY, type WebGrowthEvent } from '@/lib/site/webGrowthQueue';
import { parseGrowthEventRequest } from '@/lib/growthAnalytics';

function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}
function event(index = 1): WebGrowthEvent {
  return { event_id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, install_id: '00000000-0000-4000-8000-000000000099', session_id: '00000000-0000-4000-8000-000000000099', occurred_at: new Date().toISOString(), event_name: 'store_cta_clicked', platform: 'web', app_version: 'site', locale: 'pt', properties: { source: 'search', medium: 'website', campaign: 'android_first_launch', content: 'blog_article', cta_id: 'vella-store-cta-blog-article-android', store: 'android' } };
}

describe('website growth outbox', () => {
  it('drops a parseable timestamp containing private text without blocking a valid click', async () => {
    const cache = storage();
    cache.setItem(WEB_GROWTH_STORAGE_KEY, JSON.stringify([
      { ...event(1), occurred_at: `${new Date().toUTCString()} (private prayer text)` },
    ]));
    const sent: WebGrowthEvent[] = [];
    const queue = createWebGrowthQueue(cache, async (events) => {
      sent.push(...events);
      return { ok: true, status: 202 };
    });
    const click = event(2);
    queue.enqueue(click);
    await queue.flush();
    expect(sent).toEqual([click]);
    expect(cache.getItem(WEB_GROWTH_STORAGE_KEY)).not.toContain('private prayer text');
  });
  it('delivers restored and new page sessions in separate server-valid batches', async () => {
    const cache = storage();
    const original = event(1);
    cache.setItem(WEB_GROWTH_STORAGE_KEY, JSON.stringify([original]));
    const received: WebGrowthEvent[] = [];
    const queue = createWebGrowthQueue(cache, async (events) => {
      const parsed = await parseGrowthEventRequest(new Request('https://vella.one/api/v1/analytics/events', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ events }),
      }));
      expect(parsed).toHaveProperty('events');
      received.push(...events);
      return { ok: true, status: 202 };
    });
    const next = { ...event(2), install_id: event(2).event_id, session_id: event(2).event_id };
    queue.enqueue(next);
    await queue.flush();
    expect(received).toEqual([original, next]);
  });
  it('restores failed outbound events after reload with the same idempotency key', async () => {
    const cache = storage();
    const original = event();
    const queue = createWebGrowthQueue(cache, async () => { throw new Error('offline'); });
    queue.enqueue(original);
    await queue.flush();
    const delivered: WebGrowthEvent[] = [];
    const restored = createWebGrowthQueue(cache, async (events) => { delivered.push(...events); return { ok: true, status: 202 }; });
    await restored.flush();
    expect(delivered).toEqual([original]);
    expect(JSON.parse(cache.getItem(WEB_GROWTH_STORAGE_KEY) ?? '[]')).toEqual([]);
  });

  it('drains a click enqueued while the landing request is in flight', async () => {
    let finish!: (value: { ok: boolean; status: number }) => void;
    const sent: WebGrowthEvent[][] = [];
    const queue = createWebGrowthQueue(storage(), async (events) => {
      sent.push(events);
      if (sent.length === 1) return new Promise((resolve) => { finish = resolve; });
      return { ok: true, status: 202 };
    });
    queue.enqueue(event(1));
    const pending = queue.flush();
    queue.enqueue(event(2));
    await queue.flush();
    finish({ ok: true, status: 202 });
    await pending;
    expect(sent.flat().map((item) => item.event_id)).toEqual([event(1).event_id, event(2).event_id]);
  });

  it('bounds persisted events and deduplicates repeated IDs', async () => {
    const cache = storage();
    const queue = createWebGrowthQueue(cache, async () => ({ ok: false, status: 503 }));
    for (let i = 1; i <= 30; i++) queue.enqueue(event(i));
    queue.enqueue(event(30));
    await queue.flush();
    const saved = JSON.parse(cache.getItem(WEB_GROWTH_STORAGE_KEY)!);
    expect(saved).toHaveLength(20);
    expect(saved[0].event_id).toBe(event(11).event_id);
    expect(new Set(saved.map((e: WebGrowthEvent) => e.event_id)).size).toBe(20);
  });

  it('rejects unsafe, stale and oversized cached payloads before delivery', async () => {
    const cache = storage();
    cache.setItem(WEB_GROWTH_STORAGE_KEY, JSON.stringify([
      { ...event(1), properties: { ...event(1).properties, prayer: 'sensitive text' } },
      { ...event(2), properties: { ...event(2).properties, cta_id: 'personal-message' } },
      { ...event(3), occurred_at: '2020-01-01T00:00:00.000Z' },
      { ...event(4), properties: { ...event(4).properties, source: 'https://example.org/private?q=secret' } },
      event(5),
    ]));
    const sent: WebGrowthEvent[] = [];
    const queue = createWebGrowthQueue(cache, async (events) => { sent.push(...events); return { ok: true, status: 202 }; });
    await queue.flush();
    expect(sent.map((e) => e.event_id)).toEqual([event(5).event_id]);
    cache.setItem(WEB_GROWTH_STORAGE_KEY, 'x'.repeat(65_537));
    await createWebGrowthQueue(cache, async () => { throw new Error('must not send'); }).flush();
    expect(cache.getItem(WEB_GROWTH_STORAGE_KEY)).toBe('[]');
  });

  it('works in memory when session storage is unavailable and retries only on demand', async () => {
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    let requests = 0;
    const queue = createWebGrowthQueue(blocked, async () => ({ ok: ++requests > 1, status: requests > 1 ? 202 : 429 }));
    queue.enqueue(event());
    await queue.flush();
    expect(requests).toBe(1);
    await queue.flush();
    expect(requests).toBe(2);
    await queue.flush();
    expect(requests).toBe(2);
  });
});
