# Warmth + Punch Feel Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Warm the thin/tinny synth audio (BGM, buy/sell, tile-select, tile-draw) and make the cursor-tracking card tilt stronger and more dynamic — all synth-only, UI-layer, no asset files, no engine changes.

**Architecture:** Task 1 adds a warmth signal path + optional detune/sub tone fields to the `src/ui/audio.ts` synth facade. Task 2 uses those fields to retune specific sounds and adds a pad voice to each BGM track. Task 3 amplifies the `usePointerTilt` hook (`src/ui/hooks.ts`) + `.tilting` CSS (`src/ui/styles/play.css`) and adds a cursor-following sheen element to the tilt targets.

**Tech Stack:** TypeScript (strict), React, Web Audio API (oscillators + biquad filters), plain CSS custom properties, Vitest.

## Global Constraints

- **Headless engine (`src/engine/`) is NEVER touched.** All work is in `src/ui/`.
- **Synth-only — NO audio asset files.** `audio.play(name)` / `audio.playMusic(track)` call sites do not change.
- **No new `SfxName`s** — `SFX_NAMES.length` stays `23` (existing `tests/audio-facade.test.ts:28` assertion).
- **Every `MUSIC` track's voices share one loop length (16 steps)** — the sequencer wraps cleanly (`tests/audio-facade.test.ts:47-60`).
- **Tilt stays reduced-motion-safe** — `usePointerTilt` early-returns under `prefers-reduced-motion`; the sheen and spring must not fire in that mode.
- **Test command:** `npx vitest run tests/audio-facade.test.ts`. **Typecheck:** `npx tsc -b`.

---

### Task 1: Audio warmth signal path + detune/sub tone fields

Adds the mechanism for warmth: a global lowpass on the SFX out and the music bus, a softer attack, and optional per-tone `detune`/`sub` layering + per-voice `detune` for BGM. Existing recipes are unchanged in this task, so all current audio tests stay green.

**Files:**
- Modify: `src/ui/audio.ts` (tone type ~line 32, `Voice` interface ~line 91, `play()` ~lines 324-368, `scheduleStep()` ~lines 281-301, `ensureMusicGraph()` ~lines 236-243)
- Test: `tests/audio-facade.test.ts` (existing — must stay green; no edits in this task)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `Recipe.tones[]` element type gains optional `detune?: number` (cents) and `sub?: boolean`.
  - `Voice` gains optional `detune?: number` (cents).
  - Runtime: `play()` routes tonal output through a ~3 kHz lowpass; the music bus routes through a ~5 kHz lowpass; tonal attack is ~12 ms; `detune` spawns ±-detuned twin oscillators and `sub` adds a sine one octave down.

- [ ] **Step 1: Extend the tone type and `Voice` interface**

In `src/ui/audio.ts`, change the `tones` field type inside `interface Recipe` (currently around line 32) from:

```ts
  tones?: { wave: Wave; from: number; to?: number; delay?: number }[];
```

to:

```ts
  /** `detune` (cents) spawns a ±-detuned twin pair for chorus/body; `sub` adds a
   *  quiet sine one octave below for warmth. Both optional; omitted = single tone. */
  tones?: { wave: Wave; from: number; to?: number; delay?: number; detune?: number; sub?: boolean }[];
```

Then change the `Voice` interface (currently around line 91) from:

```ts
interface Voice {
  wave: Wave;
  gain: number;
  /** one note per 16th-step; null = rest. Loops when the sequencer wraps. */
  steps: (string | null)[];
}
```

to:

```ts
interface Voice {
  wave: Wave;
  gain: number;
  /** cents; when set, a detuned twin oscillator thickens the voice (chorus). */
  detune?: number;
  /** one note per 16th-step; null = rest. Loops when the sequencer wraps. */
  steps: (string | null)[];
}
```

- [ ] **Step 2: Run typecheck to confirm the type change compiles**

Run: `npx tsc -b`
Expected: PASS (optional fields are backward-compatible; no recipe uses them yet).

- [ ] **Step 3: Add the SFX lowpass + softer attack + detune/sub layering in `play()`**

In `play()`, find the `out` wiring and envelope (currently around lines 332-337):

