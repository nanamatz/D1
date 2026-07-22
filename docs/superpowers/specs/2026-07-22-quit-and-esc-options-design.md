# Quit button + reachable Options menu (Shop / Blind Select) — Design

**Date:** 2026-07-22
**Status:** Approved

## Problem

1. The Main Menu has no "Quit" button (it was hidden on web).
2. In-run, the Options/pause menu (with "Main Menu") is only reachable on the
   **playing** board — via the Sidebar gear and ESC. On the **Shop** and
   **Blind Select** screens there is no way to open Options, so the player
   cannot return to the main menu from there.

## Goals

- Add a **Quit** button to the Main Menu that works on a web build.
- Let the player open the Options/pause menu from the **Shop** and **Blind
  Select** screens, both via **ESC** and via a **visible options button**.

Non-goals: touching cashout/gameover (they have their own controls); a gear
button on the board (the Sidebar already has one); any engine changes.

## Design

### A. Main Menu "Quit"

- **i18n** (`locales/en.json`, `locales/ko.json`): `menu.quit`
  (`"Quit"` / `"게임 종료"`), plus a farewell overlay's `menu.quitTitle` and
  `menu.quitBody`.
- **`MainMenu.tsx`**: render a Quit button after Collection (no longer hidden on
  web). On click:
  1. attempt `window.close()` — succeeds in a script-opened window or a desktop
     app shell;
  2. set a local `quit` boolean that renders a full-screen **farewell overlay**
     ("Thanks for playing!"), so the game ends cleanly even when the browser
     blocks `window.close()`.
- Farewell state is local to `MainMenu` (a full screen already); no App-level
  routing change.

### B. ESC → Options on Shop / Blind Select

- **`RunView.tsx`** ESC handler: relax the `if (phase !== 'playing') return`
  gate to allow `playing | shop | blindselect`. The `showInfo` peel is
  board-only (Run Info doesn't exist elsewhere, so `showInfo` is always false
  there) and stays correct.
- **Hoist the pause overlay** out of the board JSX to the `RunView` root, as a
  sibling of `ScreenTransition`, gated on
  `paused && phase ∈ {playing, shop, blindselect}`. `.overlay` is
  `position: fixed; inset: 0` (screens.css:1580), so it covers the viewport
  regardless of tree position. Remove the old in-board pause block to avoid a
  duplicate.

### C. Visible options button on Shop / Blind Select

- **Board**: unchanged — the Sidebar's existing options button stays.
- **Shop / Blind Select**: render a fixed top-right gear button
  (`.options-fab`, `⚙` + existing `sidebar.options` label) at the `RunView`
  level, only when `phase ∈ {shop, blindselect}`. `onClick` → `setPaused(true)`.
  The Shop and BlindSelect components are not modified.
- **CSS**: one new `.options-fab` rule (`position: absolute; top/right;
  z-index` above the screen content, below the `.overlay` at z 50/60).

## Testing

Manual (per the `verify` skill): from Shop and from Blind Select, ESC and the
gear button both open Options; "Main Menu" returns to the menu with the run
intact (useGame lives in App). Main Menu Quit shows the farewell overlay.
Typecheck/build clean.
