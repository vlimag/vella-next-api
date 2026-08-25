# Vella first-party growth analytics

This subsystem measures the install-to-subscription funnel without accepting
free-form user content. It is deliberately separate from Scripture searches,
prayers, journal entries, notification bodies, social posts, IP addresses,
user agents, raw URLs and raw referrers.

## Event ingestion

`POST /api/v1/analytics/events`

Request headers:

- `Content-Type: application/json`
- `Authorization: Bearer <Supabase access token>` only when the user has an
  authenticated session. If a bearer token is supplied and invalid, the whole
  request is rejected; it is never downgraded to anonymous.

Envelope (one to 20 events, maximum 32 KiB):

```json
{
  "events": [
    {
      "event_id": "22222222-2222-4222-8222-222222222222",
      "install_id": "11111111-1111-4111-8111-111111111111",
      "event_name": "first_open",
      "occurred_at": "2026-08-06T12:00:00.000Z",
      "platform": "android",
      "app_version": "1.0.0",
      "build_number": "8",
      "runtime_version": "1.0.0",
      "funnel_variant": "compact_v2",
      "locale": "pt",
      "session_id": "33333333-3333-4333-8333-333333333333",
      "properties": {}
    }
  ]
}
```

`event_id` is the idempotency key. `install_id` is a random installation UUID,
not an advertising identifier and not a device fingerprint. A batch may contain
only one installation ID. A bearer token is verified only to gate post-auth
event names; its account ID is neither accepted in the payload, passed to the
ingestion RPC, nor persisted in analytics.

Native Runtime 1.3+ envelopes carry the closed `funnel_variant` value
`legacy_v1` or `compact_v2`. Runtime-1.2 queued envelopes remain readable
without that field. The event-specific `first_experience_step.variant` exists
only to discriminate its two payload shapes; neither variant value is forwarded
as a Firebase marketing property.

Successful response (`202`):

```json
{
  "data": {
    "accepted": 1,
    "inserted": 1,
    "duplicates": 0,
    "retention_policy": "raw_90_days"
  }
}
```

Status codes: `400` invalid schema/time/platform, `401` missing or invalid auth
for authenticated events, `413` too large, `415` wrong content type, `429` rate
limit, and `503` temporary ingestion failure. Clients should never retry a
permanent `4xx` other than `429`; retries keep the same `event_id`.

## Strict event catalog

Existing acquisition and product-mechanics events may carry only the optional
normalized attribution codes `source`, `medium`, `campaign`, and `content`.
Values are short codes such as `google`, `cpc`, `android_launch_br`, not URLs
or human-authored text. The first-experience and paywall events added below
accept exactly their listed properties and no attribution fields.

| Event | Auth | Additional properties |
| --- | --- | --- |
| `landing_viewed` | anonymous | none |
| `store_cta_clicked` | anonymous | `cta_id`, `store: android\|ios` |
| `first_open` | anonymous | none |
| `app_session_started` | anonymous | none; correlated only by an ephemeral random `session_id` |
| `route_resolved` | anonymous | coarse destination (`onboarding\|first-experience\|offer\|authentication\|subscription-verification\|paywall\|app`), access states, and launch-time bucket |
| `first_experience_viewed` | anonymous | `variant: v1\|compact_v2`, `content_source: remote\|fallback` |
| `first_experience_step` | anonymous | legacy: no `variant`, `step_number` 1–4, `total_steps: 4`, `step_key: arrival\|scripture\|reflection\|completion`; compact: `variant: compact_v2`, `step_number` 1–2, `total_steps: 2`, `step_key: moment\|completion`; coarse `result` only |
| `first_experience_completed` | anonymous | coarse `duration_bucket`, `content_source: remote\|fallback` |
| `first_experience_error` | anonymous | allowlisted stage/code only; never content or raw errors |
| `onboarding_started` | anonymous | none |
| `onboarding_step` | anonymous | `step_number`, `total_steps` (1–20), privacy-safe `step_key: language\|goal\|focus\|minutes\|rhythm\|reminder_style\|preview\|reminders` |
| `onboarding_step_result` | anonymous | step fields, coarse result, optional selection count and duration bucket |
| `onboarding_interaction` | anonymous | step, selected/deselected/CTA action, and selection count only |
| `onboarding_error` | anonymous | step plus allowlisted failure stage/code; never raw errors |
| `onboarding_completed` | anonymous | coarse duration bucket and goal/focus counts; empty legacy payload remains accepted |
| `auth_started` | anonymous | optional `entry_point: post_onboarding\|post_first_experience\|premium\|tabs\|direct` |
| `auth_attempt` | anonymous | `mode`, `method`, `stage`, and coarse `outcome`; never provider errors or identity |
| `account_created` | bearer | legacy diagnostic only: `method: email\|apple\|google`; never Vella acquisition truth |
| `vella_profile_initialized` | bearer | truthful Vella acquisition signal from the profile-insert winner: `provider_class: email\|google\|apple` |
| `paywall_viewed` | anonymous | none |
| `trial_terms_viewed` | anonymous | `plan: yearly`, `trial_days_bucket: 14_days\|other` |
| `subscription_management_opened` | bearer | `source: paywall\|settings`, `result: opened\|failed` |
| `plan_selected` | anonymous | `plan: monthly\|yearly` |
| `checkout_started` | bearer | `plan: monthly\|yearly` |
| `purchase_validation_result` | bearer | `result: verified_active\|rejected`, `plan: monthly\|yearly` |
| `trial_started` | bearer | `plan: monthly\|yearly` |
| `subscription_paid_started` | bearer | `plan: monthly\|yearly` |
| `meaningful_session_completed` | bearer | none |
| `notification_permission_result` | bearer | `result: granted\|denied\|unavailable\|error` |
| `notification_opened` | bearer | none |

