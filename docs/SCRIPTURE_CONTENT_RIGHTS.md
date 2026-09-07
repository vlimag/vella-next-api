# Scripture content rights record

Last verified: **2026-08-27**

This record documents the Scripture editions seeded in Vella. It is an
engineering provenance record, not legal advice. Any future import must add its
edition, source, license, attribution requirements, exact revision, and import
date here before production use.

| Code | Edition | Language | Release basis | Source |
| --- | --- | --- | --- | --- |
| `WEBP` | World English Bible | English | Public domain. | <https://ebible.org/engwebp/copyright.htm> |
| `KJV` | King James Version, standardized 1769 text | English | Public domain outside the United Kingdom; electronic distribution is documented by eBible.org. Vella must review UK-specific Crown restrictions before a UK launch. | <https://ebible.org/eng-kjv2006/copyright.htm> |
| `BPM` | Bíblia Portuguesa Mundial | Brazilian Portuguese | Public domain; the source identifies the edition as an in-progress translation. | <https://ebible.org/porbrbsl/> |
| `RV1909` | Santa Biblia — Reina Valera 1909 | Spanish | Public domain. | <https://ebible.org/spaRV1909/copyright.htm> |
| `LSG1910` | Louis Segond 1910 | French | Public domain. | <https://ebible.org/fraLSG/copyright.htm> |
| `LUT1912` | Lutherbibel 1912 | German | Public domain. | <https://ebible.org/deu1912/copyright.htm> |
| `DIODATI1885` | Diodati Bibbia 1885 | Italian | Public domain. | <https://ebible.org/ita1885/copyright.htm> |
| `RUSSYN` | Синодальный перевод | Russian | Public domain. | <https://ebible.org/russyn/copyright.htm> |
| `BG1881` | Biblia Gdańska 1881 | Polish | Public domain; CrossWire's distribution record identifies the module as public domain. | <https://www.crosswire.org/sword/modules/ModInfo.jsp?modName=PolGdanska> |
| `UBG2018` | Święta Biblia — Uwspółcześniona Biblia Gdańska | Polish | Inactive historical import; not served by Vella. © 2018 Fundacja Wrota Nadziei, CC BY-ND 4.0. | <https://ebible.org/polubg/copyright.htm> |

## Current production scope

The release database contains complete 66-book VPL corpora for each supported
app language: `WEBP`, `BPM`, `RV1909`, `LSG1910`, `LUT1912`, `DIODATI1885`,
`RUSSYN`, and `BG1881`. All except `BG1881` are sourced from eBible.org;
`BG1881` is checksum-locked from the Open Bibles OSIS corpus and cross-checked
against CrossWire's public-domain distribution record. Migration
`0015_release_safe_bible_versions.sql` replaces the incorrect `ARA` and
`RVR1960` labels and seed wording with the documented `BPM` and `RV1909`
editions. The checksum-locked production importer is
`scripts/import-approved-webp-corpus.mjs`; it preserves source wording and
punctuation and validates the edition-specific verse count before writing.

Do not describe Almeida Revista e Atualizada (`ARA`) or Reina-Valera 1960
(`RVR1960`) as public domain, and do not import either edition without written
distribution rights.

## Store answer

Vella displays third-party Scripture text, so answer **Yes** to the App Store
content-rights question. Keep this record and the linked source pages available
if review asks for evidence. Do not claim ownership of the public-domain text.