```ts
    const out = ctx.createGain();
    // Percussive envelope: fast attack, exponential decay across the recipe dur.
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(g, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
    out.connect(ctx.destination);
```

Replace it with (softer 12 ms attack + a shared ~3 kHz lowpass rounds harsh harmonics):

```ts
    const out = ctx.createGain();
    // Percussive envelope: softened 12ms attack (was 6ms — removes the tinny click),
    // exponential decay across the recipe dur.
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(g, now + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
    // Global tone rounding: one gentle lowpass warms every SFX (rolls off the harsh
    // upper harmonics of square/saw blips). The noise path keeps its own per-recipe
    // lowpass and is softened further by this one — intended.
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass';
    warm.frequency.value = 3000;
    warm.Q.value = 0.7;
    out.connect(warm).connect(ctx.destination);
```

Then find the tone-emit loop (currently around lines 344-353):

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

Replace it with (main tone + optional detuned twins + optional sub-octave, each through a small per-layer gain so the sub/twins sit under the main):

```ts
    for (const t of r.tones ?? []) {
      const start = now + (t.delay ?? 0);
      // Layers: main (full), optional ±detuned twins (0.7×), optional sub-octave sine (0.5×).
      const layers: { freqMul: number; gainMul: number; det: number; sub: boolean }[] = [
        { freqMul: 1, gainMul: 1, det: 0, sub: false },
      ];
      if (t.detune) {
        layers.push({ freqMul: 1, gainMul: 0.7, det: t.detune, sub: false });
        layers.push({ freqMul: 1, gainMul: 0.7, det: -t.detune, sub: false });
      }
      if (t.sub) layers.push({ freqMul: 0.5, gainMul: 0.5, det: 0, sub: true });
      for (const L of layers) {
        const osc = ctx.createOscillator();
        osc.type = L.sub ? 'sine' : t.wave; // sub is a pure sine for fundamental body
        osc.frequency.setValueAtTime(t.from * bend * L.freqMul, start);
        if (t.to !== undefined) {
          osc.frequency.exponentialRampToValueAtTime(t.to * bend * L.freqMul, now + r.dur);
        }
        if (L.det) osc.detune.setValueAtTime(L.det, start);
        if (L.gainMul !== 1) {
          const lg = ctx.createGain();
          lg.gain.value = L.gainMul;
          osc.connect(lg).connect(out);
        } else {
          osc.connect(out);
        }
        osc.start(start);
        osc.stop(now + r.dur);
      }
    }
```

- [ ] **Step 4: Add the BGM voice detune in `scheduleStep()`**

In `scheduleStep()`, find the per-voice oscillator block (currently around lines 285-300):

```ts
    for (const v of track.voices) {
      const name = v.steps[step];
      if (!name) continue;
      const hz = noteHz(name);
      if (!hz) continue;
      const osc = ctx.createOscillator();
      osc.type = v.wave;
      osc.frequency.setValueAtTime(hz, when);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(v.gain, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      osc.connect(g).connect(this.musicGain);
      osc.start(when);
      osc.stop(when + dur);
    }
```

Replace it with (a shared gain envelope, plus an optional detuned twin oscillator for thicker leads):

```ts
    for (const v of track.voices) {
      const name = v.steps[step];
      if (!name) continue;
      const hz = noteHz(name);
      if (!hz) continue;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(v.gain, when + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
      g.connect(this.musicGain);
      // Main oscillator + optional detuned twin (chorus body for leads).
      const dets = v.detune ? [0, v.detune] : [0];
      for (const d of dets) {
        const osc = ctx.createOscillator();
        osc.type = v.wave;
        osc.frequency.setValueAtTime(hz, when);
        if (d) osc.detune.setValueAtTime(d, when);
        osc.connect(g);
        osc.start(when);
        osc.stop(when + dur);
      }
    }
```

- [ ] **Step 5: Add the music-bus lowpass in `ensureMusicGraph()`**

In `ensureMusicGraph()`, find the graph creation (currently around lines 238-241):

```ts
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      this.musicGain.connect(this.ctx.destination);
    }
```

