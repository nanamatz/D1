# Tutorial extension — Piyak shop intro, joker/consumable/boss encounters, empty start

Date: 2026-07-19. Approved in-session. Extends the shipped tutorial system (A-2/A-3 + A-1).

## Requests (from the user)
1. The first-shop-visit tutorial should feel like **삐약이 (Piyak)** explaining it (mascot in the card).
2. Add tutorial explainers for **joker tiles** and **consumables**, shown on the **blind where the
   player first owns one**.
3. On the **first boss blind**, a generic awareness popup: "this round has a constraint (debuff) —
   read it," narrated by **우땅 (WooDak, mentor)**. Not per-boss.
4. Consequence of (2): the run currently starts with demo jokers + a magnifier, so "first owned" is
   never a real moment. **Change the run to start empty** (no starting jokers, no starting
   consumables) unless a bag/deck effect grants them (none today).

## Design

### 1. Empty starting inventory
`src/ui/useGame.ts` `bootstrap()` currently does `equip(newRun(seed), STARTING_JOKERS)` +
`consumables: ['magnifier']`. Change it to use `newRun(seed)` directly — the engine's `newRun`
already initializes `jokers: []` / `consumables: []`. Remove the now-unused `STARTING_JOKERS`
const and the magnifier line (and `equip` if it becomes unused). This is a gameplay change: no
jokers/consumables until acquired in the shop. GDD does not specify a starting inventory (the
magnifier line was a placeholder — "economy in a later slice"), so no doc conflict; note it in the
ledger + a code comment.

### 2. Mascot on encounters + Piyak/WooDak in the card
`tutorial.ts` `Encounter` gains `mascot?: 'piyak' | 'woodak'`. `TutorialPopup` renders the mascot
portrait (piyak.png / woodak.png, reusing the `.mascot`/`.mascot-cat` grammar) inside the card when
present. `shopFirstVisit.mascot = 'piyak'`; `firstBoss.mascot = 'woodak'`. Other encounters stay
plain (icon only).

### 3. New `firstBoss` encounter
Registry gains `{ id: 'firstBoss', group: 'run', icon: '👑', mascot: 'woodak' }` → registry is now
14. Copy `tutorial.firstBoss.title/.body` (ko/en): generic — "This is a boss round; it carries a
constraint (a debuff). Check the sidebar for what it does — plan around it." References the sidebar
where the boss effect (`bossdesc.*`) already shows.

### 4. Popup queue (fixes M1, now reachable)
Multiple encounters can now co-fire on one blind entry (e.g. first boss blind where you also first
own a joker). The current host uses `setActive(cur ?? id)`, which DROPS the second (it re-fires next
blind since unseen — awkward pileup). Replace the single `active` with a small **queue**: fired ids
append (deduped against the queue + seen); the head shows; dismiss marks it seen and advances to the
next. So co-firing encounters show sequentially in one sitting.

### 5. Triggers — on the blind where first owned
All in RunView's existing `[phase]` effect (which already fires `shopFirstVisit`), gated on
`readTips()` inside the bus/host as before. On `phase === 'playing'`:
- `run.jokers.length > 0` → `tutorialBus.fire('firstJoker')`
- `run.consumables.length > 0` → `tutorialBus.fire('firstConsumable')`
- `blind.kind === 'boss'` → `tutorialBus.fire('firstBoss')`
Each is a no-op if already seen. Because the run now starts empty, firstJoker/firstConsumable fire
on the first blind entered while holding one (i.e. the blind after buying it) — matching the request.

## Out of scope
Per-boss encounters (still one generic firstBoss); the other ~6 encounter triggers
(letterHand/pattern/unison/material/font/pouchHover); interactive gating.

## Testing
- `tutorial.ts`: registry count 13→14; firstBoss has copy both locales (existing coverage test
  auto-covers it once registered). mascot field present on shopFirstVisit/firstBoss.
- In-app Playwright smoke: empty start (0 jokers/consumables on first blind); shop tutorial shows
  Piyak; buy a joker → next blind shows firstJoker; first boss blind shows firstBoss (WooDak);
  queue shows two co-firing encounters in sequence; tips-off suppresses all.
