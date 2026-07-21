# Feel & Polish Pass — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land 9 playtest-review polish/feel/balance items: bigger tile chips, a visible sentence-bonus trigger animation, +1 phase/+1 discard, tile draw/discard slide motion, ghost + alien mascots (MONSTER→ALIEN rename), locked-mascot codex silhouettes, an audio-discoverability hint, and scanline readability.

**Architecture:** Engine stays headless — only `balance.ts` numbers (items 1, 3) and one pure `endBlind` breakdown (item 2) change there. Everything else is UI: reuse the existing `SettleProvider`/`useCountUp` machinery for item 2, the existing `useFlip` plus new CSS/JS for item 4, and the data-driven `unlocks.ts`/`mascots.ts` registries for item 5. Docs (CLAUDE.md, GDD, specs) land in the same commits as the code they describe.

**Tech Stack:** TypeScript (strict), React, Vite, Vitest. Web Audio facade (`src/ui/audio.ts`). Plain CSS custom properties on game screens.

## Global Constraints

- **Engine headless:** nothing in `src/engine/` imports DOM/React/browser APIs. Mascot/unlock code stays in `src/ui/`.
- **No magic numbers in the engine:** every tunable lives in `src/engine/balance.ts`.
- **Data-driven unlocks & mascots:** never hard-code a word check in a component — add/edit a registry row (`src/ui/unlocks.ts`, `src/ui/mascots.ts`).
- **Profile flags off the engine:** `wj.unlocks`, `wj.collection`, `wj.settings` stay in localStorage, never in `RunState`.
- **Reduced motion honored:** every new animation collapses to instant under `prefers-reduced-motion` or the `.force-reduced-motion` body class.
- **Docs land with code (CLAUDE.md principle 6):** when a number/mechanic changes, fix every stale cross-reference in the same commit.
- **Settle-signal invariant (playtest-05 A):** blind resolution is gated on the settle-complete SIGNAL, never a fixed delay or the raw score. Item 2 extends the settle, so `settleDurationMs` / the finalize timing must cover the new beat.
- **Test command:** `npx vitest run` (single file: `npx vitest run tests/<file>`). Build/typecheck: `npm run build`. Lint: `npm run lint`.
- **Tile-chip scaling rule (item 1):** only `BALANCE.letterChips` scale ×3. Pattern/unison/letter-hand/material/font constants and suit multipliers do **not** scale. When a test asserts a mixed score, only the tile-chip portion is ×3.

---

### Task 1: +1 phase, +1 discard (item 3)

**Files:**
- Modify: `src/engine/balance.ts:15-16`
- Modify: `docs/GDD.md` (§6.2 phases, §6.3 discards + any "4 phases"/"3 discards" mentions)
- Test: `tests/slice3-loop.test.ts` (comment only), plus any test asserting the literal counts

**Interfaces:**
- Produces: `BALANCE.basePhases === 5`, `BALANCE.discardsPerBlind === 4` (consumed by `startBlind` in `src/engine/loop.ts` and the Sidebar phase/discard cells).

- [ ] **Step 1: Find tests asserting the old literals**

Run: `npx vitest run` and note any failures referencing phase/discard counts. Also grep the docs:
```bash
grep -rniE '4 phases|3 discards|phases.*4|discards.*3|basePhases|discardsPerBlind' docs/GDD.md
```
Expected: a list of GDD lines and possibly a test comment (`slice3-loop.test.ts:88` says `4 - 3 = 1`).

- [ ] **Step 2: Bump the two numbers**

In `src/engine/balance.ts`:
```ts
  handSize: 11,
  basePhases: 5,
  discardsPerBlind: 4, // per-blind count; no per-use tile cap (playtest-04 D-4)
```

- [ ] **Step 3: Run the full suite**

Run: `npx vitest run`
Expected: PASS. `slice3-loop.test.ts` still passes (its `phasesLeft` assertion is computed as `b.phasesTotal - b.phasesUsed`, not a literal). If any test hard-codes `phasesTotal === 4` / `discardsLeft === 3`, update it to `5` / `4`.

- [ ] **Step 4: Fix the stale comment and docs**

In `tests/slice3-loop.test.ts:88` change the inline comment `// 4 - 3 = 1` to `// 5 - 3 = 2`. In `docs/GDD.md` update §6.2 to 5 phases and §6.3 to 4 discards, and every cross-reference the grep in Step 1 found. Re-grep to confirm no "4 phases"/"3 discards" remain.

- [ ] **Step 5: Run suite again + commit**

Run: `npx vitest run`
Expected: PASS.
```bash
git add src/engine/balance.ts docs/GDD.md tests/slice3-loop.test.ts
git commit -m "feat: +1 phase and +1 discard per blind (feel pass item 3)"
```

---

### Task 2: Tile base chips ×3 (item 1)

**Files:**
- Modify: `src/engine/balance.ts:19-22` (`letterChips`)
- Create: `src/sim/feel-chip-scale.ts` (a headless clear-rate scenario)
- Modify: every test asserting a tile-chip-derived score (see Step 3 list)
- Modify: `docs/GDD.md` §2.1 (note the scaling)

**Interfaces:**
- Produces: `BALANCE.letterChips` = Scrabble values × 3 (A=3, E=3, D=6, Q=30, Z=30, …). Ratios preserved.

- [ ] **Step 1: Scale the table**

