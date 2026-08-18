# Play the Wor!d — Developer Agent Ecosystem

A comprehensive guide to custom agents, instructions, and automation tools for Play the Wor!d development.

## Overview

This workspace includes **3 specialized agents** + **1 instruction file** + **1 linter hook system** designed to accelerate game design, code quality, and performance work.

### At a Glance

| Tool | Purpose | When to Use | Trigger |
|------|---------|------------|---------|
| **Code Reviewer** | Quality, GC, performance audits | Before committing code | `@Code Reviewer [file]` |
| **Performance Profiler** | CPU, memory, render analysis | Optimizing hot paths | `@Performance Profiler [module]` |
| **Game Designer** | System design, balance, progression | Designing mechanics, tuning numbers | `@Game Designer [question]` |
| **performance-patterns.instructions** | Codebase patterns reference | Learning best practices | Open `.github/instructions/` |
| **code-review-linters.json** | Automated TypeScript + ESLint | Auto on code edit | Runs post-save |

---

## 🎯 Quick Start (5 min)

### Using Code Reviewer
```
@Code Reviewer src/engine/scoring.ts focus: 'performance'
```
**Output:** Issues with severity, location, before/after fix

### Using Performance Profiler
```
@Performance Profiler src/engine/loop.ts cpu
```
**Output:** Flamegraph, hot functions, allocation sites

### Using Game Designer
```
@Game Designer Analyze ante curve difficulty
@Game Designer Draft new Emoji Tile: "Multiplier per word length"
@Game Designer Propose patch notes for Brahmagupta (boss) difficulty
```
**Output:** Design rationale, simulation results, recommendation

---

## 📚 Detailed Agent Guides

### 1. Code Reviewer Agent (`.github/agents/code-reviewer.agent.md`)

**Role:** Audit TypeScript/JavaScript for code quality, memory leaks, and performance bottlenecks.

**Expertise:**
- Code quality (style, architecture, maintainability)
- GC & memory (allocations, leaks, closure captures, detached DOM)
- Performance (algorithms, hot-path waste, React re-renders)

**Output Format:**
```
# Code Review: [File or Function Name]

## Summary
[Overview of findings]

## Findings
### Issue #1: [Title]
- Category: Quality | GC | Performance
- Severity: Critical | High | Medium | Low
- Location: `src/file.ts` lines 42–57
- Problem: [What's wrong]
- Consequence: [Impact if not fixed]
- Fix: [Before/after code]

### Issue #2: ...

## Recommendations
[Broader patterns to improve]
```

**Key Red Flags Detected:**
- Object creation in tight loops → allocations
- Event listeners without cleanup → memory leaks
- Unbounded closures → GC pressure
- O(n²) algorithms in hot paths → performance
- Missing `useMemo` / `useCallback` → React re-renders
- `Math.random()` in engine → RNG pollution
- `any` types → type safety loss

**Example Prompts:**
```
@Code Reviewer Review src/engine/scoring.ts
@Code Reviewer Audit src/ui/settle.tsx focus: 'memory'
@Code Reviewer src/engine/loop.ts focus: 'performance'
@Code Reviewer Check src/engine/patterns.ts for sentence matching inefficiencies
```

**How It Works:**
1. Reads target file(s) and related dependencies
2. Cross-references `.github/instructions/performance-patterns.instructions.md` for codebase conventions
3. Scans for allocation patterns, memory leaks, and code quality violations
4. Auto-runs TypeScript and ESLint (via hooks) after changes
5. Delivers structured findings with fixes

---

### 2. Performance Profiler Agent (`.github/agents/performance-profiler.agent.md`)

**Role:** Analyze runtime performance—CPU, memory, render frames, GC pressure.

**Expertise:**
- CPU profiling (Node.js --inspect, Chrome DevTools)
- Memory snapshots (heap growth, long-lived objects, detached DOM)
- React render profiler (unnecessary re-renders, component timing)
- GC analysis (young-gen/old-gen collections, pause times)
- Allocation hotspots (object creation volume, peak memory)

