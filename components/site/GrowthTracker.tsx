'use client';

import { useEffect } from 'react';
import {
  STORE_CAMPAIGN,
  STORE_CTA_EVENT,
  type Locale,
} from '@/lib/site/config';
import { canonicalRouteClass, coarseReferrerClass } from '@/lib/site/webAttribution';

type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

type WebGrowthEvent = {
  event_id: string;
  install_id: string;
  event_name: 'landing_viewed' | 'store_cta_clicked';
  occurred_at: string;
  platform: 'web';
  app_version: 'site';
  locale: Locale;
  session_id: string;
  properties: Attribution & { cta_id?: string; store?: 'android' | 'ios' };
};

const SAFE_CODE = /^[a-z0-9][a-z0-9._~-]*$/;
let webSessionId: string | null = null;
let webAttribution: Attribution = {};
let webQueue: WebGrowthEvent[] = [];
let landingSent = false;

function uuid() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeCode(value: string | null, maxLength: number) {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length <= maxLength && SAFE_CODE.test(normalized)
    ? normalized
    : undefined;
}

function sessionId() {
  webSessionId ??= uuid();
  return webSessionId;
}

function resolveAttribution(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const incoming: Attribution = {
    source: safeCode(params.get('utm_source'), 32),
    medium: safeCode(params.get('utm_medium'), 32),
    campaign: safeCode(params.get('utm_campaign'), 64),
    content: safeCode(params.get('utm_content'), 64),
  };
  const hasIncoming = Object.values(incoming).some(Boolean);

  if (hasIncoming) {
    webAttribution = Object.fromEntries(Object.entries(incoming).filter(([, value]) => value));
  }
  return webAttribution;
}

function webContext(): Attribution {
  return {
    source: coarseReferrerClass(document.referrer),
    medium: 'website',
    content: canonicalRouteClass(window.location.pathname),
  };
}

function readQueue(): WebGrowthEvent[] {
  return webQueue;
}

function saveQueue(events: WebGrowthEvent[]) {
  webQueue = events.slice(-20);
}

let flushInProgress = false;

async function flushQueue() {
  if (flushInProgress) return;
  const events = readQueue();
  if (!events.length) return;
  flushInProgress = true;
  try {
    const response = await fetch('/api/v1/analytics/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events }),
      keepalive: true,
    });
    if (response.ok) {
      const sentIds = new Set(events.map((event) => event.event_id));
      saveQueue(readQueue().filter((event) => !sentIds.has(event.event_id)));
    }
  } catch {
    // A later page view or CTA click retries the same idempotent event IDs.
  } finally {
    flushInProgress = false;
  }
}

function enqueue(
  locale: Locale,
  eventName: WebGrowthEvent['event_name'],
  properties: WebGrowthEvent['properties'],
) {
  const id = sessionId();
  const queue = readQueue();
  queue.push({
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
  saveQueue(queue);
  void flushQueue();
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
      const ctaId = safeCode(typeof values.id === 'string' ? values.id : null, 48);
      const store = values.platform === 'android' ? 'android' : values.platform === 'ios' ? 'ios' : null;
      if (!ctaId || !store) return;

      enqueue(locale, 'store_cta_clicked', {
        source: context.source,
        medium: context.medium,
        campaign: attribution.campaign ?? STORE_CAMPAIGN,
        content: context.content,
        cta_id: ctaId,
        store,
      });
    };

    window.addEventListener(STORE_CTA_EVENT, handleStoreClick);
    return () => window.removeEventListener(STORE_CTA_EVENT, handleStoreClick);
  }, [locale]);

  return null;
}
