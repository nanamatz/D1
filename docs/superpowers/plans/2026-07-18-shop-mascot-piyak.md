# Shop Mascot "Piyak" (삐약이) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Stationery Shop's tuxedo-cat mascot 삐약이 (Piyak) as an idle-animated decoration in the shop's left rail, with a speech bubble showing one random welcome line per shop visit.

**Architecture:** A single presentational component (`ShopMascot.tsx`) rendered at the bottom of the shop's existing left rail. The welcome line pool lives in the locale files (i18n rule, GDD §1.2); the line is picked once on mount with `Math.random()` (UI-only cosmetic — the engine's seeded-RNG rule applies to the engine only). Idle animation and bubble are pure CSS in `screens.css`.

**Tech Stack:** React 18, plain CSS custom properties (no Tailwind on game screens), Vite asset import.

**Spec:** `docs/superpowers/specs/2026-07-18-shop-mascot-piyak-design.md`

## Global Constraints

- No engine changes. `src/engine/` must not be touched.
- All display strings live in `locales/en.json` + `locales/ko.json` (GDD §1.2); no hard-coded copy in components.
- Pixel-art grammar (UI_DESIGN): `image-rendering: pixelated`, squared corners (no border-radius on the bubble), blocky shadows via `var(--shadow)`.
- Respect reduced motion twice: the `@media (prefers-reduced-motion: reduce)` query AND the app's `body.force-reduced-motion` class (screens.css:583 already kills all animations for the latter — no extra rule needed, just don't fight it).
- Docs and code land in the same change (CLAUDE.md spec-conflict protocol step 3).
- **Testing note:** the repo has no React component test harness (Vitest covers the engine only) and this feature is pure UI decoration with zero engine surface, so tasks verify via `npm run build` (tsc strict) plus a manual app run instead of TDD. Do not add a test framework for this.

---

### Task 1: Welcome line pool (i18n)

**Files:**
- Modify: `locales/ko.json` (after the `"shop.packs"` entry, line ~75)
- Modify: `locales/en.json` (after the corresponding `"shop.packs"` entry)

**Interfaces:**
- Produces: keys `mascot.welcome.0` … `mascot.welcome.7` — consumed by Task 2 via `t(`mascot.welcome.${n}`)`.

- [ ] **Step 1: Add the Korean lines**

In `locales/ko.json`, directly after the `"shop.packs"` line, add:

```json
  "mascot.welcome.0": "어서 오라냥. 오늘도 좋은 물건만 들여놨다냥.",
  "mascot.welcome.1": "원고는 잘 돼 가냥? 필요한 건 다 여기 있다냥.",
  "mascot.welcome.2": "천천히 둘러보라냥. 재촉 안 한다냥.",
  "mascot.welcome.3": "그 조커, 오늘 아침에 막 들어온 물건이라냥.",
  "mascot.welcome.4": "마감이 코앞이라냥? 그럴수록 장비가 중요하다냥.",
  "mascot.welcome.5": "단골한텐 좋은 것만 보여준다냥.",
  "mascot.welcome.6": "리롤은 신중하게 하라냥. 원고료는 소중하다냥.",
  "mascot.welcome.7": "구경은 공짜다냥. 만지면 사야 한다냥.",
```

(Watch trailing commas — keep the file valid JSON.)

- [ ] **Step 2: Add the English lines**

In `locales/en.json`, directly after its `"shop.packs"` line, add:

```json
  "mascot.welcome.0": "Welcome in, meow. Only the finest stock today.",
  "mascot.welcome.1": "How's the manuscript going? Everything you need is right here, meow.",
  "mascot.welcome.2": "Take your time. No rush, meow.",
  "mascot.welcome.3": "That joker? Came in fresh this morning, meow.",
  "mascot.welcome.4": "Deadline creeping up? All the more reason to gear up, meow.",
  "mascot.welcome.5": "I only show regulars the good stuff, meow.",
  "mascot.welcome.6": "Reroll wisely, meow. Fees don't grow on trees.",
  "mascot.welcome.7": "Looking is free, meow. Touching means buying.",
```

- [ ] **Step 3: Verify both files parse**

