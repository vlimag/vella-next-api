# Vella Organic Growth and PT-BR Store Conversion Design

**Date:** 2026-10-04

**Status:** Approved in chat for specification; written-spec review pending

## Outcome

Create a regression-safe organic acquisition release that expands Vella's useful,
localized search footprint and fixes the most visible Brazilian Play Store
localization gap. The release must improve measurement without collecting prayer,
Scripture-search, journal, profile, or other sensitive content, and it must not
change subscription economics or paid-campaign controls.

The coordinated release contains:

- two original evergreen articles in every existing website locale;
- stronger article discovery, internal linking, social presentation, and sitemap
  freshness;
- more reliable privacy-safe website-to-store CTA measurement;
- a real-product, current-runtime PT-BR Play screenshot deck;
- explicit post-release Search Console and Play monitoring gates.

## Evidence and diagnosis

The 2026-10-04 audit found that the technical SEO foundation is healthy:

- `https://vella.one/sitemap.xml` is submitted in Search Console with status
  `Success`, was last read on 2026-09-21, and exposes 104 discovered URLs;
- Search Console reports 99 indexed pages and 54 non-indexed known URLs. Forty
  are intentional redirects or canonical alternates, five are blocked API URLs,
  eight are discovered but not yet crawled, and the single crawled/non-indexed
  URL is an RSS feed;
- live localized pages return 200 responses and emit canonicals, language
  alternates, `x-default`, localized metadata, RSS links, and structured data;
- the Search Console domain property is verified and accessible through the
  organization operator account.

Organic reach is nevertheless small. For 2026-08-02 through 2026-09-29,
Search Console reports five clicks, 354 impressions, 1.4% CTR, and average
position 9.5. Brazil contributed ten impressions and zero clicks. Existing
localized articles are already capable of earning clicks in Germany, Italy,
Portugal, and Belgium, so the multilingual architecture should be extended,
not replaced.

First-party website analytics recorded 300 entry events from 2026-08-30 through
2026-10-04, including 19 article entries and four search-referrer entries, but
zero recorded store CTA clicks. Those entry events are privacy-safe approximate
sessions, not verified unique people, and may include operator or synthetic
traffic.

Google Play reports, for the latest 28-day window inspected on 2026-10-04,
3.15K device impressions, 116 device acquisitions, and 68 first opens. The
acquisitions split into 104 paid/direct, four Google Play Explore, and eight
unattributed. Reach splits into 1.98K Google Play Explore impressions and 1.17K
paid/direct impressions. The store-listing view separately reports 576 visitors,
181 unique install clicks, and 31% click-through rate for its current 28-day
window. These surfaces use different definitions and must not be divided into a
single claimed funnel rate.

The public Brazilian listing has localized title, short description, full
description, and BRL in-app purchase range, but all eight phone screenshots are
English. This is the clearest correctable Play conversion gap. No store-listing
experiment is currently running.

## Immutable commercial and privacy boundaries

- Monthly remains charged immediately with no trial.
- Only eligible new annual subscribers may receive exactly 14 days through the
  store.
- Prices, product IDs, base plans, offer IDs, billing periods, renewals,
  entitlements, and the absence of a permanent free tier do not change.
- No Google Ads budget, bidding, conversion goal, targeting, billing, access, or
  campaign state changes are part of this release.
- Website analytics must not store raw URLs, raw referrers, search queries,
  devotional text, Scripture searches, prayer content, user-authored content,
  identity, IP addresses, user agents, or fingerprints.
- Store media must use real current-runtime product UI and synthetic,
  non-personal content. Generated or fabricated app UI is forbidden.

## Approach

Keep the current statically generated Next.js locale architecture and expand it
as a focused content cluster. Do not introduce a CMS, localized-slug migration,
or bulk programmatic publishing. The current shared slug across locale prefixes
is stable, already indexed, and correctly paired through `hreflang`.

Two articles are added as original editorial units, with content adapted for
each of the eight supported locales rather than mechanically padded or keyword
stuffed:

1. `how-to-start-reading-the-bible-seven-day-plan`
   - PT-BR working title: **Como começar a ler a Bíblia: um plano simples de 7 dias**
   - Search intent: beginning a sustainable Bible-reading practice.
   - Product alignment: Scripture search, daily reflection, and seven-day
     guided journeys.
2. `a-short-night-prayer-for-the-end-of-the-day`
   - PT-BR working title: **Oração da noite: um roteiro curto para terminar o dia com honestidade**
   - Search intent: a short, repeatable evening prayer practice.
   - Product alignment: private prayer space, daily reminders, and reflection.

Each article must be people-first and complete without requiring the app. It may
name relevant Scripture references, but should avoid long copyrighted
translations, decontextualized proof-texting, medical claims, guaranteed
outcomes, or claims of spiritual authority. Each locale must read naturally and
carry the same safety meaning. No draft may be marked human-reviewed unless a
named human actually reviews Scripture handling, natural language, safety, and
claims.

## Web components and data flow

### Article catalog

Extend `lib/site/blog.ts` through the existing typed `BLOG_SLUGS`, `BlogPost`,
and locale maps. Every slug must be present in all eight locale maps, with a
localized title, description, category, date label, read time, hero quote,
sections, reflection prompts where useful, and contextual CTA.

The content catalog remains the single source for static params, page metadata,
RSS, sitemap entries, and blog-index cards. Missing locale content is a test
failure; there is no silent English fallback.

