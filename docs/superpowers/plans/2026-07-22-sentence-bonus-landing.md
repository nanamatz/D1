# Sentence-Bonus Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the blind-end sentence bonus into a distinct, legible climax — the pattern name + level and its level-scaled chips/mult visibly climb in the scorebox, *then* the bonus is seen rolling onto the round total (sequential, not simultaneous).

**Architecture:** No engine/scoring change. `endBlind` already returns the post-hook `sentenceChips`/`sentenceMult` and the matched pattern. We (1) plumb the pattern's **level** into the UI `sentenceBonus` object and (2) split `useGame`'s single blind-end update into two timed phases — **build** (set `sentenceBonus`, round holds at committed) then **land** (set `finalScore`, round rolls). The Sidebar's existing round-target logic (`finalScore ?? committedScore`) makes the split visible with no round-logic change; the Sidebar only adds the level badge and a landing flourish.

**Tech Stack:** TypeScript (strict), React 18, plain CSS custom properties, Vite, Vitest, i18n via `t(key, {n})`.

## Global Constraints

- **Round number only ever rolls up, one eased count-up** (`CLAUDE.md`: "Displayed round score = committed only"). The bonus is folded into the round number **only at blind end** — this beat — never during play.
- **No magic numbers in the engine**; this is UI-only, engine untouched. Timing lives in `useGame.ts` constants (`BONUS_LAND_MS`, `VERDICT_BEAT_MS`, `VERDICT_BEAT_REDUCED_MS`).
- **Never re-introduce a fixed delay to wait for the variable *settle*.** This beat is the *bonus land* (a fixed climax after the settle-complete signal), which correctly uses fixed `BONUS_LAND_MS` timing — do not confuse it with `settleDurationMs`.
- **i18n only for display strings**; add keys to BOTH `locales/en.json` and `locales/ko.json`.
- **Reduced motion** collapses the beat to a single instant frame, then the reduced verdict beat.

---

### Task 1: Split the blind-end update into build → land, plumbing the pattern level

Splitting `useGame`'s single Stage-1 update into build (set `sentenceBonus` only) then land (set `finalScore` after `BONUS_LAND_MS`) makes the box fill *before* the round rolls — the core requirement. This task is independently observable: even before the Sidebar badge changes, the round number will visibly hold while the box fills, then roll.

**Files:**
- Modify: `src/ui/useGame.ts` — `sentenceBonus` type (~line 136); blind-end effects (~lines 690–721)

**Interfaces:**
- Consumes: `endBlind(blind, run, lexicon)` → `{ finalScore, sentenceChips, sentenceMult, bonus, judgment }` (from `src/engine/loop.ts`); `run.patternLevels: Record<PatternId, number>` (from `src/engine/types.ts`).
- Produces: `GameState.sentenceBonus: { chips: number; mult: number; pattern: PatternId | null; level: number | null } | null` — now carries `level`. Consumed by `Sidebar` (Task 2).

- [ ] **Step 1: Add `level` to the `sentenceBonus` type**

In `src/ui/useGame.ts`, change the field declaration (currently ~line 136):

```ts
  sentenceBonus: { chips: number; mult: number; pattern: PatternId | null } | null;
```

to:

```ts
  sentenceBonus: { chips: number; mult: number; pattern: PatternId | null; level: number | null } | null;
```

- [ ] **Step 2: Replace the two blind-end effects with a build → land → resolve sequence**

Replace the existing Stage 1 effect (the `useEffect` beginning `if (!state.pendingEnd || !state.settleComplete || state.finalScore !== null) return;`, ~lines 690–705) AND the existing Stage 2 effect (the `useEffect` beginning `if (!state.pendingEnd || state.finalScore === null) return;`, ~lines 711–721) with the three effects below. Keep the surrounding comments' intent.

