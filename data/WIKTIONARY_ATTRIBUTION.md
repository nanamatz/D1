# Wiktionary register data attribution

Register labels in `lexicon.json` are partly derived from English Wiktionary
usage-category membership, retrieved through the MediaWiki API. The offline
snapshot records the exact category roots and retrieval date in
`lexicon-pipeline/wiktionary-registers.json`.

- Source: <https://en.wiktionary.org/wiki/Category:English_terms_by_usage>
- Authors: Wiktionary contributors
- Offline snapshot retrieved: 2026-08-03
- Licenses: Creative Commons Attribution-ShareAlike 4.0 and GNU Free
  Documentation License; see <https://creativecommons.org/licenses/by-sa/4.0/>
  and <https://en.wiktionary.org/wiki/Wiktionary:Copyrights>

Changes made for this project: usage-category entries were lowercased,
restricted to unbroken ASCII alphabetic spellings, and intersected with the
baked game lexicon to locate review candidates. For each candidate, the usage
labels attached to its first English definition were reduced to the project's
representative-meaning classes; explicit documented boundary examples and
POS-compatible inflection inheritance were then applied. Definitions are not
redistributed in the baked snapshots.
