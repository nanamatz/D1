# Getting Started with Developer Agent Ecosystem

**Welcome to Play the Wor!d Developer Agent Ecosystem!** 🎮

This guide helps you set up and start using the complete suite of development tools for design, implementation, and validation.

---

## ⚡ 5-Minute Quickstart

### 1. Explore the Ecosystem
```bash
# Open and read the main overview
open .github/README.md
```

**Key files to know:**
- `.github/README.md` — Full overview (start here)
- `.github/agents/` — 4 specialized agents
- `.github/SIMULATION_COOKBOOK.md` — How to test balance
- `.github/BALANCE_AUDIT_CHECKLIST.md` — Monthly health checks
- `.github/design-worksheets/` — Design templates

### 2. Pick Your Role

**I'm a…**

**Code Reviewer?**
```
@Code Reviewer src/engine/scoring.ts focus: 'performance'
```
→ Audit quality, memory, GC patterns

**Game Designer?**
```
@Game Designer "Analyze ante curve difficulty"
```
→ Validate mechanics, tune numbers, run sims

**Gameplay Programmer?**
```
@Gameplay Programmer "Implement Emoji Tile X per design doc"
```
→ Build engine + UI, write tests

**Performance Engineer?**
```
@Performance Profiler src/engine/loop.ts cpu
```
→ Profile CPU, memory, render performance

### 3. Do Your First Task
- Code Reviewer: Review any file in `src/engine/` or `src/ui/`
- Designer: Read design worksheet template, create first design
- Programmer: Implement a small feature from design
- Profiler: Profile `src/sim/index.js` with 1000 runs

---

## 📚 Complete Learning Path (1 hour)

### Part 1: Understand the System (20 min)
1. Read `.github/README.md` overview (5 min)
2. Skim `.github/instructions/performance-patterns.instructions.md` (5 min)
3. Review `.github/agents/` descriptions (5 min)
4. Bookmark all files for later

### Part 2: Learn Your Agent (15 min)
**Pick ONE:**
- Code Reviewer: Read `.github/agents/code-reviewer.agent.md`
- Game Designer: Read `.github/agents/game-designer.agent.md`
- Gameplay Programmer: Read `.github/agents/gameplay-programmer.agent.md`
- Performance Profiler: Read `.github/agents/performance-profiler.agent.md`

### Part 3: Try It Out (25 min)
**Do ONE of these:**

**Code Reviewer Example:**
```bash
@Code Reviewer src/engine/types.ts focus: 'quality'
# Review type safety and structure
```

**Game Designer Example:**
```bash
@Game Designer "Is the ante 1 target (300 chips) achievable?"
# Ask about game balance
```

**Gameplay Programmer Example:**
```bash
# Create a simple test
npm run test -- tests/slice1-bag.test.ts
# Understand test structure
```

**Performance Profiler Example:**
```bash
npm run sim --runs 100 --seed quick
# Run a quick simulation, see output format
```

---

## 🎯 Agent Quick Reference

| Agent | Use When | Example |
|-------|----------|---------|
| **Code Reviewer** | Writing/reviewing code | `@Code Reviewer src/engine/scoring.ts` |
| **Game Designer** | Designing features, tuning balance | `@Game Designer "Balance Brass nerf"` |
| **Gameplay Programmer** | Implementing features end-to-end | `@Gameplay Programmer "Add Emoji Tile X"` |
| **Performance Profiler** | Optimizing hot paths | `@Performance Profiler src/engine/loop.ts cpu` |
| **Explore** | Searching codebase | `@Explore "How does RNG work?" medium` |

---

## 📖 Documentation by Role

### For Code Reviewers
- **Start:** `.github/agents/code-reviewer.agent.md`
- **Reference:** `.github/instructions/performance-patterns.instructions.md`
- **Learn:** Red flags, allocation patterns, memory leaks
- **First Task:** Review `src/engine/rng.ts` for quality

### For Game Designers
- **Start:** `.github/agents/game-designer.agent.md`
- **Use:** `.github/design-worksheets/TEMPLATE.md` for new designs
- **Learn:** `.github/SIMULATION_COOKBOOK.md` for validation
- **Audit:** `.github/BALANCE_AUDIT_CHECKLIST.md` (monthly)
- **First Task:** Fill out design worksheet for a new consumable

### For Gameplay Programmers
- **Start:** `.github/agents/gameplay-programmer.agent.md`
- **Learn:** Headless engine principles, data-driven design
- **Reference:** `docs/GDD.md` + `CLAUDE.md` + `AGENTS.md`
- **First Task:** Implement an Emoji Tile from design worksheet

### For Performance Engineers
- **Start:** `.github/agents/performance-profiler.agent.md`
- **Learn:** `.github/SIMULATION_COOKBOOK.md` for sim analysis
- **Profile:** CPU, memory, render, allocations
- **First Task:** Profile `submitWord()` function, identify hotspots

---

## 🔄 Typical Workflows

### Workflow 1: Design → Implement → Validate (Most Common)

