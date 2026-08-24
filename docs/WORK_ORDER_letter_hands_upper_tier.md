# Work Order — Letter Hands Upper Tier

**Status: implemented 2026-08-12 after review against the live GDD and engine.**

Adds **three knowledge-tier Letter Hands** above the existing six, implements the two missing Emoji Tile unlocks the expansion exposes, and parks the build-tier overlay with its decisions already recorded so it can be picked up without re-litigating.

Scope note: the **판형 오버레이 (build-tier overlay — material/font/edition uniformity)** is **deferred, not rejected**. Section D preserves it. Do not implement Section D.

All numbers land in `balance.ts`. Apply the spec-conflict protocol: every change below lands in the docs in the same pass (Section E).

---

## A. Three new Letter Hands

Each new hand is the **extreme end of a hand players already know**, so no new concept enters the rulebook:

- **무모음 (Vowelless)** — the opposite pole of Vowel Flush
- **활자 절약 (Type Economy)** — the opposite pole of Twin/Triplet, and a superset of Longword
- **대회문 (Grand Palindrome)** — the top end of Palindrome

### A-1. The table (extends the existing 6, weak → strong)

| # | 족보 / Hand | Condition | Example | Base bonus | Gibberish |
|---|---|---|---|---|---|
| 1 | 쌍둥이 / Twin | *(unchanged)* | BO**OK** | +15 Chips, ×1 Mult | ✗ |
| 2 | 긴 단어 / Longword | *(unchanged)* | LETTER | +30 Chips, ×2 Mult | ✗ |
| 3 | 트리플렛 / Triplet | *(unchanged)* | B**ANANA** | +45 Chips, ×2 Mult | ✗ |
| 4 | 회문 / Palindrome | *(unchanged)* | LEVEL | +45 Chips, ×3 Mult | ✗ |
| 5 | 모음 플러시 / Vowel Flush | *(unchanged)* | SEQUOIA | +75 Chips, ×4 Mult | ✓ |
| 6 | 스트레이트 / Straight | *(unchanged)* | QRSTU | +90 Chips, ×5 Mult | ✓ |
| **7** | **활자 절약 / Type Economy** | **≥8 physical letters, zero repeated letters** | DIALOGUE, FLOWCHART, BACKGROUND | **+105 Chips, ×6 Mult** | **✗** |
| **8** | **무모음 / Vowelless** | **No A/E/I/O/U; physical length ≥5 under live Y classification** | CRYPT, NYMPH, RHYTHM, SYZYGY | **+120 Chips, ×7 Mult** | **✗** |
| **9** | **대회문 / Grand Palindrome** | **≥7 physical letters, palindromic** | ROTATOR, DEIFIED, REVIVER | **+150 Chips, ×8 Mult** | **✗** |

Chips add and Mult multiplies inside `WordScoringContext`, matching the live six-hand formula. The "highest hand only" rule is unchanged — see A-4.

### A-2. Vowelless — vowel definition is a lookup, not a new constant

**Do not introduce a new vowel set for this hand.** Read the game's existing vowel/consonant classification (the one driving the vowel/consonant tile tinting) and branch the length threshold off it:

| If the existing definition treats Y as… | Minimum length | Resulting word pool |
|---|---|---|
| **Consonant** | **5** | CRYPT, GLYPH, LYMPH, NYMPH, TRYST, SYLPH, MYTHS, RHYTHM, SYZYGY, RHYTHMS — a real but small pool; "knowing it" is the skill being rewarded |
| **Vowel** | **3** | SHH, BRR, HMM, PSST, NTH, CWM, CRWTH — a much smaller pool; a near-miracle hand |

The implementation branches from the single shared constant so the hand cannot drift out of sync with tile tinting. The live branch is **Y=consonant** and has **60** qualifying shipped words; the hypothetical Y=vowel branch has **17**.

