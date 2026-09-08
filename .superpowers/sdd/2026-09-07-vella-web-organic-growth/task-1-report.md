# Task 1 — Web and organic growth wave report

## Local implementation

- Added a measurable hero store choice. Android and iOS visitors retain only the
  matching store CTA after client detection; desktop and unknown visitors retain
  both choices. Header CTAs no longer silently treat desktop/unknown visitors as
  Android.
- Added bounded web acquisition context: canonical route class and coarse
  referrer class only. The tracker uses the existing `source`, `medium`,
  `campaign`, `content`, `cta_id`, and `store` ingestion properties; it does
  not add a database field or store raw URLs, query strings, referrers, or text.
- Corrected SEO output: robots allow `/_next/` assets, sitemap entries use apex
  final URLs and maintained dates, and middleware permanently redirects
  `www.vella.one` to `vella.one` while retaining path and query.
- Replaced stale campaign prose assertions with current-control behavior checks.
  No campaign document or campaign control was modified.
- Added four versioned PT-BR draft packet manifests and a validator. All packets
  are explicitly `draft`, not human-reviewed, reference existing PT-BR article
  URLs, carry three video scripts and two share cards, and use the allowlisted
  `android_first_launch` CTA campaign. Weeks 2 and 3 refresh the existing daily
  rhythm and Scripture-curiosity articles; no public article URL was added.

## TDD evidence

### RED

The initial focused site run exposed the intended missing/incorrect behavior:

- hero acquisition test could not render a direct hero store choice;
- robots still disallowed `/_next/`;
- apex-host redirect was absent;
- stale documentation assertions expected the old campaign state;
- the all-locale catalog test timed out at Vitest's default five seconds.

The first post-test run recorded these concrete failures: `React is not defined`
from the broad page-render test, an obsolete historical campaign-ID assertion,
and the wrapped `no target CPI` assertion. The test was narrowed to the real
hero component, campaign checks were made behavior-level/current-state checks,
and the catalog test was made concurrent with a scoped 30-second timeout.

### GREEN

`yarn vitest run tests/site.test.ts tests/webAttribution.test.ts tests/editorialPackets.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot`

- 3 test files passed, 35 tests passed.
- `yarn typecheck` completed successfully.
- `yarn validate:editorial` printed `Validated 4 PT-BR draft editorial packets.`
- `git diff --check` completed with no whitespace errors.

## Verification concern

The full `yarn test` run was started with a single Vitest worker and session
polling, but the controller interrupted it after about 280 seconds before it
returned a result. It must be rerun to completion before any production release.
No push or deployment was performed by this task.

## Review round 1/5 — 2026-09-07

### Fixes

- `utm_campaign` now passes through a closed website-campaign mapping. Only
  `android_first_launch` is retained; every unknown or malformed value falls
  back to that safe default. The pre-existing generated pseudonymous
  event/install/session UUID envelope is unchanged.
- Referrer classification now accepts only an exact approved hostname or its
  dot-suffix subdomain. Deceptive hosts such as `notgoogle.com` and
  `example.instagram.com.evil.test` are classified as referrals.
- Removed the unsupported `2026-09-07` `updatedAt` values from the four public
  posts. Draft packet work does not alter public article sitemap dates.
- Editorial validation now reads the current blog slug registry and rejects a
  packet whose PT-BR article URL is not currently published; prefix-only checks
  are no longer sufficient.

### RED and GREEN evidence

The amended focused suite first failed exactly as intended: it accepted an
unknown packet article URL, classified `notgoogle.com` as search, had no
closed campaign mapper, and emitted the unsupported 2026-09-07 PT article
timestamp.

After the fixes, this command passed:

`yarn vitest run tests/site.test.ts tests/webAttribution.test.ts tests/editorialPackets.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot`

- 3 test files passed, 37 tests passed; duration 24.46 seconds.
- `yarn typecheck` passed; duration 90.65 seconds.
- `yarn validate:editorial` printed `Validated 4 PT-BR draft editorial packets.`
- `git diff --check` passed with no output.

## Editorial review remediation — 2026-09-07

All four packets remain `draft`, `human_reviewed: false`, and `approval: null`.
No live `lib/site/blog.ts` content, public route, or sitemap entry was changed.

- Weeks 1–3 now carry 790–821-word, structured PT-BR article-refresh drafts
  for their existing localized article URLs.
- Week 4 now contains a distinct Brazil spring 2026 article draft with proposed
  slug `primavera-no-brasil-sete-dias-de-atencao`; it is explicitly an
  `unpublished_draft` gated by `named_human_editorial_approval`.
- Each packet contains three 15–30-second publication-ready scripts with a
  hook, spoken body, on-screen text, and audience-facing CTA. Validator tests
  reject editorial-process wording in those fields.
- Each packet has a distinct bounded campaign/content pair, safe source and
  medium, and a reader-facing CTA label. No ad controls or app code changed.