**Profiling Methods:**
```bash
# CPU Profile (Node.js)
node --inspect-brk src/sim/index.js
# Then: chrome://inspect → Profiler → Record

# Memory Snapshot (Browser)
# Chrome DevTools → Memory → Capture heap before/after

# React Render Profile (Browser)
# React DevTools → Profiler → Record interaction
```

**Output Format:**
```
# Performance Profile: [Module or Function]

## Summary
[1–2 sentence overview: peak metric, bottleneck, user impact]

## Profile Methodology
- Environment: dev | prod, Node.js vX.XX or Chrome vXX
- Workload: [N iterations, duration, dataset size]
- Tool: DevTools / --inspect / benchmark harness

## Findings
### Metric #1: [CPU / Memory / Render]
- Peak: [e.g., 125ms per frame, 45MB heap]
- Baseline: [Expected value for comparison]
- Root Cause: [Why slow/allocative]
- Impact: [Jank, TTI, OOM?]

### Metric #2: ...

## Allocation Hotspots
- FunctionA() allocates ~500KB per call (line 42)
- loop() creates N temporary objects (lines 18–25)

## Recommendations
1. [Fix #1]: [Refactoring] — Expected gain: [time or memory]
2. [Fix #2]: ...

## Before/After
[Show improvement after applying fix]
```

**Example Prompts:**
```
@Performance Profiler src/engine/loop.ts cpu
@Performance Profiler src/ui/settle.tsx memory
@Performance Profiler src/sim/ allocations
@Performance Profiler src/ui/components/CardStack.tsx render
```

**How It Works:**
1. Confirms target module and profiling method (CPU, memory, render, allocations)
2. Runs profiler for steady-state workload (minimum 30 seconds or 3 iterations)
3. Extracts timings, heap growth, allocation volume
4. Correlates slow functions to allocation patterns
5. Recommends caching, memoization, or algorithmic fixes

---

### 3. Game Designer Agent (`.github/agents/game-designer.agent.md`)

**Role:** Design game systems, balance numbers, and plan progression.

**Expertise:**
- Game design (mechanics, systems, coherence)
- Balancing (cost-benefit, rarity, power curves)
- Economy (gold flow, Pouch/Record composition, rewards)
- Roguelite philosophy (Balatro DNA: short runs, high variance, layered meta)
- Simulation (10,000+ autoplay runs for validation)

**Core Principles:**
1. **No hardcode** — mechanics live in BALANCE.ts, GDD tables
2. **Data-driven** — new elements = config entries (`JokerDef`, `BossDef`)
3. **Immutability** — engine functions return new states
4. **Scale testing** — 1,000+ simulations, not 100-run intuition
5. **Doc sync** — GDD, code, tests all land together

**Output Format:**

#### When Designing a Mechanic
```
# Design: [Name]

## Concept
[1–2 sentence pitch]

## Mechanics
[Exact rules, referencing GDD sections]

## Balance Framework
- Rarity: Common | Uncommon | Rare | Legendary
- Cost/Value: $ or joker slot (vs. 3 analogues)
- Synergies: [Combos with existing jokers/bosses]
- Counter-play: [What stops runaway builds?]

## Simulation Results
[1000+ plays; median/95th percentile, win rate]

## Recommendation
[Ship / Iterate / Reject]
```

#### When Balancing Numbers
```
# Balance Tuning: [What]

## Current State
- [Number]: Y value
- Median score: Z
- Win rate: W%

## Proposed Change
[Number]: Y → Y′
- Reasoning: [Why]
- Forecast: [Expected delta]

## A/B Test Results
[Sim old vs. new]

## Recommendation
[Apply / Iterate / Revert]
```

**Design Checklist (Economy):**
- [ ] Gold sources: clear rewards + phases + interest + sell?
- [ ] Gold sinks: shop + voucher acquisition?
- [ ] Tipping point: when does player have "enough" gold?
- [ ] Scarcity: abundant or does run starve?
- [ ] Synergy: cheap items enable powerful combos?

**Example Prompts:**
```
@Game Designer Analyze ante curve difficulty (Chapter 1–8)
@Game Designer Draft new Emoji Tile: "Word length bonus"
@Game Designer Balance Stereotype Plate (boss) — too hard?
@Game Designer Review economy flow for Purple Pouch
@Game Designer Propose patch notes for v2.1
@Game Designer Detect hidden imbalances in BALANCE.ts
```