Run (PowerShell):
```powershell
node -e "JSON.parse(require('fs').readFileSync('locales/ko.json','utf8')); JSON.parse(require('fs').readFileSync('locales/en.json','utf8')); console.log('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```powershell
git add locales/ko.json locales/en.json
git commit -m "feat : add Piyak welcome line pool (i18n)"
```

---

### Task 2: Asset + ShopMascot component + Shop wiring

**Files:**
- Create: `src/ui/assets/piyak.png` (copy of `docs/Piyak.png`)
- Create: `src/ui/components/ShopMascot.tsx`
- Modify: `src/ui/components/Shop.tsx` (imports at top; `.shop-rail` aside at lines 61–72)

**Interfaces:**
- Consumes: `mascot.welcome.0`–`.7` locale keys (Task 1); `useI18n` from `src/ui/i18n.tsx`.
- Produces: `ShopMascot` (no-props React component) rendered inside `.shop-rail`; CSS class names `.mascot`, `.mascot-bubble`, `.mascot-cat` — styled by Task 3.

- [ ] **Step 1: Copy the asset**

```powershell
New-Item -ItemType Directory -Force src/ui/assets; Copy-Item docs/Piyak.png src/ui/assets/piyak.png
```

(`vite/client` types in `src/vite-env.d.ts` already cover `*.png` imports — no new declaration needed.)

- [ ] **Step 2: Create the component**

Create `src/ui/components/ShopMascot.tsx`:

```tsx
import { useState } from 'react';
import { useI18n } from '../i18n';
import piyakUrl from '../assets/piyak.png';

/** Size of the mascot.welcome.N pool in the locale files. */
const MASCOT_WELCOME_COUNT = 8;

/**
 * 삐약이 (Piyak), the tuxedo-cat shop proprietor (UI_DESIGN §6): idle decoration
 * with one random welcome line per shop visit. UI-only cosmetic, so plain
 * Math.random is fine — the seeded-RNG rule covers the engine only.
 */
export function ShopMascot() {
  const { t } = useI18n();
  const [line] = useState(() => Math.floor(Math.random() * MASCOT_WELCOME_COUNT));
  return (
    <div className="mascot">
      <div className="mascot-bubble">{t(`mascot.welcome.${line}`)}</div>
      <img className="mascot-cat" src={piyakUrl} alt="" />
    </div>
  );
}
```

(`alt=""`: the mascot is decorative; the bubble text is real text content already.)

- [ ] **Step 3: Render it in the shop rail**

In `src/ui/components/Shop.tsx`, add the import next to the other component imports:

```tsx
import { ShopMascot } from './ShopMascot';
```

and add `<ShopMascot />` as the last child of the `<aside className="shop-rail">`, after the `.shop-gold` div:

```tsx
      <aside className="shop-rail">
        <button className="btn play next-blind" onClick={g.leaveShop}>
          {t('shop.next')}
        </button>
        <button className="btn green reroll-btn" disabled={run.gold < cost} onClick={g.reroll}>
          {t('shop.reroll', { cost })}
        </button>
        <div className="shop-gold">
          <span className="label">{t('shop.title')}</span>
          <MoneyValue value={run.gold} />
        </div>
        <ShopMascot />
      </aside>
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: tsc + vite build succeed with no errors.

- [ ] **Step 5: Commit**

```powershell
git add src/ui/assets/piyak.png src/ui/components/ShopMascot.tsx src/ui/components/Shop.tsx
git commit -m "feat : add Piyak shop mascot component"
```

---

### Task 3: CSS — idle breathe, pixel bubble, responsive/reduced-motion

**Files:**
- Modify: `src/ui/styles/screens.css` — append to the shop section (after the `.shop-main` rule around line 558; keep it inside the "Shop rail layout" block, before unrelated sections).

**Interfaces:**
- Consumes: class names `.mascot`, `.mascot-bubble`, `.mascot-cat` (Task 2); tokens `--tile-face`, `--tile-ink`, `--fs-sm`, `--shadow` (tokens.css).

- [ ] **Step 1: Add the mascot styles**

Append to the shop section of `src/ui/styles/screens.css`:

```css
/* ---------- Shop mascot — 삐약이/Piyak (UI_DESIGN §6) ----------
   Bottom of the left rail: proprietor-behind-the-counter, never overlapping
   the sale slots. Single-sprite CSS breathe; part-based blink/tail-flick
   waits on extra frames. */
.mascot {
  margin-top: auto; /* park at the bottom of the rail */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.mascot-cat {
  width: 140px;
  image-rendering: pixelated;
  transform-origin: 50% 100%;
  animation: mascotBreathe 3s ease-in-out infinite;
}
/* Pixel-grammar bubble: squared corners, hard 2px ink border, blocky shadow. */
.mascot-bubble {
  position: relative;
  background: var(--tile-face);
  color: var(--tile-ink);
  font-size: var(--fs-sm);
  font-weight: 700;
  line-height: 1.35;
  padding: 8px 10px;
  border: 2px solid var(--tile-ink);
  box-shadow: var(--shadow);
  animation: bubblePop 0.18s ease-out 0.25s backwards;
}
/* Stepped pixel tail: a small face-colored square poking out of the bottom edge. */
.mascot-bubble::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -10px;
  width: 10px;
  height: 10px;
  transform: translateX(-50%);
  background: var(--tile-face);
  border: 2px solid var(--tile-ink);
  border-top: none;
}
@keyframes mascotBreathe {
  0%,
  100% {
    transform: scaleY(1);
  }
  50% {
    transform: scaleY(0.985);
  }
}
@keyframes bubblePop {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mascot-cat,
  .mascot-bubble {
    animation: none;
  }
}
/* Single-column shop layout: hide rather than push the sale content. */
@media (max-width: 720px) {
  .mascot {
    display: none;
  }
}
```

