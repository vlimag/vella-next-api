'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type FunnelRow = {
  event_name: string;
  unique_installs: number;
  event_count: number;
};

type OrderedFunnelRow = {
  funnel_variant: 'legacy_v1' | 'compact_v2';
  event_name: string;
  stage_order: number;
  unique_installs: number;
};

type ReleaseCohortRow = OrderedFunnelRow & {
  app_version: string;
  build_number: string;
  runtime_version: string;
  cohort_installations: number;
};

type TransitionSegment = {
  provider: string;
  plan: string;
  phase: string;
  transitions: number;
  distinct_subscriptions: number;
};

type DailyRow = {
  day: string;
  unique_installs: number;
  event_count: number;
  first_open: number;
  onboarding_completed: number;
  account_created: number;
  paywall_viewed: number;
  trial_started: number;
  subscription_paid_started: number;
  meaningful_session_completed: number;
};

type CohortRow = {
  cohort_day: string;
  installs: number;
  onboarding_completed: number;
  account_created: number;
  trial_started: number;
  subscription_paid_started: number;
  activated_24h: number;
  d1_retained: number;
  d7_retained: number;
};

type CampaignRow = {
  source: string;
  campaign: string;
  spend_cents: number;
  currency: string;
  attributed_installs?: number | null;
  attribution_suppressed?: boolean;
  landing_views: number | null;
  store_cta_clicks: number | null;
  first_opens: number | null;
  trial_starts: number | null;
  paid_starts: number | null;
  cost_per_first_open_cents: number | null;
  cost_per_trial_cents: number | null;
  cost_per_paid_start_cents: number | null;
};

type OnboardingStepRow = {
  step_key: string;
  unique_installs: number;
  event_count: number;
};

type ProviderCount = Record<string, boolean | number | string | null>;
type DiagnosticCount = { key: string; count: number };
type FunnelDiagnosticCount = { key: string; unique_installs: number; event_count: number };
type ReleaseFunnelRow = {
  app_version: string;
  build_number: string;
  runtime_version: string;
  first_open: number;
  onboarding_started: number;
  onboarding_completed: number;
};

type GrowthSummary = {
  window: { from: string; to: string; cohort_days: number };
  ordered_funnel: OrderedFunnelRow[];
  diagnostic_totals: {
    source_of_truth: string;
    funnel: FunnelRow[];
    daily: DailyRow[];
    cohorts: CohortRow[];
    campaigns: CampaignRow[];
  };
  release_cohorts: ReleaseCohortRow[];
  authoritative_transitions: {
    trial_started: number;
    paid_started: number;
    by_day: Array<{
      day: string;
      phase: string;
      transitions: number;
      distinct_subscriptions: number;
    }>;
    by_provider_plan: TransitionSegment[];
    source_of_truth: string;
  };
  funnel: FunnelRow[];
  daily: DailyRow[];
  cohorts: CohortRow[];
  campaigns: CampaignRow[];
  onboarding_steps?: OnboardingStepRow[];
  onboarding_step_results?: FunnelDiagnosticCount[];
  onboarding_diagnostics?: {
    audit_available: boolean;
    by_step_duration: FunnelDiagnosticCount[];
    by_interaction: FunnelDiagnosticCount[];
    by_error: FunnelDiagnosticCount[];
    completion_profiles: FunnelDiagnosticCount[];
  };
  routing_diagnostics?: {
    audit_available: boolean;
    decisions: number;
    installs: number;
    by_destination: FunnelDiagnosticCount[];
    by_load_time: FunnelDiagnosticCount[];
  };
  release_funnel?: ReleaseFunnelRow[];
  auth_diagnostics?: {
    audit_available: boolean;
    screen_views: number;
    screen_installs: number;
    attempt_events: number;
    attempt_installs: number;
    by_entry_point: FunnelDiagnosticCount[];
    by_attempt: FunnelDiagnosticCount[];
    row_limit_reached: boolean;
  };
  authoritative_subscriptions: {
    verified_starts: number;
    active_now: number;
    auto_renew_off_now: number;
    ended_updates: number;
    by_provider_product: ProviderCount[];
  };
  webhook_health: {
    received: number;
    processed: number;
    pending: number;
    by_provider: ProviderCount[];
  };
  iap_diagnostics: {
    audit_available: boolean;
    client_events: number;
    client_failures: number;
    server_failures: number;
    verified_receipts: number;
    by_client_issue: DiagnosticCount[];
    by_server_error: DiagnosticCount[];
    by_verified_phase: DiagnosticCount[];
    row_limit_reached: boolean;
  };
};

