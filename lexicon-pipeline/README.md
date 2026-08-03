# Lexicon pipeline (offline)

Builds the complete baked validity/POS data consumed by browser, desktop, and
Node simulations. Runtime never fetches or classifies words.

## Canonical rebuild

Sources:

- ENABLE: <https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt>
- Princeton WordNet 3.0: <https://wordnetcode.princeton.edu/3.0/WordNet-3.0.tar.gz>
- Moby Part-of-Speech II: <https://www.gutenberg.org/files/3203/files/mobypos.txt>
- English Wiktionary usage categories: <https://en.wiktionary.org/wiki/Category:English_terms_by_usage>

```sh
node scripts/build-dictionary.mjs /path/to/enable1.txt data/dictionary.txt
node lexicon-pipeline/classify-wordnet.mjs \
  --words data/dictionary.txt \
  --existing data/lexicon.json \
  --wordnet /path/to/WordNet-3.0/dict \
  --moby /path/to/mobypos.txt \
  --out data/lexicon.json
node lexicon-pipeline/fetch-wiktionary-registers.mjs
node lexicon-pipeline/fetch-wiktionary-primary-registers.mjs
node lexicon-pipeline/classify-registers.mjs
npm run check:data
```

`dictionary.txt` contains every ENABLE word plus apostrophe-free tile-grammar
exceptions. `classify-wordnet.mjs` preserves every existing non-empty entry,
then fills missing words from Moby and WordNet. WordNet morphology handles
inflections and verb frames distinguish transitive, intransitive, and linking
uses. A deterministic suffix fallback gives the remaining obscure forms a
non-empty POS. Register classification is a separate pass, so the POS builder
defaults newly added words to Standard rather than applying legacy suit seeds.

Current complete build: 172,836 dictionary words, 172,859 lexicon entries
(23 retained pre-existing entries sit outside the dictionary). `check:data`
rejects missing or empty POS and register-audit drift.
Register distribution: Standard 169,065; Formal 2,675; Slang 879; Vulgar 240.

The authoritative rules and boundary examples live in
`docs/# 영단어 레지스터 분류 기준.md`; `register-overrides.json` mirrors only
those examples. `fetch-wiktionary-registers.mjs` recursively captures explicit
Formal/higher-register/literary/poetic/officialese/technical, Slang, Vulgar, and
slur categories as a candidate index. Informal and colloquial categories are
intentionally excluded because the criteria map those labels to Standard.
`fetch-wiktionary-primary-registers.mjs` then checks the usage label attached to
each candidate's first English definition and stores only labels/revision ids,
not definition text. `classify-registers.mjs` applies explicit examples, inherits
non-standard register only across POS-compatible inflections, and defaults the
rest to Standard. Precedence Vulgar > Slang > Formal > Standard is applied only
to the selected representative meaning, never across unrelated secondary senses.
The exact evidence path for every non-standard result is baked into
`data/register-audit.json`.

## Optional LLM fill pass

`classify.mjs` remains a resumable missing-entry classifier for a scratch or
partial table; it uses the same representative-meaning prompt and deliberately
does not overwrite existing entries.
`build-seeds-only.mjs` and `merge-hand-pos.mjs` remain legacy recovery tools,
not the canonical full build.

Moby data is public domain. WordNet 3.0 permits use, modification, and
distribution under its bundled license; preserve its notice when redistributing
the source database. Only derived POS tags are committed here.
