# Vella Review Prompt OTA Implementation Plan

**Goal:** Ask for a native store review only after sustained meaningful value, without touching onboarding, purchases, subscription state, or app economics.

**Spec:** `docs/superpowers/specs/2026-09-07-vella-growth-finish-line-design.md`

## Task 1: Implement and release the post-value review prompt

- [ ] Add failing unit tests for three-distinct-day eligibility, per-version limit, 180-day cooldown, two-per-year cap, corrupt/future storage, inactive app, native unavailability, errors, and concurrent attempts.
- [ ] Implement a pure local-state eligibility module and thin injected native adapter.
- [ ] Add failing integration/source-contract tests for approved post-success hooks only.
- [ ] Invoke the non-blocking review coordinator after successful daily prayer, journey session, guided practice, and Gathering completion state settles.
- [ ] Verify no import or invocation exists in onboarding, auth, premium/paywall, checkout, or purchase modules.
- [ ] Run focused tests, full mobile suite, typecheck, Expo diagnostics, and `git diff --check`.
- [ ] Test launch/onboarding/premium/completion paths in simulators and capture evidence.
- [ ] Commit/push mobile main, publish runtime 1.4 to iOS and Android, and verify EAS production metadata and clean provenance.
