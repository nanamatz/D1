---
name: performance-patterns.instructions.md
description: "Performance review patterns for Play the Wor!d codebase. Use when: auditing code for allocation waste, memory leaks, hot-path inefficiencies, or GC pressure in TypeScript/JavaScript. Covers engine headless principles, React optimizations, and word-building game-specific patterns."
applyTo: ["src/engine/**/*.ts", "src/ui/**/*.ts", "src/ui/**/*.tsx", "src/sim/**/*.ts"]
---

# Performance & Memory Patterns for Play the Wor!d

This file documents performance best practices, common pitfalls, and GC-conscious patterns for this codebase.

## Architecture Principles

### 1. Headless Engine (No DOM/Browser APIs)
- **Rule:** `src/engine/` MUST never import DOM, React, browser APIs, or browser-only features
- **Benefit:** Engine runs in Node.js, enabling fast headless simulation (balance verification, autoplay)
- **Red Flag:** Any `typeof window`, `document.`, `fetch()`, or React import in engine files
- **Fix:** Move UI rendering and I/O to `src/ui/` layer; pass data downward only

### 2. Pure Functions (No Mutations, No Side Effects)
- **Rule:** Core pipeline functions (`startBlind`, `submitWord`, `settle`) return NEW objects; inputs untouched
- **Benefit:** Deterministic, testable, re-playable (seeded runs); no hidden state
- **Red Flag:** 
  ```typescript
  // ❌ BAD: Mutates input
  function addScore(blind: BlindState, points: number) {
    blind.committedScore += points;
    return blind;
  }
  
  // ✅ GOOD: Returns new object
  function addScore(blind: BlindState, points: number): BlindState {
    return { ...blind, committedScore: blind.committedScore + points };
  }
  ```
- **GC Impact:** Immutable spreads create temporary object allocations, but they're short-lived and GC-collectible; this is acceptable vs. the correctness cost

### 3. Seeded RNG (One Source of Truth)
- **Rule:** All randomness flows through `src/engine/rng.ts`; **never** call `Math.random()` in engine
- **Files:** 
  - `rng.ts` defines `Rng` interface + `mulberry32` PRNG
  - `loop.ts`, `bag.ts`, `shop.ts`, `bosses.ts` all consume the seeded RNG
- **Benefit:** Full reproducibility from `RunState.seed`; no RNG leaks to multiple sources
- **Red Flag:** Any `Math.random()`, `crypto.getRandomValues()`, or other randomness in engine
- **Pattern:**
  ```typescript
  // ✅ GOOD: Pass RNG through call chain
  function shuffle<T>(items: readonly T[], rng: Rng): T[] {
    return rng.shuffle(items);
  }
  ```

---

## Hot Paths & Allocation Control

### Word Submission & Scoring (Peak Load)

**Location:** `src/engine/loop.ts` → `submitWord()`, then `src/engine/scoring.ts`

**Why It's Hot:**
- Runs on EVERY word play (potentially 10s of words per blind, 100s per run)
- Settles layer-1 scoring, joker hooks, pattern matching
- Allocates score events for animation replay

**GC-Conscious Patterns:**

```typescript
// ❌ AVOID: Allocating new arrays per tile
function tileValues(tiles: readonly Tile[]): number[] {
  return tiles.map(t => BALANCE.letterChips[t.letter] ?? 0); // new array every time
}

// ✅ PREFER: Accumulate in a single pass
function sumTileChips(tiles: readonly Tile[]): number {
  let sum = 0;
  for (const tile of tiles) {
    sum += BALANCE.letterChips[tile.letter ?? NO_LETTER] ?? 0;
  }
  return sum;
}
```

```typescript
// ❌ AVOID: String allocation per word lookup
function lookup(tiles: Tile[], lexicon: Lexicon): WordDef | null {
  const spelled = tiles.map(t => t.letter).join(''); // new string
  return lexicon.get(spelled);
}

// ✅ PREFER: Single spell call, reuse spelling
const spelled = spell(tiles);
const def = lexicon.get(spelled);
```

**Key Functions (Review for Allocations):**
- `submitWord()` — main entry; calls scoring + pattern matching
- `scoreWord()` — per-word chips/mult; calls `baseScore()`, joker hooks
- `baseScore()` — layer-1 settlement; should NOT allocate arrays
- `judgeSentence()` — pattern matching over all words; O(n²) worst-case, optimized with early exit
- `finalizeScore()` — sentence bonus settlement; collects chips/mult deltas

