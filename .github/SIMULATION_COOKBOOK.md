# Simulation Cookbook

**Purpose:** Practical guide to running, interpreting, and comparing game simulations. Use this to validate balance, test new mechanics, and measure patch impact.

---

## Overview

### What Is Simulation?
Autoplay 1000–10,000+ games headlessly (no UI), measure outcomes, and compare:
- **Baseline:** Current live build
- **Test:** Proposed change (new Emoji Tile, rebalanced number, etc.)
- **Delta:** Difference in median score, win rate, variance

### Why Simulate?
- **Fast:** 1,000 runs in seconds vs. weeks of playtesting
- **Reproducible:** Seeded RNG ensures exact same shuffle every run
- **Statistical:** Median/variance answer "is this better?" better than anecdote
- **Safe:** Catch overpowered changes before shipping

### When to Simulate
✅ New Emoji Tile / boss / consumable  
✅ Tuning BALANCE.ts number (cost, multiplier, etc.)  
✅ Major mechanic change (ante curve, economy)  
✅ Before/after patch (forecast impact)  
❌ Tiny tweaks (±1% changes don't need sim)  
❌ Content that doesn't affect scoring (UI, art)

---

## Setup (One-Time)

### Prerequisites
```bash
# Install dependencies (if not done)
npm install

# Verify npm scripts
npm run sim --help
```

### File Structure
```
src/sim/
├── index.js          # Autoplay harness (bootstraps run, plays to end)
├── analyze.js        # Post-sim analysis (median, win rate, variance)
└── bench/
    └── scenarios/    # Pre-defined test scenarios
```

### Configuration (Optional)
Edit `src/sim/index.js` to customize:
- Start ante (default: 1)
- Target runs (default: 1,000)
- Random seed (default: time-based)
- Autoplay strategy (default: greedy best word)

---

## Quick Start (5 min)

### 1. Run Baseline (Live Build)
```bash
npm run sim -- --runs 1000 --seed baseline
```

**Output:**
```
Ran 1,000 games.
Median score: 15,243
95th percentile: 31,500
Win rate: 62.3%
Avg gold end-run: $145

Top 5 Emoji Tiles:
1. Brass              (42 runs, avg +2400 score)
2. Twin (Letter Hand) (38 runs, avg +1800 score)
3. Magnifier          (35 runs, avg +1200 score)
...
```

**What to note:**
- Median score = your baseline for comparison
- Win rate = success percentage (clear Chapter 8)
- Top 5 Tiles = which synergies emerge naturally

### 2. Run Test (Proposed Change)
```bash
npm run sim -- --runs 1000 --seed test --force-purchase "Brass"
```

**Output:** Same format (median, win rate, etc.)

### 3. Calculate Delta
```bash
# Baseline: 15,243 median
# Test:     16,500 median
# Delta:    +1,257 (+8.2%)

# Interpretation:
# ✅ Healthy buff (not overpowered)
# ✅ Win rate didn't spike (still ~62%)
# ✅ Synergy emerged as expected
```

---

## Running Simulations (Common Scenarios)

### Scenario A: Test New Emoji Tile

**Goal:** Validate balance of new Emoji Tile before shipping

```bash
# Force the new joker into every run
npm run sim \
  --runs 5000 \
  --seed new-joker \
  --force-purchase "Palindromist Ink"
```

**Measure:**
| Metric | Target | Pass? |
|--------|--------|-------|
| Median vs baseline | +5 to +15% | ✓ if within range |
| Win rate delta | 0 to +5% | ✓ if no creep |
| Synergy frequency | Appears in 30%+ runs | ✓ if detectable |
| Avg score if paired with synergy | [Calculate] | ✓ if breakable |

**Verdict Template:**
```
✅ APPROVE: Palindromist Ink is balanced.
- Median +12% (16,900 vs 15,000 baseline)
- Win rate +1% (63% vs 62% baseline)
- Natural discovery rate: 28% (good, not forced)
- Synergy with Grand Palindrome detected but fair

Ship with confidence.
```

---

### Scenario B: A/B Test a Number Tuning

**Goal:** Decide between two values for a BALANCE.ts parameter

```bash
# Control: Current value
npm run sim --runs 5000 --seed control --balance "wordLength.multPerLetter=0.5"

# Variant A: Value option 1
npm run sim --runs 5000 --seed variant-a --balance "wordLength.multPerLetter=0.6"

# Variant B: Value option 2
npm run sim --runs 5000 --seed variant-b --balance "wordLength.multPerLetter=0.7"
```

**Compare Table:**
```
Value      | Median  | 95th %ile | Win Rate | Variance | Verdict
-----------|---------|----------|----------|----------|----------
0.5 (old)  | 15,000  | 31,000   | 62%      | High     | Baseline
0.6 (var A)| 16,200  | 33,500   | 63%      | Medium   | ✓ Best fit
0.7 (var B)| 18,500  | 41,000   | 68%      | Very High| ❌ Too swingy

Recommendation: Ship Variant A (0.6).
- Balanced difficulty progression
- Doesn't break win rate
- Variance stays reasonable
```

---

### Scenario C: Patch Impact Forecast

**Goal:** Predict player-facing impact of a bundle of changes

**Changes in patch v2.1:**
- Nerfed Brass (mult -0.1)
- Buffed Lead Plate (cost -$2)
- Adjusted ante curve (Chapter 5 target -200)

```bash
# Baseline (current live)
npm run sim --runs 5000 --seed baseline

# Patched (all changes applied)
npm run sim --runs 5000 --seed patched \
  --balance "jokers.brass.mult=-0.1" \
  --balance "jokers.leadPlate.cost=4" \
  --balance "anteBaseTargets[4]=3100"
```

**Forecast Table:**
```
Metric              | Live   | Patched | Delta  | Player Impact
--------------------|--------|---------|--------|---------------
Median score        | 15,000 | 14,700  | -2%    | Slightly harder
Win rate            | 62%    | 61%     | -1%    | Negligible
Brass avg when owned| +2400  | +1900   | -500   | ✓ Fair nerf
Lead Plate usage    | 8%     | 14%     | +6%    | ✓ More variety
Chapter 5 clear rate| 80%    | 82%     | +2%    | ✓ Easier ante 5

Conclusion: Well-balanced patch. Veterans notice Brass nerf; newbies benefit
from easier ante 5. Good meta shake-up without breaking difficulty floor.
```

---

### Scenario D: Compare Pouch Composition

**Goal:** Test if new Starting Pouch is too strong

**Starting Pouches:**
- Red (default): standard mix
- Green LP (new): difficulty modifier +1

```bash
# Red Pouch (baseline)
npm run sim --runs 5000 --seed red --starting-pouch red

# Green LP (test)
npm run sim --runs 5000 --seed green --starting-pouch green
```

**Compare:**
```
Metric            | Red Pouch | Green LP | Delta
------------------|-----------|----------|--------
Median score      | 15,000    | 12,500   | -17%
Win rate          | 62%       | 45%      | -17%
95th percentile   | 31,000    | 22,000   | -29%
Difficulty rating | Normal    | Hard     | ✓ Intended

Verdict: ✅ Green LP is harder as designed. Fair difficulty modifier.
```

---

### Scenario E: Boss-Specific Impact

**Goal:** Test if new boss is too hard or trivial

```bash
# Runs where Brahmagupta (example boss) appears
npm run sim --runs 5000 --seed brahmagupta --focus-boss "brahmagupta"
```

**Measure:**
```
Chapter 8 Deadline clear rate (Brahmagupta):
- Old boss: 72% clear rate
- New boss: 68% clear rate
- Delta: -4%

Verdict: ✓ Appropriately challenging. Not overpowered.
```

---

## Interpreting Results

### What Each Metric Means

#### Median Score
- **Definition:** Middle value (50th percentile). Half runs score higher, half lower.
- **Good baseline:** Stable, not skewed by outliers
- **Interpretation:**
  - Median +20%: Significant power boost (maybe too strong?)
  - Median +5%: Healthy adjustment
  - Median -5%: Meaningful nerf
  - Median ±2%: Negligible (don't ship for this alone)

#### 95th Percentile
- **Definition:** Score where only top 5% of runs exceed
- **Measures:** Ceiling (maximum potential)
- **Interpretation:**
  - If 95th went from 30K → 50K: Something is very strong
  - If median went +20% but 95th went +80%: Unbalanced (only strong in best case)
  - Healthy: 95th scales proportionally with median

#### Win Rate
- **Definition:** % of runs that clear Chapter 8 (finish) vs. lose
- **Baseline:** ~60–62% (achievable by competent player)
- **Red flags:**
  - Win rate >75%: Possibly too easy (power creep)
  - Win rate <40%: Possibly too hard (gatekeeping)
  - Win rate flat despite median up: Skill gate (only top players benefit)

#### Variance (Standard Deviation)
- **Definition:** How much runs differ from median
- **High variance:** Some runs crush, some fail badly (feel random)
- **Low variance:** Consistent, predictable (feel solvable)
- **Ideal:** Medium variance (roguelites need randomness, but not chaos)
- **Red flag:** Variance doubled → Change is too swingy

#### Average Gold
- **Definition:** Median gold remaining at run end (indicates economy health)
- **Interpretation:**
  - High gold: Economy too generous (players can trivialize)
  - Low gold: Economy too tight (players starve, can't build)
  - Ideal: Players finish with $20–50 (some choices matter, but not desperate)

---

### Common Patterns (What They Mean)

#### Pattern 1: Median Up, Win Rate Flat
```
Median: 15,000 → 16,500 (+10%)
Win rate: 62% → 62% (flat)

Interpretation: Change benefits all players equally.
Usually healthy. Carry on.
```

#### Pattern 2: Median Up, Win Rate Up Significantly
```
Median: 15,000 → 16,500 (+10%)
Win rate: 62% → 72% (+10%)

⚠️  Red flag: Something is powerful. Check:
- Is this a new strong synergy?
- Does it enable trivial builds?
- Is the ceiling too high (95th too far from median)?
```

#### Pattern 3: Median Flat, Win Rate Down
```
Median: 15,000 → 15,100 (+0.7%)
Win rate: 62% → 55% (-7%)

⚠️  Interpretation: Change breaks something foundational.
Likely a difficultywall that only affects weaker players.
May need revert or redesign.
```

#### Pattern 4: New Element Shows in Top 5
```
Top Emoji Tiles:
1. Brass              (emerges naturally)
2. New Tile           (appears immediately)
3. Magnifier          (still present)

✓ Good: New element is discoverable and valuable.
❌ Bad: If new tile appears in 95%+ of winning runs,
  it's too strong or mandatory.
```

---

## Analysis Workflow (Deep Dive)

### Step 1: Run Baseline
```bash
npm run sim --runs 5000 --seed baseline > baseline.txt
```

**Record:**
- Median score
- Win rate
- Top 5 Emoji Tiles
- Avg gold end-run
- Chapter 5 clear rate (ante scaling health check)

### Step 2: Run Test
```bash
npm run sim --runs 5000 --seed test [your flags] > test.txt
```

### Step 3: Diff Metrics
```
Baseline vs Test:

Metric              Baseline   Test    Delta    Interpretation
-----               ----       ----    -----    ------
Median              15,000     16,500  +10%     ✓ Healthy buff
Win rate            62%        64%     +2%      ✓ Slight advantage
95th percentile     31,000     35,000  +13%     ~ Proportional
Variance            4,200      4,500   +7%      ✓ Reasonable
Avg gold end-run    $42        $38     -$4      ✓ Tighter economy
Top emoji tiles     [list]     [list]  [diff]   ~ Same roster
```

### Step 4: Statistical Significance
*Is the change meaningful or just noise?*

**Rule of thumb:**
- Delta <2%: Noise, ignore
- Delta 2–5%: Small but real
- Delta 5–15%: Significant, worth investigating
- Delta >15%: Major shift, likely too strong

### Step 5: Sanity Check
Ask yourself:
1. **Does the change match my intuition?** (If not, dig deeper)
2. **Do outlier runs tell a story?** (Check best/worst case)
3. **Are synergies healthy?** (Are they forced or optional?)
4. **Did economy scale with ante?** (Chapter 5 vs. Chapter 8 gold)

---

## Comparative Analysis (A/B Testing Best Practices)

### Setup
```bash
# Test 3+ variants against baseline
npm run sim --runs 5000 --seed base    --balance "param=value1"
npm run sim --runs 5000 --seed var-a   --balance "param=value2"
npm run sim --runs 5000 --seed var-b   --balance "param=value3"
```

### Create Comparison Table
```
Variant | Median | Win% | Variance | Top Synergy | Verdict
--------|--------|------|----------|-------------|----------
Base    | 15,000 | 62%  | 4,200    | Brass + TT  | Baseline
Var A   | 16,100 | 63%  | 4,100    | Brass + TT  | ✓ Balanced
Var B   | 17,500 | 67%  | 5,200    | New Tile X  | ⚠️ Swingy
```

### Recommendation
```
CHOOSE: Variant A
- Cleanest median improvement (+7%)
- Win rate barely moves (+1%)
- Variance stable
- Synergies consistent with baseline
```

---

## Troubleshooting Simulations

### Issue: "Runs are too slow"
**Solution:**
```bash
# Reduce run count (for quick feedback)
npm run sim --runs 100 --seed quick

# Or parallelize across cores
npm run sim --runs 10000 --workers 8
```

### Issue: "Results are inconsistent"
**Solution:**
```bash
# Ensure fixed seed
npm run sim --runs 5000 --seed fixed

# Check: Are you changing code between runs?
# (Yes → rebuild, then re-run)
```

### Issue: "Median looks weird (v-shaped, skewed)"
**Solution:**
```bash
# Inspect distribution (not just median)
npm run sim --runs 5000 --analyze-histogram

# Look for:
# - Bimodal (two peaks) = bug or two distinct strategies
# - Right-skewed (long tail up) = healthy
# - Left-skewed (long tail down) = floor too low
```

### Issue: "Win rate is 0% or 100%"
**Solution:**
```bash
# Bug in code or change is broken/overpowered
# Debug:
npm run sim --runs 10 --seed debug --verbose

# Check first few games manually for errors
```

---

## Recording & Sharing Results

### Sim Report Template
```markdown
# Simulation: [What You Tested]

**Date:** 2026-08-18
**Tested By:** [Your Name]
**Change:** [Describe change(s)]

## Baseline (Current Live)
```
npm run sim --runs 5000 --seed baseline
Median: 15,243
Win rate: 62.3%
Top 5: [list]
```

## Test (Proposed Change)
```
npm run sim --runs 5000 --seed test [flags]
Median: 16,500
Win rate: 64.1%
Top 5: [list]
```

## Analysis
- Delta: +8.2% median (+1,257 points)
- Win rate: +1.8% (healthy, not creep)
- Variance: Stable
- Top synergies: Consistent with baseline

## Recommendation
✅ **APPROVE** — Ready to ship.
- Balanced power (within 5–15% target)
- No win-rate creep
- Natural discovery (not forced)
```

### Attach to Design Worksheet
- Include sim report in `.github/design-worksheets/[element].md`
- Reference commit hash + date
- Keep for audit trail

---

## Advanced: Custom Scenarios

### Example: "Force Poverty Run"
*Test: How do balance changes affect struggling players?*

```bash
npm run sim --runs 1000 --seed poverty \
  --max-starting-gold 20 \
  --no-vouchers
```

**Measure:** Do weaker players still have paths to victory?

### Example: "Synergy Hunting"
*Test: What combos emerge for a specific Emoji Tile?*

```bash
npm run sim --runs 5000 --seed brass-synergies \
  --force-purchase "Brass" \
  --analyze-synergies
```

**Output:** Which jokers/bosses pair with Brass? Frequency?

### Example: "Ante Difficulty Curve"
*Test: Does difficulty scale fairly?*

```bash
npm run sim --runs 5000 --seed ante-curve \
  --analyze-by-ante
```

**Output:** Clear rates and scores broken down by Chapter (1, 2, 3, ..., 8).

---

## Checklist: Before Shipping Sim Results

- [ ] Ran baseline + test with same seed for comparison
- [ ] Ran sufficient samples (min 1,000, ideally 5,000+)
- [ ] Recorded all metrics (median, win rate, variance, top tiles)
- [ ] Interpreted results (is delta significant?)
- [ ] Checked outliers (best/worst cases make sense?)
- [ ] Cross-referenced with game designer intuition
- [ ] Documented findings in design worksheet or PR
- [ ] Attached `[sim-results.txt](/)` to commit for audit trail

---

## Quick Commands Cheat Sheet

```bash
# Basic run
npm run sim --runs 1000

# Force element into shop
npm run sim --runs 5000 --force-purchase "Element Name"

# Tune a number
npm run sim --runs 5000 --balance "path.to.number=value"

# Compare multiple variants
npm run sim --runs 5000 --seed var-a --balance "X=1"
npm run sim --runs 5000 --seed var-b --balance "X=2"

# Analyze distribution
npm run sim --runs 5000 --analyze-histogram

# Verbose logging (debug)
npm run sim --runs 10 --seed debug --verbose

# Parallel (faster)
npm run sim --runs 10000 --workers 8
```

---

**Questions?** Ask Game Designer:
```
@Game Designer How do I interpret this sim result?
@Game Designer Is a +8% median delta significant?
@Game Designer Compare these two sim runs for me
```
