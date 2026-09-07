# Google Ads — Vella Brazil Android setup

Last updated: 2026-09-07

This records the verified live configuration separately from older campaign
snapshots and pre-launch plans. The production campaign is paused. Do not resume
it until the licensed physical-Android cancellation, annual, and monthly
purchase gate described below is complete.

## Current verified live state — 2026-09-07

This section is the controlling operational record and supersedes every older
plan or snapshot below wherever they differ.

- Campaign `Vella_BR_Android_202608_PrayerDaily` (ID `24120421103`) is
  **paused**. Its configured budget remains **R$30/day**, with Brazil-only and
  Portuguese targeting. The known religious-belief limitation is expected for
  this product; it is not a disapproval.
- Bidding remains **Install volume (All users)** / Maximize conversions, with no
  target CPI. Pausing did not change budget, bidding, targeting, billing, or
  access.
- Google Play and the intended GA4 property are linked. `begin_checkout` was
  marked as a GA4 key event and imported into Google Ads as **Secondary**,
  observation-only, and excluded from account-level goals. The single Google
  Play install/download action remains the sole **Primary** action. The Google
  Play purchase conversion remains Secondary, Awaiting conversions, with zero
  recorded conversions.
- API main commit `52c5bac` is deployed on `vella.one`. Production checks
  returned 200 from the health endpoint, kept missing-bearer requests protected
  with 401, and accepted and persisted a privacy-safe IAP diagnostic from a real
  Supabase-anonymous bearer with 202; the smoke event and user were then removed.
- Campaign resumption is blocked on a licensed physical Android test: record one
  intentional cancellation, then verify both annual and monthly purchases reach
  authoritative receipt validation and Premium entitlement. This gate is still
  pending, so the campaign must remain paused.
- First-party Vella telemetry for 2026-08-23 through 2026-08-30 recorded 122
  first opens, 47 installs reaching the paywall, 15 installs starting checkout,
  zero verified trials, and zero verified paid subscription starts. These
  aggregates diagnose product quality; they are not Google Ads conversions.
- GA4 automatic events were arriving, while mapped custom events were absent.
  The root cause was native Analytics consent missing an explicit
  `analytics_storage` grant. Runtime 1.4 now grants analytics storage while
  retaining `ad_storage`, `ad_user_data`, and `ad_personalization` as denied.
  This privacy-safe JavaScript correction was published to production for iOS
  and Android by OTA on 2026-08-30.
- `begin_checkout` is now available for measurement only. Do not import or bid
  on `verified_trial_start` until a real authoritative event exists and is
  reconciled with the server/store record; no verified trials currently exist.
- The exact current Brazilian annual renewal price was not proven in the local
  release evidence during this refinement. Trial duration and exact price were
  therefore intentionally omitted from ad copy rather than risk a stale or
  misleading offer.

Current text assets saved on 2026-08-30:

Headlines:

1. `Sua fé, todos os dias`
2. `Vella Premium: ore e reflita`
3. `Planos mensal e anual`
4. `Jornadas guiadas de oração`
5. `Versículos para cada momento`

Descriptions:

1. `Versículos, oração e reflexões para cultivar sua fé todos os dias.`
2. `Vella é Premium: escolha o plano mensal ou anual e confira os termos antes de assinar.`
3. `Encontre passagens bíblicas, salve favoritos e acompanhe jornadas guiadas.`
4. `Assinatura necessária após a experiência inicial. Veja preços e condições no app.`
5. `Ore, busque versículos e siga jornadas guiadas com todos os recursos Premium.`

The three new headlines and three new descriptions were under asset review when
saved on 2026-08-30. Their review state was not part of the 2026-09-07 live
verification. Keep the campaign paused at its current budget and bid mode while
the physical purchase gate remains incomplete.

## Account and campaign-history evidence

- Manager account: approved manager account (identifier omitted).
- Client account: `712-460-9192`.
- Billing country: Brazil.
- Time zone: `(GMT-03:00) Brasília`.
- Currency: BRL. Currency and time zone cannot be casually changed later.
- Production campaign ID: `24120421103`.
- Current status verified on 2026-09-07: **Paused**.
- An older UI snapshot showed **Ended / inactive**; that snapshot is historical
  and must not be used as the current campaign state.
