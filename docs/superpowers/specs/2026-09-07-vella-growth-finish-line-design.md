# Vella Growth Finish-Line Design

**Date:** 2026-09-07

**Status:** Approved for implementation by the operator

## Outcome

Ship one coordinated, regression-safe growth release that improves the path from discovery to meaningful app use without changing Vella's subscription economics. The release covers:

- truthful, localized PT-BR store and Brazil ad creative;
- a native review request after sustained meaningful value;
- measurable store calls to action and corrected technical SEO;
- four native PT-BR weekly content packets with an explicit human-review gate.

## Immutable commercial and campaign boundaries

- Monthly is charged immediately and has no trial.
- Only eligible new annual subscribers may receive exactly 14 days through Apple or Google.
- Product IDs, base plans, Play offer IDs, prices, renewal behavior, entitlements, and the absence of a permanent free tier do not change.
- The Android campaign stays at R$30/day, Brazil, Portuguese, install-volume bidding, no target CPI, installs as the only Primary action, and `begin_checkout` as Secondary observation.
- This release does not change budget, bidding, goals, targeting, billing, or access.

## Release surfaces

### Web/API

The localized landing-page hero becomes an actual store acquisition surface. Mobile visitors get the matching store; unknown/desktop visitors get an honest choice between App Store and Google Play rather than being silently classified as Android. Every outbound store link emits the existing privacy-safe `store_cta_clicked` event.

Web analytics add only bounded, non-content context: a canonical route class and coarse referrer class. No raw URL, query, referrer, search, text, identifier, or fingerprint is stored. The ingestion contract remains strict.

Technical SEO changes are canonical-only:

- do not block `/_next/` assets in robots;
- emit only final, non-redirecting sitemap URLs with maintained modification dates;
- permanently redirect `www.vella.one` to the apex host while preserving path and query;
- retain all eight existing language alternates.

### Mobile OTA

`expo-store-review` is already embedded in the current runtime-1.4 iOS and Android binaries, so JavaScript wiring is OTA-safe. A pure eligibility core and a thin native adapter will:

- record only schema version, distinct local completion-day keys, and prompt-attempt timestamps/app versions;
- become eligible after three distinct days with a completed meaningful session;
- require the app to be active and the native review action to be available;
- mark an attempt before invoking the OS request, with a single in-flight lock;
- limit attempts to once per app version, at least 180 days apart, and no more than two in a rolling year;
- never run from onboarding, authentication, paywall, checkout, purchase, or a rating pre-question;
- never infer that the dialog appeared or that a rating was submitted;
- fail silently without blocking completion or navigation.

Existing authoritative completion telemetry remains the measurement proxy. No new user-level review telemetry, API schema, database migration, or purchase code is required.

### Store listings and ad assets

Store screenshots use real runtime-1.4 app output with synthetic, non-personal content. AI-generated product UI is forbidden. Screenshot copy contains no unverified price and no false trial claim.

The PT-BR Play listing is corrected from “one month” to exactly 14 days and receives current PT-BR screenshots plus a PT-BR feature graphic. If console capabilities allow it without conflicts, one Brazil country-targeted custom store listing uses PT-BR as its default language. Apple PT-BR screenshots are prepared now and uploaded with the next editable iOS version if the live version cannot accept them.

The Brazil ad group uses only current PT-BR custom image/video/text assets. Store auto-assets are made safe by localizing the Play listing first. Religious-policy-safe creative describes Vella and its features; it does not assert the viewer's beliefs, distress, or identity. Ads contain no price or trial claim.

### Four-week PT-BR editorial system

One packet is prepared for each approved topic:

1. Como orar quando faltam palavras.
2. Como criar um devocional diário curto.
3. Como entender e aplicar uma passagem.
4. Uma jornada sazonal compartilhada.

Each packet contains one authoritative article, three short-video scripts, two share-card specifications/assets, one matching in-app practice and lifecycle message, and one directly measurable store CTA. Existing high-quality articles are refreshed and packaged rather than duplicated; the seasonal/shared topic is the only new SEO URL unless content inspection proves otherwise.

Every packet starts as `draft`. “Human reviewed” is a factual publication state, not a generated label. A named human must approve Scripture handling, natural PT-BR, safety, and claims before the packet or matching lifecycle copy becomes live. Draft content and assets can ship in the repository without becoming public.

## Release order and rollback

1. Land test-backed web/API and draft editorial changes on clean API `main`; push and deploy; verify live commit, health, canonical redirect, robots, sitemap, CTA events, and public copy.
2. Land test-backed review-prompt code and approved in-app copy/assets on clean mobile `main`; push and publish runtime 1.4 to both platforms; verify EAS commit hash, channel, runtime, platforms, and clean-tree provenance.
3. Update Play copy and PT-BR listing media; verify public rendering before allowing Google Ads to source it.
4. Replace/add PT-BR campaign assets without changing campaign controls.
5. Prepare Apple PT-BR screenshots and upload only to an editable version.

Rollback is independently reversible: restore the prior API deployment, republish the prior runtime-1.4 mobile update, and remove the new store/ad assets. No database or subscription rollback is involved.

## Verification gates

- Fresh focused tests fail before each behavior change and pass after it.
- Full API/mobile suites, typecheck, build, and `git diff --check` pass.
- Store metadata tests prove 14 days and reject consumer-facing “one month” claims.
- Screenshot/creative validation proves expected dimensions, formats, locale, and no stale source captures.
- Simulator checks prove no review request during launch/onboarding/paywall/checkout and safe post-completion behavior.
- Campaign controls are recorded before and after and must be identical except for asset/listing state.
