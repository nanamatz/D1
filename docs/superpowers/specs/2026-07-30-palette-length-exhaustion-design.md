# Palette scope, hand exhaustion, word-length multiplier, emoji-art chroma sync

**Date:** 2026-07-30
**Status:** approved design, pending implementation plan

Four independent changes, batched because they were requested together. Items ①,
②, ④ are self-contained. Item ③ (word-length multiplier) changes the core scoring
formula and therefore forces a target-curve re-tune in the same change.

---

## ① Language leaves the chromatic-unlock system

**Decision.** Korean is no longer a chromatic unlock. The language switch is
already ungated (`i18n.tsx` reads `wj.lang` with no unlock check), so the
`KOREAN` row was cosmetic — a Collection entry and a celebration card for
something the player already had.

**Changes.**

- `src/ui/unlocks.ts` — delete the `KOREAN` row from `UNLOCKS`; delete
  `{ kind: 'locale'; lang: 'ko' }` from the `UnlockEffect` union.
- `src/ui/components/Collection.tsx` — delete the `{ key: 'locale', kind: 'locale' }`
  row (line ~573) and the `'unlock.body.korean'` branch (line ~587).
- `src/ui/components/ChromaticReveal.tsx` — delete the `case 'locale'` branch.
- `src/ui/components/GameOver.tsx` — delete the `'가'` glyph branch.
- `locales/en.json`, `locales/ko.json` — delete `unlock.body.korean` and any
  `KOREAN`-specific title/voice rows.
- `docs/GDD.md` §13 — remove the language row from the unlock table.

**Migration:** none. An existing profile's `wj.unlocks` may contain the string
`'KOREAN'`; it becomes an orphan id that no lookup matches. Harmless — the set is
only ever read through `activeUnlocks` / `isPlayed(id)`.

**Side effect:** the Collection's unlock total drops 11 → 10. Progress readouts
derive from `UNLOCKS.length`, so no separate edit.

---

## ② Empty hand + empty pouch ends the blind

**Problem.** A blind ends only on `phasesUsed >= phasesTotal` or
`projectedScore >= target` (`useGame.ts:1218`). The pouch never refills mid-blind
(GDD §6.6) and discarded tiles exit play for the blind (§6.3), so a player can
reach zero tiles in hand with phases still remaining — an unresolvable board.

**Decision.** Zero tiles in hand **AND** zero tiles in the pouch ends the blind
through the normal path. It does *not* short-circuit to Game Over.

Both conditions are required because a boss `handSizeDelta` could in principle
leave the hand momentarily empty while the pouch still holds tiles.

**Why the normal path, not an immediate Game Over.** `blind.projectedScore`
already includes the sentence bonus, and `autoSettle` fires on it. So reaching
exhaustion without `autoSettle` having fired means `projected < target`, and
`finalize` → `resolveBlind` will judge a loss anyway. Routing through
`pendingEnd` reuses the settle-complete gate, the sentence-finalize animation and
the existing Game Over screen; a separate immediate-loss path would duplicate all
of it and violate the "clear UI is gated on the settle-complete SIGNAL" invariant
(CLAUDE.md).

**Changes.**

- `src/engine/loop.ts` — export a predicate:
  ```ts
  /** No tiles in hand and none left to draw (§6.3, §6.6): the board cannot be
   *  played further, so the blind must resolve. */
  export function blindExhausted(blind: BlindState): boolean {
    return blind.hand.length === 0 && blind.bag.length === 0;
  }
  ```
- `src/ui/useGame.ts` `playWord` — add `blindExhausted(blind)` to the
  `pendingEnd` condition beside `phasesOut` and `autoSettle`.
- `src/ui/useGame.ts` `discard` — same check on the post-discard blind. This is
  the reachable case: discarding the whole hand with a dry pouch.

Both call sites go through the one predicate — the fix lives where every caller
routes, not per path.

**Tests.** `tests/` — (a) submitting the last playable word with a dry pouch sets
`pendingEnd`; (b) discarding the whole hand with a dry pouch sets `pendingEnd`;
(c) `resolveBlind` on that state with `finalScore < target` returns
`cleared: false`.

---

## ③ Word length adds to Mult

**Decision.** `mult += tiles.length × BALANCE.wordLength.multPerLetter`, with
`multPerLetter: 1`. Valid words only.

```
score = chips × (suitMult + length × multPerLetter)
```

Additive, not multiplicative (`chips × suitMult × length`), so the suit
multiplier keeps its weight instead of being swamped, and the curve stays
Balatro-shaped. Length already pays through chips (more tiles, more chips) and
through the Longword letter hand (§5.5, 7+, +30 chips); those stay — one is a
Chips bonus, the new rule is a Mult bonus, so they are not duplicates.

**Gibberish is excluded.** GDD §6.4 pays gibberish `letter chips × 1.0` with no
suit multiplier; the length multiplier is likewise withheld. Otherwise dumping
eight random tiles becomes a competitive play and the dictionary stops mattering.

**Single source of truth.** A new helper in `src/engine/scoring.ts`:

```ts
/** Mult added for word length (GDD §3.1). Gibberish is excluded (§6.4). */
export function wordLengthMult(tiles: readonly Tile[], isGibberish: boolean): number {
  return isGibberish ? 0 : tiles.length * BALANCE.wordLength.multPerLetter;
}
```

Called by every path that scores or ranks a word:

- `scoring.ts` `scoreWord` — the no-joker reference path.
- `loop.ts` `scoreSubmission` — the live pipeline.
- `engine/hint.ts` — candidate ranking. Without this the hint recommends the
  wrong word.

`baseScore` stays pure (suit multiplier only) — the length bonus is a pipeline
beat, not part of the lexicon lookup result.

**Presentation.** A new score event, pushed immediately after the existing `suit`
event in `scoreSubmission` — before held materials and before the letter hand, so
the letter hand stacks on top:

```ts
| { kind: 'wordLength'; letters: number; multDelta: number }
```

`src/ui/settle.tsx`: add `'wordLength'` to the delta-folding branch alongside
`letterHand`/`joker`/`boss`/`material`, and render it as a stamp reusing the
existing `stamp.kind: 'letterHand'` styling (label from a new locale row, e.g.
`settle.wordLength` → "6 LETTERS" / "6글자"). No new CSS.

**Balance: the target curve must move in this change.**

`anteBaseTargets` is `[100, 300, 800, 2000, 5000, 11000, 20000, 35000]`. The new
rule multiplies a 3–6 letter word's effective mult by roughly 3–7×.

Concrete breakage, and the acceptance check for the re-tune: the guided intro
rigs the opening hand to YELLOW and relies on that word **not** clearing the
blind (CLAUDE.md, `docs/superpowers/specs/2026-07-21-yellow-first-lesson-design.md`).
YELLOW = Y12+E3+L3+L3+O3+W12 = **36 chips**, suit `standard` ×1.0. Today: 36 vs a
target of 100 — the lesson ends, the blind continues, as designed. Under the new
rule: 36 × (1.0 + 6) = **252** — the tutorial's first word clears ante 1.

(CLAUDE.md's parenthetical "submitting YELLOW (~12)" is stale — it predates the
letterChips ×3 feel pass. Correct it to ~36 in the same change.)

Procedure, following the `letterChips ×3` precedent:

1. Add `src/sim/length-mult.ts` modelled on `src/sim/feel-chip-scale.ts`
   (200 seeds per ante, greedy best-word autoplay), reporting per-ante clear rate
   before and after.
2. Pick new `anteBaseTargets` from that output, holding the shape the current
   curve produces — ante 1 near ~77% clear, antes 2–4 falling off.
3. Assert the tutorial constraint: ante-1 small target > a single YELLOW score
   under the new rule. Encode it as a test so a future re-tune cannot silently
   re-break the intro.

**Docs.** GDD §3.1 (formula), §5.5 (note that Longword is the Chips side and the
length multiplier the Mult side), §8.2 (new curve), CLAUDE.md (the stale YELLOW
number, plus the length rule in the easy-to-get-wrong list).

---

## ④ Raster object art tracks the palette unlocks

**Problem.** Emoji Tile art is a `<img class="joker-art">` inside `.frame`.
`:root.world-mono .frame { filter: grayscale(1) }` greys it while no colour is
unlocked, but `world-mono` drops the instant *any* colour unlocks — so a single
RED unlock reveals every hue in every PNG at once. The palette reveals
progressively; the art does not.

**Decision.** Gate the art's chroma per colour channel with one SVG
`feColorMatrix`, driven by the same active-unlock set. **Expanded 2026-08-28:**
the original Emoji-Tile-only limitation is superseded. Blind/Deadline emblems,
Editorial Perk Tags, Vouchers, Packs, Fable/Constellation/Gambler cards, and
Starting Pouch/Record art now use the same gate on ordinary surfaces. Locked,
boss-disabled, and Unlock Recap reward states remain authoritative overrides.

**Mapping.** Each colour group enables one or more RGB channels; the enabled set
is the union:

| unlock | channels |
|--------|----------|
| RED    | R |
| YELLOW | R, G |
| GREEN  | G |
| BLUE   | B |

**Matrix.** For each output channel `c` with gate `k_c ∈ {0, 1}`:

```
row_c = (1 - k_c) × [0.2126, 0.7152, 0.0722] + k_c × e_c
```

i.e. `out_c = lum + k_c × (c − lum)`. All gates 0 is exactly `grayscale(1)`; all
gates 1 is the identity. Luminance-preserving, so a locked hue lands on the same
grey `grayscale(1)` would give it — not black.

**Changes.**

- `src/ui/App.tsx` — one always-mounted hidden inline
  `<svg><filter id="unlock-chroma"><feColorMatrix type="matrix" …/></filter></svg>`.
- `src/ui/unlocks.ts` `applyPresentation` — compute the gates from the active set
  and write the filter's `values` attribute. Idempotent, same as the class
  toggles it already does.
- `src/ui/styles/play.css` / `screens.css` — raster object classes compose
  `url(#unlock-chroma)` with their existing shadows and state filters.
- `src/ui/components/FamilyCardArt.tsx` — one filtered inner SVG group preserves
  root-level hover, cast, result, and level-up filters.

No art rework. Composes correctly with `world-mono` — while no colour is
unlocked both paths produce full greyscale.

**Test.** A unit test on the matrix builder: empty set → the greyscale matrix;
all four groups → identity; `{RED}` → R row is `e_R`, G and B rows are the
luminance row.

---

## Out of scope

- Letter-tile material/font/edition CSS colors and score particles remain a
  separate semantic-token audit; they are not part of this raster-art slice.
- A `BALANCE.wordLength` curve table (rejected in favour of the flat additive
  rule; add one only if the sim shows the linear form misbehaving at length 8+).
- Migrating the orphan `'KOREAN'` id out of existing profiles.