Replace it with (route the bus through a brighter ~5 kHz lowpass so BGM loses its brittle top but the melody still reads):

```ts
    if (!this.musicGain) {
      this.musicGain = this.ctx.createGain();
      const warm = this.ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 5000;
      this.musicGain.connect(warm).connect(this.ctx.destination);
    }
```

- [ ] **Step 6: Run the audio tests + typecheck**

Run: `npx vitest run tests/audio-facade.test.ts`
Expected: PASS — all existing assertions green (no recipe changed yet; the new code paths are inert until Task 2 uses `detune`/`sub`).

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/audio.ts
git commit -m "feat(audio): warmth signal path — SFX+music lowpass, softer attack, detune/sub tone layers"
```

---

### Task 2: Per-sound retune + BGM pad voices

Uses the Task 1 mechanism to warm the four requested sounds and fill out the BGM with a soft pad voice under each non-boss track.

**Files:**
- Modify: `src/ui/audio.ts` (`RECIPES` `tileSelect`/`tileDeal`/`purchase`/`sell` ~lines 51-59, `MUSIC` `menu`/`play`/`shop` lead detune + new pad voice ~lines 106-139)
- Test: `tests/audio-facade.test.ts` (add one voice-count assertion)

**Interfaces:**
- Consumes: `detune`/`sub` tone fields and `Voice.detune` from Task 1.
- Produces: `menu`/`play`/`shop` each have **3 voices** (lead + bass + pad); `boss` keeps 2.

- [ ] **Step 1: Write the failing test for the pad voice**

In `tests/audio-facade.test.ts`, inside the `describe('BGM (phase 2) — pure data + no-op safety', ...)` block, add this test after the existing `'every track exists ...'` test (after line 60):

```ts
  it('non-boss tracks carry a third (pad) voice for a fuller bed', () => {
    for (const name of MUSIC_TRACKS) {
      const expected = name === 'boss' ? 2 : 3;
      expect(MUSIC[name].voices.length).toBe(expected);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/audio-facade.test.ts -t "third (pad) voice"`
Expected: FAIL — `menu`/`play`/`shop` currently have 2 voices, not 3.

- [ ] **Step 3: Retune the four SFX recipes**

In `src/ui/audio.ts`, in the `RECIPES` map, replace the `tileSelect` line (currently line 51):

```ts
  tileSelect:       { gain: 0.22, dur: 0.06, tones: [{ wave: 'square', from: 150, to: 90 }], noise: { cutoff: 2200 } },
```

with (adds a sub-octave for woody body, lowers the noise cutoff so the slap is dry not tinny):

```ts
  tileSelect:       { gain: 0.24, dur: 0.07, tones: [{ wave: 'square', from: 150, to: 90, sub: true }], noise: { cutoff: 1400 } },
```

Replace the `tileDeal` line (currently line 52):

```ts
  tileDeal:         { gain: 0.16, dur: 0.07, tones: [{ wave: 'triangle', from: 520, to: 380 }], noise: { cutoff: 3000 } },
```

with (rounder "fwip" — detuned + sub for body, softer noise):

```ts
  tileDeal:         { gain: 0.17, dur: 0.08, tones: [{ wave: 'triangle', from: 480, to: 340, detune: 8, sub: true }], noise: { cutoff: 1800 } },
```

Replace the `purchase` line (currently line 58):

```ts
  purchase:         { gain: 0.26, dur: 0.22, tones: [{ wave: 'triangle', from: 784 }, { wave: 'triangle', from: 1046, delay: 0.05 }, { wave: 'triangle', from: 1318, delay: 0.10 }], noise: { cutoff: 3000 } },
```

with (detuned shimmer so the coin ring is fuller, softer noise):

```ts
  purchase:         { gain: 0.26, dur: 0.22, tones: [{ wave: 'triangle', from: 784, detune: 6 }, { wave: 'triangle', from: 1046, delay: 0.05, detune: 6 }, { wave: 'triangle', from: 1318, delay: 0.10, detune: 6 }], noise: { cutoff: 2200 } },
```

Replace the `sell` line (currently line 59):

```ts
  sell:             { gain: 0.22, dur: 0.16, tones: [{ wave: 'triangle', from: 988 }, { wave: 'triangle', from: 1318, delay: 0.05 }], noise: { cutoff: 2600 } },
```

with:

```ts
  sell:             { gain: 0.22, dur: 0.16, tones: [{ wave: 'triangle', from: 988, detune: 6 }, { wave: 'triangle', from: 1318, delay: 0.05, detune: 6 }], noise: { cutoff: 2000 } },
```

- [ ] **Step 4: Add lead detune + a pad voice to `menu`, `play`, `shop`**

In `src/ui/audio.ts`, in the `MUSIC` map, replace the `menu` track (currently lines 108-114):

```ts
  menu: {
    bpm: 76,
    voices: [
      { wave: 'triangle', gain: 0.16, steps: ['C4', R, R, 'E4', R, R, 'G4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.09, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```

with (lead thickened with `detune`, plus a soft sine pad an octave above the bass roots):

```ts
  menu: {
    bpm: 76,
    voices: [
      { wave: 'triangle', gain: 0.16, detune: 7, steps: ['C4', R, R, 'E4', R, R, 'G4', R, 'A4', R, 'G4', R, 'E4', R, 'D4', R] },
      { wave: 'square',   gain: 0.09, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
      { wave: 'sine',     gain: 0.06, steps: ['C3', R, R, R, 'A2', R, R, R, 'F2', R, R, R, 'G2', R, R, R] },
    ],
  },
```

Replace the `play` track (currently lines 116-122):

```ts
  play: {
    bpm: 96,
    voices: [
      { wave: 'triangle', gain: 0.15, steps: ['C4', R, 'E4', 'G4', R, 'E4', 'C4', R, 'D4', R, 'F4', 'A4', R, 'G4', 'E4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```

with:

```ts
  play: {
    bpm: 96,
    voices: [
      { wave: 'triangle', gain: 0.15, detune: 7, steps: ['C4', R, 'E4', 'G4', R, 'E4', 'C4', R, 'D4', R, 'F4', 'A4', R, 'G4', 'E4', R] },
      { wave: 'square',   gain: 0.10, steps: ['C2', R, R, R, 'A1', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
      { wave: 'sine',     gain: 0.06, steps: ['C3', R, R, R, 'A2', R, R, R, 'F2', R, R, R, 'G2', R, R, R] },
    ],
  },
```

Replace the `shop` track (currently lines 124-130):

```ts
  shop: {
    bpm: 100,
    voices: [
      { wave: 'triangle', gain: 0.16, steps: ['E4', R, 'G4', 'A4', R, 'G4', 'E4', R, 'D4', R, 'E4', 'G4', R, 'D4', 'C4', R] },
      { wave: 'square',   gain: 0.09, steps: ['A1', R, R, R, 'E2', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
    ],
  },
```

with:

```ts
  shop: {
    bpm: 100,
    voices: [
      { wave: 'triangle', gain: 0.16, detune: 7, steps: ['E4', R, 'G4', 'A4', R, 'G4', 'E4', R, 'D4', R, 'E4', 'G4', R, 'D4', 'C4', R] },
      { wave: 'square',   gain: 0.09, steps: ['A1', R, R, R, 'E2', R, R, R, 'F1', R, R, R, 'G1', R, R, R] },
      { wave: 'sine',     gain: 0.06, steps: ['A2', R, R, R, 'E3', R, R, R, 'F2', R, R, R, 'G2', R, R, R] },
    ],
  },
```

- [ ] **Step 5: Run the audio tests + typecheck**

Run: `npx vitest run tests/audio-facade.test.ts`
Expected: PASS — the new pad-voice test passes (3 voices for menu/play/shop, 2 for boss), and the existing "all voices share one loop length" test still passes because every pad voice is 16 steps of valid notes/rests.

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/ui/audio.ts tests/audio-facade.test.ts
git commit -m "feat(audio): warmer tak/deal/coin retune + BGM pad voice + detuned leads"
```

---

### Task 3: Stronger cursor tilt + cursor-following sheen

Amplifies the Balatro parallax (bigger angle/lift/scale), drives lift/scale by an intensity var so the return eases instead of snapping, adds overshoot easing, and adds a cursor-following sheen element to every tilt target.

**Files:**
- Modify: `src/ui/hooks.ts` (`usePointerTilt` ~lines 131-164 — set/clear `--tilt-k`, eased leave)
- Modify: `src/ui/components/Tile.tsx` (add a sheen child span ~before line 135)
- Modify: `src/ui/components/TiltCard.tsx` (add a sheen child span)
- Modify: `src/ui/styles/play.css` (`.tilting` transform ~lines 1131-1140; add `.tilt-sheen` rules)

**Interfaces:**
- Consumes: nothing from prior tasks (independent).
- Produces: `usePointerTilt` writes `--tilt-x`, `--tilt-y` (unchanged) **and** `--tilt-k` (1 while hovering, eased to 0 on leave). The `.tilt-sheen` element reads all three via inheritance.

- [ ] **Step 1: Amplify + ease the tilt in `usePointerTilt`**

In `src/ui/hooks.ts`, replace the body of `usePointerTilt` (currently lines 132-163, the whole `useEffect`) with (adds `--tilt-k` intensity, clears the leave timer on re-enter, and eases everything back to flat before removing the class):

```ts
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || reducedMotion()) return;
    let raf = 0;
    let leaveTimer = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty('--tilt-y', String(nx)); // horizontal cursor → rotateY
      el.style.setProperty('--tilt-x', String(-ny)); // vertical cursor → rotateX (inverted)
    };
    const onMove = (e: PointerEvent) => {
      window.clearTimeout(leaveTimer); // cancel a pending flatten if we re-entered
      const r = el.getBoundingClientRect();
      nx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1);
      ny = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1);
      el.classList.add('tilting');
      el.style.setProperty('--tilt-k', '1'); // full intensity (drives lift/scale/sheen)
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onLeave = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      // Ease everything back to flat (vars → 0) WHILE .tilting is still applied, so the
      // transform transitions instead of snapping; drop the class after the transition.
      el.style.setProperty('--tilt-x', '0');
      el.style.setProperty('--tilt-y', '0');
      el.style.setProperty('--tilt-k', '0');
      window.clearTimeout(leaveTimer);
      leaveTimer = window.setTimeout(() => {
        el.classList.remove('tilting');
        el.style.removeProperty('--tilt-x');
        el.style.removeProperty('--tilt-y');
        el.style.removeProperty('--tilt-k');
      }, 180);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(leaveTimer);
    };
  }, [ref, enabled]);
```

- [ ] **Step 2: Add the sheen span to `Tile.tsx`**

In `src/ui/components/Tile.tsx`, find the end of the returned JSX (currently lines 127-135):

```tsx
      {!faceDown && tooltip && (
        <span className="tt-card tile-tt" role="tooltip">
          <span className="tt-title">{tooltip.title}</span>
          <span className="tt-desc">
            <span className="tt-body">{richText(tooltip.body)}</span>
          </span>
        </span>
      )}
    </div>
  );
