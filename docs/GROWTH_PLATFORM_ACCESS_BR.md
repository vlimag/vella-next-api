# Vella growth platform access — Brazil launch

Last updated: 2026-08-25

The Month 1 budget is R$1,000. Only Google Ads should receive paid-media budget
at launch. The other accounts below establish owned distribution, measurement,
and future optionality without fragmenting the learning budget.

## Sign in now

### 1. Google Ads and Google Play Console

- Open the organization-controlled Google Ads manager through the approved
  credential record; do not copy account identifiers into documentation.
- Open the existing Vella client `712-460-9192` in BRL and Brasília time; do not
  create a duplicate client.
- Link the existing Vella Android listing by its non-sensitive console label;
  do not copy application identifiers into documentation.
- The historical campaign `24120421103` remains ended/inactive; do not
  reactivate it.
- Create `Vella_BR_Android_202608_PrayerDaily` only after the readiness gates
  pass. The replacement campaign ID is pending, and its start state must remain
  paused until the explicit go/no-go.
- Do not enable spend until every gate in `GROWTH_LAUNCH_BOARD_BR.md` is green.

### 2. Google Search Console

- Verify the domain property `vella.one` through DNS.
- Submit `https://vella.one/sitemap.xml`.
- Give the operating Google account full-owner access.
- Use this for indexing, search queries, pages, countries, and technical SEO;
  do not add advertising pixels to devotional or account pages.

### 3. Instagram and Meta Business Suite

- Reserve the Vella brand identity and create a Meta business portfolio.
- Connect the Instagram profile and Facebook Page.
- Keep Month 1 paid spend at R$0. Use the accounts for organic product demos,
  creator collaboration, and future partnership-ad permissions.
- Do not upload customer lists or create audiences from religious, prayer,
  search, Scripture, onboarding-preference, or notification-preference data.

### 4. YouTube brand channel

- Create a Vella channel under an organization-controlled Google identity.
- Publish captioned vertical product walkthroughs as Shorts and retain the clean
  source files for the Google App campaign.
- Do not expose real prayer, profile, purchase, or notification data in demos.

## Configure paused; activate later

### Apple Ads

Create one Brazil Search Results campaign only after the Vella product page can
be selected in Apple Ads. The Apple Ads campaign remains paused until the exact
signed runtime-1.3 iOS build, public product page, subscription funnel,
attribution exchange, privacy answers, and creative all pass their gates. Its
separate proposed limit is R$40/day with a 14-day R$560 cap; Discovery may use at
most R$56 of that cap. These numbers authorize paused configuration only, not
spend. Apple activation requires its own explicit go/no-go and cannot inherit an
Android approval.

`APPLE_ADS_ORG_ID` is not configured in production as of 2026-08-25. The iOS
attribution endpoint therefore remains intentionally fail-closed/retryable until
the real positive organization ID is obtained from the authenticated Apple Ads
account and configured. Never copy a sample value from documentation.

### TikTok for Business

Reserve the brand identity if desired, but do not open a paid test during Month
1. Reconsider only after reusable short-form creative wins organically and the
retained-paid CAC ceiling is known.

### Creator marketplaces

Direct outreach to five to eight Brazilian micro-creators is preferable at this
budget. Use Meta Creator Marketplace or YouTube Creator Partnerships only when
they materially simplify rights, disclosure, or amplification of a proven
creator asset.

## No new account required

- WhatsApp: use organic share links and creator/community distribution.
- Vella operator growth console: use first-party aggregates for product funnel,
  subscription health, mature cohorts, and manually reconciled spend.
- Check `iap_diagnostics.audit_available` before interpreting any IAP diagnostic
  value. When it is `false`, the other values may be partial or zero placeholders
  retained for response compatibility and must not be treated as reliable counts.
- IAP query-failure breadcrumbs contain only fixed per-query failure booleans;
  database error fields are never copied into operator logs or responses.
- IAP breakdown dimensions use closed allowlists. Missing, malformed, or
  unexpected values are grouped under the fixed `unknown` label and are never
  echoed from stored rows.
- The operator response strictly projects only the documented RPC fields and
  nested fields. Unknown keys and non-object array entries are dropped at the
  API boundary rather than passed through from storage.
- Every returned categorical dimension uses a closed allowlist. This includes
  funnel stages, onboarding/routing/auth labels, campaign source/campaign,
  subscription provider/product, webhook provider, platform, billing phase,
  and source-of-truth labels. Unrecognized values become the fixed `unknown`
  label; newly approved campaigns or products require an allowlist update.
- Aggregate numbers are retained only when they are finite, nonnegative safe
  integers within the field's range. Malformed counts become zero, while
  nullable campaign metrics become `null`. Release app/build/runtime values
  must match the bounded release-value pattern or become `unknown`.
- Interpret `subscription_already_linked` with the privacy-safe IAP conflict
  aggregates: `conflict_attempts` counts requests; `distinct_conflict_proofs`
  counts distinct normalized lowercase 64-character hexadecimal proof
  fingerprints; `repeated_conflict_attempts` counts additional attempts sharing
  a proof that was already counted; and `unfingerprinted_conflict_attempts`
  counts missing or malformed fingerprints that cannot be deduplicated. Repeated
  attempts are consistent with retries or replays, but do not prove retry
  causality or a user count. Store-proof fingerprints remain internal and are
  never returned or logged.
- Check `iap_diagnostics.row_limit_reached`. When it is `true`, the underlying
  5,000-row query cap was reached, so all IAP counts and breakdowns are lower
  bounds for the requested window.
- Check `iap_diagnostics.checkout_lifecycle.audit_available` before classifying
  checkout outcomes. `open_over_2m > 0` is an alert for a missing terminal
  callback; use `by_outcome` to distinguish success, user cancellation, failure,
  and timeout. Never infer an outcome from `legacy_uncorrelated_starts`.
- Google Play Console and Google Ads remain the authoritative modeled view of
  Google ad-to-install performance. Runtime 1.3 now includes the native Install
  Referrer bridge for privacy-safe first-party measurement: only allowlisted
  source, medium, campaign, and creative codes leave the device, and the raw
  referrer is discarded on-device. Do not claim exact first-party campaign CAC
  when an approved campaign code is absent.

## Access and safety rules

- Prefer organization-owned accounts with two-factor authentication.
- Keep at least two administrators on business-critical accounts.
- Never paste passwords, recovery codes, private keys, receipts, or user data
  into the growth console or campaign names.
- Campaign creation is not campaign activation. Billing and spend must remain
  paused until checkout, trial, attribution, privacy, and creative gates pass.
