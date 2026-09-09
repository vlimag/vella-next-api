# Google Ads — Vella Brazil Android setup

Last updated: 2026-09-09

This records the verified live configuration separately from older campaign
snapshots and pre-launch plans. The production campaign was re-enabled by
explicit operator override on 2026-09-07, delivered through the fresh
2026-09-09 evidence window, and was paused again on 2026-09-09 before further
optimization. The licensed physical-Android cancellation, annual, and monthly
purchase test has not run and remains an outstanding validation. The truthful
Play listing and reviewed image refresh were submitted while delivery was
paused; neither action authorizes a restart.

## Current controlling state — updated 2026-09-09

This section is the controlling operational record and supersedes every older
plan or snapshot below wherever they differ.

- Campaign `Vella_BR_Android_202608_PrayerDaily` (ID `24120421103`) is
  **Paused** as verified on 2026-09-09. Google Ads reports that the campaign
  cannot run because it is paused. Its configured budget remains
  **R$30/day**, with Brazil-only and Portuguese targeting. The known
  religious-belief limitation is expected for this product when delivery is
  active; it is not a disapproval.
- Bidding remains **Install volume (All users)** / Maximize conversions, with no
  target CPI. The pause and image-only refresh did not change budget, bidding,
  goals, targeting, end date, billing, or access. The controlled learning
  window began on 2026-09-07 and retains its explicit campaign end date of
  **2026-09-19**. At R$30/day, the originally scheduled 13-date span was
  nominally R$390 with an R$420 operator ceiling, but the 2026-09-09
  pause-before-restart gate supersedes that nominal spend plan.
- Google Play and the intended GA4 property are linked. `begin_checkout` was
  marked as a GA4 key event and imported into Google Ads as **Secondary**,
  observation-only, and excluded from account-level goals. The single Google
  Play install/download action remains the sole **Primary** action. The Google
  Play purchase conversion remains Secondary, Awaiting conversions, with zero
  recorded conversions.
- The anonymous-IAP endpoint fix introduced in API main commit `52c5bac` is
  deployed on `vella.one`. Production checks returned 200 from the health
  endpoint, kept missing-bearer requests protected with 401, and accepted and
  persisted a privacy-safe IAP diagnostic from a real Supabase-anonymous bearer
  with 202; the smoke event and user were then removed.
- At publication time, mobile `main` was pushed and clean at
  `1e5802e937c34397d98dd1b487e6492b8a12eb64`, with zero divergence from
  `origin/main`. The 2026-09-08 production OTA remains group
  `fc429d67-5e5a-4860-84f8-ed62c4881f82`: Android update
  `01a0805a-b507-748a-b23b-ae1ee872e4f5` and iOS update
  `01a0805a-b507-79b3-9078-e316482cb659`. EAS reports production channel to
  production branch, runtime `1.4`, the exact commit above, and
  `isGitWorkingTreeDirty=false` for both platforms.
- The OTA-base release verification passed 901/901 mobile tests with 5,080
  expectations using the 60-second test timeout, TypeScript checking, the
  PT-BR package verifier, and independent review with no remaining findings.
  The OTA adds only conservatively gated, post-value native review prompting;
  it does not change any price, plan, trial, renewal, entitlement, or campaign
  setting.
- Later mobile-main-only metadata work is deliberately separate from that OTA:
  commit `785af371f8143188fbb17996aecff9808a48b3a6` canonicalizes the eight
  localized Google Play descriptions, and commit
  `89034e2224780639d0e0b2ce97c7cfbc46226e79` prepares controller-uploadable,
  non-UI ad images. Neither change modifies
  the installed runtime, so neither requires another OTA. Fresh verification
  over the later metadata/creative state passed 914/914 mobile tests with 5,359
  expectations, TypeScript checking, and the truthful PT-BR package verifier;
  the verifier confirmed that the non-UI Ads stills are ready while every
  UI-dependent export remains blocked.