type ApiEnvelope<T> = { data?: T; error?: { message?: string } };

const KEY_STORAGE = 'vella:operator-growth-key';
const DEFAULT_CAMPAIGN = 'br_android_202608_prayer_words';

const FUNNEL_LABELS: Record<string, string> = {
  landing_viewed: 'Landing views',
  store_cta_clicked: 'Store CTA clicks',
  first_open: 'First opens',
  onboarding_started: 'Onboarding starts',
  onboarding_completed: 'Onboarding completed',
  account_created: 'Accounts created',
  paywall_viewed: 'Paywall views',
  checkout_started: 'Checkout starts',
  trial_started: 'Client-observed trials',
  subscription_paid_started: 'Client-observed paid starts',
  meaningful_session_completed: 'Meaningful sessions',
  first_experience_viewed: 'First experience viewed',
  first_experience_completed: 'First experience completed',
  auth_started: 'Authentication started',
  plan_selected: 'Plan selected',
  authenticated_active_subscription_bypass: 'Active subscriber bypass',
};

const ONBOARDING_STEP_LABELS: Record<string, string> = {
  language: 'Language',
  goal: 'Goals',
  focus: 'Current need',
  preview: 'Personalized preview',
  reminders: 'Reminder preference',
  unknown: 'Unknown legacy step',
};

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialWindow() {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDay(from), to: isoDay(to) };
}