- Historical budget: R$46/day.
- Historical campaign total shown in the Google Ads UI: R$594.09.
- Displayed historical daily rows summed to R$594.08, a R$0.01
  display/reconciliation difference. Preserve both observations and reconcile
  them against billing/export data before financial reporting; do not infer
  missing spend or alter a row merely to force agreement.

The older R$46/day and R$594.09 observations are financial history, not the
current configuration and not authorization to resume spend. The current
R$30/day paused state above controls.

## Superseded pre-launch replacement plan

This section is retained only as historical planning context. It is not an
instruction to create another campaign, change the current R$30/day budget, or
resume campaign `24120421103`.

- Campaign name: `Vella_BR_Android_202608_PrayerDaily`.
- Planned campaign ID: pending.
- Campaign type: App promotion / Android.
- App listing: approved Vella Android store listing (identifier omitted).
- Geography: Brazil only.
- Language: Portuguese.
- Initial objective: install volume while first-party activation and mature
  subscription quality are observed separately.
- Initial bid mode: Maximize conversions / install volume without an invented
  target CPI or target CPA.
- Budget: R$60/day, with a 14-day campaign cap of R$840 and an R$1,000 total learning ceiling including contingency. The remaining R$160 cannot be spent without a new explicit approval.
- start state: **paused** until the runtime-1.3 signed-build, checkout, analytics,
  attribution, privacy, and creative gates are verified.

Do not optimize to a client-declared trial event. Google/Play-reported installs
and Vella's authoritative subscription state must be reviewed together. The
native Install Referrer bridge is implemented in candidate source but is not
production-shipped; campaign
activation still waits for signed-build and production measurement proof.

## Text assets

Headlines (30-character limit):

1. `Um espaço diário de fé`
2. `Bíblia e oração no seu ritmo`
3. `Sua jornada de oração`
4. `Versículos para cada dia`
5. `Ore, reflita e siga`

Descriptions (90-character limit):

1. `Crie um ritmo diário com Bíblia, oração e reflexão em poucos minutos.`
2. `Registre orações em privado e acompanhe seus momentos de gratidão.`
3. `Receba uma mensagem de fé no horário que você escolher.`
4. `Busque passagens bíblicas por tema e guarde versículos importantes.`
5. `Conheça a Vella no Android e cultive uma prática constante, no seu ritmo.`

These assets do not claim or infer the viewer's religion, hardship, health,
denomination, or spiritual state. They also avoid saying the app is free. If a
future asset mentions the annual trial, it must show the verified Brazilian
annual renewal price and the full auto-renewal/cancellation disclosure.

## Visual assets

Google may initially draw the icon and listing media from Google Play. Before
the paid phase, add real current Android product demonstrations for at least two
of these concepts:

1. Prayer Space when words are difficult.
2. A private prayer memory and gratitude check-in.
3. A complete Scripture/encouragement notification at the chosen time.
4. A calm, short daily Scripture and reflection rhythm.

Required exports:

- 1080 × 1920 vertical video;
- 1080 × 1080 square video/image;
- 1200 × 628 landscape image;
- captions that work without sound;
- no real personal, prayer, search, notification-token, account, or purchase
  data visible.

## Conversion and reporting truth

- The intended GA4 property and Google Play are linked to Google Ads.
  `begin_checkout` is imported as Secondary and excluded from account-level
  goals; the single install/download action remains the sole Primary action.
- Runtime 1.4 is production-shipped. API main commit `52c5bac` accepts the
  privacy-safe diagnostic from the technical anonymous session while retaining
  bearer protection. The remaining licensed physical Android purchase gate is
  still required before campaign resumption.
- Keep every other lifecycle/subscription action Secondary or unimported until
  exact-build observation and authoritative server/store reconciliation exist.
- Google Ads and Play Console own the ad-click-to-install view.
- Vella's first-party report owns anonymous product mechanics and authoritative
  server/store subscription health.
