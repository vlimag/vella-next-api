# Vella Brazil Android Growth Playbook

Last updated: 2026-09-09

## Objective

Use a fixed R$1,000 monthly learning budget to find one repeatable acquisition
message and one economically sustainable channel for Vella on Android in Brazil.

The first 90 days are not a race for the largest install count. Success means:

1. Vella can attribute acquisition at campaign level without exporting sensitive
   devotional behavior.
2. At least one message reliably produces qualified trial users.
3. Mature 14-day trial cohorts convert to paid subscriptions at a CAC below the
   product's chosen first-year contribution limit.
4. Acquired subscribers complete meaningful devotional actions on multiple days,
   instead of installing and immediately disappearing.

## Strategic constraints

- Market: Brazil.
- Platform: Android until iOS is publicly available.
- Language: Brazilian Portuguese.
- Budget: R$1,000 per calendar month.
- Offer: 14-day free trial only for eligible new annual subscribers; monthly is
  charged immediately.
- There is no permanent free tier. Do not change product, base-plan, offer,
  price, renewal, or entitlement configuration as part of store or ad creative
  work.
- Full approved Scripture corpus: Portuguese and English. Do not buy traffic in
  other languages until corpus licensing and coverage support the promise.
- Religious conviction is sensitive personal data. Campaigns, analytics, and
  reports must never include prayer text, prayer themes, Scripture searches,
  notes, denomination, onboarding spiritual answers, or inferred beliefs.

## North-star and business metrics

North-star:

> Weekly active paid or trial subscribers who complete a meaningful devotional
> action on at least three distinct days.

Primary business metric:

> Cost per D30 retained paid subscriber.

Supporting funnel:

`campaign -> store visit -> install -> onboarding -> paywall -> verified trial -> first value -> D7 active -> paid -> D30 retained`

Financial guardrails:

```text
net first-year contribution = store proceeds - variable AI/infrastructure/support cost
allowable CAC = net first-year contribution x chosen acquisition share
allowable trial CPA = allowable CAC x observed trial-to-paid conversion
```

Use an acquisition share of 30% to 40% as a conservative starting decision, not
as a permanent truth. Replace it after Vella has real renewal and support-cost
data.

## Why the budget must be sequential

R$1,000 per month is roughly R$33 per day. Splitting that simultaneously between
Google, Meta, several creators, and production prevents every channel from
collecting useful signal. Vella should test in waves and transfer budget to the
winner.

Google recommends meaningful bid-to-budget ratios for automated App Campaigns.
At this budget, use one campaign with Maximize Conversions and no artificial
target bid during the initial learning period. Do not create multiple campaigns
for the same small audience.

## Current controlled learning sequence — 2026-09-09

Campaign `Vella_BR_Android_202608_PrayerDaily` (ID `24120421103`) was re-enabled
by explicit operator override on 2026-09-07, delivered through the fresh
2026-09-09 evidence window, and was paused again on 2026-09-09. Its configured
budget remains R$30/day and bidding remains Install volume (All users) /
Maximize conversions, without target CPI. Brazil/Portuguese targeting is
unchanged, and the single install/download action remains the sole Primary
action. Google Ads now reports that delivery cannot run because the campaign is
paused.

`begin_checkout` is now marked as a GA4 key event and imported into Google Ads as
Secondary/observation-only, excluded from account-level goals. The Google Play
purchase action also remains Secondary. Do not import or optimize toward
`verified_trial_start` because Vella still has no reconciled verified trial.

The anonymous-IAP endpoint fix introduced in API main commit `52c5bac` is
deployed on `vella.one`; the production health, missing-bearer protection, and
real anonymous-bearer diagnostic smoke checks passed. The licensed physical
Android test has not run: the intentional cancellation plus annual and monthly
purchase cases remain pending as of 2026-09-09. The operator explicitly
accepted that risk for the immediate re-enable; this override does not count
the test as completed.

