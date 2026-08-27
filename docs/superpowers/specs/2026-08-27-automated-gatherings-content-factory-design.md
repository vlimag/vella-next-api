# Automated Gatherings Content Factory

**Date:** 2026-08-27

**Status:** Product direction approved; written design awaiting final review

**Scope:** Gatherings only. No live community events and no unrelated product work.

## 1. Outcome

Vella will publish two high-quality digital guided Gatherings every week without manual editorial work:

- **Monday:** opening, intention, and direction for the week.
- **Thursday:** renewal, rest, and recentering before the weekend.

Each Gathering is a 12–18 minute private guided experience. Users may complete either one at any time and in any order. Released Gatherings stay replayable in history. The system keeps at least six weeks of future inventory, measures engagement without collecting private prayer content, and emails the operator when automation or inventory is unhealthy.

This complements journeys and practices; it does not replace the seven-day path or create a synchronous community feature.

## 2. Product Decisions

### 2.1 Weekly experience

- Monday and Thursday each unlock one distinct Gathering.
- The UI shows both current Gatherings, completion state, duration, theme, and the exact next release time.
- A completed Gathering remains available in the catalog and may be replayed without changing its original completion award.
- There is no forced order, expiration, or artificial deadline.
- The system presents a localized exact date and countdown for the next release.
- If generated inventory is unavailable, a curated evergreen fallback keeps the screen useful and prevents an empty state.

### 2.2 Content shape

Every Gathering has exactly eight structured steps:

1. Arrival and breathing.
2. Opening intention.
3. Canonical Scripture passage.
4. Guided reflection.
5. Quiet pause.
6. Prayer prompt.
7. One gentle next action.
8. Closing blessing and completion.

The experience must be Christian, warm, denomination-neutral, non-manipulative, and useful without pretending to replace clergy, therapy, or medical care.

### 2.3 Rewards

Completion feeds the existing milestones and badges system. Rewards recognize meaningful consistency and longer paths; they do not punish missed days or use loss aversion. The same Gathering can be replayed, but unique-completion badges count it only once.

## 3. Architecture

```text
Daily Vercel Cron
      |
      v
Inventory check ---- enough inventory ----> record healthy heartbeat
      |
      v
GPT-5.6 Sol generator -> deterministic validation -> independent reviewer
      |                                               |
      +---------------- failed ------------------------+
      |                         persist incident + email
      v
Atomic publish of immutable localized Gathering version
      |
      +--> v2 catalog/current/next API
      +--> aggregate telemetry and operator diagnostics

Independent Supabase Cron watchdog
      |
      +--> detect missing heartbeat / low inventory / stale incident
      +--> send or retry operational email independently of Vercel
```

### 3.1 Primary content factory

A protected Vercel Cron route runs daily. It acquires a database advisory lock so concurrent retries cannot create duplicate slots. It calculates future Monday/Thursday slots and generates only the missing inventory required to restore the six-week target.

The factory uses the OpenAI Responses API with `gpt-5.6-sol`, strict structured output, a versioned prompt, and a fixed schema. The exact model identifier, prompt revision, token usage, cost, response hash, and validation result are recorded for each run. A future model is never adopted automatically; model upgrades require the same evaluation suite and an explicit configuration change.

### 3.2 Generation and review

The first model call drafts the editorial content. A separate reviewer call receives the structured draft and a review rubric. Deterministic server-side validators remain authoritative; reviewer approval alone cannot publish content.

The pipeline rejects content that fails any of these checks:

- schema, eight-step structure, duration, or locale completeness;
- denomination-neutral Christian tone and age-appropriate language;
- medical, legal, political, or diagnostic claims;
- emotional manipulation, guaranteed outcomes, fabricated quotations, or fear-based retention language;
- excessive similarity to recent Gatherings;
- an unapproved Scripture reference or mismatch with the canonical corpus;
- unsafe instructions or content that should be escalated rather than published.

The AI may select an approved Scripture reference, but it may not write or translate Scripture. The server resolves the reference to an approved canonical verse ID and localized text already stored in Vella's corpus.

### 3.3 Immutable publishing

Content is immutable after publication. Corrections create a new editorial version with a new content hash. Publishing the template, eight localized step sets, Scripture linkage, and schedule happens in one transaction. A partial locale or partial step set is never visible.

## 4. Scheduling Semantics

Templates carry a release week and a slot type (`monday` or `thursday`), rather than one globally ambiguous timestamp. The v2 read layer calculates eligibility in the user's IANA timezone:

- Monday slot: local Monday at 00:00.
- Thursday slot: local Thursday at 00:00.
- Missing or invalid timezone: UTC fallback.

