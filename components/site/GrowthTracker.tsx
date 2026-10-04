'use client';

import { useEffect } from 'react';
import {
  STORE_CAMPAIGN,
  STORE_CTA_EVENT,
  type Locale,
} from '@/lib/site/config';
import { canonicalCampaign, canonicalRouteClass, coarseReferrerClass, storeClickRouteClass } from '@/lib/site/webAttribution';
import { createWebGrowthQueue, isKnownStoreCta, type WebGrowthEvent } from '@/lib/site/webGrowthQueue';

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

let webSessionId: string | null = null;
let webAttribution: Attribution = {};
let webQueue: ReturnType<typeof createWebGrowthQueue> | undefined;
let landingSent = false;

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sessionId() {
  webSessionId ??= uuid();
  return webSessionId;
}

function resolveAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  webAttribution = { campaign: canonicalCampaign(params.get('utm_campaign')) };
  return webAttribution;
}

function webContext(): Attribution {
  return {
    source: coarseReferrerClass(document.referrer),
    medium: 'website',
    content: canonicalRouteClass(window.location.pathname),
  };
}

function outbox() {
  if (webQueue) return webQueue;
  let storage: Storage | undefined;
  try { storage = window.sessionStorage; } catch { /* Disabled storage falls back to memory. */ }
  webQueue = createWebGrowthQueue(storage, (events) => fetch('/api/v1/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
  }));
  return webQueue;
}

function flushQueue() {
  void outbox().flush();
}

function enqueue(
  locale: Locale,
  eventName: WebGrowthEvent['event_name'],
  properties: WebGrowthEvent['properties'],
) {
  const id = sessionId();
  outbox().enqueue({
    event_id: uuid(),
    install_id: id,
    event_name: eventName,
    occurred_at: new Date().toISOString(),
    platform: 'web',
    app_version: 'site',
    locale,
    session_id: id,
    properties,
  });
  flushQueue();
}

export function GrowthTracker({ locale }: { locale: Locale }) {
  useEffect(() => {
    // The private operator console is deliberately excluded from acquisition data.
    if (window.location.pathname.includes('/operator/growth')) return;

    const attribution = resolveAttribution();
    const context = webContext();
    if (!landingSent) {
      landingSent = true;
      enqueue(locale, 'landing_viewed', {
        source: context.source,
        medium: context.medium,
        campaign: attribution.campaign ?? STORE_CAMPAIGN,
        content: context.content,
      });
    } else {
      void flushQueue();
    }

    const handleStoreClick = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== 'object') return;
      const values = detail as Record<string, unknown>;
      const ctaId = values.id;
      const store = values.platform === 'android' ? 'android' : values.platform === 'ios' ? 'ios' : null;
      if (!store || !isKnownStoreCta(ctaId, store)) return;

      enqueue(locale, 'store_cta_clicked', {
        source: context.source,
        medium: context.medium,
        campaign: attribution.campaign ?? STORE_CAMPAIGN,
        // Soft navigation does not rerun this effect, so classify the route at the click.
        content: storeClickRouteClass(window.location.pathname),
        cta_id: ctaId,
        store,
      });
    };

    window.addEventListener(STORE_CTA_EVENT, handleStoreClick);
    window.addEventListener('online', flushQueue);
    window.addEventListener('pagehide', flushQueue);
    document.addEventListener('visibilitychange', flushQueue);
    return () => {
      window.removeEventListener(STORE_CTA_EVENT, handleStoreClick);
      window.removeEventListener('online', flushQueue);
      window.removeEventListener('pagehide', flushQueue);
      document.removeEventListener('visibilitychange', flushQueue);
    };
  }, [locale]);

  return null;
}
