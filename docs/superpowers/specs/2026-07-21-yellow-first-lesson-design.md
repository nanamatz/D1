# Hard-locked YELLOW first-blind lesson — design (2026-07-21)

## Goal

Turn the first-ever tutorial blind into a scripted, **hard-locked** lesson that teaches
**discarding**, word **combination**, **submission**, and the **Palette** (chromatic unlock).
The opening hand contains **YELLOW** plus a safe spare: the player marks and discards that spare,
then builds and submits YELLOW.

Replaces the current passive 7-step `GuidedIntro` coach-mark tour.

## Facts (verified)

- `YELLOW` is a valid dictionary word (suit `standard`), so playing it fires the chromatic
  unlock (palette). Letter chips: Y12+E3+L3+L3+O3+W12 = **36** (+ a Twin letter-hand bonus for
  the two L's), suit ×1.0.
- Bag has the letters (Y2 E6 L2 O4 W2); YELLOW needs Y1 E1 L2 O1 W1.
- `startBlind` (loop.ts) shuffles `run.bag` and deals `handSize` (10). `StartBlindOptions`
  already has `target`.
- Intro opens on the tutorial-rigged playing board while unseen and Tips are enabled. The frame
  step advances with Next; discard/build/submit auto-advance only after their successful actions.
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
- **Superseded 2026-07-22:** the target is no longer lowered. `TUTORIAL_TARGET`=10 was retired — the tutorial blind keeps the normal ante-1 target (300). Submitting YELLOW (252) ends the lesson and unlocks the board; the player then plays on to clear.
- Non-tutorial runs are unchanged (random hand, ante-curve target).

### 3. Hard lock (`StagePanel`)

RunView passes UI-only tutorial lock metadata to StagePanel while `introOpen`. It snapshots the
first six physical IDs as YELLOW and opening-order index 6 as the sole safe spare. StagePanel:
- During discard, permits only that spare's right-click mark/unmark and the existing red Discard
  button. A mark alone does not advance; the ordinary successful `g.discard`/`discardTiles`
  result does, spending one budget and refilling from the seeded bag.
- During build, enables only the next exact protected physical ID in Y→E→L→L→O→W.
- During build, only the latest staged physical ID may return to hand, preserving the exact
  YELLOW prefix while allowing the player to undo the last choice.
- Sort, drag, Play, unrelated staging/marks, and discard outside its named step are disabled.
- Play button enabled only when `selected` maps to exactly `TUTORIAL_WORD`.
- A persisted prior discard, missing spare, or zero budget falls through to build without a
  duplicate charge or softlock. Skip releases the lock and clears a local uncommitted mark.

Lock lives entirely in the UI (engine untouched). Pouch/Run-info remain reachable.

### 4. Rebuild the intro (interactive script)

`INTRO_STEPS` (tutorial.ts) becomes 4 steps, each with an `advance` mode:
1. `frame` — selector `.round-panel`, advance `'next'`.
2. `discard` — selector `.stage`, advance `'discarded'` (auto only after the target enters
   `discardedThisBlind`).
3. `build` — selector `.hand`, advance `'staged'` (auto when `selected` spells the lock word).
4. `submit` — selector `.play-btn`, advance `'played'` (auto when a word is played).

`GuidedIntro` reads `g` (game state) to auto-advance: on `build`, advance when
`stagedWord(g) === 'YELLOW'`; on `submit`, advance when a play has happened (selected cleared /
`lastPlayed` set). The Next button only shows for `'next'` steps; gated steps show a hint instead.
`finish()` marks intro seen and closes (releasing the lock). Skip = finish early.

On submit, the existing pipeline scores YELLOW at 252 and `ChromaticReveal` washes the yellow
palette in. The 300 target remains uncleared, so the board unlocks and ordinary play continues.

### 5. Copy (i18n)

New `intro.step.frame/discard/build/submit.{title,body}` in en/ko. Retire the old
`world/hand/score/target/discard/tray/clear` step strings. Keep `intro.next/skip/done` and add a
gated-step hint string (`intro.hint.discard/build/submit`) shown where Next would be.

## Out of scope (YAGNI)

- No sort or target steps; discard reuses the ordinary mark-then-button path without free use,
  refund, new engine event, run field, save key, or version.
- No change to non-tutorial runs.
- No new palette/Collection screen tour — the wash + reveal teach the concept.

## Testing

- Engine unit (`startBlind` with `openingLetters`): the opening hand begins with exactly those
  letters, in order, then fills to hand size; missing-letter is skipped safely.
- Discard unit: index 6 exists, a real discard preserves the six YELLOW IDs and full hand,
  spends one budget, records one discarded tile, and returns the same replacement for the same seed.
- Lock logic unit (pure helper): `nextLetter(selectedLetters, 'YELLOW')` returns Y→E→L→L→O→W and
  `null` when complete; `stagedWord` maps selected ids to the word.
- Visual: fresh profile → first blind deals YELLOW plus spares; only the seventh tile can be
  right-click marked, Discard commits it, then only Y is clickable, then E…; sort/drag stay
  disabled; Play lights only at YELLOW; submit → yellow wash → board unlocks at 252/300.
