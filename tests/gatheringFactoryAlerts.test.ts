import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  openGatheringIncident,
  recoverGatheringIncident,
  sendGatheringAlert,
  type GatheringAlertDependencies,
  type GatheringIncident,
  type GatheringIncidentRepository,
} from '@/lib/gatheringFactory/alerts';

const originalEnvironment = {
  apiKey: process.env.RESEND_API_KEY,
  recipient: process.env.OPS_ALERT_EMAIL,
  sender: process.env.OPS_ALERT_FROM,
};

function incident(overrides: Partial<GatheringIncident> = {}): GatheringIncident {
  return {
    id: 'incident-row-id',
    incidentKey: 'inventory_low',
    generationRunId: 'run-row-id',
    incidentType: 'inventory_low',
    incidentState: 'open',
    safeErrorCode: 'inventory_low',
    inventoryDepth: 1,
    firstDetectedAt: '2026-08-27T12:00:00.000Z',
    recoveredAt: null,
    alertState: 'pending',
    alertAttempts: 0,
    ...overrides,
  };
}

function repository(initial: GatheringIncident | null = null) {
  let current = initial;
  const events: unknown[] = [];
  const repo: GatheringIncidentRepository = {
    findByIncidentKey: vi.fn(async () => current),
    insertIncident: vi.fn(async (input) => {
      current = incident({
        ...input,
        id: 'inserted-incident-id',
        firstDetectedAt: input.firstDetectedAt,
      });
      return current;
    }),
    updateIncident: vi.fn(async (_key, patch) => {
      if (!current) throw new Error('incident missing');
      const updated: GatheringIncident = { ...current, ...patch };
      current = updated;
      return updated;
    }),
    recordOperationalEvent: vi.fn(async (event) => {
      events.push(event);
    }),
  };
  return { repo, events, getCurrent: () => current };
}

function dependencies(repo: GatheringIncidentRepository, fetchImpl: typeof fetch): GatheringAlertDependencies {
  return {
    repository: repo,
    fetch: fetchImpl,
    now: () => new Date('2026-08-27T12:34:56.000Z'),
    logsUrl: 'https://logs.vella.one/gatherings',
  };
}

