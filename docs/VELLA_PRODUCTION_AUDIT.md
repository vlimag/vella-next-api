# Vella production audit and launch plan

> **SUPERSEDED OPERATIONAL HISTORY.** This pre-release snapshot is preserved only for provenance. Do not use its runtime, build, onboarding/auth, privacy, billing, or release instructions. Current instructions are in [`RELEASE_FINISH_LINE.md`](./RELEASE_FINISH_LINE.md) and [`STORE_SUBMISSION_PACKAGE.md`](./STORE_SUBMISSION_PACKAGE.md).

Last reviewed: 2026-07-28

## Release verdict

- **Website:** published on Vercel and connected to `https://vella.one` and `https://www.vella.one` with managed TLS.
- **Mobile app:** feature-rich, but not yet a safe public-store release. An OTA now points compatible runtime `1.0` builds at the live API, but the embedded store binary still contains the old localhost value; IAP verification, content/licensing, abuse controls, and a few privacy/security items remain release blockers.
- **Backend:** broad feature coverage and a modern AI stack, but production hardening is required before a public launch.

## Product and feature inventory

### Working product surfaces

- [x] Seven-step onboarding for language, multi-goal selection, optional focus areas, available time, reminder period and tone, and a personalized preview before the first guided moment
- [x] Guest mode with account migration
- [x] Email authentication and OTP flow
- [x] Daily Scripture experience, journeys, streaks, favorites, notes, and text-to-speech
- [x] Natural-language Scripture search
- [x] Faith Feed posts, images, comments, likes, shares, follows, mentions, reporting, blocking, EULA acceptance, and automated moderation
- [x] Invite-code group creation, joining, and listing
- [x] IAP purchase, restore, entitlement, and subscription-management scaffolding
- [x] In-app account deletion
- [x] Push-token registration and mention notifications
- [x] Vella app name, identifiers, icons, deep-link scheme, and Expo Updates foundation
- [x] Apple Sign In entitlement and future Apple/Google auth packages installed

### AI capabilities and model

- [x] Default/current server model: `gpt-5.6`
- [x] Search-intent expansion for natural-language Bible queries
- [x] Daily-verse selection and localized daily content generation
- [x] Journey localization support
- [x] Text and image safety moderation for public community content
- [x] API key remains server-side; the mobile client does not receive the OpenAI secret
- [ ] Ground every generated Scripture quotation against a licensed, canonical verse corpus before returning it
- [ ] Add evaluation datasets for verse accuracy, refusal behavior, localization quality, and moderation false positives
- [ ] Add per-capability budget, latency, and failure telemetry

## Website completed

- [x] Custom Vella visual system with responsive navigation, mobile layouts, accessible focus states, and reduced-motion behavior
- [x] Product, features, support, account-deletion, privacy, terms, and community-guidelines pages
- [x] Full interface localization for English, Portuguese, Spanish, French, German, Italian, Russian, and Polish
- [x] Three substantial original journal articles in every supported language
- [x] Locale-aware canonical URLs, `hreflang`, `x-default`, localized metadata, and language routing
- [x] XML sitemap, robots policy, localized RSS feeds, web manifest, `llms.txt`, and structured data
- [x] Vella icon, favicon set, Apple touch icon, and bespoke 1200×630 social card
- [x] App Store and Google Play links use `6790616297` and `io.vella.app`
- [x] Security headers for framing, MIME sniffing, referrers, browser capabilities, isolation, and HSTS
- [x] Automated checks for locale parity, long-form content, URL uniqueness, alternate languages, and store identifiers
- [x] Type-check, test, lint, and Next.js production build pass
- [x] Production Vercel deployment with public access and live smoke tests across all 88 sitemap routes
- [x] Connect `vella.one` and `www.vella.one` to the Vercel project
- [ ] Create or forward `hello@vella.one`, `support@vella.one`, and `privacy@vella.one`
- [ ] Add Apple association data after the Apple Team ID is confirmed
- [ ] Add Android asset links after the Play App Signing SHA-256 fingerprint is available
- [ ] Replace pre-release store messaging once both listings are publicly accessible

## P0 — required before public app release

### Runtime and distribution