- The final Play PT-BR feature graphic was submitted to Google Play on
  2026-09-09. It is 1024×500, 8-bit RGB without alpha, 496,606 bytes, SHA-256
  `7d595e7252163d4993a91e48efca8577f64b016f4356aa079ff710141eff3110`.
  Google Play lists exactly ten changes in review: eight localized full
  descriptions, the PT-BR short description, and the PT-BR feature graphic.
  Google Play subsequently reported that the changes are now in review; this
  is a submission, not an approval or publication claim. The six brand-only Ads
  stills were also associated on 2026-09-09: two concepts, each at exactly
  1200×1500, 1200×1200, and 1200×628. All six report Pending / Under review and
  Campaign is paused. They use the current Vella brand, contain no product UI,
  and do not clear the separate real-UI gate. Apple and Play screenshots plus
  all UI-dependent Ads still and video masters remain **HOLD** with zero
  approved captures; no fabricated or wrong-platform UI may replace them.
- The licensed physical Android test has not run: it must still record one
  intentional cancellation, then verify both annual and monthly purchases reach
  authoritative receipt validation and Premium entitlement. The operator
  explicitly accepted the risk of re-enabling before this validation; do not
  record this gate as complete until the three cases actually pass. It remained
  outstanding on 2026-09-09.
- First-party Vella telemetry for 2026-09-02 through 2026-09-08 recorded 96
  first opens, 46 onboarding completions, 41 installs reaching the paywall, 14
  installs starting checkout, zero verified production trials, and zero
  verified production subscription starts. These aggregates diagnose product
  quality; they are not Google Ads conversions or a reconciled cohort.
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

Fresh production evidence for 2026-09-02 through 2026-09-08:

- Google Ads reported 5,990 impressions, 802 clicks, and 177 installs on
  R$220.07 spend. The campaign remained Enabled / Eligible with no serving
  issue, but install delivery alone does not establish subscriber economics.
- Vella recorded 96 first opens, 46 onboarding completions, 41 paywall reaches,
  14 checkout starts, zero verified production trials, and zero verified
  production subscription starts. Google Ads and first-party counts have
  different reporting definitions and are not a reconciled user cohort; do not
  divide them into a claimed end-to-end conversion rate.
- The Android checkout trace for the last seven days contained 13 starts: nine
  annual and four monthly. Ten ended in a `store_callback` cancellation, three
  had no terminal event, and none reached authoritative receipt validation.
  Since 2026-08-30, Android contained 31 starts—23 annual and eight monthly—with
  26 cancellations and five without a terminal event. Median time to
  cancellation was approximately 9.4 seconds, which is compatible with opening
  and abandoning the Google Play purchase sheet but does not prove that cause.
- No `failed_receipts`, IAP 5xx responses, conflicts, or other server failures
  were observed. Recorded checkout successes were iOS Sandbox only and are not
  production conversions. Android recorded a view of the correct 14-day annual
  offer terms, but that does not prove the licensed Play purchase sheet,
  validation, or entitlement path.
- The preceding GA4 inspection recorded `plan_select` at 22 events from 16
  users, `begin_checkout` at 22 events from 15 users, and
  `verified_trial_start` at zero. These aggregates remain useful observability
  evidence, but they are not a reconciled cohort and do not override the zero
  authoritative production outcomes above.
- Zero `account_created` events are expected under the current post-purchase
  account flow: without a completed production purchase, users do not reach
  account creation. This is not evidence that account creation itself failed.

This evidence does not support scaling or value optimization. Paid spend was
**paused before further campaign optimization or restart** on 2026-09-09. Run
the licensed physical Android cancellation, annual-purchase, and
monthly-purchase gate next. The truthful Play listing correction and reviewed
image refresh are now in review, but the campaign must not be re-enabled merely
because those submissions were completed. Re-enable only after all three
physical cases pass; if they pass, resume at the unchanged R$30/day, Install
volume configuration and measure the refreshed creative before any scale
decision.

External changes performed on 2026-09-09:

- **Google Ads delivery:** campaign `24120421103` was paused. Fresh settings
  inspection retained R$30/day, Install volume (All users), Maximize
  conversions, no target CPI, Brazil, Portuguese, and the 2026-09-19 end date.
