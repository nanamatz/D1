# Design Worksheet Template

**Purpose:** Structured design document for new Emoji Tiles, bosses, consumables, or major mechanics. Use this when proposing any new element.

---

## ✏️ Design Worksheet: [Element Name]

**Date:** [YYYY-MM-DD]  
**Designer:** [Name]  
**Category:** Emoji Tile | Boss | Consumable | Mechanic  
**Proposed Rarity:** Common | Uncommon | Rare | Legendary  
**Status:** ⬜ Concept | 🟨 Design | 🟩 Sim Ready | 🟦 Approved

---

## 1. Concept & Motivation

### Pitch (1–2 sentences)
*What is this element and why does it exist?*

```
[Example]
"Palindromist Ink": A consumable that grants +Mult to any word that reads the same forwards/backwards.
Fills a gap in the Word-Hand tier — short palindromes are rare, so this rewards pattern recognition.
```

### Problem It Solves
*What player gap, mechanic hole, or feedback drove this proposal?*

- [ ] Fills rarity gap (e.g., "No cheap Legendary synergies")
- [ ] Enables new archetype (e.g., "Vowel-heavy builds")
- [ ] Counters overpowered element (e.g., "Checks runaway Brass builds")
- [ ] Adds flavor/uniqueness (e.g., "Thematic word-building feel")
- [ ] Player feedback (link to issue/feedback thread)

### Design Lineage
*What similar elements inspired this? How does it differ?*

```
[Example]
Inspired by: Magnifier (searches best word)
Differs: Palindromist Ink applies a *blanket bonus* to all palindromes,
not a single recommendation. Enables mid-run discovery.
```

---

## 2. Mechanics (Exact Rules)

### Core Ability
*Describe exactly what this element does, in game terms.*

```
[Example – Emoji Tile]
**Palindromist Ink** (Rare, Emoji Tile)
Adds +X Mult for each word in the sentence that is a palindrome.
(A palindrome reads identically forwards and backwards: MOM, NOON, LEVEL.)
```

### Edge Cases & Interactions
*What happens when X meets Y? Any weird interactions?*

- [ ] Works with gibberish? (Usually no; specify if yes)
- [ ] Stacks with other multipliers? (yes/no; which?)
- [ ] Affected by modifiers (materials, fonts, editions)? (how?)
- [ ] Boss interaction? (any special rules?)
- [ ] Hooks/events needed? (add to pipeline if missing)

### GDD Alignment
*Cross-reference GDD sections that govern this element.*

- **GDD §:** [e.g., §11.8 for Emoji Tile layering]
- **Rule:** [e.g., "Emoji Tiles layer-2 jokers fire on valid words only"]
- **Constraint:** [e.g., "No ownership duplication (except Copy Editor)"]

### Pseudo-Code (If Complex)
*For complex mechanics, pseudocode helps clarity.*

```typescript
// Example: Palindrome detection
function isPalindrome(word: string): boolean {
  const clean = word.toLowerCase().replace(/\s+/g, '');
  return clean === clean.split('').reverse().join('');
}

// Example: Mult application
if (isPalindrome(word)) {
  wordMult += BALANCE.palindromistInk.multPerWord;
}
```

---

## 3. Balance Framework

### Rarity & Cost
*What rarity tier? How much does it cost or occupy?*

| Attribute | Value | Reasoning |
|-----------|-------|-----------|
| **Rarity** | Rare | [e.g., "Niche effect; high upside for vowel-heavy words"] |
| **Cost** | $X | [e.g., "Compare to X (cost $Y), Y (cost $Z)"] |
| **Joker Slot** | 1 | [Standard for all Emoji Tiles] |
| **Edition Affected** | Base/Gray/Violet/Rainbow | [if applicable] |

### Power Budget (Analogues)
*Compare this to 2–3 similar entries. Where does it fit?*

```
Comparison Table:

Element          | Type   | Rarity | Cost | Effect                    | Power Level
-----------------|--------|--------|------|---------------------------|-------------
Word Lens        | Joker  | Common | $5   | +1 Mult per letter        | Low (scales with word)
Magnifier        | Joker  | Rare   | $8   | Suggest best word         | Medium (info)
Palindromist Ink | Joker  | Rare   | $8   | +X Mult per palindrome    | [TBD]
Grand Palindrome | Hand   | —      | —    | Score bonus for 7+ letters| Knowledge tier

Verdict: Palindromist Ink sits at **Rare cost ($8), Medium power**.
Comparable to Magnifier (info value) + Pattern Hand bonus (structure reward).
Not overpowered.
```