```

Insert the sheen span right before the closing `</div>` (it is inert until the parent gets `.tilting`, so it is harmless on `mini`/face-down tiles):

```tsx
      {!faceDown && tooltip && (
        <span className="tt-card tile-tt" role="tooltip">
          <span className="tt-title">{tooltip.title}</span>
          <span className="tt-desc">
            <span className="tt-body">{richText(tooltip.body)}</span>
          </span>
        </span>
      )}
      <span className="tilt-sheen" aria-hidden />
    </div>
  );
```

- [ ] **Step 3: Add the sheen span to `TiltCard.tsx`**

In `src/ui/components/TiltCard.tsx`, replace the returned JSX (currently lines 10-14):

```tsx
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
```

with (sheen as the last child so it never trips a `:first-child` selector; inherits the tilt vars from the parent):

```tsx
  return (
    <div ref={ref} {...rest}>
      {children}
      <span className="tilt-sheen" aria-hidden />
    </div>
  );
```

- [ ] **Step 4: Update the `.tilting` CSS + add the sheen rules**

In `src/ui/styles/play.css`, replace the `.tilting` block (currently lines 1131-1140):

```css
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

with (bigger angle/lift/scale; lift+scale driven by `--tilt-k` so the leave eases to flat; overshoot easing for a springy pop):