- **Google Play:** exactly ten changes were submitted for review: the full
  description for `en-US`, `pt-BR`, `es-ES`, `fr-FR`, `de-DE`, `it-IT`,
  `pl-PL`, and `ru-RU`; the `pt-BR` short description; and the verified PT-BR
  feature graphic. Every title, every non-PT short description, and all icon,
  screenshot, video, and tablet assets were preserved. The new feature graphic
  was truthfully included in the existing AI-assisted asset declaration.
- **Google Ads assets:** the four old image associations were removed and the
  six reviewed brand-only stills were uploaded and associated. The saved report
  contains two 1200×1500 Portrait, two 1200×1200 Square, and two 1200×628
  Landscape rows, all Pending / Under review while the campaign is paused. All
  five Portuguese headlines and all five Portuguese descriptions were
  preserved.
- These completed controller actions did not alter commerce: monthly remains an
  immediate charge with no trial; only eligible new annual subscribers receive
  exactly 14 trial days; there is no permanent free tier; and product, base-plan,
  offer, price, renewal, and entitlement configuration remain untouched. They
  also did not alter Ads bidding, goals, budget, targeting, billing, or access.

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

The current ad asset report contains all five Portuguese headlines and all five
Portuguese descriptions above plus the six new image rows described above. The
ad is under review and the campaign remains paused at the configured R$30/day
budget and unchanged Install volume bid mode. Do not restart until the deferred
physical purchase validation passes.

## Account and campaign-history evidence

- Manager account: approved manager account (identifier omitted).
- Client account: `712-460-9192`.
- Billing country: Brazil.
- Time zone: `(GMT-03:00) Brasília`.
- Currency: BRL. Currency and time zone cannot be casually changed later.
- Production campaign ID: `24120421103`.
- Current status verified after the 2026-09-09 stop action: **Paused**. The
  earlier Enabled / Eligible state remains historical evidence for the
  Sep 2–8 delivery window, not the current delivery state.
- An older UI snapshot showed **Ended / inactive**; that snapshot is historical
  and must not be used as the current campaign state.
- Historical budget: R$46/day.
- Historical campaign total shown in the Google Ads UI: R$594.09.
- Displayed historical daily rows summed to R$594.08, a R$0.01
  display/reconciliation difference. Preserve both observations and reconcile
  them against billing/export data before financial reporting; do not infer
  missing spend or alter a row merely to force agreement.

The older R$46/day and R$594.09 observations are financial history, not the
current configuration and not authorization to increase spend. The current
R$30/day configuration and the 2026-09-09 pause-before-restart gate above
govern.

## Superseded pre-launch replacement plan

This section is retained only as historical planning context. It is not an
instruction to create another campaign, change the current R$30/day budget, or
otherwise change campaign `24120421103`.

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
production-shipped; at the time of this superseded plan, campaign activation was
intended to wait for signed-build and production measurement proof.

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

Google may initially draw the icon and listing media from Google Play. As soon
as approved platform-native captures exist, add real current Android product
demonstrations for at least two of these concepts without fabricating interim
UI:

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

The six prepared September brand-only stills are an intentionally narrower
interim asset family. Two brand concepts have verified 1200×1500,
1200×1200, and 1200×628 exports. All six were controller-uploaded and associated
on 2026-09-09 and are under review. Because they contain no product UI, they do
not satisfy the real-UI requirement above and do not authorize generation or
release of any held screenshot or video master.

## Conversion and reporting truth

- The intended GA4 property and Google Play are linked to Google Ads.
  `begin_checkout` is imported as Secondary and excluded from account-level
  goals; the single install/download action remains the sole Primary action.
- Runtime 1.4 is production-shipped. API main commit `52c5bac` accepts the
  privacy-safe diagnostic from the technical anonymous session while retaining
  bearer protection. The current mobile production OTA is group
  `fc429d67-5e5a-4860-84f8-ed62c4881f82` from clean, pushed mobile main commit
  `1e5802e937c34397d98dd1b487e6492b8a12eb64`. The licensed physical Android
  purchase validation remains incomplete, even though the operator explicitly
  accepted that risk and re-enabled the campaign on 2026-09-07. The later
  2026-09-09 pause restored the physical-purchase gate before any restart.
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