In `src/engine/balance.ts`, replace `letterChips` with the ×3 values and add a note:
```ts
  // ----- Letter values (GDD §2.1) — Scrabble ratios × 3 (feel pass 2026-07-21):
  //       raise the base floor so tiles feel impactful; ratios (rare-letter payoff)
  //       are preserved. Only these scale — pattern/unison/hand/material constants
  //       do not. Sim: src/sim/feel-chip-scale.ts verifies antes don't trivialize. -----
  letterChips: {
    A: 3, B: 9, C: 9, D: 6, E: 3, F: 12, G: 6, H: 12, I: 3, J: 24, K: 15, L: 3, M: 9,
    N: 3, O: 3, P: 9, Q: 30, R: 3, S: 3, T: 3, U: 3, V: 12, W: 12, X: 24, Y: 12, Z: 30,
  } as Record<string, number>,
```

- [ ] **Step 2: Run the full suite to surface every affected assertion**

Run: `npx vitest run`
Expected: FAIL in the score-asserting tests: `slice1-scoring`, `slice1-loop`, `slice2-suits`, `slice2-projection`, `slice3-loop`, `slice3-scoring`, `slice3-patterns`, `slice4-pipeline`, `slice4-jokers`, `slice5-materials`, `a2-letter-hands`, `p1-scoreevents`, `fonts`, and possibly `playtest05-settle-gate`. This is the expected ripple.

- [ ] **Step 3: Recompute each failing assertion**

For every failing expectation, apply the scaling rule: **only the tile-letter-chip portion ×3; all bonus constants unchanged.** Worked examples for `tests/slice3-loop.test.ts` (do the equivalent everywhere):
```ts
// RUN = R+U+N = 3+3+3 = 9 (was 3)
expect(submission.settledScore).toBe(9);
expect(after.committedScore).toBe(9);
expect(after.projectedScore).toBe(9);

// EATS(12) FISH(30): committed 42; Imperative (15 + 50 unison) × 2 = 130 → projected 172
expect(b.committedScore).toBe(42);
expect(b.projectedScore).toBe(172);

// CAT(15) EATS(12) FISH(30): committed 57; Transitive (40 + 50 unison) × 3 = 270 → projected 327
expect(b.committedScore).toBe(57);
expect(b.projectedScore).toBe(327);

// endBlind: finalScore 327; phasesLeft computed, not literal
expect(result.finalScore).toBe(327);
```
Update the inline `//` comments to the new arithmetic too. For material/font/joker tests, scale only the base tile chips; e.g. a Stone tile (chips: 50) is NOT a letter chip and does not scale, but the letters around it do.

- [ ] **Step 4: Run the suite until green**

Run: `npx vitest run`
Expected: PASS. Iterate Step 3 for any remaining failures (the runner prints expected-vs-actual, so the new value is the "actual").

- [ ] **Step 5: Add the sim scenario**

Create `src/sim/feel-chip-scale.ts` mirroring an existing `src/sim/*.ts` file's structure (autoplay N seeded runs, report clear rate / average margin over the ante curve). Keep it small: play greedy best-word each phase across antes 1–4 for ~200 seeds, print clear% per ante.

- [ ] **Step 6: Run the sim and record the outcome**

