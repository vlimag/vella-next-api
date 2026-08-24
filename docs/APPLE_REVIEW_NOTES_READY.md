# Apple App Review notes — Vella 1.0.1

Status on **2026-07-31**: iOS build `1.0.0 (15)` is uploaded, but it still needs to be selected and attached to the completed version/subscription review in authenticated App Store Connect. Metadata, screenshots, App Privacy, legal/trader/contact fields, reviewer access, subscription attachment, and final submission are not completed by this file.

Paste the block below after entering the dedicated reviewer email and password in App Store Connect. Do not place credentials in this repository or in the notes field.

---

Vella is a subscription-only Christian Scripture, prayer, guided-journey, and community app. There is no permanent free tier.

Please use the review credentials entered in App Review Information. The account is pre-confirmed, has full Premium review access, and requires no email verification, OTP, 2FA, location, purchase, trial, or external action.

Suggested review path and edge cases:

1. On a fresh install, complete the seven-step onboarding: choose a language, one or more goals, optional life-season focus areas, realistic daily time, preferred time of day, reminder tone, and review the personalized preview. Then complete the guided first Vella moment and sign in with the supplied account when prompted.

2. Reminder permission is deliberately requested after onboarding, never during the questionnaire. Open Profile → Open settings → Change time or reminder style, confirm Morning, Afternoon, or Evening, adjust the local time, select “Scripture & prayer” or “Quiet encouragement,” then tap “Enable my daily reminder.” The iOS prompt appears only after that tap. “Not now” skips the permission request.

3. Home: review the corpus-backed, edition-attributed Daily Verse. If no journey is active, tap Start journey. Use Back and Next step to move through every available step. Journey verse text comes only from an approved stored Bible edition; if the approved corpus lacks a requested reference, that verse step is omitted rather than generated. On the final step, Reflection and Gratitude are optional and private.

4. Search: search by direct reference (for example, John 3:16), keyword, or natural-language theme. Results are corpus-backed. AI may expand search intent and draft reflection prompts, but displayed Scripture is never written or translated by AI. Favorites, private notes, and device verse audio are also available; audio starts only after tapping Listen.

5. Community: open Community, compose a text post, and optionally attach one selected image. Before the first post, the app requires scrolling through and accepting Community Terms. Text, comments, and selected post images receive automated safety checks. Post menus provide report and block actions; owners can delete their own posts/comments. Blocked users can be managed in Profile.

6. Subscription: open Profile → Manage subscription to reach Vella Premium. Both products, localized pricing, renewal disclosures, Restore purchases, Manage subscription, Terms, and Privacy are available there. Monthly is charged immediately and has no trial. Annual shows a 14-day free trial only when StoreKit reports that Apple ID as eligible; otherwise it shows immediate annual billing. The supplied review account already has Premium access, so no purchase is required for review.

7. Lapsed-access/account-control edge case: an authenticated user without an active entitlement is held on Vella Premium, but Restore purchases, Manage subscription, Terms, Privacy, Sign out, and Delete account remain available. Subscribers can also delete their account at Profile → Open settings → Delete account. Store subscriptions must be canceled separately.

8. Permissions: notifications are optional and contextual. Photo-library access is requested only after tapping the Feed image-attachment control; the user can limit access to selected photos. Vella does not request camera, microphone, contacts, or location access.

Public links:
- Terms: https://vella.one/terms
- Privacy: https://vella.one/privacy
- Support: https://vella.one/support
- Account deletion: https://vella.one/delete-account
- Community guidelines: https://vella.one/community-guidelines

Backend: https://vella.one