Evidence gates before any campaign restart, optimization change, or expansion:

1. Complete one licensed physical Android cancellation, one annual purchase,
   and one monthly purchase. Both purchases must reach authoritative receipt
   validation and Premium entitlement; viewing correct offer terms is not a
   substitute.
2. Process the Android Release manifest and prove both advertising-ID
   permissions are absent while privacy-preserving attribution remains present.
3. Observe each intended event on a production-equivalent test device in
   Firebase DebugView without exposing account, device, installation, receipt,
   purchase-token, or other personal identifiers.
4. Reconcile `verified_trial_start` and `verified_subscription_start` against
   server-validated store outcomes. Automatic client-side store purchase events
   are never authoritative subscription validation and are not verified
   conversions.
5. Confirm the intended production Firebase/GA4 property, Google Play account,
   and Google Ads client are linked in their consoles, with no identifier copied
   into this repository.
6. Import actions only after the matching source event and link are visibly
   healthy; retain screenshots or controller notes outside source control as
   appropriate.

Conversion hierarchy controlling the paused/restart state and later changes:

1. Use exactly one Google Play install/download conversion as Primary throughout
   the current learning window. Do not create overlapping Primary install
   actions.
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
- [x] At OTA publication time, mobile main was pushed clean with zero remote
      divergence at
      `1e5802e937c34397d98dd1b487e6492b8a12eb64`; production OTA group
      `fc429d67-5e5a-4860-84f8-ed62c4881f82` reports runtime 1.4, both
      platforms, the exact commit, and a clean working tree.
- [x] Post-OTA store/creative metadata passes 914/914 tests, 5,359 expectations,
      TypeScript checking, and the package verifier; no further OTA is needed.
- [x] The PT-BR Play feature graphic and six brand-only Ads stills are verified
      and inventoried; all UI-dependent screenshot and Ads media exports remain
      explicitly held.
- [x] Submit the prepared eight-locale Play description scope, PT-BR short
      description, and PT-BR feature graphic after grouped controller
      confirmation, without changing any preserved listing field. Google Play
      showed ten changes in review on 2026-09-09; approval/publication is still
      pending.
- [x] Remove the four old Ads image associations and associate the six prepared
      brand stills after the same grouped controller confirmation, without
      changing text or campaign settings. All six were Pending / Under review
      on 2026-09-09.
- [ ] At least two real-UI creatives pass the truth/privacy review.
- [x] Campaign `24120421103` was paused on 2026-09-07 without changing its
      R$30/day budget, Install volume bidding, or Brazil/Portuguese targeting.
- [x] The operator explicitly accepted the pending physical-purchase risk and
      re-enabled campaign `24120421103` on 2026-09-07; its pre-pause live status
      was verified on 2026-09-09 as Enabled / Eligible with no serving issue and
      configuration unchanged.
- [x] Pause campaign `24120421103` following the 2026-09-09 production evidence,
      without changing its configured budget, bidding, goals, targeting, end
      date, billing, or access. Fresh inspection confirmed Paused, R$30/day,
      Install volume (All users), Maximize conversions, no target CPI, Brazil,
      Portuguese, and the 2026-09-19 end date.
- [ ] Complete and record the licensed physical Android cancellation plus
      annual and monthly purchase, receipt-validation, and Premium-entitlement
      cases. As of 2026-09-09, this test has not run.
- [ ] Re-enable only after all three licensed physical Android cases pass; use
      the unchanged R$30/day Install volume configuration for the controlled
      creative measurement before any scale or value-optimization decision.
- [x] The controlled learning window began on 2026-09-07 at R$30/day for at
      most 13 scheduled dates through the explicit 2026-09-19 end date
      (nominally R$390, with a R$420 operator ceiling). The 2026-09-09 stop gate
      now supersedes that nominal spend plan. Any budget, bid, goal, geography,
      or duration increase requires a new explicit decision.
