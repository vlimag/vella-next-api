# Vella release finish line

Last source verification: **2026-08-25**. This is the operational source of truth for the runtime-1.3 Vella release. Store copy and localized subscription names live in [`store-metadata.json`](./store-metadata.json); detailed questionnaire guidance lives in [`STORE_SUBMISSION_PACKAGE.md`](./STORE_SUBMISSION_PACKAGE.md). Exact store-console state must still be read live immediately before release actions; an EAS build or upload does not prove store installation, App Review selection/submission, a Play release, or device QA.

## 1. Current status

### Engineering and infrastructure status

- Production website and API are live at `https://vella.one` and `https://www.vella.one` with managed TLS.
- The API `main` branch and production deployment are already current for this release state; no additional API deploy is implied by this documentation update.
- Support, privacy, terms, community-guidelines, and account-deletion pages are live in all eight UI languages.
- The authenticated app is subscription-only; there is **no permanent free tier**.
- A clean install uses compact onboarding: automatic/saved language, one primary goal, one anonymous first Vella moment, a transparent Premium preview, and then Apple, Google, or email authentication. The chosen plan survives authentication. Existing active subscribers bypass the paywall before its content mounts.
- Shared Supabase Auth creation is not a Vella acquisition. A missing `faith_harbor` profile is created lazily on the user's first authenticated Vella entry, including for users first created by another app in the shared project. Same-account email/OAuth recovery can add a password without creating a duplicate Vella profile.
- Daily Scripture is selected from the approved corpus and returned with edition attribution. AI can draft only the reflection prompt, not Scripture wording, identity, reference, language, or edition.
- The complete ordered journey is rendered. Verse steps are corpus-hydrated in the requested approved language, fall back to approved English, and are omitted if no approved verse exists. Optional private reflection and gratitude are submitted with completion.
- The moderation keyword hard-block was removed. Multilingual and Catholic, Orthodox, liturgical, and non-English regression cases are covered.
- Reminder and paid-access copy is localized and describes the shipped product, immediate monthly charge, eligibility-dependent annual trial, and no permanent free access.
- Apple and Google product catalogs, validation credentials, subscription persistence, webhooks, restore access, and hard-paywall routing are configured.
- Production migration `0016_iap_webhook_event_order.sql` is applied.
- On 2026-07-31, `https://vella.one/api/v1/health` returned `apple_iap: true`, `google_iap: true`, `google_webhook: true`, and `database_schema: true`.
- Account deletion removes database data and uploaded Feed media. Feed post/comment owner deletion and operator moderation endpoints are implemented.
- iOS privacy manifest, production notification entitlement, Sign in with Apple entitlement, selected-photo-only access, and Expo Updates production channel are present in source/native configuration.
- Runtime `1.3` signed EAS artifacts are finished and inspected for app version `1.0.1`, iOS build `23`, and Android version code `25`. The exact iOS build is `8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`; the exact Android build is `460d034c-b51f-494a-9281-4a9fe07471b3`. Never reuse, decrease, or implicitly replace those identifiers.
- The native update launch wait is `5000 ms`: keep the branded splash visible while checking/downloading, then reload a compatible newly downloaded update on the same first launch.
- Runtime 1.3 includes privacy-safe native attribution: Google Play Install Referrer on Android and Apple AdServices on iOS. Only coarse, bounded campaign fields persist; raw referrer/token/upstream response data is discarded. There is no IDFA, AAID, ATT prompt, fingerprinting, or cross-app tracking.
- The reviewed attribution API and database boundary are deployed. `APPLE_ADS_ORG_ID` is not configured in production as of 2026-08-25, so iOS attribution remains intentionally fail-closed/retryable until the real Apple Ads organization ID is supplied; never substitute a sample value.
- Runtime-1.3 custom lifecycle events exist in the inspected signed artifacts and the authoritative production OTA. They have not been proven or observed on an exact installed store client. Do not import or optimize to them until that client evidence exists.

Both signed EAS artifacts were archived from source commit `39157ccf5c34ad01b74897ee87e279929bca8bab` and are finished and inspected: iOS IPA SHA-256 `36295217084dc5dbb15ca925d4212e07c52a8804b991feb1790f46612f68088c` and Android AAB SHA-256 `145fd5ce504f7ab5c4ccc508b0d9b3a0a993fef08a1c2ca2a32b87890447981d`. Static artifact inspection and source-equivalent simulator QA do not close TestFlight, Play Internal, physical-device, commerce, or first-launch OTA QA.