At OTA publication time, mobile `main` and `origin/main` were aligned at
`1e5802e937c34397d98dd1b487e6492b8a12eb64`. The current production OTA remains
group `fc429d67-5e5a-4860-84f8-ed62c4881f82`, with Android update
`01a0805a-b507-748a-b23b-ae1ee872e4f5` and iOS update
`01a0805a-b507-79b3-9078-e316482cb659`. EAS records production channel to
production branch, runtime `1.4`, that exact commit, and
`isGitWorkingTreeDirty=false`. OTA-base verification passed 901/901 tests and
5,080 expectations with the 60-second timeout, TypeScript checking, the
creative-package verifier, and independent review with no remaining findings.

The OTA adds conservatively gated native review requests only after meaningful
value. It does not show a review request at launch, onboarding, authentication,
paywall, checkout, or purchase. It also makes no change to prices, plans, trial
eligibility or duration, renewals, entitlements, campaign economics, or Ads
configuration.

Post-OTA mobile-main-only work is metadata and creative packaging, not another
runtime release. Commit `785af371f8143188fbb17996aecff9808a48b3a6`
canonicalizes eight localized Google Play descriptions; a subsequent
creative-package change at `89034e2224780639d0e0b2ce97c7cfbc46226e79`
prepares the non-UI image family. Fresh verification of the later state passed
914/914 mobile tests with 5,359 expectations, TypeScript
checking, and the truthful PT-BR package verifier. No further OTA is needed for
either metadata-only change, and the production OTA provenance above must not
be rewritten to a later commit.

The final PT-BR Play feature graphic is a verified 1024×500, 8-bit
RGB/no-alpha PNG of 496,606 bytes (SHA-256
`7d595e7252163d4993a91e48efca8577f64b016f4356aa079ff710141eff3110`).
It and exactly nine text changes were submitted to Google Play on 2026-09-09;
the console lists all ten changes in review after quick checks completed. Six
brand-only Ads stills were uploaded and associated the same day: two concepts,
each at exactly 1200×1500, 1200×1200, and 1200×628. Google Ads reports all six
as Pending / Under review while the campaign is paused. They contain no product
UI and therefore do not satisfy the real-UI creative gate. Apple and Play
screenshots and every UI-dependent Ads still/video master remain **HOLD** with
zero approved captures.

Fresh production evidence for 2026-09-02 through 2026-09-08:

- Google Ads reported 5,990 impressions, 802 clicks, 177 installs, and R$220.07
  spend. The campaign had no serving issue, but delivery and low-cost installs
  are not evidence of subscriber value.
- Vella recorded 96 first opens, 46 onboarding completions, 41 paywall reaches,
  14 checkout starts, zero verified production trials, and zero verified
  production subscription starts. Ads and first-party counts have different
  definitions and are not a reconciled cohort; do not divide them into a
  claimed conversion rate.
- The Android checkout trace for the last seven days contained 13 starts—nine
  annual and four monthly—followed by ten `store_callback` cancellations, three
  cases without a terminal event, and zero authoritative receipt validations.
  Since 2026-08-30, Android contained 31 starts—23 annual and eight monthly—with
  26 cancellations and five without a terminal event. The approximately
  9.4-second median time to cancellation is compatible with opening and
  abandoning the Play purchase sheet, but does not prove that cause.
- No `failed_receipts`, IAP 5xx responses, conflicts, or other server failures
  were observed. Checkout successes were iOS Sandbox only and do not count as
  production conversions. Android recorded a view of the correct 14-day annual
  offer terms, but the licensed purchase-sheet, receipt-validation, and Premium
  entitlement paths remain unproven.
- The preceding GA4 inspection recorded `plan_select` at 22 events from 16
  users, `begin_checkout` at 22 events from 15 users, and
  `verified_trial_start` at zero. These are useful observability aggregates,
  not a reconciled cohort, and they do not override the zero authoritative
  production outcomes above.
- Zero `account_created` events are expected because the current flow creates
  the permanent account after purchase. With zero completed production
  purchases, no user reaches that step; this does not demonstrate an account
  creation defect.

The evidence is sufficient to reject scaling, but not to diagnose price or
subscriber economics. Paid spend was paused on 2026-09-09 before any further
optimization or restart. The truthful Play listing corrections and six-image
Ads refresh were submitted while paused, but their presence is not a reason to
re-enable. Resume only after the licensed physical Android cancellation,
annual-purchase, and monthly-purchase cases all pass. If they pass, resume the
unchanged R$30/day Install volume configuration and test the refreshed creative
before considering scale or value bidding.

