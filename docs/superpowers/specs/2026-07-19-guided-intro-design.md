# Guided first-run intro (A-1) — design

Date: 2026-07-19. Approved in-session ("패시브 워크스루 방식으로 일단 해보자").
Work order: `docs/feature-01-tutorial-sound-fontseals.md` §A-1. Second slice of Work Order A
(A-2 popups + A-3 Help already shipped).

## Goal

On a player's first run, a 6-step guided walkthrough introduces the core loop — each step
spotlights one play-screen control and 우땅 (WooDak) explains it. Passive (read-through):
no step requires performing the action, so it can never soft-lock. Skippable up front and
per step; re-playable from Options → Help.

## Design

### Approach — passive coach-mark walkthrough
A full-screen overlay dims the board and spotlights the current step's target element; a
WooDak speech bubble shows the copy with **Next** and **Skip tutorial**. "Next" advances the
step; the last step / Skip closes and marks the intro seen. The overlay blocks board clicks
(so nothing is fumbled), but advancing is always via the bubble button — never gated on the
player actually doing the action.

### Spotlight mechanic
The overlay is a fixed full-screen div (`pointer-events: auto`, transparent — it catches and
swallows board clicks). Inside it, a **highlight box** positioned at the target's
`getBoundingClientRect()` (+ a few px padding) draws the dim with `box-shadow: 0 0 0 9999px
rgba(0,0,0,.6)` and a bright ring; `pointer-events: none` so it's purely visual. The bubble
is positioned below the target (or above if there's no room). Rect is measured in a
`useLayoutEffect` keyed on the step index and re-measured on window resize. If a target
selector misses (element not mounted), the step falls back to a centered bubble with no
spotlight (never blocks progress).

### Steps (6) — anchored by existing stable selectors
| # | selector | teaches |
|---|---|---|
| 1 | `.hand` | spell a word — click hand tiles to stage them |
| 2 | `.score-panel` | submitting settles the word as chips × mult |
| 3 | `.bs-target` | reach the target score; committed climbs as you play |
| 4 | `.discard-btn` | stuck? right-click hand tiles then Discard (limited per blind) |
| 5 | `.tray` | your words line up into a sentence — finish a pattern for a bonus |
| 6 | `.round-panel` | clear the target and the blind auto-settles — good luck |

(All selectors verified present in the play screen: StagePanel `.hand`/`.discard-btn`,
Sidebar `.score-panel`/`.bs-target`/`.round-panel`, SentenceTray `.tray`.)

### First-run detection + store
`tutorial.ts` gains an intro flag (separate from encounter seen-flags): `hasSeenIntro()`,
`markIntroSeen()`, `resetIntro()` backed by a `wj.tutorialIntro` localStorage key
(try/catch-guarded, like the rest). The intro triggers when the play board first mounts
(RunView, `phase === 'playing'`) AND `!hasSeenIntro()` AND `readTips()` is on (tips-off opts
out of the intro too, consistent with the popup layer).

### Guide character — WooDak
Reuses `src/ui/assets/woodak.png` + the `.mascot`/`.mascot-bubble` grammar (already used by
`WooDakMascot`). WooDak sits beside the bubble. Reduced-motion respected (no bubble bounce).

### Re-play from Help (A-3 tie-in)
Options → Help gains a **"Replay tutorial"** button that calls `resetIntro()` and shows a
short confirmation toast; the walkthrough then re-plays the next time the player enters the
play screen (avoids cross-screen intro launching).

### Copy
i18n single source: `intro.step.<n>.title` / `intro.step.<n>.body` (1–6, ko/en) + `intro.next`,
`intro.skip`, `intro.done`, `help.replayIntro` (+ toast). Body may use richtext `[c:]/[m:]/[b:]`.

## Out of scope (later)
- Interactive gating (requiring the player to perform each action).
- Layer-2 encounter triggers beyond the 4 already wired; per-boss encounters.

## Testing
- `tutorial.ts` intro flag: unit tests (hasSeenIntro/markIntroSeen/resetIntro roundtrip).
- Copy: coverage test (all 6 steps have title+body both locales).
- Walkthrough behavior: in-app Playwright smoke (fresh profile → intro auto-opens on first
  play; Next advances through 6; spotlight rect tracks; Skip closes + marks seen; second run
  → no intro; Help "Replay tutorial" → intro re-plays next entry; tips-off → no intro).
