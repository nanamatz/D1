# Feel & Polish Pass 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land 7 presentation-only feel items — lounge BGM (play/menu), coin-jingle buy/sell SFX, a "tak" tile-select SFX, a draw-from-pouch enter animation with a per-tile draw SFX, Balatro-style mouse-parallax hover on cards, and clearer Unison copy.

**Architecture:** Everything is UI-layer. Audio is synth-only — all sound changes are recipe/track edits in the `src/ui/audio.ts` facade (no asset files). The draw-enter animation extends the existing `useFlip` FLIP layer (`src/ui/hooks.ts`). Parallax is one new `usePointerTilt` hook + a `TiltCard` wrapper + CSS. Copy is `locales/*.json`. **The headless engine (`src/engine/`) is not touched.**

**Tech Stack:** TypeScript (strict), React, Vite, Vitest. Web Audio facade (`src/ui/audio.ts`). Plain CSS custom properties on game screens (`src/ui/styles/play.css`).

## Global Constraints

- **Engine headless:** nothing in `src/engine/` changes. All work is in `src/ui/` and `locales/`.
- **Audio is synth-only:** no `.mp3/.ogg/.wav` files. Every sound change is a `Recipe`/`MUSIC` edit in `src/ui/audio.ts` (facade philosophy, `assets/AUDIO_LICENSES.md`).
- **Silent-start unchanged (GDD §13 / feature-02 C-6):** buses stay gated until SOUND/MUSIC are played; do not un-gate anything.
- **Reduced motion honored:** the draw-enter flight and the parallax tilt both collapse to no-motion under `prefers-reduced-motion` (the existing `reducedMotion()` helper in `hooks.ts`). The per-tile draw SOUND still plays under reduced motion (sound ≠ motion).
- **`boss` and `shop` BGM tracks are untouched** — only `play` and `menu` are retuned.
- **Test command:** `npx vitest run` (single file: `npx vitest run tests/audio-facade.test.ts`). Build/typecheck: `npm run build`. Lint: `npm run lint`.
- **Stagger constant:** the draw flight and the per-tile sound share one cadence — `60ms` per tile, left-to-right. Keep them equal.

---

### Task 1: Audio recipes & tracks (A1, A2, A3, A5-recipe)

Retune the synth: lounge `play`/`menu` tracks, coin-jingle `purchase`/`sell` (needs a small `delay` facade extension so tones can sequence), a "tak" `tileSelect`, and a new `tileDeal` per-tile draw sound. All in `src/ui/audio.ts`; the audio unit test picks up the new name.

**Files:**
- Modify: `src/ui/audio.ts` (`SfxName` union, `Recipe` tone type, `play()` tone start-time, `RECIPES` entries `tileSelect`/`purchase`/`sell` + new `tileDeal`, `MUSIC.play`/`MUSIC.menu`)
- Modify: `tests/audio-facade.test.ts:28` (SFX count 22 → 23)