Controller actions completed on 2026-09-09:

- In Google Ads, campaign `24120421103` was paused without changing its
  configured budget, bidding, conversion goals, targeting, end date, billing,
  or access. Fresh settings inspection showed R$30/day, Install volume (All
  users), Maximize conversions, no target CPI, Brazil, Portuguese, and the
  2026-09-19 end date.
- In Google Play, the full description for `en-US`, `pt-BR`, `es-ES`, `fr-FR`,
  `de-DE`, `it-IT`, `pl-PL`, and `ru-RU`, the `pt-BR` short description, and the
  verified PT-BR feature graphic were submitted as exactly ten changes. Every
  title, every non-PT short description, and all icon, screenshot, video, and
  tablet assets were preserved. The console shows Changes in review; this is not
  yet an approval or publication claim.
- In Google Ads, the four old image associations, including the visibly English
  creative, were removed and the six brand-only stills were uploaded and
  associated. The saved report contains two Portrait, two Square, and two
  Landscape rows, all Pending / Under review. All five Portuguese headlines and
  all five Portuguese descriptions were preserved.
- Action-time controller confirmation covered the campaign pause, Play
  submission, file uploads, old-association removal, and new-asset association.
  None of these actions authorizes a campaign restart.

This publication scope preserves the product economics: monthly remains an
immediate charge with no trial; exactly 14 trial days remain limited to eligible
new annual subscribers; there is no permanent free tier; and no product,
base-plan, offer, price, renewal, or entitlement configuration changes.

Use this sequence:

1. **Stage 0 — pause the current spend: complete 2026-09-09.** The campaign is
   paused. Its R$30/day configured budget, Install volume bidding, Primary goal,
   geography, end date, billing, and access were preserved.
2. **Stage A — correct acquisition truth while paused: submitted 2026-09-09.**
   The prepared Google Play listing corrections and the reviewed six-image Ads
   family are under review. Their submission is not an instruction to resume
   delivery.
3. **Stage B — complete the deferred purchase validation:** complete and record
   the cancellation, annual, and monthly licensed physical-device cases. They
   remain outstanding as of 2026-09-09 despite the earlier operator risk
   acceptance and must not be marked green before they actually pass.
4. **Stage C — controlled qualified-install restart:** only after all three
   physical cases pass, resume at the unchanged R$30/day, with the explicit
   2026-09-19 end date, Install volume (All users), no target CPI, and install as
   the sole Primary action. Measure the refreshed creative without changing a
   second material variable.
5. **Stage D — conversion observation:** observe `begin_checkout` as Secondary
   without changing bidding, budget, goals, geography, or creatives in the same
   learning window. Reconcile every later trial with authoritative server/store
   validation.
6. **Stage E — value optimization:** consider a separate value-optimization
   decision only after `verified_trial_start` is stable, unique, reconciled, and
   has enough volume for automated learning. Paid subscription starts remain the
   later business-quality check.

Change one material variable at a time and normally allow 7–14 days for learning
before judging it. Roll back a creative or optimization change if delivery
collapses or qualified downstream activity materially worsens. Never construct
advertiser-curated audiences from religion, denomination, prayer behavior,
Scripture searches, or other sensitive spiritual signals.

Reference:
https://support.google.com/google-ads/answer/14104492

The month-by-month sections below are a strategic sequencing framework. The
controlling state updated on 2026-09-09 and the gate above govern campaign
operations; older day labels or allocations do not authorize a configuration
change or extension of the current controlled learning window.

## Month 1 — prove the message

### Days 1–7: instrumentation and owned launch

Paid spend: R$0.

- Ship Android-first website CTAs and remove unavailable iOS destinations.
- Verify one real annual trial through purchase, cancellation, webhook delivery,
  expiry, and entitlement updates.
- Turn on the first-party growth funnel and operator report.
- Publish three Portuguese short-form videos from Vella-owned accounts.
- Invite a small set of trusted testers or community contacts with unique
  campaign links.
- Establish the baseline for onboarding, paywall, first-value, D1, and D7.

### Days 8–17: creator message test

