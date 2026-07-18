# Tile Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all 8 tile materials affect scoring, replacing the current state where `tile.material` is read only by the UI.

**Architecture:** Materials become **data + hooks** (`src/engine/materials.ts`), mirroring the existing joker (`events.ts` `JokerBus`) and boss (`BOSS_REGISTRY`) patterns. A `MATERIAL_REGISTRY` maps each `TileMaterial` to a `MaterialDef` with three optional hooks matching the three firing points: per played tile, per held tile during word scoring, per held tile at blind end. Every number lives in `BALANCE.materials`.

**Tech Stack:** TypeScript (strict), Vitest, Vite. Engine is headless — no DOM/React imports in `src/engine/`.

**Spec:** `docs/superpowers/specs/2026-07-17-tile-materials-design.md`
**GDD:** §2.2 (materials table), §2 (layer design notes), §6.4 (gibberish)

## Global Constraints

- **Headless engine.** `src/engine/` must never import DOM, React, or browser APIs.
- **No magic numbers.** Every tunable lives in `src/engine/balance.ts`. New numbers go there first.
- **Seeded RNG only.** All randomness flows through `Rng` (`src/engine/rng.ts`). Never call `Math.random()` in the engine. A run must be fully reproducible from `RunState.seed`.
- **RNG threading convention:** callers build a fresh RNG per random event as `makeRng(\`${seed}#${rngCounter}\`)` and increment `rngCounter` (see `useGame.ts:317, 363, 380`).
- **Effects are data + hooks.** Never hard-code a material's effect inside pipeline code.
- **Settle timing.** `settleDurationMs()` is the single source of truth for settle length and scales with the number of score beats. **Never** add a fixed delay to "wait for the settle" (playtest-05 A — recurred twice).
- **TypeScript strict mode.** `npx tsc --noEmit` must pass.
- **English identifiers**, `nameKo` preserves Korean display names.
- **Balatro numbers ship verbatim** — they are a reference point to tune from, not a claim they fit our scale. Do not "fix" them in this plan.

**Run tests with:** `npx vitest run <path>` · **Typecheck:** `npx tsc --noEmit`

---

### Task 1: Letterless tiles (Stone's type change)

Stone has no letter (GDD §2.2). This opens `Tile.letter` to `null` and routes stone words through the existing gibberish path. No material *effects* yet — this is the type foundation.

**Why a sentinel:** if a stone tile were skipped while spelling, `stone+C+A+T` would read "CAT" — a valid word collecting the suit multiplier. `spell()` must emit a character that can never appear in the lexicon so the lookup fails and the word resolves as gibberish (§6.4).

**Files:**
- Modify: `src/engine/types.ts:22-32` (Tile, isVowel), `src/engine/types.ts:149-155` (ScoreEvent)
- Modify: `src/engine/scoring.ts:17-29` (spell, letterChips)
- Modify: `src/engine/loop.ts:161-170` (tile loop, letterHand string)
- Modify: `src/engine/jokers/consonantBricklayer.ts:18`
- Modify: `src/engine/hint.ts:49-51`
- Modify: `src/ui/game.ts:121, 145-146, 157, 172`
- Test: `tests/slice5-materials.test.ts` (create)

**Interfaces:**
- Produces: `Tile.letter: Letter | null` · `NO_LETTER: '□'` (exported from `scoring.ts`) · `isVowel(l: Letter | null): boolean` · `isConsonant(l: Letter | null): boolean` (new, exported from `types.ts`)

- [ ] **Step 1: Write the failing test**

Create `tests/slice5-materials.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scoreWord, spell, letterChips, NO_LETTER } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { isVowel, isConsonant } from '../src/engine/types';
import type { Letter, Tile, TileMaterial } from '../src/engine/types';

let idc = 0;
/** Build tiles from a word; '_' means a letterless stone tile. */
const tiles = (word: string, material: TileMaterial = 'ceramic'): Tile[] =>
  [...word.toUpperCase()].map((ch) => ({
    id: `m${idc++}`,
    letter: ch === '_' ? null : (ch as Letter),
    case: 'upper' as const,
    material: ch === '_' ? ('stone' as TileMaterial) : material,
    font: 'medium' as const,
  }));

const lex = makeLexicon(['cat'], {});

describe('slice5 — letterless tiles (GDD §2.2 Stone)', () => {
  it('spells a stone tile as the sentinel, never a lexicon word', () => {
    expect(spell(tiles('_cat'))).toBe(`${NO_LETTER}CAT`);
  });

  it('a word containing stone is gibberish — no suit multiplier', () => {
    const s = scoreWord(tiles('_cat'), lex);
    expect(s.isGibberish).toBe(true);
    expect(s.suit).toBeNull();
    // C3 A1 T1 = 5 chips; the stone contributes 0 letter chips, × 1.0 gibberish
    expect(s.settledScore).toBe(5);
  });

  it('the same tiles without the stone spell a real word', () => {
    expect(scoreWord(tiles('cat'), lex).isGibberish).toBe(false);
  });

  it('a stone tile contributes 0 letter chips', () => {
    expect(letterChips(tiles('_'))).toBe(0);
  });

  it('a stone is neither vowel nor consonant', () => {
    expect(isVowel(null)).toBe(false);
    expect(isConsonant(null)).toBe(false);
    expect(isVowel('A')).toBe(true);
    expect(isConsonant('B')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — `NO_LETTER` and `isConsonant` are not exported.

- [ ] **Step 3: Open the type**

In `src/engine/types.ts`, replace the `Tile` interface and `isVowel`:

```ts
export interface Tile {
  id: string; // stable unique id — tiles are permanent, sculptable assets (GDD §2)
  /** null ⟺ material 'stone' — a letterless tile (GDD §2.2). Any word containing
   *  one fails the lexicon lookup and resolves as gibberish (§6.4). */
  letter: Letter | null;
  case: LetterCase;
  material: TileMaterial;
  font: TileFont;
}

export const VOWELS: ReadonlySet<Letter> = new Set(['A', 'E', 'I', 'O', 'U'] as Letter[]);
/** Y is a consonant under the traditional classification (GDD §2.1 note). */
export const isVowel = (l: Letter | null): boolean => l !== null && VOWELS.has(l);
/** A letterless Stone tile is NEITHER — never infer "not vowel ⇒ consonant" (GDD §2.2). */
export const isConsonant = (l: Letter | null): boolean => l !== null && !VOWELS.has(l);
```

In the same file, widen the `tile` ScoreEvent variant (line ~150):

```ts
  | { kind: 'tile'; tileId: string; letter: Letter | null; chips: number }
```

- [ ] **Step 4: Teach spelling and chips about null**

In `src/engine/scoring.ts`, replace `spell` and `letterChips`:

```ts
/** Sentinel glyph for a letterless Stone tile. Never appears in the lexicon, so a
 *  word containing one always fails lookup → gibberish (GDD §2.2, §6.4). */
