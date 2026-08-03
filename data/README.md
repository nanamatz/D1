# Runtime lexicon data

`dictionary.txt` contains all 172,823 ENABLE words plus 13 apostrophe-free
tile-grammar exceptions. `lexicon.json` gives every dictionary word a non-empty
POS list: existing curated tags stay authoritative, then public-domain Moby POS
and Princeton WordNet 3.0 fill the expanded pool; a deterministic suffix fallback
covers remaining obscure forms.

Every lexicon entry also passes the offline representative-meaning register
audit defined by `docs/# 영단어 레지스터 분류 기준.md`. Wiktionary usage
categories locate candidates, and the first English definition's label decides
the candidate when no explicit boundary example applies. Informal/colloquial and
unmarked senses remain Standard; only POS-compatible inflections inherit a
non-standard lemma. All other and ambiguous words deliberately default to
Standard. `register-audit.json` records the full review counts and the evidence
path for every non-standard assignment.

Current 172,859-entry distribution: Standard 169,065; Formal 2,675; Slang 879;
Vulgar 240.

Moby Part-of-Speech II is public domain. WordNet-derived data retains Princeton's
notice in `WORDNET_LICENSE.txt`. Wiktionary-derived register data retains source,
license, and transformation details in `WIKTIONARY_ATTRIBUTION.md`.

Both files are baked offline outputs used by Node simulations and the
browser/desktop bundle. They are never fetched at runtime. Rebuild instructions
live in `lexicon-pipeline/README.md`. Run `npm run check:data` after either file
changes; validation rejects any dictionary word without POS.