Website events use `platform: "web"` and `app_version: "site"`. Other events
must use `ios` or `android`. The website contract intentionally has no
`page_id`, raw location, or referrer.

Client subscription events express what the client observed and are useful for
funnel diagnostics. They are **not** revenue truth. The operator report derives
its authoritative subscription section only from store-verified subscription
rows and webhook processing state.

## Native acquisition attribution

Runtime 1.3 clients can call `POST /api/v1/attribution/install` with at most
8 KiB of JSON. Android sends the random first-party installation UUID plus only
the closed `source`, `medium`, `campaign`, and `creative_code` values projected
from Play Install Referrer. iOS sends that UUID plus a transient AdServices
token. The API exchanges the token directly with Apple's documented endpoint,
requires the configured `APPLE_ADS_ORG_ID`, then discards the token and Apple
response body. Apple numeric IDs must be positive JavaScript-safe integers;
out-of-range payloads fail closed rather than being rounded. The stored
`conversion_type` distinguishes Download, Redownload, and PreOrder, so the
metric is described as an attributed app conversion rather than always as a
new install.

`POST /api/v1/attribution/install/link` is bearer-authenticated and accepts only
the installation UUID and platform. It verifies that the current shared Auth
identity already has a `faith_harbor.profiles` row, then links that server user;
the client cannot choose a `user_id`. Capture and link are order-independent:
either operation creates the same neutral pending install row. A transient
Apple failure stays pending, a documented `200 attribution:false` becomes
resolved-unattributed, and replay after either resolved outcome returns
idempotent success without another Apple call. Pending rows never count as
organic, unattributed, or source-qualified reporting.

For iOS, the resolved attribution row, Apple fetch-lease release, and global
circuit-breaker success reset are committed by one database function. A crash
or lost HTTP response after that commit therefore replays as already resolved;
it cannot leave a successful exchange recorded while a stale failure streak
remains armed. The generic resolved-record function is Android-only so Apple
truth cannot bypass this atomic boundary.

The service-only database keeps capped permanent account-switch truth. One
installation linked to two distinct Vella profiles is permanently ambiguous,
even if a profile is later deleted. Deletion removes the current profile link,
seals every affected install as permanently ambiguous, and erases the
deterministic profile derivative; the retained row contains only the capped
anti-reattribution marker. Inactive, never-linked attribution rows that are
more than 93 days old are removed in bounded, locked batches; any row that has
ever carried profile/ambiguity truth is retained so deletion cannot enable
later re-attribution. A subscription transition is source-qualified
only when exactly one non-ambiguous install matches its store provider/platform,
was captured no later than and no more than 30 days before the production
transition, and meets the closed source registry. The current approved Android
registry entry is `google` / `cpc` /
`vella_br_android_202608_prayerdaily`; other syntactically safe Play values are
retained only as directional diagnostics and cannot join spend/conversion truth.
Zero or multiple eligible sources remain `platform_blended`.

This is directional first-party measurement, not app attestation. Random UUID
per-install limits deter ordinary retry storms but can be forged, so the atomic
fixed global database breaker is the authoritative server-capacity backstop.
Configure a platform-edge/WAF rate rule for this endpoint before paid traffic;
the API deliberately does not collect IP addresses or device fingerprints to
simulate an abuse-proof identity.

## Operator report

The existing operator secret is required as `x-vella-operator-key`.

`GET /api/v1/operator/growth/summary?from=2026-07-01&to=2026-07-31&cohort_days=14`

The maximum inclusive reporting window is 93 days. The response contains:

The API does not pass through the RPC JSON. It recursively projects only the
documented fields below, drops unknown keys and non-object array entries, and
maps every categorical dimension through a closed allowlist. Unrecognized
categories use the fixed `unknown` label; newly approved campaign or store
product codes require an allowlist update. Aggregate numbers survive only as
finite, nonnegative safe integers within the field's range. Invalid required
counts become zero and invalid nullable campaign metrics become `null`.

- `ordered_funnel`: qualified unique installations for the closed
  `legacy_v1` and `compact_v2` graphs. The report uses each installation's
  first occurrence of a stage and counts it only when every required preceding
  stage occurred at or before it. Ordering uses `occurred_at`, never receipt
  order. `legacy_v1` authenticates before paywall/plan; `compact_v2` shows
  paywall/plan before authentication. Variants never borrow predecessor events
  from each other. An upgraded installation that legitimately emits a first
  open in both variants appears once in each variant cohort;
- `diagnostic_totals`: independent raw `funnel`, `daily`, `cohorts`,
  `campaigns`, subscription-state, and webhook aggregates. These are useful
  for telemetry health and directional diagnosis but are not ordered
  conversion truth. Its explicit **Vella profiles initialized**
  (`vella_profile_initialized`) metric reports profile-insert winners as
  Vella's truthful acquisition boundary. It is not a
  mandatory predecessor in either ordered funnel. Legacy `account_created`
  counts remain diagnostic only;
- `release_cohorts`: the ordered graph split by app version, build, runtime,
  platform, first-open `cohort_day`, and closed funnel variant, anchored to
  first open. Each exact combination appears only at 20 distinct
  installations; sub-threshold iOS, Android, or day buckets are never merged;
- `authoritative_transitions`: overall production `trial_started` and
  `paid_started` totals from `subscription_marketing_transitions` only.
  Daily and provider/plan/phase segments require at least 20 distinct
  subscriptions. Client `trial_started` or `subscription_paid_started`
  events never contribute to these totals;
- `funnel`, `daily`, `cohorts`, `campaigns`,
  `authoritative_subscriptions`, and `webhook_health`: legacy top-level
  diagnostic keys retained unchanged for migration-first API compatibility;
- `onboarding_steps`, `onboarding_step_results`, and `onboarding_diagnostics`:
  privacy-safe reach, outcomes, time buckets, selection counts, and allowlisted
  failure stages for each onboarding screen;
- `routing_diagnostics`: initial route decisions and launch-time buckets, so a
  protected-route regression is visible separately from user abandonment;
- `first_experience_diagnostics`: aggregate unique installs for viewed,
  completed and error lifecycle events; per-step install/event counts; and
  Android/iOS build/runtime rows. Step and release breakdown rows below 20
  installs are suppressed, while permitted overall totals remain available. It
  contains no event properties or installation identifiers;
- `release_funnel`: legacy route-derived release diagnostics retained for
  compatibility. Rows below 20 first opens are removed again by the API;
- `auth_diagnostics`: aggregate auth-screen reach and coarse method/outcome
  counts, with no account identifier or provider error text;
- `iap_diagnostics`: privacy-safe client, server, verified-receipt, and
  `subscription_already_linked` aggregates. Consumers must check
  `audit_available` first: when it is `false`, every other value may be partial
  or a zero placeholder retained for response compatibility and must not be
  interpreted as reliable. A `row_limit_reached` value of `true` means the
  5,000-row query cap was reached and all IAP counts and breakdowns are lower
  bounds. `repeated_conflict_attempts` counts additional attempts sharing an
  already-counted valid proof; it is consistent with retries or replays but is
  not proof of user count or retry causality. Missing or malformed fingerprints
  count as unfingerprinted, and fingerprint fields or values are never returned
  or logged. Query-failure logs contain only fixed per-query failure booleans.
  Client issue, server error, and verified phase dimensions use explicit closed
  allowlists; any missing, malformed, or unexpected value is grouped under the
  fixed `unknown` label rather than echoed from storage;
- `authoritative_subscriptions`: current/store-verified lifecycle totals;
- `webhook_health`: received, processed and pending Apple/Google events;
- `privacy`: retention and suppression metadata. Risk-reducing privacy claims
  fail closed when their stored value is malformed.

All onboarding, routing, authentication, completion, load-time, subscription,
webhook, IAP, campaign, and release dimensions follow this allowlist boundary.
Stored labels are never trimmed, lowercased, or string-coerced into acceptance.

Cohort rows below 20 installations are omitted. Campaign event metrics below
20 attributed installations are suppressed by SQL and independently by the
API. Spend-only campaign rows still appear so accounting input is never
silently hidden. Subscription provider/product groups below 20 are also
omitted. Overall authoritative transition totals remain visible, while every
transition day/provider/plan segment requires 20 distinct subscriptions.

