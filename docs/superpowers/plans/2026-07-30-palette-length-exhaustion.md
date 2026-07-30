# Palette scope, hand exhaustion, word-length multiplier, emoji-art chroma — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship four approved changes — Korean leaves the chromatic-unlock registry, an unplayable board (no tiles in hand, none in the pouch) resolves the blind, word length adds to Mult with the ante target curve re-tuned to match, and Emoji Tile art reveals its colours channel-by-channel with the palette.

**Architecture:** Items ①, ②, ④ are self-contained and land first. Item ③ changes the core scoring formula, so it lands last: engine rule → UI beat → existing score-expectation churn → sim-driven target re-tune. Every change keeps the headless-engine boundary (`src/engine/` never imports DOM) and the "no magic numbers outside `balance.ts`" rule.

**Tech Stack:** TypeScript strict, Vite, Vitest, React. `tsx` for sim scripts.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-30-palette-length-exhaustion-design.md`. Read it before Task 1.
- **Engine stays headless.** Nothing under `src/engine/` may import DOM, React, or browser APIs.
- **No magic numbers.** Every new tunable goes in `src/engine/balance.ts` first.
- **Docs land with code.** Each task that changes a rule or number edits the affected doc section in the *same* commit (CLAUDE.md principle 6 + spec-conflict protocol step 3).
- **Engine identifiers never renamed for display terms** — `joker`/`JokerDef`/`blind`/`ante` stay (CLAUDE.md).
- **Test command:** `npm test` (`vitest run`). Single file: `npx vitest run tests/<file>`.
- **Typecheck:** `npx tsc -b --noEmit`. If `tsc -b` has emitted into `dist/`, delete `dist/` before running `npm test` — vitest globs it and reports phantom failures.
- **`useGame.ts` is a React hook with no jsdom in this project.** Its wiring is tested by the established source-grep convention (`readFileSync('src/ui/useGame.ts', 'utf8')`), see `tests/feedback5-ui.test.ts:24` and `tests/persistent-run-layout.test.ts:26`.
- **Commit message trailer** on every commit:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  ```

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/ui/unlocks.ts` | Unlock registry + presentation application. Loses the `locale` effect kind; gains `chromaMatrix`. | 1, 3 |
| `src/ui/components/Collection.tsx` | Palette sections; loses the `locale` section row. | 1 |
| `src/ui/components/ChromaticReveal.tsx` | Celebration card; loses the `locale` body-key branch. | 1 |
| `src/ui/components/GameOver.tsx` | Run-end unlock swatches; loses the `'가'` glyph branch. | 1 |
| `src/engine/loop.ts` | Gains `blindExhausted`; `scoreSubmission` gains the length-mult beat. | 2, 4 |
| `src/ui/useGame.ts` | `playWord` + `discard` gain the exhaustion check. | 2 |
| `src/ui/App.tsx` | Mounts the `#unlock-chroma` SVG filter. | 3 |
| `src/ui/styles/play.css` | `.joker-art` filter hook + the hidden defs `<svg>`. | 3 |
| `src/engine/balance.ts` | `wordLength` block; re-tuned `anteBaseTargets`. | 4, 7 |
| `src/engine/scoring.ts` | `wordLengthMult` — the single source of truth. | 4 |
| `src/engine/types.ts` | `ScoreEvent` gains `wordLength`. | 4 |
| `src/engine/hint.ts` | Candidate ranking uses the same helper. | 4 |
| `src/ui/settle.tsx` | Folds the new event; publishes the stamp. | 5 |
| `src/ui/components/SentenceTray.tsx` | Renders the `wordLength` stamp label. | 5 |
| `locales/en.json`, `locales/ko.json` | Drop Korean-unlock rows; add the stamp row. | 1, 5 |
| `src/sim/length-mult.ts` | Clear-rate sweep that drives the target re-tune. | 7 |
| `package.json` | `sim:length-mult` script (+ the missing `sim:feel-chip-scale`). | 7 |
| `tests/chromatic-unlocks.test.ts` | Registry shape; gains the `chromaMatrix` cases. | 1, 3 |
| `tests/hand-exhaustion.test.ts` | **New.** The exhaustion predicate + loss resolution. | 2 |
| `tests/word-length-mult.test.ts` | **New.** The length-mult rule + its settle beat. | 4, 5 |
| `tests/yellow-lesson.test.ts` | Gains the "YELLOW must not clear ante 1" guard. | 7 |
| existing score-expectation tests (16 files) | Recomputed against the new formula. | 6 |
| `docs/GDD.md` | §3.1, §5.5, §6.6, §8.2, §13. | 1, 2, 4, 7 |
| `CLAUDE.md` | Length rule; stale YELLOW score. | 4, 7 |

---

### Task 1: Korean leaves the chromatic-unlock system

The language switch is already ungated — `src/ui/i18n.tsx:51` reads `wj.lang` through `usePersistedState` with no unlock check — so the `KOREAN` row rewarded the player with something they already had. Delete the row and the whole `locale` effect kind.

**Files:**
- Modify: `src/ui/unlocks.ts` (the `UnlockEffect` union, the `UNLOCKS` table)
- Modify: `src/ui/components/Collection.tsx:569-588`
- Modify: `src/ui/components/ChromaticReveal.tsx:14-22`
- Modify: `src/ui/components/GameOver.tsx:93-95`
- Modify: `locales/en.json`, `locales/ko.json`
- Modify: `docs/GDD.md` §13 (line ~1091)
- Test: `tests/chromatic-unlocks.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `UnlockEffect` narrows to `{ kind: 'color' } | { kind: 'audio' } | { kind: 'mascot' }`. `UNLOCKS.length` becomes `10`.

- [ ] **Step 1: Update the failing registry test**

In `tests/chromatic-unlocks.test.ts`, replace the first `it` block (currently asserting 11 entries including `KOREAN`):

```ts
  it('carries the initial table incl. the 4 color words + audio + mascots', () => {
    const ids = new Set(UNLOCKS.map((u) => u.id));
    for (const w of ['RED', 'YELLOW', 'GREEN', 'BLUE', 'MUSIC', 'SOUND', 'ALIEN', 'GHOST', 'DOG', 'TURTLE']) {
      expect(ids.has(w)).toBe(true);
    }
    expect(UNLOCKS.length).toBe(10);
  });

  it('does not gate the language — Korean is not a palette unlock (2026-07-30)', () => {
    expect(UNLOCKS.some((u) => u.id === 'KOREAN')).toBe(false);
    expect(UNLOCKS.some((u) => u.effect.kind === ('locale' as never))).toBe(false);
  });
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/chromatic-unlocks.test.ts`
Expected: FAIL — `expected 11 to be 10`, and the `KOREAN` absence assertion fails.

- [ ] **Step 3: Delete the row and the effect kind**

In `src/ui/unlocks.ts`, remove the `locale` member of the union:

```ts
export type UnlockEffect =
  | { kind: 'color'; group: UnlockGroup }
  | { kind: 'audio'; bus: 'music' | 'sfx' }
  | { kind: 'mascot'; variant: 'alien' | 'ghost' | 'dog' | 'turtle' };
```

and delete this line from `UNLOCKS`:

```ts
  { id: 'KOREAN', word: 'KOREAN', effect: { kind: 'locale', lang: 'ko' } },
