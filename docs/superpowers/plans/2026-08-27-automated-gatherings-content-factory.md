# Automated Gatherings Content Factory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two fully automated, localized, safe, observable Gatherings every week—Monday and Thursday—with six weeks of inventory, exact next-release UX, replayable history, independent failure email, and end-to-end telemetry.

**Architecture:** Preserve the current `weekly-rest` v1 contract and add an additive v2 release/catalog model. A daily Vercel factory generates missing slots with GPT-5.6 Sol, deterministic validation, canonical Scripture resolution, and an independent reviewer; a Supabase watchdog monitors it separately. The runtime-1.3 OTA consumes v2 through React Query while authoritative lifecycle facts stay server-side and privacy-safe telemetry covers app, API, database, cron, watchdog, and alerts.

**Tech Stack:** Next.js 14 route handlers, TypeScript, Zod, Supabase/PostgreSQL/RLS/pg_cron/Edge Functions, OpenAI Responses API, Resend HTTP API, Expo Router, React Native, TanStack Query, Bun tests, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-automated-gatherings-content-factory-design.md`

## Global Constraints

- Publish exactly two release slots per local week: Monday and Thursday at local 00:00.
- Maintain 12 future Gatherings; warn below 6 and alert critically below 2.
- Preserve `weekly-rest`, version `1`, `editorial.1`, `get_current_gathering_v1`, and `save_gathering_progress_v1` unchanged.
- Support exactly `en`, `es`, `pt`, `fr`, `de`, `it`, `ru`, and `pl`; no generated release publishes with a missing locale.
- Every Gathering has exactly eight ordered sections and lasts 720–1,080 seconds.
- Award unique-completion badges at 1, 8, 24, and 52 Gatherings; replay never increments these thresholds.
- Scripture text and translation always resolve from the approved database corpus; the model supplies only a reference candidate.
- Never send or store raw prayers, journals, searches, posts, emails, user IDs, receipts, purchase tokens, or generated prose in telemetry, logs, or alerts.
- Telemetry is mandatory in app, API, database, factory, cron, watchdog, and email delivery; telemetry failure never blocks users or publication.
- Schema is additive and runtime-1.3 compatible; rollback uses v1 without SQL rollback.
- Use `gpt-5.6-sol` and prompt revision `gathering-factory.1`; no automatic model upgrades.
- Ship as one runtime-1.3 OTA only after backend health is proven; no native build is part of this plan.

## File Map

### Shared Supabase workspace

- `../supabase/migrations/20260827210000_gathering_content_factory.sql`: releases, runs, incidents, heartbeat, operational telemetry, aggregate metrics.
- `../supabase/migrations/20260827210100_gathering_catalog_v2.sql`: timezone-aware catalog/progress/aggregation RPCs.
- `../supabase/migrations/20260827210200_gathering_telemetry_v2.sql`: strict app event/property allowlist.
- `../supabase/migrations/20260827210300_gathering_watchdog_schedule.sql`: hourly independent Supabase Cron invocation using Vault-held URL/secret.
- `../supabase/functions/gathering-watchdog/index.ts`: independent heartbeat/inventory/email watchdog.

### API repository

- `lib/rhythms/gatheringsV2.ts`: v2 Zod contracts and RPC adapters.
- `lib/rhythms/gatheringOperationalTelemetry.ts`: non-blocking API/cron telemetry.
- `lib/gatheringFactory/contracts.ts`: strict generator/reviewer schemas.
- `lib/gatheringFactory/validators.ts`: deterministic content validation.
- `lib/gatheringFactory/openai.ts`: injected-fetch Responses API client.
- `lib/gatheringFactory/inventory.ts`: slots, scoring, refill, lock, atomic publication.
- `lib/gatheringFactory/alerts.ts`: incidents, Resend, recovery.
- `app/api/v2/rhythms/gatherings/catalog/route.ts`: entitled catalog read.
- `app/api/v2/rhythms/gatherings/[templateId]/progress/route.ts`: account-required progress.
- `app/api/cron/gathering-content/route.ts`: daily content factory.
- `app/api/v1/operator/growth/summary/route.ts`: automation/operator diagnostics.
- `scripts/seed-gathering-inventory.mjs`: bounded evergreen and 12-slot bootstrap.

### Mobile repository

- `../mobile/src/features/rhythms/gatherings/gatheringCatalog.ts`: v2 decoder/presentation.
- `../mobile/src/features/rhythms/gatherings/GatheringCatalogScreen.tsx`: current/upcoming/history UI.
- `../mobile/src/features/rhythms/gatherings/GatheringDetailScreen.tsx`: selected release detail.
- `../mobile/src/features/rhythms/gatherings/GatheringSessionScreen.tsx`: selected session lifecycle.
- `../mobile/src/features/rhythms/rhythmsQueries.ts`: catalog/progress cache.
- `../mobile/src/cache/queryKeys.ts`: owner/locale/timezone cache keys.
- `../mobile/src/services/api.ts`: v2 calls.
- `../mobile/src/services/analyticsCore.ts`: typed privacy-safe events.
- `../mobile/src/i18n/rhythmsTranslations.ts`: all eight locales.
- `../mobile/app/gathering.tsx`: selected-template stack route.

## Required Telemetry Inventory

- **App catalog:** `gathering_catalog_loaded`, `gathering_card_viewed`, `gathering_card_selected`, `gathering_next_release_viewed`, `gathering_fallback_used`.
- **App lifecycle:** existing `gathering_viewed`, `gathering_started`, `gathering_resumed`, `gathering_step_completed`, and `gathering_completed`, plus `gathering_session_abandoned` and `gathering_replayed`.
- **App failures:** existing `rhythms_load_failed`, `rhythms_mutation_failed`, and `rhythms_asset_fallback_used`, extended with schema version 2 and v2 stages.
- **API:** `api_catalog_requested`, `api_catalog_succeeded`, `api_catalog_failed`, `api_progress_requested`, `api_progress_succeeded`, `api_progress_failed`.
- **Factory:** `run_started`, `inventory_checked`, `lock_contended`, `generation_started`, `generation_succeeded`, `generation_failed`, `validation_succeeded`, `validation_failed`, `review_succeeded`, `review_failed`, `publish_succeeded`, `publish_failed`, `heartbeat_written`, `run_completed`, `run_failed`.
- **Incidents/email/watchdog:** `incident_opened`, `incident_recovered`, `alert_attempted`, `alert_delivered`, `alert_failed`, `watchdog_checked`, `watchdog_failed`.
- **Authoritative database facts:** accepted start, checkpoint, unique completion, idempotent replay, newly earned milestone codes, and daily aggregate view/start/step/completion/replay/fallback counts.

App properties are limited to safe catalog code, slot type, source surface, locale class, result, cache state, step index/type, elapsed/countdown/item-count bucket, and finite error code. API properties are limited to route, outcome, latency bucket, schema version, locale, and finite error code. Factory/watchdog properties are limited to run ID, slot, stage/outcome, inventory bucket, duration bucket, model/prompt revision, token/cost buckets, incident code, and delivery result. The validators reject every unlisted key.

---

### Task 1: Add release and operational schema

**Files:**
- Create: `../supabase/migrations/20260827210000_gathering_content_factory.sql`
- Create: `tests/gatheringFactoryDatabaseContract.test.ts`

**Interfaces:**
- Consumes: existing `gathering_templates`, `gathering_template_steps`, and `user_gathering_progress`.
- Produces: `gathering_releases`, `gathering_generation_runs`, `gathering_generation_incidents`, `gathering_automation_heartbeats`, `gathering_operational_events`, `gathering_content_metrics_daily`, and nullable `gathering_templates.release_id`.

- [ ] **Step 1: Write the failing schema contract**

```ts
const sql = migration('20260827210000_gathering_content_factory.sql');
expect(sql).toContain('create table if not exists faith_harbor.gathering_releases');
expect(sql).toContain("check (slot_type in ('monday', 'thursday'))");
expect(sql).toContain('unique (release_week, slot_type)');
expect(sql).toContain("source_kind = 'evergreen' and release_week is null");
expect(sql).toContain('create table if not exists faith_harbor.gathering_operational_events');
expect(sql).not.toMatch(/user_id|email|receipt|purchase_token|private_prayer/i);
expect(sql).toContain('enable row level security');
for (const code of ['gathering_first_light', 'gathering_monthly_rhythm', 'gathering_season_keeper', 'gathering_long_companion']) {
  expect(sql).toContain(code);
}
```

- [ ] **Step 2: Run it and verify RED**

Run: `yarn vitest run tests/gatheringFactoryDatabaseContract.test.ts`
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the additive schema**

Use a locale-neutral release identity:

```sql
create table faith_harbor.gathering_releases (
  id uuid primary key default gen_random_uuid(),
  catalog_code text not null unique
    check (catalog_code ~ '^g-[0-9]{4}w[0-9]{2}-(mon|thu)$|^evergreen-[a-z0-9-]{1,80}$'),
  release_week date,
  slot_type text not null check (slot_type in ('monday', 'thursday')),
  source_kind text not null check (source_kind in ('generated', 'evergreen')),
  status text not null check (status in ('draft', 'published', 'retired')),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  generation_run_id uuid,
  prompt_revision text not null,
  editorial_revision text not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (source_kind = 'generated' and release_week is not null and extract(isodow from release_week) = 1)
    or (source_kind = 'evergreen' and release_week is null)
  ),
  unique (release_week, slot_type)
);
```

Add bounded checks, FK indexes, RLS, service-role-only grants, and 30-day operational-event retention support. Seed shareable Gathering-category milestone rows for unique-completion thresholds 1, 8, 24, and 52 using the existing flame asset keys. Existing v1 templates keep `release_id = null`.

- [ ] **Step 4: Run schema checks**

Run: `yarn vitest run tests/gatheringFactoryDatabaseContract.test.ts && git diff --check -- tests/gatheringFactoryDatabaseContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit the API contract**