(`body.force-reduced-motion` is already covered globally by screens.css:583 — no extra rule.)

- [ ] **Step 2: Verify in the running app**

Run: `npm run dev`, start a run, clear a blind, enter the shop. Check:
- Piyak sits at the bottom of the left rail, below the gold panel, not overlapping slots.
- One welcome line in a squared speech bubble above him; re-entering the shop later can show a different line.
- Subtle breathing loop; with OS reduced-motion (or the in-game option) everything is static.
- Narrow the window below 720px: mascot disappears, no layout push.

- [ ] **Step 3: Commit**

```powershell
git add src/ui/styles/screens.css
git commit -m "feat : Piyak idle breathe + pixel speech bubble (CSS)"
```

---

### Task 4: Docs sync (same change, CLAUDE.md protocol step 3)

**Files:**
- Modify: `docs/UI_DESIGN.md:119-126` (§6)
- Modify: `docs/screens-spec.md:70` (§2.6 mascot bullet)
- Modify: `docs/GDD.md:42` (art-direction note)

**Interfaces:** none (docs only).

- [ ] **Step 1: Update UI_DESIGN §6**

Replace lines 119–126 of `docs/UI_DESIGN.md` (the whole §6 body) with:

```markdown
## 6. Shop mascot — 삐약이 (Piyak), pixel-art cat proprietor

The Stationery Shop (screens §2.6) has a **mascot character: 삐약이 (Piyak), a tuxedo cat who owns/runs the shop**, rendered in pixel-art with the CRT finish. Art: `docs/Piyak.png` (896×1195, transparent background), shipped as `src/ui/assets/piyak.png`.

- **Placement (shipped):** bottom of the shop's left rail, below the gold panel (proprietor behind the counter feel), never overlapping the item slots. Hidden on the ≤720px single-column layout.
- **Idle animation (shipped, single-sprite):** CSS breathe — subtle vertical squash (scaleY ≈ 0.985, origin at the feet) on a ~3s ease loop. The part-based slicing (blink / tail-flick layers) from the earlier draft needs extra art frames and stays future work.
- **Role in shop (shipped: welcome barker):** on each shop entry Piyak shows one random line from the `mascot.welcome.*` pool (8 lines, i18n) in a pixel-grammar speech bubble (squared corners, ink border, blocky shadow). Purchase/reroll reactions remain a later layer. Track in screens §2.6.
- Respect `prefers-reduced-motion` (and the in-game force-reduced-motion option): freeze to a static frame, bubble appears without motion.
```

- [ ] **Step 2: Update screens-spec §2.6 mascot bullet**

Replace line 70 of `docs/screens-spec.md` with:

```markdown
- **Shop mascot:** **삐약이 (Piyak)**, a pixel-art **tuxedo cat proprietor**, sits at the bottom of the left rail (behind-the-counter feel), not overlapping the slots. Idle animation (single-sprite CSS breathe) + a speech bubble showing one random `mascot.welcome.*` line per shop entry, per UI_DESIGN §6. Purchase/reroll reactions are a later layer. Art: `docs/Piyak.png` → `src/ui/assets/piyak.png`.
```

- [ ] **Step 3: Update the GDD art-direction note**

In `docs/GDD.md` line 42, replace the final clause

`a pixel-art shop mascot (tuxedo cat proprietor) lives in the Stationery Shop.`

with

`a pixel-art shop mascot — 삐약이 (Piyak), the tuxedo cat proprietor — lives in the Stationery Shop (art: docs/Piyak.png).`

- [ ] **Step 4: Grep for stale references**

```powershell
git grep -n "reference/mascot"
```
Expected: the ONLY match is `docs/superpowers/specs/2026-07-18-shop-mascot-piyak-design.md` (its mention is historical context — leave it). UI_DESIGN and screens-spec must no longer match.
If any other doc still references the old path, fix it in this step.

- [ ] **Step 5: Commit**

```powershell
git add docs/UI_DESIGN.md docs/screens-spec.md docs/GDD.md
git commit -m "docs : sync mascot docs to shipped Piyak (name, art path, welcome bubble)"
```