- Runtime 1.3 uses Google's native Play Install Referrer library. It parses and
  sends only allowlisted source, medium, campaign, and creative codes beside the
  random pseudonymous install ID, then discards the raw referrer on-device. It
  never stores or sends `gclid`, arbitrary referrer text, timestamps, install
  version, AAID, account identity, or devotional data.
- After authenticated Vella-profile hydration, the server may link that install
  to the Vella profile for authoritative subscription-outcome measurement. A
  shared Supabase Auth user created in another app is not counted until Vella
  creates that profile. Multi-account installs remain permanently ambiguous for
  user-level attribution.
- Google Ads and Play reporting remain the authoritative modeled ad-to-install
  view. Do not claim exact first-party campaign CAC when no approved campaign
  code is present.
- Record daily actual Google spend in the Vella operator growth console.
- Decide from mature cohorts, not the first few days of a 14-day trial.

Evidence gates before any future optimization change or campaign resumption:

1. Process the Android Release manifest and prove both advertising-ID
   permissions are absent while privacy-preserving attribution remains present.
2. Observe each intended event on a production-equivalent test device in
   Firebase DebugView without exposing account, device, installation, receipt,
   purchase-token, or other personal identifiers.
3. Reconcile `verified_trial_start` and `verified_subscription_start` against
   server-validated store outcomes. Automatic client-side store purchase events
   are never authoritative subscription validation and are not verified
   conversions.
4. Confirm the intended production Firebase/GA4 property, Google Play account,
   and Google Ads client are linked in their consoles, with no identifier copied
   into this repository.
5. Import actions only after the matching source event and link are visibly
   healthy; retain screenshots or controller notes outside source control as
   appropriate.

Intended conversion hierarchy after those gates pass:

1. Use exactly one Google Play install/download conversion as Primary at
   relaunch. Do not create overlapping Primary install actions.
2. `verified_trial_start` and `verified_subscription_start` are the only
   server-verified subscription outcomes eligible to become later business
   conversion goals. Keep them Secondary until they are unique, reconciled, and
   each reaches at least ten distinct users per day; keep them separate so trial
   volume never obscures paid starts.
3. Automatic client-side purchase/subscription events are diagnostic signals
   only. Do not import or label them as verified subscription conversions.
4. `onboarding_begin`, `onboarding_complete`, `first_experience_begin`,
   `first_experience_complete`, `vella_profile_initialized`, `paywall_view`,
   `plan_select`, and `begin_checkout` start Secondary and observation-only.
   They may diagnose the funnel but must not steer bidding as Primary goals at
   launch.
5. Google Play install/first-open reporting remains the uppermost acquisition
   signal and must not be represented as proof of subscription value.

## Launch checklist

- [ ] Dedicated Vella client account exists under the approved manager account.
- [ ] Billing profile/payment method is intentionally confirmed.
- [x] The intended production Firebase/GA4 property is linked and verified.
- [x] Play Console and Google Ads are linked.
- [ ] Production-equivalent DebugView evidence exists for each intended event.
- [x] Exactly one Play install/download action is Primary; all upper-funnel and
      subscription outcomes remain Secondary at launch.
- [ ] Server-verified trial and paid events are reconciled before import.
- [x] `begin_checkout` is imported as Secondary/observation-only and excluded
      from account-level goals.
- [x] Public Android listing and website CTA pass live smoke tests.
- [ ] Real annual trial shows 14 days and the correct local renewal price.
- [ ] Licensed physical Android cancellation plus annual and monthly purchase,
      receipt validation, and Premium-entitlement paths are verified.
- [x] First-party ingestion, retention, operator report, and privacy disclosure
      are live.
- [ ] At least two real-UI creatives pass the truth/privacy review.
- [x] Campaign `24120421103` was paused on 2026-09-07 without changing its
      R$30/day budget, Install volume bidding, or Brazil/Portuguese targeting.
- [ ] Keep the campaign paused until the licensed physical Android gate passes.
- [ ] After that gate is completed and recorded, the controlled plan may resume
      at R$30/day for at most 14 campaign days (R$420). Any budget, bid, goal,
      geography, or duration increase requires a new explicit decision.