```bash
git add tests/gatheringFactoryDatabaseContract.test.ts
git commit -m "test: lock gathering factory schema"
```

### Task 2: Add timezone-aware v2 RPCs

**Files:**
- Create: `../supabase/migrations/20260827210100_gathering_catalog_v2.sql`
- Create: `tests/gatheringsV2DatabaseContract.test.ts`
- Create: `tests/gatheringsV2Postgres.integration.sh`
- Create: `tests/gatheringMilestoneIntegration.test.ts`

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: `get_gathering_catalog_v2`, `save_gathering_progress_v2`, `record_gathering_operational_event_v1`, and `aggregate_gathering_metrics_v1`.

- [ ] **Step 1: Write failing RPC tests**

```ts
expect(sql).toMatch(/create or replace function faith_harbor\.get_gathering_catalog_v2/);
expect(sql).toContain("timezone(coalesce(v_timezone_name, 'UTC'), p_now)");
expect(sql).toContain("slot_type = 'monday'");
expect(sql).toContain("slot_type = 'thursday'");
expect(sql).toMatch(/grant execute on function faith_harbor\.get_gathering_catalog_v2[\s\S]*to service_role/);
```

The PostgreSQL fixture inserts Monday/Thursday releases and verifies boundaries in `America/Sao_Paulo`, `Europe/Paris`, and `UTC`.
The milestone fixture completes the same release twice and then distinct releases; it proves only unique first completions count and that thresholds 1, 8, 24, and 52 award once.

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringsV2DatabaseContract.test.ts tests/gatheringMilestoneIntegration.test.ts && bash tests/gatheringsV2Postgres.integration.sh`
Expected: contract FAIL because the migration is missing.

- [ ] **Step 3: Implement strict RPCs**

Return:

```ts
type GatheringCatalogV2 = {
  schema_version: 2;
  timezone_name: string;
  generated_at: string;
  featured: GatheringCatalogItemV2[];
  history: GatheringCatalogItemV2[];
  next_release: { slot_type: 'monday' | 'thursday'; available_at: string };
  fallback_used: boolean;
};
```

Resolve progress only for a non-null permanent account. Derive local eligibility through PostgreSQL timezone data. Completion is idempotent and server-authoritative. On the first unique completion, count distinct completed release identities and award any newly crossed Gathering badge threshold in the same transaction; return safe `new_milestone_codes` facts for cache/telemetry. Daily metrics contain no account identifier.

- [ ] **Step 4: Run database verification**

Run: `yarn vitest run tests/gatheringsV2DatabaseContract.test.ts tests/gatheringMilestoneIntegration.test.ts && bash tests/gatheringsV2Postgres.integration.sh`
Expected: PASS.

- [ ] **Step 5: Commit RPC contracts**

```bash
git add tests/gatheringsV2DatabaseContract.test.ts tests/gatheringsV2Postgres.integration.sh tests/gatheringMilestoneIntegration.test.ts
git commit -m "test: lock gathering catalog v2 database behavior"
```

### Task 3: Extend the app telemetry allowlist

**Files:**
- Create: `../supabase/migrations/20260827210200_gathering_telemetry_v2.sql`
- Create: `tests/gatheringTelemetryV2Contract.test.ts`
- Modify: `tests/growthAnalytics.test.ts`

**Interfaces:**
- Consumes: `growth_event_properties_are_safe_v8`.
- Produces: v9 validation for `gathering_catalog_loaded`, `gathering_card_viewed`, `gathering_card_selected`, `gathering_next_release_viewed`, `gathering_session_abandoned`, `gathering_replayed`, and `gathering_fallback_used`.

- [ ] **Step 1: Write failing strict-property tests**

```ts
expectValid('gathering_catalog_loaded', {
  source_surface: 'rhythms_hub', result: 'success',
  cache_state: 'fresh', item_count_bucket: '2_5', next_slot_type: 'thursday',
});
expectInvalid('gathering_catalog_loaded', { user_id: crypto.randomUUID() });
expectValid('gathering_session_abandoned', {
  catalog_code: 'g-2026w35-mon', step_index: 4,
  abandonment_reason: 'backgrounded', elapsed_bucket: '2_4m',
});
expectInvalid('gathering_card_selected', { raw_title: 'generated prose' });
```

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringTelemetryV2Contract.test.ts tests/growthAnalytics.test.ts`
Expected: FAIL because v9 is absent.

