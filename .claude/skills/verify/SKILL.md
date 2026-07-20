---
name: verify
description: Build/launch/drive recipe for verifying UI changes in the running game
---

# Verifying UI changes in the running app

## Launch

- `npm run dev` (background). Port 5173 is often taken by the user's own server — read the Vite banner for the actual port (e.g. 5174).
- Playwright is NOT a repo dependency. Install it in the session scratchpad (`npm init -y && npm i playwright && npx playwright install chromium`) and drive `http://localhost:<port>` from a script there.

## Drive

- Fresh run: `localStorage.clear()` + reload. Locale: `localStorage.setItem('wj.lang', JSON.stringify('ko'))` (default en). Run save key: `wj.run` — a reload + New Run screen → "Continue run"(런 이어하기) resumes mid-run (works even in the shop phase).
- Menu path: button "Play" (exact — "Play word" also exists) → New Run screen button "Play" → `.bs-select` (blind select) → play screen.
- **Tiles animate constantly** — Playwright's stability check times out; click them with `{ force: true }`. Tiles are `[data-tile-id]`, letter readable from `aria-label` (`"B tile, 3 chips"`).
- To clear a blind: spell words from `data/dictionary.txt` using hand letters, click `.play-btn`, wait for `.cashout` (Fee Settlement) or the play button to re-enable. Ante-1 Draft target is 100 — one long word can clear it. Then `.cashout .btn.cash` → shop (`.shop2`).
- A working end-to-end script from 2026-07-18 (menu → play → shop → mascot checks incl. reduced-motion, narrow viewport, ko locale): see `verify-mascot.mjs` pattern — read hand letters, greedily pick the longest dictionary word, force-click tiles in order.

## Gotchas

- getByRole name matching is substring: Korean "이어하기" hits both the tab and the button — use the full label "런 이어하기".
- Screen transitions take ~600ms; sleep after each navigation click.
- `prefers-reduced-motion` via `page.emulateMedia({ reducedMotion: 'reduce' })`; the app also has `body.force-reduced-motion` from its own Options.