The dashboard's **Install-variant cohort memberships** value is the sum of
the two closed variant cohorts. An upgraded installation can belong once to
each variant, so this value must never be described as globally unique
installations.

An active-subscriber bypass is a closed outcome only for an exact
`route_resolved` event whose stored `actor_type` is `authenticated` and
whose allowlisted properties say `destination=app`,
`auth_state=authenticated`, and `subscription_state=active`. A bearer token
or anonymous event cannot create this outcome. Reporting never joins analytics
installations or subscription transitions to shared Auth users.

The dashboard labels all spend in the selected period divided by authoritative
paid transitions in that independently selected period as **Period spend per authoritative paid transition**. This is an observation only ratio, is not
cohort-aligned CAC, and cannot authorize spend. Campaign-level source-qualified
costs remain directional client-event metrics; without a privacy-approved
install-referrer bridge, they must not be presented as authoritative
source-qualified CAC. **Paid campaigns remain paused** until a separate,
explicit decision uses reconciled store/ad-platform evidence.

Task 5 database rollout uses two project-scoped, transaction-safe artifacts.
Use Supabase MCP `apply_migration` for the summary migration first. List remote
migrations, record its authoritative version, and rename the unchanged local
summary file to that version. Use the same project-scoped MCP operation for the
index migration second; list remote migrations again and rename the unchanged
local index file to its authoritative version. The index artifact sets local
`lock_timeout = '2s'` and `statement_timeout = '30s'` before a plain
`CREATE INDEX`, with no `IF NOT EXISTS`. The measured live table is only 4,180
rows / about 2.3 MB total: the lock must be acquired promptly and the build is
bounded, or the atomic migration fails and rolls back without leaving a queued
deployment.

Before deploying the API, require both authoritative migration-history rows
in order and verify the exact index definition plus
`pg_index.indisvalid = true` and `pg_index.indisready = true`. Any migration,
history, timeout, name-conflict, definition, validity, or readiness failure
keeps the API undeployed while the database state is inspected. Do not use an
untracked CLI or SQL execution path for either artifact.

## Campaign spend input

`POST /api/v1/operator/growth/spend`

```json
{
  "items": [
    {
      "date": "2026-08-06",
      "source": "google",
      "campaign": "android_launch_br",
      "currency": "BRL",
      "spend_cents": 150000
    }
  ]
}
```

One to 100 strict items are accepted. Values are normalized to lowercase and
upserted by date/source/campaign/currency, so importing the same daily export is
safe. Store money as integer centavos. The endpoint currently accepts BRL only;
do currency conversion before import rather than combining unlike currencies.

## Privacy, access and retention

- Tables use RLS, grant no access to `anon`/`authenticated`, and are reachable
  only by the service role through server endpoints.
- Properties are scalar, key-allowlisted and length-bounded in both Zod and a
  database constraint. There is no general-purpose metadata bag.
- Each raw event receives `delete_after` and `retention_policy=raw_90_days`.
- Ingestion performs bounded opportunistic deletion. The authenticated Vercel
  cron `/api/cron/growth-retention` also deletes expired rows daily in bounded
  batches. `CRON_SECRET` must be configured.
- The ingestion rate limit is 120 new events/minute and 2,000/24 hours per
  installation. A global circuit breaker opens above 10,000 new events/minute
  or 500,000/24 hours, protecting the service even if installation IDs rotate.
  The checks are atomic, and idempotent duplicates do not consume either
  new-event allowance.
- Operator responses use `Cache-Control: no-store`.

## Rollout checklist

1. Apply all reviewed growth migrations in order. For compact-v2, install the
   additive v6 property validator before changing the API; it delegates every
   shipped legacy shape to v5, adds the closed compact/offer branches, and
   intentionally narrows paywall, plan-selection, and checkout properties to
   their exact coarse shapes. Shipped clients already emit those exact shapes.
   Verify the property, first-experience variant, and authenticated-checkout
   constraints before continuing.
2. Deploy the API with the compact-v2 union and anonymous allowlist. During this
   step shipped legacy clients keep their four-step shape and existing bearer
   behavior.
3. Deploy the compact mobile producer last. Change the native analytics
   singleton to `compact_v2` only in the same client release that activates the
   compact controller; the currently shipped four-screen flow remains
   `legacy_v1`.
4. Send one synthetic web event, one anonymous app event and one authenticated
   event; verify `accepted/inserted/duplicates`.
5. Confirm anonymous paywall/plan/trial-term intent is accepted, anonymous
   checkout is rejected, and invalid bearer tokens are never downgraded.
6. Import a small BRL spend sample and inspect the operator summary.
7. Verify the retention cron in Vercel logs. Do not add raw payload logging.

No third-party tracker is required; producers send only the strict first-party
contract above.
