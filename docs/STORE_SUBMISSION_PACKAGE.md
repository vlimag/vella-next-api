# Vella store-submission package

> Current operational status and click-by-click launch steps are maintained in [`RELEASE_FINISH_LINE.md`](./RELEASE_FINISH_LINE.md). This document remains the detailed metadata, privacy, reviewer-notes, and questionnaire reference.

The current release plan was reconciled against repository source and separately observed controller evidence on **2026-08-25**. External store-console states remain controller-owned facts and are not inferred from source. This is an implementation audit, not legal advice.

## Current release candidate — 2026-08-25

**Both signed runtime-1.3 EAS production artifacts are finished and inspected. The exact iOS build was uploaded, completed App Store Connect processing, and is available in TestFlight; the Android Play Internal attempt was permission-blocked and created no release.** Use these immutable artifacts for the remaining store and device gates:

- Runtime: `1.3`.
- Archived source commit for both artifacts: `39157ccf5c34ad01b74897ee87e279929bca8bab`.
- Android: version `1.0.1`, version code `25`; EAS build `460d034c-b51f-494a-9281-4a9fe07471b3`; inspected AAB SHA-256 `145fd5ce504f7ab5c4ccc508b0d9b3a0a993fef08a1c2ca2a32b87890447981d`.
- iOS: version `1.0.1`, build `23`; EAS build `8c14f38c-e50d-4d1f-a168-fc67ffd9ba6f`; inspected IPA SHA-256 `36295217084dc5dbb15ca925d4212e07c52a8804b991feb1790f46612f68088c`.
- Updates: hold the branded splash while checking/downloading for up to the `5000 ms` native launch wait, then reload a newly downloaded compatible update on that first launch.
- Production build auto-increment: disabled; verify the fixed values above before any rebuild so they cannot drift or collide.

The API `main` branch and production deployment are already current for this release state; this documentation update does not imply another API deploy.

Do not reuse or decrease either build number, and do not substitute a newer or “latest” build implicitly. Static inspection confirms the expected package/bundle identity, versions, runtime, update gate, privacy/permission boundary, and Vella branding in these exact artifacts. It does not prove TestFlight/Play Internal installation, purchase lifecycle, first-launch OTA behavior, or physical-device behavior. Exact-binary store-account checks, the production-equivalent paywall screenshot, iOS TestFlight QA/build selection/App Review submission, and Android Play release remain controller gates. Older build references below are retained only as dated audit history and are not current instructions.

- **iOS:** EAS submission `d897fd82-bd2d-42a4-acb9-63f0a4c3c96a` successfully uploaded the exact iOS build to App Store Connect. App Store Connect/TestFlight email evidence confirms it completed App Store Connect processing at `2026-08-25T06:27:47Z` and became available to test in TestFlight at `2026-08-25T06:30Z`. It is not installed from TestFlight and is not selected or submitted for App Review.
- **Android:** build `460d034c-b51f-494a-9281-4a9fe07471b3` targeted Google Play Internal. Android Publisher API is enabled on the verified Google Cloud project `vella-faith-2026` (`15173925854`), but retry submission `8160f454-f502-4e31-8697-4b528421d582` failed because `vella-expo-push@vella-faith-2026.iam.gserviceaccount.com` lacks Vella app permissions in Play Console. No Android release was created.
- **OTA:** the authoritative production runtime-1.3 update group is `83e563c4-20c1-4250-9612-b19e1f98920e`, from source commit `d8259d77a3aa6a4299f71149ad1d13cb5ebe631a`, with iOS update `01a037a2-d739-7d8c-8fc0-d0505924afbc` and Android update `01a037a2-d739-706b-8802-42177a13019d`. Direct update-server probes prove that the production channel at runtime `1.3` serves that exact final group; runtime `1.2` remains on the prior `a670fc29…` group. Two earlier runtime-1.3 groups are superseded, and the final group above is authoritative. Exact first-launch installed-client proof remains open.

The runtime-1.3 custom lifecycle events are present in the signed artifacts and authoritative production OTA, but are not yet proven or observed from an exact installed store artifact. The attribution API is deployed, but `APPLE_ADS_ORG_ID` is not configured in production, so iOS Apple Ads exchange remains intentionally fail-closed/retryable until the real organization ID is configured. No paid campaign is active: the historical Google campaign is ended/inactive, and any Google replacement or Apple campaign must remain uncreated or paused until its gates pass.

