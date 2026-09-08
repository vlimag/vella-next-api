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