### Internal discovery

Add a typed related-article field using catalog slugs, rendered after the
article body and before the store CTA. Links remain within the current locale.
Every article should receive two or three editorially relevant links, including
at least one link to or from each new article. The blog index remains the primary
collection page.

### Metadata and structured data

Retain localized canonical URLs and the complete eight-language plus
`x-default` alternate set. Extend `BlogPosting` data with a stable per-article
image and a URL-shaped `mainEntityOfPage`. The blog collection continues to
expose its post list.

Generate one social image per new article from the existing Vella visual system.
Images may be typographic/editorial art, but may not pretend to be app UI. They
must remain readable at Open Graph crops and include no price, trial, health, or
spiritual-outcome claim.

The blog-index sitemap `lastModified` must derive from the newest published or
updated catalog entry rather than remain a manually maintained static date.
Individual article dates continue to derive from their own catalog records.

### Website CTA measurement

Keep the existing strict `landing_viewed` and `store_cta_clicked` schemas. Make
the client queue survive a page lifecycle transition through bounded
`sessionStorage` and use a delivery path appropriate for outbound navigation,
with the existing idempotent event ID retained on retry. The queue remains
capped at 20 events and contains only the approved coarse source, medium,
campaign, route class, CTA ID, locale, and store.

Do not reinterpret entry events as people or full page views. Search Console
remains authoritative for query, page, country, impression, and Google organic
click reporting; first-party events measure privacy-safe on-site entry and store
CTA behavior.

## Google Play PT-BR screenshot deck

Replace the Brazilian user-visible English phone screenshot deck with eight
current, sanitized PT-BR captures. Preserve the current localized listing text
and feature graphic unless visual QA finds a factual mismatch.

The deck should tell one coherent progression:

1. choose language and begin a calmer daily rhythm;
2. personalize the goal;
3. personalize the focus;
4. receive the first Vella moment;
5. see the daily home experience;
6. search Scripture;
7. use the private prayer space;
8. follow a guided journey.

Every capture must come from clean mobile `main` using the production-equivalent
runtime and PT-BR locale. Use synthetic accounts/content, remove status-bar or
notification surprises, and preserve accurate current navigation and branding.
Overlay copy, if any, must be natural PT-BR and must not mention price or trial.
The resulting PNGs must satisfy Play's phone screenshot dimensions, aspect
ratio, color mode, opacity, and file-size constraints and be stored under the
versioned mobile store asset tree with a manifest containing dimensions and
hashes.

Uploading or submitting these public assets is a separate external action. It
requires action-time operator confirmation after the files and exact console
diff are ready. After publication, verify the public `pt_BR` listing rather than
assuming a successful console save means a live localized result.

## Error handling and rollback

- A missing localization, invalid related slug, unsafe claim, invalid social
  image, or stale screenshot source fails validation before release.
- Website analytics failure remains non-blocking and never delays navigation.
  Failed events remain in the bounded session queue for a later idempotent retry.
- If a localized article has not received the required editorial approval, it
  remains a repository draft and is excluded from `BLOG_SLUGS`, sitemap, RSS,
  and public routes.
- Web/API rollback restores the previous Vercel production deployment.
- Store rollback restores the previous screenshot association; it does not
  change the app binary, OTA, prices, plans, or subscriptions.

## Verification gates

Implementation follows test-driven development:

- tests first prove that both slugs exist in all eight locales, metadata and
  structured data are localized, related links stay in-locale, RSS and sitemap
  include each approved article, and the blog-index modification date advances;
- CTA tests prove outbound Android/iOS events persist safely across lifecycle
  interruption, remain idempotent, stay bounded, and include no prohibited
  values;
- focused site and analytics tests, full API test suite, typecheck, production
  build, and `git diff --check` pass;
- screenshot validation proves exactly eight PT-BR PNGs, allowed dimensions and
  aspect ratio, opaque RGB output, expected locale manifest, unique hashes, and
  real approved source captures;
- the PT-BR flow and screenshot states are visually checked on Android before
  any console upload;
- API and mobile release work begins only from clean tested `main`, synchronized
  with `origin/main`, and final production provenance is recorded under the
  workspace release invariant.

## Rollout and measurement

After the approved web release:

1. verify live status, metadata, `hreflang`, JSON-LD, RSS, sitemap count and
   dates, related links, and both store destinations;
2. confirm the new sitemap is read by Search Console and inspect both new URLs;
   requesting indexing is an explicit external action and is done only with
   operator confirmation;
3. record 14-day and 28-day Search Console snapshots for index state,
   non-brand impressions, clicks, CTR, average position, country, and page;
4. record first-party article entry and store CTA aggregates without treating
   them as unique people;
5. after the Play screenshots are live, compare Google Play Explore reach and
   acquisitions plus listing visitors, unique install clicks, and conversion
   using each console's own definitions.

Do not start a store-listing experiment merely because the feature exists. The
obvious language mismatch is corrected first. An experiment on screenshot order
or headline framing becomes worthwhile only after the localized control has
enough traffic for a meaningful result.

## Non-goals

- no subscription, price, trial, entitlement, billing, or purchase-flow change;
- no campaign activation, scaling, budget, bidding, goal, or targeting change;
- no CMS or localized URL migration;
- no mass article generation or automatic publication;
- no claim that low-volume Search Console or first-party data proves causality;
- no submission of the existing seasonal PT-BR draft without its separate named
  human editorial approval.
