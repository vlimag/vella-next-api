# Vella Brazil Android Growth Playbook

Last updated: 2026-08-30

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

## Current controlled learning sequence — 2026-08-30

Vella currently has installs and checkout activity but no verified trial starts.
Use this sequence instead of asking Google to optimize against an event that has
not yet occurred:

1. **Stage A — qualified install learning:** keep the single production campaign
   at R$30/day, Install volume (All users), with no target CPI. Use truthful
   Premium-focused assets so the traffic self-qualifies before install.
2. **Stage B — conversion observation:** after corrected GA4 events are visibly
   arriving, import `begin_checkout` and `verified_trial_start` as Secondary
   conversions only. Reconcile trial starts with authoritative server/store
   validation. Do not change bidding at the same time.
3. **Stage C — value optimization:** optimize solely toward
   `verified_trial_start` only after it is stable, unique, reconciled, and has
   enough volume for automated learning. Paid subscription starts remain the
   later business-quality check.

Change one material variable at a time and normally allow 7–14 days for learning
before judging it. Roll back a creative or optimization change if delivery
collapses or qualified downstream activity materially worsens. Never construct
advertiser-curated audiences from religion, denomination, prayer behavior,
Scripture searches, or other sensitive spiritual signals.

Reference:
https://support.google.com/google-ads/answer/14104492

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

### Days 18–30: concentrated Google test

Budget: R$600, approximately R$46 per day for 13 days.

- One Google Android App Campaign.
- Brazil only, Portuguese assets only.
- Maximize Conversions without an invented target CPI.
- Use the two strongest creator/Vella-owned videos plus square and landscape
  adaptations.
- Do not edit the campaign repeatedly during the learning period.
- Do not judge profitability before the trial cohort has aged at least 18–21
  days.

The campaign can initially optimize toward installs while Vella observes trial
and retention quality first-party. Do not scale an install winner that does not
produce meaningful use and paid conversion.

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

Every creative must:

- show Vella and real UI early;
- work without sound and include captions;
- use Brazilian Portuguese naturally;
- distinguish biblical text from AI commentary;
- avoid medical, prophetic, guaranteed-result, or personal-attribute claims;
- disclose the trial accurately when the offer appears.

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