**How It Works:**
1. Reads GDD (`docs/GDD.md`) and BALANCE.ts
2. Validates proposal against roguelite principles
3. Runs `npm run sim` with proposed values (1,000–10,000 runs)
4. Analyzes median score, win rate, variance
5. Compares to analogues (similar rarity/cost entries)
6. Flags synergies or dead builds
7. Recommends ship, iterate, or reject

---

## 🛠️ Supporting Infrastructure

### Instruction File: `performance-patterns.instructions.md`

**Location:** `.github/instructions/performance-patterns.instructions.md`

**Content:**
- Architecture principles (headless engine, pure functions, seeded RNG)
- Hot paths & allocation control (scoring, bag shuffle, pattern matching, React)
- Memory leak patterns (detached DOM, closure captures, unbounded growth)
- TypeScript best practices (avoid `any`, readonly inputs, non-null assertions)
- BALANCE.ts philosophy (centralized tuning, GDD-sourced)
- Profiling checklist (before/after measurement)
- Common wins (quick refactoring opportunities)

**Used by:**
- Code Reviewer Agent (context on codebase patterns)
- All developers (reference during code review)

**Example:**
```
# Red Flag: Object Creation in Loops

❌ BAD:
for (const tile of played) {
  events.push(new ScoreEvent({ tile })); // allocation × n
}

✅ GOOD:
const event = { tiles: played };
events.push(event);
```

---

### Linter Hooks: `code-review-linters.json`

**Location:** `.github/hooks/code-review-linters.json`

**What It Does:**
- Automatically runs **TypeScript compiler** (`tsc --noEmit`) after edits to `src/**/*.ts` and `src/**/*.tsx`
- Automatically runs **ESLint** (`eslint --fix`) to fix style violations
- Non-blocking (warnings only); findings logged but don't stop work

**Triggers:**
- `PostToolUse` event on any file edit
- `SessionStart` to validate project setup (tsc, eslint, node versions)

**Output:** Type errors and style warnings in the chat; fixes applied automatically

---

## 🔄 Typical Workflows

### Workflow A: Code Review Before Commit
```
1. Edit src/engine/scoring.ts
2. Linters auto-run (TypeScript, ESLint)
3. @Code Reviewer src/engine/scoring.ts
4. Review findings; apply fixes
5. Commit
```

### Workflow B: Performance Optimization
```
1. @Performance Profiler src/engine/loop.ts cpu
2. Identify hot function (e.g., submitWord)
3. @Code Reviewer src/engine/loop.ts focus: 'performance'
4. Apply refactorings (memoization, loop consolidation, etc.)
5. Re-profile to measure improvement
```

### Workflow C: Design New Mechanic
```
1. @Game Designer "Draft Emoji Tile: bonus per sentence pattern"
2. Review proposal, simulation results
3. Iterate on balance framework (cost, synergies, counters)
4. @Game Designer "Re-run sim with updated cost"
5. Once approved, implement in BALANCE.ts + engine
6. @Code Reviewer [implementation] to catch allocation waste
7. Commit with patch notes
```

### Workflow D: Balance Audit (Quarterly)
```
1. @Game Designer "Detect overpowered Emoji Tiles"
2. Review win rates, median scores by rarity
3. @Game Designer "Propose nerfs for top 3 offenders"
4. Run simulation to forecast player impact
5. Apply changes; measure against baseline
6. Write patch notes; communicate to team
```

---

## 📋 Integration with GDD & CLAUDE.md

### GDD (`docs/GDD.md`)
- **Single source of truth** for game design
- Agents reference GDD sections (e.g., "GDD §3.1", "GDD §8.3")
- Designer Agent validates new mechanics against GDD
- **Rule:** Any design change must update GDD + code + tests in same PR

### CLAUDE.md
- Architecture principles, no-hardcode rules, headless philosophy
- Code Reviewer enforces CLAUDE.md conventions
- Performance Patterns instruction adds to CLAUDE.md principles
- **Rule:** Doc drift is a bug; keep CLAUDE.md and code in sync

