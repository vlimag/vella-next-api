const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OUTCOMES = ['succeeded', 'cancelled', 'failed', 'timed_out'] as const;
const STAGES = ['store_request', 'store_callback', 'validation', 'access_refresh', 'unexpected'] as const;
const OPEN_THRESHOLD_MS = 2 * 60 * 1000;

type CheckoutOutcome = typeof OUTCOMES[number];
type CheckoutStage = typeof STAGES[number];
type CheckoutRow = {
  event_name?: unknown;
  received_at?: unknown;
  properties?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function finiteTimestamp(value: unknown) {
  if (typeof value !== 'string') return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function countDimension<T extends string>(
  values: T[],
  allowed: readonly T[],
  key: 'outcome' | 'stage',
) {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return allowed.flatMap((value) => {
    const count = counts.get(value) ?? 0;
    return count ? [{ [key]: value, count }] : [];
  });
}

export function checkoutLifecycleDiagnostics(rows: CheckoutRow[], nowMs = Date.now()) {
  if (!Array.isArray(rows) || !Number.isFinite(nowMs)) return { audit_available: false } as const;

  const starts = new Map<string, { plan: 'monthly' | 'yearly'; receivedAt: number }>();
  const results = new Map<string, Array<{
    plan: 'monthly' | 'yearly';
    outcome: CheckoutOutcome;
    stage: CheckoutStage;
    receivedAt: number;
  }>>();
  let legacyStarts = 0;

  for (const row of rows) {
    if (!isRecord(row) || (row.event_name !== 'checkout_started' && row.event_name !== 'checkout_result')) {
      return { audit_available: false } as const;
    }
    const receivedAt = finiteTimestamp(row.received_at);
    if (receivedAt === null || !isRecord(row.properties)) return { audit_available: false } as const;
    const properties = row.properties;
    const plan = properties.plan;
    if (plan !== 'monthly' && plan !== 'yearly') return { audit_available: false } as const;

    if (row.event_name === 'checkout_started') {
      if (hasExactKeys(properties, ['plan'])) {
        legacyStarts += 1;
        continue;
      }
      if (!hasExactKeys(properties, ['plan', 'attempt_id']) ||
        typeof properties.attempt_id !== 'string' || !UUID_PATTERN.test(properties.attempt_id)) {
        return { audit_available: false } as const;
      }
      const existing = starts.get(properties.attempt_id);
      if (existing && existing.plan !== plan) return { audit_available: false } as const;
      if (!existing || receivedAt < existing.receivedAt) {
        starts.set(properties.attempt_id, { plan, receivedAt });
      }
      continue;
    }

    if (!hasExactKeys(properties, ['plan', 'attempt_id', 'outcome', 'stage']) ||
      typeof properties.attempt_id !== 'string' || !UUID_PATTERN.test(properties.attempt_id) ||
      !OUTCOMES.includes(properties.outcome as CheckoutOutcome) ||
      !STAGES.includes(properties.stage as CheckoutStage)) {
      return { audit_available: false } as const;
    }
    const attemptResults = results.get(properties.attempt_id) ?? [];
    attemptResults.push({
      plan,
      outcome: properties.outcome as CheckoutOutcome,
      stage: properties.stage as CheckoutStage,
      receivedAt,
    });
    results.set(properties.attempt_id, attemptResults);
  }

  const pairedOutcomes: CheckoutOutcome[] = [];
  const pairedStages: CheckoutStage[] = [];
  let terminalAttempts = 0;
  let duplicateTerminalAttempts = 0;
  let orphanResults = 0;

  for (const [attemptId, attemptResults] of results) {
    const start = starts.get(attemptId);
    if (!start) {
      orphanResults += 1;
      continue;
    }
    if (attemptResults.some((result) => result.plan !== start.plan)) {
      return { audit_available: false } as const;
    }
    const terminal = [...attemptResults].sort((left, right) => left.receivedAt - right.receivedAt)[0]!;
    terminalAttempts += 1;
    duplicateTerminalAttempts += Math.max(0, attemptResults.length - 1);
    pairedOutcomes.push(terminal.outcome);
    pairedStages.push(terminal.stage);
  }

  const openStarts = [...starts.entries()].filter(([attemptId]) => !results.has(attemptId));
  const openOverThreshold = openStarts.filter(([, start]) => nowMs - start.receivedAt >= OPEN_THRESHOLD_MS).length;

  return {
    audit_available: true,
    started_attempts: starts.size,
    terminal_attempts: terminalAttempts,
    open_attempts: openStarts.length,
    open_over_2m: openOverThreshold,
    legacy_uncorrelated_starts: legacyStarts,
    orphan_results: orphanResults,
    duplicate_terminal_attempts: duplicateTerminalAttempts,
    by_outcome: countDimension(pairedOutcomes, OUTCOMES, 'outcome'),
    by_stage: countDimension(pairedStages, STAGES, 'stage'),
  } as const;
}
