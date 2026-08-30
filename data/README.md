# Runtime lexicon data

`dictionary.txt` contains every ENABLE word of 18 letters or fewer, 13
apostrophe-free tile-grammar exceptions, four curated MVP/VIP singular/plural
surfaces, and the exact reviewed `christ`/`christmas` omissions (**172,234**
total). `lexicon.json` gives every dictionary word a non-empty
POS list: exact-headword public-domain Moby POS and Princeton WordNet 3.0 tags
are unioned with the legacy classification, explicit `pos-overrides.json` wins,
and a deterministic suffix fallback covers remaining obscure forms.

Every lexicon entry also passes the offline representative-meaning register
audit defined by `docs/# 영단어 레지스터 분류 기준.md`. Wiktionary usage
categories locate candidates, and the first English definition's label decides
the candidate when no explicit boundary example applies. Informal/colloquial and
unmarked senses remain Standard; only POS-compatible inflections inherit a
non-standard lemma. All other and ambiguous words deliberately default to
Standard. `register-audit.json` records the full review counts and the evidence
path for every non-standard assignment.

The current lexicon contains **172,257** entries, including 23 retained entries
outside the dictionary. No playable entry exceeds 18 letters. Distribution:
Standard **168,469**; Formal 2,669; Slang 879; Vulgar 240.

`lexicon-pipeline/curated-abbreviations.json` is the canonical source for `mvp`,
`mvps`, `vip`, and `vips`. Each is a Standard noun. Punctuation and any unlisted
initialism remain invalid. `lexicon-pipeline/curated-validity.json` separately
owns the exact reason-bearing `christ` and `christmas` Standard-noun rows. That
registry admits only listed lowercase spellings: it neither allows proper names
as a category nor generates plurals or derivatives. Runtime still loads only the
two baked files above.

Moby Part-of-Speech II is public domain. WordNet-derived data retains Princeton's
notice in `WORDNET_LICENSE.txt`. Wiktionary-derived register data retains source,
license, and transformation details in `WIKTIONARY_ATTRIBUTION.md`.

Both files are baked offline outputs used by Node simulations and the
browser/desktop bundle. They are never fetched at runtime. Rebuild instructions
live in `lexicon-pipeline/README.md`. Run `npm run check:data` after either file
changes; validation rejects any dictionary word without POS.
