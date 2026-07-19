# Font Effects (Balatro-Seal Port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the four non-base tile fonts (lightItalic/bold/inline/black) the seal effects confirmed in GDD §2.3 — goldPlay (+$3), chipPlay (+30 chips), retriggerPlay (retrigger the tile once), discardGain (random consumable on discard) — with a data-driven font↔effect mapping in `balance.ts` and tooltips that read from it.

**Architecture:** Mirrors the materials pattern (`src/engine/materials.ts`): a new headless `src/engine/fonts.ts` resolves a font to its effect; `loop.ts` fires play-effects inside the per-tile scoring block (so retrigger repeats the whole block) and discard-effects inside `discardTiles` (signature grows to take `run` + `rng`). A new `font` ScoreEvent kind carries the beats to the UI settle replay. Tooltips resolve copy via `BALANCE.fontEffects` → `fonteffectdesc.<effectId>` i18n keys, so remapping is a one-line data change.

**Tech Stack:** TypeScript strict, Vitest, React + plain CSS (existing `Tooltip` component, `richtext` markup).

## Global Constraints

- Engine (`src/engine/`) never imports DOM/React (CLAUDE.md architecture principle 1).
- No magic numbers in engine code — every value goes in `src/engine/balance.ts` (principle 3).
- All engine randomness flows through the seeded `Rng` — never `Math.random()` (principle 4).
- "Scores in a played word" **includes gibberish** submissions (work order C-1 rules; GDD §2.3).
- `retriggerPlay` composes with other retrigger sources — no special-casing (GDD §2.3).
- `discardGain` requires a free consumable slot, otherwise nothing + a "slots full" toast (GDD §2.3, C-3).
- Font↔effect mapping is PROVISIONAL — mark it `// PROVISIONAL — awaiting design mapping`; tooltips must never hard-code the mapping (C-2).
- i18n copy in `locales/en.json` + `ko.json`, numbers in copy match BALANCE values, `[c:…]`/`[m:…]` markup, gold written `+$N` (repo convention, see `materialdesc.*`).
- Docs must stay in sync in the same change (CLAUDE.md principle 6) — see Task 7.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Engine data — FontEffectId type, BALANCE tables, fonts.ts resolver

**Files:**
- Modify: `src/engine/types.ts` (after the `TileFont` line, ~line 22)
- Modify: `src/engine/balance.ts` (after the `materials` block, ~line 55)
- Modify: `src/engine/packs.ts` (~line 21: export the consumable pool)
- Create: `src/engine/fonts.ts`
- Test: `tests/fonts.test.ts`

**Interfaces:**
- Consumes: `BALANCE`, `Rng` (`rng.int`), `RunState`, `Tile`, `TileFont`, `ConsumableId` (all existing).
- Produces (later tasks rely on these exact names):
  - `types.ts`: `export type FontEffectId = 'goldPlay' | 'chipPlay' | 'retriggerPlay' | 'discardGain'`
  - `balance.ts`: `BALANCE.fontEffectValues: { goldPlay: { gold: 3 }, chipPlay: { chips: 30 }, retriggerPlay: { extraTriggers: 1 }, discardGain: {} }` and `BALANCE.fontEffects: Record<'lightItalic'|'bold'|'inline'|'black', FontEffectId>`
  - `packs.ts`: `export const CONSUMABLE_POOL: readonly ConsumableId[]`
  - `fonts.ts`: `fontEffectOf(font: TileFont): FontEffectId | null` and `rollDiscardGains(run: RunState, discarded: readonly Tile[], rng: Rng): { gained: ConsumableId[]; slotsBlocked: number }`

- [ ] **Step 1: Write the failing test**