## Historical release context — 2026-07-31 (superseded)

The following snapshot was reviewed against the repository and live endpoints on **2026-07-31**. It is preserved for provenance only; its build numbers and console instructions are superseded by the current release candidate above.

### Historical release verdict

**P0 product engineering and production commerce configuration are complete, but public release evidence is not.** Android build `1.0.0 (13)` is in Google Play production with **Changes in review**. iOS build `1.0.0 (15)` is uploaded, but Apple metadata, screenshots, privacy, legal/trader/contact fields, build selection, subscription attachment, and submission still require authenticated App Store Connect completion.

No local `.ipa` or `.aab` file was found in the repository during this audit. Do not describe either store upload as a locally inspected or verified artifact.

### Historical P0 blockers

1. **Apple console completion.** Finish localized metadata/screenshots, privacy, ratings/content rights, real legal/trader/contact data, reviewer access, build 15 selection, both subscription attachments, and submission.
2. **Working support mail.** No MX or end-to-end delivery was verified for `support@vella.one` or `privacy@vella.one`; configure monitored mail and test inbound and reply delivery.
3. **Signed-build lifecycle proof.** Test monthly, eligible annual trial, ineligible annual, restore, renewal, cancellation, expiry, billing retry, and refund/revocation on exact TestFlight and Google Play builds.
4. **Real-device smoke proof.** Test the complete daily Scripture/journey loop, lapsed access, legal/account controls, reminders, and UGC safety controls on physical iOS and Android devices.
5. **Google review outcome.** Monitor build 13 until the production change review reaches a recorded final state; “Changes in review” is not “live.”

### Historical P1 before broad rollout / early operation

- Define an actual privacy retention schedule for account data, public UGC, reports, security logs, backups, and financial records, rather than only “as long as necessary.”
- Confirm provider contracts and retention for Supabase, Vercel, Expo, OpenAI, Apple, and Google before answering “not shared” in Google Data safety.
- Add an age-assurance decision. The current EULA asks users to self-attest but the app has no date-of-birth or guardian flow.
- Assign a named moderation owner and response SLA to the implemented operator report queue.

### Historical ground truth

| Field | Value |
| --- | --- |
| App name | Vella |
| iOS bundle ID | `io.vella.app` |
| Apple ID | `6790616297` |
| Android package | `io.vella.app` |
| Version | `1.0.0` |
| iOS build observed in source and reported uploaded | `15` |
| Android version code observed in source and reported in Play production review | `13` |
| Supported UI locales | English, Brazilian Portuguese, Spanish, French, German, Italian, Russian, Polish |
| Subscription products | `vella.premium.monthly`, `vella.premium.yearly` |
| Production API and website | `https://vella.one` |
| Ads or tracking SDK found | None |
| Broad photo/media permission | None; selected-photo access only |
| Non-exempt encryption | Source declares `ITSAppUsesNonExemptEncryption = false` |

The current product rule is simple: **no permanent free tier**. A user may complete onboarding and authentication, but app content and features require an active Premium subscription or an active eligible introductory trial. When access expires, content locks while purchase restoration, subscription management, sign-out, and account/data management remain reachable.

The implementation now backs the core devotional claim: daily Scripture is corpus-backed and edition-attributed; journey verse steps use requested-language approved text or approved English fallback and are omitted when unavailable; the full ordered journey and optional private reflection/gratitude are present. The former moderation faith-keyword hard-block is also removed and covered by multilingual/tradition regression tests.

## Exact store metadata

The copy-to-console source of truth is [`store-metadata.json`](./store-metadata.json). Its eight localized descriptions are synchronized with the canonical mobile store configuration in the shared workspace and independently guarded by the localized lifecycle contract in API tests. It contains, for all eight locales:

- Apple name, subtitle, promotional text, description, and keywords;
- Google title, short description, and full description;
- localized monthly and annual subscription display names/descriptions;
- current live URLs and the intended branded URLs after DNS cutover.

The file was mechanically validated with these limits:

| Locale | Name / 30 | Subtitle / 30 | Apple promo / 170 | Play short / 80 | Keywords bytes / 100 | Description / 4000 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| en | 5 | 28 | 154 | 76 | 68 | 2304 |
| pt-BR | 5 | 25 | 151 | 75 | 62 | 2538 |
| es-ES | 5 | 25 | 149 | 76 | 65 | 2505 |
| fr-FR | 5 | 25 | 157 | 76 | 61 | 2647 |
| de-DE | 5 | 29 | 155 | 73 | 56 | 2485 |
| it-IT | 5 | 28 | 155 | 78 | 63 | 2495 |
| ru | 5 | 22 | 135 | 70 | 89 | 2454 |
| pl | 5 | 24 | 157 | 72 | 61 | 2427 |

The descriptions deliberately do not hard-code prices. They accurately disclose that Premium is required, monthly billing starts immediately, and eligible new annual subscribers may receive 14 days before paid annual renewal. The store-owned product sheet and in-app paywall must show eligibility plus the full localized annual renewal price and terms before confirmation.

### Categories and declarations

- Apple primary category: **Lifestyle**; secondary: **Reference**.
- Google category: **Lifestyle**.
- Ads: **No**.
- News app: **No**.
- Government app: **No**.
- Financial features: **No**.
- Health app: **No**; do not market Vella as treatment or mental-health care.
- Content rights: **Yes, the app displays third-party content** if Bible translations are not wholly owned by the seller. Supply licenses if Apple asks.
- Sign-in methods shown in the current app: **email and password, Google on iOS and Android, and Apple on supported iOS devices**. A verified email already used by another supported method is reused through Supabase Auth's same-account flow; choosing email sign-up for an existing OAuth email sends a verification code and lets that user set a password. After any successful provider session, Vella lazily creates or hydrates the missing `faith_harbor` profile, including for a shared Supabase Auth user first created in another app.

## URLs and legal-page inventory

### URLs safe to enter now

These returned HTTP 200 on 2026-07-31:

| Purpose | Current live URL |
| --- | --- |
| Marketing | `https://vella.one` |
| Support | `https://vella.one/support` |
| Privacy policy | `https://vella.one/privacy` |
| Terms | `https://vella.one/terms` |
| Community guidelines | `https://vella.one/community-guidelines` |
| Account deletion | `https://vella.one/delete-account` |

Do not use those URLs as evidence that email support works; the linked `@vella.one` addresses still need MX/mailbox setup.

### Branded URL patterns

The production paths are:

- `https://vella.one/support`
- `https://vella.one/privacy`
- `https://vella.one/terms`
- `https://vella.one/community-guidelines`
- `https://vella.one/delete-account`

The default English route has no locale prefix. Localized page patterns are:

| Locale | Prefix | Support | Privacy | Terms | Guidelines | Delete account |
| --- | --- | --- | --- | --- | --- | --- |
| English | — | `/support` | `/privacy` | `/terms` | `/community-guidelines` | `/delete-account` |
| Português | `/pt` | `/pt/support` | `/pt/privacy` | `/pt/terms` | `/pt/community-guidelines` | `/pt/delete-account` |
| Español | `/es` | `/es/support` | `/es/privacy` | `/es/terms` | `/es/community-guidelines` | `/es/delete-account` |
| Français | `/fr` | `/fr/support` | `/fr/privacy` | `/fr/terms` | `/fr/community-guidelines` | `/fr/delete-account` |
| Deutsch | `/de` | `/de/support` | `/de/privacy` | `/de/terms` | `/de/community-guidelines` | `/de/delete-account` |
| Italiano | `/it` | `/it/support` | `/it/privacy` | `/it/terms` | `/it/community-guidelines` | `/it/delete-account` |
| Русский | `/ru` | `/ru/support` | `/ru/privacy` | `/ru/terms` | `/ru/community-guidelines` | `/ru/delete-account` |
| Polski | `/pl` | `/pl/support` | `/pl/privacy` | `/pl/terms` | `/pl/community-guidelines` | `/pl/delete-account` |

The pages and sitemap cover all eight locales. The public deletion copy says store subscriptions must be canceled separately and that limited billing, transaction, fraud-prevention, security, and backup records may be retained when law requires or permits it. Account deletion now removes database data and uploaded Feed media; exact-build deletion behavior still belongs in real-device release testing.

## Subscription console verification

The Apple and Google products, credentials, webhooks, and migration `0016` are configured. The 2026-07-31 production health response was green for Apple IAP, Google IAP, Google webhook authentication, and database schema. The checks below are submission-time verification, not instructions to create duplicate products or rotate working credentials.

### Shared commercial rule