- [ ] **Step 3: Add v9 without weakening v8**

Use finite values for surfaces, slot types, cache states, outcomes, elapsed/countdown buckets, and errors. Generated `catalog_code` must match `^g-[0-9]{4}w[0-9]{2}-(mon|thu)$`. Extend `milestone_earned` only with the four Gathering badge codes. Replace constraints through the established `NOT VALID` compatibility sequence and never rewrite historical rows.

- [ ] **Step 4: Run analytics regression**

Run: `yarn vitest run tests/gatheringTelemetryV2Contract.test.ts tests/growthAnalytics.test.ts tests/rhythmsTelemetryContract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit contracts**

```bash
git add tests/gatheringTelemetryV2Contract.test.ts tests/growthAnalytics.test.ts
git commit -m "test: define gathering telemetry v2"
```

### Task 4: Implement v2 API and backend request telemetry

**Files:**
- Create: `lib/rhythms/gatheringsV2.ts`
- Create: `lib/rhythms/gatheringOperationalTelemetry.ts`
- Create: `app/api/v2/rhythms/gatherings/catalog/route.ts`
- Create: `app/api/v2/rhythms/gatherings/[templateId]/progress/route.ts`
- Create: `tests/gatheringsV2.test.ts`
- Create: `tests/gatheringsV2Routes.test.ts`
- Create: `tests/gatheringOperationalTelemetry.test.ts`

**Interfaces:**
- Produces: `loadGatheringCatalogV2`, `saveGatheringProgressV2`, and `recordGatheringOperationalEvent`.

- [ ] **Step 1: Write failing decoder/route tests**

```ts
expect(decodeGatheringCatalogV2(validCatalog)).toEqual(expectedCatalog);
expect(decodeGatheringCatalogV2({ ...validCatalog, schema_version: 1 })).toBeNull();
expect(event).toMatchObject({
  event_name: 'api_catalog_succeeded',
  properties: { route: 'catalog_v2', outcome: 'success', latency_bucket: 'under_100ms' },
});
expect(JSON.stringify(event)).not.toMatch(/userId|templateId|title|body/);
```

Verify entitled anonymous GET returns content without account progress; anonymous progress PUT returns `401 account_required`.

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringsV2.test.ts tests/gatheringsV2Routes.test.ts tests/gatheringOperationalTelemetry.test.ts`
Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement strict adapters and non-blocking telemetry**

