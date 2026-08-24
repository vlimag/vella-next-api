# Vella final product audit

Last reviewed: **2026-07-31**  
Scope: current `mobile`, `api`, release-safe migrations, repository assets, and the production health endpoint. Store-console state is recorded only where it was independently reported; it is not inferred from source. The operational checklist remains [`RELEASE_FINISH_LINE.md`](./RELEASE_FINISH_LINE.md).

## Executive decision

**The launch-critical product engineering identified in the earlier audit is now complete. Public commercial release is still gated by external evidence and Apple console work, not by the former daily-devotional defects.**

The core paid proposition is now materially true:

> **A calm, trustworthy daily Christian rhythm: edition-attributed Scripture, a multi-step guided journey, an optional private response, and a gentle reminder.**

Do not interpret that engineering verdict as permission to declare launch complete. Google Play production release build `1.0.0 (13)` is currently **Changes in review**. iOS build `1.0.0 (15)` is uploaded, but authenticated App Store Connect completion still remains for metadata, privacy, legal/trader and contact fields, build selection, subscription attachment, and final submission. Signed-binary purchase-lifecycle and real-device smoke tests also remain on both platforms.

## Current product truth

| Surface | Implemented now | Constraint / next validation |
| --- | --- | --- |
| Access and monetization | Authentication routes into a hard Premium gate; monthly is paid immediately, annual trial copy is eligibility-aware, store-returned prices are used, and there is **no permanent free tier** | Prove purchase, renewal, cancellation, expiry, refund/revocation, restore, and lapsed access on the exact signed store builds |
| Daily Scripture | Daily text is selected from an active approved corpus row; AI can draft only the reflection prompt; the response exposes reference and Bible edition attribution | Corpus breadth and translation rights still determine how deep search can honestly be marketed |
| Guided journey | Home renders the full ordered multi-step session with body, CTA, deliberate next/back progression, final completion, and optional private reflection and gratitude fields | Add history/weekly recap after launch evidence; validate session length and comprehension with real users |
| Journey Scripture | Verse-type steps are rehydrated from the approved corpus in the requested language, fall back to approved English when needed, show edition attribution, and are omitted when no approved verse is available | This is a safe fail-closed behavior, but missing localized corpus coverage can shorten a session |
| Reminders and paid copy | Reminder permission is contextual, reminder styles are truthfully described, and reminder/paywall/store copy is localized across the eight UI locales | Human editorial review remains valuable, especially for intimate faith language |
| Community safety | The narrow faith-keyword hard-block was removed. Only clear spam heuristics hard-block before provider moderation; multilingual Catholic, Orthodox, liturgical, Arabic, Greek, Polish, Portuguese, and ordinary-language cases have regression coverage | Staffing, response SLA, appeals/escalation, and ongoing moderation QA remain operational obligations |
| Commerce backend | Apple/Google products, credentials, webhooks, and migration `0016` are configured; the live health endpoint reported `apple_iap`, `google_iap`, `google_webhook`, and `database_schema` green on 2026-07-31 | Green configuration health is not a substitute for signed-client transaction testing |
| Store state | Android source version code is `13`; the Google production release is **Changes in review**. iOS source build is `15` and that build is uploaded | Apple submission setup is not complete; no local `.ipa` or `.aab` artifact is present, so do not claim local binary verification |

## Daily engagement and retention verdict

The previous tap-through defect is closed. The daily loop now asks the user to:

1. Open a localized reminder or Home.
2. Read corpus-backed daily Scripture with its edition attribution and reflection prompt.
3. Move deliberately through every available journey step.
4. Optionally save a private reflection and gratitude note.
5. Complete the day and return for the next timed check-in.

That is a credible first-release devotional loop. The remaining product question is empirical: whether the session feels worth paying for and returning to after the novelty week. A launch cohort should measure first-session completion, D1/D7 return, reminder opt-in/open, day-by-day journey completion, purchase outcome, and failures without logging private prayer, reflection, gratitude, or raw search content.

The most valuable retention additions remain a useful history, calm completion/milestone feedback, weekly reflection, and a missed-day recovery state that avoids guilt. These are product improvements, not reasons to misclassify the present P0 engineering as unfinished.

## UI, onboarding, and paid conversion verdict

The visual foundation remains strong: clear hierarchy, warm restrained palette, large targets, whitespace, progress feedback, editable local reminder time, optional sensitive answers, and graceful network states. Paid copy now describes the shipped seven-day journey, Scripture tools, groups, Feed, device verse audio, reminders, immediate monthly charge, and eligibility-dependent annual trial without promising a permanent free product.

The conversion path is still intentionally strict: onboarding and authentication precede a hard paywall. That is commercially coherent with the stated no-permanent-free model, but it leaves proof-of-value risk. A later locally bundled, licensed sample session before account creation could improve trust without creating a free tier. Instrument onboarding-start → account-created → paywall-view → purchase/trial → first-real-session before deciding whether that change is necessary.

## Faith sensitivity across Christian traditions

### Improved and launch-credible

