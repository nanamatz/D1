# Sentence-Bonus Landing — Design

**Date:** 2026-07-22
**Status:** Approved (design), pending implementation plan

## Problem

At blind end the sentence bonus fills `box.c` / `box.m` (chips × mult) **at the same
time** the round number rolls to its finalized value. Because the box-fill and the
round-roll overlap, the player never sees the sentence bonus as *the final additive
step* — it reads as "the score was already computed" rather than "the pattern's bonus
is being applied now." The pattern's **level** is not surfaced at all, so the chips/mult
being level-scaled is invisible.

## Goal

Make the final sentence-bonus beat a distinct, legible climax:

1. It is clearly the **sentence bonus** — the pattern name **and its current level** are shown.
2. The bonus's **chips and mult (level-scaled) visibly climb** in the scorebox.
3. The bonus is then **seen being added** to the round total (box fills first, *then* the
   round number rolls up — sequential, not simultaneous).

This is consistent with the docs: the round number still only ever rolls **up** with one
eased count-up, and at blind end it eases onto the finalized score (`CLAUDE.md`:
"Displayed round score = committed only"). The sentence bonus is folded into the round
number **only at blind end**, which is exactly this beat — no change to the during-play
"separate forecast" rule.

## Choreography (blind end)

Fixed climax timing (this is the *bonus land*, not the variable settle — a fixed beat is
correct here, mirroring today's `BONUS_LAND_MS`). Game-speed scaling matches current
bonus-land behavior (unscaled); reduced-motion collapses to an instant fill.

1. **Last word's settle completes** → scorebox resets to idle `0 × 0` (unchanged).
2. **Build (~700ms, `BONUS_LAND_MS`):** the pattern badge `[ CHANT  Lv.2 ]` slams in;
   `box.c` counts `0 → 45` and `box.m` counts `0 → 3.5` together (single count-up each).
   **The round number holds at `committedScore`** — it does not move yet.
3. **Land (~700ms, `BONUS_LAND_MS`):** the box pulses once and a `+157` token floats
   toward the round readout; **the round number rolls `committed → finalScore`.**
4. **Verdict beat (`VERDICT_BEAT_MS` = 500ms)** → auto-resolve to Fee Settlement / Game
   Over (unchanged).

Reduced motion: show badge + final box + final round instantly, hold
`VERDICT_BEAT_REDUCED_MS`, then resolve.

The `+N` fly token in step 3 is **polish**; the sequential split (box builds, *then* round
rolls) is the core requirement and stands on its own if the token is dropped.

## Data flow

- `endBlind` already returns `sentenceChips` / `sentenceMult` (post joker/boss hooks) and
  `judgment.match.pattern`. No engine change to scoring.
- Add a **`level`** field to the UI's `sentenceBonus` object, read from
  `run.patternLevels[pattern] ?? 1`. The badge shows the pattern's punctuation level even
  when jokers/Chant-repeats have shifted the final chips/mult away from the base — the
  level describes the pattern, not the post-hook total.
- **Split the current single Stage-1 update.** Today `useGame` sets `sentenceBonus` **and**
  `finalScore` together, and the Sidebar animates both over one window. Instead:
  - **Build:** set `sentenceBonus` (with `level`), leave `finalScore = null`. The Sidebar's
    existing round target `finalScore ?? (settleComplete ? committedScore : committedBefore)`
    naturally holds the round at `committedScore` while `bonusActive` fills the box.
  - **Land:** after the build timer, set `finalScore`; the round's `useCountUp` rolls up.
  - If the bonus is 0 (no pattern, no unison) skip the build phase and set `finalScore`
    immediately — no bonus beat, round stays put (`finalScore === committedScore`).

## Files touched

- **`src/ui/useGame.ts`** — add `level` to `sentenceBonus`; split the blind-end landing
  into build → land timers (was one). New guard so the build effect fires once. Zero-bonus
  path goes straight to `finalScore`.
- **`src/ui/components/Sidebar.tsx`** — render the level in the `.bonus-stamp` badge; add
  the landing pulse + optional `+N` fly token; fall back to a generic "sentence bonus"
  label when `pattern` is null (unison-only).
- **`src/ui/styles/play.css`** — `.bonus-stamp` level sub-badge; `+N` fly + box-pulse
  keyframes.
- **`locales/ko.json`, `locales/en.json`** — `Lv.{n}` label; unison-only bonus label.

## Edge cases

- **Unison only (no pattern match):** badge shows the generic sentence-bonus / unison
  label, no level. Chips/mult still climb.
- **Zero bonus:** no build phase; round holds at committed (no visible move).
- **Chant repeats / joker-modified totals:** badge level = the pattern's punctuation level
  (`run.patternLevels`), independent of the post-hook chips/mult shown in the box.
- **Reduced motion:** single instant frame, then verdict beat.

## Non-goals

- No change to how the bonus is *computed* (`finalizeScore` / `scoreSentence` untouched).
- No per-contribution breakdown in the box (pattern base / +15 modifiers / unison are
  folded into one chips count-up and one mult count-up — decided during brainstorming).
- No change to the during-play forecast behavior.