function number(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function money(cents: number | null | undefined, currency = 'BRL') {
  if (cents == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function percentage(value: number, denominator: number) {
  if (!denominator) return '—';
  return `${((value / denominator) * 100).toFixed(1)}%`;
}

function metric(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString();
}

function humanize(key: string) {
  return key.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function downloadJson(summary: GrowthSummary) {
  const blob = new Blob([JSON.stringify(summary, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vella-growth-${summary.window.from}-${summary.window.to}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GrowthDashboard() {
  const defaults = useMemo(initialWindow, []);
  const [operatorKey, setOperatorKey] = useState('');
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [cohortDays, setCohortDays] = useState(14);
  const [summary, setSummary] = useState<GrowthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [spendDate, setSpendDate] = useState(defaults.to);
  const [spendSource, setSpendSource] = useState('google');
  const [spendCampaign, setSpendCampaign] = useState(DEFAULT_CAMPAIGN);
  const [spendBrl, setSpendBrl] = useState('');
  const [spendStatus, setSpendStatus] = useState('');

  const loadSummary = useCallback(async (key = operatorKey) => {
    const cleanKey = key.trim();
    if (!cleanKey) {
      setError('Enter the operator key to load aggregate data.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams({ from, to, cohort_days: String(cohortDays) });
      const response = await fetch(`/api/v1/operator/growth/summary?${query}`, {
        cache: 'no-store',
        headers: { 'x-vella-operator-key': cleanKey },
      });
      const body = await response.json() as ApiEnvelope<GrowthSummary>;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message || `Could not load growth data (${response.status}).`);
      }
      sessionStorage.setItem(KEY_STORAGE, cleanKey);
      setSummary(body.data);
    } catch (cause) {
      setSummary(null);
      setError(cause instanceof Error ? cause.message : 'Could not load growth data.');
    } finally {
      setLoading(false);
    }
  }, [cohortDays, from, operatorKey, to]);

  useEffect(() => {
    const saved = sessionStorage.getItem(KEY_STORAGE) ?? '';
    if (saved) {
      setOperatorKey(saved);
      void loadSummary(saved);
    }
  // The initial request intentionally uses the initial date window.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSpend = summary?.campaigns.reduce((sum, item) => sum + number(item.spend_cents), 0) ?? 0;
  const paidStarts = summary?.authoritative_transitions.paid_started ?? 0;
  const orderedTotal = (eventName: string) => summary?.ordered_funnel
    .filter((item) => item.event_name === eventName)
    .reduce((sum, item) => sum + item.unique_installs, 0) ?? 0;
  const firstOpens = orderedTotal('first_open');
  const onboardingStarts = orderedTotal('onboarding_started');
  const meaningful = orderedTotal('first_experience_completed');
  const maxFunnel = Math.max(1, ...(summary?.ordered_funnel.map((item) => item.unique_installs) ?? [1]));
  const maxDaily = Math.max(1, ...(summary?.daily.map((item) => item.first_open) ?? [1]));
  const authSucceeded = summary?.auth_diagnostics?.by_attempt
    .filter((row) => row.key.endsWith(':succeeded'))
    .reduce((sum, row) => sum + row.event_count, 0) ?? 0;
  const authFailed = summary?.auth_diagnostics?.by_attempt
    .filter((row) => row.key.endsWith(':failed') || row.key.endsWith(':cancelled'))
    .reduce((sum, row) => sum + row.event_count, 0) ?? 0;
  const onboardingRouteInstalls = summary?.routing_diagnostics?.by_destination
    .filter((row) => row.key.startsWith('onboarding:'))
    .reduce((sum, row) => sum + row.unique_installs, 0) ?? 0;
  const onboardingErrorEvents = summary?.onboarding_diagnostics?.by_error
    .reduce((sum, row) => sum + row.event_count, 0) ?? 0;

  async function saveSpend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const numeric = Number(spendBrl.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric < 0 || Math.round(numeric * 100) > 100_000_000) {
      setSpendStatus('Enter a valid BRL amount.');
      return;
    }

    setSpendStatus('Saving…');
    try {
      const response = await fetch('/api/v1/operator/growth/spend', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-vella-operator-key': operatorKey.trim(),
        },
        body: JSON.stringify({
          items: [{
            date: spendDate,
            source: spendSource.trim(),
            campaign: spendCampaign.trim(),
            currency: 'BRL',
            spend_cents: Math.round(numeric * 100),
          }],
        }),
      });
      const body = await response.json() as ApiEnvelope<{ saved: number }>;
      if (!response.ok || !body.data) {
        throw new Error(body.error?.message || `Could not save spend (${response.status}).`);
      }
      setSpendStatus(`${body.data.saved} daily spend record saved.`);
      setSpendBrl('');
      await loadSummary();
    } catch (cause) {
      setSpendStatus(cause instanceof Error ? cause.message : 'Could not save spend.');
    }
  }

  return (
    <main className="growth-console">
      <header className="growth-console-header">
        <div>
          <p className="growth-kicker">Vella operator</p>
          <h1>Growth console</h1>
          <p>Privacy-minimized acquisition, activation, subscription truth, and campaign economics.</p>
        </div>
        <span className="growth-private-badge">Private · aggregate only</span>
      </header>

      <section className="growth-control-panel" aria-label="Report controls">
        <label className="growth-field growth-key-field">
          <span>Operator key</span>
          <input
            value={operatorKey}
            onChange={(event) => setOperatorKey(event.target.value)}
            type="password"
            autoComplete="off"
            placeholder="Stored only for this browser session"
          />
        </label>
        <label className="growth-field"><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="growth-field"><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="growth-field">
          <span>Cohort days</span>
          <select value={cohortDays} onChange={(event) => setCohortDays(Number(event.target.value))}>
            <option value={7}>7</option><option value={14}>14</option><option value={21}>21</option><option value={30}>30</option>
          </select>
        </label>
        <button className="growth-button growth-button-primary" type="button" disabled={loading} onClick={() => void loadSummary()}>
          {loading ? 'Loading…' : 'Refresh report'}
        </button>
        {summary ? <button className="growth-button" type="button" onClick={() => downloadJson(summary)}>Export JSON</button> : null}
      </section>

      {error ? <div className="growth-alert" role="alert">{error}</div> : null}
      {!summary && !error ? <div className="growth-empty">Enter the private operator key to load the last 30 days.</div> : null}

      {summary ? (
        <>
          <section className="growth-stat-grid" aria-label="Key metrics">
            <article><span>Spend</span><strong>{money(totalSpend)}</strong><small>{summary.window.from} → {summary.window.to}</small></article>
            <article><span>First opens</span><strong>{firstOpens.toLocaleString()}</strong><small>Unique anonymous installs</small></article>
            <article><span>First value</span><strong>{meaningful.toLocaleString()}</strong><small>Ordered first-experience completions · {percentage(meaningful, firstOpens)}</small></article>
            <article><span>Paid transitions</span><strong>{paidStarts.toLocaleString()}</strong><small>Authoritative production subscription truth</small></article>
            <article><span>Blended authoritative CAC</span><strong>{paidStarts ? money(Math.round(totalSpend / paidStarts)) : '—'}</strong><small>All spend / paid transitions</small></article>
            <article><span>Active now</span><strong>{summary.authoritative_subscriptions.active_now.toLocaleString()}</strong><small>{summary.authoritative_subscriptions.auto_renew_off_now.toLocaleString()} with auto-renew off</small></article>
          </section>

          <div className="growth-two-column">
            <section className="growth-panel">
              <div className="growth-panel-heading">
                <div><p className="growth-kicker">Ordered product funnel</p><h2>Closed paths by native variant</h2></div>
                <p>Each stage requires every earlier stage in that variant by occurrence time. Active subscribers appear as a closed bypass outcome.</p>
              </div>
              <div className="growth-funnel">
                {summary.ordered_funnel.map((row) => (
                  <div className="growth-funnel-row" key={`${row.funnel_variant}:${row.event_name}`}>
                    <div><span>{FUNNEL_LABELS[row.event_name] ?? humanize(row.event_name)}</span><strong>{row.unique_installs.toLocaleString()}</strong></div>
                    <div className="growth-track"><i style={{ width: `${Math.max(2, (row.unique_installs / maxFunnel) * 100)}%` }} /></div>
                    <small>{humanize(row.funnel_variant)} · stage {row.stage_order}</small>
                  </div>
                ))}
              </div>
            </section>

            <section className="growth-panel">
              <div className="growth-panel-heading"><div><p className="growth-kicker">Daily diagnostic signal</p><h2>Independent first-open totals</h2></div><p>Raw totals are diagnostics, not ordered conversion.</p></div>
              <div className="growth-daily-chart" aria-label="Daily first opens chart">
                {summary.daily.map((row) => (
                  <div key={row.day} title={`${row.day}: ${row.first_open} first opens`}>
                    <i style={{ height: `${Math.max(3, (row.first_open / maxDaily) * 100)}%` }} />
                    <span>{row.day.slice(5)}</span>
                  </div>
                ))}
              </div>
              <div className="growth-health-grid">
                <div><span>Webhooks received</span><strong>{summary.webhook_health.received.toLocaleString()}</strong></div>
                <div><span>Processed</span><strong>{summary.webhook_health.processed.toLocaleString()}</strong></div>
                <div className={summary.webhook_health.pending ? 'growth-warning' : ''}><span>Pending</span><strong>{summary.webhook_health.pending.toLocaleString()}</strong></div>
                <div><span>Ended updates</span><strong>{summary.authoritative_subscriptions.ended_updates.toLocaleString()}</strong></div>
              </div>
            </section>
          </div>

          <section className="growth-panel">
            <div className="growth-panel-heading">
              <div><p className="growth-kicker">Authoritative conversion truth</p><h2>Production subscription transitions</h2></div>
              <p>Overall totals remain visible. Day and provider/plan segments appear only after 20 distinct subscriptions.</p>
            </div>
            <div className="growth-health-grid">
              <div><span>Trial starts</span><strong>{summary.authoritative_transitions.trial_started.toLocaleString()}</strong></div>
              <div><span>Paid starts</span><strong>{summary.authoritative_transitions.paid_started.toLocaleString()}</strong></div>
            </div>
            {summary.authoritative_transitions.by_provider_plan.length ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>Provider / plan</th><th>Phase</th><th>Transitions</th><th>Distinct subscriptions</th></tr></thead>
                  <tbody>{summary.authoritative_transitions.by_provider_plan.map((row) => (
                    <tr key={`${row.provider}:${row.plan}:${row.phase}`}>
                      <td><strong>{humanize(row.provider)}</strong><small>{humanize(row.plan)}</small></td>
                      <td>{humanize(row.phase)}</td>
                      <td>{row.transitions.toLocaleString()}</td>
                      <td>{row.distinct_subscriptions.toLocaleString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="growth-table-empty">No provider/plan segment has reached the 20-subscription reporting threshold.</p>}
          </section>

          <section className="growth-panel">
            <div className="growth-panel-heading">
              <div><p className="growth-kicker">Purchase reliability</p><h2>IAP diagnostics</h2></div>
              <p>{summary.iap_diagnostics.audit_available
                ? 'Client checkout stages and server receipt validation are being audited without storing raw receipts or purchase tokens.'
                : 'IAP audit storage is unavailable. Investigate before interpreting checkout conversion.'}</p>
            </div>
            <div className="growth-health-grid">
              <div><span>Client events</span><strong>{summary.iap_diagnostics.client_events.toLocaleString()}</strong></div>
              <div className={summary.iap_diagnostics.client_failures ? 'growth-warning' : ''}><span>Client issues</span><strong>{summary.iap_diagnostics.client_failures.toLocaleString()}</strong></div>
              <div className={summary.iap_diagnostics.server_failures ? 'growth-warning' : ''}><span>Server failures</span><strong>{summary.iap_diagnostics.server_failures.toLocaleString()}</strong></div>
              <div><span>Verified receipts</span><strong>{summary.iap_diagnostics.verified_receipts.toLocaleString()}</strong></div>
            </div>
            {(summary.iap_diagnostics.by_client_issue.length || summary.iap_diagnostics.by_server_error.length) ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>Source</th><th>Stage / error</th><th>Count</th></tr></thead>
                  <tbody>
                    {summary.iap_diagnostics.by_client_issue.map((row) => (
                      <tr key={`client:${row.key}`}><td>Client</td><td>{humanize(row.key)}</td><td>{row.count}</td></tr>
                    ))}
                    {summary.iap_diagnostics.by_server_error.map((row) => (
                      <tr key={`server:${row.key}`}><td>Server</td><td>{humanize(row.key)}</td><td>{row.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="growth-table-empty">No purchase failures in this window.</p>}
          </section>

          <section className="growth-panel">
            <div className="growth-panel-heading">
              <div><p className="growth-kicker">Onboarding diagnosis</p><h2>Step-level drop-off</h2></div>
              <p>Launch routing, named steps, interactions, and time buckets are privacy-safe; answers themselves are never collected.</p>
            </div>
            <div className="growth-health-grid">
              <div><span>Routes resolved</span><strong>{metric(summary.routing_diagnostics?.decisions)}</strong></div>
              <div><span>Routed to onboarding</span><strong>{onboardingRouteInstalls.toLocaleString()}</strong></div>
              <div><span>Onboarding starts</span><strong>{onboardingStarts.toLocaleString()}</strong></div>
              <div className={onboardingErrorEvents ? 'growth-warning' : ''}><span>Save / route errors</span><strong>{onboardingErrorEvents.toLocaleString()}</strong></div>
            </div>
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead><tr><th>Launch destination / state</th><th>Unique installs</th><th>Decisions</th></tr></thead>
                <tbody>
                  {summary.routing_diagnostics?.by_destination.length ? summary.routing_diagnostics.by_destination.map((row) => (
                    <tr key={row.key}><td>{humanize(row.key)}</td><td>{row.unique_installs}</td><td>{row.event_count}</td></tr>
                  )) : <tr><td colSpan={3} className="growth-table-empty">Launch routing telemetry will appear after the mobile update reaches users.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead><tr><th>Step</th><th>Unique installs</th><th>Total events</th></tr></thead>
                <tbody>
                  {summary.onboarding_steps?.length ? summary.onboarding_steps.map((row) => (
                    <tr key={row.step_key}>
                      <td>{ONBOARDING_STEP_LABELS[row.step_key] ?? humanize(row.step_key)}</td>
                      <td>{row.unique_installs.toLocaleString()}</td>
                      <td>{row.event_count.toLocaleString()}</td>
                    </tr>
                  )) : <tr><td colSpan={3} className="growth-table-empty">No named onboarding steps in this window yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="growth-health-grid">
              <div><span>Auth screen reached</span><strong>{metric(summary.auth_diagnostics?.screen_installs)}</strong></div>
              <div><span>Auth attempt installs</span><strong>{metric(summary.auth_diagnostics?.attempt_installs)}</strong></div>
              <div><span>Successful auth</span><strong>{authSucceeded.toLocaleString()}</strong></div>
              <div className={authFailed ? 'growth-warning' : ''}><span>Failed / cancelled</span><strong>{authFailed.toLocaleString()}</strong></div>
            </div>
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead><tr><th>Onboarding action</th><th>Unique installs</th><th>Total events</th></tr></thead>
                <tbody>
                  {summary.onboarding_step_results?.length ? summary.onboarding_step_results.map((row) => (
                    <tr key={row.key}>
                      <td>{humanize(row.key)}</td>
                      <td>{row.unique_installs.toLocaleString()}</td>
                      <td>{row.event_count.toLocaleString()}</td>
                    </tr>
                  )) : <tr><td colSpan={3} className="growth-table-empty">Step outcomes will appear after the new mobile release reaches users.</td></tr>}
                </tbody>
              </table>
            </div>
            {summary.onboarding_diagnostics?.by_step_duration.length ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>Step / outcome / time</th><th>Unique installs</th><th>Events</th></tr></thead>
                  <tbody>{summary.onboarding_diagnostics.by_step_duration.map((row) => (
                    <tr key={row.key}><td>{humanize(row.key)}</td><td>{row.unique_installs}</td><td>{row.event_count}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : null}
            {summary.onboarding_diagnostics?.by_interaction.length ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>Interaction / selection count</th><th>Unique installs</th><th>Events</th></tr></thead>
                  <tbody>{summary.onboarding_diagnostics.by_interaction.map((row) => (
                    <tr key={row.key}><td>{humanize(row.key)}</td><td>{row.unique_installs}</td><td>{row.event_count}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            ) : null}
            {summary.onboarding_diagnostics?.by_error.length ? (
              <div className="growth-alert" role="status">
                {summary.onboarding_diagnostics.by_error.map((row) => `${humanize(row.key)}: ${row.event_count}`).join(' · ')}
              </div>
            ) : null}
            {summary.auth_diagnostics?.by_attempt.length ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>Auth stage / mode / method / outcome</th><th>Unique installs</th><th>Total events</th></tr></thead>
                  <tbody>
                    {summary.auth_diagnostics.by_attempt.map((row) => (
                      <tr key={row.key}><td>{humanize(row.key)}</td><td>{row.unique_installs}</td><td>{row.event_count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            {summary.release_cohorts.length ? (
              <div className="growth-table-wrap">
                <table className="growth-table">
                  <thead><tr><th>App / build / runtime / variant</th><th>Ordered stage</th><th>Cohort installs</th><th>Qualified installs</th></tr></thead>
                  <tbody>{summary.release_cohorts.map((row) => (
                    <tr key={`${row.app_version}:${row.build_number}:${row.runtime_version}:${row.funnel_variant}:${row.event_name}`}>
                      <td><strong>{row.app_version} · {row.build_number}</strong><small>runtime {row.runtime_version} · {humanize(row.funnel_variant)}</small></td>
                      <td>{FUNNEL_LABELS[row.event_name] ?? humanize(row.event_name)} <small>stage {row.stage_order}</small></td>
                      <td>{row.cohort_installations}</td>
                      <td>{row.unique_installs} <small>{percentage(row.unique_installs, row.cohort_installations)}</small></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="growth-panel">
            <div className="growth-panel-heading">
              <div><p className="growth-kicker">Source-qualified directional economics</p><h2>Campaign signal, separate from blended CAC</h2></div>
              <p>Campaign costs use client-observed source events and are not authoritative CAC. Subscription transitions are intentionally not joined through shared Auth; use the blended authoritative CAC above and Google Ads/Play Console for source reconciliation.</p>
            </div>
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead><tr><th>Source / campaign</th><th>Spend</th><th>Landing</th><th>Store CTA</th><th>First opens</th><th>Client trials</th><th>Client paid</th><th>Directional cost / trial</th><th>Directional cost / paid</th></tr></thead>
                <tbody>
                  {summary.campaigns.length ? summary.campaigns.map((row) => (
                    <tr key={`${row.source}:${row.campaign}`}>
                      <td><strong>{row.source}</strong><small>{row.campaign}</small></td>
                      <td>{money(row.spend_cents, row.currency || 'BRL')}</td>
                      <td>{metric(row.landing_views)}</td>
                      <td>{metric(row.store_cta_clicks)}</td>
                      <td>{metric(row.first_opens)}</td>
                      <td>{metric(row.trial_starts)}</td>
                      <td>{metric(row.paid_starts)}</td>
                      <td>{money(row.cost_per_trial_cents, row.currency || 'BRL')}</td>
                      <td>{money(row.cost_per_paid_start_cents, row.currency || 'BRL')}</td>
                    </tr>
                  )) : <tr><td colSpan={9} className="growth-table-empty">No campaign data in this window.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="growth-panel">
            <div className="growth-panel-heading"><div><p className="growth-kicker">Diagnostic mature cohorts</p><h2>Independent activation and retention totals</h2></div><p>These raw totals are not ordered conversions. Cohorts below 20 installs are suppressed by both SQL and the API.</p></div>
            <div className="growth-table-wrap">
              <table className="growth-table">
                <thead><tr><th>Cohort</th><th>Installs</th><th>Onboarded</th><th>Accounts</th><th>Trials</th><th>Paid</th><th>Activated 24h</th><th>D1</th><th>D7</th></tr></thead>
                <tbody>
                  {summary.cohorts.length ? summary.cohorts.map((row) => (
                    <tr key={row.cohort_day}>
                      <td><strong>{row.cohort_day}</strong></td><td>{row.installs}</td>
                      <td>{row.onboarding_completed} <small>{percentage(row.onboarding_completed, row.installs)}</small></td>
                      <td>{row.account_created}</td><td>{row.trial_started}</td><td>{row.subscription_paid_started}</td>
                      <td>{row.activated_24h} <small>{percentage(row.activated_24h, row.installs)}</small></td>
                      <td>{row.d1_retained} <small>{percentage(row.d1_retained, row.installs)}</small></td>
                      <td>{row.d7_retained} <small>{percentage(row.d7_retained, row.installs)}</small></td>
                    </tr>
                  )) : <tr><td colSpan={9} className="growth-table-empty">No reportable cohorts yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <section className="growth-panel growth-spend-panel">
            <div><p className="growth-kicker">Manual spend ledger</p><h2>Record one source/campaign/day</h2><p>Use the exact normalized campaign ID. Saving the same date, source, and campaign replaces that day’s amount instead of duplicating it.</p></div>
            <form className="growth-spend-form" onSubmit={saveSpend}>
              <label className="growth-field"><span>Date</span><input required type="date" value={spendDate} onChange={(event) => setSpendDate(event.target.value)} /></label>
              <label className="growth-field"><span>Source</span><input required value={spendSource} onChange={(event) => setSpendSource(event.target.value)} placeholder="google" /></label>
              <label className="growth-field growth-campaign-field"><span>Campaign</span><input required value={spendCampaign} onChange={(event) => setSpendCampaign(event.target.value)} /></label>
              <label className="growth-field"><span>Spend (BRL)</span><input required inputMode="decimal" value={spendBrl} onChange={(event) => setSpendBrl(event.target.value)} placeholder="46,00" /></label>
              <button className="growth-button growth-button-primary" type="submit">Save spend</button>
              <output aria-live="polite">{spendStatus}</output>
            </form>
          </section>

          <footer className="growth-console-footer">
            <p>No prayer text, searches, notes, posts, profile data, email, names, tokens, receipts, or religious preferences belong in this report.</p>
            <p>Raw growth events are temporary; longer-term decisions use aggregate cohorts.</p>
          </footer>
        </>
      ) : null}
    </main>
  );
}