```ts
type GatheringOperationalEventName =
  | 'api_catalog_requested' | 'api_catalog_succeeded' | 'api_catalog_failed'
  | 'api_progress_requested' | 'api_progress_succeeded' | 'api_progress_failed';

type SafeRequestProperties = {
  route: 'catalog_v2' | 'progress_v2';
  outcome: 'success' | 'client_error' | 'server_error';
  latency_bucket: 'under_100ms' | '100_499ms' | '500_1499ms' | '1500ms_plus';
  schema_version: 2;
  locale?: GatheringLocale;
  error_code?: GatheringSafeErrorCode;
};
```

Contain telemetry writer failures. Preserve all v1 implementation files unchanged.

- [ ] **Step 4: Run API/v1 regression**

Run: `yarn vitest run tests/gatheringsV2.test.ts tests/gatheringsV2Routes.test.ts tests/gatheringOperationalTelemetry.test.ts tests/gatheringsRoute.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit API v2**

```bash
git add lib/rhythms/gatheringsV2.ts lib/rhythms/gatheringOperationalTelemetry.ts app/api/v2/rhythms/gatherings tests/gatheringsV2.test.ts tests/gatheringsV2Routes.test.ts tests/gatheringOperationalTelemetry.test.ts
git commit -m "feat: add observable gathering catalog v2"
```

### Task 5: Build deterministic generation contracts

**Files:**
- Create: `lib/gatheringFactory/contracts.ts`
- Create: `lib/gatheringFactory/validators.ts`
- Create: `tests/gatheringFactoryContracts.test.ts`
- Create: `tests/gatheringFactoryValidators.test.ts`

**Interfaces:**
- Produces: `generatedGatheringSchema`, `reviewDecisionSchema`, `validateGatheringCandidate`, and `candidateContentHash`.

- [ ] **Step 1: Write failing validators**

```ts
expect(validateGatheringCandidate(validEightLocaleCandidate, context)).toEqual({ ok: true });
expect(validateGatheringCandidate(candidateWithModelWrittenVerse, context))
  .toEqual({ ok: false, code: 'scripture_text_forbidden' });
expect(validateGatheringCandidate(candidateMissingFrench, context))
  .toEqual({ ok: false, code: 'locale_incomplete' });
expect(validateGatheringCandidate(candidateWithSevenSteps, context))
  .toEqual({ ok: false, code: 'step_contract_invalid' });
```

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringFactoryContracts.test.ts tests/gatheringFactoryValidators.test.ts`
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement pure validators**

The payload contains `scripture_reference` but no Scripture body. Require eight locales, eight exact sections, 720–1,080 seconds, bounded editorial fields, and safe theme keys. Normalize before SHA-256 hashing. Reject similarity above `0.82` against the last 12 releases and all prohibited/safety patterns from the spec.

- [ ] **Step 4: Run focused tests**

Run: `yarn vitest run tests/gatheringFactoryContracts.test.ts tests/gatheringFactoryValidators.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit validators**

```bash
git add lib/gatheringFactory/contracts.ts lib/gatheringFactory/validators.ts tests/gatheringFactoryContracts.test.ts tests/gatheringFactoryValidators.test.ts
git commit -m "feat: validate generated gathering content"
```

### Task 6: Implement GPT generation, review, Scripture resolution, and budgets

**Files:**
- Create: `lib/gatheringFactory/openai.ts`
- Create: `tests/gatheringFactoryOpenAI.test.ts`
- Modify: `lib/gatheringFactory/validators.ts`
- Modify: `tests/gatheringFactoryValidators.test.ts`

**Interfaces:**
- Produces: `generateGatheringDraft`, `reviewGatheringDraft`, and `resolveCanonicalScripture`.

- [ ] **Step 1: Write failing injected-fetch tests**

```ts
expect(request.model).toBe('gpt-5.6-sol');
expect(request.text.format.type).toBe('json_schema');
expect(request.metadata).toEqual({ prompt_revision: 'gathering-factory.1' });
expect(JSON.stringify(request)).not.toContain('user_id');
expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 900 });
```

Cover timeout, HTTP failure, malformed JSON, schema failure, token ceiling, reviewer rejection, and missing canonical Scripture.

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringFactoryOpenAI.test.ts tests/gatheringFactoryValidators.test.ts`
Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement raw Responses API calls**

```ts
type FactoryDeps = {
  fetch: typeof fetch;
  apiKey: string;
  now: () => Date;
  timeoutMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
};
```