- Displayed daily Scripture is no longer authored or translated by AI; its identity and wording remain bound to an approved corpus row and edition.
- Journey verse steps use the same provenance boundary, prefer an approved requested-language verse, fall back to approved English, and disappear when unavailable rather than showing unattributed seed text.
- The former English-keyword faith gate no longer rejects unfamiliar Catholic, Orthodox, liturgical, or multilingual language before semantic moderation.
- Russian reminder and core release copy use native script, and reminder/paywall claims are localized and materially aligned with the product.
- Sensitive life-season answers and journey check-ins remain optional and private; public Feed content is separated from private notes.

### Still worth strengthening

- The corpus is safe by provenance, but breadth is not the same as completeness. Market only the Scripture coverage actually licensed and imported for each language.
- There is no Bible-version/canon choice or explicit tradition mode. State the broad/ecumenical devotional posture and avoid implied endorsement by a church or pastor.
- Human reviewers from multiple traditions and every launch language should review terminology, prompts, and store screenshots.
- Automated moderation needs a staffed owner, documented escalation, repeat-offender process, appeals path, and measurable response time.

## Remaining gates and roadmap

### P0 — external/commercial gates before declaring launch complete

1. **Finish Apple in authenticated App Store Connect.** Complete version metadata, localized screenshots, App Privacy, age/content-rights declarations, legal entity/trader/contact fields, reviewer access, build `1.0.0 (15)` selection, subscription attachment, and final submission.
2. **Verify support channels.** `support@vella.one` and `privacy@vella.one` are published in the product, but no MX or end-to-end delivery evidence was verified on 2026-07-31. Configure monitored mail and prove inbound and reply delivery.
3. **Run signed-binary commerce tests.** On TestFlight and Play testing/production-eligible tracks, exercise monthly purchase, eligible and ineligible annual flows, restore, renewal, cancellation, expiry, billing retry/grace, refund/revocation, wrong-account protections, and deletion/subscription separation.
4. **Run real-device release smoke tests.** Use the exact uploaded builds on representative iPhone and Android devices. Cover clean install, onboarding, account access, hard paywall, daily Scripture attribution, the full journey, private check-in, reminders, Feed safety controls, legal links, lapsed access, and deletion.
5. **Monitor store review.** Google build `1.0.0 (13)` is not released merely because its production changes are in review. Record the final review outcome and rollout state before calling Android live.

### P1 — first 4–8 weeks after launch evidence

1. Add a privacy-safe launch funnel and reliability view, including crash-free sessions and API failure rate.
2. Human-review all eight mobile languages and equalize corpus/journey coverage before making uniform feature claims.
3. Grow from one general journey to a small editorially excellent library for peace/anxiety, prayer, Scripture study, gratitude, and family; make time preferences alter session length.
4. Turn Plans into actions and Groups into shared practice: assign a journey, opt-in progress visibility, roles, prayer/check-in threads, and consent-sensitive notifications.
5. Add content-aware deep links, a notification inbox, journey history, weekly reflection, and gentle win-back states.
6. Add password recovery, OTP resend/cooldown, and a working Sign in with Apple UI if that entitlement is retained.
7. Seed community with reviewed prompts or trusted cohorts and measure whether Feed improves retention before expanding it.

### P2 — devote-user roadmap after retention evidence

- **Personal Rule of Life:** user-defined morning/evening rhythms combining Scripture, prayer timer, examen/gratitude, and one action; private history and selected export.
- **Tradition-aware mode:** user-chosen Bible edition/canon, devotional method, liturgical calendar preference, and reviewed terminology without stereotypes.
- **Answered-prayer and discernment timeline:** private intentions, updates, gratitude markers, and monthly reflection based on the user's own words.
- **Scripture memory studio:** spaced repetition, listen/recite, reference recall, and family-circle challenges using licensed text only.
- **Circle journeys:** trusted groups complete the same session and share only explicitly chosen reflections, celebrating presence rather than ranking holiness.
- **Grounded study companion:** answers from selected licensed Scripture and vetted cited commentary, with quotation, commentary, and AI synthesis clearly separated.
- **Offline sacred space:** downloaded journeys, local-first private notes, widgets, and a distraction-free prayer mode.

## Launch scorecard

| Decision dimension | Engineering state | Remaining release evidence |
| --- | --- | --- |
| Visual/UI quality | **Strong** | Exact-build accessibility and small-screen device QA |
| Core value delivery | **P0 complete** | Real-user session quality and D1/D7 validation |
| Scripture trust | **P0 complete** | Corpus rights/breadth audit by advertised locale |
| Daily retention loop | **Launch-credible** | History/recap later; signed-build and cohort evidence now |
| Paid claims and reminders | **Truthful and localized** | Store-console screenshots and live eligibility checks |
| Faith breadth | **Materially improved** | Human advisor/editorial review and corpus coverage |
| Community safety | **Engineering controls complete** | Staffed moderation operations, SLA, appeals, escalation |
| Commerce backend | **Configured; health green** | End-to-end signed-binary lifecycle proof |
| Google release | **Build 13 changes in review** | Review outcome and rollout confirmation |
| Apple release | **Build 15 uploaded** | Metadata/privacy/legal/trader/contact/build/IAP attachment/submission |
| Support/privacy email | **Unverified** | MX plus real inbound and reply delivery |

**Recommended release strategy:** treat P0 product engineering as complete, close the external gates above, then use a staged rollout with close health, entitlement, moderation, and retention monitoring. Do not broaden rollout on the strength of green configuration checks alone; require signed-build commerce and real-device evidence.
