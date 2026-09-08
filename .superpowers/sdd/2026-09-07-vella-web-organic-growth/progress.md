# SDD ledger — plan: /Users/vitor/Repositories/Projects/FaithHarbor/api/docs/superpowers/plans/2026-09-07-vella-web-organic-growth.md

## Preflight interface scan

| Producer / consumer | Interface | Finding |
| --- | --- | --- |
| Hero/header CTA / store CTA tracker | placement, platform, campaign | Must share the existing bounded event contract and emit only for direct store navigation. |
| GrowthTracker / API growth schema | source, medium, campaign, content | Existing allowlists are sufficient; raw URL/referrer must never cross the client boundary. |
| Blog catalog / article route and sitemap | published locale/slug pairs and alternates | Existing all-locales assumption must remain valid for old posts while draft PT-BR packets stay out of public routes. |
| Sitemap helpers / Next canonical metadata | normalized localized paths | Empty locale-home paths must produce no trailing slash so every emitted URL is final. |
| Middleware / application routes | host, pathname, query | Apex redirect must run before locale routing and preserve path/query without touching local/test hosts. |
| Task 1 internal consistency | tests, code, drafts, deployment | Tests lead each behavior change; draft content cannot be described as human-reviewed or published. |

Ruling: Four PT-BR packets will be prepared and machine-validated as drafts, but not marked human-reviewed or published without a named human approval — this may delay public content cadence, but avoids a false editorial claim.

Ruling: Use the existing bounded `source`, `medium`, `campaign`, `content`, `cta_id`, and `store` event properties instead of a database migration — if later reporting needs a dedicated page dimension, a separate migration will be required.

Ruling: The implementer will stop after a tested local commit; the controller will push and deploy only after independent task and whole-release review — this delays the external release but keeps the review gate meaningful.

Task 1 review: spec failed; open findings are unallowlisted query-derived campaign transmission, undefensible public `updatedAt` changes, loose referrer-host matching, and incomplete editorial URL validation.

Ruling: The review's generated-UUID finding is not a task defect. The existing ingestion contract requires random pseudonymous event/install/session UUIDs for dedupe and rate-limiting; they are not raw external, account, device, advertising, or user identifiers, and the plan explicitly forbids a migration while retaining the existing event envelope. Removing them would break all web ingestion and costs the already-live aggregate measurement. The implementation must still reject arbitrary query-derived campaign values.

Task 1: fix round 1/5 committed as `356c208` and independently re-reviewed. All four actionable findings were addressed; no release-blocking issue remains in the scoped diff.

Task 1: implementation complete at `356c208` (focused 37/37 tests, typecheck, editorial validation, and diff check passed). Whole-release verification remains a separate gate; the first full-suite run produced four failures now under isolated systematic diagnosis.

Task 1 editorial re-review: replaced the internal week-4 release-scheduling phrase with audience-facing seasonal PT-BR copy. The packet validator now rejects `cadência de quatro semanas` in authoritative article bodies; scoped test, editorial validation, and diff check passed. The draft and named-human approval gates remain unchanged.
