# Organic growth implementation — 2026-10-04

Spec: ../specs/2026-10-04-vella-organic-growth-design.md

User approved implementation and completion in chat. Preserve pricing, subscriptions,
Ads settings, user accounts, and existing editorial packets. Work against current
main; no obsolete worktrees. Production requires clean tested synchronized main.

## Tasks

1. Add regression coverage and implement a bounded privacy-safe website event
   outbox: tab-session persistence, retry, idempotency, in-flight enqueue draining.
2. Add two complete articles in all eight locales, related links, editorial social
   images, accurate sitemap dates. Test rendered pages, feeds and metadata.
3. Produce and visually validate real current-main PT-BR Android screenshots;
   never substitute generated app UI or another platform's captures.
4. Run full suite, typecheck, production build, diff checks and fresh final review.
   Sign, push and deploy only with release provenance verified.

## Progress / decisions

- Baseline: API 800f697 (documentation only, one commit ahead); mobile clean main.
- Pre-flight: article catalog feeds routes, RSS, metadata and sitemap; all must use
  the same expanded catalog. CTA client uses existing server contract unchanged.
- New articles are not labeled human-reviewed; previous scheduled PT-BR packets
  retain their named-human-review requirement. No editorial approval is invented.
- Store screenshots require actual Android availability and visual verification.
  Console publishing is kept separate from app/billing/campaign changes.
- Task 1: focused outbox tests passed (6/6), including real API parsing after a
  reload. Events from different page-session IDs are sent in separate batches.
- Task 2: 16 localized articles and 16 opaque 1200×630 social covers implemented;
  focused site/content/outbox tests passed, sitemap has 120 entries. Full-page
  render tests required Vitest's automatic JSX transform to match Next.js.
- Ruling: new article approval is separate from the old cadence's named-review
  gate — current user instructions authorize these posts, while the pages clearly
  disclose AI assistance — no claim of human editorial review is made.
- Ruling: preserve the existing per-page random session semantics; persisted
  events retain their original IDs and use separate batches after reload — this
  avoids inflating a page session into a persistent person identifier.
- Final review: one Important finding reproduced with a failing regression test:
  Date.parse accepted a date containing arbitrary text. Restored timestamps now
  must be canonical 24-character ISO UTC strings before storage or transmission.
  No other Critical/Important findings. All 16 social images visually reviewed.
- Review exclusions are explicit: no certification of human/theological review;
  no claims about live database idempotency beyond existing server tests; native
  captures and deployment provenance require their own verification below.
- Final code verification: 842/842 API tests, typecheck, production build and
  diff whitespace checks passed. Native store images were not published: no
  physical Android was connected, the saved EAS AAB artifact returned 404, and
  the dedicated local Android build was stopped to prioritize this web release.
  No existing emulator/account was reset; no mobile source or OTA was changed.

## Review focus

Privacy of restored storage and custom events; retry loops and duplicate delivery;
static-route/RSS/hreflang consistency; honest multilingual content and commercial
claims; no changes to subscription economics; clean-main deployment provenance.
