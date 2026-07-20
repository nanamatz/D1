# Sound Phase 1 (SFX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add chiptune/8-bit **SFX** for the core loop (settle sequence, interactions, shop) using a single swappable audio facade that **synthesizes** every sound with the Web Audio API — no binary assets, no new dependencies.

**Architecture:** One module singleton `src/ui/audio.ts` owns an `AudioContext`, a master→group(music/sfx) gain graph, and a table of synth *recipes* (oscillator + envelope, plus filtered noise for swooshes). Components call `audio.play('name')` at trigger points; the facade is a no-op until the context is unlocked by the first user gesture and no-ops entirely when Web Audio is absent (Node/tests), which keeps its pure logic (gain math, recipe registry, unlock state) unit-testable. Settings volume sliders drive `audio.setVolumes`. Because settle SFX are fired from inside the existing speed-scaled beat timers in `settle.tsx`, game-speed scaling of SFX cadence is automatic.

**Tech Stack:** TypeScript strict, React, Web Audio API (browser-native), Vitest. **No Howler.js, no audio files** — the facade is the swap seam if real chiptune replaces synthesis later.

## Global Constraints

- **No new dependencies** and **no binary assets** — synthesis only (user decision 2026-07-19; the work order's "library implementer's choice / CC0 packs" is satisfied by the facade seam + a manifest, deferring real assets).
- **Phase 1 is SFX only. BGM (work order B-2) is explicitly OUT OF SCOPE** — do not add music tracks.
- Engine (`src/engine/`) stays audio-free; all audio lives in `src/ui/`. Audio is presentation, never game rules.
- **Browser autoplay policy:** the `AudioContext` may only start after the first user gesture — unlock on first pointerdown/keydown; queue/emit nothing before unlock (calls before unlock are dropped, not buffered).
- **Game speed (1/2/4×) scales settle SFX scheduling** — satisfied by emitting settle SFX from the existing `BASE_STEP/speed` beat timers; do not add a second timing source.
- Wire the existing Settings sliders (`master`/`music`/`sfx`, 0–100 in `src/ui/settings.ts`) to the real mixer; values already persist via `usePersistedState`.
- Reduced-motion must NOT mute audio (separate concern); the only mute path is the sliders (0 = silent).
- **Log every sound's identity/source in `assets/AUDIO_LICENSES.md`** — here, "synthesized, no external asset, CC0/original" per recipe.
- Keep all playback behind the `audio.ts` facade so the synth can be swapped for sample playback with no call-site changes.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: The audio facade — context, mixer, synth recipes, unlock

**Files:**
- Create: `src/ui/audio.ts`
- Create: `assets/AUDIO_LICENSES.md`
- Test: `tests/audio-facade.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces (later tasks rely on these EXACT names):
  - `export type SfxName` — the union of every sound id (listed below).
  - `export const audio` with methods:
    - `unlock(): void` — resume/create the context (idempotent; safe pre-gesture).
    - `setVolumes(v: { master: number; music: number; sfx: number }): void` — 0–100 each, clamped.
    - `play(name: SfxName, opts?: { step?: number }): void` — emit a sound; no-op if not unlocked or no Web Audio. `opts.step` raises pitch for `countTick` (rising count-up).
    - `isUnlocked(): boolean`
  - `export function effectiveGain(name: SfxName, v: { master: number; music: number; sfx: number }): number` — pure; the gain a sound would play at = `(master/100) * (group/100) * recipe.gain`, where group is `music` for `bgm*` (none in phase 1) else `sfx`. Exposed for unit testing.
  - `export const SFX_NAMES: readonly SfxName[]` — for the manifest/coverage test.

The full `SfxName` union (22 sounds):
`'tilePop' | 'countTick' | 'jokerBlip' | 'stamp' | 'multFill' | 'totalRoll' | 'clearFanfare' | 'failSting' | 'tilePick' | 'tilePlace' | 'tileSelect' | 'dragSnap' | 'discardSwoosh' | 'submitThock' | 'buttonPress' | 'transitionWhoosh' | 'purchase' | 'sell' | 'reroll' | 'packOpen' | 'voucherRedeem' | 'catMeow'`

- [ ] **Step 1: Write the failing test**

Create `tests/audio-facade.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { audio, effectiveGain, SFX_NAMES, type SfxName } from '../src/ui/audio';

const FULL = { master: 100, music: 100, sfx: 100 };

describe('audio facade — pure logic (no Web Audio in Node)', () => {
  it('play() is a safe no-op in Node (no AudioContext) and does not throw', () => {
    expect(() => audio.play('tilePop')).not.toThrow();
    expect(audio.isUnlocked()).toBe(false); // never unlocks without a real context
  });

  it('unlock() is safe to call with no Web Audio present', () => {
    expect(() => audio.unlock()).not.toThrow();
    expect(audio.isUnlocked()).toBe(false);
  });

  it('effectiveGain multiplies master × group × recipe gain', () => {
    const full = effectiveGain('tilePop', FULL);
    // half master → half gain
    expect(effectiveGain('tilePop', { ...FULL, master: 50 })).toBeCloseTo(full / 2, 5);
    // sfx group zeroed → silent
    expect(effectiveGain('tilePop', { ...FULL, sfx: 0 })).toBe(0);
    // master zeroed → silent
    expect(effectiveGain('tilePop', { ...FULL, master: 0 })).toBe(0);
  });

  it('every SfxName has a recipe (positive base gain) and SFX_NAMES is complete', () => {
    expect(SFX_NAMES.length).toBe(22);
    for (const n of SFX_NAMES) {
      expect(effectiveGain(n as SfxName, FULL)).toBeGreaterThan(0);
    }
  });

  it('setVolumes clamps out-of-range values instead of throwing', () => {
    expect(() => audio.setVolumes({ master: 999, music: -5, sfx: 50 })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio-facade.test.ts`
Expected: FAIL — `Cannot find module '../src/ui/audio'`.

- [ ] **Step 3: Implement `src/ui/audio.ts`**

```ts
/**
 * Audio facade (work order B, phase 1 — SFX). One module singleton owns the
 * AudioContext and a master→group gain graph; components call `audio.play(name)`.
 *
 * Every sound is SYNTHESIZED (no asset files) via small oscillator/noise recipes,
 * so this whole layer is swappable for real chiptune later without touching a
 * single call site — that is the point of the facade (see assets/AUDIO_LICENSES.md).
 *
 * Autoplay policy: browsers only allow an AudioContext to make sound after a user
 * gesture. We install a one-shot pointerdown/keydown listener that resumes the
 * context; before that, and in Node/tests (no AudioContext), `play` is a silent
 * no-op — never a throw, never a buffer.
 */

export type SfxName =
  | 'tilePop' | 'countTick' | 'jokerBlip' | 'stamp' | 'multFill' | 'totalRoll'
  | 'clearFanfare' | 'failSting'
  | 'tilePick' | 'tilePlace' | 'tileSelect' | 'dragSnap' | 'discardSwoosh'
  | 'submitThock' | 'buttonPress' | 'transitionWhoosh'
  | 'purchase' | 'sell' | 'reroll' | 'packOpen' | 'voucherRedeem' | 'catMeow';

type Wave = OscillatorType; // 'sine' | 'square' | 'sawtooth' | 'triangle'

interface Recipe {
  /** base loudness 0..1, before master/sfx scaling */
  gain: number;
  /** overall length in seconds */
  dur: number;
  /** one or more tone layers; noise adds a filtered-noise burst */
  tones?: { wave: Wave; from: number; to?: number }[];
  noise?: { cutoff: number };
  /** 'music' routes through the music bus (none in phase 1) */
  bus?: 'sfx' | 'music';
}

// Chiptune palette: square/triangle blips, short envelopes, a couple of noise
// swooshes. Frequencies in Hz; `to` sweeps the pitch across `dur`.
const RECIPES: Record<SfxName, Recipe> = {
  tilePop:          { gain: 0.22, dur: 0.07, tones: [{ wave: 'square', from: 520, to: 640 }] },
  countTick:        { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 440 }] },
  jokerBlip:        { gain: 0.25, dur: 0.10, tones: [{ wave: 'triangle', from: 660, to: 990 }] },
  stamp:            { gain: 0.30, dur: 0.12, tones: [{ wave: 'square', from: 180, to: 120 }], noise: { cutoff: 900 } },
  multFill:         { gain: 0.24, dur: 0.14, tones: [{ wave: 'sawtooth', from: 300, to: 720 }] },
  totalRoll:        { gain: 0.20, dur: 0.20, tones: [{ wave: 'square', from: 400, to: 880 }] },
  clearFanfare:     { gain: 0.32, dur: 0.40, tones: [{ wave: 'square', from: 523 }, { wave: 'square', from: 784 }, { wave: 'triangle', from: 1046 }] },
  failSting:        { gain: 0.30, dur: 0.35, tones: [{ wave: 'sawtooth', from: 300, to: 90 }] },
  tilePick:         { gain: 0.18, dur: 0.05, tones: [{ wave: 'triangle', from: 600 }] },
  tilePlace:        { gain: 0.18, dur: 0.05, tones: [{ wave: 'triangle', from: 400 }] },
  tileSelect:       { gain: 0.16, dur: 0.04, tones: [{ wave: 'square', from: 700 }] },
  dragSnap:         { gain: 0.16, dur: 0.05, tones: [{ wave: 'square', from: 300, to: 500 }] },
  discardSwoosh:    { gain: 0.24, dur: 0.18, noise: { cutoff: 1600 } },
  submitThock:      { gain: 0.30, dur: 0.10, tones: [{ wave: 'square', from: 160, to: 90 }], noise: { cutoff: 700 } },
  buttonPress:      { gain: 0.18, dur: 0.05, tones: [{ wave: 'square', from: 380, to: 300 }] },
  transitionWhoosh: { gain: 0.20, dur: 0.22, noise: { cutoff: 1200 } },
  purchase:         { gain: 0.28, dur: 0.16, tones: [{ wave: 'square', from: 784 }, { wave: 'square', from: 1046 }] },
  sell:             { gain: 0.24, dur: 0.12, tones: [{ wave: 'square', from: 660, to: 440 }] },
  reroll:           { gain: 0.22, dur: 0.12, tones: [{ wave: 'sawtooth', from: 300, to: 600 }] },
  packOpen:         { gain: 0.30, dur: 0.30, tones: [{ wave: 'square', from: 440, to: 880 }], noise: { cutoff: 2000 } },
  voucherRedeem:    { gain: 0.28, dur: 0.24, tones: [{ wave: 'triangle', from: 660 }, { wave: 'triangle', from: 990 }] },
  catMeow:          { gain: 0.30, dur: 0.30, tones: [{ wave: 'sawtooth', from: 620, to: 780 }] },
};

export const SFX_NAMES = Object.keys(RECIPES) as SfxName[];

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/** Pure gain computation — master × group × recipe, each 0..1. Exposed for tests. */
export function effectiveGain(
  name: SfxName,
  v: { master: number; music: number; sfx: number },
): number {
  const r = RECIPES[name];
  const group = r.bus === 'music' ? v.music : v.sfx;
  return clamp(v.master, 0, 100) / 100 * (clamp(group, 0, 100) / 100) * r.gain;
}

class Audio {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private vol = { master: 80, music: 70, sfx: 80 };

  constructor() {
    // Install the one-shot unlock gesture listener as soon as this module loads
    // in a browser. Guarded for Node/SSR where `window` is undefined.
    if (typeof window !== 'undefined') {
      const onGesture = () => this.unlock();
      window.addEventListener('pointerdown', onGesture, { once: true });
      window.addEventListener('keydown', onGesture, { once: true });
    }
  }

  private AC(): typeof AudioContext | null {
    if (typeof window === 'undefined') return null;
    return window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ?? null;
  }

  unlock(): void {
    const AC = this.AC();
    if (!AC) return; // no Web Audio (Node/tests) — stay a no-op
    if (!this.ctx) {
      try { this.ctx = new AC(); } catch { return; }
    }
    void this.ctx.resume().then(() => { this.unlocked = true; }).catch(() => {});
    // Some browsers resume synchronously; reflect that immediately too.
    if (this.ctx.state === 'running') this.unlocked = true;
  }

  isUnlocked(): boolean { return this.unlocked; }

  setVolumes(v: { master: number; music: number; sfx: number }): void {
    this.vol = {
      master: clamp(v.master, 0, 100),
      music: clamp(v.music, 0, 100),
      sfx: clamp(v.sfx, 0, 100),
    };
  }

  play(name: SfxName, opts?: { step?: number }): void {
    if (!this.ctx || !this.unlocked) return; // pre-gesture / no Web Audio → drop
    const g = effectiveGain(name, this.vol);
    if (g <= 0) return;
    const r = RECIPES[name];
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    // Percussive envelope: fast attack, exponential decay across the recipe dur.
    out.gain.setValueAtTime(0.0001, now);
    out.gain.exponentialRampToValueAtTime(g, now + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, now + r.dur);
    out.connect(ctx.destination);

    // Rising count-up tick: each consecutive tick steps the pitch up, resetting
    // per word (the caller passes an incrementing `step`, cleared between words).
    const semis = opts?.step ? Math.min(opts.step, 24) : 0;
    const bend = Math.pow(2, semis / 12);

    for (const t of r.tones ?? []) {
      const osc = ctx.createOscillator();
      osc.type = t.wave;
      osc.frequency.setValueAtTime(t.from * bend, now);
      if (t.to !== undefined) osc.frequency.exponentialRampToValueAtTime(t.to * bend, now + r.dur);
      osc.connect(out);
      osc.start(now);
      osc.stop(now + r.dur);
    }
    if (r.noise) {
      const frames = Math.floor(ctx.sampleRate * r.dur);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = r.noise.cutoff;
      src.connect(lp).connect(out);
      src.start(now);
      src.stop(now + r.dur);
    }
  }
}

export const audio = new Audio();
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/audio-facade.test.ts` → PASS. Then `npx tsc --noEmit` → clean. (`lib.dom` provides the Web Audio types; if `AudioContext`/`OscillatorType` are unknown, confirm `tsconfig.json` `lib` includes `"DOM"` — it must, since the UI already uses `window`/`document`.)

- [ ] **Step 5: Create `assets/AUDIO_LICENSES.md`**

```markdown
# Audio asset licenses

Phase 1 audio is **fully synthesized** at runtime by `src/ui/audio.ts` (Web Audio
oscillators + filtered noise). There are **no external audio files** in this
project, so there is nothing third-party to attribute.

| Sound id | Source | License |
|---|---|---|
| all SFX (`SFX_NAMES` in `src/ui/audio.ts`) | Original synthesis, no sample | CC0 / original |

When real chiptune samples replace synthesis (phase 2+), add each file here with
its source URL and license BEFORE committing the asset. The `audio.play(name)`
facade is the swap seam — call sites do not change.
```

- [ ] **Step 6: Commit**

```bash
git add src/ui/audio.ts assets/AUDIO_LICENSES.md tests/audio-facade.test.ts
git commit -m "feat : synthesized audio facade (Web Audio mixer + SFX recipes + gesture unlock)"
```

---

### Task 2: Wire the mixer to Settings and unlock on first gesture

**Files:**
- Modify: `src/ui/settings.ts` (the `useEffect` in `useSettings`, ~lines 39–44)
- Test: none new (the effect is glue; `effectiveGain`/`setVolumes` are already covered, and there is no Web Audio in Node to assert playback). Verify via tsc + full suite.

**Interfaces:**
- Consumes: `audio.setVolumes` (Task 1).
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Implement** — add `audio` import and push volumes whenever they change. In `src/ui/settings.ts`:

```ts
import { audio } from './audio';
```

Extend the existing document-effect (do not add a second effect) so it also syncs volumes, and add the volume deps:

```ts
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.uiScale / 100));
    document.body.classList.toggle('force-reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('cb-safe', settings.colorBlind);
    // Mixer: push the persisted slider values into the audio facade (work order B).
    audio.setVolumes({ master: settings.master, music: settings.music, sfx: settings.sfx });
  }, [
    settings.uiScale, settings.reducedMotion, settings.colorBlind,
    settings.master, settings.music, settings.sfx,
  ]);
```

(The facade already installs its own gesture-unlock listener on load, so no explicit unlock call is needed here. `useSettings` is called once at the top of the app via `Options`/wherever settings mount; if it is NOT always mounted, ALSO call `audio.setVolumes(DEFAULT_SETTINGS)` once at module load in audio.ts — but check: grep `useSettings(` to confirm it mounts on app start. If it only mounts inside Options, move the volume-sync effect to a top-level component that is always mounted, e.g. `App.tsx`, reading a `useSettings()` there.)

- [ ] **Step 2: Confirm mount point**

Run: `grep -rn "useSettings(" src/ui`
If `useSettings` is only used inside `Options.tsx` (mounted only on the Options screen), volumes would only sync while Options is open. In that case, add `const { settings } = useSettings();` plus the volume-sync effect to `App.tsx` so it is always live. If it is already app-global, leave as-is. Document which you found in the report.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` (clean) and `npx vitest run` (all green).

- [ ] **Step 4: Commit**

```bash
git add src/ui/settings.ts src/ui/App.tsx
git commit -m "feat : wire Settings master/music/sfx sliders to the audio mixer"
```

---

### Task 3: Settle-sequence SFX (speed-scaled beats)

**Files:**
- Modify: `src/ui/settle.tsx` (the animated timeline `beats.forEach` block, ~lines 178–231; and the reduced-motion path ~lines 155–170)
- Test: none new (settle playback needs the DOM timeline; the beat→sound mapping is exercised by the in-app smoke in Task 6). Verify tsc + suite stay green.

**Interfaces:**
- Consumes: `audio.play(name, opts?)` (Task 1).
- Produces: nothing.

Beat→sound mapping (fire inside the existing per-beat `setTimeout`, so cadence already scales with `speed`):
- `e.kind === 'tile'` → `audio.play('tilePop')` AND a rising `audio.play('countTick', { step })` where `step` increments per tile within the word and resets each settle.
- `e.kind === 'suit'` or `e.kind === 'letterHand'` → `audio.play('stamp')`.
- `e.kind === 'joker'` or `e.kind === 'font'` → `audio.play('jokerBlip')`.
- `e.kind === 'material'` → `audio.play('multFill')`.
- `e.kind === 'boss'` → `audio.play('stamp')`.
- The final hold timer (settle lands) → `audio.play('totalRoll')`.

Clear fanfare / fail sting are NOT here — they fire on blind resolution (Task 6 notes them as already-covered by the verdict, but wire them in useGame in Task 5's sibling? No — put them in Task 6 verification only if a natural hook exists). For THIS task, only the per-beat sounds + totalRoll.

- [ ] **Step 1: Implement** — add `import { audio } from '../audio';` to settle.tsx.

In the animated timeline, before `beats.forEach(...)`, add a per-settle tick counter:

```ts
    let tickStep = 0;
```

Inside the `setTimeout` callback, after the existing `({ chips, mult } = accumulate(...))` line, add the sound emit (mirror the existing `if (e.kind === ...)` structure — do NOT restructure it):

```ts
          // SFX (work order B): fire inside the speed-scaled beat timer so the
          // cadence tracks game speed automatically. Facade no-ops until unlocked.
          if (e.kind === 'tile') {
            audio.play('tilePop');
            audio.play('countTick', { step: tickStep++ });
          } else if (e.kind === 'suit' || e.kind === 'letterHand' || e.kind === 'boss') {
            audio.play('stamp');
          } else if (e.kind === 'joker' || e.kind === 'font') {
            audio.play('jokerBlip');
          } else if (e.kind === 'material') {
            audio.play('multFill');
          }
```

Place this emit block at the TOP of the callback (right after the `accumulate` fold), so it does not depend on the view-setting branch that follows. In the final-hold timer (the `timers.push(setTimeout(() => { setView(IDLE); onCompleteRef.current?.(); }, ...))`), add `audio.play('totalRoll');` before `setView(IDLE)`.

For the reduced-motion instant-fill path, emit a single summary sound so muting-by-motion doesn't apply: after the collapsed `setView(...)`, add `audio.play('totalRoll');` (one sound, since there are no per-beat frames). Do NOT gate any audio on `reducedMotion()` — reduced motion must not mute (global constraint).

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit` (clean) and `npx vitest run` (green — settle timing tests in `tests/playtest05-settle-gate.test.ts` must still pass; the audio calls are no-ops in Node so `settleDurationMs`/beat counts are unaffected).

- [ ] **Step 3: Commit**

```bash
git add src/ui/settle.tsx
git commit -m "feat : settle-sequence SFX — tile pop + rising count tick, stamp, joker blip, mult, total roll"
```

---

### Task 4: Interaction SFX (tiles, drag, discard, submit, buttons, transitions)

**Files:**
- Modify: `src/ui/components/StagePanel.tsx` (tile select/stage/unstage handlers, discard, drag drop; the play button — but see note)
- Modify: `src/ui/components/ScreenTransition.tsx` (fire `transitionWhoosh` on screen change)
- Test: none new (DOM interaction; covered by the Task 6 in-app smoke). Verify tsc + suite.

**Interfaces:**
- Consumes: `audio.play` (Task 1).
- Produces: nothing.

Mapping:
- Stage a tile (`g.toggleTile(id)` when moving hand→staged) → `audio.play('tilePlace')`; unstage (staged→hand) → `audio.play('tilePick')`. For a plain select/deselect click via `onSelect` → `audio.play('tileSelect')`.
- Drag drop that snaps into the zone → `audio.play('dragSnap')`.
- Discard (`doDiscard`) → `audio.play('discardSwoosh')`.
- Submit / play word (`g.playWord`) → `audio.play('submitThock')`.
- Screen transition → `audio.play('transitionWhoosh')`.
- Generic button press: a light `buttonPress` on primary buttons. To avoid touching every component, wire `buttonPress` ONLY on the play/discard buttons here (and let shop buttons get their specific sounds in Task 5). Do NOT globally intercept every `<button>` — YAGNI; the specific sounds are the ones players notice.

- [ ] **Step 1: Implement StagePanel** — add `import { audio } from '../audio';`.

Wrap the relevant callbacks. In the drop handler `onStageDrop`, where it currently calls `g.toggleTile(d.id)` for stage/unstage, add the matching sound (stage→`tilePlace`, unstage→`tilePick`), and add `audio.play('dragSnap')` at the top of a successful drop. For the tile `onSelect={g.toggleTile}` on the staged/hand rows, the click path should play `tileSelect` — pass a small wrapper: define
```ts
  const selectTile = (id: string) => { audio.play('tileSelect'); g.toggleTile(id); };
```
and use `onSelect={selectTile}` in place of `onSelect={g.toggleTile}` on the TileView instances (both rows). In `doDiscard` add `audio.play('discardSwoosh')` before `g.discard(validMarks)`. On the play button `onClick`, wrap: `onClick={() => { audio.play('submitThock'); g.playWord(); }}`.

- [ ] **Step 2: Implement ScreenTransition** — read `src/ui/components/ScreenTransition.tsx` first. It re-renders on `screenKey` change. Add `import { audio } from '../audio';` and a `useEffect(() => { audio.play('transitionWhoosh'); }, [screenKey])`. If it already has an effect keyed on `screenKey`, add the call there. Skip the very first mount if trivial (an effect fires on mount too — a whoosh on initial load is acceptable and unlock hasn't happened yet so it's a silent no-op anyway).

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/components/StagePanel.tsx src/ui/components/ScreenTransition.tsx
git commit -m "feat : interaction SFX — tile select/place/pick, drag snap, discard, submit, screen whoosh"
```

---

### Task 5: Shop SFX + cat meow on shop enter + clear/fail stings

**Files:**
- Modify: `src/ui/useGame.ts` (the `buy`, `sell`, `reroll`, `buyPack`, `buyVoucherAction` callbacks — add the purchase/sell/reroll/packOpen/voucherRedeem sounds on SUCCESS)
- Modify: `src/ui/components/RunView.tsx` (fire `catMeow` when `phase` becomes `'shop'`, `clearFanfare` when it becomes `'cashout'`, `failSting` when it becomes `'gameover'`)
- Test: none new. Verify tsc + suite.

**Interfaces:**
- Consumes: `audio.play` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Implement useGame shop sounds** — add `import { audio } from './audio';`. In each shop callback, play the sound only when the action SUCCEEDS (i.e. inside the branch that actually mutates state, after the engine call returns a success — mirror how each currently detects success; do NOT play if the guard `return prev`s). Mapping: `buy`→`purchase`, `sell`→`sell`, `reroll`→`reroll`, `buyPack`→`packOpen`, `buyVoucherAction`→`voucherRedeem`. Because these run inside `setState(prev => …)`, emit the sound in the success branch just before returning the new state (side-effect in a reducer is acceptable here for a fire-and-forget no-op-safe facade; keep it to the one `audio.play` line).

- [ ] **Step 2: Implement shop-enter meow + clear/fail stings** — in `src/ui/components/RunView.tsx`, add `import { audio } from '../audio';` and one phase-keyed effect that covers all three blind-resolution sounds plus the mascot beat:

```ts
  useEffect(() => {
    if (phase === 'shop') audio.play('catMeow');       // mascot beat on shop enter
    else if (phase === 'cashout') audio.play('clearFanfare'); // blind cleared (win)
    else if (phase === 'gameover') audio.play('failSting');   // run lost
  }, [phase]);
```

Place it near the existing phase effects (RunView already destructures `phase` and uses effects, e.g. line ~40/53). This fires each time the shop is entered (mascot beat), and plays the clear fanfare / fail sting on blind resolution — closing the B-1 settle-set (`clearFanfare`, `failSting`) that the per-beat Task 3 deliberately did not cover.

- [ ] **Step 3: Verify** — `npx tsc --noEmit` clean; `npx vitest run` green.

- [ ] **Step 4: Commit**

```bash
git add src/ui/useGame.ts src/ui/components/RunView.tsx
git commit -m "feat : shop SFX + cat meow on shop enter + clear fanfare / fail sting on blind resolution"
```

---

### Task 6: End-to-end verification + docs

**Files:**
- Modify: `docs/screens-spec.md` (§2.11 Settings — note the sliders now drive a live mixer) and/or `docs/UI_DESIGN.md` if it has an audio section — grep first, only touch what exists.
- Verify: the running app.

- [ ] **Step 1: Full green** — `npx vitest run` (all tests incl. `tests/audio-facade.test.ts`) and `npx tsc --noEmit` clean.

- [ ] **Step 2: In-app smoke (project `verify` skill / Playwright)** — audio can't be asserted by listening, so instrument the facade: in the Playwright page, before interacting, install a spy that counts `audio.play` calls by monkeypatching via a `window.__sfx` hook. To enable that hook, add to `audio.ts` `play()` (guard so it's dev-only and harmless): at the top of `play`, `if (typeof window !== 'undefined') (window as any).__sfxLog?.push?.(name);`. Then the test sets `window.__sfxLog = []` after unlock, performs: click title (unlock), start a run, select a tile, play a word, and asserts `__sfxLog` contains `'tileSelect'`, `'submitThock'`, and at least one `'tilePop'`. Confirm no console errors and that `audio.isUnlocked()` becomes true after the first click. (This proves the wiring fires without needing to hear anything.) NOTE: if adding the `__sfxLog` hook is deemed too invasive, instead assert only that an `AudioContext` is constructed after the first gesture and no exceptions are thrown during a full play→shop loop; document which you did.

- [ ] **Step 3: Manual-listen caveat** — record in the report that actual audible quality (whether the synth recipes sound good) is a human check the automated pass cannot make; the automated pass proves the *wiring* (right sound at right moment, speed-scaled, mixer-controlled, unlocked on gesture).

- [ ] **Step 4: Docs** — `grep -rn "mixer\|audio\|sound\|슬라이더\|볼륨" docs/screens-spec.md docs/UI_DESIGN.md`; update the Settings/audio note to say the master/music/sfx sliders now drive the live Web Audio mixer and Phase 1 ships SFX (BGM = Phase 2, still pending). Keep it one or two lines; do not invent a spec section.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs : Settings sliders drive the live audio mixer (sound phase 1, SFX)"
```
