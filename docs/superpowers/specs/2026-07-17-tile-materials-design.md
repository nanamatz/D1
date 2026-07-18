# Tile Materials — 8 kinds, with real scoring effects

**Date:** 2026-07-17
**Status:** approved, ready for planning
**Touches:** GDD §1.1, §2, §2.2, §14 · `src/engine/{types,balance,scoring,loop,packs}.ts` · `src/ui/components/{Tile,BagView}.tsx`

## Problem

Materials and fonts are currently **pure decoration**. `tile.material` and `tile.font` are set at
tile creation (`bag.ts:26-27`, `packs.ts:44-50`) and read only by the UI — for CSS classes
(`Tile.tsx:41-42`), tooltips (`StagePanel.tsx:44-45`), and pouch counts (`BagView.tsx:22-23`).
No code in `src/engine/` reads either field. The scoring pipeline (`baseScore`, `scoring.ts:46`)
uses only letter chips and the lexicon's suit multiplier.

The gap traces back to the GDD: §2.2 lists Porcelain/Polished/Stone as "(TBD)", and §14 records
"Material effects" as an open issue. Fonts have no effects described at all. Numbers that were
never decided could not be implemented.

This spec closes the material half: **8 materials, each with a real, distinct scoring effect.**

## Decisions

1. **Three new materials — Lead plate (연판), Ivory (상아), Brass (황동)** join the existing five.
   Total: **8 materials** (Ceramic base + 7 with effects). Fonts stay at 5.
2. **Effects reinterpret Balatro; numbers copy it.** Effects are translated into tile/word/publishing
   terms. The first-pass *numbers* are Balatro's, verbatim, as a known-good reference point to tune
   from (see Balance Strategy).
3. **Wild is dropped.** Balatro's Wild card ("any suit") has no meaning here: **suit is a property of
   the word, not the tile** — the lexicon returns it (`scoring.ts:52`). Tiles have no suit to widen.
   This is what frees Balatro's 8 enhancements to fit our 7 effect slots.
4. **Retrigger belongs to the font layer, not materials.** GDD §2 defines fonts as "the edition/**seal**
   slot", and retrigger is a seal (Red Seal) in Balatro. Lead plate takes the **Lucky** slot instead.
   Fonts must keep retrigger available when they are designed.
5. **Risk budget: Glass only.** Every other material is upside. Stone's letter loss is an explicit
   trade-off known at apply time, not a gamble, so it does not violate this.

### Why Lead plate = Lucky reads correctly

A 연판 (鉛版, stereotype plate) wears down as it prints, so impressions vary from pull to pull.
"Same plate, but some copies come out better" is the flavor of a probabilistic material.

## The 8 materials

| Material | Effect | Balatro source | Layer |
|---|---|---|---|
| Ceramic 세라믹 | none (base) | plain card | — |
| Porcelain 자기 | +30 chips | Bonus | word scoring, per tile |
| Polished 연마 | +4 mult | Mult | word scoring, per tile |
| Glass 유리 | ×2 mult, 1/4 chance to destroy the tile | Glass | word scoring, per tile (RNG) |
| Lead plate 연판 | 1/5 → +20 mult; 1/15 → $20 | Lucky | word scoring, per tile (RNG) |
| Brass 황동 | ×1.5 mult while held in hand | Steel | word scoring, per word (reads hand) |
| Ivory 상아 | $3 if held in hand at blind end | Gold | blind end |
| Stone 석재 | +50 chips, **no letter** | Stone (no rank/suit) | word scoring, per tile + type change |

Each effect is **per tile**: three Porcelain tiles in one word give +90 chips; three Brass tiles held
give ×1.5³; two Ivory tiles held at blind end pay $6.

Resolved ambiguities (all Balatro-matching):

- **Glass destroys *after* the word settles**, not mid-scoring — the ×2 always applies on the word that
  breaks it. A destroyed tile leaves the run permanently (it is removed from `run.bag`, not just the
  blind), which is what makes Glass the one real gamble.
- **Lead plate rolls the two outcomes independently.** It is not one roll on a shared table: a tile can
  hit +20 mult and $20 on the same word. Stone's `letter: null` contributes 0 letter chips, so its +50
  is its whole chip contribution — nothing is double-counted.