afterEach(() => {
  if (originalEnvironment.apiKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalEnvironment.apiKey;
  if (originalEnvironment.recipient === undefined) delete process.env.OPS_ALERT_EMAIL;
  else process.env.OPS_ALERT_EMAIL = originalEnvironment.recipient;
  if (originalEnvironment.sender === undefined) delete process.env.OPS_ALERT_FROM;
  else process.env.OPS_ALERT_FROM = originalEnvironment.sender;
});

describe('gathering factory alerts', () => {
  it('persists one open incident and records a safe incident_opened event', async () => {
    const state = repository();

    const result = await openGatheringIncident({
      incidentKey: 'inventory_low',
      incidentType: 'inventory_low',
      safeErrorCode: 'inventory_low',
      inventoryDepth: 1,
      generationRunId: 'run-row-id',
      firstDetectedAt: '2026-08-27T12:00:00.000Z',
    }, state.repo);

    expect(result.created).toBe(true);
    expect(result.incident.incidentState).toBe('open');
    expect(state.repo.insertIncident).toHaveBeenCalledTimes(1);
    expect(state.events).toEqual([
      expect.objectContaining({ eventName: 'incident_opened', eventState: 'started' }),
    ]);
  });

  it('deduplicates an already open incident and does not deliver a second alert', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.OPS_ALERT_EMAIL = 'ops@example.test';
    process.env.OPS_ALERT_FROM = 'Vella Operations <ops@vella.one>';
    const state = repository(incident({ alertState: 'delivered', alertAttempts: 1 }));
    const fetchImpl = vi.fn<typeof fetch>();
    const deps = dependencies(state.repo, fetchImpl);

    const secondOpen = await openGatheringIncident({
      incidentKey: 'inventory_low',
      incidentType: 'inventory_low',
      safeErrorCode: 'inventory_low',
      inventoryDepth: 1,
    }, state.repo);
    const alert = await sendGatheringAlert({ incident: secondOpen.incident, kind: 'open' }, deps);

    expect(secondOpen.created).toBe(false);
    expect(state.repo.insertIncident).not.toHaveBeenCalled();
    expect(alert.delivered).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends privacy-safe Resend HTML and text with the API key only in Authorization', async () => {
    process.env.RESEND_API_KEY = 're_test_secret';
    process.env.OPS_ALERT_EMAIL = 'alerts@example.test';
    process.env.OPS_ALERT_FROM = 'Vella Operations <ops@vella.one>';
    const state = repository(incident());
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
    );

    const result = await sendGatheringAlert({
      incident: state.getCurrent()!,
      kind: 'open',
      stage: 'generation',
      runId: 'random-run-id',
    }, dependencies(state.repo, fetchImpl));

    expect(result.delivered).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: {
        Authorization: 'Bearer re_test_secret',
        'Content-Type': 'application/json',
        'Idempotency-Key': 'gathering:inventory_low:open',
      },
    }));
    const request = fetchImpl.mock.calls[0]?.[1];
    const body = JSON.parse(String(request?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'Vella Operations <ops@vella.one>',
      to: ['alerts@example.test'],
    });
    expect(body.html).toContain('inventory_low');
    expect(body.text).toContain('random-run-id');
    expect(JSON.stringify(body)).not.toMatch(/re_test_secret|generated body|receipt|user id|private prayer/i);
    expect(state.repo.updateIncident).toHaveBeenCalledWith('inventory_low', expect.objectContaining({
      alertState: 'delivered',
      alertAttempts: 1,
    }));
    expect(state.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventName: 'alert_attempted' }),
      expect.objectContaining({ eventName: 'alert_delivered' }),
    ]));
  });

  it('uses the persisted incident ID as a stable run ID and persists failed delivery', async () => {
    process.env.RESEND_API_KEY = 're_test_secret';
    process.env.OPS_ALERT_EMAIL = 'alerts@example.test';
    const state = repository(incident({
      id: 'stable-incident-id',
      generationRunId: null,
      alertState: 'pending',
    }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('failed', { status: 503 }));

    const result = await sendGatheringAlert({
      incident: state.getCurrent()!,
      kind: 'open',
    }, dependencies(state.repo, fetchImpl));

    expect(result).toEqual({ delivered: false, skipped: false });
    const body = JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body)) as { text: string };
    expect(body.text).toContain('Run ID: stable-incident-id');
    expect(state.repo.updateIncident).toHaveBeenLastCalledWith('inventory_low', {
      alertState: 'failed',
      alertAttempts: 1,
    });
    expect(state.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventName: 'alert_attempted' }),
      expect.objectContaining({ eventName: 'alert_failed' }),
    ]));
  });

  it('re-reads the persisted incident when a concurrent insert wins the unique key race', async () => {
    const state = repository();
    const winner = incident({ alertState: 'failed', alertAttempts: 1 });
    state.repo.findByIncidentKey = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(winner);
    state.repo.insertIncident = vi.fn().mockRejectedValue(new Error('unique_violation'));

    const result = await openGatheringIncident({
      incidentKey: 'inventory_low',
      incidentType: 'inventory_low',
      safeErrorCode: 'inventory_low',
      inventoryDepth: 1,
    }, state.repo);

    expect(result).toEqual({ created: false, incident: winner });
    expect(state.repo.findByIncidentKey).toHaveBeenCalledTimes(2);
  });

  it('recovers once and sends a recovered alert with a distinct idempotency key', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.OPS_ALERT_EMAIL = 'ops@example.test';
    process.env.OPS_ALERT_FROM = 'Vella Operations <ops@vella.one>';
    const state = repository(incident({ alertState: 'delivered', alertAttempts: 1 }));
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ id: 'recovery-email-id' }), { status: 200 }),
    );
    const deps = dependencies(state.repo, fetchImpl);

    const recovered = await recoverGatheringIncident('inventory_low', deps.repository, '2026-08-27T13:00:00.000Z');
    const alert = await sendGatheringAlert({ incident: recovered.incident, kind: 'recovery' }, deps);

    expect(recovered.recovered).toBe(true);
    expect(alert.delivered).toBe(true);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      subject: expect.stringContaining('RECOVERED'),
    });
    expect(fetchImpl.mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ 'Idempotency-Key': 'gathering:inventory_low:recovery' }),
    }));
    expect(state.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventName: 'incident_recovered' }),
    ]));
  });
});