Vowel Flush (#5) and Vowelless (#8) are now the two poles of one axis, and #8 is the payoff the consonant-bricklayer build and the 외마디 sentence pattern (SHH/BRR) have been missing at the word layer.

### A-3. Gibberish is disallowed on all three — this is load-bearing

Hands 7–9 are **valid-dictionary-word only**. This is not a balance preference; each collapses instantly without it:

- Vowelless → dumping BCDFG is a jackpot
- Type Economy → dumping any 8 distinct tiles is a jackpot
- Grand Palindrome → ABCBA is trivially constructible from hand

This follows the same reasoning that put ✗ on hands 1–4. Hands 5 and 6 keep their existing ✓ (confirmed intentional).

### A-4. Priority and collisions

Rank comparison is strictly **9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → 1**. The existing registry scan remains index-independent and selects the highest matching rank.

Verified collision behavior:

- **대회문 ⊃ 회문, 긴 단어** — a 7+ palindrome also satisfies #4 and #2. Superset relation, resolves naturally at #9.
- **활자 절약 ⊃ 긴 단어** — 8+ letters also satisfies #2. Resolves at #7.
- **활자 절약 ⊥ 대회문/쌍둥이/트리플** — mutually exclusive by definition (any palindrome of length ≥2 repeats a letter). No ordering ambiguity.
- **활자 절약 vs 모음 플러시/스트레이트** — orthogonal overlaps resolve only to #7; shadowed hand-specific effects do not fire.
- **무모음 vs 긴 단어/트리플렛** — #8 wins; `SYZYGY` is the headline Triplet collision.
- **무모음 vs 스트레이트** — a gibberish straight fails #8's valid-word gate, so it lands on #6 as before.

### A-5. Leveling — superseded by the shipped Proof Stamp system

All nine Letter Hands now have run-only levels per GDD §5.5. Cleared blinds award
Proof Stamps, level thresholds scale from 1 to 3 to 5 stamps, each level adds the
hand's rank-band Chips increment, and every third gained level adds ×1 Mult. The
original static-only decision in this work order is retained only as history.

### A-6. Discovery — hidden until first completed

Hands 7–9 render as `???` in both Run Info and the staged-word sidebar status until first completion. The successful settle stamp reveals the real name, which is then stored permanently in that profile's `wj.lifetime`. Reveal All discovers all three.

Hands 1–6 remain visible from the start.

---

## B. Emoji Tile fixes this expansion forces

### B-1. `handScholar` unlock is now implemented

`handScholar` unlocks on **"한 번의 런에서 서로 다른 단어 족보 8종 완성."** The requested condition was absent from the live unlock registry and could not have been satisfied by the former six-hand roster. Nine hands makes the implemented target reachable and demanding (it requires two of the three new upper-tier hands in a single run).

The live implementation previously had no `handScholar` unlock gate. This pass adds the eight-distinct-hands one-run target and locale copy. Its scoring factor remains explicitly capped at ×4 so the larger registry does not silently buff the tile to ×5.5.

### B-2. Palindrome-family Emoji Tile inheritance

The former `palindromist` implementation and its unlock were later retired as a duplicate condition. Mirror Image now owns the contained-Palindrome condition and therefore also fires for Grand Palindrome, independently of which hand wins the base-score comparison.

Audit the same pattern across all Emoji Tiles: any tile keyed on a specific hand type needs checking against its new supersets. `longFormSerial` is keyed on letter count rather than hand type, so it is unaffected; confirm the rest.

### B-3. Vowelless has no Emoji Tile counterpart

Hand #8 ships without a dedicated tile; a Vowelless counterpart is a follow-up design item, not part of this work order. Vowel Symphony was later retired because Gathering duplicated its Vowel Flush multiplier role.

---

## C. Lexicon verification (do this before tuning)

Counts against the shipped 172,255-entry lexicon (the four curated MVP/VIP noun surfaces add no candidates here):

1. Vowelless: **60 live Y=consonant / 17 hypothetical Y=vowel**
2. Words of ≥8 letters with zero repeated letters: **10,164**
3. Palindromes of ≥7 letters: **7**

A seeded 100,000-hand scan of the baseline 10-tile pouch found a perfect-solver candidate in about **7.56% Type Economy / 1.56% Vowelless / 0.017% Grand Palindrome** of opening hands. That evidence is why Type Economy now ranks below Vowelless.

---

## D. PARKED — 판형 오버레이 (build-tier overlay). Do not implement.

Deferred by decision. Recorded so it can resume without re-deciding:

**Concept.** Material, font, and edition uniformity as a **second overlay layer** on the word — mirroring how register tone overlays sentence patterns. One Letter Hand (spelling axis) + one 판형 bonus (tile axis) apply together, so the two never compete for the "highest hand only" slot.

- **통일판 (Uniform Set)** — ≥5 letters, one of the three axes entirely a single non-base value. Additive bonus. **Valid dictionary words only** (decided).
- **완본 (Complete Set)** — ≥5 letters, all three axes entirely uniform and non-base. Multiplicative (×). **Gibberish allowed** (decided) — deck-construction cost is already the gate.

**Why it was proposed:** the three-axis enhancement system currently touches Emoji Tiles only and never reaches the hand layer, so deck construction has no hand-level goal. 완본 is this game's Flush Five position.

**Known conflict to resolve on resume:** `materialPrism` and `typeOrchestra` reward axis *diversity* within a word, the direct opposite of 통일판/완본. Viable as an exclusive build fork, but it must be an explicit decision.

---

## E. Document sync

Land in the same pass:

- **GDD** — synchronized with all nine hands, collision policy, discovery, unlocks, and lexicon evidence.
- **screens-spec** — synchronized with nine rows, `???` masking, sidebar behavior, and bounded short-viewport scrolling.
- **Emoji Tile spec/GDD** — records contained-hand inheritance and Hand Scholar unlock/cap.
- **balance.ts** — owns every rank, Chips/Mult value, and all physical-length/Y-branch thresholds.
- **AGENTS.md / CLAUDE.md** — easy-to-miss Word-Hand rules updated; no new save key was added.

---

## Report back

1. **Y is a consonant**; lexicon counts are recorded in Section C.
2. Letter Hands have **no leveling path** today.
3. The duplicate-condition cleanup later retired Palindromist, Straight Shooter, Letter Ladder Badge, Twin Peaks, Threefold Seal, and Vowel Symphony. Mirror Image, Straight Talk, Ambidextrous, Third Party, and Gathering now own those contained-hand conditions; Long-form Serial remains distinct because it scales per letter beyond the Longword threshold.
