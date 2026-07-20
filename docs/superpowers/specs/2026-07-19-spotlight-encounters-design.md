# Spotlight-style encounter popups (joker/shop/boss) — design

Date: 2026-07-19. Approved in-session. Extends the tutorial system.

## Request
Make the joker / shop / boss encounter tutorials use the same **speech-bubble + spotlight**
presentation as the A-1 guided intro, instead of the centered modal card.

## Design

### 1. Extract `SpotlightBubble` (`src/ui/components/SpotlightBubble.tsx`)
Pull the spotlight+bubble mechanics out of `GuidedIntro` into a reusable component:
measure a target's `getBoundingClientRect()` (with the rAF + 120/360/650ms re-measure over
the screen transition + resize listener), draw the `box-shadow` spotlight (`.intro-spot`),
position the bubble below/above/centered, and wrap a mascot + bubble shell (reusing the
`.intro-overlay`/`.intro-spot`/`.intro-wrap`/`.mascot`/`.mascot-bubble` CSS).

```tsx
SpotlightBubble({ target: string; mascot?: 'piyak'|'woodak'; children: ReactNode })
```
- Owns overlay + spotlight + positioned wrap + mascot structure; `children` fill the bubble.
- Target missing → centered bubble (no spotlight), same as the intro fallback.
- No backdrop-click dismiss (dismiss only via the child's button) — uniform with the intro,
  avoids accidental dismiss.

`GuidedIntro` refactors to render its per-step content inside `<SpotlightBubble target={cur.selector}
mascot="woodak">…</SpotlightBubble>` — same behavior, now shared. (The in-app smoke re-verifies
the intro still works.)

### 2. Encounter `target?`
`tutorial.ts` `Encounter` gains `target?: string` (a CSS selector). Set:
- `firstJoker`  → `.jokers-col`        (the joker shelf column)
- `shopFirstVisit` → `.shop-sale-region` (the shop "For sale" area)
- `firstBoss`   → `.bosseff`           (the boss effect in the sidebar)

Also give `firstJoker` `mascot: 'woodak'` (mentor explaining jokers), so all three carry a
mascot (shop=piyak, boss=woodak already).

### 3. TutorialHost branch
When the active encounter has a `target`, render it via `SpotlightBubble` (spotlight + bubble +
mascot + a single "Got it" button that dismisses) instead of the centered `.tut-card`. Encounters
without a `target` keep the centered card. The queue, `readTips()`/`hasSeen` gates, microtask
defer, and reduced-motion handling are all preserved.

### 4. Anchor availability
- `firstJoker`/`firstBoss` fire on a playing blind → `.jokers-col`/`.bosseff` live in the play
  board; TutorialHost (App-level) measures them via `document.querySelector` (viewport rect), and
  the re-measure handles the screen-transition slide (same as the intro).
- `shopFirstVisit` fires on the shop screen → `.shop-sale-region` lives in Shop.tsx; same measure.
- No collision with the A-1 intro: on blind 1 the intro opens but the run starts empty (no joker)
  and blind 1 is 'small' (not boss), so firstJoker/firstBoss can't co-fire with the intro.

## Out of scope
The other ~11 encounters keep the centered card (no clear single anchor). Interactive gating.

## Testing
- No new unit tests (DOM/measurement). Existing registry/copy tests still pass (target/mascot are
  optional fields).
- In-app Playwright smoke: (a) the A-1 intro still spotlights + advances (regression); (b) firstJoker
  shows a spotlight on the joker shelf with a bubble (WooDak); (c) shopFirstVisit spotlights the sale
  region with Piyak; (d) firstBoss spotlights the sidebar boss effect with WooDak; (e) a non-targeted
  encounter (e.g. firstPack) still shows the centered card; (f) tips-off suppresses; zero console errors.