The API returns the resolved `available_from`, `next_available_at`, and timezone used. This guarantees that “Monday” and “Thursday” remain correct around the world and lets the mobile UI render an exact localized countdown. Daylight-saving calculations use PostgreSQL timezone data, never a fixed UTC offset.

Once locally released, a template remains available in the catalog. The two most recent eligible slots are featured; older ones remain under history.

## 5. Additive Data Model

All schema changes are additive and live in the existing `faith_harbor` boundary. Existing tables and progress data remain valid.

### 5.1 Gathering content

The current Gathering template representation gains or is accompanied by additive fields for:

- `release_week`;
- `slot_type` (`monday` or `thursday`);
- `source_kind` (`generated` or `evergreen`);
- immutable `content_hash`;
- `generation_run_id`;
- `prompt_revision` and `editorial_revision`;
- quality and safety validation metadata;
- publication state and timestamps.

The existing `user_gathering_progress` identity remains template-based so parallel current Gatherings and historical replays work without overwriting each other.

### 5.2 Operational tables

Add private, server-written records for:

- `gathering_generation_runs`: lifecycle, model, prompt revision, hashes, token/cost totals, validation result, and privacy-safe error code;
- `gathering_generation_incidents`: deduplicated open/recovered operational incidents and email state;
- `gathering_automation_heartbeats`: last Vercel execution, inventory depth, and last successful publish;
- aggregate per-template/slot/locale metrics used for reporting and later editorial selection.

Clients cannot insert or update these operational tables. Service-role access remains server-only. Row-level security and grants are tested explicitly.

## 6. API and Backward Compatibility

The current v1 implementation is frozen for old builds:

- `weekly-rest`, version `1`, and `editorial.1` continue to satisfy the current literal contract.
- `get_current_gathering_v1` and its route retain their existing response shape.
- No migration changes old template identifiers or existing progress rows.

A v2 API/RPC family provides:

- featured current Gatherings;
- complete eligible catalog and history;
- per-template progress and replay state;
- exact next release metadata;
- localized content with explicit fallback metadata;
- stable empty, fallback, offline-cache, and error states.

The new mobile OTA reads v2. If the OTA is rolled back, old clients continue on v1 with no database rollback. Backend and schema deploy before the OTA.

## 7. Localization

Every generated template must be complete in all supported locales: `en`, `es`, `pt`, `fr`, `de`, `it`, `ru`, and `pl`.

Generation starts from one editorial source, then produces localized editorial copy. Each locale receives its own review pass for natural phrasing and prohibited-content checks. Canonical Scripture is resolved independently per locale from the approved corpus. English fallback may keep a legacy client functional, but a generated template cannot be published while any locale is missing or invalid.

UI labels, dates, countdowns, “Gathering,” empty states, and error states use app localization keys; no English product label is embedded in content payloads.

## 8. Privacy-Safe Learning Loop

The factory may use only aggregate product telemetry:

- views and starts;
- per-step aggregate dropout;
- completion and resume rates;
- D1/D7 return;
- next meaningful product action;
- slot, theme, locale, app build, and runtime aggregates.

It must never send raw prayers, journal entries, searches, posts, emails, account identifiers, receipts, or user-level event trails to the generation prompt.

At low volume, themes rotate through a balanced editorial palette. Performance-based selection remains disabled until a candidate has at least 30 starts and its comparison set has at least 100 relevant starts. Later selection uses smoothed scores and diversity constraints; it never optimizes solely for time spent or compulsive return.

## 9. Inventory and Failure Handling

- **Target:** 12 future Gatherings, representing six weeks.
- **Warning:** fewer than 6 future Gatherings (three weeks).
- **Critical:** fewer than 2 future Gatherings (one week), no valid next slot, or no evergreen fallback.
- A run makes at most two generation attempts for one slot before opening an incident.
- Invalid candidates remain private and cannot be manually “half published.”
- All runs are idempotent by release week and slot type.
- A kill switch disables generated publishing while preserving existing and evergreen content.
- Failed runs persist enough safe diagnostic data for retry without storing secrets or personal data.

## 10. Alerts and Independent Watchdog

Operational email uses Resend with:

- `RESEND_API_KEY` stored only in server environment configuration;
- `OPS_ALERT_EMAIL`, defaulting to `support@vella.one` if not explicitly configured;
- a verified Vella sending domain;
- incident-based idempotency keys and cooldowns;
- one recovery email when an incident closes.

Alert emails contain stage, timestamp, run ID, privacy-safe error code, inventory depth, and a logs link. They never contain secrets, personal data, or raw generated content.

Vercel cannot reliably alert if its cron never starts. Therefore an independent Supabase Cron watchdog checks the heartbeat and inventory on a separate schedule. It can invoke the alert path when the Vercel heartbeat is stale, and it retries unsent persisted incidents if the original email call failed.