Run: `npx tsx src/sim/feel-chip-scale.ts` (or the repo's sim runner if different — check `package.json` scripts).
Expected: a clear-rate print. **Decision:** if early antes now clear far more easily than intended (e.g. antes 1–2 near 100% with phases to spare), scale `BALANCE.anteBaseTargets` up (roughly ×3 on the early entries) to restore the curve, then re-run Steps 2–4. If clear rates look reasonable, leave targets. Record the choice in a one-line comment next to `anteBaseTargets`.

- [ ] **Step 7: Doc note + commit**

In `docs/GDD.md` §2.1 add a note that letter chips are Scrabble × 3 (feel pass 2026-07-21) and, if targets were rescaled, note that too near §8.2.
```bash
git add src/engine/balance.ts src/sim/feel-chip-scale.ts tests/ docs/GDD.md
git commit -m "feat: scale tile base chips x3, keeping ratios (feel pass item 1)"
```

---

### Task 3: Engine — expose the sentence-bonus breakdown (item 2, engine half)

**Files:**
- Modify: `src/engine/loop.ts:336-356` (`scoreSentence`), `:438-463` (`EndBlindResult` + `endBlind`)
- Test: `tests/slice3-loop.test.ts` (extend the endBlind finalization test)

**Interfaces:**
- Produces:
  - `scoreSentence(...)` returns `{ total: number; sentenceChips: number; sentenceMult: number }` (post joker/boss `sentenceScoring` hooks — the authoritative bonus, which the UI cannot recompute).
  - `EndBlindResult` gains `sentenceChips: number`, `sentenceMult: number`, `bonus: number` (`= sentenceChips × sentenceMult`).
- Consumes (Task 4): `endBlind(...).sentenceChips / .sentenceMult / .bonus`.

- [ ] **Step 1: Write the failing test**

Add to `tests/slice3-loop.test.ts` inside the endBlind describe block:
```ts
it('endBlind surfaces the sentence-bonus chips/mult breakdown', () => {
  const { run } = freshBlind();
  let b = startBlind(run, makeRng('s3'), { target: 1000 });
  ({ blind: b } = play(b, run, 'cat'));
  ({ blind: b } = play(b, run, 'eats'));
  ({ blind: b } = play(b, run, 'fish'));
  const result = endBlind(b, run, lex);
  // Transitive pattern chips 40 + Unison standard 50 = 90; Transitive mult 3.
  expect(result.sentenceChips).toBe(90);
  expect(result.sentenceMult).toBe(3);
  expect(result.bonus).toBe(270);
  expect(result.finalScore).toBe(result.committedBeforeBonus + result.bonus);
});
```
Note: `committedBeforeBonus` is not yet on the result — either add it too, or replace that last line with the literal committed total for the current chip scale (57 after Task 2 → `expect(result.finalScore).toBe(327)`), and drop the `committedBeforeBonus` reference. Prefer the literal to avoid adding an unused field.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/slice3-loop.test.ts`
Expected: FAIL — `result.sentenceChips` is undefined.

- [ ] **Step 3: Refactor `scoreSentence` to return the breakdown**

In `src/engine/loop.ts`, change `scoreSentence` (keep the hook order identical):
```ts
/** Layer 3: fold the pattern/unison bonus → jokers mutate (sentenceScoring) → total.
 *  Returns the post-hook breakdown so the UI can animate chips × mult (item 2). */
function scoreSentence(
  committed: number,
  sequence: readonly WordSubmission[],
  judgment: SentenceJudgment,
  run: RunState,
  blind: BlindState,
): { total: number; sentenceChips: number; sentenceMult: number } {
  const base = finalizeScore(committed, judgment, run.patternLevels);
  const ctx: SentenceScoringContext = {
    sequence: sequence.slice(),
    match: judgment.match,
    unison: judgment.unison,
    totalBefore: committed,
    sentenceChips: base.sentenceChips,
    sentenceMult: base.sentenceMult,
  };
  defaultJokerBus.emit('sentenceScoring', { run, blind, ctx }, run.jokers);
  if (blind.bossId) BOSS_REGISTRY.get(blind.bossId)?.sentenceScoring?.(ctx);
  return {
    total: ctx.totalBefore + ctx.sentenceChips * ctx.sentenceMult,
    sentenceChips: ctx.sentenceChips,
    sentenceMult: ctx.sentenceMult,
  };
}
```

- [ ] **Step 4: Update `scoreSentence`'s other caller**

In `submitWord` (`src/engine/loop.ts:433`) the projection only needs the total:
```ts
  const projectedScore = scoreSentence(committedScore, sequence, judgment, run, afterBlind).total;
```

- [ ] **Step 5: Surface the breakdown on `EndBlindResult`**

Extend the interface and `endBlind`:
```ts
export interface EndBlindResult {
  judgment: SentenceJudgment;
  finalScore: number;
  /** the sentence bonus' Chips side, post joker/boss hooks (item 2 animation) */
  sentenceChips: number;
  /** the sentence bonus' Mult side, post joker/boss hooks (item 2 animation) */
  sentenceMult: number;
  /** the bonus itself: sentenceChips × sentenceMult */
  bonus: number;
  phasesLeft: number;
  materialGold: number;
}

export function endBlind(blind: BlindState, run: RunState, lexicon: Lexicon): EndBlindResult {
  const judgment = judgeSentence(blind.sequence, lexicon);
  const scored = scoreSentence(blind.committedScore, blind.sequence, judgment, run, blind);
  return {
    judgment,
    finalScore: scored.total,
    sentenceChips: scored.sentenceChips,
    sentenceMult: scored.sentenceMult,
    bonus: scored.sentenceChips * scored.sentenceMult,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    materialGold: collectBlindEndMaterials(blind.hand),
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/slice3-loop.test.ts`
Expected: PASS. Then `npx vitest run` to confirm no other caller of `endBlind`/`scoreSentence` broke (`useGame` uses `endBlind(...).finalScore` and `.materialGold`, still present).

- [ ] **Step 7: Commit**
```bash
git add src/engine/loop.ts tests/slice3-loop.test.ts
git commit -m "feat: expose sentence-bonus chips/mult breakdown from endBlind (item 2 engine)"
```

---

### Task 4: UI — sentence-bonus trigger animation (item 2, UI half)

**Files:**
- Modify: `src/ui/useGame.ts` (`GameState`, Stage-1 effect, per-blind resets, `playWord`)
- Modify: `src/ui/components/Sidebar.tsx` (scorebox fill during the bonus beat)

**Interfaces:**
- Consumes: `endBlind(...).sentenceChips / .sentenceMult` (Task 3).
- Produces: `GameState.sentenceBonus: { chips: number; mult: number; pattern: PatternId | null } | null` — non-null exactly while the bonus lands (alongside `finalScore`); null everywhere else.

- [ ] **Step 1: Add the state field**

In `src/ui/useGame.ts` `GameState`, after `finalScore`:
```ts
  /** The finalized sentence-bonus breakdown, non-null only while it lands on the
   *  round number (item 2). Drives the scorebox fill (chips → mult) in the Sidebar;
   *  null at every other time (mirrors `finalScore`). */
  sentenceBonus: { chips: number; mult: number; pattern: PatternId | null } | null;
```
Set it to `null` in `bootstrap`'s returned object (next to `finalScore: null`).

- [ ] **Step 2: Populate it when the bonus lands (Stage 1)**

In the Stage-1 effect (`useGame.ts:683-689`), read the breakdown and set both fields together:
```ts
  useEffect(() => {
    if (!state.pendingEnd || !state.settleComplete || state.finalScore !== null) return;
    const end = endBlind(state.blind, state.run, lexicon);
    setState((prev) =>
      prev.pendingEnd && prev.finalScore === null
        ? {
            ...prev,
            finalScore: end.finalScore,
            sentenceBonus:
              end.bonus > 0
                ? { chips: end.sentenceChips, mult: end.sentenceMult, pattern: end.judgment.match?.pattern ?? null }
                : null,
          }
        : prev,
    );
  }, [state.pendingEnd, state.settleComplete, state.finalScore, state.blind, state.run, lexicon]);
```

- [ ] **Step 3: Reset it everywhere `finalScore` resets**

Add `sentenceBonus: null` next to every `finalScore: null` in `useGame.ts`: in `playWord`'s `next` object, in `leaveShop`, and (already) `bootstrap`. Grep to be sure:
```bash
grep -n 'finalScore: null' src/ui/useGame.ts
```
Each hit gets a sibling `sentenceBonus: null`.

- [ ] **Step 4: Typecheck (import PatternId)**

Ensure `PatternId` is imported in `useGame.ts` (it already imports from `../engine/types` — add `PatternId` to that import list if missing).
Run: `npm run build`
Expected: no type errors from `useGame.ts`.

- [ ] **Step 5: Animate the scorebox in the Sidebar**

In `src/ui/components/Sidebar.tsx`, accept the new prop and drive the box. Add to `Props`:
```ts
  /** finalized sentence-bonus breakdown while it lands (item 2), else null */
  sentenceBonus: { chips: number; mult: number; pattern: string | null } | null;
```
Replace the idle chips/mult derivation (around `:85-87`) with a bonus-aware version. Hooks stay unconditional:
```ts
  // Sentence-bonus beat (item 2): when the bonus lands, the scorebox fills to the
  // bonus' chips × mult over the same BONUS_LAND_MS the round number rolls over, so
  // the player sees the round box's chips and mult climb by the bonus.
  const bonusActive = sentenceBonus !== null;
  const bonusChips = useCountUp(bonusActive ? sentenceBonus!.chips : 0, BONUS_LAND_MS);
  const bonusMult = useCountUp(bonusActive ? sentenceBonus!.mult : 0, BONUS_LAND_MS);
  const chips = bonusActive ? bonusChips : settle.active ? settle.chips : 0;
  const mult = bonusActive ? bonusMult : settle.active ? settle.mult : 0;
```
Add the `settling` class while the bonus is active too, and render a pattern stamp when present. Update the scorebox wrapper:
```tsx
        <div className={['scorebox', (settle.active || bonusActive) && 'settling'].filter(Boolean).join(' ')}>
```
Inside the box, after the `.box.m` span, add the bonus stamp:
```tsx
          {bonusActive && sentenceBonus!.pattern && (
            <span className="bonus-stamp">{t(`pattern.${sentenceBonus!.pattern}`)}</span>
          )}
```

- [ ] **Step 6: Pass the prop from the parent**

Find where `<Sidebar` is rendered (RunView):
```bash
grep -n '<Sidebar' src/ui/components/RunView.tsx
```
Add `sentenceBonus={g.state.sentenceBonus}` alongside the existing `finalScore={...}` prop.

- [ ] **Step 7: Add a minimal stamp style**

In `src/ui/styles/play.css`, near the existing `.scorebox` / `.box-pop` rules, add a `.bonus-stamp` (small pill over the box, pattern colour). Mirror the look of `.word-stamp`. Example:
```css
.bonus-stamp {
  position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
  font-size: 10px; letter-spacing: .04em; padding: 1px 5px;
  background: var(--accent-yellow, #d8c24a); color: #1a1a1a; border-radius: 0;
  animation: box-pop-rise .5s ease-out;
}
```
(Reuse an existing rise keyframe if `box-pop-rise` isn't defined — check `.box-pop`'s animation name and reuse it.)

- [ ] **Step 8: Build + verify in the running game**

Run: `npm run build`
Expected: clean.
Then invoke the **`verify`** skill and drive a blind to a clear: confirm at blind end the scorebox fills chips → mult, the pattern stamp shows, and the round number rolls up by the bonus **after** the last word's settle (the clear/Fee-Settlement screen must still wait for the settle-complete signal — playtest-05 A). Confirm reduced-motion (Settings → Game → Reduced motion) collapses it to instant.

- [ ] **Step 9: Commit**
```bash
git add src/ui/useGame.ts src/ui/components/Sidebar.tsx src/ui/components/RunView.tsx src/ui/styles/play.css
git commit -m "feat: animate sentence bonus filling the scorebox at blind end (item 2 UI)"
```

---

### Task 5: Tile draw-in animation (item 4, draw half)

**Files:**
- Modify: `src/ui/styles/play.css` (hand-tile mount keyframe)

**Interfaces:** none (pure CSS; relies on React keying hand tiles by `tile.id`, so only genuinely new DOM nodes animate — reorders reuse nodes via `useFlip`).

- [ ] **Step 1: Add the draw-in keyframe + apply to hand tiles**

In `src/ui/styles/play.css`, add:
```css
@keyframes tile-draw-in {
  from { opacity: 0; transform: translateY(-16px) scale(.92); }
  to   { opacity: 1; transform: none; }
}
/* Newly drawn tiles slide/fade into the hand. Keyed by tile.id, so this runs only
   on a fresh DOM node (draw / blind start), never on a FLIP reorder. */
.hand .tile { animation: tile-draw-in .26s cubic-bezier(.2,.7,.3,1) both; }
```
If `.hand .tile` already has an `animation`, append this as a second animation or a wrapping selector so it doesn't clobber the existing one — check first:
```bash
grep -n '\.hand .tile' src/ui/styles/play.css
```

- [ ] **Step 2: Guard reduced motion**

Add near the other reduced-motion overrides in `play.css` (and `tokens.css` uses `.force-reduced-motion`):
```css
@media (prefers-reduced-motion: reduce) { .hand .tile { animation: none; } }
.force-reduced-motion .hand .tile { animation: none; }
```

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: clean.
Invoke the **`verify`** skill: start a blind and confirm the opening hand tiles slide in, and after a play the replacement draws slide in (the kept tiles glide via the existing FLIP). Toggle reduced motion and confirm they appear instantly.

- [ ] **Step 4: Commit**
```bash
git add src/ui/styles/play.css
git commit -m "feat: draw-in slide animation for hand tiles (item 4 draw)"
```

---

### Task 6: Tile discard fly-out animation (item 4, discard half)

**Files:**
- Modify: `src/ui/components/StagePanel.tsx` (`doDiscard` → capture rects, render flying ghosts)
- Modify: `src/ui/styles/play.css` (`.discard-ghost` fly keyframe)

**Interfaces:**
- Consumes: `g.discard(ids)` (unchanged), `audio.play('discardSwoosh')` (existing).

- [ ] **Step 1: Add local flying-ghost state + capture rects on discard**

In `StagePanel`, add state and a ref to the hand container (a `handRef` already exists). Replace `doDiscard`:
```tsx
  const [flying, setFlying] = useState<{ tile: Tile; x: number; y: number; w: number; h: number }[]>([]);
  const doDiscard = () => {
    audio.play('discardSwoosh');
    const reduce =
      typeof window !== 'undefined' &&
      (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        document.body.classList.contains('force-reduced-motion'));
    if (!reduce) {
      const stageRect = handRef.current?.closest('.stage')?.getBoundingClientRect();
      const ghosts = validMarks
        .map((id) => {
          const el = handRef.current?.querySelector<HTMLElement>(`[data-tile-id="${id}"]`);
          const tile = blind.hand.find((tl) => tl.id === id);
          if (!el || !tile || !stageRect) return null;
          const r = el.getBoundingClientRect();
          return { tile, x: r.left - stageRect.left, y: r.top - stageRect.top, w: r.width, h: r.height };
        })
        .filter(Boolean) as { tile: Tile; x: number; y: number; w: number; h: number }[];
      setFlying(ghosts);
      setTimeout(() => setFlying([]), 340);
    }
    g.discard(validMarks);
    setDiscardMarks([]);
  };
```

- [ ] **Step 2: Render the ghost layer**

Inside the top-level `<div className="stage" …>` (so ghosts are positioned relative to `.stage`, which must be `position: relative` — add it in Step 3 if not), render before the closing tag:
```tsx
      {flying.length > 0 && (
        <div className="discard-ghosts" aria-hidden>
          {flying.map((f, i) => (
            <span
              key={`${f.tile.id}-${i}`}
              className="discard-ghost"
              style={{ left: f.x, top: f.y, width: f.w, height: f.h }}
            >
              <TileView tile={f.tile} />
            </span>
          ))}
        </div>
      )}
```

- [ ] **Step 3: Style the fly-out**

In `src/ui/styles/play.css`:
```css
.stage { position: relative; }
.discard-ghosts { position: absolute; inset: 0; pointer-events: none; z-index: 5; }
.discard-ghost { position: absolute; animation: discard-fly .32s ease-in forwards; }
@keyframes discard-fly {
  to { transform: translate(24px, 120px) scale(.7) rotate(8deg); opacity: 0; }
}
```
(If `.stage` already has a `position`, leave it; just confirm it's not `static`.)

- [ ] **Step 4: Typecheck imports**

Ensure `Tile` is imported in `StagePanel.tsx` (it already imports `type Tile` from `../../engine/types`) and `useState` is imported (it is). Run: `npm run build`
Expected: clean.

- [ ] **Step 5: Verify**

Invoke the **`verify`** skill: mark 2–3 hand tiles, discard, and confirm they fly down/out and fade while the remaining hand glides to close the gap and replacements slide in (Task 5). Toggle reduced motion → tiles just disappear (no ghosts), replacements still appear.

- [ ] **Step 6: Commit**
```bash
git add src/ui/components/StagePanel.tsx src/ui/styles/play.css
git commit -m "feat: discard fly-out animation for marked hand tiles (item 4 discard)"
```

---

### Task 7: Ghost + Alien mascots, MONSTER→ALIEN rename (item 5)

**Files:**
- Create: `src/ui/assets/ghost.png`, `src/ui/assets/alien.png` (copied from `docs/Arts/`)
- Modify: `src/ui/unlocks.ts:21` (variant union), `:39` (the row)
- Modify: `src/ui/mascots.ts:18` (skin union), imports, `:33-37` (registry)
- Modify: `locales/en.json`, `locales/ko.json` (`mascot.monster` → `mascot.alien`)
- Modify: `tests/mascot-skins.test.ts`, `tests/chromatic-unlocks.test.ts`
- Modify: `CLAUDE.md`, `docs/GDD.md:735`, `docs/feature-02-packs-patterns-chromatic.md:78`, `docs/superpowers/specs/2026-07-21-mascot-selector-design.md`

**Interfaces:**
- Produces: unlock id/word `ALIEN` (variant `alien`), `WooDakSkin` union includes `'alien'` (not `'monster'`); `WOODAK_SKINS` ghost + alien rows have art.

- [ ] **Step 1: Copy the art**
```bash
cp docs/Arts/T_Ghost.png src/ui/assets/ghost.png
cp docs/Arts/T_Alien.png src/ui/assets/alien.png
```
Expected: two new files under `src/ui/assets/`.

- [ ] **Step 2: Write/adjust the failing tests first**

In `tests/mascot-skins.test.ts`: replace `'monster'`/`'MONSTER'` with `'alien'`/`'ALIEN'`, and flip the art expectations — ghost and alien now HAVE art (so they're selectable when unlocked); only cat stays art-less:
```ts
// unlocked + art: dog, ghost, alien all selectable; cat art-less → excluded.
const skins = availableWooDakSkins(new Set(['DOG', 'ALIEN', 'GHOST', 'CAT']));
// (assert dog, ghost, alien present; cat absent — mirror the file's existing assertion style)
...
expect(woodakArt('alien', new Set(['ALIEN']))).toBe(alienUrl); // was woodakUrl fallback
...
expect(mascotVariantArt('cat')).toBeNull(); // cat still has no art
expect(mascotVariantArt('alien')).not.toBeNull();
```
Import `alienUrl` in the test the same way it imports `woodakUrl`. In `tests/chromatic-unlocks.test.ts:30` change `'MONSTER'` to `'ALIEN'` in the word list.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/mascot-skins.test.ts tests/chromatic-unlocks.test.ts`
Expected: FAIL (union still `'monster'`, ghost/alien art still null).

- [ ] **Step 4: Rename in `unlocks.ts`**

`src/ui/unlocks.ts` line 21:
```ts
  | { kind: 'mascot'; variant: 'alien' | 'ghost' | 'dog' | 'cat' };
```
Line 39:
```ts
  { id: 'ALIEN', word: 'ALIEN', effect: { kind: 'mascot', variant: 'alien' } },
```

- [ ] **Step 5: Rename + wire art in `mascots.ts`**

`src/ui/mascots.ts`: add imports next to `dogUrl`:
```ts
import ghostUrl from './assets/ghost.png';
import alienUrl from './assets/alien.png';
```
Union (line 18):
```ts
export type WooDakSkin = 'woodak' | 'alien' | 'ghost' | 'dog' | 'cat';
```
Registry (lines 33-37):
```ts
  { id: 'woodak', unlockId: null, nameKey: 'mascot.woodak', art: woodakUrl },
  { id: 'dog', unlockId: 'DOG', nameKey: 'mascot.dog', art: dogUrl },
  { id: 'ghost', unlockId: 'GHOST', nameKey: 'mascot.ghost', art: ghostUrl },
  { id: 'alien', unlockId: 'ALIEN', nameKey: 'mascot.alien', art: alienUrl },
  { id: 'cat', unlockId: 'CAT', nameKey: 'mascot.cat', art: null },
```
Update the doc comment at the top (mentions MONSTER/GHOST/DOG/CAT and "DOG is the first with art") to reflect ALIEN + that dog/ghost/alien now have art.

- [ ] **Step 6: i18n rename**

In `locales/en.json:349` and `locales/ko.json:349` replace the `mascot.monster` key with `mascot.alien`:
```json
  "mascot.alien": "Alien",
```
```json
  "mascot.alien": "외계인",
```
(Keep `mascot.ghost`, which already exists in both.)

- [ ] **Step 7: Run tests + full suite**

Run: `npx vitest run`
Expected: PASS. Fix any remaining `monster` references the compiler/tests flag.

- [ ] **Step 8: Update the docs (same commit)**

- `CLAUDE.md`: in the chromatic-unlock and mascot-skin guardrail bullets, change `MONSTER/GHOST/DOG/CAT` → `ALIEN/GHOST/DOG/CAT`, and update "DOG (누렁이) is the first with art; monster/ghost/cat stay `art: null`" → "DOG/GHOST/ALIEN have art; CAT stays `art: null`".
- `docs/GDD.md:735`: same list + "DOG shipped; MONSTER/GHOST/CAT art-less" → "DOG/GHOST/ALIEN shipped (`dog.png`/`ghost.png`/`alien.png`); CAT art-less".
- `docs/feature-02-packs-patterns-chromatic.md:78` and `docs/superpowers/specs/2026-07-21-mascot-selector-design.md`: MONSTER → ALIEN, update the "누렁이(Dog) only" art note to include ghost + alien.

- [ ] **Step 9: Build + commit**

Run: `npm run build`
Expected: clean (no lingering `'monster'`).
```bash
git add src/ui/assets/ghost.png src/ui/assets/alien.png src/ui/unlocks.ts src/ui/mascots.ts locales/ tests/mascot-skins.test.ts tests/chromatic-unlocks.test.ts CLAUDE.md docs/
git commit -m "feat: add ghost + alien mascots, rename MONSTER->ALIEN (item 5)"
```

---

### Task 8: Mascots collection category with locked silhouettes (item 5.1)

**Files:**
- Modify: `src/ui/mascots.ts` (export a collection-rows helper)
- Modify: `src/ui/components/Collection.tsx` (new `mascots` category + view)
- Modify: `src/ui/styles/screens.css` (silhouette style)
- Modify: `locales/en.json`, `locales/ko.json` (`collection.cat.mascots`)
- Test: `tests/mascot-skins.test.ts` (helper unit test)

**Interfaces:**
- Consumes: `WOODAK_SKINS`, `activeUnlocks` (unlocks.ts), `loadPlayed`.
- Produces: `mascotCollectionRows(active: Set<string>): { id: WooDakSkin; nameKey: string; art: string | null; unlocked: boolean }[]` — one row per skin; `unlocked` true for the default and any skin whose `unlockId` is in `active`.

- [ ] **Step 1: Write the failing helper test**

Add to `tests/mascot-skins.test.ts`:
```ts
it('mascotCollectionRows marks unlocked skins and lists all', () => {
  const rows = mascotCollectionRows(new Set(['ALIEN']));
  expect(rows).toHaveLength(WOODAK_SKINS.length);
  expect(rows.find((r) => r.id === 'woodak')!.unlocked).toBe(true); // default always
  expect(rows.find((r) => r.id === 'alien')!.unlocked).toBe(true);
  expect(rows.find((r) => r.id === 'ghost')!.unlocked).toBe(false);
});
```
Import `mascotCollectionRows` and `WOODAK_SKINS`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/mascot-skins.test.ts`
Expected: FAIL — `mascotCollectionRows` is not exported.

- [ ] **Step 3: Add the helper to `mascots.ts`**
```ts
/** Rows for the 도감 Mascots category: every skin, flagged unlocked (default is
 *  always unlocked). Locked-but-art-backed rows render as silhouettes in the UI. */
export function mascotCollectionRows(
  active: Set<string>,
): { id: WooDakSkin; nameKey: string; art: string | null; unlocked: boolean }[] {
  return WOODAK_SKINS.map((s) => ({
    id: s.id,
    nameKey: s.nameKey,
    art: s.art,
    unlocked: s.unlockId === null || active.has(s.unlockId),
  }));
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/mascot-skins.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the category to `Collection.tsx`**

Add `'mascots'` to the `Category` union (top of file), the `CATS` array, and the `counts` map:
```ts
      mascots: { have: mascotCollectionRows(activeUnlocks(false)).filter((r) => r.unlocked && r.art).length,
                 total: mascotCollectionRows(activeUnlocks(false)).length },
```
Add the render branch in the detail switch:
```tsx
        {cat === 'mascots' && <MascotsView />}
```
Import `mascotCollectionRows` from `../mascots` and `activeUnlocks` from `../unlocks` (already imported: `loadPlayed`, `playedCount`, `UNLOCKS` — add `activeUnlocks`).

- [ ] **Step 6: Implement `MascotsView`**

Add near `PaletteView`:
```tsx
// ---------- Mascots (item 5.1) ----------
function MascotsView() {
  const { t } = useI18n();
  // Display only — the unlockAll override reveals but never "discovers" (matches Palette).
  const rows = mascotCollectionRows(activeUnlocks(false));
  return (
    <div className="card-grid">
      {rows.map((r) => {
        const reveal = r.unlocked && !!r.art; // full portrait
        const silhouette = !r.unlocked && !!r.art; // teased shape
        return (
          <div key={r.id} className={['coll-card', 'mascot-card', r.unlocked ? '' : 'locked'].filter(Boolean).join(' ')}>
            {r.art ? (
              <img
                className={['mascot-card-art', silhouette ? 'silhouette' : ''].filter(Boolean).join(' ')}
                src={r.art}
                alt=""
              />
            ) : (
              <span className="cc-emoji">❔</span>
            )}
            <span className="cc-name">{reveal ? t(r.nameKey) : '???'}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 7: Silhouette + art styling**

In `src/ui/styles/screens.css` add:
```css
.mascot-card-art { width: 64px; height: 64px; object-fit: contain; image-rendering: pixelated; }
.mascot-card-art.silhouette { filter: brightness(0); opacity: .7; }
```

- [ ] **Step 8: i18n label**

Add to both locales near the other `collection.cat.*` keys:
```json
  "collection.cat.mascots": "Mascots",
```
```json
  "collection.cat.mascots": "마스코트",
```

- [ ] **Step 9: Build + verify**

Run: `npm run build` and `npx vitest run tests/mascot-skins.test.ts`
Expected: clean / PASS.
Invoke the **`verify`** skill: open Options → Collection → Mascots. Confirm WooDak shows full; locked-but-art skins (ghost/alien/dog unless unlocked) show as black silhouettes with "???"; cat shows the ❔ placeholder. Unlock one (or enable "Reveal all") and confirm it reveals.

- [ ] **Step 10: Commit**
```bash
git add src/ui/mascots.ts src/ui/components/Collection.tsx src/ui/styles/screens.css locales/ tests/mascot-skins.test.ts
git commit -m "feat: Mascots collection category with locked silhouettes (item 5.1)"
```

---

### Task 9: Audio discoverability hint (feedback F1)

**Files:**
- Modify: `src/ui/components/Options.tsx` (audio tab)
- Modify: `locales/en.json`, `locales/ko.json`

**Interfaces:**
- Consumes: `audio.isBusEnabled('sfx' | 'music')` (existing).

- [ ] **Step 1: Add the i18n hint**

Both locales, near `settings.audioNote`:
```json
  "settings.audioLockedHint": "Audio starts off. Spell SOUND to unlock sound effects and MUSIC to unlock the soundtrack in a run.",
```
```json
  "settings.audioLockedHint": "소리는 꺼진 채로 시작합니다. 게임에서 SOUND를 완성하면 효과음이, MUSIC을 완성하면 배경음악이 켜집니다.",
```

- [ ] **Step 2: Show it when a bus is locked**

In `SettingsView`'s audio panel (`Options.tsx:253-258`), import `audio`:
```ts
import { audio } from '../audio';
```
Render the hint above the sliders when either bus is off:
```tsx
        <div className={['set-tabpanel', tab === 'audio' ? 'on' : ''].filter(Boolean).join(' ')}>
            <p className="set-note">{t('settings.audioNote')}</p>
            {(!audio.isBusEnabled('sfx') || !audio.isBusEnabled('music')) && (
              <p className="set-note locked-hint">🔇 {t('settings.audioLockedHint')}</p>
            )}
            <Slider label={t('settings.master')} value={settings.master} min={0} max={100} onChange={(v) => set('master', v)} />
            <Slider label={t('settings.music')} value={settings.music} min={0} max={100} onChange={(v) => set('music', v)} />
            <Slider label={t('settings.sfx')} value={settings.sfx} min={0} max={100} onChange={(v) => set('sfx', v)} />
        </div>
```

- [ ] **Step 3: (Optional) style the hint**

If `.set-note` needs emphasis for `.locked-hint`, add in `screens.css`:
```css
.set-note.locked-hint { color: var(--accent-yellow, #d8c24a); }
```

- [ ] **Step 4: Build + verify**

Run: `npm run build`
Expected: clean.
Invoke the **`verify`** skill: fresh profile → Options → Settings → Audio shows the hint. Enable "Reveal all" (or play SOUND+MUSIC) → the hint disappears.

- [ ] **Step 5: Commit**
```bash
git add src/ui/components/Options.tsx src/ui/styles/screens.css locales/
git commit -m "feat: audio-unlock discoverability hint in Settings (feedback F1)"
```

---

### Task 10: Scanline readability (feedback F2)

**Files:**
- Modify: `src/ui/styles/tokens.css:218` (`.crt-scan` background)
- Modify: `docs/mockups/play-screen.html:52` (mirror)

**Interfaces:** none.

- [ ] **Step 1: Lighten and thin the scanline**

In `src/ui/styles/tokens.css` `.crt-scan`:
```css
.crt-scan {
  z-index: 9997;
  background: repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.12) 0 1px, rgba(0, 0, 0, 0) 1px 4px);
  mix-blend-mode: multiply;
  animation: crt-flicker 5.2s steps(30) infinite;
}
```

- [ ] **Step 2: Mirror in the mockup (doc consistency)**

In `docs/mockups/play-screen.html:52` change the `.crt-scan` background to the same `rgba(0,0,0,.12) 0 1px, rgba(0,0,0,0) 1px 4px`.

- [ ] **Step 3: Build + verify**

Run: `npm run build`
Expected: clean.
Invoke the **`verify`** skill: on the play screen confirm body/tile text is clearly legible while the CRT scanline is still visible (vignette + bloom + flicker unchanged).

- [ ] **Step 4: Commit**
```bash
git add src/ui/styles/tokens.css docs/mockups/play-screen.html
git commit -m "fix: lighten CRT scanline for text readability (feedback F2)"
```

---

## Self-Review

**Spec coverage:** item 1 → Task 2; item 2 → Tasks 3 (engine) + 4 (UI); item 3 → Task 1; item 4 → Tasks 5 (draw) + 6 (discard); item 5 → Task 7; item 5.1 → Task 8; F1 → Task 9; F2 → Task 10. All spec sections covered.

**Type consistency:** `sentenceBonus` shape (`{ chips, mult, pattern }`) is defined in Task 4 Step 1 and consumed in the same task's Sidebar prop (Step 5, widened to `pattern: string | null` at the component boundary, which accepts the `PatternId | null` value). `endBlind` breakdown fields (`sentenceChips`/`sentenceMult`/`bonus`) are defined in Task 3 and consumed in Task 4. `WooDakSkin` union `'alien'` (Task 7) is used by `mascotCollectionRows` (Task 8). No name drift.

**Ordering:** Task 3 precedes Task 4 (UI reads the engine breakdown); Task 7 precedes Task 8 (silhouettes need the ghost/alien art + `'alien'` id). Tasks 1, 5, 6, 9, 10 are independent and may run in any order.

**Note on Task 2 churn:** scaling `letterChips` moves every tile-chip-derived score assertion across ~12 test files. This is inherent to "increase tile chips" and is handled by the run-suite-then-recompute loop (Steps 2–4), with the scaling rule fixed in Global Constraints and a worked example in Step 3.
