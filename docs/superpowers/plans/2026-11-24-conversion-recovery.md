# Vella conversion recovery implementation plan

Goal: deliver the pending runtime 1.4 reliability changes and reduce the observed first-screen and offer-loading friction; improve organic discovery without changing subscription economics.

Authorization: the user requested implementation, clean main integration and production OTA publication on November 24. Existing eight-language product and approved Scripture boundaries remain in force. Paid campaigns remain paused.

Design: retain the current native and web stacks. Offer a direct first-moment entry with optional goal personalization and compact language selection. Preserve saved choices, active-subscriber routing and later account/entitlement checks. Use an existing daily-rhythm default for an explicitly unpersonalized preview. Bound retries of transient read-only store queries, keeping ownership verification and purchase requests outside retries. Improve existing localized website metadata, public app information and contextual guide navigation; do not invent new human-reviewed editorial content, ratings or prices.

Alternatives considered: a full onboarding redesign would obscure the measured bottleneck and expand regression risk; adding more articles would leave the broken offer-loading path untouched. A focused recovery and immediate-value entry is the chosen engineering approach.

Tasks:
- [ ] Onboarding: implement optional personalization with behavior tests for empty and selected goals, saved state, repeated taps and existing access; localize all new copy.
- [ ] Billing: reproduce transient product-query failure in service tests; add one bounded retry only for transient catalog reads, with stale-generation/cancellation fences and unchanged purchase/restore ownership checks.
- [ ] Website: audit existing SEO against current official guidance, implement material metadata/internal navigation improvements in all locales and meaningful rendering/URL tests. Prepare accurate store sources.
- [ ] Verify: full mobile/API suites, typechecks, website production build, native visual smoke, JS exports and independent review. Record limitations honestly.
- [ ] Release: commit intended diffs to main, push, verify clean 0/0 divergence, deploy website/API and publish runtime 1.4 production OTA on both platforms. Verify live commits and release IDs.

Review focus: optional input cannot bypass paid access; fallback preview remains usable; stale billing requests cannot overwrite newer products; retries cannot initiate purchases; localized URLs/canonicals must agree and unavailable platforms must not be advertised as available.