- The reproducible Sharp renderer produced two opaque RGB PNGs per packet. The
  validator verifies all schema fields, article word floor, draft gate, live
  article mapping where applicable, exact dimensions, RGB/no alpha, declared
  path, and SHA-256 hash.

### Asset inventory

| Asset | SHA-256 |
| --- | --- |
| semana-1-quadrado.png | `ecf0ffb7b47104bf803152b4526017e3888e097def298bb85423afc0b00767b6` |
| semana-1-vertical.png | `ad951ffa4511edf13f1d90f281336e9d2912249da2c85c015ebf3bc4caf4a1d9` |
| semana-2-quadrado.png | `b5b1b15508072b3d986ad8744f081d67811005e5128493c05a09717f5f3c8a19` |
| semana-2-vertical.png | `a40bb419b2cae9465414eb236ad05d8922d08e6a76b63acdb4373e6a827ecce3` |
| semana-3-quadrado.png | `15dfd9727f6eeb543786550a0bc3710b5accd5e29b6ff070e3b01f6f246b5377` |
| semana-3-vertical.png | `7cb36e1993e95f6ac8e3854d7cc6d46e3dd425932bc5aa84aa483bd5b226a0d6` |
| semana-4-quadrado.png | `b08c01146f3aceeb39ea53209e30340e8caee4fbb2d1615cb46c255dc5f4a055` |
| semana-4-vertical.png | `7982bf823e8211236cd29a55ac49f8b392cb31c78e11a6891a59dca4300ca288` |

### TDD evidence

RED: the expanded packet test initially failed because the packet validator
reported only four manifests, authoritative draft copy was absent, and the
spring draft was absent. The first renderer-aware validator run then exposed
the default 5-second timeout, so the two process-spawning tests received a
scoped 30-second timeout.

GREEN: `yarn vitest run tests/editorialPackets.test.ts --pool=threads
--maxWorkers=1 --minWorkers=1 --reporter=dot` passed 4/4 tests. `yarn
validate:editorial` validated four packets and eight share-card assets.

The remaining release gate is a named human approval of Scripture handling,
natural PT-BR, safety, and claims before any draft copy, packet, lifecycle
message, or seasonal article can become public.
### Controller QA follow-up

- Replaced the inflated JSON-serialization word check with a Unicode-aware count of `authoritative_article.draft.body_markdown` itself. The four authoritative body counts are week 1: 745, week 2: 735, week 3: 725, and week 4: 708 words. Redundant mini-section copies were removed.
- Moved the week 4 proposed slug and named-human approval gate into `authoritative_article`, so the unpublished seasonal packet uses the same contract as every other article.
- Added a validator and negative test that reject editorial-process wording in audience-facing video fields. The RED run failed because the validator did not yet emit the audience-wording failure; the GREEN run passed after the rule was added.
- Final focused GREEN: `yarn vitest run tests/editorialPackets.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot` — 5/5 passed (76.43s wall clock).
- Final asset reproducibility and validation GREEN: `yarn render:editorial-assets && yarn validate:editorial && git diff --check` — rendered 8 assets; validated 4 packets and 8 cards; no whitespace errors.
- All packets remain `status: draft`, `human_reviewed: false`, and `approval: null`. The week 4 article remains unpublished pending named human editorial approval.

### Editorial re-review: seasonal wording

- Replaced the internal phrase “A primavera de 2026 começa no Brasil durante esta cadência de quatro semanas” with “Com a chegada da primavera no Brasil, a mudança de estação pode virar uma pausa gentil para reparar no que muda devagar.” The week-4 body remains above the 700-word floor.
- RED: the new temporary-packet test that injected `cadência de quatro semanas` did not fail until the validator rule was added.
- GREEN: `yarn vitest run tests/editorialPackets.test.ts --pool=threads --maxWorkers=1 --minWorkers=1 --reporter=dot` passed 6/6 (48.69s wall clock); `yarn validate:editorial` validated 4 draft packets and 8 share-card assets; `git diff --check` passed.
- No content was published. `status: draft`, `human_reviewed: false`, `approval: null`, and the named-human approval requirement remain intact.

### Final API review remediation

- CTA attribution now evaluates the current pathname at click time, covering same-locale soft navigation while preserving initial coarse referrer classification.
- Canonical www redirects now run for pages and `/_next/static` / `/_next/image` assets, preserving paths and query strings without redirecting localhost.
- The packet validator enforces the exact HTTPS Google Play details URL, `id=io.vella.app`, exactly the `id` and `referrer` outer parameters, and exactly the four bounded nested UTM values. It rejects schedule-dependent week-4 wording.
- Focused GREEN: `tests/webAttribution.test.ts`, `tests/editorialPackets.test.ts`, and `tests/site.test.ts` passed 44/44. `yarn typecheck`, `yarn validate:site` (33/33), renderer, and `yarn validate:editorial` passed. `git diff --check e3e15c9..HEAD` passed after removing the inherited extra EOF blank line.