```css
.tile.tilting,
.joker.tilting,
.consumable.tilting {
  transform: perspective(600px)
             rotateX(calc(var(--tilt-x, 0) * 14deg))
             rotateY(calc(var(--tilt-y, 0) * 14deg))
             translateY(calc(var(--tilt-k, 1) * -8px))
             scale(calc(1 + var(--tilt-k, 1) * 0.06)) !important;
  transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 4;
}
/* Cursor-following specular sheen (Balatro holo glint). A last-child overlay on every
   tilt target; inherits --tilt-x/--tilt-y/--tilt-k from the parent. Screen-blends a
   soft white glare that tracks the cursor and fades with the tilt intensity (--tilt-k).
   Inert (opacity 0) until the parent gains .tilting, so mini/face-down tiles are unaffected. */
.tilt-sheen {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  z-index: 2;
  mix-blend-mode: screen;
  background: radial-gradient(circle at
      calc(50% + var(--tilt-y, 0) * 45%)
      calc(50% - var(--tilt-x, 0) * 45%),
      rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 55%);
  transition: opacity 0.18s ease;
}
.tilting > .tilt-sheen {
  opacity: calc(var(--tilt-k, 0) * 0.55);
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc -b`
Expected: PASS (the sheen span is a plain `<span>`; `usePointerTilt`'s signature is unchanged).

- [ ] **Step 6: Verify in the running game**

Use the `verify` skill (or `run`) to launch the game. In the play screen (unlock sound/color via Settings "unlock all" if needed), confirm:
- Hovering a hand tile, a joker, and a consumable tilts it noticeably more than before (~14° max), with a visible white glare that tracks the cursor.
- Moving the cursor off eases the card back to flat (no hard snap).
- With OS "reduce motion" on, no tilt or sheen occurs (the hook early-returns).

- [ ] **Step 7: Commit**

```bash
git add src/ui/hooks.ts src/ui/components/Tile.tsx src/ui/components/TiltCard.tsx src/ui/styles/play.css
git commit -m "feat(ui): stronger springy card tilt + cursor-following sheen"
```

---

## Self-Review

**1. Spec coverage:**
- Spec §Task 1 (1a global rounding) → Task 1 Steps 3 (SFX lowpass) + 5 (music-bus lowpass). ✓
- Spec §Task 1 (1b detune/sub) → Task 1 Steps 1 (fields) + 3 (SFX layering) + 4 (BGM voice detune). ✓
- Spec §Task 1 (1c softer envelopes) → Task 1 Step 3 (12 ms attack). ✓
- Spec §Task 1 (1d per-sound retune + BGM pad) → Task 2 Steps 3-4. ✓
- Spec §Task 2 (2a bigger response) → Task 3 Step 4 (14°/−8px/1.06×). ✓
- Spec §Task 2 (2b sheen) → Task 3 Steps 2-4 (`.tilt-sheen`). ✓
- Spec §Task 2 (2c springier motion) → Task 3 Steps 1 (`--tilt-k` eased leave) + 4 (overshoot easing). ✓
- Spec §Testing (audio assertions green + ≥3-voice check) → Task 2 Steps 1-2-5. ✓
- Spec §Testing (tilt verified by running) → Task 3 Step 6. ✓
- Spec §Non-goals (no files, no #4 change, no engine change) → Global Constraints. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps — every code step shows full before/after. ✓

**3. Type consistency:** `detune?`/`sub?` added to the tone type (Task 1 Step 1) and consumed in Task 2 Step 3; `Voice.detune?` added (Task 1 Step 1), consumed in `scheduleStep` (Task 1 Step 4) and Task 2 Step 4. `--tilt-k` written in `usePointerTilt` (Task 3 Step 1), read by `.tilting` transform and `.tilt-sheen` opacity (Task 3 Step 4). `.tilt-sheen` class written in Tile.tsx/TiltCard.tsx (Task 3 Steps 2-3), styled in play.css (Task 3 Step 4). All consistent. ✓
