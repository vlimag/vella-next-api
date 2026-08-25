# Google Ads — Vella Brazil Android setup

Last updated: 2026-08-25

This records the ended historical campaign separately from the approved setup
for a new controlled Google learning campaign. Do not reactivate the historical
campaign. Create the replacement in a paused state only after the readiness
gates in `GROWTH_LAUNCH_BOARD_BR.md` are green, and do not enable spend without
an explicit final go/no-go.

## Account and historical campaign evidence

- Manager account: approved manager account (identifier omitted).
- Client account: `712-460-9192`.
- Billing country: Brazil.
- Time zone: `(GMT-03:00) Brasília`.
- Currency: BRL. Currency and time zone cannot be casually changed later.
- Historical campaign ID: `24120421103`.
- Historical campaign status observed: **Ended / inactive**.
- Historical budget: R$46/day.
- Historical campaign total shown in the Google Ads UI: R$594.09.
- Displayed historical daily rows summed to R$594.08, a R$0.01
  display/reconciliation difference. Preserve both observations and reconcile
  them against billing/export data before financial reporting; do not infer
  missing spend or alter a row merely to force agreement.

The historical campaign and its R$594.09 total are evidence, not authorization
to reactivate it or to spend against a new campaign.

## Planned controlled replacement

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

- This document records intended configuration and evidence gates only. It does
  not establish that Firebase, GA4, Google Play, or Google Ads is linked, that a
  production event has been observed, or that any conversion action is imported.
- The runtime-1.3 custom lifecycle events are not yet production-shipped or
  observed from an installed store artifact. Keep every lifecycle/subscription
  action Secondary or unimported until exact-build DebugView and reconciliation
  evidence exists.
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

Evidence gates before any conversion import or optimization change:

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
- [ ] The intended production Firebase/GA4 property is linked and verified.
- [ ] Play Console and Google Ads are linked.
- [ ] Production-equivalent DebugView evidence exists for each intended event.
- [ ] Exactly one Play install/download action is Primary; all upper-funnel and
      subscription outcomes remain Secondary at launch.
- [ ] Server-verified trial and paid events are reconciled before import.
- [ ] Conversion actions are imported with upper-funnel actions kept
      secondary/observation-only.
- [x] Public Android listing and website CTA pass live smoke tests.
- [ ] Real annual trial shows 14 days and the correct local renewal price.
- [ ] Purchase, server validation, restore, cancellation, expiry, and webhook
      paths are verified.
- [x] First-party ingestion, retention, operator report, and privacy disclosure
      are live.
- [ ] At least two real-UI creatives pass the truth/privacy review.
- [ ] Planned replacement campaign remains paused until every signed-build, checkout, attribution,
      privacy, and creative gate is green and the final go/no-go is explicit.
- [ ] Historical campaign `24120421103` remains ended/inactive and is not
      reactivated; the replacement campaign ID is recorded after paused setup.
- [ ] Spend cannot exceed R$840 during the initial 14 campaign days or the
      R$1,000 total learning ceiling without a new explicit decision.