```ts
  // Detect reduced motion once per call site.
  const prefersReduce = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // BUILD — the last word's settle has landed. Publish the sentence bonus so the
  // scorebox fills to its chips × mult, but HOLD the round number at committed
  // (finalScore stays null → Sidebar's round target falls back to committedScore).
  // Reduced motion collapses build+land: set finalScore now too. A zero bonus
  // (no pattern, no unison) skips the build entirely — just set finalScore.
  useEffect(() => {
    if (!state.pendingEnd || !state.settleComplete) return;
    if (state.sentenceBonus !== null || state.finalScore !== null) return;
    const end = endBlind(state.blind, state.run, lexicon);
    const pattern = end.judgment.match?.pattern ?? null;
    const level = pattern ? (state.run.patternLevels[pattern] ?? 1) : null;
    const hasBonus = end.bonus > 0;
    const reduce = prefersReduce();
    setState((prev) => {
      if (!prev.pendingEnd || prev.sentenceBonus !== null || prev.finalScore !== null) return prev;
      const sentenceBonus = hasBonus
        ? { chips: end.sentenceChips, mult: end.sentenceMult, pattern, level }
        : null;
      // Reduced motion OR no bonus → land immediately (finalScore set now).
      const finalScore = reduce || !hasBonus ? end.finalScore : null;
      return { ...prev, sentenceBonus, finalScore };
    });
  }, [state.pendingEnd, state.settleComplete, state.sentenceBonus, state.finalScore, state.blind, state.run, lexicon]);

  // LAND — after the box has filled (BONUS_LAND_MS), publish finalScore so the
  // round number rolls committed → finalized. Only runs for a real bonus in full
  // motion (build set sentenceBonus, left finalScore null).
  useEffect(() => {
    if (!state.pendingEnd || state.sentenceBonus === null || state.finalScore !== null) return;
    const end = endBlind(state.blind, state.run, lexicon);
    const id = setTimeout(
      () =>
        setState((prev) =>
          prev.pendingEnd && prev.sentenceBonus !== null && prev.finalScore === null
            ? { ...prev, finalScore: end.finalScore }
            : prev,
        ),
      BONUS_LAND_MS,
    );
    return () => clearTimeout(id);
  }, [state.pendingEnd, state.sentenceBonus, state.finalScore, state.blind, state.run, lexicon]);

  // RESOLVE — the round number is fully updated. Hold a verdict beat, then
  // auto-resolve to Fee Settlement / Game Over (item 4).
  useEffect(() => {
    if (!state.pendingEnd || state.finalScore === null) return;
    const reduce = prefersReduce();
    const id = setTimeout(
      () => setState((prev) => (prev.pendingEnd ? { ...finalize(prev), pendingEnd: false } : prev)),
      reduce ? VERDICT_BEAT_REDUCED_MS : BONUS_LAND_MS + VERDICT_BEAT_MS,
    );
    return () => clearTimeout(id);
  }, [state.pendingEnd, state.finalScore, finalize]);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors. (If `prefersReduce` is flagged as redefined, ensure it is declared once inside `useGame` above the effects — move it out of the effect bodies as shown.)

- [ ] **Step 4: Run the existing test suite (no regressions)**

Run: `npm run test`
Expected: PASS — all existing slice tests green (this task touches only UI state; engine tests are unaffected).

- [ ] **Step 5: Commit**

```bash
git add src/ui/useGame.ts
git commit -m "feat(ui): split sentence-bonus land into build → land beat"
```

---

### Task 2: Level badge + landing flourish in the Sidebar

With the timing split in place, surface the pattern **level** on the badge and add the "being added" flourish (box pulse + `+N` fly token) that plays when the round starts rolling. Also show the badge for unison-only bonuses (no level).

**Files:**
- Modify: `src/ui/components/Sidebar.tsx` — Props `sentenceBonus` type; `.bonus-stamp` render; `.scorebox` landing class + fly token
- Modify: `src/ui/styles/play.css` — `.bonus-lvl`, `.bonus-fly`, landing pulse; reduced-motion suppression
- Modify: `locales/en.json`, `locales/ko.json` — `sidebar.patternLevel`

**Interfaces:**
- Consumes: `GameState.sentenceBonus` with `level` (Task 1); `finalScore` prop (already passed).
- Produces: no new interface — presentation only.

- [ ] **Step 1: Add the level label string to both locales**

In `locales/en.json`, after `"sidebar.unisonOnly": "unison only",` (line ~23) add:

```json
  "sidebar.patternLevel": "Lv.{n}",