export const NO_LETTER = '□';

/** Spell the tiles as displayed, honoring each tile's case. */
export function spell(tiles: readonly Tile[]): string {
  return tiles
    .map((t) => {
      if (t.letter === null) return NO_LETTER;
      return t.case === 'lower' ? t.letter.toLowerCase() : t.letter;
    })
    .join('');
}

/** Sum of intrinsic Scrabble letter chips (GDD §2.1). Stone contributes 0 — its
 *  chips come from the material, not the letter (GDD §2.2). */
export function letterChips(tiles: readonly Tile[]): number {
  let sum = 0;
  for (const t of tiles) sum += t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
  return sum;
}
```

- [ ] **Step 5: Fix the pipeline's tile loop**

In `src/engine/loop.ts`, add `NO_LETTER` to the scoring import (line 18):

```ts
import { baseScore, spell, NO_LETTER } from './scoring';
```

Replace the tile loop (lines 161-165):

```ts
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
    ctx.chips += chips;
    events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });
  }
```

Replace the letter-hand string (line 170):

```ts
  const letters = tiles.map((t) => t.letter ?? NO_LETTER).join('');
```

**Do not change `letterHands.ts`.** A stone word is always gibberish, and `evaluateLetterHand` already skips every non-gibberish hand (Twin/Triplet/Longword/Palindrome are `gibberish: false`, `letterHands.ts:75-83`). The only eligible hands are Vowel Flush (needs all of AEIOU) and Straight (scans char codes 65–90) — the `□` sentinel can satisfy neither. Stone is inert here for free.

- [ ] **Step 6: Fix the consonant joker**

In `src/engine/jokers/consonantBricklayer.ts`, change the import and the filter:

```ts
import { isConsonant } from '../types';
```

```ts
      const consonants = ctx.submission.tiles.filter((t) => isConsonant(t.letter)).length;
```

Leave `vowelPraise.ts` alone — `isVowel(null)` now returns false, which is correct.

- [ ] **Step 7: Fix hint and UI null handling**

In `src/engine/hint.ts`, guard the bucket build (lines ~48-51):

```ts
  for (const t of hand) {
    if (t.letter === null) continue; // a Stone tile can spell nothing (GDD §2.2)
    const bucket = byLetter.get(t.letter);
    if (bucket) bucket.push(t);
    else byLetter.set(t.letter, [t]);
  }
```

In `src/ui/game.ts`:

```ts
/** Letter chip value for a tile (display only). Stone has no letter → 0. */
export const tileValue = (t: Tile): number =>
  t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);

/** Literal display glyph for a tile (case shown as authored: h vs H).
 *  A Stone tile has no letter and renders blank — the .stone material class carries its look. */
export const tileGlyph = (t: Tile): string => {
  if (t.letter === null) return '';
  return t.case === 'lower' ? t.letter.toLowerCase() : t.letter;
};

/** Vowel/consonant ceramic face tint class (P2-3). Stone is neither → no tint. */
export const faceClass = (t: Tile): string => {
  if (t.letter === null) return '';
  return isVowel(t.letter) ? 'vowel' : 'cons';
};
```

And the sort comparator (line ~172) — stones sort last:

```ts
const alpha = (a: Tile, b: Tile): number =>
  (a.letter ?? '￿').localeCompare(b.letter ?? '￿');
```

- [ ] **Step 8: Run tests and typecheck**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (5 tests)

Run: `npx tsc --noEmit`
Expected: no errors. If a `Letter | null` error surfaces in a file not listed above, fix it with the same `=== null` guard pattern.

Run: `npx vitest run`
Expected: the whole existing suite still passes — no behavior changed for ceramic tiles.

- [ ] **Step 9: Commit**

```bash
git add src/engine/types.ts src/engine/scoring.ts src/engine/loop.ts src/engine/hint.ts src/engine/jokers/consonantBricklayer.ts src/ui/game.ts tests/slice5-materials.test.ts
git commit -m "feat(materials): letterless Stone tiles route through the gibberish path

Tile.letter opens to Letter | null. spell() emits a sentinel that can never
appear in the lexicon, so a word containing Stone fails lookup and resolves
as gibberish (GDD §6.4) with no new rule.

Adds isConsonant() — a Stone is neither vowel nor consonant, and
consonantBricklayer's '!isVowel' would otherwise have silently paid out on it.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Material registry + the three static per-tile effects

Adds the registry, the balance table, the three new material ids, and the `material` ScoreEvent — proven with the three materials that need no RNG and no hand access: Porcelain (+30 chips), Polished (+4 mult), Stone (+50 chips).

**Files:**
- Create: `src/engine/materials.ts`
- Modify: `src/engine/types.ts:17` (TileMaterial), `src/engine/types.ts:149-155` (ScoreEvent)
- Modify: `src/engine/balance.ts` (add `materials` block after `gibberish`, ~line 40)
- Modify: `src/engine/loop.ts:161-166` (tile loop)
- Test: `tests/slice5-materials.test.ts`

**Interfaces:**
- Consumes: `Tile.letter: Letter | null`, `NO_LETTER` (Task 1)
- Produces:
  - `TileMaterial` gains `'leadPlate' | 'ivory' | 'brass'`
  - `MaterialSideEffects { goldDelta?: number; destroy?: boolean }`
  - `MaterialDef { id: TileMaterial; nameKo: string; nameEn: string; onTileScored?(ctx, tile, rng): MaterialSideEffects | void; onHeldDuringScoring?(ctx, tile): void; onHeldAtBlindEnd?(tile): MaterialSideEffects | void }`
  - `MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef>`
  - ScoreEvent variant `{ kind: 'material'; material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }`

- [ ] **Step 1: Write the failing test**

Append to `tests/slice5-materials.test.ts`:

```ts
describe('slice5 — static per-tile material effects (GDD §2.2)', () => {
  it('porcelain adds +30 chips per tile', () => {
    // CAT = 5 chips; one porcelain C = +30 → 35 × 1.0 standard
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    expect(scoreWord(t, lex).settledScore).toBe(35);
  });

  it('porcelain stacks per tile', () => {
    const t = tiles('cat');
    t[0]!.material = 'porcelain';
    t[1]!.material = 'porcelain';
    expect(scoreWord(t, lex).settledScore).toBe(65); // 5 + 60
  });

  it('polished adds +4 mult per tile', () => {
    // CAT = 5 chips, standard mult 1.0 + 4 = 5.0 → 25
    const t = tiles('cat');
    t[0]!.material = 'polished';
    expect(scoreWord(t, lex).settledScore).toBe(25);
  });

  it('stone adds +50 chips and forces gibberish', () => {
    // '_' builds a stone tile: 0 letter chips + 50 material = 50 × 1.0 gibberish
    expect(scoreWord(tiles('_'), lex).settledScore).toBe(50);
  });

  it('ceramic changes nothing', () => {
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(5);
  });
});
```