```

- [ ] **Step 4: Remove the three consumer branches**

`src/ui/components/ChromaticReveal.tsx` — delete the `case 'locale'` line from `bodyKey`, leaving:

```ts
function bodyKey(def: UnlockDef): string {
  switch (def.effect.kind) {
    case 'color': return `unlock.body.${def.effect.group}`;
    case 'audio': return def.effect.bus === 'music' ? 'unlock.body.music' : 'unlock.body.sound';
    // A mascot with art is a real, selectable ally; art-less variants stay "coming soon".
    case 'mascot': return mascotVariantArt(def.effect.variant) ? 'unlock.body.mascotReady' : 'unlock.body.mascot';
  }
}
```

`src/ui/components/Collection.tsx` — drop the `locale` section row:

```ts
const PALETTE_SECTIONS: { key: string; kind: UnlockEffect['kind'] }[] = [
  { key: 'color', kind: 'color' },
  { key: 'audio', kind: 'audio' },
  { key: 'mascot', kind: 'mascot' },
];
```

and drop its `descKey` branch, leaving:

```ts
    const descKey =
      u.effect.kind === 'color' ? `unlock.body.${u.effect.group}`
      : u.effect.kind === 'audio' ? (u.effect.bus === 'music' ? 'unlock.body.music' : 'unlock.body.sound')
      : 'unlock.body.mascot';
```

`src/ui/components/GameOver.tsx` — drop the `'가'` branch:

```tsx
                  {u.effect.kind === 'audio' ? (u.effect.bus === 'music' ? '♪' : '🔊')
                    : u.effect.kind === 'mascot' ? '★'
                    : ''}
```

- [ ] **Step 5: Remove the orphaned locale rows**

Delete these lines from **both** `locales/en.json` and `locales/ko.json`:

- `"unlock.body.korean": ...` (line ~542)
- `"collection.palette.section.locale": ...` (line ~535)

Leave every other `collection.palette.section.*` row untouched.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/chromatic-unlocks.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: no errors. A leftover `'locale'` comparison anywhere becomes a type error — that is the point; fix any it reports by deleting the branch.

- [ ] **Step 8: Update GDD §13**

In `docs/GDD.md`, delete the `KOREAN` row from the "Initial table (C-2)" table (line ~1091) — the whole `| KOREAN | Korean-locale celebration entry ... |` line.

Then, in the same table's preamble paragraph, append this sentence so the reversal is recorded:

```
**Language is not a palette unlock (changed 2026-07-30).** Korean was a celebration entry for something the player already had — the language selector was never gated — so the row was removed along with the `locale` effect kind. The Palette now has three sections: 색상 / 음향 / 캐릭터.
```

- [ ] **Step 9: Full suite**

Run: `npm test`
Expected: PASS. If a test asserts the Palette has four sections or counts 11 unlocks, update it to three / 10 — those are the same change, not separate breakage.

- [ ] **Step 10: Commit**

```bash
git add src/ui/unlocks.ts src/ui/components/Collection.tsx src/ui/components/ChromaticReveal.tsx src/ui/components/GameOver.tsx locales/en.json locales/ko.json docs/GDD.md tests/chromatic-unlocks.test.ts
git commit -m "$(cat <<'EOF'
feat: language leaves the chromatic-unlock system

The KOREAN row celebrated an unlock the player already had — i18n never
gated the language selector. Removes the row and the whole `locale`
effect kind, so the Palette is 色/音/캐릭터 with 10 entries.

Existing profiles may hold an orphan 'KOREAN' id in wj.unlocks; it
matches no lookup and needs no migration.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: An unplayable board resolves the blind

The pouch never refills mid-blind (GDD §6.6) and discarded tiles exit play for the blind (§6.3), so a player can reach zero tiles in hand with phases remaining — a board that cannot be played and never resolves. Add one predicate and use it at both call sites.

