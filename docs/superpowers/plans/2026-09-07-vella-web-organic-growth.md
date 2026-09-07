# Vella Web and Organic Growth Implementation Plan

**Goal:** Make every store CTA measurable and truthful, correct canonical SEO behavior, and prepare the PT-BR weekly editorial system without changing subscription economics.

**Spec:** `docs/superpowers/specs/2026-09-07-vella-growth-finish-line-design.md`

## Task 1: Implement and release the web/organic growth wave

- [ ] Replace brittle current-campaign prose assertions with behavior-level documentation checks and restore `validate:site` to green.
- [ ] Add failing tests for hero store links, desktop store choice, bounded route/referrer properties, robots, sitemap canonicals, and apex-host redirect.
- [ ] Implement the platform-aware hero/store CTA and strict privacy-safe web attribution fields.
- [ ] Implement canonical robots, sitemap, and host redirect behavior.
- [ ] Add four versioned PT-BR packet manifests and drafts; reuse existing articles instead of creating duplicate URLs.
- [ ] Add validation that no packet can claim `human_reviewed` without a named approval record and that CTA URLs use allowlisted campaign codes.
- [ ] Run focused tests, full API tests, typecheck, site validation, production build, and `git diff --check`.
- [ ] Commit/push API main, deploy, and verify live health, commit, pages, robots, sitemap, redirects, and CTA ingestion.