Use `AbortSignal.timeout`, strict JSON schema, the fixed model/prompt revision, and bounded usage. Resolve approved references from `bible_verses` for every locale; fail closed if one is missing.

- [ ] **Step 4: Run focused tests**

Run: `yarn vitest run tests/gatheringFactoryOpenAI.test.ts tests/gatheringFactoryValidators.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit model integration**

```bash
git add lib/gatheringFactory/openai.ts lib/gatheringFactory/validators.ts tests/gatheringFactoryOpenAI.test.ts tests/gatheringFactoryValidators.test.ts
git commit -m "feat: generate and review gathering drafts"
```

### Task 7: Implement inventory, scoring, atomic publish, and cron telemetry

**Files:**
- Create: `lib/gatheringFactory/inventory.ts`
- Create: `tests/gatheringFactoryInventory.test.ts`
- Create: `app/api/cron/gathering-content/route.ts`
- Create: `tests/gatheringContentCron.test.ts`
- Modify: `vercel.json`

**Interfaces:**
- Produces: `runGatheringFactory(deps): Promise<FactoryRunResult>` and daily factory route.

- [ ] **Step 1: Write failing orchestration tests**

```ts
expect(planMissingSlots(now, [])).toHaveLength(12);
expect(planMissingSlots(now, elevenFutureSlots)).toHaveLength(1);
expect(result.telemetry.map((event) => event.eventName)).toEqual(expect.arrayContaining([
  'run_started', 'inventory_checked', 'generation_started',
  'validation_succeeded', 'review_succeeded', 'publish_succeeded',
  'heartbeat_written', 'run_completed',
]));
expect(publish).toHaveBeenCalledTimes(1);
```

Cover lock contention, duplicate slot, two failed attempts, atomic rollback, warning/critical incidents, balanced rotation below thresholds, and smoothed scoring only after 30 candidate starts and 100 comparison starts.

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringFactoryInventory.test.ts tests/gatheringContentCron.test.ts`
Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement bounded refill**

Acquire `pg_try_advisory_lock(hashtext('vella:gathering-factory:v1'))`, plan Monday/Thursday slots, create one run per slot, attempt twice, publish through one transaction, and record every stage. Add:

```json
{ "path": "/api/cron/gathering-content", "schedule": "17 8 * * *" }
```

Require `Authorization: Bearer ${CRON_SECRET}` and return safe counts only.

- [ ] **Step 4: Run cron regression**

Run: `yarn vitest run tests/gatheringFactoryInventory.test.ts tests/gatheringContentCron.test.ts tests/gatheringsRoute.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit automation**

```bash
git add lib/gatheringFactory/inventory.ts app/api/cron/gathering-content/route.ts vercel.json tests/gatheringFactoryInventory.test.ts tests/gatheringContentCron.test.ts
git commit -m "feat: automate gathering inventory"
```

### Task 8: Add incidents, Resend, and independent watchdog

**Files:**
- Create: `lib/gatheringFactory/alerts.ts`
- Create: `tests/gatheringFactoryAlerts.test.ts`
- Create: `../supabase/functions/gathering-watchdog/index.ts`
- Create: `../supabase/migrations/20260827210300_gathering_watchdog_schedule.sql`
- Create: `tests/gatheringWatchdogContract.test.ts`

**Interfaces:**
- Produces: `openGatheringIncident`, `recoverGatheringIncident`, `sendGatheringAlert`, and independent watchdog processing.

- [ ] **Step 1: Write failing alert/watchdog tests**

```ts
expect(email.to).toEqual([process.env.OPS_ALERT_EMAIL ?? 'support@vella.one']);
expect(email.headers['Idempotency-Key']).toBe('gathering:inventory_low:open');
expect(email.html).toContain('inventory_low');
expect(email.html).not.toMatch(/generated body|receipt|user id/i);
expect(secondOpen.delivered).toBe(false);
expect(recovery.subject).toContain('RECOVERED');
```

Prove the watchdog reads only heartbeat/inventory/incidents and sends directly through Resend, never a Vercel endpoint. Assert the schedule migration registers `gathering-watchdog-hourly` at `7 * * * *` and reads `gathering_watchdog_url` and `gathering_watchdog_secret` only from Vault.

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringFactoryAlerts.test.ts tests/gatheringWatchdogContract.test.ts`
Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement email and monitoring**

Use `https://api.resend.com/emails` with `RESEND_API_KEY`, `OPS_ALERT_EMAIL` defaulting to `support@vella.one`, and idempotency headers. Persist `incident_opened`, `alert_attempted`, `alert_delivered`, `alert_failed`, and `incident_recovered`. The Edge Function flags heartbeat older than 36 hours, low inventory, unsent incidents, and recovery. The schedule invokes the Edge Function hourly through `pg_cron` + `pg_net`; its URL and bearer secret are resolved from `vault.decrypted_secrets` at execution time and never embedded in SQL.

- [ ] **Step 4: Run focused tests**