**Interfaces:**
- Produces: `SfxName` gains member `'tileDeal'` (consumed by Task 2's `audio.play('tileDeal')`). `Recipe.tones[]` gains optional `delay?: number` (seconds from recipe start).

- [ ] **Step 1: Add `tileDeal` to the `SfxName` union**

In `src/ui/audio.ts`, the first union line (currently ending `...'stamp' | 'multFill' | 'totalRoll'`) — extend the tile-sound group. Change:
```ts
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'dragSnap' | 'discardSwoosh'
```
to:
```ts
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'tileDeal' | 'dragSnap' | 'discardSwoosh'
```

- [ ] **Step 2: Add the optional `delay` field to the tone layer type**

In the `Recipe` interface, change:
```ts
  tones?: { wave: Wave; from: number; to?: number }[];
```
to:
```ts
  /** `delay` (seconds from recipe start) lets tones SEQUENCE (e.g. a coin jingle);
   *  omitted = starts at the recipe onset like before. */
  tones?: { wave: Wave; from: number; to?: number; delay?: number }[];
```

- [ ] **Step 3: Honor `delay` in `play()`**

In `play()`, the tone loop currently reads:
```ts
    for (const t of r.tones ?? []) {
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from * bend, now);
      if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to * bend, now + r.dur);
      osc.connect(out);
      osc.start(now);
      osc.stop(now + r.dur);
    }
```
Replace it with (start each tone at `now + delay`):
```ts
    for (const t of r.tones ?? []) {
      const start = now + (t.delay ?? 0);
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from * bend, start);
      if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to * bend, now + r.dur);
      osc.connect(out);
      osc.start(start);
      osc.stop(now + r.dur);
    }
```

- [ ] **Step 4: Retune `tileSelect`, `purchase`, `sell`; add `tileDeal`**

In `RECIPES`, replace the `tileSelect` line:
```ts
  tileSelect:       { gain: 0.16, dur: 0.04, tones: [{ wave: 'square', from: 700 }] },
```
with a dry table-slap plus the new deal sound (insert `tileDeal` right after):
```ts
  tileSelect:       { gain: 0.22, dur: 0.06, tones: [{ wave: 'square', from: 150, to: 90 }], noise: { cutoff: 2200 } },
  tileDeal:         { gain: 0.16, dur: 0.07, tones: [{ wave: 'triangle', from: 520, to: 380 }], noise: { cutoff: 3000 } },
```
Replace the `purchase` and `sell` lines:
```ts
  purchase:         { gain: 0.28, dur: 0.16, tones: [{ wave: 'square', from: 784 }, { wave: 'square', from: 1046 }] },
  sell:             { gain: 0.24, dur: 0.12, tones: [{ wave: 'square', from: 660, to: 440 }] },
```
with coin jingles (ascending arpeggio via `delay` + a metallic noise shimmer):
```ts
  purchase:         { gain: 0.26, dur: 0.22, tones: [{ wave: 'triangle', from: 784 }, { wave: 'triangle', from: 1046, delay: 0.05 }, { wave: 'triangle', from: 1318, delay: 0.10 }], noise: { cutoff: 3000 } },
  sell:             { gain: 0.22, dur: 0.16, tones: [{ wave: 'triangle', from: 988 }, { wave: 'triangle', from: 1318, delay: 0.05 }], noise: { cutoff: 2600 } },
```

- [ ] **Step 5: Retune `MUSIC.play` and `MUSIC.menu` to lounge**

In `MUSIC`, replace the whole `play:` entry:
```ts
  play: {
    bpm: 120,
    voices: [
      { wave: 'square',   gain: 0.14, steps: ['C4', 'E4', 'G4', 'E4', 'A4', 'G4', 'E4', 'C4', 'D4', 'F4', 'A4', 'F4', 'G4', 'E4', 'D4', 'G4'] },
      { wave: 'triangle', gain: 0.12, steps: ['C2', R, 'C2', R, 'A1', R, 'A1', R, 'F1', R, 'F1', R, 'G1', R, 'G1', R] },
    ],
  },
```
with a warmer, slower groove (triangle lead — the board, so a touch livelier than `shop`):
```ts
  play: {
    bpm: 96,
    voices: [
      { wave: 'triangle', gain: 0.15, steps: ['C4', R, 'E4', 'G4', R, 'E4', 'C4', R, 'D4', R, 'F4', 'A4', R, 'G4', 'E4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```
Then replace the whole `menu:` entry:
```ts
  menu: {
    bpm: 84,
    voices: [
      { wave: 'triangle', gain: 0.18, steps: ['C4', R, 'E4', R, 'G4', R, 'B4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```
with a calmer, sparser lounge intro:
```ts
  menu: {
    bpm: 76,
    voices: [
      { wave: 'triangle', gain: 0.16, steps: ['C4', R, R, 'E4', R, R, 'G4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.09, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```

- [ ] **Step 6: Update the SFX-count assertion**

The audio test hard-codes the recipe count. In `tests/audio-facade.test.ts:28` change:
```ts
    expect(SFX_NAMES.length).toBe(22);
```
to:
```ts
    expect(SFX_NAMES.length).toBe(23);
```
(The `every SfxName has a recipe` loop already covers `tileDeal` — its gain `0.16 > 0` passes automatically.)

- [ ] **Step 7: Run the audio test to verify it passes**

Run: `npx vitest run tests/audio-facade.test.ts`
Expected: PASS (all `noteHz`/track/SfxName assertions green; the 23 count matches; every recipe has positive gain).

- [ ] **Step 8: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no errors (the `delay` field and `tileDeal` are used consistently).

- [ ] **Step 9: Commit**

```bash
git add src/ui/audio.ts tests/audio-facade.test.ts
git commit -m "feat(audio): lounge play/menu BGM, coin buy/sell, tak select, tileDeal SFX"
```

---

### Task 2: Draw-from-pouch enter animation + per-tile SFX (A4, A5-wiring)

Freshly drawn hand tiles fly in from the pouch, staggered, each firing `tileDeal`. Reorder/shift and discard fly-out already work — leave them. Extend `useFlip` to animate *entering* tiles (never-before-seen ids only, so unstaging a tile does NOT fly), from the pouch origin, and to fire a per-tile callback.

**Files:**
- Modify: `src/ui/hooks.ts` (`useFlip` — add `FlipOpts`, a `seen` set, the enter branch)
- Modify: `src/ui/components/StagePanel.tsx:57` (pass pouch origin + `onEnter` to the hand's `useFlip`)

**Interfaces:**
- Consumes: `audio.play('tileDeal')` from Task 1.
- Produces: `useFlip(ref, key, opts?: FlipOpts)` where `FlipOpts = { enterOrigin?: () => { x: number; y: number } | null; onEnter?: (index: number) => void }`. Existing callers passing no `opts` keep today's behavior (no enter animation).

- [ ] **Step 1: Rewrite `useFlip` in `src/ui/hooks.ts`**

Replace the entire `useFlip` function (lines 39–73) with this version (adds `FlipOpts`, a `seen` set to tell real draws from returning-from-staged tiles, an `optsRef` so a fresh `opts` object each render does not re-run the effect, and the staggered pouch-enter branch):
```ts
export interface FlipOpts {
  /** Viewport coords of the draw origin (the pouch). Entering (freshly drawn)
   *  tiles fly from here. Omit for containers that should NOT animate enters
   *  (e.g. the staged row) — then only reorder/shift animate, as before. */
  enterOrigin?: () => { x: number; y: number } | null;
  /** Fired once per entering tile in DOM order (0-based) so the caller can play
   *  a staggered per-tile sound. Fires even under reduced motion (sound ≠ motion). */
  onEnter?: (index: number) => void;
}

export function useFlip(ref: RefObject<HTMLElement | null>, key: string, opts?: FlipOpts): void {
  const prev = useRef<Map<string, { x: number; y: number }>>(new Map());
  // Every id ever seen in this container. A tile absent from `prev` but present in
  // `seen` returned from the staged row (do NOT fly it from the pouch); a tile absent
  // from both is a genuine fresh draw (fly it in).
  const seen = useRef<Set<string>>(new Set());
  const optsRef = useRef(opts);
  optsRef.current = opts;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const kids = Array.from(el.children) as HTMLElement[];
    const next = new Map<string, { x: number; y: number }>();
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (!id) continue;
      const r = k.getBoundingClientRect();
      next.set(id, { x: r.left - base.left, y: r.top - base.top });
    }
    const reduce = reducedMotion();
    const o = optsRef.current;
    const origin = o?.enterOrigin?.() ?? null;
    let enterIdx = 0;
    for (const k of kids) {
      const id = k.dataset.flipId;
      if (!id) continue;
      const now = next.get(id)!;
      const isEnter = !seen.current.has(id);
      if (isEnter && o?.enterOrigin) {
        // Freshly drawn tile — pouch enter (staggered), plus the per-tile sound.
        o.onEnter?.(enterIdx);
        if (!reduce) {
          const ox = origin ? origin.x - base.left : now.x;
          const oy = origin ? origin.y - base.top : base.height + 40;
          const dx = ox - now.x;
          const dy = oy - now.y;
          k.animate(
            [
              { transform: `translate(${dx}px, ${dy}px) scale(.6)`, opacity: 0 },
              { transform: 'none', opacity: 1 },
            ],
            { duration: 340, delay: enterIdx * 60, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' },
          );
        }
        enterIdx++;
      } else if (!reduce) {
        // Reorder / shift (tile existed last layout) — the original FLIP.
        const old = prev.current.get(id);
        if (old) {
          const dx = old.x - now.x;
          const dy = old.y - now.y;
          if (dx || dy) {
            k.animate(
              [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }],
              { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' },
            );
          }
        }
      }
    }
    for (const id of next.keys()) seen.current.add(id);
    prev.current = next;
  }, [key, ref]);
}
```

- [ ] **Step 2: Wire the pouch origin + per-tile sound into the hand's `useFlip`**

In `src/ui/components/StagePanel.tsx`, the two `useFlip` calls are at lines 57–58:
```ts
  useFlip(handRef, `${sortMode}|${hand.map((tl) => tl.id).join(',')}`);
  useFlip(stagedRef, staged.map((tl) => tl.id).join(','));
```
Replace them with (the hand gets pouch enters + `tileDeal`; the staged row stays plain):
```ts
  // A4/A5: freshly drawn tiles fly in from the pouch dock, staggered, each with a
  // per-tile draw sound on the same 60ms cadence. The staged row keeps plain FLIP.
  const pouchOrigin = () => {
    if (typeof document === 'undefined') return null;
    const dock = document.querySelector('.pouch-dock');
    if (!dock) return null;
    const r = dock.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  useFlip(handRef, `${sortMode}|${hand.map((tl) => tl.id).join(',')}`, {
    enterOrigin: pouchOrigin,
    onEnter: (i) => { window.setTimeout(() => audio.play('tileDeal'), i * 60); },
  });
  useFlip(stagedRef, staged.map((tl) => tl.id).join(','));
```
(`audio` is already imported at `StagePanel.tsx:9`; `useFlip` is already imported at line 6.)

- [ ] **Step 3: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no errors. The existing `useFlip(stagedRef, ...)` call still typechecks (the third arg is optional).

- [ ] **Step 4: Run the full test suite (no regressions)**

Run: `npx vitest run`
Expected: PASS. No engine/unit test asserts hand-draw motion; this task is presentation.

- [ ] **Step 5: Verify live (presentation)**

Use the `verify` skill: run the game, unlock audio (spell `SOUND`), start a blind. Confirm the opening hand and post-play replacement tiles slide in **from the pouch dock one-by-one**, each with a soft "fwip", and that **staging then unstaging a tile does NOT make it fly from the pouch** (it just returns). Toggle reduced motion (OS setting or `document.body.classList.add('force-reduced-motion')`) and confirm tiles appear instantly but the draw sound still plays.

- [ ] **Step 6: Commit**

```bash
git add src/ui/hooks.ts src/ui/components/StagePanel.tsx
git commit -m "feat(board): tiles fly in from the pouch on draw, with a per-tile sound"
```

---

### Task 3: Mouse-parallax hover on cards (A6)

A reusable `usePointerTilt` hook tilts a card toward the cursor (3D rotate + lift + slight scale), easing back flat on leave. Applied to hand/staged tiles, joker cards, and consumable cards.

**Files:**
- Modify: `src/ui/hooks.ts` (add a `clamp` helper + `usePointerTilt`)
- Create: `src/ui/components/TiltCard.tsx` (a div wrapper that applies the hook — for cards rendered inline in a `.map`)
- Modify: `src/ui/components/Tile.tsx` (root ref + hook)
- Modify: `src/ui/components/JokerShelf.tsx` (wrap the joker card and consumable card in `TiltCard`)
- Modify: `src/ui/styles/play.css` (the `.tilting` transform rule)

**Interfaces:**
- Produces: `usePointerTilt(ref: RefObject<HTMLElement | null>, enabled?: boolean): void` and `<TiltCard {...divProps} />` (a `div` that tilts; forwards all `ComponentProps<'div'>`).

- [ ] **Step 1: Add `clamp` + `usePointerTilt` to `src/ui/hooks.ts`**

At the end of `src/ui/hooks.ts` (after `useFlip`), add:
```ts
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Balatro-style pointer parallax. While the cursor is over `ref`'s element, adds
 * the `tilting` class and writes `--tilt-x` / `--tilt-y` (unitless, -1..1); the CSS
 * turns them into a 3D rotate + lift. Resets on pointerleave. No-ops under reduced
 * motion or when `enabled` is false. rAF-throttled (one pending frame).
 */
export function usePointerTilt(ref: RefObject<HTMLElement | null>, enabled = true): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reducedMotion()) return;
    let raf = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--tilt-y', String(nx)); // horizontal cursor → rotateY
      el.style.setProperty('--tilt-x', String(-ny)); // vertical cursor → rotateX (inverted)
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      el.classList.add('tilting');
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      el.classList.remove('tilting');
      el.style.removeProperty('--tilt-x');
      el.style.removeProperty('--tilt-y');
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, enabled]);
}
```

- [ ] **Step 2: Create `src/ui/components/TiltCard.tsx`**

```tsx
import { useRef, type ComponentProps } from 'react';
import { usePointerTilt } from '../hooks';

/** A <div> that tilts toward the cursor (Balatro UX, A6). Forwards every div prop, so
 *  it drops in where an inline card <div> was. Used for cards rendered in a .map (where
 *  a per-card hook can't be called directly). */
export function TiltCard({ children, ...rest }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  usePointerTilt(ref);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Apply the tilt to `Tile.tsx`**

In `src/ui/components/Tile.tsx`, change the top import (line 1) from:
```ts
import type { Tile } from '../../engine/types';
```
to add the React + hook imports:
```ts
import { useRef } from 'react';
import type { Tile } from '../../engine/types';
import { usePointerTilt } from '../hooks';
```
Then, inside `TileView`, right after `const interactive = ...` / `const draggable = ...` lines (around line 50), add a ref + hook (skip mini and locked tiles):
```ts
  const rootRef = useRef<HTMLDivElement>(null);
  usePointerTilt(rootRef, !mini && !disabled);
```
And attach the ref to the root `<div>` — change the opening tag (line 76) from:
```tsx
    <div
      className={className}
      data-flip-id={tile.id}
```
to:
```tsx
    <div
      ref={rootRef}
      className={className}
      data-flip-id={tile.id}
```

- [ ] **Step 4: Apply the tilt to joker + consumable cards in `JokerShelf.tsx`**

In `src/ui/components/JokerShelf.tsx`, add the import after the existing component imports (after line 9 `import { Tooltip } from './Tooltip';`):
```ts
import { TiltCard } from './TiltCard';
```
Replace the joker card `<div>` (lines 92–105) — change the opening tag from `<div` to `<TiltCard` and the closing `</div>` (line 105) to `</TiltCard>`:
```tsx
                  <TiltCard
                    className={className}
                    tabIndex={0}
                    role={onSellJoker ? 'button' : undefined}
                    aria-haspopup={onSellJoker ? 'menu' : undefined}
                    aria-expanded={onSellJoker ? jokerMenuIdx === i : undefined}
                    onClick={onSellJoker ? () => setJokerMenuIdx(jokerMenuIdx === i ? null : i) : undefined}
                  >
                    <span className="e">{def.emoji}</span>
                    <span className="n">{name}</span>
                    {firing && settle.jokerPop && (
                      <JokerPop chips={settle.jokerPop.chips} mult={settle.jokerPop.mult} />
                    )}
                  </TiltCard>
```
Replace the consumable card `<div className="consumable use" ...>` (lines 141–159) — change the opening `<div` to `<TiltCard` and its closing `</div>` (line 159) to `</TiltCard>`:
```tsx
              <TiltCard
                className="consumable use"
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-expanded={menuIdx === i}
                onClick={() => setMenuIdx(menuIdx === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setMenuIdx(menuIdx === i ? null : i);
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setMenuIdx(null);
                  }
                }}
              >
                <span className="e">{CONSUMABLE_EMOJI[c] ?? '📄'}</span>
                <span className="n">{t(`consumable.${c}`)}</span>
              </TiltCard>
```

- [ ] **Step 5: Add the `.tilting` transform rule to `play.css`**

In `src/ui/styles/play.css`, immediately after the `.tile:hover` rule (ends at line 984) add:
```css
/* A6 · Balatro pointer parallax. The hook adds .tilting + --tilt-x/--tilt-y (unitless
   -1..1); turn them into a 3D rotate + lift + slight scale. Element-qualified so
   `.tile.tilting` (0,2,0) ties `.tile:hover` (0,2,0) and, coming later in the file,
   wins; `!important` also beats the plain (non-important) joker/consumable :hover lift. */
.tile.tilting,
.joker.tilting,
.consumable.tilting {
  transform: perspective(600px)
             rotateX(calc(var(--tilt-x, 0) * 9deg))
             rotateY(calc(var(--tilt-y, 0) * 9deg))
             translateY(-4px) scale(1.04) !important;
  transition: transform 0.08s linear;
  z-index: 4;
}
```

- [ ] **Step 6: Typecheck + lint**

Run: `npm run build` then `npm run lint`
Expected: no errors. `TiltCard` forwards `ComponentProps<'div'>`, so all the spread props (role, aria-*, onClick, onKeyDown, tabIndex) typecheck.

- [ ] **Step 7: Run the full test suite (no regressions)**

Run: `npx vitest run`
Expected: PASS (presentation change; no unit test covers hover transforms).

- [ ] **Step 8: Verify live (presentation)**

Use the `verify` skill: hover hand tiles, joker cards, and consumable cards — each should tilt toward the cursor and ease back flat on leave, with the lift preserved (the tile still rises, the joker/consumable still lift). Confirm dragging a tile and the joker "firing" wiggle are unaffected. Toggle reduced motion and confirm cards stay flat (no tilt) but still lift on hover.

- [ ] **Step 9: Commit**

```bash
git add src/ui/hooks.ts src/ui/components/TiltCard.tsx src/ui/components/Tile.tsx src/ui/components/JokerShelf.tsx src/ui/styles/play.css
git commit -m "feat(ui): Balatro-style mouse-parallax tilt on tiles, jokers, consumables"
```

---

### Task 4: Clearer Unison copy (B2)

Reword the Unison tutorial card in both locales so it reads without poker jargon ("flush", "접미").

**Files:**
- Modify: `locales/en.json:399`
- Modify: `locales/ko.json:399`

- [ ] **Step 1: Reword the English string**

In `locales/en.json`, replace line 399:
```json
  "tutorial.firstUnison.body": "When every word in the sentence shares one suit (2 or more words), Unison adds a bonus — our take on a flush.",
```
with:
```json
  "tutorial.firstUnison.body": "If all the words in your sentence share one suit — and there are at least 2 words — you earn a Unison bonus: a bigger multiplier for keeping the whole sentence one color.",
```

- [ ] **Step 2: Reword the Korean string**

In `locales/ko.json`, replace line 399:
```json
  "tutorial.firstUnison.body": "문장의 모든 단어가 같은 접미를 공유하면(2개 이상) 유니즌 보너스가 붙습니다 — 플러시에 해당하는 규칙입니다.",
```
with:
```json
  "tutorial.firstUnison.body": "문장의 모든 단어가 같은 슈트(색)를 공유하고 단어가 2개 이상이면 '유니즌' 보너스를 얻어요. 문장 전체를 한 색으로 맞춘 보상으로 배수가 커집니다.",
```

- [ ] **Step 3: Validate JSON + build**

Run: `npm run build`
Expected: no errors (both locale files stay valid JSON — mind the trailing comma on line 399, present in the originals).

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/ko.json
git commit -m "copy: clearer Unison explanation (drop flush/접미 jargon)"
```

---

## Self-Review

**Spec coverage:**
- A1 lounge BGM → Task 1 Step 5. ✓
- A2 coin buy/sell (+ delay extension) → Task 1 Steps 2–4. ✓
- A3 "tak" tile-select → Task 1 Step 4. ✓
- A4 draw-from-pouch enter animation → Task 2 Steps 1–2. ✓
- A5 per-tile draw SFX (recipe + wiring) → Task 1 Step 4 (`tileDeal` recipe) + Task 2 Step 2 (`onEnter`). ✓
- A6 mouse parallax on tiles/jokers/consumables → Task 3. ✓
- B2 clearer Unison copy → Task 4. ✓
- Dropped items (B1 joker-tile count, B3 quit, B4 shop/blind options) — correctly absent.

**Type consistency:** `SfxName` `'tileDeal'` defined in Task 1, consumed in Task 2. `FlipOpts`/`useFlip` third arg defined in Task 2 Step 1, used in Task 2 Step 2. `usePointerTilt`/`TiltCard` defined in Task 3 Steps 1–2, used in Steps 3–4. `--tilt-x`/`--tilt-y` written by the hook (Step 1), read by the CSS (Step 5), same names. `.pouch-dock` selector (Task 2 Step 2) matches `BagView.tsx:146`. All consistent.

**Placeholder scan:** none — every code step carries full code.

**Reduced motion:** Task 2 (enter flight skipped, sound kept) and Task 3 (hook no-ops) both handle it; called out in verify steps.