```

In `locales/ko.json`, after `"sidebar.unisonOnly": "유니즌만",` (line ~23) add:

```json
  "sidebar.patternLevel": "Lv.{n}",
```

- [ ] **Step 2: Widen the Sidebar prop type to include `level`**

In `src/ui/components/Sidebar.tsx`, change the `sentenceBonus` prop (currently ~line 23):

```tsx
  sentenceBonus: { chips: number; mult: number; pattern: string | null } | null;
```

to:

```tsx
  sentenceBonus: { chips: number; mult: number; pattern: string | null; level: number | null } | null;
```

- [ ] **Step 3: Compute the landing flag and bonus total**

In `src/ui/components/Sidebar.tsx`, just after the existing `const bonusActive = sentenceBonus !== null;` line (~line 91) add:

```tsx
  // The bonus is LANDING (round is rolling) once finalScore is published — the box
  // is full and its product flies onto the round total. During BUILD (finalScore
  // still null) the box is filling and the round holds.
  const landing = bonusActive && finalScore !== null;
  const bonusTotal = bonusActive ? Math.round(sentenceBonus!.chips * sentenceBonus!.mult) : 0;
```

- [ ] **Step 4: Add the `landing` class to the scorebox**

In `src/ui/components/Sidebar.tsx`, change the scorebox class line (currently ~line 156):

```tsx
        <div className={['scorebox', (settle.active || bonusActive) && 'settling'].filter(Boolean).join(' ')}>
```

to:

```tsx
        <div
          className={['scorebox', (settle.active || bonusActive) && 'settling', landing && 'landing']
            .filter(Boolean)
            .join(' ')}
        >
```

- [ ] **Step 5: Show the pattern name + level (and unison-only) in the badge, plus the fly token**

In `src/ui/components/Sidebar.tsx`, replace the existing bonus-stamp block (currently ~lines 175–177):

```tsx
          {bonusActive && sentenceBonus!.pattern && (
            <span className="bonus-stamp">{t(`pattern.${sentenceBonus!.pattern}`)}</span>
          )}
```

with:

```tsx
          {bonusActive && (
            <span className="bonus-stamp">
              {sentenceBonus!.pattern ? t(`pattern.${sentenceBonus!.pattern}`) : t('sidebar.unisonOnly')}
              {sentenceBonus!.level != null && (
                <span className="bonus-lvl">{t('sidebar.patternLevel', { n: sentenceBonus!.level })}</span>
              )}
            </span>
          )}
          {landing && bonusTotal > 0 && (
            <span key="bonus-fly" className="bonus-fly">
              +{bonusTotal}
            </span>
          )}
```

- [ ] **Step 6: Style the level sub-badge, fly token, and landing pulse**

In `src/ui/styles/play.css`, immediately after the `.bonus-stamp { … }` rule (ends ~line 501) add:

```css
/* Level sub-badge inside the sentence-pattern stamp (2026-07-22 landing beat). */
.bonus-lvl {
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 6px;
  background: rgba(23, 50, 38, 0.28);
  color: #173226;
  font-size: 0.82em;
  font-weight: 800;
}
/* The bonus LAND beat: the box pulses once as its product flies onto the round. */
.scorebox.landing .box {
  animation: bonusPulse 0.5s ease-out;
}
@keyframes bonusPulse {
  0% { transform: scale(1); }
  35% { transform: scale(1.08); }
  100% { transform: scale(1); }
}
/* The +N bonus total floats up off the scorebox toward the round readout as it
   is added to the total. Mounts once (React key) when landing flips true. */