Run: `yarn vitest run tests/gatheringFactoryAlerts.test.ts tests/gatheringWatchdogContract.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit API alert support**

```bash
git add lib/gatheringFactory/alerts.ts tests/gatheringFactoryAlerts.test.ts tests/gatheringWatchdogContract.test.ts
git commit -m "feat: alert on gathering automation failures"
```

### Task 9: Expose complete operator diagnostics

**Files:**
- Modify: `app/api/v1/operator/growth/summary/route.ts`
- Modify: `tests/growthOperatorRoutes.test.ts`
- Create: `tests/gatheringAutomationDiagnostics.test.ts`

**Interfaces:**
- Produces: `gathering_automation` in the existing operator summary.

- [ ] **Step 1: Write failing diagnostic assertions**

```ts
expect(json.gathering_automation).toEqual(expect.objectContaining({
  future_inventory: 12,
  weeks_covered: 6,
  next_monday_at: expect.any(String),
  next_thursday_at: expect.any(String),
  last_run: expect.objectContaining({ outcome: 'succeeded', model: 'gpt-5.6-sol' }),
  open_incidents: [],
  telemetry: expect.objectContaining({ app: expect.any(Object), api: expect.any(Object), cron: expect.any(Object) }),
}));
expect(JSON.stringify(json)).not.toMatch(/user_id|email|content_body|prompt_body/);
```

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/gatheringAutomationDiagnostics.test.ts tests/growthOperatorRoutes.test.ts`
Expected: FAIL because the section is absent.

- [ ] **Step 3: Add bounded diagnostics**

Report inventory, releases, last run/publish/heartbeat, token/cost totals, rejection codes, incident/email state, app/API/cron counts, starts, per-step drop-off, completion, replay, and fallback use. Set `audit_available: false` for a failed source query instead of reporting false zeroes.

- [ ] **Step 4: Run operator/privacy tests**

Run: `yarn vitest run tests/gatheringAutomationDiagnostics.test.ts tests/growthOperatorRoutes.test.ts && yarn typecheck`
Expected: PASS.

- [ ] **Step 5: Commit diagnostics**

```bash
git add app/api/v1/operator/growth/summary/route.ts tests/growthOperatorRoutes.test.ts tests/gatheringAutomationDiagnostics.test.ts
git commit -m "feat: report gathering automation health"
```

### Task 10: Add safe inventory bootstrap

**Files:**
- Create: `scripts/seed-gathering-inventory.mjs`
- Create: `tests/seedGatheringInventory.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `yarn gatherings:seed` with explicit dry-run/apply and a 12-slot maximum.

- [ ] **Step 1: Write failing CLI tests**

```ts
expect(run(['--dry-run'], deps)).resolves.toMatchObject({ planned: 12, published: 0 });
expect(run(['--apply', '--max-slots', '12'], deps)).resolves.toMatchObject({ published: 12 });
expect(logs.join('\n')).not.toContain('editorial_text');
expect(() => parseArgs(['--max-slots', '13'])).toThrow('max-slots must be between 1 and 12');
```

- [ ] **Step 2: Run and verify RED**

Run: `yarn vitest run tests/seedGatheringInventory.test.ts`
Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement bounded bootstrap**

Add `"gatherings:seed": "node --env-file=.env scripts/seed-gathering-inventory.mjs"`. Require `--apply`, reuse production validation/review/publish, create two reviewed evergreen fallbacks, and log only slot keys, run IDs, counts, and safe outcomes.

- [ ] **Step 4: Run tests and dry-run**

Run: `yarn vitest run tests/seedGatheringInventory.test.ts && yarn gatherings:seed --dry-run --max-slots 12`
Expected: PASS; no writes.

- [ ] **Step 5: Commit tooling**

```bash
git add scripts/seed-gathering-inventory.mjs tests/seedGatheringInventory.test.ts package.json
git commit -m "feat: bootstrap gathering inventory safely"
```

### Task 11: Add mobile v2 contracts, cache, and API wiring

**Files:**
- Create: `../mobile/src/features/rhythms/gatherings/gatheringCatalog.ts`
- Modify: `../mobile/src/cache/queryKeys.ts`
- Modify: `../mobile/src/features/rhythms/rhythmsQueries.ts`
- Modify: `../mobile/src/services/api.ts`
- Create: `../mobile/tests/gatheringCatalogContracts.test.js`
- Create: `../mobile/tests/gatheringCatalogCache.test.js`

**Interfaces:**
- Produces: `decodeGatheringCatalogV2`, `gatheringCatalogQueryOptions`, `useGatheringCatalogQuery`, and `useSaveGatheringProgressV2Mutation`.

- [ ] **Step 1: Write failing decoder/cache tests**

```js
expect(decodeGatheringCatalogV2(validCatalog).featured).toHaveLength(2);
expect(decodeGatheringCatalogV2({ ...validCatalog, schema_version: 1 })).toBeNull();
expect(queryKeys.gatheringCatalog('owner-a', 'fr', 'Europe/Paris'))
  .not.toEqual(queryKeys.gatheringCatalog('owner-a', 'fr', 'UTC'));
expect(options.staleTime).toBe(5 * 60 * 1000);
```

- [ ] **Step 2: Run and verify RED**

Run from `../mobile`: `bun test tests/gatheringCatalogContracts.test.js tests/gatheringCatalogCache.test.js`
Expected: FAIL because v2 files/keys do not exist.

- [ ] **Step 3: Implement strict stale-while-revalidate**

Use cache owner `anonymous-entitled` without a permanent account; progress remains owner-scoped. Keep stale catalog during refetch, reject malformed payloads without false empty state, and invalidate selected progress, Home, Rhythms, milestones, and profile after completion.

- [ ] **Step 4: Run mobile tests/typecheck**

Run from `../mobile`: `bun test tests/gatheringCatalogContracts.test.js tests/gatheringCatalogCache.test.js && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit mobile data layer**