- No permanent free access.
- Monthly: paid immediately; auto-renews monthly; no trial.
- Annual: auto-renews yearly; eligible new subscribers may receive 14 free days.
- Access and recurring value are identical across durations; only billing cadence and annual introductory eligibility differ.
- Keep pricing in the stores and render the store-returned localized price in the app.
- Expiration must lock content but must never lock restore, manage subscription, sign-out, privacy links, or account deletion.

### App Store Connect

1. Verify the Paid Apps Agreement, banking, and tax status.
2. Verify the **Vella Premium** subscription group contains only the expected monthly and annual products.
3. Confirm `vella.premium.monthly` is one month with no introductory offer.
4. Confirm `vella.premium.yearly` is one year in the same group and has the 14-day free trial only for eligible new subscribers.
5. Verify the eight localizations from `store-metadata.json`, prices, and intended territories.
6. Upload an IAP review screenshot that clearly shows both plans, the annual trial only when eligible, renewal price/period, auto-renewal, cancel/manage language, Restore purchases, Terms, and Privacy.
7. Attach both subscriptions to the app version submitted for review.
8. Test purchase, renewal, restore, cancellation, billing retry, refund/revocation, and trial in sandbox/TestFlight with the production backend.

### Google Play Console

The current client and server expect the two configured product IDs, so preserve them for this release:

1. Verify `vella.premium.monthly` has an active auto-renewing monthly base plan and no offer.
2. Verify `vella.premium.yearly` has an active auto-renewing annual base plan.
3. Verify the annual acquisition offer is limited to eligible new customers, with a 14-day free trial followed by the annual base-plan price.
4. Confirm both base plans and the annual offer are active in every intended region.
5. Confirm all eight title/description localizations and explicit recurring benefits.
6. Verify that the Android offer token selected by the app is the annual free phase for eligible accounts and the annual base plan otherwise.
7. Verify the configured Play Developer API access and real-time developer notifications, then test purchase, acknowledgement, restore, pause/cancel, grace period, account hold, refund/revocation, and expiry.

### Production configuration to verify without committing