- **iOS:** EAS submission `d897fd82-bd2d-42a4-acb9-63f0a4c3c96a` successfully uploaded exact build `8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`. App Store Connect/TestFlight email evidence confirms it completed App Store Connect processing at `2026-08-25T06:27:47Z` and became available to test in TestFlight at `2026-08-25T06:30Z`. It is not installed from TestFlight and is not selected or submitted for App Review.
- **Android:** build `460d034c-b51f-494a-9281-4a9fe07471b3` targeted Google Play Internal. Android Publisher API is enabled on the verified Google Cloud project `vella-faith-2026` (`15173925854`), but retry submission `8160f454-f502-4e31-8697-4b528421d582` failed because `vella-expo-push@vella-faith-2026.iam.gserviceaccount.com` lacks Vella app permissions in Play Console. No Android release was created.
- **OTA:** the authoritative production runtime-1.3 update group is `83e563c4-20c1-4250-9612-b19e1f98920e`, from source commit `d8259d77a3aa6a4299f71149ad1d13cb5ebe631a`, with iOS update `01a037a2-d739-7d8c-8fc0-d0505924afbc` and Android update `01a037a2-d739-706b-8802-42177a13019d`. Direct update-server probes prove that the production channel at runtime `1.3` serves that exact final group; runtime `1.2` remains on the prior `a670fc29…` group. Two earlier runtime-1.3 groups are superseded, and the final group above is authoritative. Exact first-launch installed-client proof remains open.

### Release gates still open

- Install exact iOS build `8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f` from TestFlight, complete exact-artifact QA, then select it and submit it for App Review.
- Grant the existing service account only the required Vella app Play permissions, retry exact Android build `460d034c-b51f-494a-9281-4a9fe07471b3` to Play Internal, confirm the release exists, install it, and retain the evidence.
- Complete or update both store version records with current localized metadata and exact-runtime screenshots, App Privacy/Data safety, age/content-rights, legal/trader/contact data, reviewer access, platform-appropriate build selection, subscription attachment, and review submission.
- Configure the real `APPLE_ADS_ORG_ID`, prove one safe iOS attribution exchange, and keep Apple Ads paused. Never use a documentation/sample identifier.
- Prove monitored inbound and reply mail for `support@vella.one` and `privacy@vella.one` rather than inferring it from published pages.
- Run purchase lifecycle and clean-install/lapsed-access smoke tests on the exact signed runtime-1.3 TestFlight and Play Internal artifacts, including first-launch proof that each installed client receives the authoritative update group.
- Assign and verify the real moderation owner, reviewer account, escalation process, and response SLA.
- Keep every paid campaign inactive—ended, uncreated, or paused as applicable—until signed-build, checkout, analytics, attribution, privacy, and creative gates pass and an explicit go/no-go is recorded.

## 2. Commercial configuration — configured, still test end to end

Use one entitlement, **Vella Premium**, with two billing choices:

| Plan | Product ID | Billing | Introductory offer | US reference price |
| --- | --- | --- | --- | --- |
| Monthly | `vella.premium.monthly` | Auto-renewing, 1 month | None; charge immediately | USD 4.99 |
| Annual | `vella.premium.yearly` | Auto-renewing, 1 year | 14 days free for eligible new subscribers | USD 29.99 |

Rules that must remain true in each signed build:

- Both plans unlock exactly the same features.
- The annual introductory offer is not a permanent or separate free tier.
- Apple or Google determines eligibility. Ineligible users see the standard annual terms without trial copy.
- The app renders the store-returned localized price, billing period, eligibility, and renewal terms.
- Restore purchases, manage subscription, sign out, privacy, terms, and account deletion remain reachable without an active entitlement.

Do not change product IDs or reconstruct credentials merely because older instructions said to create them. The current production health is green; use the console and secret manager to verify existing configuration without copying secrets into the repository.

## 3. Apple — TestFlight QA and remaining App Review work

Open the Vella app record: `https://appstoreconnect.apple.com/apps/6790616297`.

### A. Agreements, legal identity, and contact fields

1. Confirm the Paid Apps Agreement, banking, and tax status are active.
2. Complete or verify the real legal entity, seller name, trader status, jurisdiction, required business address, phone, privacy contact, and review contact.
3. Do not copy placeholders or invent identity/contact data in this repository.

### B. Verify the existing subscriptions