```bash
cd ../mobile
git add src/features/rhythms/gatherings/gatheringCatalog.ts src/cache/queryKeys.ts src/features/rhythms/rhythmsQueries.ts src/services/api.ts tests/gatheringCatalogContracts.test.js tests/gatheringCatalogCache.test.js
git commit -m "feat: consume gathering catalog v2"
```

### Task 12: Build catalog UX and correct navigation

**Files:**
- Create: `../mobile/src/features/rhythms/gatherings/GatheringCatalogScreen.tsx`
- Modify: `../mobile/src/features/rhythms/gatherings/GatheringDetailScreen.tsx`
- Modify: `../mobile/src/features/rhythms/gatherings/GatheringSessionScreen.tsx`
- Modify: `../mobile/src/features/rhythms/RhythmsScreen.tsx`
- Modify: `../mobile/app/gathering.tsx`
- Create: `../mobile/tests/gatheringCatalogUi.test.js`
- Create: `../mobile/tests/gatheringV2Navigation.test.js`

**Interfaces:**
- Produces: current/upcoming/history/replay UI and direct selected-template stack navigation.

- [ ] **Step 1: Write failing UI/navigation tests**

```js
expect(catalog).toContain('nextRelease.availableAt');
expect(catalog).toContain("pathname: '/gathering'");
expect(catalog).toContain('templateId: item.templateId');
expect(route).toContain('templateId');
expect(session).toContain('router.back()');
expect(catalog).toContain('AccountRequiredModal');
```

Cover two cards, Thursday upcoming, history, replay, evergreen, cached network failure, reduced motion, both themes, and anonymous entitled read with reversible sign-in modal on start.

- [ ] **Step 2: Run and verify RED**

Run from `../mobile`: `bun test tests/gatheringCatalogUi.test.js tests/gatheringV2Navigation.test.js`
Expected: FAIL because the catalog UI is absent.

- [ ] **Step 3: Implement design-system UI**

Use existing Vesper cards, typography, spacing, gold flame, theme tokens, and reduced-motion transitions. Show exact localized date/countdown. Route with `{ templateId, mode }`; never flash blank or redirect through Home. Completion returns through the stack and cached cards update.

- [ ] **Step 4: Run UI regression**

Run from `../mobile`: `bun test tests/gatheringCatalogUi.test.js tests/gatheringV2Navigation.test.js tests/gatheringUi.test.js tests/rhythmsHubUi.test.js && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit mobile UX**

```bash
cd ../mobile
git add src/features/rhythms/gatherings/GatheringCatalogScreen.tsx src/features/rhythms/gatherings/GatheringDetailScreen.tsx src/features/rhythms/gatherings/GatheringSessionScreen.tsx src/features/rhythms/RhythmsScreen.tsx app/gathering.tsx tests/gatheringCatalogUi.test.js tests/gatheringV2Navigation.test.js
git commit -m "feat: present weekly gathering catalog"
```

### Task 13: Instrument every app state and localize all copy

**Files:**
- Modify: `../mobile/src/services/analyticsCore.ts`
- Modify: `../mobile/src/services/analytics.ts`
- Modify: `../mobile/src/features/rhythms/gatherings/GatheringCatalogScreen.tsx`
- Modify: `../mobile/src/features/rhythms/gatherings/GatheringDetailScreen.tsx`
- Modify: `../mobile/src/features/rhythms/gatherings/GatheringSessionScreen.tsx`
- Modify: `../mobile/src/features/rhythms/badges/badgeRegistry.ts`
- Modify: `../mobile/src/features/rhythms/badges/milestoneContracts.ts`
- Modify: `../mobile/src/i18n/rhythmsTranslations.ts`
- Create: `../mobile/tests/gatheringTelemetryV2.test.js`
- Create: `../mobile/tests/gatheringV2I18n.test.js`
- Create: `../mobile/tests/gatheringBadges.test.js`

**Interfaces:**
- Produces: typed catalog/card/countdown/start/resume/step/abandon/replay/completion/cache/fallback/error telemetry in all eight locales.

- [ ] **Step 1: Write failing telemetry/locale tests**

```js
expect(track('gathering_card_viewed', {
  catalog_code: 'g-2026w35-mon', slot_type: 'monday', source_surface: 'gathering',
})).toEqual({ status: 'accepted' });
expect(track('gathering_card_viewed', { title: 'generated prose' })).toEqual({ status: 'dropped' });
expect(sessionSource).toContain("'gathering_session_abandoned'");
for (const locale of ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'pl']) {
  expect(translations[locale].gatheringNextReleaseExact).toBeTruthy();
}
expect(resolveMilestoneBadgeAsset('gathering_long_companion')).toBe('flame.pilgrim');
```

- [ ] **Step 2: Run and verify RED**

Run from `../mobile`: `bun test tests/gatheringTelemetryV2.test.js tests/gatheringV2I18n.test.js tests/gatheringBadges.test.js tests/analyticsCore.test.js`
Expected: FAIL because events/copy are absent.

- [ ] **Step 3: Implement complete, deduplicated instrumentation**

Emit catalog result once per query result; card impression once per catalog/session; selection per tap; next release once per timestamp; lifecycle with authoritative completion; abandonment on back/background/error; replay on a completed-item start; fallback/cache once per source state. Decode and reveal authoritative new Gathering badges, map them to the existing spark/steady/rooted/pilgrim visuals, invalidate Home/Profile/Community projections, and emit `milestone_earned` once per returned code. Never include UUID, title, summary, body, private draft, timezone, or account identity.

- [ ] **Step 4: Run analytics/i18n regression**

Run from `../mobile`: `bun test tests/gatheringTelemetryV2.test.js tests/gatheringV2I18n.test.js tests/gatheringBadges.test.js tests/analyticsCore.test.js tests/analyticsIntegration.test.js tests/rhythmsBadges.test.js tests/rhythmsI18n.test.js && bun run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit telemetry/localization**