### Synergies
*What existing elements does this combo with?*

#### Positive Synergies (Good)
- **Word-Hand: Grand Palindrome** — "Palindromist Ink pays double bonuses to 7+ letter palindromes"
- **Stella (Emoji Tile)** — "Palindrome detection + Stella's word-length bonus = strong mid-run synergy"
- **Pouch: Green LP** — "Word-length scaling favors long words; palindromes are often longer"

#### Negative Synergies (Edge Cases)
- **Unopened Letter (boss)** — "Discards may remove vowels; hampers palindrome discovery"
- **Letter Hand: Vowelless** — "Incompatible; palindromes usually need vowels"

#### No Synergy (Neutral)
- Most sentence patterns don't interact
- Suit multipliers stack normally

### Counter-Play
*What stops this from becoming unstoppable?*

- [ ] Palindromes are rare (NOON, LEVEL, KAYAK, CIVIC)
- [ ] English has ~200 common palindromes; limits ceiling
- [ ] Sentence patterns may override (highest-pattern-only rule)
- [ ] Design constraint: Palindromic sentences are nearly impossible in English
- [ ] Player skill gate: Requires vocabulary of palindromes

---

## 4. Economy (Gold, Progression)

### Starting Economy
*If this is a consumable, how does it enter the pouch/shop?*

- [ ] Starter Pouch entry? (Which Pouch?)
- [ ] Shop purchase? (Cost: $X)
- [ ] Pack drop? (Rarity weight, pack type)
- [ ] Earned reward? (Which blind clear?)

### Scaling With Ante
*Does cost/value scale? How does difficulty affect it?*

| Ante | Suggested Value | Rationale |
|------|-----------------|-----------|
| 1–2 | $8 (Rare) | Low stakes; accessible discovery |
| 3–5 | $10 (Rare) | Ante scaling ~1.15× per chapter |
| 6–8 | $12 (Rare) | Late-game; synergies matter more |

### Interactions With Economy
- [ ] Does this compete for gold with other purchases?
- [ ] Does this enable a new spending pattern?
- [ ] Is it "always buy" or "situational"?

---

## 5. Simulation & Validation

### Simulation Plan
*How will you measure if this is balanced?*

```
Test Matrix:

Scenario 1: Vanilla run (no Palindromist Ink)
- Baseline median score: 15,000
- Baseline win rate: 60%

Scenario 2: Guaranteed Palindromist Ink (force into shop, Chapter 1)
- Expected median: +[X]% (e.g., +15% = 17,250)
- Expected win rate: 60–65%

Scenario 3: With Grand Palindrome combo
- Expected median: +[Y]% (e.g., +30% = 19,500)
- Expected win rate: 65–70%

Acceptance Criteria:
✓ No scenario breaks win rate > 75% (power creep)
✓ Median scales linearly with ante (no cliff)
✓ Synergies are real but not guaranteed (player skill matters)
```

### Running the Sim
```bash
# Force Palindromist Ink into first shop of every run
npm run sim -- --runs 5000 --force-purchase "Palindromist Ink"

# Measure:
# - Median score
# - Win rate
# - Frequency of Grand Palindrome discovery (if applicable)
# - Gold flow (does gold accumulate or get spent predictably?)
```

### Simulation Results (To Be Filled)

| Metric | Baseline | With Element | Delta |
|--------|----------|--------------|-------|
| Median Score | 15,000 | [TBD] | [TBD] |
| 95th Percentile | 30,000 | [TBD] | [TBD] |
| Win Rate | 60% | [TBD] | [TBD] |
| Avg Gold End-Blind | $50 | [TBD] | [TBD] |

**Sim Output Summary:**
```
[Paste key metrics from sim run here]

Example:
Ran 5,000 plays with Palindromist Ink forced.
Median: 16,200 (+8% vs baseline)
Win rate: 62% (+2% vs baseline)
Conclusion: Healthy power level; no creep detected.
```

---

## 6. Implementation Checklist

### Code Changes
- [ ] Add entry to `src/engine/balance.ts` (BALANCE.[element])
- [ ] Create `src/engine/[category]/[name].ts` (if Emoji Tile: `src/engine/jokers/[name].ts`)
- [ ] Register in index (e.g., `src/engine/jokers/index.ts`)
- [ ] Add to lexicon/collection if applicable
- [ ] Update `src/ui/art/[category]/[name].png` (pixel art, 124×165px)