1. Open **Vella → Monetization → Subscriptions → Vella Premium**.
2. Confirm `vella.premium.monthly` and `vella.premium.yearly` are active for all intended territories with the intended localized prices.
3. Confirm monthly has no trial and annual has the 14-day introductory offer only for eligible new subscribers.
4. Confirm all eight subscription/group localizations are complete and truthful.
5. Add the required IAP review screenshot showing both plans, price and period, eligible trial wording, renewal terms, Restore Purchases, Terms, and Privacy.

### C. Verify server configuration without rotating it

1. Confirm App Store Server Notifications V2 uses `https://vella.one/api/v1/webhooks/apple` for production and sandbox.
2. Confirm the current production validation credential remains active in the deployment secret manager.
3. Confirm the health endpoint remains green immediately before submission.
4. Do not publish or commit shared secrets, private keys, transaction data, or reviewer credentials.

### D. Complete the App Store version

1. Open iOS version `1.0.1`.
2. Confirm the processing-complete and TestFlight-available evidence above, install and verify exact build **`8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`**, then select runtime-1.3 build **`1.0.1 (23)`**. Do not resubmit or substitute a build without evidence that this upload cannot be used.
3. Use [`store-metadata.json`](./store-metadata.json) as the copy source for name, subtitle, promotional text, keywords, description, and release notes in all eight locales.
4. Set or verify:
   - Primary category: `Lifestyle`
   - Secondary category: `Reference`
   - Support URL: `https://vella.one/support`
   - Marketing URL: `https://vella.one`
   - Privacy URL: `https://vella.one/privacy`
   - Copyright: the real seller's legal name and year
5. Upload localized screenshots from the exact submitted build. The sequence in [`STORE_SUBMISSION_PACKAGE.md`](./STORE_SUBMISSION_PACKAGE.md) must show the real multi-step journey and real store product sheet.
6. Complete age rating and content-rights questions truthfully. Declare user-generated content and social interaction; retain [`SCRIPTURE_CONTENT_RIGHTS.md`](./SCRIPTURE_CONTENT_RIGHTS.md) as the provenance record.

### E. Complete App Privacy

1. Answer **Yes, data is collected**.
2. Use `https://vella.one/privacy` for Privacy Policy and `https://vella.one/delete-account` for User Privacy Choices.
3. Reconcile the data types in [`STORE_SUBMISSION_PACKAGE.md`](./STORE_SUBMISSION_PACKAGE.md) with actual provider settings and the exact submitted binary.
4. Mark documented user-linked data for app functionality/personalization and **not used for tracking** while no cross-app tracking is present.
5. Do not declare payment-card data; the store handles the payment method and Vella receives transaction/entitlement data.
6. Publish the privacy responses.

### F. Reviewer access, attachment, and submission

1. Create or verify a durable email/password reviewer account that does not require OTP or 2FA.
2. Enter the real review contact name, phone, and monitored email.
3. Paste [`APPLE_REVIEW_NOTES_READY.md`](./APPLE_REVIEW_NOTES_READY.md) only after verifying every described path in the exact selected runtime-1.3 build.
4. Attach both subscriptions to the `1.0.1` review submission.
5. Run sections 6 and 7 below before **Add for Review → Submit to App Review**.

## 4. Google Play — Play Internal submission permission-blocked

Current signed candidate: Android app version `1.0.1`, runtime `1.3`, Android version code `25`, EAS build `460d034c-b51f-494a-9281-4a9fe07471b3`. Submission retry `8160f454-f502-4e31-8697-4b528421d582` targeted Play Internal and failed because `vella-expo-push@vella-faith-2026.iam.gserviceaccount.com` lacks Vella app Play permissions. Android Publisher API is already enabled on the exact verified Google Cloud project `vella-faith-2026` (`15173925854`). No Android release was created.

Do not create a duplicate release or upload an older local path. Instead:

1. In Play Console, grant the existing service account only the permissions required to create or update the Vella Internal-track release. Do not create a replacement project or service account merely because this app-level permission is missing.
2. Retry EAS build `460d034c-b51f-494a-9281-4a9fe07471b3` to Play Internal and confirm that exact version-code-25 artifact in Play Console; do not substitute another or use `--latest`.
3. Verify package `io.vella.app`, app version `1.0.1`, version code `25`, runtime `1.3`, rollout countries, managed/pending rollout choice, and release notes in Play Console.
4. Confirm the store listing, privacy policy, account-deletion URL, App access, Data safety, target audience, content rating, content rights, ads, news, financial-feature, and health declarations reflect the submitted build.
5. Confirm both subscriptions and the annual offer remain active in intended regions.
6. Confirm Play Developer API/RTDN configuration and the health endpoint remain green; do not recreate already-configured service accounts or Pub/Sub resources without evidence of failure.
7. Record the exact review and rollout result before declaring the runtime-1.3 Android build publicly released.