Budget: up to R$400.

Recruit three to five small Brazilian Christian creators. Prefer trusted,
practical voices over follower count. A creator may receive a small fixed fee,
an affiliate-style future bonus, or a product collaboration depending on fit.

Each creator receives one brief but keeps their own voice:

- one vertical 15–30 second demonstration;
- two Story frames;
- the real app visible in the first three seconds;
- one unique Play campaign link;
- permission for Vella to reuse the raw footage for paid promotion;
- clear paid-collaboration disclosure when compensation applies.

Do not script theological claims or guaranteed outcomes. Collect qualified
traffic and identify the strongest hook.

### Controlled Google test — started 2026-09-07; paused 2026-09-09

Configuration at the 2026-09-09 evidence snapshot: R$30/day through the explicit
2026-09-19 end date. The originally scheduled 13-date span was nominally R$390,
with a R$420 operator ceiling, but the current stop gate supersedes that nominal
spend plan.

- One Google Android App Campaign.
- Brazil only, Portuguese assets only.
- Maximize Conversions without an invented target CPI.
- Keep install as the sole Primary action and `begin_checkout` as
  Secondary/observation-only.
- Delivery is paused. The truthful Play listing update and prepared brand-only
  images were submitted while paused and are under review.
- Do not restart until the licensed physical cancellation, annual-purchase, and
  monthly-purchase cases pass.
- After the gate passes, restart at the unchanged configuration and change only
  the image family for a controlled creative measurement.

The campaign can optimize toward installs while Vella observes trial and
retention quality first-party, but the current evidence contains no verified
production trial cohort to mature. Do not buy or scale more installs until the
purchase gate passes and paid traffic produces authoritative subscription
outcomes.

## Month 2 — repeat the winner

Suggested allocation:

- R$700: the best Month 1 acquisition source and creative family.
- R$200: one new creator or one materially different hook.
- R$100: creative editing, captions, thumbnails, or contingency.

Run one message experiment at a time. Recommended order:

1. Prayer Space versus Daily Scripture positioning.
2. First Play screenshot or feature graphic.
3. Annual-trial framing versus feature-led framing, with identical truthful price
   disclosure.

The control and treatment must use distinct campaign/custom-listing identifiers.

## Month 3 — scale or fix the product

Scale only if two mature cohorts show:

- reliable checkout and receipt validation;
- healthy first-value completion;
- D7 meaningful use that is not collapsing;
- trial-to-paid conversion compatible with the CAC ceiling;
- acceptable cancellation, refund, notification opt-out, and support burden.

If those conditions are met:

- R$800 to the established winner;
- R$200 to continuous creative renewal.

If they are not met, do not buy more installs. Spend the month improving the
specific failing layer:

- visits but no installs: store promise or creative;
- installs but no onboarding: expectation mismatch or app quality;
- onboarding but no trial: proof of value, price, or paywall;
- trials but no first value: activation and content relevance;
- active trials but weak conversion: value continuity, trial expectation, or
  pricing;
- good conversion but poor retention: habit, notification quality, or recurring
  product value.

## Creative system

Create four reusable message families.

### 1. Prayer when words are difficult

Hook:

> Quando faltam palavras para orar, comece pelo que está no seu coração.

Show Prayer Space, approved Scripture, the private prayer field, and the
answered/gratitude state. Never expose a real user's private text.

### 2. A private prayer memory

Hook:

> Um espaço privado para lembrar por quem você orou — e perceber o que mudou.

Lead with privacy and the answered-prayer journal. Avoid promising that a
specific prayer will be answered.

### 3. Scripture at the chosen time

Hook:

> Receba uma mensagem de fé no horário que você escolher.

Show an actual localized notification and the approved Scripture inside Vella.

### 4. A calm three-minute rhythm

Hook:

> Bíblia, oração e reflexão em poucos minutos, no seu ritmo.

Show Daily Light, one small guided step, and completion without streak pressure.

Every product-demonstration creative must:

- show Vella and real UI early;
- work without sound and include captions;
- use Brazilian Portuguese naturally;
- distinguish biblical text from AI commentary;
- avoid medical, prophetic, guaranteed-result, or personal-attribute claims;
- disclose the trial accurately when the offer appears.