Create `tests/fonts.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fontEffectOf, rollDiscardGains } from '../src/engine/fonts';
import { BALANCE } from '../src/engine/balance';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Tile, TileFont } from '../src/engine/types';

const tile = (font: TileFont, id = `t-${font}`): Tile => ({
  id, letter: 'A', case: 'upper', material: 'ceramic', font,
});

describe('font effect resolution (GDD §2.3)', () => {
  it('medium is the base font and has no effect', () => {
    expect(fontEffectOf('medium')).toBeNull();
  });

  it('every non-base font resolves to an effect from BALANCE.fontEffects', () => {
    for (const f of ['lightItalic', 'bold', 'inline', 'black'] as const) {
      expect(fontEffectOf(f)).toBe(BALANCE.fontEffects[f]);
    }
  });
});

describe('discardGain rolls (GDD §2.3 Purple-Seal port)', () => {
  const discardFont = (Object.keys(BALANCE.fontEffects) as (keyof typeof BALANCE.fontEffects)[])
    .find((f) => BALANCE.fontEffects[f] === 'discardGain')!;

  it('gains one random consumable per discardGain tile when slots are free', () => {
    const run = newRun('seed-fonts'); // consumableSlots 2, consumables []
    const { gained, slotsBlocked } = rollDiscardGains(
      run, [tile(discardFont, 'd1'), tile('medium', 'd2')], makeRng('x'),
    );
    expect(gained).toHaveLength(1);
    expect(slotsBlocked).toBe(0);
  });

  it('no-ops (counts slotsBlocked) when consumable slots are full', () => {
    const base = newRun('seed-fonts');
    const run = { ...base, consumables: Array(base.consumableSlots).fill('magnifier' as const) };
    const { gained, slotsBlocked } = rollDiscardGains(run, [tile(discardFont)], makeRng('x'));
    expect(gained).toHaveLength(0);
    expect(slotsBlocked).toBe(1);
  });

  it('partial fill: gains up to the free slots, blocks the rest', () => {
    const base = newRun('seed-fonts');
    const run = { ...base, consumables: Array(base.consumableSlots - 1).fill('magnifier' as const) };
    const { gained, slotsBlocked } = rollDiscardGains(
      run, [tile(discardFont, 'd1'), tile(discardFont, 'd2')], makeRng('x'),
    );
    expect(gained).toHaveLength(1);
    expect(slotsBlocked).toBe(1);
  });
});
```