Remote and local notification paths are separate. Test both on the exact signed artifact and verify the next scheduled notification cron/API delivery; do not infer push health from permission or local scheduling alone.

## 5. Domain mail and legal identity

The website publishes `support@vella.one` and `privacy@vella.one`, but publication is not proof of deliverability.

1. Choose the real monitored destination inbox and mail provider/forwarder.
2. Configure provider-supplied MX and authentication records for `vella.one` without disturbing the website records.
3. Send an external message to each published address and reply from the monitored inbox.
4. Record the date and owner of the successful inbound/reply test outside the public repository.
5. Use the same verified legal identity and contact facts in policies, Apple, and Google. Do not invent a controller/seller name, address, jurisdiction, phone, or email result.

## 6. Required signed-binary purchase lifecycle tests

Build 23 is available through TestFlight but still needs installation. After an Android version-code-25 release also exists in Play Internal, run the exact store artifacts on a physical iPhone and Android device, both on runtime 1.3:

1. New monthly purchase charges immediately and unlocks access.
2. Eligible new annual purchase displays the store-confirmed 14-day trial and unlocks access.
3. Ineligible/former subscriber sees no second annual trial.
4. Restore succeeds after reinstall on the same store account.
5. Restore on a second device binds only to the intended Vella/store account.
6. Cancellation preserves access until paid/trial expiry.
7. Expiry locks content while restore/manage/sign-out/legal/delete remain reachable.
8. Renewal extends the server entitlement.
9. Billing retry/grace follows the intended policy.
10. Refund/revocation removes entitlement after webhook processing.
11. Wrong bundle/package/product/transaction cannot unlock another account.
12. Account deletion removes Vella data and Feed media while explaining that store cancellation is separate.

Green health checks prove configuration availability, not any of these lifecycle outcomes. Do not mark a row passed without observing it on the signed binary and corresponding server state.

## 7. Required real-device smoke tests

On each exact signed store build, cover:

- clean install, compact onboarding, one anonymous first moment, selected-plan handoff, email/Google/Apple authentication as available, shared-user Vella-profile hydration, active-subscriber bypass, hard paywall, and lapsed access;
- daily corpus-backed Scripture with visible edition attribution;
- every available journey step, requested-language/English verse fallback behavior, absent-corpus omission, private reflection/gratitude, and completion lock;
- localized reminder scheduling, denial, edit, disable, and tap-through;
- search, favorite, private note, selected-image Feed post, EULA, report, block/unblock, owner deletion, and sign-out;
- Support, Privacy, Terms, community guidelines, Restore, Manage Subscription, and Delete Account from both entitled and locked states;
- accessibility focus/order, dynamic text, small-screen layout, offline/retry states, and crash-free cold starts.

Do not record inferred passes. Preserve screenshots/logs without private notes, passwords, receipts, tokens, or personal identifiers.

## 8. Release gate

The first public release is complete only when all of these are true:

- Android version code 25 exists in Play, has a recorded final review outcome, and the intended rollout is confirmed.
- iOS build 23 has finished processing and passed TestFlight QA; it is selected, and metadata, screenshots, App Privacy, ratings, content rights, reviewer access, legal/trader/contact fields, and both subscriptions are complete and submitted for App Review.
- Signed-build purchase, restore, renewal, cancellation, expiry, billing-retry, and refund/revocation evidence passes on both platforms.
- Exact-build real-device smoke testing passes on both platforms.
- `support@vella.one` and `privacy@vella.one` have verified inbound and reply delivery.
- Reviewer credentials work without OTP and the staffed moderation process is active.
- Production health remains green, and first-launch evidence shows both installed runtime-1.3 clients receive authoritative update group `83e563c4-20c1-4250-9612-b19e1f98920e`.

Until then, the accurate statement is: **iOS build 23 completed App Store Connect processing and is available in TestFlight but is not installed, selected, or submitted for App Review; Android version code 25 has no Play release because the verified service account lacks Vella app permissions; the final runtime-1.3 group is authoritative on the production update server, but exact first-launch installed-client proof remains open; campaigns remain inactive.**
