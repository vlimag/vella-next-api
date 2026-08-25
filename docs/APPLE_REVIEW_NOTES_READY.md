# Apple App Review notes — Vella 1.0.1

Status on **2026-08-25**: iOS version `1.0.1`, runtime `1.3`, next build `23` is the configured target. Build 23 was inferred as the next value after an exhaustive EAS-history check; it is not a signed artifact. No signed runtime-1.3 EAS build exists yet. Paste these notes only after build 23 finishes, is installed, and every described path passes exact-artifact QA. Metadata, screenshots, App Privacy, legal/trader/contact fields, reviewer access, subscription attachment, and final submission are not completed by this file.

Paste the block below after entering the dedicated reviewer email and password in App Store Connect. Do not place credentials in this repository or in the notes field.

---

Vella is a subscription-only Christian Scripture, prayer, guided-journey, and community app. There is no permanent free tier.

Please use the review credentials entered in App Review Information. The account is pre-confirmed, has full Premium review access, and requires no email verification, OTP, 2FA, location, purchase, trial, or external action.

Suggested review path and edge cases:

1. On a fresh install, complete the compact onboarding by choosing one primary goal, then complete one anonymous first Vella moment. Review the transparent Premium preview and continue with Continue with Apple, Continue with Google, or email. Use the supplied email/password review account. Vella checks entitlement before mounting the paywall, so this active subscriber goes directly into Vella and no purchase is required.

2. Authentication uses one Supabase Auth identity per verified account. Google and Apple sessions and email/password sessions hydrate the same Vella profile when the provider resolves to the same verified account. If a shared Supabase Auth user was first created in another app, first entry into Vella creates the missing Vella profile. If an existing OAuth email chooses email sign-up, Vella sends a verification code and allows that verified user to set a password rather than creating a duplicate profile.

3. Reminder permission is deliberately requested after access, never during compact onboarding. Open Profile → Open settings → Change time or reminder style, confirm Morning, Afternoon, or Evening, adjust the local time, select “Scripture & prayer” or “Quiet encouragement,” then tap “Enable my daily reminder.” The iOS prompt appears only after that tap. “Not now” skips the permission request.

4. Home: review the corpus-backed, edition-attributed Daily Verse. If no journey is active, tap Start journey. Use Back and Next step to move through every available step. Journey verse text comes only from an approved stored Bible edition; if the approved corpus lacks a requested reference, that verse step is omitted rather than generated. On the final step, Reflection and Gratitude are optional and private.

5. Search: search by direct reference (for example, John 3:16), keyword, or natural-language theme. Results are corpus-backed. AI may expand search intent and draft reflection prompts, but displayed Scripture is never written or translated by AI. Favorites, private notes, and device verse audio are also available; audio starts only after tapping Listen.

6. Prayer Space: type a prayer, or tap the voice option to record. Microphone permission is requested only after the user starts recording. The recording is sent securely to OpenAI only to create an editable transcript; Vella does not store the audio. The user reviews and edits the draft, and only confirmed text is saved.

7. Community: open Community, compose a text post, and optionally attach one selected image. Before the first post, the app requires scrolling through and accepting Community Terms. Text, comments, and selected post images receive automated safety checks. Post menus provide report and block actions; owners can delete their own posts/comments. Blocked users can be managed in Profile.

8. Subscription: open Profile → Manage subscription to reach Vella Premium. Both products, localized pricing, renewal disclosures, Restore purchases, Manage subscription, Terms, and Privacy are available there. Monthly is charged immediately and has no trial. Annual shows a 14-day free trial only when StoreKit reports that Apple ID as eligible; otherwise it shows immediate annual billing. The supplied review account already has Premium access, so no purchase is required for review.

9. Lapsed-access/account-control edge case: an authenticated user without an active entitlement is held on Vella Premium, but Restore purchases, Manage subscription, Terms, Privacy, Sign out, and Delete account remain available. Subscribers can also delete their account at Profile → Open settings → Delete account. Store subscriptions must be canceled separately.

10. Permissions and attribution: notifications are optional and contextual. Photo-library access is requested only after tapping the Feed image-attachment control; the user can limit access to selected photos. Microphone access is contextual as described above. Vella does not request camera, contacts, location, or App Tracking Transparency permission. It uses Apple's non-tracking AdServices install attribution to measure Vella's own campaign performance without IDFA, fingerprinting, or cross-app tracking.

Public links:
- Terms: https://vella.one/terms
- Privacy: https://vella.one/privacy
- Support: https://vella.one/support
- Account deletion: https://vella.one/delete-account
- Community guidelines: https://vella.one/community-guidelines

Backend: https://vella.one
