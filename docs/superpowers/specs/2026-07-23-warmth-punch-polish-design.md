# Warmth + Punch — feel polish pass (2026-07-23)

## Goal

Two feel refinements requested in Korean, both UI-layer only. The **headless engine
(`src/engine/`) is not touched.**

1. **Warmer, fuller synth audio.** The current SFX/BGM (built 2026-07-22, all
   synthesized in `src/ui/audio.ts` — no asset files) read as **thin/tinny**
   ("질감이 얄팍함"). Retune the synth so BGM, buy/sell, tile-select, and tile-draw
   sound warmer, rounder, softer. **Still synth-only — no audio asset files.**
2. **Stronger, more dynamic cursor tilt (#6).** The existing Balatro-style pointer
   parallax (`usePointerTilt` on tiles/jokers/consumables — max 9° rotate, −4px lift,
   1.04× scale) should feel **더 강하게/역동적으로**: bigger response, a
   cursor-following sheen, and springier motion.

Items 1–5 of the original request were already implemented in the 2026-07-22
`feel-polish-pass-2`; the flying-tile draw animation (#4) is fine as-is and is
**left unchanged**. This pass is a retune of #1/#2/#3/#5 (synth texture) plus an
amplification of #6.

## Architecture

Everything is UI-layer. Audio changes are confined to the `src/ui/audio.ts` synth
facade (which lives in `src/ui/`, not the headless engine); the `audio.play(name)` /
`audio.playMusic(track)` call sites do **not** change. Tilt changes are the
`usePointerTilt` hook (`src/ui/hooks.ts`) + the `.tilting` CSS (`src/ui/styles/play.css`);
no component call sites change. No new dependencies.

## Task 1 — Warmer, fuller synth texture (`src/ui/audio.ts`)

The thinness comes from raw `square`/`sawtooth` oscillators routed straight to output
with a hard ~6 ms attack. Four layered fixes, cheapest-warmth-first:

### 1a. Global tone rounding (one signal-path change, warms everything)
- **SFX:** in `play()`, insert a shared lowpass biquad between the tonal `out` gain and
  `ctx.destination` (the noise path already has its own per-recipe lowpass; leave it).
  Cutoff ~3 kHz, gentle `Q` (~0.7). This rolls off the harsh upper harmonics of every
  square/saw blip → immediate warmth with zero per-recipe edits.
- **BGM:** add a lowpass before `musicGain → destination` in `ensureMusicGraph()`,
  tuned brighter (~5 kHz) so the melody still reads while losing the brittle top.

### 1b. Detuned unison + sub-octave (body for the thin sounds)
Extend the `Recipe.tones[]` tone type with two optional fields:
- `detune?: number` — cents; when set, the tone is duplicated as a second oscillator
  offset by ±`detune` (chorus/thickness).
- `sub?: boolean` — when true, add a quiet `sine` one octave below the tone's `from`
  (fundamental body). Sub gain ≈ 0.5× the layer.

`Voice` (BGM) gets the same optional `detune?` so leads can thicken.

Apply to the thinnest sounds only: `tileSelect`, `tileDeal`, and the BGM leads.

### 1c. Softer envelopes
In `play()`, lengthen the tonal attack from `+0.006` to ~`+0.012` s and give a touch
more release (decay target time nudged) so percussive SFX lose the "click." Keep the
overall `dur` values so timing/pacing is unchanged.

### 1d. Per-sound retune (targeted)
- `tileSelect` ("tak"): replace the tinny high click with a woody body — keep the low
  `180→120` thock, add `sub: true` and soften the noise cutoff; remove brittle top.
- `tileDeal`: round the triangle blip into a soft "fwip" (add `sub`/`detune`, lower
  noise cutoff).
- `purchase` / `sell`: warm the coin jingle — add `detune` to the triangle shimmer
  layers so the ring is fuller, not brittle.
- BGM `menu` / `play` / `shop`: add a **third voice** — a soft `sine` pad/harmony at
  low gain (~0.06) under the existing lead + bass, filling the mid. Same `bpm` and
  16-step loop length; `boss` may keep its tenser character (optional light pad).

## Task 2 — Stronger, more dynamic cursor tilt (`hooks.ts` + `play.css`)

### 2a. Bigger response
- Max rotate 9° → **~14°** (the `* 9deg` factors in `.tilting`).
- Lift −4px → **−8px**; scale 1.04 → **1.06**.

### 2b. Cursor-following sheen (Balatro holo glint)
- `usePointerTilt` already writes `--tilt-x` / `--tilt-y` (−1..1). Add a moving radial
  highlight to `.tilting` cards via an overlay (`::after` or a gradient layer) whose
  center is driven by those vars (e.g. `radial-gradient` positioned at
  `calc(50% + var(--tilt-y)*40%) calc(50% + var(--tilt-x)*40%)`), low-opacity white,
  `mix-blend-mode: screen`, `pointer-events: none`. Fades in with `.tilting`, out on
  leave. Must not obscure the tile glyph or joker art.

### 2c. Springier motion
- Tilt transition uses a slight-overshoot easing (e.g. `cubic-bezier(.34,1.56,.64,1)`)
  rather than `0.08s linear`, so the card "pops" toward the cursor.
- On `pointerleave`, instead of removing `.tilting` for an instant flat-snap, ease the
  vars back (short WAAPI or a transition on the reset) so the card settles rather than
  jumps. Keep it brief (~150 ms).
- Remains rAF-throttled; remains a **no-op under `prefers-reduced-motion`** (early
  return already in the hook — the sheen and spring must not fire in that mode).

## Testing

- **Audio:** `tests/audio-facade.test.ts` already asserts every `SfxName` has a recipe,
  `play('…')` never throws, and `playMusic`/`play` are safe Node no-ops (no
  `AudioContext`). The new optional `detune`/`sub` tone fields and the added BGM pad
  voice must keep all existing assertions green. Add one assertion: each non-`boss`
  `MUSIC` track now has **≥ 3 voices** (the pad), guarding the fuller-bed change.
- **Tilt:** pure DOM/CSS with no headless surface — verified by running the game
  (the `verify` skill / `run`), confirming the stronger angle, the cursor-tracking
  sheen, and the eased return, and that reduced-motion still disables it.

## Non-goals / YAGNI

- **No audio asset files** — synth-only stays (user chose "합성음 재튜닝만").
- **No change to the #4 draw fly-in** — the user said it's fine.
- No new SFX names, no new tilt call sites (existing tiles/jokers/consumables only),
  no engine changes, no new dependencies.