Route through the normal `pendingEnd` path rather than a direct Game Over: `blind.projectedScore` already includes the sentence bonus and `autoSettle` fires on it, so reaching exhaustion without `autoSettle` means `projected < target` and `finalize` → `resolveBlind` judges a loss anyway. Reusing the path keeps the settle-complete gate intact (CLAUDE.md's first-class invariant).

**Files:**
- Modify: `src/engine/loop.ts` (new export)
- Modify: `src/ui/useGame.ts:1218-1220` (`playWord`) and `src/ui/useGame.ts:1302-1332` (`discard`)
- Modify: `docs/GDD.md` §6.6 (line ~433)
- Test: `tests/hand-exhaustion.test.ts` (new)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `blindExhausted(blind: BlindState): boolean` from `src/engine/loop.ts`.

- [ ] **Step 1: Write the failing test**

Create `tests/hand-exhaustion.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { blindExhausted } from '../src/engine/loop';
import { resolveBlind } from '../src/engine/progression';
import { newRun } from '../src/engine/run';
import type { BlindState, Letter, Tile } from '../src/engine/types';

let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `e${idc++}`,
  letter,
  material: 'ceramic',
  font: 'medium',
});

/** A minimal blind shape for the predicate — only hand/bag are read. */
const blindWith = (hand: Tile[], bag: Tile[]): BlindState =>
  ({ hand, bag } as unknown as BlindState);

describe('blindExhausted — an unplayable board (GDD §6.3, §6.6)', () => {
  it('is true only when the hand AND the pouch are both empty', () => {
    expect(blindExhausted(blindWith([], []))).toBe(true);
  });

  it('is false while a tile remains in hand', () => {
    expect(blindExhausted(blindWith([tile('A')], []))).toBe(false);
  });

  it('is false while the pouch can still refill the hand', () => {
    expect(blindExhausted(blindWith([], [tile('A')]))).toBe(false);
  });
});

describe('an exhausted board below target ends the run (GDD §7.4 → §9.1)', () => {
  it('resolveBlind reports a loss when the finalized score misses the target', () => {
    const run = newRun('exhaustion');
    const blind = { ...blindWith([], []), target: 100 } as BlindState;
    const outcome = resolveBlind(run, blind, 40);
    expect(outcome.cleared).toBe(false);
    expect(outcome.gameOver).toBe(true);
  });
});

describe('useGame wires the predicate at BOTH call sites', () => {
  const game = readFileSync('src/ui/useGame.ts', 'utf8');

  it('imports the shared predicate rather than re-deriving the condition', () => {
    expect(game).toContain('blindExhausted');
    // The raw condition must not be hand-inlined anywhere — one predicate, two callers.
    expect(game).not.toContain('hand.length === 0 && ');
  });

  it('uses it in the play path alongside phasesOut / autoSettle', () => {
    expect(game).toMatch(/phasesOut \|\| dryOut \|\| autoSettle/);
  });

  it('uses it in the discard path — discarding the last tiles with a dry pouch', () => {
    // The discard reducer must set pendingEnd, not return a stuck board.
    const discard = game.slice(game.indexOf('const discard = useCallback'));
    expect(discard.slice(0, 2000)).toContain('blindExhausted');
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/hand-exhaustion.test.ts`
Expected: FAIL — `blindExhausted` is not exported from `src/engine/loop.ts`.

- [ ] **Step 3: Add the predicate**

In `src/engine/loop.ts`, next to `submitWord`, add:

```ts
/**
 * No tiles in hand and none left to draw: the board cannot be played further, so
 * the blind must resolve (GDD §6.3 — discarded tiles exit play for the blind;
 * §6.6 — the pouch never refills mid-blind). Both conditions are required: a boss
 * `handSizeDelta` can empty the hand for a moment while the pouch still holds tiles.
 */
export function blindExhausted(blind: BlindState): boolean {
  return blind.hand.length === 0 && blind.bag.length === 0;
}
```

- [ ] **Step 4: Wire the play path**

In `src/ui/useGame.ts`, add `blindExhausted` to the existing `../engine/loop` import, then replace the auto-settle block at the end of `playWord` (line ~1218):

```ts
      const phasesOut = blind.phasesUsed >= blind.phasesTotal;
      // No tiles left to play and none to draw — the board is unplayable, so it
      // resolves here instead of stalling. Below target this is a loss; the normal
      // finalize path decides, so the sentence bonus still gets its chance.
      const dryOut = blindExhausted(blind);
      const autoSettle = !blind.earlyEndDisabled && blind.projectedScore >= blind.target;
      return phasesOut || dryOut || autoSettle ? { ...next, pendingEnd: true } : next;
```

- [ ] **Step 5: Wire the discard path**

This is the reachable case: discarding the whole hand with a dry pouch. In the `discard` reducer, replace the returned object's tail so it carries `pendingEnd`. The returned state currently ends at `stats:`; change the `return` to build the state first:

```ts
      const nextState: GameState = {
        ...prev,
        blind,
        run: {
          ...prev.run,
          jokers,
          gold: prev.run.gold + goldDelta,
          consumables: gained.length
            ? [...prev.run.consumables, ...gained]
            : prev.run.consumables,
        },
        message: slotsBlocked > 0 ? { key: 'font.slotsFull' } : null,
        hint: null,
        rngCounter: prev.rngCounter + 1,
        stats: { ...prev.stats, tilesDiscarded: prev.stats.tilesDiscarded + valid.length },
      };
      // Discarding the last tiles with a dry pouch leaves an unplayable board — the
      // same resolution the play path takes. No new settle runs, so `settleComplete`
      // is already true and the BUILD effect picks it up on the next render.
      return blindExhausted(blind) ? { ...nextState, pendingEnd: true } : nextState;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/hand-exhaustion.test.ts`
Expected: PASS.

- [ ] **Step 7: Typecheck and full suite**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS.

- [ ] **Step 8: Update GDD §6.6**

In `docs/GDD.md` §6.6 (line ~433), replace the section body with:

```
If the bag empties mid-blind, **no refill**; play continues on the remaining hand. Normally irrelevant (68 tiles), but any future phase-extension build remains physically capped by its available tile supply.

**Exhaustion resolves the blind (2026-07-30).** If the hand *and* the pouch are both empty, the board cannot be played further, so the blind resolves immediately through the normal settlement path — the sentence bonus is finalized and, if the total still misses the target, the run ends. Reachable two ways: playing the last tiles, or discarding the whole hand with a dry pouch (§6.3 — discarded tiles do not come back mid-blind). One predicate, `blindExhausted`, serves both call sites; it does **not** short-circuit to Game Over, so the deciding sentence bonus is still seen landing (§7.2).
```

- [ ] **Step 9: Commit**

```bash
git add src/engine/loop.ts src/ui/useGame.ts docs/GDD.md tests/hand-exhaustion.test.ts
git commit -m "$(cat <<'EOF'
fix: an unplayable board resolves the blind instead of stalling

Zero tiles in hand with a dry pouch left the board stuck: the blind ends
only on phases-out or projected >= target, and neither can arrive. Adds
blindExhausted() and uses it in both playWord and discard.

Routes through the normal pendingEnd path, not a direct Game Over, so
the settle-complete gate and the sentence-finalize beat are preserved.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Emoji Tile art tracks the palette unlocks

`.joker-art` lives inside `.frame`, so `:root.world-mono .frame { filter: grayscale(1) }` greys it — but `world-mono` drops the instant *any* colour unlocks, so one RED unlock reveals every hue in every PNG. Gate the art's chroma per RGB channel from the same active-unlock set.

Emoji Tile art only. Fable / Gambler / Voucher / Pack / Boss art keep the current all-or-nothing behaviour — an accepted inconsistency, recorded in the spec.

**Files:**
- Modify: `src/ui/unlocks.ts` (new `chromaMatrix` export; `applyPresentation` writes it)
- Modify: `src/ui/App.tsx` (mount the filter)
- Modify: `src/ui/styles/play.css` (`.joker-art` hook + hidden defs)
- Test: `tests/chromatic-unlocks.test.ts`

**Interfaces:**
- Consumes: `UNLOCKS`, `UnlockGroup`, `activeUnlocks` from Task 1's narrowed `src/ui/unlocks.ts`.
- Produces: `chromaMatrix(active: ReadonlySet<string>): string` — a 20-number `feColorMatrix values` string.

- [ ] **Step 1: Write the failing test**

Append to `tests/chromatic-unlocks.test.ts` (it already imports from `../src/ui/unlocks`; add `chromaMatrix` to that import list):

```ts
describe('chromaMatrix — Emoji Tile art chroma gate (2026-07-30)', () => {
  const LUM = '0.2126 0.7152 0.0722';

  it('no colour unlocked → exactly grayscale(1)', () => {
    expect(chromaMatrix(new Set())).toBe(
      `${LUM} 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('all four colours → the identity matrix (no filtering)', () => {
    expect(chromaMatrix(new Set(['RED', 'YELLOW', 'GREEN', 'BLUE']))).toBe(
      '1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 1 0',
    );
  });

  it('RED opens the red channel only; green and blue stay on luminance', () => {
    expect(chromaMatrix(new Set(['RED']))).toBe(
      `1 0 0 0 0 ${LUM} 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('YELLOW opens red AND green — the union of its channels', () => {
    expect(chromaMatrix(new Set(['YELLOW']))).toBe(
      `1 0 0 0 0 0 1 0 0 0 ${LUM} 0 0 0 0 0 1 0`,
    );
  });

  it('ignores non-colour unlocks', () => {
    expect(chromaMatrix(new Set(['MUSIC', 'SOUND', 'DOG']))).toBe(chromaMatrix(new Set()));
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/chromatic-unlocks.test.ts`
Expected: FAIL — `chromaMatrix` is not exported.

- [ ] **Step 3: Implement the matrix builder**

In `src/ui/unlocks.ts`, above `applyPresentation`:

```ts
/** Rec. 709 luminance row — the value a locked (desaturated) channel takes. */
const LUM = [0.2126, 0.7152, 0.0722] as const;

/** RGB channels each colour group restores. YELLOW is red+green (2026-07-30). */
const CHROMA_CHANNELS: Record<UnlockGroup, readonly number[]> = {
  red: [0],
  yellow: [0, 1],
  green: [1],
  blue: [2],
};

/**
 * The `feColorMatrix values` for `#unlock-chroma`, the Emoji Tile art chroma gate.
 * Each output channel is either its own value (its group is unlocked) or the
 * luminance (locked): `out_c = lum + k_c × (c − lum)`. So no unlocks is exactly
 * `grayscale(1)`, all four is the identity, and a locked hue lands on the same
 * grey full greyscale would give it — never black. 20 numbers: 3 colour rows of
 * `r g b a offset`, then the untouched alpha row.
 */
export function chromaMatrix(active: ReadonlySet<string>): string {
  const gates = [0, 0, 0];
  for (const u of UNLOCKS) {
    if (u.effect.kind !== 'color' || !active.has(u.id)) continue;
    for (const c of CHROMA_CHANNELS[u.effect.group]) gates[c] = 1;
  }
  const rows = gates.map((k, c) =>
    [0, 1, 2].map((i) => (1 - k) * LUM[i] + (i === c ? k : 0)).join(' '),
  );
  return `${rows.map((row) => `${row} 0 0`).join(' ')} 0 0 0 1 0`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/chromatic-unlocks.test.ts`
Expected: PASS. If a row prints `0.21260000000000002`, the arithmetic order in Step 3 was changed — restore it exactly as written.

- [ ] **Step 5: Write the matrix from applyPresentation**

Inside `applyPresentation`'s `if (typeof document !== 'undefined')` block, after the `world-mono` toggle:

```ts
    // Emoji Tile art chroma gate (2026-07-30): the palette reveals progressively,
    // so the art must too — one filter, driven by the same active set.
    const chroma = document.querySelector('#unlock-chroma feColorMatrix');
    if (chroma) chroma.setAttribute('values', chromaMatrix(active));
```

- [ ] **Step 6: Mount the filter**

In `src/ui/App.tsx`, inside the outer fragment beside `<CrtOverlay />`:

```tsx
      {/* Emoji Tile art chroma gate — applyPresentation (unlocks.ts) rewrites the
          matrix from the active colour unlocks. Always mounted; a filter needs no
          visible geometry. colorInterpolationFilters MUST be sRGB — the linearRGB
          default would shift the greys away from grayscale(1). */}
      <svg className="unlock-chroma-defs" aria-hidden="true">
        <filter id="unlock-chroma" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
          />
        </filter>
      </svg>
      <CrtOverlay />
```

- [ ] **Step 7: Apply it to the art**

In `src/ui/styles/play.css`, next to the existing `.joker-art` rule:

```css
/* Emoji Tile art reveals its colours channel-by-channel with the palette
   (2026-07-30). The matrix is rewritten by applyPresentation; with nothing
   unlocked it equals grayscale(1), so this composes cleanly with world-mono. */
.joker-art {
  filter: url(#unlock-chroma);
}
/* The filter host carries no layout — it exists only to hold the <filter>. */
.unlock-chroma-defs {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}
```

If the existing `.joker-art` rule already sets `filter`, merge into that declaration instead of adding a second rule — do not let two `filter` declarations race.

- [ ] **Step 8: Verify in the running game**

Use the `verify` skill. Set `wj.tutorialIntro` first (else the guided intro hard-locks every tile). Check, in order:

1. Fresh profile, no unlocks → Emoji Tile art is greyscale.
2. Play RED → the art's reds come back; its blues and greens stay grey.
3. Settings → "reveal all presentation" → art is fully coloured.

- [ ] **Step 9: Typecheck and full suite**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/ui/unlocks.ts src/ui/App.tsx src/ui/styles/play.css tests/chromatic-unlocks.test.ts
git commit -m "$(cat <<'EOF'
feat: Emoji Tile art reveals its colours with the palette

world-mono dropped on the first colour unlock, so a single RED revealed
every hue in every Emoji Tile PNG at once while the token palette was
still mostly grey. Gates the art per RGB channel with one feColorMatrix
that applyPresentation rewrites from the active unlock set.

Luminance-preserving, so a locked hue lands on the grey grayscale(1)
would give it. Emoji Tile art only for now.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Word length adds to Mult — the engine rule

`score = chips × (suitMult + length × multPerLetter)`, `multPerLetter: 1`, valid words only.

Additive rather than `chips × suitMult × length` so the suit multiplier keeps its weight. Length already pays through chips and through the Longword letter hand (§5.5) — those are the Chips side, this is the Mult side, so they are not duplicates.

**Gibberish is excluded** (GDD §6.4 pays gibberish `chips × 1.0`, no suit multiplier). This also settles letterless Stone tiles for free: a word containing one always fails lookup, so it is gibberish and gets no length bonus.

**Files:**
- Modify: `src/engine/balance.ts` (new `wordLength` block)
- Modify: `src/engine/scoring.ts` (new `wordLengthMult`; used by `scoreWord`)
- Modify: `src/engine/types.ts` (`ScoreEvent` gains `wordLength`)
- Modify: `src/engine/loop.ts` (`scoreSubmission` emits the beat)
- Modify: `src/engine/hint.ts` (candidate ranking)
- Modify: `docs/GDD.md` §3.1, §5.5; `CLAUDE.md`
- Test: `tests/word-length-mult.test.ts` (new)

**Interfaces:**
- Consumes: nothing from Tasks 1–3 — this is an independent engine change.
- Produces:
  - `BALANCE.wordLength: { multPerLetter: number }`
  - `wordLengthMult(letterCount: number, isGibberish: boolean): number` from `src/engine/scoring.ts` — takes a **count**, not tiles, because `hint.ts` ranks word *strings* and has no tiles.
  - `ScoreEvent` variant `{ kind: 'wordLength'; letters: number; multDelta: number }`.

- [ ] **Step 1: Write the failing test**

Create `tests/word-length-mult.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { scoreWord, wordLengthMult } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import type { Letter, Tile } from '../src/engine/types';

let idc = 0;
const tile = (letter: Letter): Tile => ({
  id: `w${idc++}`,
  letter,
  material: 'ceramic',
  font: 'medium',
});
const tiles = (word: string): Tile[] =>
  [...word.toUpperCase()].map((ch) => tile(ch as Letter));

const lex = makeLexicon(['cat', 'run'], {
  run: { suit: 'slang', pos: ['verbIntransitive'] },
});

describe('wordLengthMult — length adds to Mult (GDD §3.1, 2026-07-30)', () => {
  it('adds multPerLetter per letter for a valid word', () => {
    expect(wordLengthMult(3, false)).toBe(3 * BALANCE.wordLength.multPerLetter);
  });

  it('adds nothing for gibberish (GDD §6.4 — chips × 1.0, no multipliers)', () => {
    expect(wordLengthMult(8, true)).toBe(0);
  });

  it('is zero for an empty submission', () => {
    expect(wordLengthMult(0, false)).toBe(0);
  });
});

describe('scoreWord folds the length bonus into layer 1', () => {
  it('adds length to the suit multiplier, not multiplying by it', () => {
    // CAT = C(9)+A(3)+T(3) = 15 chips; standard ×1.0; length 3
    //   => 15 × (1.0 + 3) = 60
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(60);
  });

  it('keeps the suit multiplier meaningful alongside it', () => {
    // RUN = R(3)+U(3)+N(3) = 9 chips; slang ×2.0; length 3
    //   => 9 × (2.0 + 3) = 45
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(45);
  });

  it('leaves gibberish on chips × 1.0', () => {
    // ZZZ is not in the lexicon: Z(30)×3 = 90 chips × 1.0, no length bonus
    expect(scoreWord(tiles('zzz'), lex).settledScore).toBe(90);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/word-length-mult.test.ts`
Expected: FAIL — `wordLengthMult` is not exported and `BALANCE.wordLength` does not exist.

- [ ] **Step 3: Add the balance value**

In `src/engine/balance.ts`, directly after the `suitMult` block:

```ts
  \ ----- Word length (GDD §3.1, 2026-07-30) — length ADDS to Mult, it does not
  //       multiply the suit multiplier: `chips × (suitMult + length × multPerLetter)`.
  //       Additive keeps the suit multiplier weighty instead of swamped. Valid words
  //       only (§6.4). The Longword letter hand (§5.5) is the Chips side of the same
  \       idea, so the two are not duplicates. Sim: src/sim/length-mult.ts. -----
  wordLength: { multPerLetter: 1 },
```

- [ ] **Step 4: Add the single-source helper**

In `src/engine/scoring.ts`, after `letterChips`:

```ts
/**
 * The Mult a word's length adds (GDD §3.1). Takes a letter COUNT, not tiles, so
 * the hint solver — which ranks word strings with no tiles in hand — shares the
 * one rule. Gibberish is excluded (§6.4): it pays chips × 1.0 with no multipliers,
 * which also handles letterless Stone tiles, since a word holding one always fails
 * lookup and is therefore gibberish.
 */
export function wordLengthMult(letterCount: number, isGibberish: boolean): number {
  return isGibberish ? 0 : letterCount * BALANCE.wordLength.multPerLetter;
}
```

Then fold it into `scoreWord`'s context, replacing the `ctx` line:

```ts
  const ctx: WordScoringContext = {
    submission,
    chips: b.chips,
    mult: b.mult + wordLengthMult(tiles.length, b.isGibberish),
  };
```

Leave `baseScore` untouched — it reports the lexicon lookup result, and the length bonus is a pipeline beat.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/word-length-mult.test.ts`
Expected: PASS.

- [ ] **Step 6: Add the score event type**

In `src/engine/types.ts`, add a variant to `ScoreEvent` immediately after the `suit` line (line ~177), matching the presentation order it will be emitted in:

```ts
  | { kind: 'wordLength'; letters: number; multDelta: number }
```

- [ ] **Step 7: Emit the beat in the live pipeline**

In `src/engine/loop.ts`'s `scoreSubmission`, immediately after `events.push({ kind: 'suit', suit: b.suit, mult: b.mult });` (line ~439):

```ts
  // Word length adds Mult (GDD §3.1) — a whole-word stamp landing right after the
  // suit, so the letter hand below stacks on top of it. Valid words only (§6.4).
  const lengthMult = wordLengthMult(tiles.length, submission.isGibberish);
  if (lengthMult !== 0) {
    ctx.mult += lengthMult;
    events.push({ kind: 'wordLength', letters: tiles.length, multDelta: lengthMult });
  }
```

Add `wordLengthMult` to the existing `./scoring` import in that file.

Then add `'wordLength'` to the `wholeWordEvents` filter (line ~560) so the beat is presented with the other whole-word stamps:

```ts
  const wholeWordEvents = events.filter(
    (event) => event.kind === 'suit' || event.kind === 'wordLength' || event.kind === 'letterHand',
  );
```

- [ ] **Step 8: Fix the hint solver's ranking**

In `src/engine/hint.ts`, import the helper and apply it — without this the Magnifier recommends the wrong word:

```ts
import { wordLengthMult } from './scoring';
```

and replace the candidate push:

```ts
    const entry = lexicon.lookup(word);
    // Only real dictionary words reach here (they came from lexicon.words()), so
    // the length bonus always applies — same rule as the live pipeline (GDD §3.1).
    const mult = (entry ? BALANCE.suitMult[entry.suit] : 1) + wordLengthMult(word.length, false);
    candidates.push({ word, score: letterChips(word) * mult });
```

Also update the `HintWord.score` doc comment:

```ts
  /** base score (letter chips × (suit multiplier + length bonus), no jokers) — for ranking */
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS. If `src/ui/settle.tsx` errors on a non-exhaustive `ScoreEvent` switch, leave it — Task 5 fixes it. If it does error, note the message and continue; do not patch settle.tsx here.

- [ ] **Step 10: Update the docs**

`docs/GDD.md` §3.1 — after the suit table's two block-quotes, add:

```
**Word length adds to Mult (2026-07-30).** A valid word's score is `letter chips × (suit multiplier + length × BALANCE.wordLength.multPerLetter)`, with `multPerLetter` = 1 — a 5-letter Standard word settles at `chips × 6.0`. Length is **added** to the suit multiplier, not multiplied by it, so the register asymmetry above keeps its weight instead of being swamped by a linear length term. Gibberish is excluded (§6.4): it stays at `chips × 1.0`, so dumping eight random tiles never competes with spelling. Sim: `src/sim/length-mult.ts`.
```

`docs/GDD.md` §5.5 — append to the "Scoring placement" bullet:

```
The length multiplier (§3.1) folds in just before this, on the Mult side; Longword is the Chips side of the same idea, so the two stack rather than duplicating.
```

`CLAUDE.md` — add to the "Key rules easy to get wrong" list, right after the "Letter hands (GDD §5.5)" bullet:

```
- **Word length adds to Mult, it does not multiply (GDD §3.1, 2026-07-30):** `chips × (suitMult + length × BALANCE.wordLength.multPerLetter)`. **Valid words only** — gibberish stays `chips × 1.0` (§6.4), which also covers letterless Stone tiles (a word holding one always fails lookup). One helper, `wordLengthMult(letterCount, isGibberish)` in `src/engine/scoring.ts`, is the single source of truth: `scoreWord`, `loop.ts`'s `scoreSubmission`, and `engine/hint.ts` all call it. Forgetting `hint.ts` makes the Magnifier recommend the wrong word.
```

- [ ] **Step 11: Commit (suite still red — that is expected)**

Existing tests assert pre-change scores; Task 6 updates them. Commit the rule now so the churn is a reviewable diff of its own.

```bash
git add src/engine/balance.ts src/engine/scoring.ts src/engine/types.ts src/engine/loop.ts src/engine/hint.ts docs/GDD.md CLAUDE.md tests/word-length-mult.test.ts
git commit -m "$(cat <<'EOF'
feat: word length adds to Mult

score = chips x (suitMult + length x multPerLetter), multPerLetter 1,
valid words only. Additive rather than multiplicative so the register
asymmetry keeps its weight; Longword stays the Chips side of the idea.

wordLengthMult() is the single source of truth, shared by scoreWord, the
live pipeline, and the hint solver. Existing score expectations are
updated in the following commit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The length beat lands on screen

The player has to see the rule. Emit it as a stamp on the just-scored word, reusing the existing letter-hand/suit stamp machinery — no new CSS.

**Files:**
- Modify: `src/ui/settle.tsx` (`SettleView.stamp` union, `accumulate`, the timeline branch, the audio branch)
- Modify: `src/ui/components/SentenceTray.tsx:34-44`
- Modify: `locales/en.json`, `locales/ko.json`
- Test: `tests/word-length-mult.test.ts` (extend)

**Interfaces:**
- Consumes: the `{ kind: 'wordLength'; letters: number; multDelta: number }` event from Task 4.
- Produces: `SettleView.stamp.kind` widens to `'letterHand' | 'suit' | 'wordLength'`.

- [ ] **Step 1: Write the failing test**

Append to `tests/word-length-mult.test.ts`:

```ts
import { accumulate } from '../src/ui/settle';
import type { ScoreEvent } from '../src/engine/types';

describe('the length beat lands in the settle timeline', () => {
  it('ADDS to the running mult, like every other delta event', () => {
    const e: ScoreEvent = { kind: 'wordLength', letters: 5, multDelta: 5 };
    expect(accumulate({ chips: 20, mult: 1 }, e)).toEqual({ chips: 20, mult: 6 });
  });

  it('does not touch chips', () => {
    const e: ScoreEvent = { kind: 'wordLength', letters: 3, multDelta: 3 };
    expect(accumulate({ chips: 15, mult: 1 }, e).chips).toBe(15);
  });
});
```

Check `accumulate`'s exact parameter and return shape in `src/ui/settle.tsx:100-131` first and match it — if it takes `(state, event)` with a different property set, adjust these two assertions to that shape rather than changing `accumulate`.

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run tests/word-length-mult.test.ts`
Expected: FAIL — `accumulate` does not fold `wordLength`, so mult stays 1.

- [ ] **Step 3: Fold the event**

In `src/ui/settle.tsx`, add `'wordLength'` to the delta-adding branch (line ~125), which currently lists `letterHand`/`joker`/`boss`/`material`:

```ts
  if (
    e.kind === 'letterHand' ||
    e.kind === 'wordLength' ||
    e.kind === 'joker' ||
    e.kind === 'boss' ||
    e.kind === 'material' ||
```

Also extend that function's doc comment (line ~103) to name the new event:

```
 * All delta-emitting events (`letterHand`, `wordLength`, `joker`, `boss`,
 * `material`) ADD to mult, never overwrite.
```

- [ ] **Step 4: Widen the stamp union and publish the beat**

`SettleView.stamp` (line ~65):

```ts
  /** a letter-hand / suit / word-length stamp landing this beat */
  stamp: { kind: 'letterHand' | 'suit' | 'wordLength'; label: string } | null;
```

The timeline branch, after the `letterHand` case (line ~283):

```ts
          } else if (e.kind === 'wordLength') {
            setView({ ...base, stamp: { kind: 'wordLength', label: String(e.letters) } });
```

The audio branch (line ~226) — the length beat is a stamp, so it gets the stamp sound:

```ts
          } else if (e.kind === 'suit' || e.kind === 'wordLength' || e.kind === 'letterHand' || e.kind === 'boss') {
            audio.play('stamp');
```

- [ ] **Step 5: Render the label**

`src/ui/components/SentenceTray.tsx`'s `WordStamp`:

```tsx
  const label =
    settle.stamp.kind === 'letterHand'
      ? t(`letterhand.${settle.stamp.label}`)
      : settle.stamp.kind === 'wordLength'
        ? t('settle.wordLength', { n: settle.stamp.label })
        : t(`suit.${settle.stamp.label}`);
```

- [ ] **Step 6: Add the locale rows**

`locales/en.json`, beside the other `settle.*` rows (if there are none, place it after the `letterhand.*` block):

```json
  "settle.wordLength": "{n} LETTERS",
```

`locales/ko.json`:

```json
  "settle.wordLength": "{n}글자",
```

Confirm the interpolation token style against a neighbouring row (e.g. `gameover.score`) and match it exactly — this project uses `{name}`, not `{{name}}`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/word-length-mult.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b --noEmit`
Expected: PASS. Any remaining non-exhaustive `ScoreEvent` switch surfaces here — add a `wordLength` case that mirrors the `letterHand` one.

- [ ] **Step 9: Verify in the running game**

Use the `verify` skill (set `wj.tutorialIntro` first). Play a 5-letter word and confirm: the "5 LETTERS" stamp lands on the word right after the suit stamp, the mult in the scorebox rises by 5 on that beat, and the round number still rolls exactly once to the new committed total.

- [ ] **Step 10: Commit**

```bash
git add src/ui/settle.tsx src/ui/components/SentenceTray.tsx locales/en.json locales/ko.json tests/word-length-mult.test.ts
git commit -m "$(cat <<'EOF'
feat: the word-length bonus lands as its own settle stamp

Reuses the letter-hand/suit stamp machinery so the new Mult source is
visible rather than folded silently into the suit beat. No new CSS.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Update the existing score expectations

Roughly 51 `settledScore` assertions across 16 test files encode the pre-change formula, plus committed/projected/final totals in others. Every one must be **recomputed by hand**, never pasted from the failure output — a wrong expected value pasted from actual output turns a real regression into a green test.

**Files:** every test file `npm test` reports failing. Expect: `slice1-scoring`, `slice1-loop`, `slice2-suits`, `slice2-projection`, `slice3-loop`, `slice3-patterns`, `a2-letter-hands`, `fonts`, `slice5-materials`, `slice5-bosses`, `slice5-progression`, `feature03-enhancements`, `voucher-editions`, `promoted-jokers`, `emoji-roster`, `emoji-sample`, `fables`, `p1-scoreevents`, `playtest06-persist`.

**Interfaces:**
- Consumes: the rule from Task 4 and the settle beat from Task 5.
- Produces: a green suite. No source changes.

- [ ] **Step 1: Get the full failure list**

Run: `npm test 2>&1 | tee /tmp/length-mult-failures.txt`
(Use the scratchpad path from the environment instead of `/tmp` if `/tmp` is unavailable.)

Record the failing file list before touching anything.

- [ ] **Step 2: Fix one file, verifying each number by hand**

Work one file at a time. For each failing assertion, compute the expected value from the formula and write it with the arithmetic in a comment:

```
expected = letterChips(word) × (BALANCE.suitMult[suit] + word.length)
```

Worked examples from `tests/slice1-scoring.test.ts`:

```ts
  it('sums Scrabble letter chips for a valid word', () => {
    // CAT = C(9)+A(3)+T(3) = 15 chips; standard ×1.0 + length 3 => 15 × 4.0 = 60
    expect(scoreWord(tiles('cat'), lex).settledScore).toBe(60);
  });

  it('applies the register suit multiplier in layer 1 (slice ②, GDD §3.1)', () => {
    // RUN = R(3)+U(3)+N(3) = 9 chips; slang ×2.0 + length 3 => 9 × 5.0 = 45
    expect(scoreWord(tiles('run'), lex).settledScore).toBe(45);
  });
```

Rules while doing this:

- **A gibberish assertion must NOT change.** If one does, the exclusion in `wordLengthMult` is broken — stop and fix `src/engine/scoring.ts`, do not adjust the test.
- **A ratio assertion (`expect(a).toBeGreaterThan(b)`) usually should not change.** If it does, that is a real behaviour change worth reporting, not a number to nudge.
- **Letter-hand tests** (`a2-letter-hands`) now include the length mult on top of the hand's own bonus. Recompute as `chips × (suitMult + length + handMult)` and keep the hand's contribution visible in the comment.
- If a computed value and the actual differ, the **source** is wrong. Investigate before editing the test.

Run the single file after each edit: `npx vitest run tests/<file>`

- [ ] **Step 3: Repeat for every failing file**

Continue until `npm test` is green. Do not batch-edit with sed.

- [ ] **Step 4: Full suite + typecheck**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS, zero failures.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "$(cat <<'EOF'
test: recompute score expectations for the length multiplier

Every value recomputed by hand as chips x (suitMult + length) and the
arithmetic left in a comment beside it. Gibberish expectations are
unchanged, which is the check that the exclusion holds.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Re-tune the ante target curve

The length multiplier raises a 3–6 letter word's effective mult by roughly 3–7×, so `anteBaseTargets` = `[100, 300, 800, 2000, 5000, 11000, 20000, 35000]` no longer holds its shape.

**Concrete breakage, and the acceptance check.** The guided intro rigs the opening hand to YELLOW and depends on that word **not** clearing the blind. YELLOW = Y(12)+E(3)+L(3)+L(3)+O(3)+W(12) = **36 chips**, suit `standard` ×1.0. Before: 36 vs target 100 — the lesson ends, the blind continues, as designed. After: 36 × (1.0 + 6) = **252** — the tutorial's first word clears ante 1. So ante-1 small must exceed 252.

(CLAUDE.md's "submitting YELLOW (~12)" is stale — it predates the letterChips ×3 feel pass. Fix it to ~36 pre-change / 252 post-change here. GDD §13's C-5 paragraph is also stale: it still says the target is lowered to 10 and that YELLOW clears the blind, both retired 2026-07-22. Fix it in the same pass — CLAUDE.md principle 6.)

**Files:**
- Create: `src/sim/length-mult.ts`
- Modify: `package.json` (sim script)
- Modify: `src/engine/balance.ts` (`anteBaseTargets`)
- Modify: `docs/GDD.md` §8.2, §13; `CLAUDE.md`
- Test: `tests/yellow-lesson.test.ts`

**Interfaces:**
- Consumes: `blindExhausted` (Task 2), `BALANCE.wordLength` (Task 4).
- Produces: re-tuned `BALANCE.anteBaseTargets`.

- [ ] **Step 1: Write the sim**

Create `src/sim/length-mult.ts`, modelled on `src/sim/feel-chip-scale.ts` (the established precedent — the same measurement drove the letterChips ×3 decision):

```ts
/// <reference types="node" />
/**
 * Word-length multiplier sweep (2026-07-30): length adds to Mult
 * (BALANCE.wordLength.multPerLetter), so the ante target curve has to move with it.
 *
 * For each ante 1–4, plays ~200 seeded "small" blinds: greedy best-word each phase
 * (same DFS word-finder as autoplay.ts/feel-chip-scale.ts — finds *a* spellable
 * word, not an exhaustively optimal one, the established convention here), no
 * discards, then reports clear% and average margin vs the ante's target.
 *
 * Read it against feel-chip-scale.ts's recorded baseline: ante 1 ~77.5% clear,
 * antes 2-4 falling off sharply. Re-tune anteBaseTargets to restore that shape.
 *
 * Run: npm run sim:length-mult
 */

import { newRun } from '../engine/run';
import { startBlind, submitWord, endBlind, blindExhausted } from '../engine/loop';
import { makeRng } from '../engine/rng';
import { blindTarget } from '../engine/economy';
import { BALANCE } from '../engine/balance';
import { loadStubLexicon } from './stub-lexicon';
import { findWord } from './find-word';

const SEEDS = 200;
const ANTES = [1, 2, 3, 4] as const;

function playAnte(ante: number, seed: string): { finalScore: number; target: number } {
  const lex = loadStubLexicon();
  const run = { ...newRun(seed), ante, blindIndex: 0 as const };
  const target = blindTarget(ante, 'small');
  let blind = startBlind(run, makeRng(seed), { target });

  while (blind.phasesUsed < blind.phasesTotal && !blindExhausted(blind)) {
    const word = findWord(blind.hand, lex) ?? blind.hand.slice(0, Math.min(3, blind.hand.length));
    const ids = word.map((t) => t.id);
    const result = submitWord(blind, run, lex, ids, makeRng(`${seed}#w${blind.phasesUsed}`));
    blind = result.blind;
  }

  const final = endBlind(blind, run, lex);
  return { finalScore: final.finalScore, target: blind.target };
}

console.log(
  `Length-mult sweep — multPerLetter ${BALANCE.wordLength.multPerLetter}, ${SEEDS} seeds/ante\n`,
);
console.log(`  anteBaseTargets ${BALANCE.anteBaseTargets.slice(0, 4).join('/')}...\n`);

for (const ante of ANTES) {
  let cleared = 0;
  let marginSum = 0;
  let scoreSum = 0;
  let target = 0;
  for (let i = 0; i < SEEDS; i++) {
    const { finalScore, target: t } = playAnte(ante, `length-mult-${ante}-${i}`);
    target = t;
    scoreSum += finalScore;
    if (finalScore >= t) cleared++;
    marginSum += (finalScore - t) / t;
  }
  const clearPct = ((cleared / SEEDS) * 100).toFixed(1);
  const avgMargin = ((marginSum / SEEDS) * 100).toFixed(1);
  const avgScore = Math.round(scoreSum / SEEDS);
  console.log(
    `  Ante ${ante} (target ${target}): clear ${clearPct}%  avg score ${avgScore}  avg margin ${avgMargin}%  (${cleared}/${SEEDS})`,
  );
}
```

- [ ] **Step 2: Register the script**

In `package.json` `scripts`, beside the other sims:

```json
    "sim:length-mult": "tsx src/sim/length-mult.ts",
```

(While here: `feel-chip-scale.ts`'s header claims `npm run sim:feel-chip-scale`, which does not exist. Add `"sim:feel-chip-scale": "tsx src/sim/feel-chip-scale.ts",` too — one stale reference, one line.)

- [ ] **Step 3: Measure the pre-tune state**

Run: `npm run sim:length-mult`

Record the output. Ante 1 will read far above the recorded ~77.5% baseline — that is the drift to remove.

- [ ] **Step 4: Propose and apply a new curve**

Starting proposal — scale the whole curve ×3, which also clears the YELLOW constraint (300 > 252):

```ts
  // placeholder curve, antes 1..8. Re-tuned 2026-07-30 for the word-length Mult
  // bonus (§3.1): a 3-6 letter word's effective mult rose ~3x, so the curve scaled
  // ×3 to hold the shape src/sim/feel-chip-scale.ts recorded (ante 1 ~77.5% clear,
  // antes 2-4 falling off sharply). Ante-1 small must also stay above a single
  // YELLOW (252) so the guided intro's first word does not clear the blind (§13).
  // Verified with src/sim/length-mult.ts.
  anteBaseTargets: [300, 900, 2400, 6000, 15000, 33000, 60000, 105000],
```

Re-run `npm run sim:length-mult` and adjust individual entries until ante 1 lands near 77–80% and antes 2–4 fall off. Prefer readable round numbers. Note that pattern, unison, letter-hand and material constants did **not** scale, so they are relatively weaker now — acceptable for this pass; record it in the GDD note below rather than fixing it here.

- [ ] **Step 5: Write the tutorial guard test**

Append to `tests/yellow-lesson.test.ts` (match its existing import style; add what is missing):

```ts
import { scoreWord } from '../src/engine/scoring';
import { makeLexicon } from '../src/engine/lexicon';
import { blindTarget } from '../src/engine/economy';

describe('the guided intro survives the target curve (GDD §13, 2026-07-30)', () => {
  it('a single YELLOW cannot clear the ante-1 small blind', () => {
    // The intro rigs the opening hand to Y-E-L-L-O-W and relies on that word
    // ENDING THE LESSON without clearing the blind. YELLOW = 36 chips, standard
    // ×1.0, length 6 => 36 × 7.0 = 252, so ante-1 small must stay above it.
    const lex = makeLexicon(['yellow'], {});
    let idc = 0;
    const tiles = [...'YELLOW'].map((ch) => ({
      id: `y${idc++}`,
      letter: ch as Letter,
      material: 'ceramic' as const,
      font: 'medium' as const,
    }));
    const score = scoreWord(tiles, lex).settledScore;
    expect(score).toBe(252);
    expect(score).toBeLessThan(blindTarget(1, 'small'));
  });
});
```

Import `Letter` from `../src/engine/types` if the file does not already.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run tests/yellow-lesson.test.ts`
Expected: PASS. If the second assertion fails, ante-1 small is still ≤ 252 — raise `anteBaseTargets[0]` and re-run the sim.

- [ ] **Step 7: Full suite**

Run: `npx tsc -b --noEmit && npm test`
Expected: PASS. Economy tests keyed to specific targets (`slice5-economy`, `slice5-progression`) will need recomputing against the new curve — same discipline as Task 6: compute `anteBaseTargets[ante-1] × blindTargetMult[kind]` by hand.

- [ ] **Step 8: Update the docs**

`docs/GDD.md` §8.2 — append to the first paragraph:

```
**Curve re-tuned 2026-07-30** for the word-length Mult bonus (§3.1): `anteBaseTargets` scaled to hold the shape `src/sim/feel-chip-scale.ts` recorded (ante 1 ~77.5% clear, antes 2–4 falling off sharply), verified with `src/sim/length-mult.ts`. Pattern, Unison, letter-hand and material constants were **not** scaled with it, so they are relatively weaker than before this pass — a known follow-up, not an oversight.
```

`docs/GDD.md` §13 — replace the stale second half of the "Discoverability (C-5)" paragraph. It currently says the target is lowered to 10 and that YELLOW clears the blind; both were retired 2026-07-22:

```
The first-run tutorial (2026-07-21) is a scripted, **hard-locked YELLOW lesson**: the opening hand is rigged to contain Y‑E‑L‑L‑O‑W. The target is **not** lowered — it stays the normal ante-1 value, so submitting YELLOW (252 under the §3.1 length bonus) ends the *lesson* but does **not** clear the blind; the board then unlocks and the player plays on to reach the target (the old `TUTORIAL_TARGET`=10 override was retired 2026-07-22). A WooDak coach-mark frames the grey world (so it never reads as a rendering bug), then the player builds and submits YELLOW — the yellow palette washes in ("Gold floods back in."), teaching word-building, submission, and the Palette by doing. `anteBaseTargets[0]` must stay above a single YELLOW score; `tests/yellow-lesson.test.ts` guards it. See `docs/superpowers/specs/2026-07-21-yellow-first-lesson-design.md`.
```

`CLAUDE.md` — in the guided-intro bullet, replace `submitting YELLOW (~12)` with `submitting YELLOW (252 — 36 chips × (1.0 + 6 length), §3.1)` and append to that bullet:

```
`anteBaseTargets[0]` must stay above a single YELLOW score or the lesson's first word clears the blind — `tests/yellow-lesson.test.ts` guards it, and any future target re-tune must keep it green.
```

- [ ] **Step 9: Commit**

```bash
git add src/sim/length-mult.ts package.json src/engine/balance.ts docs/GDD.md CLAUDE.md tests/
git commit -m "$(cat <<'EOF'
balance: re-tune anteBaseTargets for the word-length multiplier

The length Mult bonus raised a 3-6 letter word's effective multiplier
~3x, so the curve scaled to hold the shape feel-chip-scale.ts recorded.
Adds src/sim/length-mult.ts as the measurement behind the numbers.

Also guards the guided intro: a single YELLOW now scores 252, so ante-1
small must stay above it or the tutorial's first word clears the blind.
Fixes the stale "~12" in CLAUDE.md and the retired lowered-target claim
in GDD 13.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Full verification pass

**Files:** none modified unless a defect turns up.

- [ ] **Step 1: Clean typecheck and suite**

```bash
rm -rf dist
npx tsc -b --noEmit
npm test
```
Expected: both clean. `dist/` is removed first because `tsc -b` emits there and vitest globs it, producing phantom failures.

- [ ] **Step 2: Drive the real game**

Use the `verify` skill. Set `wj.tutorialIntro` before the checks that are not about the intro.

Check:

1. **Guided intro** (fresh profile, `wj.tutorialIntro` cleared): YELLOW ends the lesson, the yellow wash plays, and the blind does **not** clear — the board unlocks and play continues.
2. **Length stamp:** a 5-letter word stamps "5 LETTERS", the mult rises by 5 on that beat, the round number rolls once.
3. **Gibberish:** a nonsense submission shows no length stamp and no mult rise from length.
4. **Exhaustion:** with a nearly-dry pouch, discard the whole hand — the blind resolves (sentence bonus finalizes, then Fee Settlement or Game Over), it does not stall.
5. **Emoji art chroma:** greyscale with no unlocks; after RED, reds return and blues/greens stay grey; "reveal all presentation" gives full colour.
6. **Palette:** Collection → Palette shows three sections (색상 / 음향 / 캐릭터), no language section, 10 entries.

- [ ] **Step 3: Desktop offline gate**

Run: `node scripts/check-offline.mjs`
Expected: PASS. No CDN dependency or absolute Vite `base` was introduced — the inline `<svg>` filter is local markup, so this should be clean.

- [ ] **Step 4: Report**

Report each numbered check above as pass or fail with the evidence. Do not claim completion on any check that was not actually run.

---

## Self-Review

**Spec coverage:**
- ① Korean out of the palette → Task 1 (registry, three consumers, locales, GDD §13).
- ② Empty hand + empty pouch → Task 2 (predicate, both call sites, GDD §6.6, tests).
- ③ Length adds to Mult → Task 4 (engine + docs), Task 5 (settle beat), Task 6 (test churn), Task 7 (target re-tune + tutorial guard).
- ④ Emoji art chroma → Task 3 (matrix, wiring, CSS, tests).
- Spec's "out of scope" items are not implemented anywhere. Correct.

**Type consistency:**
- `wordLengthMult(letterCount: number, isGibberish: boolean): number` — same signature in Tasks 4 (definition, `scoreWord`, `loop.ts`) and 4 Step 8 (`hint.ts`). It takes a count, not tiles, because `hint.ts` has only word strings.
- `blindExhausted(blind: BlindState): boolean` — defined in Task 2 Step 3, consumed in Task 2 Steps 4–5 and Task 7 Step 1.
- `chromaMatrix(active: ReadonlySet<string>): string` — defined Task 3 Step 3, consumed Task 3 Step 5. `activeUnlocks` returns `Set<string>`, which satisfies `ReadonlySet<string>`.
- `ScoreEvent` variant `{ kind: 'wordLength'; letters: number; multDelta: number }` — added Task 4 Step 6, emitted Task 4 Step 7, consumed Task 5 Steps 3–4. `letters` (not `length`) throughout.
- `SettleView.stamp.kind` widened once, in Task 5 Step 4; the one consumer is updated in Step 5.

**Known ordering hazard:** Task 4 leaves the suite red on purpose (Task 6 fixes it) and may leave `settle.tsx` failing typecheck (Task 5 fixes it). Both are stated in-task. Do not run Tasks 4–7 out of order.