**Anti-Pattern: Object Creation in Loops**
```typescript
// ❌ BAD: Creates new event per tile played
for (const tile of played) {
  events.push(new ScoreEvent({ tile, beat: 0 })); // allocation × n
}

// ✅ GOOD: Collect tiles first, emit once
const event = { tiles: played, beat: 0 };
events.push(event);
```

---

### Bag Shuffle & Draw (Game Setup + Per-Blind)

**Location:** `src/engine/bag.ts` + `src/engine/loop.ts`

**Why It's Hot:**
- Runs at `startBlind()` (once per blind)
- Shuffle is O(n) Fisher-Yates; bag size ~60 letters

**Pattern:**
```typescript
// ✅ GOOD: RNG.shuffle() returns new array, no in-place mutation
const shuffled = rng.shuffle(bag);

// Rule: run.bag is never mutated; blind.bag is a fresh copy per blind
```

**Watch For:**
- Repeated shuffles (filter → shuffle → draw instead of draw → filter)
- Bag refills mid-blind (design rule: bag never refills until blind end; see GDD §6.6)

---

### Pattern Matching (Sentence Scoring)

**Location:** `src/engine/patterns.ts`

**Why It's Hot:**
- Runs per-phase to compute sentence projection
- Tries every pattern (12) against submitted word sequence
- **Rule:** Highest-pattern-wins; stop after first match

**Anti-Pattern: Unbounded Matching**
```typescript
// ❌ BAD: Tests all patterns, collects all matches
const allMatches = PATTERNS.map(p => match(p, sequence));
const best = allMatches.filter(m => m.score > 0)[0];

// ✅ GOOD: Stops after first pattern matches (highest rarity first)
for (const pattern of PATTERNS) { // patterns sorted by rarity (highest first)
  const match = judgeSentence(pattern, sequence);
  if (match) return match; // early exit
}
```

---

### React Render Cycle (UI Layer)

**Location:** `src/ui/components/`, `src/ui/useGame.ts`, `src/ui/settle.tsx`

**Why It's Hot:**
- Render on every frame during animations
- Settle animation replays engine score events (can be 50+ events per submit)
- Each render reads engine state snapshots

**GC-Conscious Patterns:**

#### 1. Memoize Component Props
```typescript
// ❌ BAD: Passes new object every render → child re-renders
<CardStack items={played.map(t => ({ ...t }))} />

// ✅ GOOD: Memoize or pass stable reference
const itemsRef = useMemo(() => played, [played]);
<CardStack items={itemsRef} />
```

#### 2. useCallback for Event Handlers
```typescript
// ❌ BAD: New function every render → downstream re-renders
const handlePlay = (word: string) => {
  submitWord(word);
};
<PlayButton onClick={handlePlay} /> // new handler every render

// ✅ GOOD: Stable reference via useCallback
const handlePlay = useCallback((word: string) => {
  submitWord(word);
}, [submitWord]);
<PlayButton onClick={handlePlay} /> // same reference across renders
```

#### 3. Avoid Allocations in Event Handlers
```typescript
// ❌ BAD: Allocates new array on click (may fire 10+ times/sec during hold)
const handleDown = () => {
  const selected = tiles.filter(t => !t.locked); // new array
  setSelected(selected);
};

// ✅ GOOD: Pre-compute or memoize
const selectable = useMemo(() => tiles.filter(t => !t.locked), [tiles]);
const handleDown = useCallback(() => {
  setSelected(selectable);
}, [selectable]);
```

#### 4. Settle Animation Replay
- `settle.tsx` iterates `lastEvents` (50–200 events per word) and plays animations
- **Pattern:** Use `requestAnimationFrame` to batch DOM operations
- **Red Flag:** Allocating new event objects during replay
- **Rule:** `lastEvents` is immutable; replay reads it without modification

---

## Memory Leak Patterns

### Detached DOM Nodes
- **Where:** React component unmounts but event listeners remain attached
- **Red Flag:** `addEventListener` without corresponding `removeEventListener` in cleanup
- **Pattern:**
  ```typescript
  // ❌ BAD: Listener leaks after unmount
  useEffect(() => {
    window.addEventListener('resize', handleResize);
  }, []);
  
  // ✅ GOOD: Cleanup on unmount
  useEffect(() => {
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);
  ```

### Unbounded Closure Captures
- **Where:** Callbacks holding large objects unnecessarily
- **Red Flag:** Event handler captures entire `game` or `run` state
- **Pattern:**
  ```typescript
  // ❌ BAD: Closure captures whole run, prevents GC
  const onSubmit = () => {
    log(run.seed, run.ante, run.score); // captures run
  };
  
  // ✅ GOOD: Capture only what's needed
  const seed = run.seed, ante = run.ante, score = run.score;
  const onSubmit = useCallback(() => {
    log(seed, ante, score); // captures 3 primitives, not entire object
  }, [seed, ante, score]);
  ```

