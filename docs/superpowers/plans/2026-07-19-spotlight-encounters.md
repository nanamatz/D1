# Spotlight Encounters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Present the joker / shop / boss encounter tutorials as spotlight + speech-bubble (like the A-1 guided intro) instead of centered modal cards.

**Architecture:** Extract the intro's spotlight+bubble mechanics into a reusable `SpotlightBubble` component; `GuidedIntro` refactors to use it (shared, no behavior change). Encounters gain an optional `target` CSS selector; `TutorialHost` renders targeted encounters via `SpotlightBubble` and untargeted ones via the existing centered card.

**Tech Stack:** TypeScript strict, React, plain CSS (reuses `.intro-*` + `.mascot-*` styles), Vitest, Playwright smoke.

## Global Constraints

- Engine (`src/engine/`) untouched — pure UI.
- Preserve ALL existing tutorial behavior: the queue (co-firing encounters sequential), `readTips()`/`hasSeen` gates, the `queueMicrotask` defer, reduced-motion (mascot breathe already disabled via `.mascot-cat` rules), and the A-1 intro's passive/soft-lock-free advance + off-screen re-measure fix.
- `target`/`mascot` are OPTIONAL encounter fields — the registry/copy coverage tests must still pass unchanged (they don't assert these).
- No backdrop-click dismiss on the spotlight variant (dismiss only via the "Got it" button) — uniform with the intro.
- Reuse existing selectors (verified live): `.jokers-col` (JokerShelf), `.shop-sale-region` (Shop), `.bosseff` (Sidebar).
- TypeScript strict; `npx tsc --noEmit` clean; full `npx vitest run` green (315).
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: Extract `SpotlightBubble` + refactor `GuidedIntro` to use it

**Files:**
- Create: `src/ui/components/SpotlightBubble.tsx`
- Modify: `src/ui/components/GuidedIntro.tsx`

**Interfaces:**
- Produces: `export function SpotlightBubble({ target, mascot, children }: { target: string | null; mascot?: 'piyak' | 'woodak'; children: ReactNode }): JSX.Element` — renders the dim overlay + spotlight on `target` (or a centered bubble when `target` is null / not found) + a mascot-and-bubble wrap whose bubble body is `children`.

- [ ] **Step 1: Create `src/ui/components/SpotlightBubble.tsx`** (lifts the measure/positioning/markup verbatim from GuidedIntro):

```tsx
import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useState } from 'react';
import piyakUrl from '../assets/piyak.png';
import woodakUrl from '../assets/woodak.png';

const MASCOT_SRC: Record<'piyak' | 'woodak', string> = { piyak: piyakUrl, woodak: woodakUrl };

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Dim overlay + box-shadow spotlight on a target element + a mascot speech bubble,
 * positioned below/above the target (centered when there's no target). The shared
 * coach-mark presentation used by the guided intro (A-1) and the spotlight-style
 * encounter popups. `children` fill the bubble body; the caller supplies the
 * dismiss/advance buttons. No backdrop-click dismiss (dismiss via the buttons only).
 *
 * Re-measures over the screen-transition slide (rAF + timed re-measures) so the
 * spotlight settles onto the real position instead of catching the target mid-slide.
 */
export function SpotlightBubble({
  target,
  mascot,
  children,
}: {
  target: string | null;
  mascot?: 'piyak' | 'woodak';
  children: ReactNode;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    if (!target) { setRect(null); return; }
    const el = document.querySelector(target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [target]);

  useLayoutEffect(() => {
    measure();
    const raf = requestAnimationFrame(measure);
    const timers = [120, 360, 650].map((ms) => setTimeout(measure, ms));
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      for (const t of timers) clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const pad = 8;
  const box = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  const belowRoom = rect ? rect.top + rect.height + 200 < window.innerHeight : true;
  const wrapStyle: CSSProperties | undefined = rect
    ? {
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
        ...(belowRoom
          ? { top: rect.top + rect.height + pad + 12 }
          : { bottom: window.innerHeight - rect.top + pad + 12 }),
      }
    : undefined;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      {box && (
        <div
          className="intro-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div className={['intro-wrap', rect ? '' : 'center'].filter(Boolean).join(' ')} style={wrapStyle}>
        <div className="mascot intro-mascot">
          <div className="mascot-bubble intro-bubble">{children}</div>
          {mascot && (
            <div className="mascot-sway">
              <img className="mascot-cat" src={MASCOT_SRC[mascot]} alt="" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Refactor `GuidedIntro.tsx`** to use `SpotlightBubble` — replace its overlay/spotlight/wrap/mascot markup with the shared component, keeping its step state + measure-free content. New body:

```tsx
import { useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { INTRO_STEPS, markIntroSeen } from '../tutorial';
import { SpotlightBubble } from './SpotlightBubble';

/**
 * Guided first-run walkthrough (work order A-1). Passive coach-marks over the
 * shared SpotlightBubble: dims the board, spotlights the current step's target,
 * and narrates it with a WooDak bubble. Advance is always via Next — never gated
 * on performing the action, so it can't soft-lock.
 */
export function GuidedIntro({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const cur = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;

  const finish = () => { markIntroSeen(); onClose(); };
  const next = () => { if (last) finish(); else setStep((s) => s + 1); };

  return (
    <SpotlightBubble target={cur.selector} mascot="woodak">
      <div className="intro-title">{t(`intro.step.${cur.key}.title`)}</div>
      <p className="intro-body">{richText(t(`intro.step.${cur.key}.body`))}</p>
      <div className="intro-actions">
        <button className="btn sm intro-skip" onClick={finish}>{t('intro.skip')}</button>
        <span className="intro-dots">{step + 1} / {INTRO_STEPS.length}</span>
        <button className="btn blue sm intro-next" onClick={next}>
          {last ? t('intro.done') : t('intro.next')}
        </button>
      </div>
    </SpotlightBubble>
  );
}
```

Note: `INTRO_STEPS[step].selector` is always a string, so `target` is non-null here — the SpotlightBubble `target: string | null` accepts it.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green (315). No behavior change to the intro (same overlay/spotlight/bubble markup, now shared). The Task 4 smoke re-verifies the intro at runtime.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/SpotlightBubble.tsx src/ui/components/GuidedIntro.tsx
git commit -m "refactor : extract SpotlightBubble; GuidedIntro renders through it (shared coach-mark)"
```

---

### Task 2: Encounter `target?` field + anchors + firstJoker mascot

**Files:**
- Modify: `src/ui/tutorial.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Encounter.target?: string`; `firstJoker`/`shopFirstVisit`/`firstBoss` carry a `target`; `firstJoker` carries `mascot: 'woodak'`.

- [ ] **Step 1: Implement** — in `src/ui/tutorial.ts`, add `target` to the interface:

```ts
export interface Encounter {
  id: EncounterId;
  group: EncounterGroup;
  icon: string;
  /** optional mascot portrait shown in the popup card (Piyak = shop, WooDak = mentor) */
  mascot?: 'piyak' | 'woodak';
  /** optional CSS selector — when set, the popup spotlights this element (coach-mark
   *  style) instead of a centered card */
  target?: string;
}
```

In `ENCOUNTERS`, add the targets (and firstJoker's mascot). Change the three rows to:

```ts
  { id: 'firstJoker', group: 'run', icon: '🤡', mascot: 'woodak', target: '.jokers-col' },
  ...
  { id: 'shopFirstVisit', group: 'economy', icon: '🏪', mascot: 'piyak', target: '.shop-sale-region' },
  ...
  { id: 'firstBoss', group: 'run', icon: '👑', mascot: 'woodak', target: '.bosseff' },
```

(Only add `target` to these three + `mascot: 'woodak'` to firstJoker; leave every other entry unchanged, and keep `shopFirstVisit`/`firstBoss`'s existing mascots.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green (the registry count test is still 14; copy coverage still passes; target/mascot are optional so nothing else changes).

- [ ] **Step 3: Commit**

```bash
git add src/ui/tutorial.ts
git commit -m "feat : anchor joker/shop/boss encounters to spotlight targets (+ WooDak on joker)"
```

---

### Task 3: TutorialHost renders targeted encounters via SpotlightBubble

**Files:**
- Modify: `src/ui/components/TutorialPopup.tsx`

**Interfaces:**
- Consumes: `SpotlightBubble` (Task 1), `Encounter.target` (Task 2).
- Produces: targeted encounters render as spotlight+bubble; untargeted keep the centered card.

- [ ] **Step 1: Implement** — in `src/ui/components/TutorialPopup.tsx`, import `SpotlightBubble` and branch on `enc?.target`. Replace the single return with:

```tsx
import { SpotlightBubble } from './SpotlightBubble';
```

and in the render (after computing `active`/`enc`/`dismiss`/`mascot`):

```tsx
  const body = (
    <>
      <div className="tut-head">
        <span className="tut-icon">{enc?.icon}</span>
        <span className="tut-title">{t(`tutorial.${active}.title`)}</span>
      </div>
      <p className="tut-body">{richText(t(`tutorial.${active}.body`))}</p>
      <button className="btn blue tut-ok" onClick={dismiss}>
        {t('tutorial.gotIt')}
      </button>
    </>
  );

  // Spotlight style when the encounter anchors to an element; else the centered card.
  if (enc?.target) {
    return (
      <SpotlightBubble target={enc.target} mascot={mascot}>
        {body}
      </SpotlightBubble>
    );
  }

  return (
    <div className="tut-overlay" role="dialog" aria-modal="true" onClick={dismiss}>
      <div
        className={['tut-card', mascot ? 'has-mascot' : ''].filter(Boolean).join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {body}
        {mascot && <img className="mascot-cat tut-mascot" src={MASCOT_SRC[mascot]} alt="" />}
      </div>
    </div>
  );
```

(Keep the existing `MASCOT_SRC`, the queue, the `useEffect` subscription, and the `dismiss` that does `markSeen(active)` + `setQueue(q => q.slice(1))`. The spotlight branch reuses the SAME `dismiss` via the "Got it" button. The `.tut-head`/`.tut-body`/`.tut-ok` classes render fine inside the SpotlightBubble's `.mascot-bubble` — they're generic text/button styles.)

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean; full `npx vitest run` green.

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/TutorialPopup.tsx
git commit -m "feat : joker/shop/boss tutorials render as spotlight coach-marks (targeted encounters)"
```

---

### Task 4: End-to-end verification + minor CSS polish

**Files:**
- Verify: the running app.
- Modify (only if the smoke shows a visual issue): `src/ui/styles/screens.css` (e.g. the `.tut-*` text inside `.intro-bubble` spacing).

- [ ] **Step 1: Full green** — `npx vitest run` (315) and `npx tsc --noEmit` clean.

- [ ] **Step 2: In-app smoke (Playwright)** — fresh profile (skip the intro where it's not under test by seeding `wj.tutorialIntro`):
  - (a) **A-1 intro regression:** fresh profile, start a run → the guided intro still spotlights step 1 and advances through 6 (the refactor didn't break it).
  - (b) **shopFirstVisit:** inject jokers (test scaffold, as in the prior smoke) to clear ante-1 → shop → the shop tutorial shows a SPOTLIGHT on `.shop-sale-region` with a bubble + Piyak (assert `.intro-overlay` + `.intro-spot` present, and the spot's rect overlaps the sale region; NOT the centered `.tut-card`). Screenshot.
  - (c) **firstJoker:** on a blind entered owning a joker → spotlight on `.jokers-col` with WooDak bubble. Screenshot.
  - (d) **firstBoss:** seed a run into a boss blind (or drive to one) → spotlight on `.bosseff` with WooDak. If reaching a boss blind is impractical in the smoke, seed the seen-flags so only firstBoss is unseen and seed a `wj.run` at a boss blind; if still impractical, document that firstBoss reuses the identical targeted-encounter path as the verified firstJoker/shop and is covered by code review.
  - (e) **untargeted encounter:** trigger a non-targeted encounter (e.g. firstPack by opening a pack, or firstGibberish by submitting gibberish) → it still shows the CENTERED `.tut-card` (no `.intro-spot`).
  - (f) **tips-off:** none fire.
  - Assert zero console errors throughout.
  - If a spotlight's rect is off (target measured before layout settles) or the bubble overflows the viewport, add a targeted CSS/measure tweak and note it.

- [ ] **Step 3: Commit** (only if a polish tweak was needed)

```bash
git add src/ui/styles/screens.css
git commit -m "style : spotlight-encounter bubble polish"
```