## 11. Observability

The operator growth summary adds a `gathering_automation` diagnostic section containing:

- future inventory total and weeks covered;
- next Monday and Thursday release times;
- last run and last successful publish;
- open incident and alert delivery state;
- rejected candidate counts by safe reason;
- model and prompt revision;
- aggregate current-slot view/start/completion/drop-off.

Logs use run IDs and safe codes. Generated prose and user data are excluded from production logs.

## 12. Mobile UX States

The Gatherings screen must render correctly for:

- both weekly items available;
- Monday available and Thursday upcoming;
- completed, resumed, and replayable items;
- anonymous but entitled user, with the existing sign-in requirement only when starting account-specific progress;
- offline cached catalog;
- evergreen fallback;
- recoverable network failure;
- no authenticated progress yet;
- exact next-release countdown.

Starting, resuming, and completing use stack screens with a working back path. The selected Gathering opens directly; it never flashes a blank screen or redirects through Home. Completion returns to the intended screen and updates Home, history, badges, and profile through cache invalidation.

## 13. Security and Cost Controls

- Cron routes require `CRON_SECRET`; all mutation paths remain server-only.
- Generation has per-run and monthly token/cost ceilings.
- Only missing slots are generated; retries reuse the incident and slot identity.
- Strict response schemas cap output size.
- Database advisory locking prevents duplicate spending.
- Model/provider timeouts fail closed and preserve existing inventory.
- No generated item is executable content; mobile renders known structured fields only.

## 14. Verification Strategy

### API and database

- v1 regression tests for the literal `weekly-rest` contract.
- v2 contract tests for two current items, catalog, history, progress, exact next release, and locale fallback metadata.
- timezone tests across DST, Monday/Thursday boundaries, invalid zones, and UTC fallback.
- schema, RLS, grant, idempotency, advisory-lock, atomic-publish, and rollback tests.
- all eight locales, exactly eight steps, canonical Scripture resolution, duration, safety, duplication, and immutable-version tests.
- cron tests for healthy inventory, refill, retry exhaustion, warning, critical, kill switch, and concurrent calls.
- watchdog tests for stale heartbeat, low inventory, email failure/retry, deduplication, and recovery.

### Mobile

- unit tests for catalog mapping, countdown, cache invalidation, resume, replay, and all UI states.
- navigation tests proving direct open, back behavior, and completion return target.
- simulator verification with fake clocks for Monday, Wednesday, Thursday, completed history, offline cache, anonymous access, and recoverable API errors.
- visual verification in light/dark mode and all supported locales, including long Russian and German strings.

### Production rollout

1. Apply additive schema and deploy v2/read compatibility.
2. Configure OpenAI, Resend, cron, watchdog, budget ceilings, and kill switch.
3. Generate and verify the initial 12-item inventory plus evergreen fallback.
4. Run production-safe cron and email smoke tests.
5. Deploy the mobile OTA to runtime 1.3 only after API diagnostics are healthy.
6. Monitor starts, completion, errors, queue depth, and alert delivery before expanding optimization.

## 15. Acceptance Criteria

- Two distinct Gatherings unlock every local week, Monday and Thursday.
- At least 12 valid future Gatherings exist after a healthy factory run.
- Every published item has eight validated steps and all eight locales.
- Scripture always comes from the approved canonical corpus.
- The UI always shows current items or a valid evergreen fallback and tells users exactly when the next item unlocks.
- Completed items remain replayable and unique completion is not double-awarded.
- Old v1 builds continue working unchanged; OTA rollback requires no SQL rollback.
- Missing cron execution, failed generation/review/publish, low inventory, and failed email delivery become persisted incidents and reach the configured operator email.
- No raw private content or personal data enters prompts, logs, diagnostics, or alert emails.
- Product telemetry can identify view-to-start, step dropout, completion, resume, and post-completion impact without user-level profiling.

## 16. Alternatives Rejected

- **Generate just in time:** too slow, expensive, and fragile at the moment of use.
- **Static content only:** safe but does not meet the no-manual-work requirement or sustain freshness.
- **AI direct-to-production:** unacceptable safety, Scripture, localization, and quality risk.
- **One global UTC release timestamp:** produces the wrong weekday for some users.
- **Six Gatherings per week:** unnecessary content pressure; the approved cadence is two per week with six weeks of queued inventory.
- **Live community Gathering now:** excluded until the product has enough users and moderation capacity.

## 17. Primary References

- [OpenAI models](https://developers.openai.com/api/docs/models)
- [OpenAI latest-model guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Vercel Cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Supabase Cron](https://supabase.com/docs/guides/cron)
- [Scheduling Supabase Edge Functions](https://supabase.com/docs/guides/functions/schedule-functions)
- [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email)
