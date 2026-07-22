# Hard-locked YELLOW first-blind lesson — design (2026-07-21)

## Goal

Turn the first-ever tutorial blind into a scripted, **hard-locked** lesson that teaches
word **combination**, **submission**, and the **Palette** (chromatic unlock) by forcing the
player to build and submit **YELLOW**. Solves "YELLOW is too hard to make" by rigging the
opening hand to contain its letters.

Replaces the current passive 7-step `GuidedIntro` coach-mark tour.

## Facts (verified)

- `YELLOW` is a valid dictionary word (suit `standard`), so playing it fires the chromatic
  unlock (palette). Letter chips: Y4+E1+L1+L1+O1+W4 = **12** (+ a Twin letter-hand bonus for
  the two L's), suit ×1.0.
- Bag has the letters (Y2 E6 L2 O4 W2); YELLOW needs Y1 E1 L2 O1 W1.
- `startBlind` (loop.ts) shuffles `run.bag` and deals `handSize` (11). `StartBlindOptions`
  already has `target`.
- Intro currently opens when `phase==='playing' && !hasSeenIntro() && readTips()` (RunView);
  advance is via Next only, never gated on actions.
- Word building: clicking a hand tile calls `g.toggleTile(id)`, appending to `selected`
  (order = click order). `g.playWord()` submits `selected`. StagePanel renders the hand,
  `.play-btn`, sort buttons, and `.discard-btn`.

## Decisions (from brainstorming)

- **Hard lock** the board to the YELLOW path (not a soft nudge).
- **Rebuild** the tour around YELLOW (not keep + insert).
- Keep YELLOW (rig the hand); do not swap for an easier color word.
- Keep a **Skip** on the coach-mark as an accessibility escape (releases the lock).
- Tutorial-only: gated on `!hasSeenIntro() && readTips()`.

## Architecture

### 1. Rig the opening hand (engine, generic option)

`StartBlindOptions.openingLetters?: Letter[]` in `loop.ts`. When set, `startBlind` pulls one
bag tile per requested letter to the FRONT of the opening hand (in order), then fills the rest
randomly up to `effHandSize`. Missing letters are skipped (defensive). Engine stays generic —
it just "deals these letters first"; the UI decides when to use it.

### 2. useGame: rig only the tutorial run

`bootstrap` / `startRun` decide `isTutorial = !hasSeenIntro() && readTips()` (UI layer, reads
localStorage). When tutorial, call `startBlind(run, rng, { bossId, openingLetters: TUTORIAL_WORD.split('') })`.
- `TUTORIAL_WORD = 'YELLOW'`.
- **Superseded 2026-07-22:** the target is no longer lowered. `TUTORIAL_TARGET`=10 was retired — the tutorial blind keeps the normal ante-1 target (100). Submitting YELLOW (~12) ends the lesson and unlocks the board; the player then plays on to clear.
- Non-tutorial runs are unchanged (random hand, ante-curve target).

### 3. Hard lock (`StagePanel`)

RunView passes `lockWord?: string` to StagePanel — set to `'YELLOW'` while `introOpen` on the
tutorial blind, else undefined. When `lockWord` is set, StagePanel:
- Computes `nextLetter` from `selected` progress vs `lockWord`. Only the hand tile whose letter
  === `nextLetter` (first match) is enabled; all other hand tiles get a disabled class and their
  click is a no-op.
- Staged tiles remain un-stageable (click to return to hand) so a misclick is recoverable.
- Sort buttons, discard button, and drag-reorder are disabled.
- Play button enabled only when `selected` maps to exactly `lockWord`.

Lock lives entirely in the UI (engine untouched). Pouch/Run-info remain reachable.

### 4. Rebuild the intro (interactive script)

`INTRO_STEPS` (tutorial.ts) becomes 3 steps, each with an `advance` mode:
1. `frame` — selector `.round-panel`, advance `'next'`.
2. `build` — selector `.hand`, advance `'staged'` (auto when `selected` spells the lock word).
3. `submit` — selector `.play-btn`, advance `'played'` (auto when a word is played).

`GuidedIntro` reads `g` (game state) to auto-advance: on `build`, advance when
`stagedWord(g) === 'YELLOW'`; on `submit`, advance when a play has happened (selected cleared /
`lastPlayed` set). The Next button only shows for `'next'` steps; gated steps show a hint instead.
`finish()` marks intro seen and closes (releasing the lock). Skip = finish early.

On submit: the existing pipeline scores YELLOW, `ChromaticReveal` washes the yellow palette in
(the palette payoff), and the target-10 blind clears → Fee Settlement. No extra "palette" step —
the reveal is the teaching moment.

### 5. Copy (i18n)

New `intro.step.frame/build/submit.{title,body}` in en/ko. Retire the old
`world/hand/score/target/discard/tray/clear` step strings. Keep `intro.next/skip/done` and add a
gated-step hint string (e.g. `intro.hint.build`, `intro.hint.submit`) shown where Next would be.

## Out of scope (YAGNI)

- No re-teaching of discard/sort/target as passive steps (dropped with the rebuild; can return as
  encounters later).
- No change to non-tutorial runs.
- No new palette/Collection screen tour — the wash + reveal teach the concept.

## Testing

- Engine unit (`startBlind` with `openingLetters`): the opening hand begins with exactly those
  letters, in order, then fills to hand size; missing-letter is skipped safely.
- Lock logic unit (pure helper): `nextLetter(selectedLetters, 'YELLOW')` returns Y→E→L→L→O→W and
  `null` when complete; `stagedWord` maps selected ids to the word.
- Visual: fresh profile → first blind deals YELLOW letters; only Y is clickable, then E…; sort/
  discard disabled; Play lights only at YELLOW; submit → yellow wash → clears.
