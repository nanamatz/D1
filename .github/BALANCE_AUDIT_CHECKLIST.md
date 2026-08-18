# Balance Audit Checklist

**Purpose:** Monthly/quarterly review of full roster (Emoji Tiles, bosses, consumables) to catch hidden imbalances early. Use this to track power creep, identify underpowered elements, and plan patches.

---

## 📋 About This Checklist

### When to Run
- **Monthly:** Quick audit of top performers + weak elements
- **Quarterly:** Full roster review before major patch
- **On-demand:** After shipping new content, spot-check for balance issues

### What It Measures
- **Power Score:** Normalized metric comparing element strength
- **Frequency:** How often element appears in winning runs
- **Economy Health:** Does the element fit gold/progression curve?
- **Synergies:** Does it enable/break existing combos?
- **Player Satisfaction:** Feedback reports (if available)

### Output
- Overpowered elements (nerf candidates)
- Underpowered elements (buff candidates)
- Underutilized elements (design issues?)
- Emerging synergies (healthy or broken?)

---

## 🎯 Quick Audit (30 min)

### 1. Run Baseline Simulation
```bash
npm run sim --runs 10000 --seed audit
```

**Record:**
```
Date: 2026-08-18
Runs: 10,000
Median Score: 15,243
Win Rate: 62.3%
```

### 2. Extract Top/Bottom Performers

**From sim output, fill in:**

| Rank | Element | Type | Frequency | Avg Bonus | Power Score |
|------|---------|------|-----------|-----------|-------------|
| 1 | Brass | Emoji Tile | 42% | +2,400 | 1010 |
| 2 | Twin (Letter Hand) | Word Hand | 38% | +1,800 | 684 |
| 3 | Magnifier | Emoji Tile | 35% | +1,200 | 420 |
| ... | ... | ... | ... | ... | ... |
| 145 | Worthless Scrap | Emoji Tile | 2% | +50 | 1 |
| 146 | Dead Weight | Consumable | 1% | +10 | <1 |

**Where:**
- **Frequency** = % of winning runs that contain this element
- **Avg Bonus** = average score added when element is present
- **Power Score** = (Frequency × Avg Bonus) / 1000 (normalized)

### 3. Flag Outliers

**Overpowered (Power Score >1000):**
- Brass (1010)
- [Any other elements >900?]

**Underpowered (Power Score <50):**
- Worthless Scrap (1)
- Dead Weight (<1)

**Moderate (Power Score 100–300):**
- Most healthy elements
- No action needed

### 4. Make Notes
```
Observations (2026-08-18 audit):
- Brass still dominates (no change since last month)
  → Consider nerf if win rate creeping up
- New Emoji Tile X showing 180 power score (healthy)
  → Early data looks good, monitor next month
- Consumable Y at 15 power score (very weak)
  → Investigate: is it broken or just niche?
```

---

## 🔍 Full Roster Audit (2–3 hours)

### Section 1: Emoji Tile Roster (34 Common, 57 Uncommon, 54 Rare, 5 Legendary = 150)

#### Tier: Common (Cost $1–3, expect Power Score 30–200)

| # | Name | Cost | Frequency | Power | Verdict | Action |
|---|------|------|-----------|-------|---------|--------|
| 1 | Asteroid Field | $2 | 28% | 84 | ✅ Healthy | Monitor |
| 2 | Twin (Letter Hand) | — | 38% | 684 | ⚠️ Strong | — |
| 3 | Burglar | $3 | 5% | 12 | ❌ Weak | Buff? |
| ... | ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Any Common showing Power >300? (might be too strong)
- [ ] Any Common showing Power <10? (dead design)
- [ ] Are Commons distributed? (or do 5 dominate?)

#### Tier: Uncommon (Cost $4–6, expect Power Score 100–400)

| # | Name | Cost | Frequency | Power | Verdict | Action |
|---|------|------|-----------|-------|---------|--------|
| 1 | Magnifier | $5 | 35% | 420 | ✅ Healthy | Monitor |
| 2 | Brahmagupta (boss) | — | 12% | 180 | ✅ OK | Monitor |
| ... | ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Any Uncommon showing Power >600? (too strong vs. Rare)
- [ ] Any Uncommon showing Power <50? (undiscovered or broken)