## Architecture

**Materials are data + hooks**, mirroring jokers (`events.ts` `JokerBus`) and bosses
(`BOSS_REGISTRY`, which already registers a `wordScoring` handler). This reuses an established
pattern rather than introducing one, and honors the CLAUDE.md rule that effects must never be
hard-coded into pipeline code. All numbers live in `BALANCE.materials`.

Effects fire at three distinct points:

**(1) Per tile, during word scoring** — Porcelain, Polished, Glass, Stone, Lead plate.
`loop.ts:161-165` already iterates tiles and pushes a `tile` ScoreEvent each. Material effects hook
in immediately after, emitting a `material` ScoreEvent.

**(2) Per word, reading the hand** — Brass. Counts tiles **remaining in `blind.hand`** (not the ones
submitted), so it is computed once per word, outside the tile loop.

**(3) At blind end** — Ivory. Scans the hand during settlement; unrelated to word scoring.

### Two pipeline changes this forces

**RNG must be threaded into scoring.** Glass's destroy roll and Lead plate's payout roll need
randomness, and CLAUDE.md requires all randomness to flow through the seeded RNG so a run replays
exactly from `RunState.seed`. `scoreSubmission()` currently takes `(tiles, lexicon, run, blind)`
(`loop.ts:143-148`) and has **no RNG parameter**. Its signature must widen to accept `rng`.

**Settle animation length.** Adding a `material` variant to `ScoreEvent` (`types.ts:149`) increases
the beat count of the settle timeline. CLAUDE.md marks this a first-class invariant: `settleDurationMs()`
is the single source of truth for settle length and must scale with the new beats. **Do not**
introduce any fixed delay — that bug has already recurred twice (playtest-05 A).

### Stone: `Tile.letter` becomes `Letter | null`

Stone is the only material that changes a type. Balatro's Stone has no rank or suit; our analog is
**no letter**.

Stone must *break* the word. If a stone tile were merely skipped while spelling, `stone+C+A+T` would
read as "CAT" — collecting +50 chips **and** keeping the suit multiplier, making Stone strictly the
best tile in the game.

Design: `material === 'stone'` ⟺ `letter === null`. `spell()` emits a sentinel for a null letter that
can never appear in the lexicon → lookup fails → **gibberish**, via the existing §6.4 path with no new
rule. Gibberish pays chips × 1.0 and is always submittable, so Stone naturally becomes the heart of a
gibberish build — an archetype that falls out of our own rules rather than being imported.

Ripples:

- `spell()` and `letterChips()` (`scoring.ts:18,25`) — null branches
- `letterHands.ts` — Twin/Triplet/Palindrome/Straight all compare letters; a stone can join none of them
- **`isVowel()` (`types.ts:32`)** — a stone is **neither vowel nor consonant**. If `VOWELS.has(null)`
  returns false and callers infer "not vowel ⇒ consonant", `consonantBricklayer` (+4 chips/consonant)
  silently pays out on stones. Both `vowelPraise` and `consonantBricklayer` must exclude null letters explicitly.
- `Tile.tsx`, `BagView.tsx` — render a letterless tile

Applying Stone via the Kiln consumable destroys that tile's letter permanently. That is intended and
matches Balatro.

## Balance strategy

**Ship Balatro's numbers first, then patch from measurement.** Invented numbers would be armchair
arithmetic; Balatro's are validated. `BALANCE` centralizes every value and `src/sim` autoplays runs
headlessly, so re-tuning is a one-file edit against real data.

Our scale does differ from Balatro's, and the design recorded **three predictions to check in the sim**
rather than pre-emptively "fixing" them. `npm run sim:materials` (`src/sim/materials.ts`, Task 9) measured
them with 500 trials per material, an all-one-material bag per trial (to isolate each effect), and
Ivory's blind-end payout read directly via `endBlind().materialGold`:

```
Materials balance sweep — 500 words per material, hand 11

  ceramic    mean score       7.7  ×   1.0 vs ceramic
  porcelain  mean score      92.7  ×  12.0 vs ceramic
  polished   mean score      67.8  ×   8.8 vs ceramic
  glass      mean score      58.4  ×   7.5 vs ceramic
  stone      mean score     150.0  ×  19.4 vs ceramic
  leadPlate  mean score      62.0  ×   8.0 vs ceramic   gold/word 3.20
  ivory      mean score       7.2  ×   0.9 vs ceramic   blind-end gold 33.00
  brass      mean score     185.2  ×  23.9 vs ceramic

Ante-1 Draft target for reference: 100
Economy for reference: clearReward small/big/boss 3/4/5 · interest cap 5 · jokerPrice common 5
```

1. **Brass explodes — CONFIRMED, worse than predicted.** Measured ×23.9 vs ceramic, more than double the
   informal ×11 estimate. Cause: `findWord`'s average found word is only ~2.4 tiles (not the guessed ~5),
   leaving ~8.6 of the 11 hand tiles held → 1.5^8.6 ≈ ×32 raw, damped to ×23.9 by mean-of-ratios vs
   ratio-of-means and the words' own suit/letter-hand variance. Either direction the original prediction
   pointed (coefficient down, or additive) is warranted; the multiplicative shape is the more violent of
   the two once real (short) word lengths are accounted for.
2. **Porcelain is over-tuned — CONFIRMED.** ×12.0 vs ceramic (mean 92.7 vs 7.7), matching the prediction
   that +30/tile dwarfs 1–10-point Scrabble chips against an ante-1 target of 100.
3. **Ivory and Lead plate's economy survive as-is — CONFIRMED at the per-tile level, but the pure-bag
   harness inflates the raw number.** Lead plate: 3.20 gold/word from ~2–3 played tiles, in line with the
   theoretical per-tile EV (20 × 1/15 ≈ 1.33/tile) and comparable to `clearReward` (3–5) — no scaling
   issue. Ivory: the raw blind-end figure ($33.00) looks large only because the synthetic all-Ivory bag
   means all ~11 held tiles are Ivory simultaneously, which never happens with a handful of packed-in
   Ivory tiles in real play; normalized per held tile it is $33.00 / 11 ≈ **$3.00**, exactly
   `BALANCE.materials.ivory.gold` — confirms the per-tile value needs no scaling. (Stone's ×19.4 is a
   size artifact of the same pure-bag setup — Stone's `letter: null` forces every trial into a
   1–2-letter gibberish "word" so the fixed +50 chips looms large over a tiny ceramic-word denominator;
   it was not one of the three predictions and is not read as a balance signal here.)

Full reasoning, the sim's code, and the autoplay.ts import-hazard fix are in
`.superpowers/sdd/task-9-report.md`.

## Testing

New `tests/slice5-materials.test.ts`:

- each of the 7 effects actually changes the score (the regression this whole spec exists to fix)
- a ceramic-only word scores identically to today (no behavior drift)
- a word containing stone is gibberish and gets no suit multiplier
- stone counts as neither vowel nor consonant (asserted through `vowelPraise` + `consonantBricklayer`)
- Glass destroy and Lead plate payout are **identical for identical seeds** (CLAUDE.md reproducibility)
- Brass counts only hand-remaining tiles, never submitted ones
- Ivory pays at blind end only

`src/sim/` scenario: run the three balance predictions above and report the observed values.

## Documentation updates

- **GDD §1.1** mapping table: "Enhancement | 5 tile materials" → **8**, listing the new three
- **GDD §2** design note: "5×5 = 25 combinations" → **8×5 = 40**
- **GDD §2.2** table: add the three rows; replace every "(TBD)" with the effects above
- **GDD §14** open issues: drop "Material effects", note that fonts remain open and **own retrigger**

## Out of scope

- **Font effects (all 5).** Still undefined; a separate spec. Retrigger is reserved for them.
- **Kiln / Fountain Pen consumables.** ID strings only (`types.ts:262`), unimplemented. Materials
  already enter play through packs (`packs.ts:44-50`), so they are not needed here — but `packs.ts`
  must add the three new materials to its `MATERIALS` pool.
- **Jokers #29 Alchemist / #30 Calligrapher.** Not built. Their counters
  (`RunStats.enhancedTilesUsed`, `nonBaseFontTilesUsed`, `types.ts:222-223`) are initialized in
  `run.ts:24-25` and **never incremented** — wire them when those jokers are built.