.bonus-fly {
  position: absolute;
  bottom: 100%;
  left: 50%;
  font-family: 'Jersey 10';
  font-size: var(--ds-sm);
  color: var(--gold);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
  pointer-events: none;
  white-space: nowrap;
  z-index: 6;
  animation: bonusFly 0.7s ease-out forwards;
}
@keyframes bonusFly {
  0% { opacity: 0; transform: translate(-50%, 6px); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -34px); }
}
```

- [ ] **Step 7: Suppress the new animations under reduced motion**

In `src/ui/styles/play.css`, find the reduced-motion block that lists `.box-pop,` (~line 2014) and add `.bonus-fly` and the pulse to the same `animation: none` group. Change:

```css
  .box-pop,
```

to:

```css
  .box-pop,
  .bonus-fly,
  .scorebox.landing .box,
```

(within the existing `@media (prefers-reduced-motion: reduce)` rule that sets `animation: none !important;` — confirm the selector list terminates in that declaration).

- [ ] **Step 8: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 9: Run the test suite**

Run: `npm run test`
Expected: PASS (no engine impact; confirms nothing imported here broke a shared module).

- [ ] **Step 10: Commit**

```bash
git add src/ui/components/Sidebar.tsx src/ui/styles/play.css locales/en.json locales/ko.json
git commit -m "feat(ui): sentence-bonus badge shows pattern level + landing flourish"
```

---

### Task 3: Visual verification in the running game

This feature is animation/timing UI — the meaningful verification is watching the beat, not a unit assertion. Drive the real game and confirm the sequence reads correctly.

**Files:** none (verification only)

- [ ] **Step 1: Build to confirm the production bundle compiles**

Run: `npm run build`
Expected: `tsc -b` clean, `vite build` succeeds.

- [ ] **Step 2: Launch and drive the game via the `verify` skill**

Invoke the `verify` skill (build/launch/drive recipe). Play a blind to completion so a sentence pattern lands (e.g. reach the target with a matched sentence).

- [ ] **Step 3: Confirm the choreography**

Observe, in order:
1. Last word's settle finishes → scorebox resets to `0 × 0`.
2. **Build:** the pattern badge shows `PATTERN Lv.N`; `box.c` and `box.m` count up from 0 to the bonus chips/mult; **the round number does NOT move yet.**
3. **Land:** the box pulses, a gold `+N` floats up, and the round number rolls up to the finalized score.
4. A short verdict beat, then Fee Settlement / Game Over.

- [ ] **Step 4: Confirm the edge cases**

- Clear a blind with **no pattern** (gibberish/short words only, or unison-only): a unison-only bonus shows the `unison only` badge (no `Lv.`) and still builds+lands; a truly zero bonus shows no bonus beat and the round holds.
- Toggle OS **reduced motion** and clear a blind: the badge + final box + final round appear in one frame, then the reduced verdict beat resolves — no drawn-out animation.

- [ ] **Step 5: Commit any tweaks**

If visual tuning is needed (timings, offsets), adjust and:

```bash
git add -A
git commit -m "polish(ui): tune sentence-bonus landing timing"
```
```

## Self-Review

**Spec coverage:**
- Distinct climax / pattern name + level → Task 2 Steps 2–5. ✓
- Level-scaled chips/mult visibly climb → existing `useCountUp` box fill, sequenced by Task 1. ✓
- Bonus seen being *added* (box fills, then round rolls) → Task 1 Step 2 build→land split. ✓
- Data flow (`level` plumbed, split update) → Task 1. ✓
- Files touched (useGame, Sidebar, play.css, locales) → Tasks 1–2. ✓
- Edge cases (unison-only, zero bonus, reduced motion, Chant/joker-shifted totals) → Task 1 Step 2 + Task 3 Step 4. ✓

**Type consistency:** `sentenceBonus` gains `level: number | null` in useGame (Task 1 Step 1) and Sidebar props (Task 2 Step 2) — matching. `landing`/`bonusTotal` defined once (Task 2 Step 3), used in Steps 4–5. ✓

**Placeholders:** none — every code step shows exact code. ✓