### Documentation
- [ ] Update `docs/GDD.md` (add to roster table, §11)
- [ ] Add to `BALANCE.ts` comments (source: GDD section)
- [ ] Add locale strings (`locales/en.json`, `locales/ko.json`)
- [ ] Tooltip/help text in UI

### Testing
- [ ] Unit tests: `tests/[element]-mechanics.test.ts`
- [ ] Simulation: `npm run sim -- --force-purchase "[Name]"`
- [ ] Integration test: Does it combo correctly with synergy list?
- [ ] Edge case: Does gibberish break it?

### Before Commit
- [ ] GDD updated and cross-referenced
- [ ] CLAUDE.md reviewed (any new principles?)
- [ ] BALANCE.ts numbers match GDD tables
- [ ] Code Review Agent: `@Code Reviewer src/engine/jokers/[name].ts`
- [ ] Game Designer: `@Game Designer Validate [Element Name] balance`

---

## 7. Design Review Checklist

### Self-Review (Before Sharing)
- [ ] **Is it simple?** (Can a new player understand it in <10 seconds?)
- [ ] **Is it unique?** (Does it feel like a new tool, not a reskin of existing joker?)
- [ ] **Is it fair?** (No single-element guaranteed wins?)
- [ ] **Is it fun?** (Does it unlock new strategies or feel gimmicky?)
- [ ] **Does it fit the game?** (Balatro DNA: short runs, high variance, synergies matter?)

### Design Questions (Answer in Comment Thread)
1. **"Why does this exist vs. just buffing an existing element?"**
2. **"What's the worst-case score with this? Best case?"**
3. **"Is it interesting on turn 1? Turn 100?"**
4. **"Does it create a new player vs. veteran skill gap?"**
5. **"Can it be nerfed easily if OP?"** (Tunable, not hardcoded?)

### Submission Checklist
- [ ] All sections filled (Concept through Simulation)
- [ ] Sim results included (or plan to run them)
- [ ] GDD section cited
- [ ] At least 2 analogues compared
- [ ] Synergy table complete
- [ ] Art ready (pixel-art, 124×165px)

---

## 8. Approval & Sign-Off

### Design Lead Review
- **Lead Designer:** [Name]
- **Decision:** ⬜ Approved | 🟨 Needs Revision | ❌ Rejected
- **Feedback:**
  ```
  [Review notes, concerns, suggestions]
  ```

### Revision History
| Date | Version | Change | Status |
|------|---------|--------|--------|
| 2026-08-18 | v1.0 | Initial design | Concept |
| [Date] | v1.1 | [Change description] | [Status] |

---

## 📝 Exemplar: "Brass" (Emoji Tile, Legendary)

**Concept:**
"Brass is a Legendary Emoji Tile that multiplies the run's total Mult by +X at round end."

**Mechanics:**
- Adds a global Mult multiplier when acquired
- Stacks multiplicatively with sentence Mult
- Only one Brass per run can be owned (unique ownership rule)

**Balance:**
- Rarity: Legendary ($14, highest cost)
- Synergy: Multiplicative stacking → runaway builds possible
- Counter: Single-unit limitation + high cost makes it rare discovery

**Sim Results:**
- Baseline: 15,000 median
- With Brass: 24,000 median (+60%)
- Win rate: 60% → 72%
- Verdict: Powerful but justly rare; gates strong builds behind late-game discovery

**Sign-Off:**
Lead Designer approved v1.0 on 2026-07-15. Shipped in main.

---

## 🚀 Template Usage Instructions

1. **Copy this section into a new file:** `.github/design-worksheets/[element-name].md`
2. **Fill every section:** Concept → Simulation → Approval
3. **Get sim results:** Run `npm run sim` with force flags
4. **Share for design review:** PR with worksheet attached
5. **After approval:** Implement code changes + GDD updates
6. **Move to Archive:** `.github/design-worksheets/archive/[element-name]-approved.md` after ship

---

**Questions?** Ask Game Designer agent:
```
@Game Designer How do I fill the Balance Framework section?
@Game Designer What's a realistic sim delta for a Rare Emoji Tile?
@Game Designer Review my design worksheet for [element]
```