---

## 🚀 Quick Reference

### Agent Selection Flowchart

```
Are you...
  ├─ Writing code? → Use Code Reviewer
  │   ├─ Worried about memory? → focus: 'memory'
  │   ├─ Optimizing hot path? → focus: 'performance'
  │   └─ Checking style? → Linters run auto
  │
  ├─ Slow or high memory? → Use Performance Profiler
  │   ├─ Main thread sluggish? → profiling: 'cpu'
  │   ├─ Heap growing? → profiling: 'memory'
  │   ├─ Janky renders? → profiling: 'render'
  │   └─ Too many objects? → profiling: 'allocations'
  │
  └─ Designing or balancing? → Use Game Designer
      ├─ New Emoji Tile? → "Draft [name]"
      ├─ Tuning numbers? → "Balance [param]"
      ├─ Checking economy? → "Review [system]"
      └─ Planning patch? → "Propose patch notes"
```

### File Locations (Copy-Paste Ready)

```
.github/
  ├─ agents/
  │   ├─ code-reviewer.agent.md           # Code quality, GC, perf
  │   ├─ performance-profiler.agent.md    # CPU, memory, render
  │   └─ game-designer.agent.md           # Design, balance, progression
  ├─ instructions/
  │   └─ performance-patterns.instructions.md   # Codebase patterns & best practices
  ├─ hooks/
  │   └─ code-review-linters.json         # Auto tsc + eslint
  └─ README.md (THIS FILE)
```

---

## 📖 Learning Path

**For New Team Members:**
1. Read this file (2 min overview)
2. Review `.github/instructions/performance-patterns.instructions.md` (15 min)
3. Try `@Code Reviewer src/engine/types.ts` (3 min, see what it finds)
4. Try `@Game Designer "What's the window for word length bonus?"` (5 min, learn balance thinking)
5. Run `npm run sim -- --runs 100` (2 min, see autoplay in action)

**For Code Changes:**
1. Every commit → `@Code Reviewer [your file]` first
2. Hot path changes → `@Performance Profiler [target]` to verify
3. Balance tweaks → `@Game Designer` to validate

**For Design Proposals:**
1. Start with `@Game Designer [idea]` to workshop it
2. Get simulation results + recommendation
3. Implement in BALANCE.ts
4. Commit with patch notes + simulation summary

---

## ⚙️ Customization & Extension

### Adding a New Agent
1. Create `.github/agents/[name].agent.md` following the template in `.github/agents/code-reviewer.agent.md`
2. Define tools, description, and domain expertise
3. Test by invoking `@[name] [query]`

### Adding Linter Rules
1. Edit `.github/hooks/code-review-linters.json`
2. Add new hook under appropriate event (PostToolUse, SessionStart, etc.)
3. Test by editing a file that matches the condition

### Updating Patterns Instruction
1. Edit `.github/instructions/performance-patterns.instructions.md`
2. Add anti-patterns, red flags, or best practices you discover
3. Link from agent descriptions so they auto-reference it

---

## 🎯 Success Metrics

You'll know the ecosystem is working when:

- ✅ Code Reviewer catches allocation bugs *before* they slow players
- ✅ Performance Profiler identifies hot functions in seconds, not hours
- ✅ Game Designer can propose and validate a balance patch in <30 minutes
- ✅ Team commits consistently include agent feedback + rationale
- ✅ GDD, CLAUDE.md, and code stay in sync (no doc drift)
- ✅ Simulations guide balance decisions, not anecdote

---

## 📞 Questions?

- **"How do I know which agent to use?"** → See flowchart above
- **"Can agents work together?"** → Yes! Code Review → Performance Profile → Design iteration
- **"What if an agent gives bad advice?"** → Agents are guides, not oracles; always validate with data
- **"How do I contribute patterns?"** → Edit `performance-patterns.instructions.md` and PR it

---

**Last Updated:** 2026-08-18  
**Agents:** Code Reviewer, Performance Profiler, Game Designer  
**Instructions:** performance-patterns.instructions.md  
**Hooks:** code-review-linters.json
