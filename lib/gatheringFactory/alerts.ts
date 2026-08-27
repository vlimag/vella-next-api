import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const GATHERING_ALERT_EMAIL_URL = 'https://api.resend.com/emails';
export const DEFAULT_OPS_ALERT_EMAIL = 'support@vella.one';
export const DEFAULT_OPS_ALERT_FROM = 'Vella Operations <ops@vella.one>';

export type GatheringIncidentType =
  | 'generation_failed'
  | 'inventory_low'
  | 'heartbeat_stale'
  | 'publish_failed';
export type GatheringIncidentState = 'open' | 'alerted' | 'recovered';
export type GatheringAlertState = 'pending' | 'delivered' | 'failed' | 'not_needed';
export type GatheringAlertKind = 'open' | 'recovery';

export type GatheringIncident = {
  id: string;
  incidentKey: string;
  generationRunId: string | null;
  releaseId?: string | null;
  incidentType: GatheringIncidentType;
  incidentState: GatheringIncidentState;
  safeErrorCode: string;
  inventoryDepth: number | null;
  firstDetectedAt: string;
  recoveredAt: string | null;
  alertState: GatheringAlertState;
  alertAttempts: number;
};

export type OpenGatheringIncidentInput = {
  incidentKey: string;
  incidentType: GatheringIncidentType;
  safeErrorCode: string;
  inventoryDepth?: number | null;
  generationRunId?: string | null;
  releaseId?: string | null;
  firstDetectedAt?: string;
};

export type GatheringIncidentPatch = Partial<Pick<
  GatheringIncident,
  'incidentState' | 'safeErrorCode' | 'inventoryDepth' | 'generationRunId'
  | 'releaseId' | 'recoveredAt' | 'alertState' | 'alertAttempts'
>>;

export type GatheringOperationalEvent = {
  eventName: 'incident_opened' | 'incident_recovered' | 'alert_attempted' | 'alert_delivered' | 'alert_failed';
  eventState: 'started' | 'succeeded' | 'failed' | 'skipped';
  correlationId?: string;
  generationRunId?: string | null;
  releaseId?: string | null;
  safeErrorCode?: string;
  inventoryDepth?: number | null;
};

export type GatheringIncidentRepository = {
  findByIncidentKey: (incidentKey: string) => Promise<GatheringIncident | null>;
  insertIncident: (input: OpenGatheringIncidentInput & {
    alertState: GatheringAlertState;
    alertAttempts: number;
  }) => Promise<GatheringIncident>;
  updateIncident: (incidentKey: string, patch: GatheringIncidentPatch) => Promise<GatheringIncident>;
  recordOperationalEvent: (event: GatheringOperationalEvent) => Promise<void>;
};

export type GatheringAlertDependencies = {
  repository: GatheringIncidentRepository;
  fetch?: typeof fetch;
  now?: () => Date;
  logsUrl?: string;
};

export type OpenGatheringIncidentResult = {
  created: boolean;
  incident: GatheringIncident;
};

export type RecoverGatheringIncidentResult = {
  recovered: boolean;
  incident: GatheringIncident;
};

export type SendGatheringAlertInput = {
  incident: GatheringIncident;
  kind: GatheringAlertKind;
  stage?: string;
  timestamp?: string;
  runId?: string;
};

export type SendGatheringAlertResult = {
  delivered: boolean;
  skipped: boolean;
};