#### Tier: Rare (Cost $7–10, expect Power Score 200–700)

| # | Name | Cost | Frequency | Power | Verdict | Action |
|---|------|------|-----------|-------|---------|--------|
| 1 | Brass | $8 | 42% | 1010 | ⚠️ Strong | Watch |
| 2 | [New Tile] | $9 | 18% | 270 | ✅ Healthy | Monitor |
| ... | ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Any Rare showing Power >1200? (overpowered, nerf candidate)
- [ ] Any Rare showing Power <100? (underexplored, buff or design fix?)
- [ ] Compare Rare prices—do expensive ones justify cost?

#### Tier: Legendary (Cost $12+, expect Power Score 400–1500)

| # | Name | Cost | Frequency | Power | Verdict | Action |
|---|------|------|-----------|-------|---------|--------|
| 1 | [Legendary 1] | $12 | 8% | 800 | ✅ Rare | Monitor |
| 2 | [Legendary 2] | $14 | 3% | 450 | ✓ Very Rare | Monitor |
| ... | ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Legendaries should appear in <10% of runs (or they're too common)
- [ ] Power Score 400–1000 is healthy (high power, low frequency = balanced)

---

### Section 2: Boss Roster (15 core + 6 finishers)

#### Core Bosses (Chapters 1–7 at Deadline)

| # | Boss | Appearance | Clear Rate | Notes | Action |
|---|------|-----------|-----------|-------|--------|
| 1 | Wanted | 1/15 chance | 78% | Too easy? | Watch |
| 2 | Letter | 1/15 chance | 62% | Healthy | ✅ |
| 3 | Ancient Paper | 1/15 chance | 55% | Fair | ✅ |
| ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Clear rates should be 50–75% (75%+ = too easy, 40%– = too hard)
- [ ] Any boss with 90%+ clear? Candidate for nerf
- [ ] Any boss with 30%– clear? Candidate for buff or redesign

#### Finisher Bosses (Chapters 8, 16, 24, 32, etc.)

| # | Boss | Ante | Clear Rate | Impact | Action |
|---|------|------|-----------|--------|--------|
| 1 | Cleanings Sign | 8 | 65% | Difficulty spike? | Monitor |
| 2 | Medusa | 16 | 40% | Hard reset (expected) | ✅ |
| ... | ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Finisher clear rates should drop sharply (reflect escalation)
- [ ] Watch for finishers that are unbeatable (>1 in 100,000 runs)

---

### Section 3: Economy Health

#### Gold Flow by Chapter

| Chapter | Avg Gold In | Avg Spending | Avg Gold Out | Health |
|---------|-------------|--------------|--------------|--------|
| 1 | $50 | $20 | $30 | ✅ Healthy |
| 2 | $80 | $40 | $40 | ✅ Tight |
| 3 | $150 | $80 | $70 | ⚠️ Very tight |
| 4 | $200 | $100 | $100 | ❌ Desperate |
| 5 | $300 | $180 | $120 | ✅ Recovers |
| ... | ... | ... | ... | ... |

**Audit Notes:**
- [ ] Does gold ever hit 0 (stuck run)? If yes, economy broken
- [ ] Is there a spike in one chapter? (indicates balance cliff)
- [ ] Healthy pattern: gradual increase with periodic tightness (creates tension)

#### Starting Pouch Impact

| Pouch | Avg Clear Rate | Avg Score | Difficulty | Verdict |
|-------|--------|---------|------------|---------|
| Red (default) | 62% | 15,200 | Normal | ✅ Baseline |
| Purple | 60% | 14,800 | +5% | ✅ Fair |
| Green LP | 48% | 12,500 | +25% | ⚠️ Very Hard |
| Blue | 65% | 15,800 | -5% | ✓ Easier |

**Audit Notes:**
- [ ] Do easy Pouches make win rate >75%? (power creep)
- [ ] Do hard Pouches make win rate <40%? (gatekeeping)
- [ ] Is there a Pouch nobody picks? (design issue)

#### Records (Difficulty Modifiers)

| Record | Clear Rate | Avg Score | Popularity | Verdict |
|--------|-----------|---------|------------|---------|
| White LP (Difficulty 1) | 68% | 14,200 | High | ✅ Entry point |
| Amber LP (Difficulty 2) | 64% | 14,600 | High | ✅ Standard |
| Rough LP (Difficulty 3) | 60% | 15,200 | Medium | ✅ Balanced |
| Deep LP (Difficulty 4) | 54% | 15,800 | Low | ⚠️ Hard jump |

**Audit Notes:**
- [ ] Does difficulty ladder smoothly? (No big gaps)
- [ ] Do harder Records filter out weaker players appropriately?

---

### Section 4: Synergies & Meta Health

#### Emergent Synergies (Good)

```
1. Brass + Word Hand (Twin, etc.)
   Frequency: 12% of runs
   Avg score when paired: +3,200
   Verdict: ✅ Healthy (discoverable, powerful, not required)

2. Magnifier + Long Words
   Frequency: 8% of runs
   Avg score when paired: +1,800
   Verdict: ✅ Good (niche, high skill reward)

3. [New Meta Emerging?]
   Frequency: [X]%
   Verdict: [Monitor or Adjust]
```

#### Potential Issues (Watch For)

```
❌ One-element dominance:
   If Brass appears in >50% of WINNING runs → overpowered
   Action: Nerf or create hard counter

❌ Dead Synergies:
   If Element X appears in <2% of runs AND has no clear niche → design issue
   Action: Buff, redesign, or remove

❌ Redundant Elements:
   If Elements A and B do the same thing → pick winner, remove loser
   Action: Consolidate or differentiate

⚠️ Fragile Meta:
   If top 3 elements represent >60% of wins → narrow metagame
   Action: Buff underdogs or nerf top performers
```

---

### Section 5: Player Feedback Integration

#### Collect Feedback (If Available)
- [ ] Discord reports ("Brass is too strong")
- [ ] VOD analysis (top streamers' builds)
- [ ] Open issues (GitHub / feedback form)
- [ ] Anecdotes from team (playtest observations)

**Template:**
```
Feedback Summary (2026-08-18):
- 3 reports: "Brass trivializes runs"
- VOD analysis: 70% of top-10 runs use Brass
- No bugs reported
- Consensus: Brass needs small nerf

Cross-check with sim:
- Sim says: Brass at Power 1010 (top 1%)
- Feedback says: "Obviously overpowered"
- Alignment: ✅ YES → Proceed with nerf

Recommended action: Reduce Brass mult by 0.1, re-sim
```

---

## 🛠️ Creating Patches

### From Audit to Patch

**Step 1: Identify Problems**
```
Audit findings (2026-08-18):
- Brass (Power 1010) — TOO STRONG
- Burglar (Power 12) — TOO WEAK
- Unopened Letter (bosses) — UNFUN (players report)
- Economy Chapter 4 — TIGHT
```

**Step 2: Propose Fixes**

| Element | Problem | Proposed Fix | Expected Delta |
|---------|---------|--------------|-----------------|
| Brass | Power 1010 | Reduce mult -0.1 | Power → 850 |
| Burglar | Power 12 | Cost -$1 | Power → 50 |
| Unopened Letter | Unfun RNG | Reroll max 2× | Reduce frustration |
| Ante 4 | Tight economy | Clear reward +$20 | +30% gold |

**Step 3: Simulate**
```bash
npm run sim --runs 5000 --seed patch-v2.1 \
  --balance "brass.mult=-0.1" \
  --balance "burglar.cost=1" \
  --balance "anteTargets[3]+=20"
```

**Step 4: Validate**
```
Results:
- Brass Power: 1010 → 840 ✅ (target: 600–800)
- Burglar Power: 12 → 45 ✅ (target: 50–150)
- Ante 4 clear: 55% → 62% ✅ (target: 60%+)
- Overall median: 15,200 → 15,100 (~flat, good)

Verdict: ✅ APPROVE — Ready for v2.1 patch
```

**Step 5: Communicate**
```markdown
# Patch v2.1 Notes

## Balance Changes

**Nerfs:**
- Brass: Mult reduced 0.2 → 0.1 (was too dominant in late runs)

**Buffs:**
- Burglar: Cost reduced $2 → $1 (incentivize exploration)

**Quality of Life:**
- Unopened Letter: Reroll limit increased 1 → 2 (reduce frustration)
- Ante 4 clarity reward: +$20 (ease progression difficulty)

## Forecasted Impact
- Median score: -1% (slight difficulty increase)
- Win rate: flat to +1% (Burglar buff + QoL helps weaker players)
- Meta: More build diversity (Brass less mandatory)
```

---

## 📅 Audit Schedule (Recommended)

### Weekly (15 min)
- [ ] Check sim baseline for anomalies
- [ ] Any hotfix-worthy reports? (broken boss, 100% clear rate?)
- [ ] Yes → Hotfix. No → continue

### Monthly (1 hour)
- [ ] Run quick audit (Section 1: Top/Bottom performers)
- [ ] Update audit checklist
- [ ] Any elements needing immediate attention?
- [ ] Note for quarterly patch planning

### Quarterly (3–4 hours)
- [ ] Full roster audit (Sections 1–5)
- [ ] Synthesize findings into patch plan
- [ ] Propose patch(es)
- [ ] Simulate & validate
- [ ] Ship or iterate

### On-Demand (1–2 hours)
- [ ] After major content drop (new Emoji Tiles, boss)
- [ ] Player reports of imbalance
- [ ] Before marketing milestone (want clean balance)

---

## 🎯 Success Criteria for Healthy Meta

Check these annually:

- [ ] **No single element >60% winrate** (no mandatory picks)
- [ ] **Top 5 elements <80% combined** (diversity exists)
- [ ] **Power Score distribution smooth** (no huge gaps)
- [ ] **All 150 Emoji Tiles used** (nothing dead)
- [ ] **New players win ~50%, Vets win ~70%** (skill expression works)
- [ ] **Economy never starves** (gold flow healthy)
- [ ] **Bosses clear 40–75%** (appropriate challenge)
- [ ] **No exploits** (breakable synergies fixed)

---

## 🔗 Audit Checklist Companion Files

- `.github/design-worksheets/TEMPLATE.md` — When adding new element
- `.github/SIMULATION_COOKBOOK.md` — How to sim during audit
- `.github/agents/game-designer.agent.md` — Ask for deep analysis
- `docs/GDD.md` — Cross-reference design decisions
- `src/engine/balance.ts` — Where you implement changes

---

## ✅ Pre-Patch Checklist

Before committing a patch discovered via audit:

- [ ] Ran sim with all changes (5,000+ runs)
- [ ] Results meet acceptance criteria (delta reasonable)
- [ ] Documented in audit file (for history)
- [ ] Updated GDD (if mechanics changed)
- [ ] Updated BALANCE.ts (values match GDD tables)
- [ ] Patch notes written (explain *why*, not just *what*)
- [ ] Communicated to team (share audit + sim results)
- [ ] Code reviewed (ask @Code Reviewer)
- [ ] Commit message references audit date

---

## Template: Monthly Audit Report

```markdown
# Balance Audit — August 2026

**Date:** 2026-08-18  
**Auditor:** [Name]  
**Runs:** 10,000  
**Median Score:** 15,243  
**Win Rate:** 62.3%

## Findings

### Overpowered (Power >1000)
- Brass (1010) — Consistent from last month
- [Any others?]

### Underpowered (Power <50)
- Worthless Scrap (1)
- Dead Weight (<1)

### Economy Health
- Chapters 1–7: ✅ Healthy
- Chapter 8 (Deadline): ⚠️ Slightly tight
- No starvation reports ✅

### Meta Health
- Top 3 elements: 58% of wins ✅
- Synergies: 5 healthy, 1 emerging
- Player feedback: No critical issues

## Recommendations

### Ship This Month
None (meta stable)

### Monitor for Next Month
- Brass trend (up or down power?)
- New Emoji Tile X adoption

### Plan for Q4
- Brass potential nerf (if feedback intensifies)
- Burglar buff (underpowered since v1.2)

## Signed Off
Design Lead: [Name], 2026-08-18
```

---

**Questions?** Ask Game Designer:
```
@Game Designer Analyze this audit for me
@Game Designer Should I nerf or buff Element X?
@Game Designer Is this meta healthy?
```
