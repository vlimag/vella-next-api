# Vella Weekly Growth Review

Review week: `YYYY-MM-DD` to `YYYY-MM-DD`

## Decision first

- Decision: `hold | continue | scale | fix funnel | stop test`
- One-sentence reason:
- Owner and next review date:
- Campaign state confirmed: `paused | ended` (never activate from this review alone)

## Spend and acquisition

| Attribution label | Source | Campaign / creator | Spend (BRL) | Diagnostic installs | Production transitions | Mature paid | Mature source-qualified CAC |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| `source-qualified | platform-blended | not attributable` | | | | | | | |

Use the labels exactly. `source-qualified` requires one server-validated
eligible install association. `platform-blended` is authoritative store truth
without a unique eligible source. `not attributable` is spend/client diagnostic
data without a reportable server join and never means organic. If attribution
loading is unavailable or incomplete, stop the source analysis instead of
relabeling rows.

Every source/platform/campaign/subscription breakdown needs at least 20
production transitions. Do not show or copy exact sub-threshold values. A paid
cohort must be at least 16 full days old before a campaign CAC is shown. Compare
that CAC with the provisional R$60 ceiling, but do not call it D30 retained CAC
and do not treat passing the ceiling as permission to spend.

Confirm the spend-ledger audit is complete before reading CAC. A missing mature
ledger row is unavailable data, not R$0; only an explicit zero-cent ledger row
is zero spend. For an open current-day report, maturity is measured no later
than the current instant, never tomorrow's report boundary.

## Product funnel

| Funnel step | Users | Conversion from previous | Week-over-week | Notes |
| --- | ---: | ---: | ---: | --- |
| First open | | | | |
| Onboarding completed | | | | |
| Paywall viewed | | | | |
| Checkout started | | | | |
| Verified trial / paid start | | | | |
| Meaningful first session | | | | |
| D1 meaningful use | | | | |
| D7 meaningful use | | | | |

## Mature subscription cohorts

Only include cohorts at least 16 full days old for the first trial-conversion
decision. Keep D30 retained-paid CAC as the later business north star.

| Attribution label | Trial cohort | Production trials | Converted paid | Conversion | Refunds | Early cancellations | Mature paid CAC | R$60 ceiling |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| | | | | | | | | `within | above | unavailable` |

Hold conversion conclusions while fewer than 20 verified trial starts have
matured for 16 full days. Scale only after two consecutive cohorts of at least
50 paid installs each meet every product, retention, refund, entitlement, and
CAC guardrail; any eventual Android increase is capped at 20% once per seven-day
review and still requires a separate go/no-go decision.

## Creative learning

| Creative ID | Promise / hook | CTA rate | Install quality | Trial quality | Retention quality | Keep? |
| --- | --- | ---: | --- | --- | --- | --- |
| | | | | | | |

Questions:

1. Which promise attracted the most qualified subscriber, not the cheapest click?
2. Did the store page honestly match the ad?
3. Where did the largest funnel loss happen?
4. What did support feedback reveal that the numbers did not?
5. Is the next test changing only one important variable?

## Product and safety guardrails

- Purchase-validation error rate:
- Checkout abandonment:
- Notification opt-out:
- Push delivery failure:
- Refund/chargeback rate:
- Account deletion:
- Support complaints:
- Crash-free sessions, when available:

Pause acquisition immediately for systemic checkout, entitlement, privacy, or
content-safety failures.

## Next experiment

- Hypothesis:
- Control:
- Treatment:
- Primary metric:
- Guardrails:
- Minimum cohort age/sample rule:
- Start and decision dates:
- Budget ceiling:

## Privacy review

Confirm that no report, export, campaign, or audience contains prayer text,
prayer themes, Scripture searches, private notes, onboarding spiritual answers,
posts, identity fields, push/purchase tokens, or inferred religious attributes.

## Historical spend reconciliation note

Keep the prior Google Ads record separate from any future R$60/day test:

- account `712-460-9192`, campaign `24120421103`;
- 2026-08-09 through 2026-08-21, Ended / inactive, R$46/day;
- UI total R$594.09;
- displayed rounded daily rows total R$594.08.

Record the one-cent discrepancy as display/export rounding. Do not invent,
distribute, or import the cent, and do not claim a future campaign ID. All paid
campaigns remain paused or ended until an explicit launch approval.
