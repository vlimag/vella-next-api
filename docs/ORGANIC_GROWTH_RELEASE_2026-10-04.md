# Vella organic growth — 2026-10-04

## Delivered web scope

- Two original evergreen articles, each in en/pt/es/fr/de/it/ru/pl:
  `how-to-start-reading-the-bible-seven-day-plan` and
  `a-short-night-prayer-for-the-end-of-the-day`.
- Six articles per locale, related reading links within the same locale, complete
  canonical/hreflang/RSS coverage, and 120 sitemap URLs. Blog index modification
  dates derive from actual article dates. Existing article dates were not reset.
- Sixteen localized, opaque 1200×630 editorial social images; no fabricated app
  screenshots. Reproduce with `bun scripts/render-blog-social.ts`.
- AI-assistance disclosure on the new articles. Original prayers are explicitly
  distinguished from Scripture. No human or expert review is claimed. The old
  scheduled PT-BR packets remain drafts under their separate approval gate.
- Website outbox capped at 20 coarse events and 24 hours in sessionStorage,
  falling back to memory if storage is unavailable. Retry IDs are preserved;
  page-session batches remain separate; pending clicks drain after in-flight
  requests. Online, visibility and pagehide events trigger nonblocking delivery.
- Restored data is allowlisted, including canonical ISO timestamps. No raw URLs,
  prayer text, search text, referrers, account identity or profile fields added.

## Verification

- Full API suite: 842/842 passed with
  `bunx vitest run --maxWorkers=2 --testTimeout=30000`.
- The existing PostgreSQL-initialization contract exceeded Vitest's default
  5 seconds on the loaded host; its unchanged database assertions passed in
  isolation (9.9 seconds) and in the full suite. No production SQL was changed.
- Independent read-only review found one Important issue: permissive timestamp
  parsing could forward arbitrary cached text. Regression test failed before
  the canonical timestamp fix and passed afterward. No other Critical/Important
  findings. All 16 editorial images visually reviewed.
- Typecheck and local production build passed. Deployment provenance is checked
  during release; the final chat reports the immutable commit/deployment IDs.

## Baseline and measurement

- Search Console, Aug 2–Sep 29: 5 clicks, 354 impressions, 1.4% CTR. Brazil:
  10 impressions, 0 clicks. Sitemap previously exposed 104 URLs.
- First-party web, Aug 30–Oct 4: 300 entry events, 19 article entries, 4 search
  referrer entries, 0 recorded store CTA clicks. These are not verified people;
  operator traffic, bots and delivery gaps may affect them.
- Play growth overview, Sep 6–Oct 3: 3.15K device impressions, 116 acquisitions,
  68 first opens, 163 monthly active devices, 3 retained devices at seven days.
- Play listing dashboard, Sep 4–Oct 1: 576 visitors, 181 unique install clicks,
  31% click-through rate. Do not combine these with a different dashboard/window
  into a claimed end-to-end conversion rate.
- Evaluate organic impressions/clicks and indexed article URLs after 14–28 days;
  separately measure store CTA events and Play acquisitions. Do not attribute
  every subsequent change to these articles or promise subscriber growth.

## Store scope and immutable boundaries

The public BR phone screenshot deck still needs replacement with verified real
PT-BR Android captures. No images were uploaded and no store listing was saved by
this release. The last EAS production AAB artifact returned 404, and no physical
Android was connected during preparation. A separate empty Vella QA AVD was
created; no existing device/account was reset. Fresh captures, synthetic content,
visual review and action-time console publication confirmation remain required.

No Ads configuration, budget, targeting, conversion goals, billing, subscription
plans, prices, entitlement rules, API schema, mobile source or OTA was changed.
The existing API production baseline was confirmed as clean-main commit e11a540
on deployment dpl_6acwRPyJbWvLp6DaH1shFS1MRUTY. Rollback uses that deployment.

## Official guidance checked

- [Helpful, reliable content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content): useful complete answers, accurate authorship, no artificial date refresh or invented expertise.
- [Localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions): reciprocal language alternates and stable locale URLs.
- [Play preview assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en): represent the actual product and localize audience-facing assets.
