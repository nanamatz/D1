# Lexicon Pipeline (offline)

Turns a plain word list into the game's `lexicon.json` (`{ word: { suit, pos[] } }`).
This is the real version of GDD §3.2's suit/POS tagging — the offline task that
playtest-01..03 kept deferring. **Runtime never touches this; it consumes the baked output.**

## Contents

- `seeds/formal.txt` · `seeds/slang.txt` · `seeds/vulgar.txt` — 516 hand-written seed words.
  These are **authoritative**: the classifier never overrides them. Standard is the default,
  so there is no standard seed file — anything not caught by seeds or the LLM stays standard.
- `classify.mjs` — batch classifier. Applies seeds first, sends the rest to Claude, writes `lexicon.json`.

## Two ways to run this

### A. Seeds-only (free, no API key, do this first)

```
node build-seeds-only.mjs --words data/curated.txt --out data/lexicon.json
```

Applies the 516 hand-written seeds; everything else defaults to `standard`
(POS is a crude suffix-based guess for non-seeded words — good enough for the
sentence system to function, not linguistically precise). **No cost, instant.**
This alone should noticeably relieve the "everything is Standard" complaint,
since it guarantees several hundred formal/slang/vulgar words are tagged.

Re-running `classify.mjs` later is non-destructive: seeds always win, so any
words it re-tags that aren't in the seed files just get upgraded from the
guessed POS / default-standard to real LLM tagging.

### B. Full LLM batch (costs a few dollars, do this if seeds-only isn't enough)

1. Provide a curated word list (frequency-topped, one lowercase word per line) at `data/curated.txt`.
   - Source it from an open list (ENABLE etc.) intersected with a frequency list (SUBTLEX-US/COCA),
     cut to the top ~20–30k. This same list is the game's validity `Set`, so the two stay in sync.
2. `export ANTHROPIC_API_KEY=sk-ant-...`
3. `node classify.mjs --words data/curated.txt --out data/lexicon.json --model claude-haiku-4-5-20251001`
   - Optional: `--limit 3000` (test on a slice), `--batch 100`.
   - Cost estimate at Haiku 4.5 rates (~$1/$5 per MTok): roughly **$5–7 for 30k words** at
     standard rates, or about half that using Anthropic's Batch API if you adapt the script
     to it. Sonnet-tier models cost several times more for the same job with no accuracy
     benefit for a tagging task like this — Haiku is the right tier here.
4. It prints a suit-distribution report at the end and is **resumable** (writes every batch).
5. Commit `data/lexicon.json`. Point the game's lexicon loader at it.

## Cost & tuning

- ~20–30k words at batch 100 ≈ 200–300 API calls, temperature 0. Cheap; run once per word-list change.
- The prompt tells the model Standard is the default and to only surface formal/slang/vulgar,
  which keeps it conservative and cheap. Seeds act as the ground-truth anchor.

## Inflection inheritance (optional follow-up)

If the curated list contains inflected forms (plurals, tenses — which it should, per the
"inflections are IN" decision), you can either (a) let the classifier tag them directly, or
(b) tag lemmas only and map inflections to their lemma's tags in a small post-step. (b) is
cheaper and more consistent; (a) is simpler. Either is fine for the "roughly correct" target.

## Spot-check before shipping

After baking, eyeball a few hundred high-frequency entries — the classifier is good but not
perfect, and the most-played words matter most. Fix by adding to the seed files (authoritative)
and re-running; seeds always win, so corrections are permanent.