- [x] Replace the EAS production `EXPO_PUBLIC_API_URL=http://localhost:4000` value with the deployed HTTPS API URL
- [x] Set production terms and privacy URLs to the live website
- [x] Publish an OTA update for compatible installed builds (`fc4e8ef0-a0d1-42f6-8aa3-1d26d78b0938`, runtime `1.0`, iOS and Android)
- [ ] Create clean iOS and Android store builds with the same production environment
- [ ] Verify login, daily verse, search, journeys, feed, groups, IAP, notifications, deletion, and legal links on both store binaries

### Billing and subscriptions

- [ ] Configure `APPLE_SHARED_SECRET`
- [ ] Configure `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- [ ] Create and verify matching App Store Connect and Google Play products, base plans, offers, prices, trial eligibility, and localized disclosures
- [ ] Validate Apple signed transaction/JWS data instead of trusting incomplete receipt paths
- [ ] Validate Google Real-time Developer Notifications with authenticated OIDC
- [ ] Reconcile entitlements on purchase, restore, renewal, cancellation, refund, grace period, billing retry, and expiration
- [ ] Remove or implement Premium claims that currently exceed the product: shared family plans, deep-study/devotional features, audio/weekly recap
- [ ] Make the Premium content route reachable and test all paywall states

### Scripture content and licensing

- [ ] Replace the demo corpus: current live seed coverage is only two verses in English/Portuguese/Spanish and none in the other five interface languages
- [ ] Expand journeys beyond the current small English/Portuguese/Spanish seed set
- [ ] Document distribution licenses for every Bible edition; do not ship ARA or RVR1960 text without confirmed rights
- [ ] Verify AI-assisted verse text and references against the approved corpus before display

### Security and abuse prevention

- [ ] Correct the `SECURITY DEFINER` anonymous-user migration so callers cannot supply an arbitrary `auth_user_id`
- [ ] Add IP/account/device rate limits to search, daily verse, auth, uploads, and AI-backed endpoints
- [ ] Prevent unauthenticated arbitrary-date requests from creating unbounded daily AI generations across locales
- [ ] Add an operator queue, evidence retention policy, escalation path, and appeal handling for user reports
- [ ] Move sensitive mobile session material from AsyncStorage to platform-secure storage
- [ ] Review Android backup behavior and disable backup for sensitive app state

### Privacy and store compliance

- [ ] Complete the Apple privacy manifest and store privacy answers from actual data flows and SDK behavior
- [ ] Complete Google Play Data Safety and content-rating declarations
- [ ] Remove or consent-gate third-party IP geolocation (`ipapi.co`) before using it for language detection
- [ ] Review youth/age positioning, UGC policies, moderation disclosures, account deletion, and subscription wording with release counsel

## P1 — production-quality follow-up

- [ ] Fill the remaining 22–41 missing mobile translation keys by locale and add native iOS/Android store-system localizations
- [ ] Preserve real diacritics in all user-facing mobile copy
- [ ] Implement Apple and Google sign-in UI, callback handling, account linking, and failure states
- [ ] Add password reset, OTP resend, cooldown, and recovery flows
- [ ] Render full journey bodies, calls to action, and reflection prompts
- [ ] Add edit/delete controls for a user's individual posts, comments, and notes
- [ ] Add notification channels, scheduled reminder delivery, deep-link handling, an in-app inbox, and final Vella notification copy
- [ ] Decide whether groups remain invite-only/basic or gain shared plans, roles, moderation, and member controls
- [ ] Resolve Expo Doctor dependency duplication/config drift findings
- [ ] Add crash reporting, privacy-safe analytics, structured logging, alerting, uptime checks, and AI cost dashboards
- [ ] Add CI gates, API integration tests, mobile unit tests, and end-to-end smoke tests on iOS and Android

## Launch sequence

1. [Completed] Publish and smoke-test the combined website/API on Vercel.
2. [Completed] Point EAS production variables at that deployment and ship an OTA correction.
3. Complete all P0 security, billing, content-rights, privacy, and abuse-control items.
4. Run signed store-binary smoke tests on real iOS and Android devices.
5. Connect `vella.one`, validate SSL/canonicals/redirects, and enable the three email aliases.
6. Complete App Store Connect and Google Play compliance forms, screenshots, review notes, and subscription disclosures.
7. Submit phased releases with monitoring and rollback ownership assigned.