The prepared brand-only still family is the explicit non-UI exception: it may
use the current Vella icon and approved decorative background, but it may not
imply that the background is product UI. All screenshot and video concepts stay
held until current, platform-native UI captures pass truth and privacy review.

Approved offer wording:

> 14 dias grátis no plano anual para novos assinantes elegíveis. Depois,
> R$X/ano, com renovação automática. Cancele antes do fim do teste para não ser
> cobrado. O plano mensal não inclui teste grátis.

Never describe the entire subscription-only app simply as “grátis”.

## Store and link architecture

Create four Google Play custom listing concepts when traffic supports them:

1. `prayer-space-br`
2. `daily-scripture-br`
3. `prayer-journal-br`
4. `daily-reminder-br`

Campaign convention:

```text
utm_source: google | creator_<handle> | instagram | youtube | whatsapp | vella_site
utm_medium: paid_app | creator | organic_social | referral | owned
utm_campaign: br_android_YYYYMM_<message>
utm_content: <creative_id>
```

Keep raw query parameters out of product analytics. The website may normalize
allowlisted campaign identifiers before recording aggregate CTA activity.

Google Play custom listing reference:
https://support.google.com/googleplay/android-developer/answer/9867158

## Owned content cadence

Minimum sustainable cadence:

- three short-form videos per week;
- one high-quality Portuguese article per week;
- one product demonstration or founder note per week;
- daily community replies without automated theological advice.

First SEO/content cluster:

1. Como criar um diário de oração
2. Como manter uma rotina de oração possível
3. Oração para começar o dia com calma
4. Como orar antes de dormir quando a mente não desacelera
5. Como registrar orações respondidas com gratidão
6. Versículos para dias difíceis — com contexto
7. Como estudar um versículo sem tirá-lo do contexto

Every article should deliver standalone value and end with a contextual Android
install CTA. Avoid thin pages created only for keywords.

## Reporting cadence

Daily automated checks:

- checkout and purchase-validation failures;
- webhook failures;
- campaign spend anomalies after Ads data is connected;
- notification delivery failures;
- crash-free health after crash reporting exists.

Weekly growth review:

- campaign and creator funnel;
- creative-level CTA and install quality;
- onboarding, paywall, first-value, D1, and D7;
- recommended next experiment;
- no budget change without an explicit decision.

Every 21 days:

- mature trial-to-paid cohort;
- paid CAC and early payback;
- cancellation and refund guardrails.

Monthly:

- D30 retained-paid CAC;
- renewal and churn;
- net contribution and LTV assumptions;
- creator quality and content-assisted acquisition;
- decision to scale, hold, or fix the funnel.

## Privacy and advertising boundaries

- Never export Vella users, hashed emails, prayer behavior, onboarding choices,
  search behavior, or notification topics to an ad platform.
- Never create audiences based on religion, denomination, prayer, anxiety,
  healing, family concerns, or any inferred sensitive state.
- Keep Vella product analytics first-party and aggregate small cohorts.
- Suppress campaign/locale reporting for cohorts smaller than 20 users.
- Retain raw growth events for no more than 90 days; keep only daily aggregates
  longer when possible.
- Review privacy disclosures and store Data Safety answers whenever analytics
  behavior changes.

References:

- ANPD sensitive-data definition:
  https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd
- Google personalized-advertising policy:
  https://support.google.com/adspolicy/answer/143465
- Meta sensitive targeting change:
  https://about.fb.com/news/2021/11/civil-rights-audit-progress-report/
- Google Play subscription disclosure policy:
  https://support.google.com/googleplay/android-developer/answer/9900533

## iOS entry rule

iOS approval is not a launch dependency. Keep the unavailable App Store CTA
disabled while Android collects signal. When iOS is public:

1. enable the App Store CTA and Smart App Banner;
2. create App Store campaign links for each winning message;
3. reuse Android's winning creative concepts, but measure iOS independently;
4. add Apple Ads only after the iOS onboarding and purchase funnel is verified;
5. never combine platform CAC or retention without a platform-level view.

Apple campaign links:
https://developer.apple.com/help/app-store-connect-analytics/acquisition/campaign-links/