### Circular References in Closures
- **Where:** Event listeners reference objects that reference back
- **Pattern:** Timer callbacks holding `this` in non-cleanup context
- **Rule:** Always provide cleanup for `setTimeout` / `setInterval`

---

## TypeScript-Specific Patterns

### Avoid `any` in Hot Paths
```typescript
// ❌ Disables type checking; hides allocation bugs
function scoreWord(word: any): any {
  // ...
}

// ✅ Precise types catch allocations at compile time
function scoreWord(word: WordDef, tiles: readonly Tile[]): WordScoringContext {
  // ...
}
```

### Non-Null Assertions Only in Verified Contexts
```typescript
// ❌ Risky; may allocate if tile.letter is null
const letter = tile.letter!; // assertion without verification

// ✅ Verify before assertion
const letter = tile.letter ?? NO_LETTER; // handles null case
```

### Readonly Inputs Reduce Copies
```typescript
// ✅ readonly prevents accidental mutation; signals immutability
function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  return rng.shuffle(items); // RNG creates new array safely
}
```

---

## Balance.ts & Magic Numbers

- **Rule:** Every tunable value lives in `src/engine/balance.ts`, keyed to GDD tables
- **Why:** Centralized, easy to sweep for performance tuning
- **Red Flag:** Hardcoded numbers in hot functions (e.g., `if (score > 10000)`)
- **Pattern:**
  ```typescript
  // ❌ BAD: Magic number in scoring
  if (tiles.length > 5) mult *= 1.2; // where does 5 come from?
  
  // ✅ GOOD: Defined in balance, sourced from GDD
  if (tiles.length > BALANCE.wordLength.minForBonus) {
    mult *= BALANCE.wordLength.bonusMult;
  }
  ```

---

## Testing & Validation

### Headless Simulation (Autoplay for Balance)
- **File:** `src/sim/` runs thousands of games headlessly to verify balance
- **Pattern:** No UI rendering, pure engine execution
- **Usage:** Detect runaway scoring, GC issues, or allocation bombs before UI
- **Command:** `npm run sim` (runs simulations, reports summary)

### Profiling Checklist
When reviewing code that claims to be "optimized":

- [ ] Run CPU profile with Node.js `--inspect` or Chrome DevTools
- [ ] Capture 30–60 seconds of steady workload
- [ ] Identify functions consuming >10ms per call
- [ ] Check allocation timeline (heap growing unbounded?)
- [ ] Measure before/after if changes are made

---

## Common Wins (Quick Wins for Performance Debt)

1. **Array Filtering + Mapping → Single Loop**
   - Replace `array.filter().map().reduce()` chains with one loop
   - Saves 2–3 intermediate allocations per high-frequency operation

2. **Memoize Lexicon Lookups**
   - `lexicon.get(spelled)` is O(1) but `spell()` allocates; cache spelled form in Tile if needed

3. **Consolidate Score Events**
   - Instead of one event per tile, group tiles by type (played, held, owned-jokers)
   - Reduces event array size 30–50%

4. **Defer DOM Operations**
   - Batch DOM reads/writes with `requestAnimationFrame`
   - Prevents layout thrashing during settle animation

5. **Profile React with Profiler Tab**
   - Identify components rendering >1× per interaction
   - Add `useMemo` / `useCallback` to prevent re-renders

---

## Summary

| Principle | Rationale | Checker |
|-----------|-----------|---------|
| Headless engine, no DOM | Enables Node.js sim + deterministic tests | grep: no `typeof window`, `document`, `React` in `src/engine/` |
| Pure functions, immutable | Reproducibility, GC-friendly | Review: function returns new object, doesn't mutate input |
| Single seeded RNG | No RNG leaks; full reproducibility | grep: no `Math.random()` in engine |
| O(n) not O(n²) in hot paths | Avoids quadratic blowup on large word sequences | Review: pattern matching, joker loops, settlement |
| Memoize React props/callbacks | Prevents unnecessary re-renders and allocations | Review: `useMemo`, `useCallback` on `CardStack`, event handlers |
| Cleanup listeners on unmount | Prevents detached DOM + memory leaks | Review: `useEffect` cleanup functions |

---

**Questions?** Run the Code Reviewer Agent on any file in `src/engine/` or `src/ui/` to audit for these patterns.