- the current Apple receipt/server-validation credential;
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`;
- `ANDROID_PACKAGE_NAME=io.vella.app`;
- webhook/notification credentials and endpoints;
- Supabase service credentials and OpenAI credentials already expected by the API.

Do not recreate, rotate, print, or copy these secrets solely to satisfy documentation. Verify their presence through the secret manager and the green health endpoint, then rely on signed-build transactions for behavioral proof.

## Reviewer notes template

Replace every bracketed value before submission. Never leave placeholders in the actual review notes.

> Vella is a subscription-only Christian Scripture, reflection, and community app. There is no permanent free tier. On a clean install, a user completes compact onboarding, receives one anonymous first Vella moment, reviews the Premium offer, and can continue with Apple, Google, or email. After authentication Vella checks authoritative entitlement before mounting the paywall: an active subscriber enters the app immediately, while a user without active access returns to the preserved Premium selection. The monthly product is charged immediately and has no trial. Eligible new annual subscribers may see a 14-day introductory trial; the store determines eligibility and shows the renewal price before confirmation.
>
> Review account: [EMAIL] / [PASSWORD]
>
> Main path: launch → choose one primary goal in compact onboarding → complete one anonymous first Vella moment → review Monthly or Annual → authenticate → return to the same selected offer if purchase is still required → confirm through the store. Restore purchases is on the Premium screen. Manage subscription, Terms, Privacy, sign-out, and account deletion remain reachable when content access is locked.
>
> To test Scripture and journeys after entitlement: open Home for the daily verse and journey, Explore for Bible search/favorites/private notes, Groups to create or join by invitation code, and Feed for user-generated content.
>
> The first attempt to publish in Feed requires scrolling through and accepting the community EULA. Text and selected images are automatically checked before posting. A post's menu provides reporting; user controls provide block/unblock. [ADD THE VERIFIED MODERATOR RESPONSE PROCESS AND SLA HERE.]
>
> Optional notifications are requested only after the user enables them. Selected-photo permission is requested only when a user adds an image to a post. Microphone permission is requested only after the user starts optional, user-initiated voice transcription. That recording leaves the device for OpenAI transcription; Vella does not retain the recording, and only confirmed text is saved. No camera, contacts, location, or broad media-library permission is requested.
>
> Account deletion: Settings → Account → Delete account. The locked Premium screen also provides account deletion for authenticated users. A store subscription must be canceled separately using Manage subscription.
>
> Backend base URL: https://vella.one. Review contact: [NAME], [PHONE], [EMAIL].

Before copying this note, manually verify every path in the exact uploaded build. In particular, prove the locked-screen deletion path and legal links in a lapsed account.

## Apple App Privacy answers

These are conservative answers grounded in first-party code. They must include third-party SDK/provider practices and should be reconciled with the privacy manifest.

| Apple data type | Collect | Linked to user | Tracking | Purposes / evidence |
| --- | --- | --- | --- | --- |
| Contact Info — Email Address | Yes | Yes | No | Authentication and account management |
| Contact Info — Name | Yes | Yes | No | Profile and public social identity |
| Identifiers — User ID | Yes | Yes | No | App Functionality, Analytics, Developer's Advertising — authentication, sync, entitlement, community, and privacy-safe attribution linked only after Vella profile hydration |
| Identifiers — Device ID | Yes | Yes | No | App Functionality, Analytics, Developer's Advertising — pseudonymous Firebase app-instance data, random first-party install ID, attribution, push registration, and operational device records; some paths become linked after account association |
| Location — Coarse Location | Yes | No | No | Approximate location inferred by Google from a masked IP address for analytics; no precise or permission-based location collection |
| Purchases — Purchase History | Yes | Yes | No | App Functionality, Analytics, Developer's Advertising — pseudonymous Firebase product/value/currency analytics plus linked authoritative server validation, access restoration, refunds, audit, and coarse campaign outcome measurement |
| Advertising Data | Yes | Yes | No | Analytics, Developer's Advertising — coarse first-party source/campaign/creative codes on Android and coarse, bounded Apple Ads campaign fields on iOS, linked to a Vella profile only after sign-in; no third-party ad serving or cross-company tracking |
| User Content — Photos or Videos | Yes, photos only | Yes | No | Optional Feed image posts and moderation |
| User Content — Other User Content | Yes | Yes | No | Posts, comments, private notes, reflections, bio, groups, reports |
| User Content — Audio Data | Yes | Yes | No | Optional, user-initiated voice transcription: microphone permission is requested only after the user starts recording, the recording leaves the device for OpenAI transcription, Vella does not retain the recording, and only confirmed text is saved |
| Usage Data — Product Interaction | Yes | Yes | No | App Functionality, Analytics, Developer's Advertising — automatic lifecycle/session/engagement/update events, ten closed custom marketing events, privacy-safe campaign measurement, and linked journey/progress, favorites, likes, follows, blocks, settings, and personalization records |
| Diagnostics — Other Diagnostic Data | Yes | Yes | No | Firebase SDK transport diagnostics are pseudonymous; broader authenticated service diagnostics may be linked, so the overall answer is conservative |
| Sensitive Info | Conservatively Yes | Yes | No | Faith preferences and devotional/user-created content may reveal religious beliefs; app functionality/personalization |
| Other Data | Yes | Yes | No | EULA acceptance records include IP address and user agent for security/compliance |

The **Linked to user** column gives one overall Yes/No answer for each Apple data type. The Firebase app-instance stream remains pseudonymous: Vella does not set a Firebase account user ID or user properties, and its app-instance/device, coarse-location, purchase, interaction, and transport fields are not assigned to the Vella account. That Firebase distinction belongs in the notes, but any separate linked path makes the overall answer **Yes**. Coarse Location remains **No** because the Firebase masked-IP inference is the only implemented coarse-location path.

Select coarse location only for the approximate location Google infers from a masked IP address in the Firebase analytics stream. Select Advertising Data for Vella's own coarse install/campaign attribution and select Audio Data for the optional voice-transcription path. Do **not** select precise location, contacts, payment card details, or browsing history based on the current code. Apple and Google process the payment method; Vella receives transaction and entitlement data, not full card details.

For attribution, only allowlisted source, medium, campaign, and creative codes leave Android; the raw Android referrer is discarded on-device. On iOS, the Apple token and raw response are transient and discarded after the API validates only coarse, bounded campaign fields. The pseudonymous installation may be linked to the current Vella profile after sign-in so authoritative subscription outcomes can measure Vella's own campaigns. No IDFA, AAID, ATT prompt, fingerprinting, or cross-app tracking is used. Therefore Advertising Data is collected, linked, used for **Analytics** and **Developer's Advertising**, and **not used for tracking**.

The Firebase analytics stream does not receive Vella account user IDs or user properties and excludes advertising IDs, advertising data, private devotional or other user content, identity fields, receipts or purchase tokens, notification tokens, localized prices, and raw errors. Ad storage, ad user data, and ad personalization are disabled. The broader account, subscription, user-content, and sensitive-information collection above remains separately disclosed because app functionality still processes it outside this analytics stream.

Three answers require provider confirmation:

- **Audio Data:** Keep the conservative collected-and-linked answer above unless current OpenAI provider retention, account settings, and abuse-monitoring terms prove that every recipient discards the recording within the store definition for ephemeral processing. Vella does not retain the recording in its own database or object storage, but that does not by itself establish provider-side ephemerality.
- **Search History:** Bible queries are transmitted to the API and may be sent to OpenAI, but the application database does not intentionally save raw queries. Select Search History if any provider retains query text beyond real-time request handling.
- **Diagnostics:** Google Analytics for Firebase sends SDK transport diagnostics, so include Other Diagnostic Data for analytics. Vercel, Supabase, Expo, or native dependencies may also retain request, error, or diagnostic data; confirm their actual provider settings before final submission.

Tracking should be **No** for this implementation: the Firebase stream has no advertising ID, advertising data, ad storage, ad user data, ad personalization, cross-app tracking, or sensitive devotional content. No ATT prompt is needed for the current implementation. Reassess before adding any tracking-capable SDK or use.

## Google Play Data safety draft

Answer “Does your app collect or share any required user data?” **Yes**. Answer “Is all data encrypted in transit?” **Yes**. Answer “Can users request deletion?” **Yes** for the in-app and public web deletion paths; finish monitored support/privacy email routing before public review.

| Google data type | Collected | Required or optional | Primary purposes |
| --- | --- | --- | --- |
| Personal info — Name | Yes | Optional/user-configurable | App functionality, account management |
| Personal info — Email address | Yes | Required for account | App functionality, account management |
| Personal info — User IDs | Yes | Required | App functionality, account management, analytics, fraud/security, Advertising or marketing for Vella's own campaigns |
| Personal info — Other info | Yes | Mixed | Handle, bio, locale, settings, faith preferences; functionality/personalization |
| Location — Approximate location | Yes | Automatic for the Firebase stream | Analytics; inferred from a masked IP address, not device location permission |
| Financial info — Purchase history | Yes | Required for paid access; Firebase product/value/currency fields are automatic | Analytics, authoritative app functionality, account management, fraud/security, and Advertising or marketing measurement for Vella's own campaigns |
| Photos and videos — Photos | Yes | Optional | User-selected Feed posting and moderation |
| Audio files — Voice recordings | Yes | Optional/user-initiated | App functionality: the recording leaves the device for OpenAI transcription; Vella does not retain the recording, and only confirmed text is saved |
| App activity — App interactions | Yes | Mixed: Firebase and first-party mechanical analytics are automatic; feature actions are optional | Analytics, app functionality, Advertising or marketing measurement for Vella's own campaigns, progress, favorites, likes, follows, blocks, settings, and personalization |
| App activity — Other user-generated content | Yes | Optional | Posts, comments, notes, reflections, groups, reports; functionality/community safety |
| App info and performance — Diagnostics | Yes | Automatic for Firebase SDK transport | Analytics delivery and troubleshooting |
| Device or other IDs | Yes for Firebase app-instance/device information, a random first-party install ID, and device/push registration | Analytics IDs automatic; push token optional | Analytics, functionality, notifications, security, and Advertising or marketing measurement for Vella's own campaigns; no advertising ID |

Select approximate location for the masked-IP inference described above and Voice recordings for optional transcription. Use the Advertising or marketing purpose only on the first-party identifiers, purchase outcomes, and app interactions used to measure Vella's own acquisition campaigns. Do not select precise location, contacts, files/documents, calendar, installed apps, SMS/call logs, health data, payment-card information, or web browsing history from the current implementation.

Vella's first-party analytics stream uses a random pseudonymous install ID and mechanical events such as first open, onboarding, paywall and checkout steps, verified subscription status, meaningful-session completion, notification permission/open, and store CTA clicks. Its event properties exclude prayer, search, Scripture/verse, note, post, profile, identity, notification-token, receipt/purchase-token, localized-price, raw-error, religious-preference, and other user-created or devotional content. Raw first-party events are retained for no more than 90 days; longer-lived reporting is aggregate and suppresses small cohorts. The data is not sold or used to create or upload targeted-advertising audiences.

For native attribution, Android sends only allowlisted source, medium, campaign, and creative codes; the raw Android referrer is discarded on-device. iOS sends a transient Apple AdServices token to Vella's API for direct Apple exchange; the Apple token and raw response are transient and discarded after only coarse, bounded campaign fields are validated. After sign-in and Vella-profile hydration, the pseudonymous installation may be linked to that Vella profile to measure authoritative subscription outcomes. This is Advertising or marketing measurement for Vella's own campaigns, not third-party ad serving: there is no IDFA, AAID, ATT prompt, fingerprinting, Customer Match, or cross-app tracking.

Google Analytics for Firebase is a separate SDK stream. It automatically processes app-instance/device/platform/language information, approximate location inferred from a masked IP address, lifecycle/session/engagement/update events, client-side purchase product/value/currency fields, and SDK transport diagnostics. It also receives only the ten closed custom marketing events documented in the privacy policy. Vella does not set a Firebase account user ID or user properties, and advertising ID collection, ad storage, ad user data, and ad personalization are disabled. This stream excludes advertising data, sensitive devotional/user content, identity, receipts/tokens, localized prices, and raw errors. Google retention and processing follow the configured Analytics settings and applicable Google terms; do not apply Vella's first-party 90-day promise to this SDK stream.

Automatic client-side purchase events are not authoritative subscription validation. Only the custom server-verified trial and paid outcomes may be treated as verified conversions.

For **Data shared**, the likely answer is **No** only if Supabase, Vercel, Expo, OpenAI, Apple, and Google qualify under Google's service-provider exceptions and their contracts/settings limit processing to Vella's instructions. Public posts are disclosed by a user-directed action. If any provider uses data for its own purposes outside an exception, mark the applicable type as shared. Confirm contracts rather than guessing.

For **ephemeral processing**, do not mark the database-backed types as ephemeral. Voice recordings and search-query processing may qualify only after current provider retention, account settings, and applicable terms verify that every involved recipient discards the data within the policy definition. Until then, keep voice recordings declared as collected and do not mark them ephemeral.

## UGC, age rating, and target audience

### UGC controls present

- Feed EULA acceptance before first post;
- automated text and image safety checks;
- post reporting with reason codes;
- follow, block, unblock, and blocked-user management;
- published community guidelines and support email;
- public/private distinction for notes versus Feed posts;
- post and comment owner deletion plus operator moderation/report endpoints;
- multilingual/tradition regression coverage that prevents unfamiliar faith language from being hard-rejected by a narrow keyword dictionary.

### Still required

- a staffed owner for the implemented moderation queue and operator actions;
- documented triage and emergency escalation;
- a measurable response SLA;
- real support email delivery;
- repeat-offender handling and an auditable moderation history.

### Store questionnaires

- Apple **User-Generated Content:** Yes.
- Apple **Social Media:** Yes; the app has public profiles, posts, comments, likes, follows, shares, and blocks.
- Apple **Messaging/Chat:** there are no private DMs. Answer according to the exact questionnaire wording; use the conservative “Yes” if public comments/group interaction are included in its definition.
- Google target audience: do not select under-13 groups without a child-directed redesign, parental-consent path, and Families compliance. The present product is most defensibly configured for 13–15, 16–17, and 18+ subject to counsel and the final rating questionnaire.
- Disclose user interaction and online content in the IARC form. Do not answer based only on Vella-authored devotional content; the public Feed can vary.

## Creative asset inventory

### Present

- iOS Icon Composer project with a 1024×1024, opaque source image;
- Android/source app icon at 1024×1024, opaque;
- Google Play store icon at `../../store-assets/google-play/app-icon-512x512.png`;
- Google Play feature graphic at `../../store-assets/google-play/feature-graphic-1024x500.png`;
- website icons at 180, 192, and 512 pixels;
- website/social Open Graph image at 1200×630.

### Not present in the repository / still verify in the consoles

- Apple iPhone screenshots: one to ten at an accepted 6.9-inch size; use 1290×2796 portrait for a consistent current set;
- Google phone screenshots are not stored locally; confirm the screenshots already supplied with the production release are current and truthful;
- localized screenshots for all eight listings if localized captions are used;
- an App Store IAP review screenshot showing the actual paywall and subscription disclosures;
- optional preview video, not required for first release.

No store screenshot files were found in the repository. The Google icon and feature graphic are present; verify their rendered safe zones and that the uploaded console assets match them.

### Recommended six-frame sequence

1. **A calmer place to begin** — actual Home/daily verse screen.
2. **A seven-day path that fits your season** — actual multi-step journey, edition attribution, private check-in, and progress screen.
3. **Find Scripture in everyday words** — actual Bible search results.
4. **Save what speaks to you** — favorites/private notes.
5. **Encouragement with clear boundaries** — Feed with fictional, non-sensitive sample content and visible controls.
6. **Premium, clearly explained** — actual paywall with current store prices, annual trial eligibility, renewal period, Restore, Terms, and Privacy.

Do not show weekly recaps, family seats, shared plans/progress, or any screen that is not in the submitted binary. Social login may appear only in an exact current authentication screenshot that truthfully shows Google and, on supported iOS devices, Apple. Avoid prices and “free” claims in Play graphics because promotional pricing changes and Play restricts price/promotional language in listing imagery.

## Final submission checklist

- [ ] Close every P0 above.
- [x] Build and statically inspect runtime 1.3 iOS build 23 and Android version code 25; retain the exact EAS IDs and artifact hashes recorded above.
- [x] Upload exact iOS build 23 through EAS submission `d897fd82-bd2d-42a4-acb9-63f0a4c3c96a`; processing completed at `2026-08-25T06:27:47Z`, and it became available in TestFlight at `2026-08-25T06:30Z`.
- [ ] Install exact build 23 from TestFlight, verify it, select it, attach both subscriptions, and submit it for App Review.
- [ ] Grant the existing service account the required Vella app Play permissions, retry exact Android version code 25 to Play Internal, and verify that the release is created before installing it.
- [x] Record and directly probe authoritative production runtime-1.3 update group `83e563c4-20c1-4250-9612-b19e1f98920e` and its exact platform update IDs.
- [ ] Prove on first launch that each exact installed runtime-1.3 store client receives the authoritative final group; update-server probes alone do not close this gate.
- [ ] Test clean install, onboarding, sign-up, sign-in, paywall, both purchases, restore, renewal state, lapsed state, legal links, deletion, notifications, photo selection, Feed EULA, report, block, and sign-out on physical iOS and Android devices.
- [ ] Confirm the exact uploaded builds point to HTTPS production API and live legal URLs.
- [ ] Make `support@vella.one` and `privacy@vella.one` receive and send mail.
- [ ] Create reviewer credentials and verify them immediately before submission.
- [ ] Verify both configured IAP catalogs, localizations, prices, territories, review screenshots, credentials, and notifications; do not create duplicates.
- [ ] Complete Apple privacy and related questionnaires; verify the Google Data safety, content rating, target audience, ads, and content-rights answers already associated with the production review.
- [ ] Complete Apple localized store copy/screenshots, privacy/legal/trader/contact data, build selection, subscription attachments, and submission.
- [ ] Record the final Google production-review outcome and rollout state for Android version code 25.
- [ ] Keep the backend and moderation operator online throughout review.

## Official references

- Apple app information and metadata: https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/
- Apple platform-version metadata: https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information
- Apple screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple account deletion: https://developer.apple.com/support/offering-account-deletion-in-your-app/
- Apple app privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy
- Apple age-rating definitions: https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- Apple auto-renewable subscription information: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/auto-renewable-subscription-information
- Google Play listing guidance: https://support.google.com/googleplay/android-developer/answer/13393723?hl=en
- Google Play preview assets: https://support.google.com/googleplay/android-developer/answer/9866151?hl=en
- Google Data safety: https://support.google.com/googleplay/android-developer/answer/10787469?hl=en
- Google account deletion: https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN
- Google subscriptions policy: https://support.google.com/googleplay/android-developer/answer/9900533?hl=en
- Google subscription model and offers: https://support.google.com/googleplay/android-developer/answer/12154973?hl=en
- Google UGC policy: https://support.google.com/googleplay/android-developer/answer/12923286?hl=en
- Google target audience: https://support.google.com/googleplay/android-developer/answer/9867159?hl=en-GB
- Google content ratings: https://support.google.com/googleplay/android-developer/answer/9859655?hl=en_EN