```
Step 1: DESIGNER
  - @Game Designer "Draft new Emoji Tile"
  - Fill `.github/design-worksheets/TEMPLATE.md`
  - Run simulation, get approval

Step 2: PROGRAMMER
  - @Gameplay Programmer "Implement [feature] per design"
  - Write engine code + UI code + tests
  - Run tests: npm run test

Step 3: CODE REVIEWER
  - @Code Reviewer src/engine/jokers/[name].ts
  - Get quality feedback
  - Apply fixes

Step 4: DESIGNER (Validation)
  - @Game Designer "Validate balance per sim"
  - Run final simulation
  - Approve or iterate

Step 5: PROGRAMMER (Ship)
  - Commit with design worksheet reference + sim results
```

### Workflow 2: Performance Optimization

```
Step 1: PROFILER
  - @Performance Profiler src/engine/scoring.ts cpu
  - Identify hot functions

Step 2: CODE REVIEWER
  - @Code Reviewer src/engine/scoring.ts focus: 'performance'
  - Audit for allocation waste

Step 3: PROGRAMMER
  - Implement optimizations
  - Re-test

Step 4: PROFILER (Validation)
  - @Performance Profiler (re-run)
  - Measure improvement
```

### Workflow 3: Monthly Balance Audit

```
Step 1: DESIGNER
  - Open `.github/BALANCE_AUDIT_CHECKLIST.md`
  - Run simulation with 10,000 runs
  - Fill audit form

Step 2: PROGRAMMER
  - Implement any fixes identified

Step 3: DESIGNER
  - Validate fixes via simulation
  - Produce patch notes
```

---

## ✅ Pre-Commit Checklist

Before committing any code:

- [ ] Read relevant GDD section (e.g., GDD §11.8 for Emoji Tiles)
- [ ] Use corresponding agent (Programmer, Designer, Reviewer)
- [ ] Tests pass: `npm run test` (if applicable)
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npx eslint [file] --fix`
- [ ] Code reviewed: `@Code Reviewer [file]`
- [ ] Design validated: `@Game Designer [feature]` (if balance-related)
- [ ] Commit message references design worksheet or GDD section

---

## 🚀 Useful Commands

```bash
# Code quality
npm run test                                    # Run all tests
npm run test -- tests/slice1-bag.test.ts       # Run specific test
npx tsc --noEmit                               # Type check
npx eslint src/engine --fix                    # Lint + auto-fix

# Game balance
npm run sim -- --runs 1000 --seed baseline     # Run baseline sim
npm run sim -- --runs 5000 --seed test --balance "x=y"  # Test change
npm run sim -- --runs 100 --force-purchase "Brass"     # Force element

# Development
npm run dev                                     # Start dev server
npm run build                                   # Build for production
npm run build:desktop                          # Build desktop app

# Documentation
grep -r "GDD §" docs/GDD.md                    # Find GDD sections
grep -r "BALANCE" src/engine/balance.ts        # Find tunable values
```

---

## 📋 Common Questions

### "How do I report a bug or suggest a feature?"
1. Check if it's a code issue → Ask `@Code Reviewer`
2. Check if it's a balance issue → Ask `@Game Designer`
3. Check if it's a performance issue → Ask `@Performance Profiler`
4. Open a GitHub issue with details + agent feedback

### "Where do I find the GDD?"
`docs/GDD.md` — This is the single source of truth for all game design decisions

### "How do I know if my code is 'good enough'?"
1. Tests pass ✅
2. `@Code Reviewer` says it's good ✅
3. Design is validated (if applicable) ✅
4. No performance regressions ✅

### "Can I use multiple agents for one task?"
Yes! Example: Programmer implements → Code Reviewer audits → Designer validates balance

### "What if I disagree with an agent's feedback?"
Agents are guides, not oracles. Use your judgment. If uncertain, ask for clarification.

### "Where do I see agent descriptions?"
- Quick reference: `.github/README.md` (flowchart section)
- Full details: `.github/agents/[name].agent.md`

---

## 🎓 Next Steps

**After Reading This Guide:**

1. ✅ Pick your primary role (Reviewer, Designer, Programmer, Profiler)
2. ✅ Read the agent doc for your role
3. ✅ Do your first task using that agent
4. ✅ Ask the agent clarifying questions as you go
5. ✅ Commit your work with proper references

**Recommended First Tasks (by Role):**

**Code Reviewer:**
```
@Code Reviewer src/engine/rng.ts focus: 'all'
# Understand review format and feedback style
```

**Game Designer:**
```
@Game Designer "What's the power budget for a Rare Emoji Tile?"
# Learn balance thinking
```

**Gameplay Programmer:**
```
@Gameplay Programmer "Show me the structure of a simple Emoji Tile implementation"
# Learn code patterns
```

**Performance Profiler:**
```
@Performance Profiler src/engine/loop.ts cpu
# Learn profiling workflow
```

---

## 📞 Need Help?

1. **"How do I use [agent]?"** → Read `.github/agents/[name].agent.md`
2. **"What's the game rule for [mechanic]?"** → Check `docs/GDD.md` §X
3. **"How do I [technical task]?"** → Check `.github/SIMULATION_COOKBOOK.md` or `.github/README.md`
4. **"I have a code question"** → Ask `@Code Reviewer` or `@Explore`
5. **"I have a design question"** → Ask `@Game Designer`

---

**You're all set! Welcome to the team. 🎉**

Now go build something awesome! 🚀
