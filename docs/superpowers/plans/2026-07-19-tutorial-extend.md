# Tutorial Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start runs empty (no demo jokers / magnifier); add tutorial explainers for joker tiles, consumables, and the first boss blind (shown on the blind where first encountered); and make the shop tutorial feature 삐약이 (Piyak) as the presenter (WooDak for the boss one).

**Architecture:** Extends the shipped tutorial system. `tutorial.ts` gains a `mascot?` field on encounters + a new `firstBoss` encounter. `TutorialPopup` renders the mascot portrait and becomes a QUEUE (co-firing encounters show sequentially). RunView's existing `[phase]` effect fires `firstJoker`/`firstConsumable`/`firstBoss` when the player enters a playing blind owning one / on a boss blind. `useGame.bootstrap` drops the starting inventory.

**Tech Stack:** TypeScript strict, React, plain CSS (`.mascot` grammar + piyak.png/woodak.png), Vitest.

## Global Constraints

- Engine (`src/engine/`) untouched — the empty-start change is in the UI bootstrap (`useGame.ts`); `newRun` already returns empty inventories.
- Copy is i18n single-source (`tutorial.<id>.title/.body`); the popup and Help both read it.
- Encounter registry drives everything (the coverage test iterates it) — a new encounter needs copy in both locales or the guard test fails.
- Triggers fire via `tutorialBus.fire(id)`; the host no-ops when tips-off (`readTips()`) or already-seen. Fires happen on `phase === 'playing'` entry so the tutorial shows on the blind where first owned.
- Reuse existing patterns: `.mascot`/`.mascot-cat` markup + `piyakUrl`/`woodakUrl` imports (see ShopMascot.tsx / WooDakMascot.tsx); the queue must keep the existing "microtask defer + tips/seen gate + dedup" behavior.
- TypeScript strict; `npx tsc --noEmit` clean; full `npx vitest run` green.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Empty starting inventory (bootstrap)

**Files:**
- Modify: `src/ui/useGame.ts` (`bootstrap()`, ~line 164-168; remove `STARTING_JOKERS` const line ~43 and the now-unused `equip` helper ~line 143)

**Interfaces:**
- Consumes: `newRun` (engine, already returns `jokers: []` / `consumables: []`).
- Produces: runs start with no jokers, no consumables.

- [ ] **Step 1: Change bootstrap** — in `src/ui/useGame.ts`, replace the `base` construction:

```ts
  const base: RunState = newRun(seed);
```

(was `{ ...equip(newRun(seed), STARTING_JOKERS), consumables: ['magnifier'] as ConsumableId[] }`.)