```bash
cd ../mobile
git add src/services/analyticsCore.ts src/services/analytics.ts src/features/rhythms/gatherings src/features/rhythms/badges/badgeRegistry.ts src/features/rhythms/badges/milestoneContracts.ts src/i18n/rhythmsTranslations.ts tests/gatheringTelemetryV2.test.js tests/gatheringV2I18n.test.js tests/gatheringBadges.test.js
git commit -m "feat: instrument gathering experience end to end"
```

### Task 14: Verify, deploy, seed, monitor, and publish OTA

**Files:**
- Create: `docs/superpowers/verification/2026-08-27-automated-gatherings.md`
- Modify only if scoped verification fails: files from Tasks 1–13.

**Interfaces:**
- Produces: deployed schema/API/factory/watchdog, 12 future releases, two evergreen fallbacks, verified email/recovery, healthy diagnostics, and runtime-1.3 OTA.

- [ ] **Step 1: Run complete local verification**

```bash
yarn vitest run tests/gatheringFactoryDatabaseContract.test.ts tests/gatheringsV2DatabaseContract.test.ts tests/gatheringMilestoneIntegration.test.ts tests/gatheringTelemetryV2Contract.test.ts tests/gatheringsV2.test.ts tests/gatheringsV2Routes.test.ts tests/gatheringOperationalTelemetry.test.ts tests/gatheringFactoryContracts.test.ts tests/gatheringFactoryValidators.test.ts tests/gatheringFactoryOpenAI.test.ts tests/gatheringFactoryInventory.test.ts tests/gatheringContentCron.test.ts tests/gatheringFactoryAlerts.test.ts tests/gatheringWatchdogContract.test.ts tests/gatheringAutomationDiagnostics.test.ts tests/seedGatheringInventory.test.ts tests/gatheringsRoute.test.ts tests/growthAnalytics.test.ts tests/growthOperatorRoutes.test.ts
yarn typecheck
git diff --check
cd ../mobile
bun test tests/gatheringCatalogContracts.test.js tests/gatheringCatalogCache.test.js tests/gatheringCatalogUi.test.js tests/gatheringV2Navigation.test.js tests/gatheringTelemetryV2.test.js tests/gatheringV2I18n.test.js tests/gatheringBadges.test.js tests/gatheringUi.test.js tests/analyticsCore.test.js tests/analyticsIntegration.test.js tests/rhythmsBadges.test.js tests/rhythmsI18n.test.js
bun run typecheck
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Apply backend in safe order**

Apply migrations `20260827210000`, `20260827210100`, and `20260827210200`. Deploy API. Configure `OPENAI_API_KEY`, `RESEND_API_KEY`, `OPS_ALERT_EMAIL`, `CRON_SECRET`, token/cost ceilings, and kill switch without printing values. Deploy the independent function with `supabase functions deploy gathering-watchdog --project-ref "$VELLA_SUPABASE_PROJECT_REF" --no-verify-jwt`, place `gathering_watchdog_url` and `gathering_watchdog_secret` in Supabase Vault, then apply `20260827210300_gathering_watchdog_schedule.sql`.

- [ ] **Step 3: Seed and production-smoke safely**

Run `yarn gatherings:seed --dry-run --max-slots 12`, then `yarn gatherings:seed --apply --max-slots 12`. Verify 12 future releases, two evergreen fallbacks, eight locales, canonical Scripture, heartbeat, and no open incident. Trigger one synthetic alert and recovery; confirm both emails, then remove only the synthetic incident.

- [ ] **Step 4: Verify simulator experience**

Test Monday, Thursday, both completed, replay, anonymous entitled catalog, reversible sign-in modal, offline cache, retry after network failure, light/dark theme, reduced motion, long `de`/`ru` strings, and badge projection in Home, Profile, and Community after the user features it. Record screenshots and exact outcomes in the verification report.

- [ ] **Step 5: Publish and verify runtime-1.3 OTA**

Publish one production OTA to iOS and Android runtime 1.3. Confirm first-launch application, healthy v2 API, app/API/cron telemetry, no private fields, 12-slot inventory, and working v1 routes. Do not create a native build.

- [ ] **Step 6: Commit evidence and integrate both repositories to main**

```bash
git add docs/superpowers/verification/2026-08-27-automated-gatherings.md
git commit -m "docs: verify automated gatherings rollout"
```

Merge reviewed API and mobile commits into each repository's `main` branch while retaining isolated history. Confirm both main branches are clean and contain the verified heads.
