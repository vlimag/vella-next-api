# Vella conversion recovery implementation plan

Goal: deliver the pending runtime 1.4 reliability changes and reduce the observed first-screen and offer-loading friction; improve organic discovery without changing subscription economics.

Authorization: the user requested implementation, clean main integration and production OTA publication on November 24. Existing eight-language product and approved Scripture boundaries remain in force. Paid campaigns remain paused.

Controlling user correction: preview-first was already tried and is explicitly rejected. Follow `mobile/docs/superpowers/specs/2026-09-14-conversion-v3.md`: select at least one goal -> persist profile -> personalized Premium offer, without a guided moment, Scripture request or permanent-account gate. Preserve subscriber routing, saved choices, checkout reliability and account/entitlement checks. Legacy preview routes must redirect through access truth rather than creating a new preview. Bound read-only catalog recovery; never retry a purchase. Keep the completed localized website SEO improvements and accurate store sources, with no invented editorial review, ratings or prices.

Rejected approach: the first November 24 release repeated preview-led onboarding. Correct it rather than running that experiment again. Do not assume small-sample first-screen abandonment proves that another preview will improve conversion.

Tasks:
- [ ] Onboarding correction: selected goals directly to Premium; behavior tests for required goals, persistence, interrupted drafts, deep links, repeated taps and existing subscribers; eight-language copy; no pre-offer preview/network request.
- [ ] Billing: reproduce transient product-query failure in service tests; add one bounded retry only for transient catalog reads, with stale-generation/cancellation fences and unchanged purchase/restore ownership checks.
- [ ] Website: audit existing SEO against current official guidance, implement material metadata/internal navigation improvements in all locales and meaningful rendering/URL tests. Prepare accurate store sources.
- [ ] Verify: full mobile/API suites, typechecks, website production build, native visual smoke, JS exports and independent review. Record limitations honestly.
- [ ] Release: commit intended diffs to main, push, verify clean 0/0 divergence, deploy website/API and publish runtime 1.4 production OTA on both platforms. Verify live commits and release IDs.

Review focus: neither onboarding nor legacy preview state can bypass paid access or trap subscribers; offer presentation must not depend on the preview endpoint; stale billing requests cannot overwrite products; retries cannot initiate purchases; store copy must match direct-to-Premium flow; economics remain unchanged. Verify clean pushed main and actual production release metadata before declaring completion.