Then remove the now-dead `const STARTING_JOKERS ...` line and the `function equip(...) {...}` helper (grep to confirm no other caller: `grep -n "equip(\|STARTING_JOKERS" src/ui/useGame.ts` should show only the definitions after your edit). If `ConsumableId` becomes an unused import, drop it from the import list. Add a one-line comment on the `base` line: `// runs start empty — jokers/consumables are acquired in the shop (was: 3 demo jokers + a magnifier)`.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean (no unused-symbol errors); full `npx vitest run` green (the persist test builds its own run, so it's unaffected — confirm it still passes).

- [ ] **Step 3: Commit**

```bash
git add src/ui/useGame.ts
git commit -m "feat : runs start empty (drop demo starting jokers + magnifier) — first-owned tutorials need it"
```

---

### Task 2: `mascot` field + `firstBoss` encounter + copy

**Files:**
- Modify: `src/ui/tutorial.ts` (Encounter interface + ENCOUNTERS)
- Modify: `locales/en.json`, `locales/ko.json`
- Modify: `tests/tutorial-store.test.ts` (count 13 → 14)

**Interfaces:**
- Consumes: nothing new.
- Produces: `Encounter.mascot?: 'piyak' | 'woodak'`; a 14th encounter `firstBoss`; copy `tutorial.firstBoss.title/.body` both locales.

- [ ] **Step 1: Update the count test first** — in `tests/tutorial-store.test.ts`, change the two `13` assertions in the "registry has all … encounters" test to `14` (both `ENCOUNTERS.length` and the unique-ids `Set` size). Run `npx vitest run tests/tutorial-store.test.ts` → the registry test AND the copy-coverage test FAIL (only 13 exist / firstBoss copy missing).

- [ ] **Step 2: Implement registry** — in `src/ui/tutorial.ts`:

Add `mascot` to the interface:

```ts
export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: string;
  /** optional mascot portrait shown in the popup card (Piyak = shop, WooDak = mentor) */
  mascot?: 'piyak' | 'woodak';
}
```

Add `'firstBoss'` to the `EncounterId` union (in the `'run'`-ish group area):

```ts
  | 'firstPack' | 'pouchHover' | 'magnifier' | 'firstBoss';
```

In `ENCOUNTERS`, set the mascot on `shopFirstVisit` and add `firstBoss`:

```ts
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪', mascot: 'piyak' },
  ...
  { id: 'firstBoss', group: 'run', icon: '👑', mascot: 'woodak' },
```

(Keep the existing 13 entries; just add `mascot: 'piyak'` to shopFirstVisit and append the firstBoss row — 14 total.)

- [ ] **Step 3: Copy** — `locales/en.json`:

```json
  "tutorial.firstBoss.title": "Boss blind",
  "tutorial.firstBoss.body": "This round is a boss blind — it carries a constraint that changes the rules. Check its effect in the sidebar and plan your words around it.",
```

`locales/ko.json`:

```json
  "tutorial.firstBoss.title": "보스 블라인드",
  "tutorial.firstBoss.body": "이 라운드는 보스 블라인드입니다 — 규칙을 바꾸는 제약이 걸려 있어요. 사이드바에서 효과를 확인하고 그에 맞춰 단어를 계획하세요.",
```

- [ ] **Step 4: Verify** — `npx vitest run tests/tutorial-store.test.ts` → PASS (14 + copy coverage); full `npx vitest run`; `npx tsc --noEmit` clean; JSON valid.

- [ ] **Step 5: Commit**

```bash
git add src/ui/tutorial.ts locales/en.json locales/ko.json tests/tutorial-store.test.ts
git commit -m "feat : firstBoss encounter + mascot field (Piyak on shop, WooDak on boss)"
```

---

### Task 3: TutorialPopup — mascot portrait + encounter queue

**Files:**
- Modify: `src/ui/components/TutorialPopup.tsx`
- Modify: `src/ui/styles/screens.css` (mascot-in-card layout)

**Interfaces:**
- Consumes: `Encounter.mascot`, `ENCOUNTERS` (Task 2); `piyakUrl`/`woodakUrl` assets.
- Produces: the popup shows a mascot portrait when the active encounter has one, and queues co-firing encounters.

- [ ] **Step 1: Rewrite `TutorialHost`** to use a queue instead of a single `active`. Replace the component body:

```tsx
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { readTips } from '../settings';
import { richText } from '../richtext';
import { tutorialBus, hasSeen, markSeen, ENCOUNTERS, type EncounterId } from '../tutorial';
import piyakUrl from '../assets/piyak.png';
import woodakUrl from '../assets/woodak.png';

const MASCOT_SRC: Record<'piyak' | 'woodak', string> = { piyak: piyakUrl, woodak: woodakUrl };

/**
 * Layer-2 encounter popup host (work order A-2). Mounted once in App. Subscribes
 * to the tutorial bus and shows a one-time card per encounter, gated on the live
 * "show tips" setting and the seen-flag. Co-firing encounters QUEUE and show one
 * after another. An encounter may carry a mascot portrait (Piyak / WooDak).
 */
export function TutorialHost() {
  const { t } = useI18n();
  const [queue, setQueue] = useState<EncounterId[]>([]);

  useEffect(() => {
    return tutorialBus.subscribe((id) => {
      if (!readTips()) return;
      if (hasSeen(id)) return;
      // Defer past the firing component's render (fires happen inside setState
      // updaters / effects). Dedup against what's already queued.
      queueMicrotask(() =>
        setQueue((q) => (q.includes(id) ? q : [...q, id])),
      );
    });
  }, []);

  const active = queue[0] ?? null;
  if (!active) return <></>;
  const enc = ENCOUNTERS.find((e) => e.id === active);
  const dismiss = () => {
    markSeen(active);
    setQueue((q) => q.slice(1)); // advance to the next queued encounter
  };
  const mascot = enc?.mascot;

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div
        className={['tut-card', mascot ? 'has-mascot' : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tut-head">
          <span className="tut-icon">{enc?.icon}</span>
          <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
        </div>
        <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
        <button className="btn blue tut-ok" onClick={dismiss}>
          {t('tutorial.gotIt')}
        </button>
        {mascot && (
          <img className="mascot-cat tut-mascot" src={MASCOT_SRC[mascot]} alt="" />
        )}
      </div>
    </div>
  );
}
```

(This preserves the microtask-defer + tips/seen gate; `setActive(cur??id)` becomes queue append with dedup; dismiss marks seen and pops the head. The queue empties one card at a time.)

- [ ] **Step 2: CSS** — append to `src/ui/styles/screens.css` (a small portrait tucked at the card's corner; reuse the pixel-art sizing idiom):

```css
/* tutorial popup mascot portrait (Piyak on shop, WooDak on boss) */
.tut-card.has-mascot { position: relative; padding-bottom: 20px; }
.tut-mascot {
  position: absolute;
  right: -8px;
  bottom: -6px;
  width: 84px;
  height: auto;
  pointer-events: none;
  image-rendering: pixelated;
}
```

(Confirm `.mascot-cat` already sets `image-rendering: pixelated`/sizing in play.css or screens.css; if it conflicts, the `.tut-mascot` rules win by specificity — keep them scoped. If the portrait overlaps the text at small widths, that's acceptable for this pass; note it.)

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green (no unit test — queue/mascot behavior is covered by the Task 5 in-app smoke).

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/TutorialPopup.tsx src/ui/styles/screens.css
git commit -m "feat : tutorial popup shows mascot portrait + queues co-firing encounters"
```

---

### Task 4: Wire firstJoker / firstConsumable / firstBoss triggers

**Files:**
- Modify: `src/ui/components/RunView.tsx` (the existing `[phase]` effect)

**Interfaces:**
- Consumes: `tutorialBus.fire` (already imported for `shopFirstVisit`); `run`/`blind` from `g.state`.
- Produces: three new fires on playing-blind entry.

- [ ] **Step 1: Implement** — READ RunView.tsx's existing phase effect (it already has `if (phase === 'shop') { audio.play('catMeow'); tutorialBus.fire('shopFirstVisit'); }` and the clear/fail stings, plus the A-1 intro effect). Add a second effect (or extend an appropriate one) keyed so it fires on entering a playing blind. Because `run`/`blind` are needed, key it on `[phase]` and read the current `run`/`blind` from the component scope:

```ts
  useEffect(() => {
    if (phase !== 'playing') return;
    if (run.jokers.length > 0) tutorialBus.fire('firstJoker');
    if (run.consumables.length > 0) tutorialBus.fire('firstConsumable');
    if (blind.kind === 'boss') tutorialBus.fire('firstBoss');
  }, [phase]);
```

Place it next to the existing phase effect. `phase`, `run`, `blind` are already destructured in RunView (`const { blind, run, selected, phase } = g.state;`). The fires are no-ops when seen/tips-off. Keying on `[phase]` only (not `run`/`blind`) is intentional: it should evaluate once per blind entry, not re-fire mid-blind when jokers change — and the bus/seen-gate makes a repeat fire harmless anyway.

Note the ESLint exhaustive-deps: this repo has no eslint config (confirmed earlier), so the intentional `[phase]`-only deps won't be auto-flagged; add a `// fire once per blind entry; run/blind read intentionally without being deps` comment.

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/RunView.tsx
git commit -m "feat : fire joker/consumable/boss tutorials on the blind where first encountered"
```

---

### Task 5: End-to-end verification + docs

**Files:**
- Verify: the running app.
- Modify: `docs/GDD.md` or economy doc only if it states a starting inventory (grep; the empty-start change should be reflected if a doc claims a starting magnifier/jokers).

- [ ] **Step 1: Full green** — `npx vitest run` (incl. tutorial-store, now 14 encounters) and `npx tsc --noEmit` clean.

- [ ] **Step 2: In-app smoke (Playwright)** — fresh profile:
  - (a) Start a run → the play board's owned-joker shelf and consumable shelf are EMPTY (0 jokers, 0 consumables). Assert via the DOM (no `.joker`/consumable-slot filled entries) or by reading `localStorage`'s `wj.run` jokers/consumables length = 0.
  - (b) Clear a blind → shop → the `shopFirstVisit` popup shows WITH the Piyak portrait (`.tut-mascot` present). Dismiss. Buy a joker.
  - (c) Next blind (playing) → `firstJoker` popup shows. (If a consumable was also acquired, confirm the queue shows both sequentially.)
  - (d) Reach the first boss blind (or seed a run into a boss blind) → `firstBoss` popup shows with the WooDak portrait; copy references the sidebar constraint.
  - (e) tips-off (seed `wj.settings` tips:false) → none of these fire.
  - Assert no console errors. Screenshot the Piyak shop card and the WooDak boss card. Document any trigger impractical to reach in the smoke (e.g. the boss blind may need a crafted save — if so, verify firstBoss via a seeded `wj.run` at a boss blind, or note it's covered by the trigger's code review + the queue smoke).

- [ ] **Step 3: Docs** — `grep -rin "magnifier\|starting joker\|start with" docs/GDD.md docs/screens-spec.md`; if any doc asserts a starting magnifier/jokers, update it to "runs start empty; inventory is acquired in the shop." Keep to changed lines. (If a doc file carries unrelated pre-staged edits, only commit if a genuine line changed.)

- [ ] **Step 4: Commit** (only if a doc line changed)

```bash
git add docs
git commit -m "docs : runs start with an empty inventory (jokers/consumables acquired in-shop)"
```
