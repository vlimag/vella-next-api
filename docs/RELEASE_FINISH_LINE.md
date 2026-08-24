# Vella release finish line

Last verified: **2026-07-31**. This is the operational source of truth for the first store release. Store copy and localized subscription names live in [`store-metadata.json`](./store-metadata.json); detailed questionnaire guidance lives in [`STORE_SUBMISSION_PACKAGE.md`](./STORE_SUBMISSION_PACKAGE.md).

## 1. Current status

### Engineering and infrastructure complete

- Production website and API are live at `https://vella.one` and `https://www.vella.one` with managed TLS.
- Support, privacy, terms, community-guidelines, and account-deletion pages are live in all eight UI languages.
- The authenticated app is subscription-only; there is **no permanent free tier**.
- Daily Scripture is selected from the approved corpus and returned with edition attribution. AI can draft only the reflection prompt, not Scripture wording, identity, reference, language, or edition.
- The complete ordered journey is rendered. Verse steps are corpus-hydrated in the requested approved language, fall back to approved English, and are omitted if no approved verse exists. Optional private reflection and gratitude are submitted with completion.
- The moderation keyword hard-block was removed. Multilingual and Catholic, Orthodox, liturgical, and non-English regression cases are covered.
- Reminder and paid-access copy is localized and describes the shipped product, immediate monthly charge, eligibility-dependent annual trial, and no permanent free access.
- Apple and Google product catalogs, validation credentials, subscription persistence, webhooks, restore access, and hard-paywall routing are configured.
- Production migration `0016_iap_webhook_event_order.sql` is applied.
- On 2026-07-31, `https://vella.one/api/v1/health` returned `apple_iap: true`, `google_iap: true`, `google_webhook: true`, and `database_schema: true`.
- Account deletion removes database data and uploaded Feed media. Feed post/comment owner deletion and operator moderation endpoints are implemented.
- iOS privacy manifest, production notification entitlement, Sign in with Apple entitlement, selected-photo-only access, and Expo Updates production channel are present in source/native configuration.
- Android source version is `1.0.0 (13)`. Its Google Play production release is **Changes in review**.
- iOS source version is `1.0.0 (15)`. Build 15 is reported uploaded to App Store Connect.

No local `.ipa` or `.aab` file was found during the 2026-07-31 repository audit. Treat upload/signing facts as store-console or build-service evidence; do not claim that a local artifact was inspected or verified.

### Release gates still open

- Complete the authenticated Apple version record: localized metadata and screenshots, App Privacy, age rating/content rights, legal entity/trader and real contact fields, reviewer access, build `1.0.0 (15)` selection, both subscription attachments, and final submission.
- Wait for the Google production change review to finish and record the actual approval/rollout state. **Changes in review** is not the same as live.
- Configure monitored mail for `support@vella.one` and `privacy@vella.one`, then prove inbound delivery and replies. No MX or end-to-end mail delivery was verified on 2026-07-31.
- Run purchase lifecycle tests on the exact signed TestFlight and Google Play builds.
- Run clean-install and lapsed-access smoke tests on physical iOS and Android devices.
- Assign and verify the real moderation owner, reviewer account, escalation process, and response SLA.

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

## 3. Apple — remaining authenticated App Store Connect work

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

1. Open iOS version `1.0.0`.
2. Select uploaded build **`1.0.0 (15)`**. Verify its processing/compliance state in the console; source version numbers alone are not proof.
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
3. Paste [`APPLE_REVIEW_NOTES_READY.md`](./APPLE_REVIEW_NOTES_READY.md) only after verifying every described path in build 15.
4. Attach both subscriptions to the `1.0.0` review submission.
5. Run sections 6 and 7 below before **Add for Review → Submit to App Review**.

## 4. Google Play — production review in progress

Current external state: Android `1.0.0 (13)` production changes are **Changes in review**.

Do not create a duplicate release or upload an older local path. Instead:

1. Monitor the existing production release until Google records an approval, rejection, or required change.
2. Verify the artifact details, package `io.vella.app`, version code `13`, rollout countries, managed/pending rollout choice, and release notes in Play Console.
3. Confirm the store listing, privacy policy, account-deletion URL, App access, Data safety, target audience, content rating, content rights, ads, news, financial-feature, and health declarations reflect the submitted build.
4. Confirm both subscriptions and the annual offer remain active in intended regions.
5. Confirm Play Developer API/RTDN configuration and the health endpoint remain green; do not recreate already-configured service accounts or Pub/Sub resources without evidence of failure.
6. Keep the release state recorded as **Changes in review** until the console shows a later state. Record the final review and rollout result before declaring Android publicly released.

Android remote push still requires Firebase native configuration and a new native build if it is added later. Local daily reminders are already implemented; do not conflate them with remote community push.

## 5. Domain mail and legal identity

The website publishes `support@vella.one` and `privacy@vella.one`, but publication is not proof of deliverability.

1. Choose the real monitored destination inbox and mail provider/forwarder.
2. Configure provider-supplied MX and authentication records for `vella.one` without disturbing the website records.
3. Send an external message to each published address and reply from the monitored inbox.
4. Record the date and owner of the successful inbound/reply test outside the public repository.
5. Use the same verified legal identity and contact facts in policies, Apple, and Google. Do not invent a controller/seller name, address, jurisdiction, phone, or email result.

## 6. Required signed-binary purchase lifecycle tests

Run on a physical TestFlight iPhone using build 15 and a physical Android device using the exact Play build 13:

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

- clean install, eight-locale copy spot checks, onboarding, sign-up/sign-in, hard paywall, and lapsed access;
- daily corpus-backed Scripture with visible edition attribution;
- every available journey step, requested-language/English verse fallback behavior, absent-corpus omission, private reflection/gratitude, and completion lock;
- localized reminder scheduling, denial, edit, disable, and tap-through;
- search, favorite, private note, selected-image Feed post, EULA, report, block/unblock, owner deletion, and sign-out;
- Support, Privacy, Terms, community guidelines, Restore, Manage Subscription, and Delete Account from both entitled and locked states;
- accessibility focus/order, dynamic text, small-screen layout, offline/retry states, and crash-free cold starts.

Do not record inferred passes. Preserve screenshots/logs without private notes, passwords, receipts, tokens, or personal identifiers.

## 8. Release gate

The first public release is complete only when all of these are true:

- Google review has a recorded final outcome and the intended rollout is confirmed.
- Apple build `1.0.0 (15)` is selected; metadata, screenshots, App Privacy, ratings, content rights, reviewer access, legal/trader/contact fields, and both subscriptions are complete and submitted.
- Signed-build purchase, restore, renewal, cancellation, expiry, billing-retry, and refund/revocation evidence passes on both platforms.
- Exact-build real-device smoke testing passes on both platforms.
- `support@vella.one` and `privacy@vella.one` have verified inbound and reply delivery.
- Reviewer credentials work without OTP and the staffed moderation process is active.
- Production health remains green.

Until then, the accurate statement is: **P0 product engineering and commerce configuration are complete; Android build 13 is in production review; iOS build 15 is uploaded but not submitted; external release evidence remains open.**
