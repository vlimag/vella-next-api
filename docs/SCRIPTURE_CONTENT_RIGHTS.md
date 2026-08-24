# Scripture content rights record

Last verified: **2026-08-03**

This record documents the Scripture editions seeded in Vella. It is an
engineering provenance record, not legal advice. Any future import must add its
edition, source, license, attribution requirements, exact revision, and import
date here before production use.

| Code | Edition | Language | Release basis | Source |
| --- | --- | --- | --- | --- |
| `KJV` | King James Version, standardized 1769 text | English | Public domain outside the United Kingdom; electronic distribution is documented by eBible.org. Vella must review UK-specific Crown restrictions before a UK launch. | <https://ebible.org/eng-kjv2006/copyright.htm> |
| `BPM` | Bíblia Portuguesa Mundial | Brazilian Portuguese | Public domain; the source identifies the edition as an in-progress translation. | <https://ebible.org/porbrbsl/> |
| `RV1909` | Santa Biblia — Reina Valera 1909 | Spanish | Public domain. | <https://ebible.org/spaRV1909/copyright.htm> |

## Current production scope

The release database contains the complete 66-book, 31,098-verse `WEBP` and
`BPM` VPL corpora sourced from eBible.org. `RV1909` currently contains John
3:16 and Psalm 23:1. Migration `0015_release_safe_bible_versions.sql` replaces
the incorrect `ARA` and `RVR1960` labels and seed wording with the documented
`BPM` and `RV1909` editions. The checksum-locked production importer is
`scripts/import-approved-webp-corpus.mjs`.

Do not describe Almeida Revista e Atualizada (`ARA`) or Reina-Valera 1960
(`RVR1960`) as public domain, and do not import either edition without written
distribution rights.

## Store answer

Vella displays third-party Scripture text, so answer **Yes** to the App Store
content-rights question. Keep this record and the linked source pages available
if review asks for evidence. Do not claim ownership of the public-domain text.
