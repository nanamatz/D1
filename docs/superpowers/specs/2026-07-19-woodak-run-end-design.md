# WooDak (우땅) Run-End Mascot + Victory State — Design

Date: 2026-07-19
Status: approved (design), pending implementation

## Goal

Two coupled features:

1. **Victory state.** Clearing the final chapter's Deadline (`BALANCE.runAntes` = 8)
   currently just advances to a broken chapter 9 (`anteBaseTargets[8]` is
   undefined). Make it end the run as a **win**, shown on the run-end screen.
2. **우땅 (WooDak)**, the orangutan helper mascot (`docs/WooDak.png`, 1024×1054,
   transparent), appears on the run-end screen (win AND loss) with a speech
   bubble: a contextual tip or a mention of this run's new discoveries. In the
   game's fiction he is the player's ally — an editor-mentor figure (vs. 삐약이
   the shop proprietor). Long-term he will host tutorials and notifications;
   this ships his first appearance.

## Endless mode (planned, NOT in scope — design around it)

After all chapters are cleared, a future **endless mode** lets the player
continue record-chasing chapters: the victory modal will gain an
"무한 모드 →" button routing into the normal Fee Settlement → shop flow and
onward play. Nothing of that ships now, but this design must not block it:

- The engine still computes earnings + the advanced run (chapter 9) on the
  final-boss clear; the UI simply doesn't consume them yet.
- The victory UI is a modal with an action row; the endless button will slot
  into `go-actions` later and reuse the existing cashout path
  (`confirmCashout`).
- Endless target formula for ante > 8 is future work (with that button).

## Engine change (one field)

`resolveBlind` (src/engine/progression.ts) gains `won: boolean` on
`BlindOutcome`: true iff `cleared` and the resolved blind was the final
chapter's boss (`run.ante === BALANCE.runAntes && run.blindIndex === 2`, read
from the pre-advance run). Earnings and the advanced run are still returned
unchanged (endless-ready). Win detection is a game rule, so it lives in the
engine where `src/sim/` can see it too.

## UI flow (useGame.finalize)

In the `outcome.cleared` branch: if `outcome.won`, route to phase
`'gameover'` with the existing snapshot shape plus `won: true` — skipping Fee
Settlement and the shop. `GameOverInfo` gains `won: boolean`. On a loss the
snapshot carries `won: false`. No new phase; the settle-signal gating
invariant (CLAUDE.md) is untouched because the win path rides the same
`finalize` that is already gated.

Old saves whose `gameover` snapshot lacks `won` read as falsy (= loss);
that state was never resumable anyway (`canContinue` excludes `gameover`), so
no persist version bump.

Lifetime stats recording (`recordRunEnd`) already keys on the snapshot and
keeps working for wins as-is.

## Run-end screen (GameOver.tsx, two framings)

Shared: stats panel, seed panel, action buttons (New Run / Main Menu).
Branch on `gameover.won`:

- **Loss (unchanged):** title `gameover.title`, defeat panel (defeatedBy /
  reached / score).
- **Win:** title `gameover.wonTitle` — publishing frame, e.g. ko "출간 완료!" /
  en "Published!" — and the top panel shows the completed-run record instead:
  final chapter cleared (boss name + emoji) and final score vs target
  (`gameover.wonRecord`, `gameover.score` reused). Distinct gold/celebratory
  accent class (`go-won`) on the card.

## 우땅 component (WooDakMascot.tsx)

Rendered by `GameOver.tsx` beside the overlay card (outside the card, anchored
to its left on wide layouts; hidden ≤720px like 삐약이). Asset shipped as
`src/ui/assets/woodak.png`.

**Line selection (priority, evaluated once on mount):**

1. `stats.discoveries > 0` → discovery line with the count
   (`woodak.discovery`, `{n}` interpolated).
2. Stat-based tips, first match wins:
   - `stats.rerollsUsed === 0` → reroll tip (`woodak.tip.reroll`)
   - `stats.tilesDiscarded === 0` → discard tip (`woodak.tip.discard`)
   - `stats.itemsBought === 0` → shop tip (`woodak.tip.shop`)
3. Fallback: random from a generic strategy-tip pool
   (`woodak.tip.0`–`woodak.tip.4`, 5 lines, `Math.random` — UI cosmetic).

On a **win**, a congratulation sentence (`woodak.won`) is prepended to the
chosen line in the same bubble.

**Voice:** warm mentor; Korean sentence-final tic "~우땅"
(e.g. "다음 원고는 더 잘 풀릴 거다우땅."), English plain warm tone.
All strings in `locales/ko.json` + `en.json` (GDD §1.2).

## Rendering / CSS

Single sprite → single-sprite CSS idle like 삐약이: the existing
`.mascot` / `.mascot-bubble` / `mascotBreathe` / `bubblePop` block in
`screens.css` is already generically named — reuse it verbatim, with a small
placement wrapper (`.go-mascot`) for the run-end positioning and a gentle
sway variant (`woodakSway`: ±1deg rotate on a slow loop, layered via a
wrapper so it composes with the breathe squash). `image-rendering: pixelated`,
display width ~150px. `prefers-reduced-motion` + `body.force-reduced-motion`
freeze everything (already covered by the shared block + global rule).

## Docs to update in the same change

- `docs/GDD.md`: §8.2 area — victory rule (clearing chapter `runAntes`'s
  Deadline wins the run) + endless mode recorded as planned/deferred with the
  modal-button flow; §1.2 art note — 우땅 named as the ally/mentor mascot
  (art: `docs/WooDak.png`).
- `docs/screens-spec.md` §2.7 — becomes the run-end screen (win/loss
  framings), 우땅 bullet (placement, line priority, future roles:
  tutorial/notifications), future endless button noted.
- `docs/UI_DESIGN.md` — short §6.1 companion note for 우땅 (idle = shared
  single-sprite breathe + sway; bubble reuses pixel grammar).

## Testing

- Engine: unit test `resolveBlind` returns `won` on ante-8 boss clear, not on
  ante-8 big blind or ante-7 boss, and that earnings/advanced run still come
  back (tests/, slice-5 file or a new `slice5-win.test.ts`).
- UI: verify in the running app (project verify skill): force a near-end save
  (localStorage `wj.run` with ante 8, blindIndex 2) or play with a low-target
  edit — observe victory modal + 우땅; loss path: fail a blind → 우땅 with
  tip/discovery line; reduced-motion + ≤720px behavior.