**Note:** `scoreWord` (`scoring.ts:60`) is the joker-free reference path. It must apply materials too, or these tests pass in `loop.ts` but the reference diverges. Step 4 wires both.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — porcelain returns 5, not 35 (materials are not applied).

- [ ] **Step 3: Add the ids and the balance table**

In `src/engine/types.ts` line 17:

```ts
/** Enhancement layer (GDD §2.2). 'ceramic' is the unenhanced base. */
export type TileMaterial =
  | 'ceramic' | 'porcelain' | 'polished' | 'glass' | 'stone'
  | 'leadPlate' | 'ivory' | 'brass';
```

Add the ScoreEvent variant (after the `tile` variant, ~line 151):

```ts
  | { kind: 'material'; material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }
```

In `src/engine/balance.ts`, after the `gibberish` block (~line 40):

```ts
  /**
   * Materials (GDD §2.2). First-pass values are Balatro's enhancement numbers
   * VERBATIM — a validated reference point to tune from, not a claim they fit
   * our scale. See docs/superpowers/specs/2026-07-17-tile-materials-design.md
   * for the three predicted breakages src/sim should measure.
   */
  materials: {
    porcelain: { chips: 30 }, // Balatro Bonus
    polished: { mult: 4 }, // Balatro Mult
    glass: { multFactor: 2, destroyChance: 0.25 }, // Balatro Glass
    stone: { chips: 50 }, // Balatro Stone
    leadPlate: { multChance: 0.2, mult: 20, goldChance: 1 / 15, gold: 20 }, // Balatro Lucky
    ivory: { gold: 3 }, // Balatro Gold
    brass: { multFactor: 1.5 }, // Balatro Steel
  },
```

- [ ] **Step 4: Create the registry and wire it in**

Create `src/engine/materials.ts`:

```ts
/**
 * Materials (GDD §2.2) — the enhancement layer, as data + hooks.
 *
 * Mirrors the joker (events.ts JokerBus) and boss (BOSS_REGISTRY) patterns: a
 * material never hard-codes itself into pipeline code. Three hooks map to the
 * three firing points:
 *   - onTileScored        → per PLAYED tile, during word scoring
 *   - onHeldDuringScoring → per tile REMAINING in hand, during word scoring
 *   - onHeldAtBlindEnd    → per tile remaining in hand at blind end
 *
 * Numbers live in BALANCE.materials. Ceramic is the base and registers nothing.
 */

import { BALANCE } from './balance';
import type { Rng } from './rng';
import type { Tile, TileMaterial, WordScoringContext } from './types';

/** Outcomes a material can produce beyond chips/mult. */
export interface MaterialSideEffects {
  /** run gold to add (Ivory, Lead plate) */
  goldDelta?: number;
  /** remove this tile from the run's bag permanently (Glass) */
  destroy?: boolean;
}

export interface MaterialDef {
  id: TileMaterial;
  nameKo: string;
  nameEn: string;
  onTileScored?(ctx: WordScoringContext, tile: Tile, rng: Rng): MaterialSideEffects | void;
  onHeldDuringScoring?(ctx: WordScoringContext, tile: Tile): void;
  onHeldAtBlindEnd?(tile: Tile): MaterialSideEffects | void;
}

const porcelain: MaterialDef = {
  id: 'porcelain',
  nameKo: '자기',
  nameEn: 'Porcelain',
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.porcelain.chips;
  },
};

const polished: MaterialDef = {
  id: 'polished',
  nameKo: '연마',
  nameEn: 'Polished',
  onTileScored: (ctx) => {
    ctx.mult += BALANCE.materials.polished.mult;
  },
};

const stone: MaterialDef = {
  id: 'stone',
  nameKo: '석재',
  nameEn: 'Stone',
  // The letterless-ness lives in the Tile itself (letter: null), which forces the
  // word to gibberish via the lexicon. Here Stone only pays its chips.
  onTileScored: (ctx) => {
    ctx.chips += BALANCE.materials.stone.chips;
  },
};

export const MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef> = new Map(
  [porcelain, polished, stone].map((m) => [m.id, m]),
);
```

In `src/engine/materials.ts` add the shared applier used by both scoring paths:

```ts
/**
 * Apply one played tile's material, capturing chips/mult deltas as a ScoreEvent
 * the UI can replay. Returns null when the material has no scoring effect, so
 * callers can skip emitting a no-op beat.
 */
export function applyTileMaterial(
  ctx: WordScoringContext,
  tile: Tile,
  rng: Rng,
): { chipsDelta: number; multDelta: number; side: MaterialSideEffects } | null {
  const def = MATERIAL_REGISTRY.get(tile.material);
  if (!def?.onTileScored) return null;
  const beforeChips = ctx.chips;
  const beforeMult = ctx.mult;
  const side = def.onTileScored(ctx, tile, rng) ?? {};
  return { chipsDelta: ctx.chips - beforeChips, multDelta: ctx.mult - beforeMult, side };
}
```

In `src/engine/loop.ts`, import it:

```ts
import { applyTileMaterial } from './materials';
```

Replace the tile loop (from Task 1) so materials fire per tile. **`rng` is not available until Task 3** — pass a throwaway deterministic RNG for now and replace it in Task 3:

```ts
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
    ctx.chips += chips;
    events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });

    const mat = applyTileMaterial(ctx, t, rng);
    if (mat && (mat.chipsDelta !== 0 || mat.multDelta !== 0)) {
      events.push({
        kind: 'material',
        material: t.material,
        tileId: t.id,
        chipsDelta: mat.chipsDelta,
        multDelta: mat.multDelta,
      });
    }
  }
```

Add an `rng: Rng` parameter to `scoreSubmission` now (Task 3 threads it from the caller):

```ts
function scoreSubmission(
  tiles: readonly Tile[],
  lexicon: Lexicon,
  run: RunState,
  blind: BlindState,
  rng: Rng,
): { submission: WordSubmission; events: ScoreEvent[] } {
```

At its one call site (`loop.ts:260`), pass a placeholder that Task 3 replaces:

```ts
  const { submission, events } = scoreSubmission(used, lexicon, run, blind, makeRng(run.seed));
```

Add to `loop.ts` imports: `import { makeRng, type Rng } from './rng';` (if `Rng` is already imported as a type, extend that import).

Wire `scoreWord` in `src/engine/scoring.ts` so the joker-free reference path matches:

```ts
import { applyTileMaterial } from './materials';
import { makeRng } from './rng';
import type { WordScoringContext } from './types';

export function scoreWord(tiles: readonly Tile[], lexicon: Lexicon): WordSubmission {
  const b = baseScore(tiles, lexicon);
  const submission: WordSubmission = {
    tiles: tiles.slice(),
    text: b.text,
    isGibberish: b.isGibberish,
    suit: b.suit,
    posUsed: null,
    settledScore: 0,
  };
  // Reference path: no jokers, no bosses. Materials still apply — they are part of
  // the tile, not a modifier layered on top. Fixed seed keeps this pure/testable.
  const rng = makeRng('scoreWord');
  const ctx: WordScoringContext = { submission, chips: b.chips, mult: b.mult };
  for (const t of tiles) applyTileMaterial(ctx, t, rng);
  submission.settledScore = ctx.chips * ctx.mult;
  return submission;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (10 tests)

Run: `npx vitest run && npx tsc --noEmit`
Expected: full suite green, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/engine/materials.ts src/engine/types.ts src/engine/balance.ts src/engine/loop.ts src/engine/scoring.ts tests/slice5-materials.test.ts
git commit -m "feat(materials): registry + Porcelain/Polished/Stone effects

Materials become data + hooks (MATERIAL_REGISTRY), mirroring jokers and
bosses. Adds leadPlate/ivory/brass ids and BALANCE.materials with Balatro's
numbers verbatim as the tuning reference point.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Thread the seeded RNG + Lead plate

Glass and Lead plate need randomness. `submitWord` has no RNG parameter today, so it must be threaded from the callers using the established `makeRng(\`${seed}#${counter}\`)` convention. Lead plate proves the path.

**Files:**
- Modify: `src/engine/loop.ts:242-260` (submitWord signature + call site)
- Modify: `src/engine/materials.ts` (add leadPlate)
- Modify: `src/ui/useGame.ts:539` (pass rng, bump counter)
- Modify: `src/sim/autoplay.ts:64` (pass rng)
- Test: `tests/slice5-materials.test.ts`

**Interfaces:**
- Consumes: `MaterialDef`, `MATERIAL_REGISTRY`, `applyTileMaterial` (Task 2)
- Produces: `submitWord(blind, run, lexicon, tileIds, rng: Rng): SubmitResult` · `SubmitResult.goldDelta` now also carries material gold

- [ ] **Step 1: Write the failing test**

Append to `tests/slice5-materials.test.ts`:

```ts
import { makeRng } from '../src/engine/rng';
import { startBlind, submitWord } from '../src/engine/loop';
import { newRun } from '../src/engine/run';

describe('slice5 — Lead plate (GDD §2.2, Balatro Lucky)', () => {
  it('is reproducible: the same seed gives the same outcome', () => {
    const build = () => {
      const run = { ...newRun('mat-seed'), bag: tiles('cat', 'leadPlate') };
      const blind = startBlind(run, makeRng('mat-seed'));
      const ids = blind.hand.map((t) => t.id);
      return submitWord(blind, run, lex, ids, makeRng('roll-1'));
    };
    expect(build().submission.settledScore).toBe(build().submission.settledScore);
    expect(build().goldDelta).toBe(build().goldDelta);
  });

  it('different seeds eventually produce a mult hit (1/5) across many rolls', () => {
    const run = { ...newRun('mat-seed'), bag: tiles('cat', 'leadPlate') };
    let hits = 0;
    for (let i = 0; i < 200; i++) {
      const blind = startBlind(run, makeRng(`b${i}`));
      const ids = blind.hand.map((t) => t.id);
      const { events } = submitWord(blind, run, lex, ids, makeRng(`roll-${i}`));
      if (events.some((e) => e.kind === 'material' && e.multDelta > 0)) hits++;
    }
    // 3 lead tiles × 200 words at 1/5 each — a total miss would mean the RNG is not wired
    expect(hits).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — `submitWord` takes 4 arguments, not 5.

- [ ] **Step 3: Add Lead plate to the registry**

In `src/engine/materials.ts`:

```ts
const leadPlate: MaterialDef = {
  id: 'leadPlate',
  nameKo: '연판',
  nameEn: 'Lead plate',
  // A worn stereotype plate prints unevenly — same plate, uneven pulls.
  // The two rolls are INDEPENDENT (Balatro Lucky): one tile can hit both.
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.leadPlate;
    if (rng.next() < cfg.multChance) ctx.mult += cfg.mult;
    return rng.next() < cfg.goldChance ? { goldDelta: cfg.gold } : {};
  },
};
```

Register it:

```ts
export const MATERIAL_REGISTRY: ReadonlyMap<TileMaterial, MaterialDef> = new Map(
  [porcelain, polished, stone, leadPlate].map((m) => [m.id, m]),
);
```

- [ ] **Step 4: Thread rng through submitWord**

In `src/engine/loop.ts`, change the signature (line 242) and collect material gold:

```ts
export function submitWord(
  blind: BlindState,
  run: RunState,
  lexicon: Lexicon,
  tileIds: readonly string[],
  rng: Rng,
): SubmitResult {
```

Replace the placeholder call site (line ~260):

```ts
  const { submission, events, materialGold } = scoreSubmission(used, lexicon, run, blind, rng);
```

Update `scoreSubmission` to return material gold. In the tile loop, accumulate `mat.side.goldDelta`:

```ts
  let materialGold = 0;
  for (const t of tiles) {
    const chips = t.letter === null ? 0 : (BALANCE.letterChips[t.letter] ?? 0);
    ctx.chips += chips;
    events.push({ kind: 'tile', tileId: t.id, letter: t.letter, chips });

    const mat = applyTileMaterial(ctx, t, rng);
    if (mat) {
      materialGold += mat.side.goldDelta ?? 0;
      if (mat.chipsDelta !== 0 || mat.multDelta !== 0) {
        events.push({
          kind: 'material',
          material: t.material,
          tileId: t.id,
          chipsDelta: mat.chipsDelta,
          multDelta: mat.multDelta,
        });
      }
    }
  }
```

Change its return type and return statement:

```ts
): { submission: WordSubmission; events: ScoreEvent[]; materialGold: number } {
```
```ts
  return { submission, events, materialGold };
```

Fold material gold into the existing `goldDelta` (which currently only carries the Taxman drain, line ~258):

```ts
  const goldDelta = (boss?.goldPerWord ? -boss.goldPerWord : 0) + materialGold;
```

Move that line **below** the `scoreSubmission` call so `materialGold` is in scope. Remove the `makeRng` import added in Task 2 if it is now unused in `loop.ts`.

- [ ] **Step 5: Update both callers**

In `src/ui/useGame.ts` (line ~539), pass a fresh RNG and bump the counter:

```ts
        result = submitWord(
          prev.blind,
          prev.run,
          lexicon,
          prev.selected,
          makeRng(`${prev.seed}#${prev.rngCounter}`),
        );
```

In the same reducer, increment `rngCounter` in the returned state alongside the other fields (match the surrounding pattern at `useGame.ts:431-435`):

```ts
        rngCounter: prev.rngCounter + 1,
```

In `src/sim/autoplay.ts` (line ~64):

```ts
    const { blind: after, submission } = submitWord(blind, run, lex, ids, makeRng(`${run.seed}#w${blind.phasesUsed}`));
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (12 tests)

Run: `npx vitest run && npx tsc --noEmit`
Expected: green. `tests/slice1-loop.test.ts`, `tests/slice3-loop.test.ts`, `tests/slice4-pipeline.test.ts` and `tests/playtest05-settle-gate.test.ts` call `submitWord` — add `makeRng('test')` as the 5th argument to each call.

- [ ] **Step 7: Commit**

```bash
git add src/engine/loop.ts src/engine/materials.ts src/ui/useGame.ts src/sim/autoplay.ts tests/
git commit -m "feat(materials): thread seeded RNG into scoring + Lead plate

submitWord now takes an Rng so material rolls stay reproducible from
RunState.seed. Lead plate rolls mult (1/5) and gold (1/15) independently.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Glass — ×2 mult and permanent destruction

Glass is the one real gamble. The ×2 always applies on the word that breaks it — **the destroy roll resolves after the word settles**, and a destroyed tile leaves `run.bag` permanently.

**Files:**
- Modify: `src/engine/materials.ts` (add glass)
- Modify: `src/engine/loop.ts` (SubmitResult gains `destroyedTileIds`)
- Modify: `src/ui/useGame.ts` (apply destruction to `run.bag`)
- Modify: `src/sim/autoplay.ts` (apply destruction)
- Test: `tests/slice5-materials.test.ts`

**Interfaces:**
- Consumes: `applyTileMaterial`, `MaterialSideEffects.destroy` (Task 2), threaded `rng` (Task 3)
- Produces: `SubmitResult.destroyedTileIds: string[]`

- [ ] **Step 1: Write the failing test**

```ts
describe('slice5 — Glass (GDD §2.2, the one gamble)', () => {
  it('doubles the mult on the word it is played in', () => {
    // CAT = 5 chips × (1.0 standard × 2) = 10
    const t = tiles('cat');
    t[0]!.material = 'glass';
    expect(scoreWord(t, lex).settledScore).toBe(10);
  });

  it('two glass tiles compound the factor', () => {
    const t = tiles('cat');
    t[0]!.material = 'glass';
    t[1]!.material = 'glass';
    expect(scoreWord(t, lex).settledScore).toBe(20); // 5 × 1.0 × 2 × 2
  });

  it('reports destroyed tiles and is seed-reproducible', () => {
    const run = { ...newRun('glass-seed'), bag: tiles('cat', 'glass') };
    const roll = () => {
      const blind = startBlind(run, makeRng('glass-seed'));
      const ids = blind.hand.map((t) => t.id);
      return submitWord(blind, run, lex, ids, makeRng('shatter')).destroyedTileIds;
    };
    expect(roll()).toEqual(roll());
  });

  it('destroys roughly 1/4 of glass tiles played', () => {
    const run = { ...newRun('glass-seed'), bag: tiles('cat', 'glass') };
    let destroyed = 0;
    const TRIALS = 400;
    for (let i = 0; i < TRIALS; i++) {
      const blind = startBlind(run, makeRng(`g${i}`));
      const ids = blind.hand.map((t) => t.id);
      destroyed += submitWord(blind, run, lex, ids, makeRng(`s${i}`)).destroyedTileIds.length;
    }
    const rate = destroyed / (TRIALS * 3); // 3 glass tiles per word
    expect(rate).toBeGreaterThan(0.15);
    expect(rate).toBeLessThan(0.35);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — glass does not double the mult; `destroyedTileIds` does not exist.

- [ ] **Step 3: Add Glass to the registry**

In `src/engine/materials.ts`:

```ts
const glass: MaterialDef = {
  id: 'glass',
  nameKo: '유리',
  nameEn: 'Glass',
  // The ×2 ALWAYS lands on the word that breaks it — the destroy roll is reported
  // as a side effect and applied by the caller after the word settles (GDD §2.2).
  onTileScored: (ctx, _tile, rng) => {
    const cfg = BALANCE.materials.glass;
    ctx.mult *= cfg.multFactor;
    return rng.next() < cfg.destroyChance ? { destroy: true } : {};
  },
};
```

Register it: `[porcelain, polished, stone, leadPlate, glass]`

- [ ] **Step 4: Report destroyed tiles from submitWord**

In `src/engine/loop.ts`, add to `SubmitResult` (near line 130):

```ts
  /** tiles destroyed by their material (Glass) — the caller removes them from run.bag */
  destroyedTileIds: string[];
```

In `scoreSubmission`, collect them next to `materialGold`:

```ts
  let materialGold = 0;
  const destroyedTileIds: string[] = [];
```
```ts
    if (mat) {
      materialGold += mat.side.goldDelta ?? 0;
      if (mat.side.destroy) destroyedTileIds.push(t.id);
      // ... event push as before
    }
```

Return type and statement:

```ts
): { submission: WordSubmission; events: ScoreEvent[]; materialGold: number; destroyedTileIds: string[] } {
```
```ts
  return { submission, events, materialGold, destroyedTileIds };
```

In `submitWord`, destructure and return it:

```ts
  const { submission, events, materialGold, destroyedTileIds } = scoreSubmission(
    used, lexicon, run, blind, rng,
  );
```
```ts
  return { submission, events, goldDelta, destroyedTileIds, blind: { ...afterBlind, projectedScore } };
```

**No blind-state change is needed.** A played tile is already in `discardedThisBlind` and cannot be redrawn this blind; removing it from `run.bag` is what makes the loss permanent, because each blind reshuffles `run.bag` from scratch (`startBlind`, `loop.ts:47`).

- [ ] **Step 5: Apply destruction in both callers**

In `src/ui/useGame.ts`, in the submit reducer after `result` is obtained, fold gold and destruction into the run:

```ts
      const nextRun: RunState = {
        ...prev.run,
        gold: prev.run.gold + result.goldDelta,
        bag: result.destroyedTileIds.length
          ? prev.run.bag.filter((t) => !result.destroyedTileIds.includes(t.id))
          : prev.run.bag,
      };
```

Use `nextRun` where the reducer currently writes `run` back into state, and keep `rngCounter: prev.rngCounter + 1` from Task 3.

In `src/sim/autoplay.ts`, after the `submitWord` call:

```ts
    if (result.destroyedTileIds.length) {
      run.bag = run.bag.filter((t) => !result.destroyedTileIds.includes(t.id));
    }
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (16 tests)

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/materials.ts src/engine/loop.ts src/ui/useGame.ts src/sim/autoplay.ts tests/slice5-materials.test.ts
git commit -m "feat(materials): Glass — x2 mult with a 1/4 shatter

The x2 always lands on the word that breaks the tile; the destroy roll is
reported as destroyedTileIds and the caller removes it from run.bag, making
the loss permanent across the run.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Brass — ×1.5 mult while held in hand

Brass reads tiles **remaining in hand**, not the ones played. It fires once per held brass tile, per word.

**Files:**
- Modify: `src/engine/materials.ts` (add brass + `applyHeldMaterials`)
- Modify: `src/engine/loop.ts` (call it after the tile loop)
- Test: `tests/slice5-materials.test.ts`

**Interfaces:**
- Consumes: `MaterialDef.onHeldDuringScoring` (Task 2)
- Produces: `applyHeldMaterials(ctx: WordScoringContext, held: readonly Tile[]): { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }[]`

- [ ] **Step 1: Write the failing test**

```ts
describe('slice5 — Brass (GDD §2.2, Balatro Steel)', () => {
  it('multiplies mult per brass tile left in hand, not per brass tile played', () => {
    const run = { ...newRun('brass-seed'), bag: [...tiles('cat'), ...tiles('do', 'brass')] };
    const blind = startBlind(run, makeRng('brass-seed'));
    const played = blind.hand.filter((t) => t.material !== 'brass');
    const heldBrass = blind.hand.filter((t) => t.material === 'brass').length;
    const { events } = submitWord(
      blind, run, lex, played.map((t) => t.id), makeRng('r'),
    );
    const brassBeats = events.filter((e) => e.kind === 'material' && e.material === 'brass');
    expect(brassBeats).toHaveLength(heldBrass);
  });

  it('a played brass tile does not pay the held bonus', () => {
    const run = { ...newRun('brass-seed'), bag: tiles('cat', 'brass') };
    const blind = startBlind(run, makeRng('brass-seed'));
    const { events } = submitWord(
      blind, run, lex, blind.hand.map((t) => t.id), makeRng('r'),
    );
    // every brass tile was played → none held → no brass beats
    expect(events.some((e) => e.kind === 'material' && e.material === 'brass')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — no brass beats are ever emitted.

- [ ] **Step 3: Add Brass and the held applier**

In `src/engine/materials.ts`:

```ts
const brass: MaterialDef = {
  id: 'brass',
  nameKo: '황동',
  nameEn: 'Brass',
  // Type metal that stays in the case: pays while it is NOT played.
  onHeldDuringScoring: (ctx) => {
    ctx.mult *= BALANCE.materials.brass.multFactor;
  },
};
```

Register it: `[porcelain, polished, stone, leadPlate, glass, brass]`

Add the applier:

```ts
/**
 * Apply the materials of tiles REMAINING in hand (Brass). Fires once per held
 * tile, per word. Returns one delta record per tile that actually moved the
 * numbers, for the UI settle log.
 */
export function applyHeldMaterials(
  ctx: WordScoringContext,
  held: readonly Tile[],
): { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }[] {
  const out: { material: TileMaterial; tileId: string; chipsDelta: number; multDelta: number }[] = [];
  for (const tile of held) {
    const def = MATERIAL_REGISTRY.get(tile.material);
    if (!def?.onHeldDuringScoring) continue;
    const beforeChips = ctx.chips;
    const beforeMult = ctx.mult;
    def.onHeldDuringScoring(ctx, tile);
    const chipsDelta = ctx.chips - beforeChips;
    const multDelta = ctx.mult - beforeMult;
    if (chipsDelta !== 0 || multDelta !== 0) {
      out.push({ material: tile.material, tileId: tile.id, chipsDelta, multDelta });
    }
  }
  return out;
}
```

- [ ] **Step 4: Call it in the pipeline**

In `src/engine/loop.ts`, import `applyHeldMaterials` alongside `applyTileMaterial`.

`scoreSubmission` needs the held tiles. It already receives `blind`, but `blind.hand` still contains the played tiles at this point (`submitWord` filters them at line ~263, *after* scoring). Compute the held set inside `scoreSubmission`, right after the tile loop and **before** the letter-hand block:

```ts
  // Brass and friends read tiles REMAINING in hand — blind.hand still holds the
  // played tiles at this point, so exclude them explicitly.
  const playedIds = new Set(tiles.map((t) => t.id));
  const held = blind.hand.filter((t) => !playedIds.has(t.id));
  for (const beat of applyHeldMaterials(ctx, held)) {
    events.push({ kind: 'material', ...beat });
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (18 tests)

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/materials.ts src/engine/loop.ts tests/slice5-materials.test.ts
git commit -m "feat(materials): Brass — x1.5 mult per tile held in hand

Reads tiles remaining in hand, excluding the ones just played. Expected to
compound hard at hand size 11 — see the balance predictions in the spec.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Ivory — $3 per tile held at blind end

**Hazard:** `endBlind` is called **twice** for the same blind in `useGame.ts` (line 273 in `finalize`, line 594 in the settle-complete effect). `endBlind` must stay **pure** — it reports gold, it never applies it. Only `finalize` folds it into the run.

**Files:**
- Modify: `src/engine/materials.ts` (add ivory + `collectBlindEndMaterials`)
- Modify: `src/engine/loop.ts:291-309` (EndBlindResult, endBlind)
- Modify: `src/ui/useGame.ts:273-280` (apply once, in finalize only)
- Test: `tests/slice5-materials.test.ts`

**Interfaces:**
- Consumes: `MaterialDef.onHeldAtBlindEnd` (Task 2)
- Produces: `collectBlindEndMaterials(held: readonly Tile[]): number` (gold) · `EndBlindResult.materialGold: number`

- [ ] **Step 1: Write the failing test**

```ts
describe('slice5 — Ivory (GDD §2.2, Balatro Gold)', () => {
  it('pays $3 per ivory tile held at blind end', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat', 'ivory') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    const held = blind.hand.filter((t) => t.material === 'ivory').length;
    expect(endBlind(blind, run, lex).materialGold).toBe(3 * held);
  });

  it('pays nothing for ceramic hands', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    expect(endBlind(blind, run, lex).materialGold).toBe(0);
  });

  it('is pure — calling endBlind twice reports the same gold, never double-applies', () => {
    const run = { ...newRun('ivory-seed'), bag: tiles('cat', 'ivory') };
    const blind = startBlind(run, makeRng('ivory-seed'));
    const a = endBlind(blind, run, lex).materialGold;
    const b = endBlind(blind, run, lex).materialGold;
    expect(a).toBe(b);
    expect(run.gold).toBe(newRun('ivory-seed').gold); // untouched
  });
});
```

Add `endBlind` to the test file's `loop` import.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: FAIL — `materialGold` does not exist on `EndBlindResult`.

- [ ] **Step 3: Add Ivory and the collector**

In `src/engine/materials.ts`:

```ts
const ivory: MaterialDef = {
  id: 'ivory',
  nameKo: '상아',
  nameEn: 'Ivory',
  onHeldAtBlindEnd: () => ({ goldDelta: BALANCE.materials.ivory.gold }),
};
```

Register it: `[porcelain, polished, stone, leadPlate, glass, brass, ivory]`

```ts
/** Total gold from materials on tiles still in hand at blind end (Ivory). Pure. */
export function collectBlindEndMaterials(held: readonly Tile[]): number {
  let gold = 0;
  for (const tile of held) {
    const def = MATERIAL_REGISTRY.get(tile.material);
    if (!def?.onHeldAtBlindEnd) continue;
    gold += (def.onHeldAtBlindEnd(tile) ?? {}).goldDelta ?? 0;
  }
  return gold;
}
```

- [ ] **Step 4: Report it from endBlind**

In `src/engine/loop.ts`, import `collectBlindEndMaterials`, then extend `EndBlindResult`:

```ts
  /** gold from materials held in hand at blind end (Ivory). The CALLER applies it —
   *  endBlind is pure and is called more than once per blind (useGame.ts:273, 594). */
  materialGold: number;
```

```ts
export function endBlind(blind: BlindState, run: RunState, lexicon: Lexicon): EndBlindResult {
  const judgment = judgeSentence(blind.sequence, lexicon);
  const finalScore = scoreSentence(blind.committedScore, blind.sequence, judgment, run, blind);
  return {
    judgment,
    finalScore,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    materialGold: collectBlindEndMaterials(blind.hand),
  };
}
```

- [ ] **Step 5: Apply it exactly once in the UI**

In `src/ui/useGame.ts` `finalize` (line ~273), add the gold to the run **only here** — leave the line-594 effect reading `finalScore` alone:

```ts
      const final = endBlind(s.blind, s.run, lexicon);
      const runWithMaterialGold: RunState = {
        ...s.run,
        gold: s.run.gold + final.materialGold,
      };
      const outcome = resolveBlind(runWithMaterialGold, s.blind, final.finalScore);
```

Use `runWithMaterialGold` in place of `s.run` for the remainder of `finalize`.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/slice5-materials.test.ts`
Expected: PASS (21 tests)

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/engine/materials.ts src/engine/loop.ts src/ui/useGame.ts tests/slice5-materials.test.ts
git commit -m "feat(materials): Ivory — \$3 per tile held at blind end

endBlind reports materialGold but never applies it: it is called twice per
blind (useGame.ts:273, 594), so only finalize folds the gold into the run.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Packs stock the new materials + UI renders letterless tiles

Materials enter play through Letter Packs (GDD §9.3). The pool must include the three new ones, and a stone tile must be buildable and renderable.

**Files:**
- Modify: `src/engine/packs.ts:22, 42-51`
- Modify: `src/ui/styles/play.css` (stone face)
- Test: `tests/slice5-packs.test.ts`

**Interfaces:**
- Consumes: `TileMaterial` with the 3 new ids (Task 2)

- [ ] **Step 1: Write the failing test**

Append to `tests/slice5-packs.test.ts`:

```ts
describe('slice5 — packs stock all 7 non-base materials (GDD §9.3)', () => {
  it('can roll every material across many seeds, and stone tiles are letterless', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const run = { ...newRun(`pk${i}`), bag: [] };
      const offer = rollPack('letter', run, makeRng(`pk${i}`));
      for (const o of offer.options) {
        if (o.kind !== 'tile') continue;
        seen.add(o.tile.material);
        // The invariant that makes Stone work (GDD §2.2)
        if (o.tile.material === 'stone') expect(o.tile.letter).toBeNull();
        else expect(o.tile.letter).not.toBeNull();
      }
    }
    for (const m of ['porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass']) {
      expect(seen.has(m)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/slice5-packs.test.ts`
Expected: FAIL — `leadPlate`, `ivory`, `brass` are never rolled.

- [ ] **Step 3: Extend the pool and enforce the stone invariant**

In `src/engine/packs.ts` line 22:

```ts
const MATERIALS: readonly TileMaterial[] = [
  'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass',
];
```

Replace `rollTile` (lines 42-51):

```ts
function rollTile(run: RunState, rng: Rng, index: number): Tile {
  const letter = WEIGHTED_LETTERS[rng.int(WEIGHTED_LETTERS.length)]!;
  let material: TileMaterial = 'ceramic';
  let font: TileFont = 'medium';
  if (rng.next() < packEnhanceChance(run)) {
    if (rng.next() < 0.5) material = MATERIALS[rng.int(MATERIALS.length)]!;
    else font = FONTS[rng.int(FONTS.length)]!;
  }
  return {
    id: `pk${rng.int(1_000_000)}-${index}`,
    // Stone carries no letter — the invariant that forces gibberish (GDD §2.2)
    letter: material === 'stone' ? null : letter,
    case: 'upper',
    material,
    font,
  };
}
```

- [ ] **Step 4: Style the letterless face**

In `src/ui/styles/play.css`, find the existing `.tile.stone` rule (materials already emit their id as a class via `materialClass`, `game.ts:124-126`). If none exists, add one near the other material classes:

```css
/* Stone: a letterless tile (GDD §2.2). tileGlyph() renders nothing, so the face
   carries the whole read — no letter, no ink tint. */
.tile.stone {
  background: linear-gradient(160deg, var(--tile-stone-hi, #9a958c), var(--tile-stone-lo, #6f6a62));
  color: transparent;
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/slice5-packs.test.ts`
Expected: PASS

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/packs.ts src/ui/styles/play.css tests/slice5-packs.test.ts
git commit -m "feat(materials): packs stock all 7 materials; render letterless Stone

Enforces the Stone invariant at the point of creation: material 'stone'
implies letter null.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: The settle animation replays material beats

**This is the invariant task.** `settleDurationMs` counts every non-`settle` beat (`settle.tsx:75, 104`), so the new `material` events extend the timeline **for free** — do not add any delay. But the two accumulation paths only branch on `letterHand | joker | boss` (`settle.tsx:123, 166-184`), so material chips/mult would be silently dropped from the on-screen tally while the engine counted them. The scorebox would disagree with the score.

**Files:**
- Modify: `src/ui/settle.tsx:118-127` (reduced-motion path), `src/ui/settle.tsx:155-184` (animated path)
- Test: `tests/playtest05-settle-gate.test.ts`

**Interfaces:**
- Consumes: ScoreEvent variant `material` (Task 2)

- [ ] **Step 1: Write the failing test**

Append to `tests/playtest05-settle-gate.test.ts`:

```ts
const material = (id: string): ScoreEvent => ({
  kind: 'material',
  material: 'porcelain',
  tileId: id,
  chipsDelta: 30,
  multDelta: 0,
});

describe('settleDurationMs — material beats extend the timeline (GDD §2.2)', () => {
  it('a porcelain word settles longer than the same word in ceramic', () => {
    const ceramic = [...Array.from({ length: 3 }, (_, i) => tile(`t${i}`)), suit(), settle()];
    const porcelain = [
      tile('t0'), material('t0'),
      tile('t1'), material('t1'),
      tile('t2'), material('t2'),
      suit(), settle(),
    ];
    expect(settleDurationMs(porcelain, 1, false)).toBeGreaterThan(
      settleDurationMs(ceramic, 1, false),
    );
  });

  it('scales with speed like every other beat — never a fixed delay', () => {
    const beats = [tile('t0'), material('t0'), suit(), settle()];
    expect(settleDurationMs(beats, 1, false)).toBeGreaterThan(settleDurationMs(beats, 4, false));
  });
});
```

- [ ] **Step 2: Run test to verify it passes already, and understand why**

Run: `npx vitest run tests/playtest05-settle-gate.test.ts`
Expected: **PASS** — `settleDurationMs` filters on `kind !== 'settle'`, so it already counts material beats. This test is a **regression lock**, not a driver: it pins the behavior so nobody "optimizes" material beats out of the count later. The real defect is in the tally, which Step 3 fixes.

- [ ] **Step 3: Add the material branch to both paths**

In `src/ui/settle.tsx`, reduced-motion path (line ~123) — add `material` to the delta branch:

```ts
        else if (
          e.kind === 'letterHand' ||
          e.kind === 'joker' ||
          e.kind === 'boss' ||
          e.kind === 'material'
        ) {
          chips += e.chipsDelta;
          mult += e.multDelta;
        }
```

Animated path — add a branch after the `boss` branch (line ~184):

```ts
          } else if (e.kind === 'material') {
            // Materials pop on the tile itself, not as a stamp — the tile's own
            // ceramic/glass/stone face already carries the read (GDD §2.2).
            chips += e.chipsDelta;
            mult += e.multDelta;
            setView({ ...base, chips, mult, activeTileId: e.tileId });
          }
```

**Do not** touch `tilePops` — it maps tileId → letter chips and drives the `+N` tag. A material beat writing there would overwrite the letter's tag on the same tile.

- [ ] **Step 4: Run tests and verify in the app**

Run: `npx vitest run && npx tsc --noEmit`
Expected: green.

Drive it for real — tests cannot see a scorebox disagreeing with itself:

```bash
npm run dev
```

Start a run, buy Letter Packs until a non-ceramic tile appears, play it, and confirm the scorebox's running chips × mult matches the committed score when the settle lands. Confirm the verdict does not fire early on a long material-heavy word.

- [ ] **Step 5: Commit**

```bash
git add src/ui/settle.tsx tests/playtest05-settle-gate.test.ts
git commit -m "fix(settle): replay material beats in the tally

settleDurationMs already counted them (kind !== 'settle'), so the timeline
scaled correctly — but neither accumulation path branched on 'material', so
the on-screen tally silently dropped material chips/mult.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Sim scenario — measure the three balance predictions

The spec predicts three breakages from shipping Balatro's numbers on our scale. This task measures them instead of guessing.

**Files:**
- Create: `src/sim/materials.ts`
- Modify: `package.json` (add the script)

**Interfaces:**
- Consumes: everything from Tasks 1–8

- [ ] **Step 1: Write the scenario**

Create `src/sim/materials.ts`:

```ts
/**
 * Materials balance scenario (GDD §2.2). Measures the three predictions recorded
 * in docs/superpowers/specs/2026-07-17-tile-materials-design.md:
 *   1. Brass compounds to roughly ×11 off ~6 held tiles at hand size 11
 *   2. Porcelain's +30 dwarfs our Scrabble letter chips ("TASTE" = 5)
 *   3. Ivory / Lead plate economy values need no scaling
 *
 * Run: npx tsx src/sim/materials.ts
 */

import { newRun } from '../engine/run';
import { startBlind, submitWord } from '../engine/loop';
import { makeRng } from '../engine/rng';
import { BALANCE } from '../engine/balance';
import { loadStubLexicon } from './stub-lexicon';
import { findWord } from './autoplay';
import type { Tile, TileMaterial } from '../engine/types';

const TRIALS = 500;

function bagOf(material: TileMaterial): Tile[] {
  let i = 0;
  return Object.entries(BALANCE.bagComposition).flatMap(([letter, count]) =>
    Array.from({ length: count }, () => ({
      id: `s${i++}`,
      letter: material === 'stone' ? null : (letter as Tile['letter']),
      case: 'upper' as const,
      material,
      font: 'medium' as const,
    })),
  );
}

function meanScore(material: TileMaterial): { score: number; gold: number } {
  const lex = loadStubLexicon();
  let score = 0;
  let gold = 0;
  for (let i = 0; i < TRIALS; i++) {
    const run = { ...newRun(`sim-${material}-${i}`), bag: bagOf(material) };
    const blind = startBlind(run, makeRng(`sim-${material}-${i}`));
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, 3);
    const r = submitWord(blind, run, lex, word.map((t) => t.id), makeRng(`roll-${i}`));
    score += r.submission.settledScore;
    gold += r.goldDelta;
  }
  return { score: score / TRIALS, gold: gold / TRIALS };
}

const MATERIALS: TileMaterial[] = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass',
];

console.log(`Materials balance sweep — ${TRIALS} words per material, hand ${BALANCE.handSize}\n`);
const base = meanScore('ceramic').score;
for (const m of MATERIALS) {
  const { score, gold } = meanScore(m);
  const ratio = base > 0 ? (score / base).toFixed(1) : 'n/a';
  console.log(
    `  ${m.padEnd(10)} mean score ${score.toFixed(1).padStart(9)}` +
      `  ×${ratio.padStart(6)} vs ceramic` +
      (gold !== 0 ? `   gold/word ${gold.toFixed(2)}` : ''),
  );
}
console.log(`\nAnte-1 Draft target for reference: ${BALANCE.anteBaseTargets[0]}`);
console.log('Predictions: Brass ≈ ×11 · Porcelain heavily over base · economy values unscaled.');
```

**Reading the output:** `gold/word` captures Lead plate only — Ivory pays at blind end, not per word, so it correctly reports 0 here and its score ratio should sit at ~×1.0 (it has no scoring effect at all). Ivory's payout is already pinned by the Task 6 unit tests; this sweep exists to size the *scoring* materials.

Export `findWord` from `src/sim/autoplay.ts` if it is not already exported (add the `export` keyword to its declaration).

- [ ] **Step 2: Add the script**

In `package.json` `scripts`:

```json
    "sim:materials": "tsx src/sim/materials.ts"
```

- [ ] **Step 3: Run it and record the numbers**

Run: `npm run sim:materials`
Expected: a table of 8 rows. Brass should show a ratio far above the others (the prediction). Record the actual output in the spec's Balance Strategy section, replacing "predicted" with the measured values.

- [ ] **Step 4: Commit**

```bash
git add src/sim/materials.ts src/sim/autoplay.ts package.json docs/superpowers/specs/2026-07-17-tile-materials-design.md
git commit -m "sim: measure the three material balance predictions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

**Note:** `docs/` is gitignored in this repo (`.gitignore:48` — "Planning / design docs kept out of the shared repo"), so the spec edit will not be staged. That is expected; do not `git add -f`.

---

## Balance patch (after Task 9)

Do **not** tune numbers during Tasks 1–8. Once the sim reports, adjust `BALANCE.materials` only — no structural change should be needed, because every material's shape (additive, multiplicative, chance, gold) already matches Balatro's. If Brass must become additive rather than multiplicative, that is the one change that touches `materials.ts` rather than `balance.ts`.