export async function openGatheringIncident(
  input: OpenGatheringIncidentInput,
  repository: GatheringIncidentRepository,
): Promise<OpenGatheringIncidentResult> {
  const existing = await repository.findByIncidentKey(input.incidentKey);
  if (!existing) {
    let created: GatheringIncident;
    try {
      created = await repository.insertIncident({
        ...input,
        alertState: 'pending',
        alertAttempts: 0,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await repository.findByIncidentKey(input.incidentKey);
      if (!raced) throw error;
      return { created: false, incident: raced };
    }
    await recordSafeEvent(repository, {
      eventName: 'incident_opened',
      eventState: 'started',
      generationRunId: created.generationRunId,
      releaseId: created.releaseId,
      safeErrorCode: created.safeErrorCode,
      inventoryDepth: created.inventoryDepth,
    });
    return { created: true, incident: created };
  }

  if (existing.incidentState === 'recovered') {
    const reopened = await repository.updateIncident(input.incidentKey, {
      incidentState: 'open',
      safeErrorCode: input.safeErrorCode,
      inventoryDepth: input.inventoryDepth ?? existing.inventoryDepth,
      generationRunId: input.generationRunId ?? existing.generationRunId,
      releaseId: input.releaseId ?? existing.releaseId,
      recoveredAt: null,
      alertState: 'pending',
      alertAttempts: 0,
    });
    await recordSafeEvent(repository, {
      eventName: 'incident_opened',
      eventState: 'started',
      generationRunId: reopened.generationRunId,
      releaseId: reopened.releaseId,
      safeErrorCode: reopened.safeErrorCode,
      inventoryDepth: reopened.inventoryDepth,
    });
    return { created: true, incident: reopened };
  }

  return { created: false, incident: existing };
}

export async function recoverGatheringIncident(
  incidentKey: string,
  repository: GatheringIncidentRepository,
  recoveredAt = new Date().toISOString(),
): Promise<RecoverGatheringIncidentResult> {
  const existing = await repository.findByIncidentKey(incidentKey);
  if (!existing || existing.incidentState === 'recovered') {
    return { recovered: false, incident: existing ?? missingIncident(incidentKey) };
  }

  const recovered = await repository.updateIncident(incidentKey, {
    incidentState: 'recovered',
    recoveredAt,
    alertState: 'pending',
  });
  await recordSafeEvent(repository, {
    eventName: 'incident_recovered',
    eventState: 'succeeded',
    generationRunId: recovered.generationRunId,
    releaseId: recovered.releaseId,
    safeErrorCode: recovered.safeErrorCode,
    inventoryDepth: recovered.inventoryDepth,
  });
  return { recovered: true, incident: recovered };
}

export async function sendGatheringAlert(
  input: SendGatheringAlertInput,
  dependencies: GatheringAlertDependencies,
): Promise<SendGatheringAlertResult> {
  const { incident, kind } = input;
  if (incident.alertState === 'delivered') return { delivered: false, skipped: true };

  const now = dependencies.now ?? (() => new Date());
  const fetchImpl = dependencies.fetch ?? fetch;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('gathering_alert_configuration_missing');

  const stage = safeValue(input.stage ?? (incident.incidentType === 'heartbeat_stale' ? 'watchdog' : 'factory'));
  const timestamp = safeTimestamp(input.timestamp ?? incident.firstDetectedAt, now);
  const runId = safeValue(input.runId ?? incident.generationRunId ?? incident.id);
  const safeErrorCode = safeValue(incident.safeErrorCode);
  const safeInventoryDepth = boundedInventory(incident.inventoryDepth);
  const inventoryDepth = safeInventoryDepth ?? 'unknown';
  const logsUrl = safeLogsUrl(dependencies.logsUrl ?? process.env.OPS_ALERT_LOGS_URL);
  const message = buildAlertMessage({
    kind,
    stage,
    timestamp,
    runId,
    safeErrorCode,
    inventoryDepth,
    logsUrl,
  });
  const idempotencyKey = `gathering:${safeValue(incident.incidentKey)}:${kind}`;
  const attemptedAt = await markAttempt(dependencies.repository, incident);

  await recordSafeEvent(dependencies.repository, {
    eventName: 'alert_attempted',
    eventState: 'started',
    generationRunId: incident.generationRunId,
    releaseId: incident.releaseId,
    safeErrorCode,
    inventoryDepth: safeInventoryDepth,
  });

  try {
    const response = await fetchImpl(GATHERING_ALERT_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: configuredSender(),
        to: [configuredRecipient()],
        subject: `${kind === 'recovery' ? '[RECOVERED] ' : ''}Vella Gathering ${safeErrorCode}`,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) throw new Error('resend_http_failed');
    await dependencies.repository.updateIncident(incident.incidentKey, {
      incidentState: kind === 'open' ? 'alerted' : 'recovered',
      alertState: 'delivered',
      alertAttempts: attemptedAt,
    });
    await recordSafeEvent(dependencies.repository, {
      eventName: 'alert_delivered',
      eventState: 'succeeded',
      generationRunId: incident.generationRunId,
      releaseId: incident.releaseId,
      safeErrorCode,
      inventoryDepth: safeInventoryDepth,
    });
    return { delivered: true, skipped: false };
  } catch {
    await dependencies.repository.updateIncident(incident.incidentKey, {
      alertState: 'failed',
      alertAttempts: attemptedAt,
    });
    await recordSafeEvent(dependencies.repository, {
      eventName: 'alert_failed',
      eventState: 'failed',
      generationRunId: incident.generationRunId,
      releaseId: incident.releaseId,
      safeErrorCode,
      inventoryDepth: safeInventoryDepth,
    });
    return { delivered: false, skipped: false };
  }
}

export function createGatheringIncidentRepository(
  supabase: SupabaseClient<any, any, any, any, any>,
): GatheringIncidentRepository {
  const table = (name: string) => supabase.from(name);

  return {
    async findByIncidentKey(incidentKey) {
      const { data, error } = await table('gathering_generation_incidents')
        .select('*')
        .eq('incident_key', incidentKey)
        .maybeSingle();
      if (error) throw error;
      return data ? toIncident(data) : null;
    },
    async insertIncident(input) {
      const { data, error } = await table('gathering_generation_incidents')
        .insert({
          incident_key: input.incidentKey,
          incident_type: input.incidentType,
          safe_error_code: input.safeErrorCode,
          inventory_depth: input.inventoryDepth ?? null,
          generation_run_id: input.generationRunId ?? null,
          release_id: input.releaseId ?? null,
          first_detected_at: input.firstDetectedAt,
          incident_state: 'open',
          alert_state: input.alertState,
          alert_attempts: input.alertAttempts,
        })
        .select('*')
        .single();
      if (error || !data) throw error ?? new Error('gathering_incident_insert_failed');
      return toIncident(data);
    },
    async updateIncident(incidentKey, patch) {
      const { data, error } = await table('gathering_generation_incidents')
        .update(toIncidentPatch(patch))
        .eq('incident_key', incidentKey)
        .select('*')
        .single();
      if (error || !data) throw error ?? new Error('gathering_incident_update_failed');
      return toIncident(data);
    },
    async recordOperationalEvent(event) {
      const { error } = await table('gathering_operational_events').insert({
        event_name: event.eventName,
        event_state: event.eventState,
        correlation_id: event.correlationId ?? randomUUID(),
        generation_run_id: event.generationRunId ?? null,
        release_id: event.releaseId ?? null,
        safe_error_code: event.safeErrorCode ? safeValue(event.safeErrorCode) : null,
      });
      if (error) throw error;
    },
  };
}

async function markAttempt(repository: GatheringIncidentRepository, incident: GatheringIncident) {
  return (await repository.updateIncident(incident.incidentKey, {
    alertAttempts: Math.min(99, incident.alertAttempts + 1),
  })).alertAttempts;
}

async function recordSafeEvent(repository: GatheringIncidentRepository, event: GatheringOperationalEvent) {
  try {
    await repository.recordOperationalEvent(event);
  } catch {
    // Operational telemetry must never turn an alert into a second failure.
  }
}

function configuredRecipient() {
  return process.env.OPS_ALERT_EMAIL?.trim() || DEFAULT_OPS_ALERT_EMAIL;
}

function configuredSender() {
  return process.env.OPS_ALERT_FROM?.trim()
    || process.env.RESEND_FROM?.trim()
    || DEFAULT_OPS_ALERT_FROM;
}

function buildAlertMessage(input: {
  kind: GatheringAlertKind;
  stage: string;
  timestamp: string;
  runId: string;
  safeErrorCode: string;
  inventoryDepth: number | 'unknown';
  logsUrl: string | null;
}) {
  const rows = [
    ['Stage', input.stage],
    ['Timestamp', input.timestamp],
    ['Run ID', input.runId],
    ['Safe error', input.safeErrorCode],
    ['Inventory depth', String(input.inventoryDepth)],
    ...(input.logsUrl ? [['Logs', input.logsUrl]] : []),
  ] as const;
  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  const html = `<p>Vella Gathering ${input.kind === 'recovery' ? 'recovered' : 'alert'}</p><ul>${rows
    .map(([label, value]) => `<li><strong>${escapeHtml(label)}</strong>: ${escapeHtml(value)}</li>`)
    .join('')}</ul>`;
  return { text, html };
}

function toIncident(row: Record<string, any>): GatheringIncident {
  return {
    id: String(row.id),
    incidentKey: String(row.incident_key),
    generationRunId: row.generation_run_id ?? null,
    releaseId: row.release_id ?? null,
    incidentType: row.incident_type,
    incidentState: row.incident_state,
    safeErrorCode: row.safe_error_code,
    inventoryDepth: row.inventory_depth ?? null,
    firstDetectedAt: row.first_detected_at,
    recoveredAt: row.recovered_at ?? null,
    alertState: row.alert_state,
    alertAttempts: row.alert_attempts,
  };
}

function toIncidentPatch(patch: GatheringIncidentPatch) {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [camelToSnake(key), value]));
}

function camelToSnake(value: string) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function missingIncident(incidentKey: string): GatheringIncident {
  return {
    id: '',
    incidentKey,
    generationRunId: null,
    releaseId: null,
    incidentType: 'generation_failed',
    incidentState: 'recovered',
    safeErrorCode: 'incident_missing',
    inventoryDepth: null,
    firstDetectedAt: new Date(0).toISOString(),
    recoveredAt: null,
    alertState: 'not_needed',
    alertAttempts: 0,
  };
}

function safeValue(value: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(value) ? value : 'unknown';
}

function safeTimestamp(value: string, now: () => Date) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? now().toISOString() : date.toISOString();
}

function boundedInventory(value: number | null): number | null {
  return Number.isInteger(value) && value! >= 0 && value! <= 52 ? value! : null;
}

function safeLogsUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function isUniqueViolation(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === '23505'
    || (typeof candidate.message === 'string' && /unique_violation|duplicate key/i.test(candidate.message));
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]!);
}