(`newRun(seed)` is the existing factory in `src/engine/run.ts` — the same one `tests/slice5-materials.test.ts` imports.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/fonts.test.ts`
Expected: FAIL — `Cannot find module '../src/engine/fonts'`

- [ ] **Step 3: Implement**

`src/engine/types.ts` — after the `TileFont` type (~line 22):

```ts
/** Font seal effects (GDD §2.3) — the edition layer's Balatro-seal port. */
export type FontEffectId = 'goldPlay' | 'chipPlay' | 'retriggerPlay' | 'discardGain';
```

`src/engine/balance.ts` — import the type at top (`import type { FontEffectId, TileFont } from './types';` — keep it `import type` so no runtime cycle) and add after the `materials` block:

```ts
  /**
   * Font seal effects (GDD §2.3) — Balatro-seal values verbatim-then-tune,
   * same philosophy as materials above.
   */
  fontEffectValues: {
    goldPlay: { gold: 3 }, // Gold Seal
    chipPlay: { chips: 30 }, // adapted (Blue Seal has no planet analog; Bonus-card value)
    retriggerPlay: { extraTriggers: 1 }, // Red Seal — the reserved retrigger, spent here
    discardGain: {}, // Purple Seal (tarot → consumable)
  },
  // PROVISIONAL — awaiting design mapping (GDD §2.3/§12): reassigning a font is
  // a one-line change here; tooltips and scoring read this table.
  fontEffects: {
    lightItalic: 'goldPlay',
    bold: 'chipPlay',
    inline: 'retriggerPlay',
    black: 'discardGain',
  } as Record<Exclude<TileFont, 'medium'>, FontEffectId>,
```

`src/engine/packs.ts` — export the existing pool (line 21):

```ts
/** Consumables implemented so far — shared by pack rolls and discardGain (fonts.ts). */
export const CONSUMABLE_POOL: readonly ConsumableId[] = ['magnifier'];
```

Create `src/engine/fonts.ts`:

```ts
/**
 * Font seal effects (GDD §2.3) — the edition layer, as data.
 *
 * Mirrors materials.ts: a font never hard-codes itself into pipeline code.
 * The play-trigger effects (goldPlay/chipPlay/retriggerPlay) fire inside the
 * per-tile scoring block in loop.ts (so retriggerPlay repeats the whole
 * block); discardGain fires in discardTiles. The font↔effect mapping lives in
 * BALANCE.fontEffects (PROVISIONAL until design supplies the final mapping).
 */

import { BALANCE } from './balance';
import { CONSUMABLE_POOL } from './packs';
import type { Rng } from './rng';
import type { ConsumableId, FontEffectId, RunState, Tile, TileFont } from './types';

/** The effect this font carries, or null for the base font (medium). */
export function fontEffectOf(font: TileFont): FontEffectId | null {
  if (font === 'medium') return null;
  return BALANCE.fontEffects[font];
}

export interface DiscardGainResult {
  /** consumables gained (already slot-checked against run capacity) */
  gained: ConsumableId[];
  /** discardGain triggers that no-opped because slots were full (→ UI toast) */
  slotsBlocked: number;
}

/**
 * Roll discardGain for a batch of discarded tiles (GDD §2.3 Purple-Seal port):
 * one random consumable per triggering tile, but only while the run has free
 * consumable slots — beyond capacity the trigger does nothing. Pure: the
 * caller appends `gained` to run.consumables.
 */
export function rollDiscardGains(
  run: RunState,
  discarded: readonly Tile[],
  rng: Rng,
): DiscardGainResult {
  const free = run.consumableSlots - run.consumables.length;
  const gained: ConsumableId[] = [];
  let slotsBlocked = 0;
  for (const t of discarded) {
    if (fontEffectOf(t.font) !== 'discardGain') continue;
    if (gained.length >= free) {
      slotsBlocked++;
      continue;
    }
    gained.push(CONSUMABLE_POOL[rng.int(CONSUMABLE_POOL.length)]!);
  }
  return { gained, slotsBlocked };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/fonts.test.ts` → PASS. Then `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/balance.ts src/engine/packs.ts src/engine/fonts.ts tests/fonts.test.ts
git commit -m "feat : font seal effect data layer (FontEffectId, BALANCE.fontEffects, fonts.ts)"
```

---

### Task 2: Engine — play-trigger effects in the scoring pipeline (+ `font` ScoreEvent)

**Files:**
- Modify: `src/engine/types.ts` (ScoreEvent union, ~line 155)
- Modify: `src/engine/loop.ts` (`scoreSubmission`, lines ~146–255; `SubmitResult` doc comment)
- Test: `tests/fonts.test.ts` (append a new describe block)

**Interfaces:**
- Consumes: `fontEffectOf` (Task 1), `BALANCE.fontEffectValues`.
- Produces: ScoreEvent variant `{ kind: 'font'; font: TileFont; effect: FontEffectId; tileId: string; chipsDelta: number; multDelta: number; goldDelta: number }`. `SubmitResult.goldDelta` now also includes font gold (callers unchanged).

- [ ] **Step 1: Write the failing tests** (append to `tests/fonts.test.ts`)

Follows the `tests/slice5-materials.test.ts` idiom: craft the run's bag so the whole hand is the crafted tiles, `startBlind`, submit all hand ids. Reverse-map effect→font through `BALANCE.fontEffects` so the tests survive a mapping change (C-2 acceptance). Add to the imports: `makeLexicon` from `../src/engine/lexicon`, `startBlind, submitWord` from `../src/engine/loop`, `letterChips` from `../src/engine/scoring`, and extend the `tile` helper file-locally as needed.

```ts
import { makeLexicon } from '../src/engine/lexicon';
import { startBlind, submitWord } from '../src/engine/loop';
import { letterChips } from '../src/engine/scoring';
import type { FontEffectId, Letter } from '../src/engine/types';

const lex = makeLexicon(['cat'], {});
const fontFor = (effect: FontEffectId): TileFont =>
  (Object.keys(BALANCE.fontEffects) as (keyof typeof BALANCE.fontEffects)[])
    .find((f) => BALANCE.fontEffects[f] === effect)!;

let wc = 0;
const wordTiles = (word: string, fonts: Partial<Record<number, TileFont>> = {}): Tile[] =>
  [...word.toUpperCase()].map((ch, i) => ({
    id: `w${wc++}-${i}`, letter: ch as Letter, case: 'upper',
    material: 'ceramic', font: fonts[i] ?? 'medium',
  }));

const submit = (hand: Tile[]) => {
  const run = { ...newRun('font-seed'), bag: hand };
  const blind = startBlind(run, makeRng('font-seed'));
  return submitWord(blind, run, lex, blind.hand.map((t) => t.id), makeRng('f'));
};

describe('font play effects in the scoring pipeline (GDD §2.3)', () => {
  it('chipPlay adds its chips via a font ScoreEvent on the tile', () => {
    const hand = wordTiles('cat', { 1: fontFor('chipPlay') }); // A carries chipPlay
    const r = submit(hand);
    const fontEvents = r.events.filter((e) => e.kind === 'font');
    expect(fontEvents).toEqual([
      expect.objectContaining({
        effect: 'chipPlay', tileId: hand[1]!.id,
        chipsDelta: BALANCE.fontEffectValues.chipPlay.chips, multDelta: 0, goldDelta: 0,
      }),
    ]);
    // CAT = 5 letter chips + 30 → settle sees 35 × 1.0 standard
    expect(r.submission.settledScore).toBe(35);
  });

  it('goldPlay pays gold through SubmitResult.goldDelta and logs a font event', () => {
    const r = submit(wordTiles('cat', { 0: fontFor('goldPlay') }));
    expect(r.goldDelta).toBe(BALANCE.fontEffectValues.goldPlay.gold);
    expect(r.events).toContainEqual(
      expect.objectContaining({
        kind: 'font', effect: 'goldPlay',
        goldDelta: BALANCE.fontEffectValues.goldPlay.gold, chipsDelta: 0,
      }),
    );
    expect(r.submission.settledScore).toBe(5); // gold never touches chips×mult
  });

  it('retriggerPlay repeats the tile scoring block once', () => {
    const hand = wordTiles('cat', { 2: fontFor('retriggerPlay') }); // T retriggers
    const r = submit(hand);
    const tId = hand[2]!.id;
    expect(r.events.filter((e) => e.kind === 'tile' && e.tileId === tId)).toHaveLength(2);
    expect(r.events.filter((e) => e.kind === 'font' && e.effect === 'retriggerPlay')).toHaveLength(1);
    // C3 A1 T1 + retriggered T1 = 6 chips × 1.0
    expect(r.submission.settledScore).toBe(6);
  });

  it('retriggerPlay re-fires the tile material too (retriggers compose)', () => {
    const hand = wordTiles('cat', { 2: fontFor('retriggerPlay') });
    hand[2]!.material = 'porcelain';
    const r = submit(hand);
    const matEvents = r.events.filter((e) => e.kind === 'material' && e.tileId === hand[2]!.id);
    expect(matEvents).toHaveLength(2);
    // 5 letter chips + T again (1) + 2×30 porcelain = 66 × 1.0
    expect(r.submission.settledScore).toBe(66);
  });

  it('font play effects fire on gibberish too (GDD §2.3 rule)', () => {
    const r = submit(wordTiles('tac', { 0: fontFor('chipPlay') })); // not in lexicon
    expect(r.submission.isGibberish).toBe(true);
    expect(r.events.some((e) => e.kind === 'font' && e.effect === 'chipPlay')).toBe(true);
  });
});
```

(`letterChips` import is available for deriving expectations if the hard-coded 5/6/66 read poorly — CAT is C3+A1+T1=5, matching the slice5-materials comments.)

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run tests/fonts.test.ts`
Expected: FAIL — no `font` events emitted (and TS error until the ScoreEvent variant exists).

- [ ] **Step 3: Implement**

`src/engine/types.ts` — add to the `ScoreEvent` union (after the `material` variant):

```ts
  | { kind: 'font'; font: TileFont; effect: FontEffectId; tileId: string; chipsDelta: number; multDelta: number; goldDelta: number }
```

`src/engine/loop.ts` — in `scoreSubmission`, wrap the per-tile body in a trigger loop. Replace the current `for (const t of tiles) { … }` block (lines ~167–200) with:

```ts
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
    const fontEffect = fontEffectOf(t.font);
    const triggers =
      1 + (fontEffect === 'retriggerPlay' ? BALANCE.fontEffectValues.retriggerPlay.extraTriggers : 0);

    for (let trig = 0; trig < triggers; trig++) {
      // The retrigger beat announces the repeat BEFORE the repeated tile beat.
      if (trig > 0) {
        events.push({
          kind: 'font', font: t.font, effect: 'retriggerPlay', tileId: t.id,
          chipsDelta: 0, multDelta: 0, goldDelta: 0,
        });
      }

      ctx.chips += chips;
      events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });

      const mat = applyTileMaterial(ctx, t, rng);
      if (mat) {
        materialGold += mat.side.goldDelta ?? 0;
        if (mat.side.destroy && !destroyedTileIds.includes(t.id)) destroyedTileIds.push(t.id);
        if (mat.chipsDelta !== 0 || mat.multDelta !== 0) {
          events.push({
            kind: 'material', material: t.material, tileId: t.id,
            chipsDelta: mat.chipsDelta, multDelta: mat.multDelta,
          });
        }
      }

      // Font play effects fire per trigger, tile-level — so they fire on
      // gibberish too, like materials (GDD §2.3).
      if (fontEffect === 'goldPlay') {
        const gold = BALANCE.fontEffectValues.goldPlay.gold;
        materialGold += gold;
        events.push({
          kind: 'font', font: t.font, effect: 'goldPlay', tileId: t.id,
          chipsDelta: 0, multDelta: 0, goldDelta: gold,
        });
      } else if (fontEffect === 'chipPlay') {
        const bonus = BALANCE.fontEffectValues.chipPlay.chips;
        ctx.chips += bonus;
        events.push({
          kind: 'font', font: t.font, effect: 'chipPlay', tileId: t.id,
          chipsDelta: bonus, multDelta: 0, goldDelta: 0,
        });
      }

      // Per-tile jokers fire per trigger too — retriggers compose (GDD §2.3).
      for (const joker of run.jokers) {
        const beforeChips = ctx.chips;
        const beforeMult = ctx.mult;
        defaultJokerBus.emit('tileScoring', { run, blind, ctx, tile: t }, [joker]);
        const chipsDelta = ctx.chips - beforeChips;
        const multDelta = ctx.mult - beforeMult;
        if (chipsDelta !== 0 || multDelta !== 0) {
          events.push({ kind: 'joker', jokerId: joker.defId, chipsDelta, multDelta, tileId: t.id });
        }
      }
    }
  }
```

Add `import { fontEffectOf } from './fonts';` to loop.ts. Rename nothing: `materialGold` keeps accumulating the font gold (update the variable's doc comment on `SubmitResult.goldDelta` to mention font goldPlay). Glass-destroy dedupe (`!destroyedTileIds.includes`) is required — a retriggered glass tile may roll destroy twice.

- [ ] **Step 4: Run to verify pass**

`npx vitest run tests/fonts.test.ts tests/slice5-materials.test.ts tests/p1-scoreevents.test.ts tests/slice4-pipeline.test.ts` → PASS (the score-event tests must not break; if `p1-scoreevents` has an exhaustive kind switch, extend it for `font`). Then `npx tsc --noEmit`.

- [ ] **Step 5: Commit**

```bash
git add src/engine/types.ts src/engine/loop.ts tests/fonts.test.ts
git commit -m "feat : font play effects (goldPlay/chipPlay/retriggerPlay) in the scoring pipeline"
```

---

### Task 3: Engine — discardGain wiring (discardTiles signature change)

**Files:**
- Modify: `src/engine/loop.ts` (`discardTiles`, lines ~100–126)
- Modify: `src/sim/autoplay.ts:42` (call site)
- Modify: `tests/slice1-loop.test.ts` (7 call sites)
- Test: `tests/fonts.test.ts` (append)

**Interfaces:**
- Consumes: `rollDiscardGains` (Task 1).
- Produces: `discardTiles(blind: BlindState, run: RunState, tileIds: readonly string[], rng: Rng): DiscardResult` where `DiscardResult = { blind: BlindState; gained: ConsumableId[]; slotsBlocked: number }`. The caller appends `gained` to `run.consumables` (mirrors how `SubmitResult.goldDelta` is applied by the caller).

- [ ] **Step 1: Failing tests** — append to `tests/fonts.test.ts`:

```ts
it('discarding a discardGain tile yields a consumable via discardTiles', () => {
  // blind whose hand contains one discardGain-font tile; run with free slots
  // const { blind: after, gained } = discardTiles(blind, run, [id], makeRng('d'));
  // expect(gained).toHaveLength(1); expect(after.discardsLeft).toBe(blind.discardsLeft - 1);
});

it('discardTiles with full slots yields nothing and reports slotsBlocked', () => {
  // same but run.consumables full → gained [], slotsBlocked 1
});
```

Also update `tests/slice1-loop.test.ts`: every `discardTiles(blind, ids)` becomes `discardTiles(blind, run, ids, rng).blind` (a `run` and `rng` already exist in that file's setup; reuse them).

- [ ] **Step 2: Run to verify fail**

`npx vitest run tests/fonts.test.ts` → FAIL (signature).

- [ ] **Step 3: Implement** — replace `discardTiles` in loop.ts:

```ts
export interface DiscardResult {
  blind: BlindState;
  /** consumables gained from discardGain-font tiles (already slot-checked);
   *  the CALLER appends them to run.consumables (same division as goldDelta) */
  gained: ConsumableId[];
  /** discardGain triggers that no-opped on full slots (→ UI "slots full" toast) */
  slotsBlocked: number;
}

/**
 * Discard (GDD §6.3, Balatro-aligned): the chosen tiles LEAVE PLAY for the rest
 * of the blind — they move to `discardedThisBlind` and are NOT returned to the
 * bag mid-blind. Replacements are drawn from the remaining (already-shuffled)
 * bag; the rng is used ONLY for discardGain font rolls (GDD §2.3), never for
 * drawing. Budget is PER BLIND with NO per-use tile cap (playtest-04 D-4).
 */
export function discardTiles(
  blind: BlindState,
  run: RunState,
  tileIds: readonly string[],
  rng: Rng,
): DiscardResult {
  if (blind.discardsLeft <= 0) {
    throw new Error('discard budget exhausted for this blind');
  }
  const removed = takeFromHand(blind.hand, tileIds); // validates membership

  const removedIds = new Set(tileIds);
  const keptHand = blind.hand.filter((t) => !removedIds.has(t.id));
  const { drawn, bag } = drawTiles(blind.bag, removed.length);
  const { gained, slotsBlocked } = rollDiscardGains(run, removed, rng);

  return {
    blind: {
      ...blind,
      hand: [...keptHand, ...drawn],
      bag,
      discardedThisBlind: [...blind.discardedThisBlind, ...removed],
      discardsLeft: blind.discardsLeft - 1,
    },
    gained,
    slotsBlocked,
  };
}
```

Import `rollDiscardGains` from `./fonts` and `ConsumableId` into loop.ts. Update `src/sim/autoplay.ts:42` to `blind = discardTiles(blind, run, dump, rng).blind;` (both in scope there).

- [ ] **Step 4: Run to verify pass**

`npx vitest run` (full suite — the signature change can break anything) → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/loop.ts src/sim/autoplay.ts tests/slice1-loop.test.ts tests/fonts.test.ts
git commit -m "feat : discardGain font effect wired into discardTiles (run+rng signature)"
```

---

### Task 4: UI — settle replay handles `font` events

**Files:**
- Modify: `src/ui/settle.tsx` (`accumulate` ~line 93; timeline switch ~line 224)
- Test: `tests/playtest05-settle-gate.test.ts` area — check for `accumulate` unit tests and extend where they live (or add to `tests/fonts.test.ts` if none; `accumulate` is a pure export).

**Interfaces:**
- Consumes: the `font` ScoreEvent variant (Task 2).
- Produces: nothing new — settle visuals only.

- [ ] **Step 1: Failing test** (pure `accumulate`):

```ts
import { accumulate } from '../src/ui/settle';

it('accumulate folds font chipsDelta like other delta events', () => {
  const r = accumulate(10, 2, {
    kind: 'font', font: 'bold', effect: 'chipPlay', tileId: 'x',
    chipsDelta: 30, multDelta: 0, goldDelta: 0,
  });
  expect(r).toEqual({ chips: 40, mult: 2 });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/fonts.test.ts` → FAIL (font events fall through to the no-op branch).

- [ ] **Step 3: Implement** — in `accumulate`, add `'font'` to the delta-kind list:

```ts
  if (
    e.kind === 'letterHand' ||
    e.kind === 'joker' ||
    e.kind === 'boss' ||
    e.kind === 'material' ||
    e.kind === 'font'
  ) {
    return { chips: chips + e.chipsDelta, mult: mult + e.multDelta };
  }
```

In the timeline switch (after the `material` branch):

```ts
          } else if (e.kind === 'font') {
            // Font beats land on the tile, like materials; a chipPlay delta
            // grows the tile's +N pop the way per-tile jokers do.
            if (e.chipsDelta !== 0) pops[e.tileId] = (pops[e.tileId] ?? 0) + e.chipsDelta;
            setView({ ...base, tilePops: { ...pops }, activeTileId: e.tileId });
          }
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/settle.tsx tests/fonts.test.ts
git commit -m "feat : settle replay plays font-effect beats (pops on the tile)"
```

---

### Task 5: UI — tooltips read the effect from BALANCE.fontEffects + locale copy

**Files:**
- Modify: `src/ui/descriptions.ts`
- Modify: `src/ui/components/Collection.tsx` (`FontsView`, ~line 259)
- Modify: `src/ui/components/StagePanel.tsx` (`tileTip`, ~line 40)
- Modify: `locales/en.json`, `locales/ko.json`
- Test: `tests/materials-registries.test.ts` (extend with a fonts describe block)

**Interfaces:**
- Consumes: `BALANCE.fontEffects`, existing `Tooltip`, `richtext` markup.
- Produces: `fontDescKey(font: TileFont): string` in `descriptions.ts` — resolves `'fontdesc.medium'` for the base font, `` `fonteffectdesc.${BALANCE.fontEffects[font]}` `` otherwise.

- [ ] **Step 1: Failing test** — append to `tests/materials-registries.test.ts`:

```ts
import { BALANCE } from '../src/engine/balance';
import { fontDescKey } from '../src/ui/descriptions';

describe('font effect copy stays in sync (work order C-2/C-3)', () => {
  const FONTS = ['medium', 'lightItalic', 'bold', 'inline', 'black'] as const;

  it('every font resolves to a desc key present in both locales', () => {
    for (const f of FONTS) {
      const key = fontDescKey(f);
      expect(en as Record<string, string>).toHaveProperty(key);
      expect(ko as Record<string, string>).toHaveProperty(key);
    }
  });

  it('every declared effect id has locale copy (mapping changes stay covered)', () => {
    for (const id of Object.values(BALANCE.fontEffects)) {
      expect(en as Record<string, string>).toHaveProperty(`fonteffectdesc.${id}`);
      expect(ko as Record<string, string>).toHaveProperty(`fonteffectdesc.${id}`);
    }
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/materials-registries.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/ui/descriptions.ts`:

```ts
import { BALANCE } from '../engine/balance';
import type { TileFont } from '../engine/types';

/** Font tooltip copy resolves through BALANCE.fontEffects — never hard-code the
 *  mapping (GDD §2.3): remapping a font in balance.ts must update every tooltip. */
export const fontDescKey = (font: TileFont): string =>
  font === 'medium' ? 'fontdesc.medium' : `fonteffectdesc.${BALANCE.fontEffects[font]}`;
```

`Collection.tsx` `FontsView` — wrap in Tooltip exactly like `MaterialsView` (import `fontDescKey`):

```tsx
      {FONTS.map((f) => (
        <Tooltip key={f} title={t(`font.${f}`)} body={t(fontDescKey(f))} down>
          <div className="swatch">
            <TileView tile={sampleTile({ font: f })} />
            <span className="sw-name">{t(`font.${f}`)}</span>
          </div>
        </Tooltip>
      ))}
```

`StagePanel.tsx` `tileTip` — the font entry gains its effect text (import `fontDescKey`):

```ts
      tile.font !== 'medium' ? `${t(`font.${tile.font}`)} — ${t(fontDescKey(tile.font))}` : '',
```

`locales/ko.json` (after `materialdesc.brass`):

```json
  "fontdesc.medium": "기본 서체 — 추가 효과 없음",
  "fonteffectdesc.goldPlay": "득점 시 +$3",
  "fonteffectdesc.chipPlay": "득점 시 [c:칩 +30]",
  "fonteffectdesc.retriggerPlay": "득점 시 이 타일의 득점을 1회 재발동",
  "fonteffectdesc.discardGain": "버릴 때 무작위 소모품 1개 획득 (슬롯이 가득 차면 없음)",
```

`locales/en.json` (same position):

```json
  "fontdesc.medium": "Base font — no extra effect",
  "fonteffectdesc.goldPlay": "+$3 when scored",
  "fonteffectdesc.chipPlay": "[c:+30 Chips] when scored",
  "fonteffectdesc.retriggerPlay": "Retriggers this tile's scoring once",
  "fonteffectdesc.discardGain": "Gain 1 random consumable when discarded (nothing if slots are full)",
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run` → PASS; `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/ui/descriptions.ts src/ui/components/Collection.tsx src/ui/components/StagePanel.tsx locales/en.json locales/ko.json tests/materials-registries.test.ts
git commit -m "feat : font tooltips read effect copy through BALANCE.fontEffects (collection + play tile tips)"
```

---

### Task 6: UI — useGame discard wiring + slots-full toast

**Files:**
- Modify: `src/ui/useGame.ts` (`discard` callback, ~line 658)
- Modify: `locales/en.json`, `locales/ko.json` (toast key)

**Interfaces:**
- Consumes: `discardTiles` new signature (Task 3); the existing `message: { key }` warn-toast channel (StagePanel renders it).
- Produces: toast key `font.slotsFull` in both locales.

- [ ] **Step 1: Implement** (UI-state glue; covered by the app-level verify in Task 7 rather than a unit test — `useGame` has no existing hook test harness):

```ts
  const discard = useCallback((ids: string[]) => {
    setState((prev) => {
      if (prev.phase !== 'playing' || prev.pendingEnd) return prev;
      if (prev.blind.discardsLeft <= 0) return prev;
      const staged = new Set(prev.selected);
      const valid = ids.filter((id) => !staged.has(id) && prev.blind.hand.some((t) => t.id === id));
      if (valid.length === 0) return prev; // no per-use tile cap (D-4)
      const { blind, gained, slotsBlocked } = discardTiles(
        prev.blind,
        prev.run,
        valid,
        makeRng(`${prev.seed}#${prev.rngCounter}`),
      );
      return {
        ...prev,
        blind,
        run: gained.length
          ? { ...prev.run, consumables: [...prev.run.consumables, ...gained] }
          : prev.run,
        message: slotsBlocked > 0 ? { key: 'font.slotsFull' } : null,
        hint: null,
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, tilesDiscarded: prev.stats.tilesDiscarded + valid.length },
      };
    });
  }, []);
```

Locale copy — `ko.json`: `"font.slotsFull": "소모품 슬롯이 가득 참 — 소모품을 얻지 못했습니다",` · `en.json`: `"font.slotsFull": "Consumable slots full — no consumable gained",` (place next to the `fontdesc.*` keys).

- [ ] **Step 2: Verify** — `npx tsc --noEmit` clean, `npx vitest run` green.

- [ ] **Step 3: Commit**

```bash
git add src/ui/useGame.ts locales/en.json locales/ko.json
git commit -m "feat : discardGain consumable gain + slots-full toast in useGame discard"
```

---

### Task 7: Docs sync + end-to-end verification

**Files:**
- Modify: `CLAUDE.md` (the "Discard needs no RNG" line in "Key rules easy to get wrong")
- Verify only: GDD §2.3 / §12 (already carry the seal table; mapping stays provisional — confirm no stale "fonts are visual-only" phrasing remains anywhere: `grep -rn "visual-only\|시각 전용" docs CLAUDE.md`)

- [ ] **Step 1: CLAUDE.md fix** — the discard bullet currently ends "Discard needs no RNG (draws from the remaining shuffled bag)." Replace that sentence with: "Drawing replacements needs no RNG (they come from the remaining shuffled bag); the discard call still takes the seeded RNG for discardGain font rolls (GDD §2.3)."

- [ ] **Step 2: Grep for stale cross-references**

Run: `grep -rn "visual-only" docs CLAUDE.md` and `grep -rn "no effects yet" docs CLAUDE.md`
Expected: only historical notes inside the work order / GDD §14 open-items history, if any; fix anything that still asserts fonts have no effects (GDD §14 open item for font effects should be marked closed-by §2.3 if still open).

- [ ] **Step 3: Full verification (superpowers:verification-before-completion)**

- `npx vitest run` → all green.
- `npx tsc --noEmit` → clean.
- In-app check via the project `verify` skill: collection → Fonts category tooltips show effect text (ko+en); play a run with a crafted save or pack luck is impractical — instead verify play-screen tile tooltip by temporarily confirming via the collection sample tiles only. (Engine behavior is already covered by tests; the app check is for tooltip rendering.)

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md docs
git commit -m "docs : discard-RNG rule updated for discardGain; font-effect cross-references synced"
```
