# Play the Wor!d

**Word-combination roguelite — Game Design Document**
*Balatro-inspired word-building roguelite*

Version 0.2 — systems expansion

**Changelog v0.1 → v0.2**

- Terminology corrected: **blind** = one round; **ante** = 3 blinds (Small → Big → Boss). Former uses of "ante" in the scoring pipeline now read "blind".
- New: **Sentence Pattern Table** (the game's "poker hand table") — 8 patterns, matching rules, Unison bonus. Tone-overlay concept from v0.1 §4.1 Level 2 replaced by the single Unison rule (design diet).
- New: **Core Loop** chapter — hand size, draw/refill, discard budget, gibberish submission (b-2), no minimum word length.
- New: **Blinds, Antes & Bosses** — scaling, run length, boss pool (12 + 2 finishers). Blind skip / tags: adoption itself deferred.
- New: **Shop & Economy** — money sources, interest, shop layout, packs, 9 vouchers.
- New: **Consumables** — 3 families: Stationery (Tarot-equiv.), Punctuation (Planet-equiv.), Forbidden Books (Spectral-equiv.).
- Jokers: #32 renamed Ellipsis → **Elision** (name ceded to the Punctuation consumable). Added **#46 Hypocrite** (demoted from base rule to joker).

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tile System](#2-tile-system)
3. [Register Suit System](#3-register-suit-system)
4. [Part-of-Speech / Sentence System](#4-part-of-speech--sentence-system)
5. [Sentence Pattern Table](#5-sentence-pattern-table)
6. [Core Loop: Phases, Hand & Discard](#6-core-loop-phases-hand--discard)
7. [Scoring Pipeline](#7-scoring-pipeline)
8. [Blinds, Antes & Bosses](#8-blinds-antes--bosses)
9. [Shop & Economy](#9-shop--economy)
10. [Consumables](#10-consumables)
11. [Jokers (Emoji Tiles)](#11-jokers-emoji-tiles)
12. [Open Questions & Next Steps](#12-open-questions--next-steps)

---

## 1. Overview

**Core concept.** A roguelite where you score with *word combinations* instead of poker hands. Players use *alphabet tiles* instead of cards, and the structure of Balatro — deck, suits, enhancements, jokers, blinds, antes — is ported into the grammar of a word game. Built on a Scrabble-style letter-scoring base, it differentiates itself with two meta-layers Balatro does not have: the **register suit** and the **part-of-speech / sentence system**.

**Language.** English (confirmed).
**Art direction.** Pixel-art with a CRT finish, in the Balatro lineage (the earlier "ceramic letterpress, deliberately un-Balatro" direction is retired). Tile materials/fonts (§2.2–2.3) and the publishing-world fiction (§1.2) are unchanged in *design* — only their *rendering style* is pixel-art. Full visual spec in `docs/UI_DESIGN.md`; a pixel-art shop mascot — 삐약이 (Piyak), the tuxedo cat proprietor — lives in the Stationery Shop (art: docs/Piyak.png).
**Special characters.** Excluded as playable tiles (punctuation returns as a consumable family; see §10). *Re-examined and re-affirmed in playtest-05 D:* wildcard/blank tiles and `?`/`!` mood-marker tiles were both explored and **dropped**, because each duplicated a system we already have — wildcards overlap the Carving Knife consumable (letter change) and the pouch's draft-flavored sculpting; mood markers overlap the Punctuation consumables (which already map `!`→Imperative and reserve `?`→Interrogative) and would force a large change to the §5 pattern system. Revisit only if a concrete need appears that no existing system covers.

### 1.1 Balatro → This Game Mapping

| Balatro | This Game | Notes |
|---|---|---|
| Deck / Cards | Alphabet tiles (the "bag") | Scrabble-style per-letter score & count; 68 tiles (§2.1) |
| Suits (♠♥♦♣) | 4 register suits | Formal / Standard / Slang / Vulgar — asymmetric |
| Enhancement | 8 tile materials | Ceramic (base) + Porcelain, Polished, Glass, Stone, Lead plate, Ivory, Brass |
| Edition / Seal | 5 letter fonts | Futura Medium (base) + 4 styles |
| Joker | Emoji tiles | 4 rarities + Legendary; shop purchase/draw; rule-breaking |
| Hand (play) | Phase | Base 4 per blind; variable via jokers/vouchers |
| Discard | Discard | Budget per blind; discarded tiles exit for the blind |
| Poker hand table | Sentence pattern table | POS sequence matching (§5) |
| Flush | Unison bonus | All words in the sequence share one suit |
| High card | Gibberish submission | Non-word tile dump; letter chips only |
| Blind (Small/Big/Boss) | Blind | One round: phases + discard budget + target score |
| Ante | Ante | 3 blinds; base target rises per ante |
| Tarot cards | Stationery | Tile modification consumables |
| Planet cards | Punctuation | Sentence-pattern level-up consumables |
| Spectral cards | Forbidden Books | Drastic high-risk consumables |
| Vouchers | Vouchers | Permanent upgrades; single tier (9 items) |
| Blind skip / Tags | — (deferred) | Adoption itself on hold; revisit if early-run recovery proves weak |

### 1.2 Fiction & Glossary — the publishing frame (playtest-03 A)

The fiction: **you are a writer**. Poker/Balatro structure terms are re-skinned into a publishing vocabulary; **Chips/Mult stay** (functional clarity). **Display strings only** — code identifiers (`blind`, `ante`, `BlindKind`…) are unchanged; the glossary lives in i18n (`ko.json`/`en.json`). Renaming engine identifiers would be churn with no player value.

| Concept (code) | Korean | English | Notes |
|---|---|---|---|
| run | 집필 | Run | flavor only; "run" fine in en |
| ante | **장** | **Chapter** | "1장 / 8장", escalating targets |
| small blind | **초고** | **Draft** | |
| big blind | **퇴고** | **Revision** | |
| boss blind | **마감** | **Deadline** | the editors come to judge |
| money (`gold`) | **원고료** | **Fee** | `$` symbol stays |
| Cash Out screen | **원고료 정산** | **Fee Settlement** | |
| shop | **문방구** | **Stationery Shop** | |
| bag/deck | **보따리** | **Pouch** | in-run tile pouch |
| stakes (deferred) | **잉크색** | **Ink** | red ink = the editor's pen; see §12 |

---

## 2. Tile System

A tile is the smallest unit of the game. Each tile is one alphabet letter (the sole exception being Stone, which has none — §2.2) and carries two **intrinsic attribute axes** plus two **modifier layers**.

- **Intrinsic axis 1 — Uppercase / Lowercase**
- **Intrinsic axis 2 — Vowel / Consonant**
- **Modifier layer A — Material:** the enhancement slot
- **Modifier layer B — Font:** the edition/seal slot

> **Design note — axis and layer independence.** Just as Balatro stacks an enhancement (e.g. Glass) and an edition (Foil/Holo) on a single card, this game can assign [1 material × 1 font] to a single tile simultaneously. The 8×5 = 40 combinations are the core engine of build variety.

> **Design note — two layers, not three.** Balatro has *three* modifier concepts: enhancement, edition (Foil/Holo/Poly), and seal (Red/Blue/Gold/Purple). We fold edition and seal together into the font layer (§2.3), so Balatro concepts do not map one-to-one and must be assigned a home deliberately. Standing assignment: **retrigger is a seal, and therefore belongs to fonts, never to materials** — this is why Lead plate takes the probabilistic role rather than the reprint-the-tile role its name would suggest (§2.2).

**Tile permanence.** Tiles are permanent assets, like Balatro's deck cards. Tiles submitted during a blind are consumed for that blind and return to the bag when the blind ends. The bag is sculpted across a run via packs (add) and consumables (remove/transform) — see §9–10.

### 2.1 Per-Letter Score & Count (rebalanced — diverges from Scrabble on purpose)

Letter **scores** stay Scrabble-standard, but the **counts** were rebalanced (playtest-04 C-2, chosen by `src/sim/tile-pool.ts`): the bag shrank **98 → 68** and its extremes were **compressed** — the E-glut cut (12 → 6) and rare letters raised (1 → 2). Scrabble's distribution assumes board-adjacency; standalone-word spelling wants a flatter curve. Blanks excluded.

| Score | Letters (count) | Tiles |
|---|---|---|
| 1 pt | E×6, A×5, I×5, O×4, U×3, N×3, R×3, T×3, L×2, S×2 | 36 |
| 2 pt | D×2, G×2 | 4 |
| 3 pt | B×2, C×2, M×2, P×2 | 8 |
| 4 pt | F×2, H×2, V×2, W×2, Y×2 | 10 |
| 5 pt | K×2 | 2 |
| 8 pt | J×2, X×2 | 4 |
| 10 pt | Q×2, Z×2 | 4 |
| **Total** | — | **68** |

**Why (sim, 4000 hands @ hand 11):** vs. the old 98-tile bag, rare letters now appear **~2× as often** per hand (1.24 → 2.57), so deck-building and rare-letter payoffs gain traction; the longest makeable word stays healthy (6.9 → 6.2 letters) and the gibberish-forced rate stays near zero (0.1% → 0.3%). Connected knobs (hand size, target curve, Epic-Poet/pouch-depletion cap) get retuned against sim drift as needed.

**Note.** Y is treated as a consonant under the traditional classification (vowel/consonant axis). Room is left to handle it as a semivowel exception in specific jokers or sentence judgments.

> **Bag-size note.** The rebalanced 68-tile bag (C-2) sits between Balatro's 52-card deck and the old 98. Adding a few tiles now moves the odds more than at 98; **thinning** still buys draw consistency but with less glut to cut. Adding lives in the shop (packs); removal is deliberately reserved for consumables (Eraser, §10).

### 2.2 Materials (Enhancement Layer)

| Material | Korean | Effect | Balatro source |
|---|---|---|---|
| Ceramic | 세라믹 | Base — un-enhanced baseline tile | plain card |
| Porcelain | 자기 | **+30 Chips** | Bonus |
| Polished | 연마 | **+4 Mult** | Mult |
| Glass | 유리 | **×2 Mult**, 1/4 chance to destroy the tile after the word settles | Glass |
| Stone | 석재 | **+50 Chips, no letter** (see below) | Stone |
| Lead plate | 연판 | **1/5 → +20 Mult; 1/15 → $20** (independent rolls) | Lucky |
| Ivory | 상아 | **$3** if held in hand at blind end | Gold |
| Brass | 황동 | **×1.5 Mult** while held in hand | Steel |

Effects are **per tile** and stack: three Porcelain tiles in one word give +90 Chips; two Ivory tiles held at blind end pay $6.

**Risk budget: Glass only.** Every other material is pure upside. Stone's letter loss is a trade-off known at the moment it is applied, not a gamble, so it does not break this rule. A destroyed Glass tile leaves the run permanently.

**Numbers are Balatro's, verbatim, on purpose.** They are a validated reference point to tune *from*, not a claim that they fit our scale — our letter chips are Scrabble values ("TASTE" = 5 Chips) and our hand is 11 tiles against Balatro's 8, so per-tile effects amplify far harder here. Three predicted breakages are recorded for `src/sim` to measure: Brass compounding (≈×11 off ~6 held tiles), Porcelain over-tuning, and the economy values (Ivory/Lead plate) surviving unscaled because our gold scale already matches Balatro's. See `docs/superpowers/specs/2026-07-17-tile-materials-design.md`.

**Why there is no Wild material.** Balatro's Wild card ("counts as any suit") has no translation here: **suit is a property of the word, not the tile** — the lexicon assigns it (§3.1). A tile has no suit to widen. Dropping it is what lets Balatro's 8 enhancements fit our 7 effect slots.

**Stone has no letter.** Our analog of Balatro Stone's "no rank or suit" is *no letter*: `material = stone` ⟺ the tile carries no letter. A stone tile therefore cannot spell, so any word containing one fails the lexicon lookup and resolves as **gibberish** (§6.4) — chips × 1.0, no suit multiplier, always submittable. This is deliberate, and it is what stops Stone from being strictly the best tile in the game: if stone were merely skipped while spelling, `stone+C+A+T` would read "CAT" and collect +50 Chips *and* the suit multiplier. The consequence is that Stone becomes the heart of the gibberish archetype — an identity that falls out of our own rules rather than being imported. A stone is **neither vowel nor consonant** (§2.1), so vowel/consonant jokers must skip it.

**Acquisition:** materials enter play two ways — pre-attached on tiles found in Letter Packs (§9.3), or applied by the Kiln consumable (§10.1). Applying Stone via Kiln destroys that tile's letter permanently.

### 2.3 Fonts (Edition Layer)

| Font | Position |
|---|---|
| Futura Medium | Base |
| Futura Light Italic | Edition |
| Futura Bold | Edition |
| Futura Inline | Edition |
| Futura Black | Edition |

**Acquisition:** pre-attached in Letter Packs, or applied by the Fountain Pen consumable (§10.1).

**Effects: undefined (§14).** Unlike materials (§2.2), the five fonts carry no effects yet — they are visual-only. Two constraints are already fixed for whoever designs them: this layer absorbs *both* of Balatro's edition and seal concepts (§2 design note), and **retrigger is reserved for it** — materials deliberately left it unspent.

> **Decision — fonts unified as style variants within the Futura family.** A font functions as a visual signal that "this tile has a special effect." Weight/italic/inline variants within one family are instantly distinguishable from a single glyph while keeping the screen's tone coherent. Mixing distinct typefaces blurs the information axis ("is this a different font, or a different letter/material?"), so it is avoided. Room is left to give only the top rarity an exceptional emphasis. (License note: Futura is a paid commercial font. Prototype-stage alternatives — Jost, Spartan, Century Gothic family.)

---

## 3. Register Suit System

A completed word is classified into one of 4 types, like a Balatro suit. The classification axis is **register alone**, so the categories are mutually exclusive. This suit is the basis of the conditional penalty/bonus mechanics.

### 3.1 The Four Suits and Base Multipliers

| Suit | Character | Rarity | Base multiplier (placeholder) | Position |
|---|---|---|---|---|
| Standard | Everyday vocabulary | Overwhelming majority | ×1.0 | Safe main line |
| Formal | Academic / literary | Fewer than majority | ×1.5 | Mid-game main candidate |
| Slang | Colloquial / informal | Few | ×2.0 | Strong when combined with jokers |
| Vulgar | Profanity / taboo | Fewest | ×3.0 | High-risk jackpot |

> **Key design — Balatro suits are "symmetric," this game's are "asymmetric."** Balatro's 4 suits have equal counts in the deck, so no base-multiplier difference is applied. This game's suits differ in *how easy they are to make* (Standard common → Vulgar rare). Treating this asymmetry as a resource rather than a defect, harder-to-make suits get higher base multipliers, embedding a risk-reward curve into the suit structure itself. On top of that, "suit-pushing jokers" (layer 2) recreate Balatro-style build bias.

> **Balance warning — keep the multiplier curve gentler than the rarity.** If Slang/Vulgar appear *too* rarely while only their multipliers are high, players will treat them as "suits I can't make anyway" and ignore them. Keep the multiplier gentler than the data rarity to hold the line at "hard but worth attempting." Vulgar has extremely few words, so design it not as a main build but as a "jackpot that explodes when conditions align," balanced by an adversarial relationship with censor-type bosses.

### 3.2 Register Data Acquisition Pipeline

A "clean English word set with register labels" does not exist. So this is a problem of *assembly*, not download. Target precision is set to a casual "roughly correct" level.

- **Standard is a default, not a label.** Do not classify the whole dictionary. Pick out only the non-standard (Formal, Slang, Vulgar) and drop everything else into Standard, cutting the workload by tens of times.
- **Separate validity (layer 1) from suit (layer 2).** Valid-word judgment is solved via an open word-list HashSet (ENABLE/TWL, etc.). Suit lookup is a separate table above it.
- **Sources differ per suit.** Vulgar = public profanity filter lists (LDNOOBW, etc.; easy) · Formal = Academic Word List (AWL) seed + low-frequency/Latinate signals (medium) · Slang = Wiktionary usage-label parsing ((slang)/(informal), etc.; hard).
- **Fill gaps with offline LLM batch.** Run the curated list through an LLM once during development to classify, cross-validating against the seed lists. Bake the result into a table rather than doing it at runtime.
- **Do not use the entire dictionary.** Curate the top 10k–30k words by frequency. Words players recognize give higher satisfaction and keep the classification volume manageable (frequency: SUBTLEX-US, COCA, etc.).
- **Inflected forms are IN; tag at the lemma (playtest-01 P0).** Plurals, past tense, -ing, and comparatives all validate (Scrabble convention — ENABLE already contains them; do not lemmatize them away). Suit + POS are tagged at the *lemma* and inherited by inflections via rule-based reduction (-s/-es/-ies/-ed/-ing/-er/-est) plus a small irregular table (ran→run, ate→eat…). Untagged words still default to Standard.

> **Must-decide rule — "one word = one suit" resolution.** Register attaches to a *meaning*, not a word (e.g. "sick" = Standard "ill" + Slang "cool"). A game tile must have a single suit, so a resolution rule is needed. Recommended: "adopt the strongest register" (if any Slang/Vulgar sense exists, use that suit) — simple, clear, and reliably filters risky words.

---

## 4. Part-of-Speech / Sentence System

In each phase the player makes one word. As phases accumulate, the words line up in order, and if that sequence forms a **valid sentence pattern** it grants a bonus. This is the game's unique meta, corresponding to Balatro's poker hands. The concrete hand table lives in §5.

> **No free-form sentence judgment.** Grammar/semantic judgment of free-form sentences is an NLP research problem, unsuitable for a game. This game already has a "tagged words placed in order in slots" structure, so the problem is finite. It does not "understand the sentence"; it only "matches the part-of-speech tag sequence against a hand table."

### 4.1 Judgment Levels

**Level 1 — Part-of-Speech Sequence Matching (adopted).** Assign a part-of-speech (POS) tag to each word and match the completed sequence against the pattern table in §5. Pure lookup, no NLP needed.

**Level 2 — Register Combination (adopted, simplified in v0.2).** v0.1 sketched a full "tone overlay" table (Academic / Tirade / Hypocrite / Mishmash…). This bloated the base rules, so it has been dieted down following the Balatro principle — *base rules stay minimal; the zoo of variations lives in jokers.* What remains in the base game is a single rule, the **Unison bonus** (§5.3). Hypocrite became joker #46; Mishmash was deleted (functionally duplicated joker #27 Code-Switching).

**Level 3 — Semantic Judgment (not adopted).** Judging semantic validity — "cat eats fish" works but "fish eats cat" is odd — depends on an LLM, so it is excluded. Since scoring with absurd, funny sentences is part of this genre's fun, passing anything that is merely grammatical is also the better game-design choice.

### 4.2 POS Tag Set

**Noun (incl. pronoun) · Verb (subtypes: intransitive / transitive / linking) · Adjective · Adverb · Article/Determiner · Conjunction · Preposition · Interjection.**

Verb subtypes are required because they distinguish Descriptive from Transitive patterns (the "pizza tastes good" problem).

> **Data note — POS tags are nearly free.** The cost of adding POS tags to the register pipeline is low. POS has many clean sources (Wiktionary, WordNet), making it easier than register. The "one word, multiple POS" problem (taste = noun/verb, sick = adjective/noun) has the same structure as suit resolution, and in a game it is actually an opportunity — let the same tile take a different POS depending on which slot it is placed in, adding a strategic axis.

---

## 5. Sentence Pattern Table

This is the game's poker hand table: the hierarchy from weak to strong, per-pattern payouts and operations, and the matching rules.

### 5.1 Matching Rules

1. **Whole-sequence match.** The entire phase sequence must equal a pattern. No partial matching. A gibberish hole (§6.4) anywhere in the sequence voids all pattern matches — countered by Correction Tape (consumable) and Elision (legendary joker).
2. **Highest single pattern only.** If a sequence satisfies multiple patterns, only the highest-value one applies (a full house does not also pay as a pair).
3. **Modifier absorption.** Articles, adjectives, and adverbs are *flesh*, not *skeleton*. "CAT EATS FISH" and "THE BIG CAT EATS FISH" are the same Transitive pattern; each absorbed modifier adds to the bonus (**additive patterns: +15 Chips per modifier; multiplicative patterns: +0.15 to the multiplier per modifier** — placeholders). This keeps the table small while making "longer sentence = bigger reward" automatic, giving the Epic Poet build its natural target.

### 5.2 The Eight Patterns (weak → strong)

| # | Pattern | POS skeleton | Example | Min. phases | Bonus (placeholder) | Operation |
|---|---|---|---|---|---|---|
| 1 | Outcry | Interjection alone | SHH / WOW | 1 | +20 Chips | Add |
| 2 | Imperative | Verb + Noun | EAT FISH | 2 | +40 Chips, +2 Mult | Add |
| 3 | Chant | Same verb ×3+ | RUN RUN RUN RUN | 3+ | per repeat: +15 Chips, +1.5 Mult | Add (scales with repeats) |
| 4 | Simple | Noun + intransitive V | BIRDS FLY | 2 | +60 Chips, +3 Mult | Add |
| 5 | Descriptive | Noun + linking V + Adj | PIZZA TASTES GOOD | 3 | total ×1.5 | Multiply |
| 6 | Transitive | Noun + transitive V + Noun | CAT EATS FISH | 3 | total ×2 | Multiply |
| 7 | Ditransitive | Noun + TV + Noun + Noun | I GIVE HIM FISH | 4 | total ×2.5 | Multiply |
| 8 | Compound | [clause] + Conj + [clause] | CATS RUN AND DOGS SLEEP | 5+ | total ×3 | Multiply |

Design intent:

- **Outcry** finally gives vowel-less interjections (shh, brr) a home in the pattern table — a niche that meshes with the Consonant Bricklayer build.
- **Imperative requires an object (verb + noun)** — a bare verb no longer scores (changed: "RUN" alone once counted as a 1-phase high-card, but in play a lone verb tile spiked the projection off a single submission, so the pattern now needs at least a verb and a noun). The fun of verb repetition still has a home in **Chant**, preserving the RUN×4 showcase as its own pattern.
- **Multiplication starts at #5** — from the point where the linking-vs-transitive distinction (i.e., knowledge of structure) is required, the reward regime changes qualitatively. This implements the "structural sentences = multiplication" principle from §7.3.
- **#7–8 are tight-to-impossible in the base 4 phases** — the reasons to extend phases (Overtime voucher, Infinite Narrative) are built into the table itself.
- **Interrogative (auxiliary inversion, e.g. "CAN BIRDS FLY") is deferred** to expansion content, consistent with the rules diet.

### 5.3 Unison Bonus (the flush substitute)

One rule replaces the v0.1 tone-overlay table:

> **Unison.** If the sequence has 2+ words and *all* words share one suit, a bonus applies, sized by suit rarity: **Standard +50 Chips · Formal ×1.25 · Slang ×1.5 · Vulgar ×2** (placeholders).

This preserves the flush role ("commit to one suit across phases → reward") in a single line. It stacks *on top of* the pattern bonus, so the base score reads as four clean steps: letter chips → suit multiplier → pattern bonus → unison bonus. All richer combination rules (Hypocrite, etc.) live in jokers.

Note on Vulgar stacking: suit base ×3 plus Unison-Vulgar ×2 is an intentional double reward (jackpot identity), with the ladder deliberately gentler than the v0.1 Tirade (×3) draft. Exact values are playtest material.

### 5.4 Punctuation Mapping (level-up consumables)

Each pattern pairs 1:1 with a Punctuation consumable (§10.2), Balatro-Planet style:

| Punctuation | Levels up | Per level (placeholder) |
|---|---|---|
| … Ellipsis | Outcry | +10 Chips |
| ! Exclamation | Imperative | +15 Chips, +1 Mult |
| ‼ Double Exclamation | Chant | per-repeat bonus +5 Chips, +0.5 Mult |
| . Period | Simple | +20 Chips, +1 Mult |
| : Colon | Descriptive | multiplier +0.25 |
| ; Semicolon | Transitive | multiplier +0.25 |
| — Dash | Ditransitive | multiplier +0.3 |
| , Comma | Compound | multiplier +0.3 |

Thematic fits: compound sentences literally use commas + conjunctions; colons introduce descriptions; exclamation marks command. (Joker #32 was renamed **Elision** to cede the name "Ellipsis" to the punctuation card.)

### 5.5 Letter Hands (글자 족보) — per-word structure bonuses (playtest-02 A-2)

Sentence patterns are the *run-level* payoff (evaluated across the whole sequence at blind end). **Letter Hands** supply the *word-level* dopamine — a per-word "hand type" (Balatro's poker hands, transposed to letter structure) evaluated at submission.

- **Scoring placement.** The matched hand's `+Chips` / `+Mult` fold into the word's scoring context **before the suit multiplier settles** (inside `WordScoringContext`, layer 1). Values are placeholders in `balance.ts`.
- **Highest single hand only** (consistent with the sentence-pattern rule, §5.1 rule 2).
- **Gibberish eligibility.** Vowel Flush and Straight **fire on gibberish too** (a deliberate jackpot — e.g. dumping Q-R-S-T-U-V); Twin, Triplet, Longword and Palindrome are valid-words-only. See §6.4.

| Rank | Hand | Condition | Example | Bonus (placeholder) | Gibberish |
|---|---|---|---|---|---|
| 1 | Twin | two identical letters adjacent | b**OO**k | +10 Chips | no |
| 2 | Triplet | same letter ×3 anywhere | b**A**n**A**n**A** | +20 Chips, +1 Mult | no |
| 3 | Longword | 7+ letters | LETTERS | +30 Chips, +1 Mult | no |
| 4 | Palindrome | reads the same reversed (len ≥ 3) | LEVEL | +30 Chips, +2 Mult | no |
| 5 | Vowel Flush | contains all of A,E,I,O,U | EDUCATION | +50 Chips, +3 Mult | **yes** |
| 6 | Straight | 6 consecutive alphabet values (any order) | Q-R-S-T-U-V | +60 Chips, +4 Mult | **yes** |

- **Preview & settle.** The staged-word preview shows the matched hand by name + projected bonus; the settle sequence stamps its name onto the word (UI_DESIGN §4).
- **Out of scope (for now):** leveling letter hands (Punctuation levels sentence patterns only) and jokers keyed to letter hands — see §12 open items.

---

## 6. Core Loop: Phases, Hand & Discard

### 6.1 Loop Skeleton (one blind)

Blind starts → shuffle the bag (68-tile deck) → fill the hand (e.g. 11 tiles) → **[Phase: spell a word from hand tiles → submit → settle → draw back up by the number of tiles used]** repeat → early end or phases exhausted → blind ends; all used tiles return to the bag.

This parallels Balatro exactly: cards played within a blind do not return until the blind ends; the deck (bag) is a permanent, sculptable asset (§2, §9–10).

### 6.2 Hand Size — 11 (a balance knob)

Baseline hand size **11** (placeholder within the 10–12 band). Larger than Balatro's 8 because poker *selects* from a hand while this game must *spell* — more degrees of freedom are needed; larger than Scrabble's 7 because Scrabble extends existing board letters while this game builds standalone words. Hand size is an adjustable resource like Balatro's: vouchers +1, certain bosses −2. This single number is a primary difficulty lever; tune against "average word length achieved" in playtests.

### 6.3 Discard — per-blind budget (Balatro-aligned; playtest-02 A-1)

Mirroring Balatro's discards (3 per blind, up to 5 cards each): **3 discards per blind, up to 5 tiles each** (structure confirmed; values are placeholders). **Discarded tiles exit play for the rest of the blind** — they move to the discarded pile (like played tiles) and are NOT returned to the bag mid-blind; the same number are drawn from the remaining bag. Discarded tiles return to the bag only when the blind ends. (Earlier design returned tiles to the bag immediately; that was dropped in favor of the Balatro-aligned semantics so a discarded letter can't be redrawn within the same blind.)

The budget is **per blind, not per phase** — this is the point. Sharing the budget across phases creates inter-phase resource management ("burn discards now or save them for later phases"). A per-phase allowance would reduce it to a resetting convenience with no strategic weight. Unused discards can hook into the economy via voucher (Thrift, §9.4).

### 6.4 Gibberish Submission (the high-card equivalent) — decision b-2

Letter scores are intrinsic tile value, so they must be recoverable regardless of word validity. Therefore:

- Any tile set may be submitted even if it is not a dictionary word.
- **Payout:** sum of letter Chips × 1.0. No suit (hence no suit multiplier), no POS.
- **Sequence effect (b-2):** the gibberish entry is recorded as a **hole** in the sentence sequence. Under whole-sequence matching (§5.1) a hole voids all pattern matches. Counters: Correction Tape removes a hole; Elision forgives one.
- **Letter hands (§5.5):** even as a hole, a gibberish submission can still score the gibberish-eligible letter hands — **Vowel Flush** and **Straight**. The Straight jackpot (dumping Q-R-S-T-U-V) is the headline case; suit/POS stay null and the hole is still recorded.
- **Joker interaction (proposed):** layer-1 (letter-level) jokers fire on gibberish; layer-2/3 jokers naturally cannot (no suit, no POS) — no special-case rule needed. Gibberish without joker support is strictly inferior to any valid word, so no extra penalty multiplier is required. A dedicated joker (candidate: *Dadaist* — "gibberish counts as Slang suit, ×2 Mult") can elevate gibberish into a legitimate archetype, Balatro-high-card-build style.
- **UI note:** the projected-score preview (§7) shows the sentence bonus collapsing the moment a gibberish submission is staged — the rule explains itself without warning dialogs.
- **UX surfacing (playtest-01 P0-3):** when staged tiles are not a valid word, the staged preview must say so explicitly (e.g. *"Not a word — submit as gibberish: +N chips, breaks the sentence"*) and the play button relabels to *Submit gibberish*. With the escape valve visible, the "my phase was wasted" complaint becomes impossible.

### 6.5 No Minimum Word Length

The Scrabble-style 2-letter floor is **removed**. Scrabble needs the floor because turns are unlimited; here **phases are the scarce resource**, so opportunity cost self-regulates cheap plays. Two ripples, both welcome:

- **"I" and "a" become budget sentence parts.** I (pronoun) + RUN (verb) = Simple in 2 phases. Opens a rush/sentence hybrid line; meshes with joker #7 Short & Sharp.
- **1-tile gibberish = a paid mini-discard.** Dumping one dead tile spends a phase (and leaves a hole) instead of discard budget — a deliberate discard↔phase↔hole currency triangle.

The removed floor is resurrected as a *boss rule* (The Editor, §8.3) — a global rule deleted, revived as a boss variation.

### 6.6 Bag Depletion — the natural cap on Epic Poet

If the bag empties mid-blind, **no refill**; play continues on the remaining hand. Normally irrelevant (68 tiles), but under Infinite Narrative (#34, phase cap removed) the tile supply itself becomes the physical ceiling on infinite phase-stacking. The loop structure brakes the scariest multiplicative build without any bespoke nerf rule.

---

## 7. Scoring Pipeline

Score uses the same **Chips × Mult** structure as Balatro. Because the sentence bonus requires viewing all phases, settlement is two-layered rather than per-hand independent.

### 7.1 Two-Layer Settlement + Projected Score

- **Layer 1 — individual word score (settled immediately).** On each phase submission, (letter score × suit multiplier × jokers) is settled and accumulated immediately. Irreversible. Secures per-phase feedback.
- **Layer 2 — sentence bonus (projected → final).** Each phase, the "sequence so far" is judged (§5) and the projected score is updated — **overwrite, not accumulate**. The bonus is finalized from the sequence at the moment the blind ends.

> **Displayed round score = committed ONLY (playtest-04 A — canonical fix for "score drops").** The big round number on screen is the **committed** score (layer 1) and **never decreases** — it climbs, per beat, during each word's settle. The **sentence bonus is a separate on-screen forecast** ("if the sentence ends like this: +N"), a ghost near the target, not part of the committed number. Merging the two (showing committed + projected as one number) makes a pattern-breaking word *lower* the total — the exact bug this split removes. The bonus resolves visibly in the settle sequence (§7.2) when it's the deciding factor.

> **Why "overwrite"? — resolving the double-counting problem.** Committing the sentence bonus every phase creates double-counting/cancellation problems. Instead, separate the committed score and the projected score, and re-judge the entire sequence wholesale each time. Re-judgment cost is negligible (short sequences). Fully compatible with variable phases: whatever the phase count, only the end-of-blind sequence matters.

### 7.2 Auto-Settle & Phase Economy (playtest-03 B — replaces the early-end button)

The old "cash-out button unlocks at projected ≥ target" was a fake choice: surplus score is worthless and remaining phases pay gold, so continuing past the target was always wrong. **Auto-settle** removes the non-choice.

- **Trigger.** After a submission's **full settle sequence** (word settle → letter-hand/suit stamps → **sentence-finalize animation**: pattern + unison bonuses visibly landing on the score), if the total ≥ target the blind auto-resolves to **Fee Settlement** — the round number rolls up, then after a short verdict beat the settlement modal opens (there is **no** intermediate "Cleared! + Settle button" screen; item 4 removed it — the modal's own Collect button confirms). There is no cash-out fake choice: it never offers to continue past target, so surplus score stays worthless and remaining-phase gold still rewards a fast clear. The sentence bonus must be *seen* pushing the score over when it is the deciding factor — this is the game's highlight moment, so the beat lets it land before the modal covers the board.
- **Remaining phases = money.** Unchanged: 1 gold per remaining phase, paid as a Fee Settlement line item (§9.1).
- **Redefinitions.** *Early end* := a blind cleared with ≥1 phase remaining (now automatic, not chosen). Because auto-settle makes "phases remaining" the *default*, the rush jokers are now **proportional to how many** phases are left, not a fixed threshold (playtest-04 C-1): #24 Rush Specialist = ×(1 + 0.5 × phasesLeft); #28 Loan Shark = +$1 per phase left at clear (values in `balance.ts`). A 1-phase clear of a 4-phase blind pays big; a last-phase clear pays nothing.
- **Boss exceptions.** *The Perfectionist* disables auto-settle — one settlement check after all phases are used. *The Blindfold* is unchanged mechanically; with the projection hidden, the auto-clear now arrives unpredictably (intended spice).

### 7.3 Per-Pattern Operation (+ / ×)

Additive patterns add flat points to the total; multiplicative patterns multiply the accumulated total. Assignment per pattern is fixed in §5.2 — easy patterns add, structural patterns multiply.

> **Balance warning — multiplicative sentences × projected-score preview.** Multiplicative types spike sharply in later phases. If "one more phase doubles the projected score before your eyes" is visible, no one ends early. This is both an intended temptation and a balance pressure point — how easily/often multiplicative sentences can be made governs game tempo. The #1 playtest observation point.

### 7.4 Final Pipeline Summary

**Each phase:** submit word → settle & accumulate individual score (letter × suit multiplier × jokers) → re-judge sentence with current sequence → display updated projected score (pattern bonus + unison) → once the full settle sequence has played, if projected ≥ target the blind's clear is detected and, after the sentence bonus lands and a short beat, it auto-resolves to Fee Settlement (§7.2 — no early-end button, no intermediate verdict screen).

**On ending (early/final):** finalize sentence bonus from the sequence (per-pattern +/× per §5.2) → apply Unison bonus if any (§5.3) → grant 1 gold per remaining phase → end blind.

### 7.5 Variable Phases

Base 4 phases per blind. Increases via jokers/vouchers; the player may also end in a single phase. "Longer sentences → higher multipliers" (patterns #7–8, modifier absorption) versus the 1-phase rush creates the game's central strategic opposition — Rush ↔ Epic Poet — which the joker pool deliberately amplifies (§11.7).

---

## 8. Blinds, Antes & Bosses

### 8.1 Terminology (corrected in v0.2)

- **Blind** = one round. Grants phases (base 4) + an discard budget; cleared by exceeding the target score. Early-end and remaining-phase rewards operate at this unit.
- **Ante** = a set of 3 blinds: **Small → Big → Boss**. The base target rises per ante.

All v0.1 uses of "ante" in the scoring chapter meant "blind" and are corrected throughout.

### 8.2 Scaling & Run Length

Balatro-mirrored: per-ante base score with **Small ×1 / Big ×1.5 / Boss ×2**; exponential growth between antes (Balatro's curve steps roughly ×1.6–2.5 per ante — exact curve is playtest material, tuned together with the joker power curve). **A run = 8 antes + endless mode** (default, adopted as-is).

**Blind skip & tags: deferred.** Adoption itself is on hold, not just the tag pool. Recorded implication: with no skip, every blind is a mandatory stop, removing one tempo-variation tool; in Balatro, skipping doubles as a recovery route for weak early builds (rush to shops for jokers). **Trigger to revisit:** if playtests show unrecoverable early runs when joker luck is poor.

### 8.3 Boss Pool — Design Principles & 12 Bosses

Balatro bosses work because they (1) attack **one system at a time** (readable), (2) are crippling or harmless **depending on the build** (build check), and (3) always have **counterplay** (jokers/consumables). Applying that to our systems — suits, sentences, phases, discard, gibberish, hand, preview:

**Suit attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Censor | Vulgar-suit words score 0 | Counter to Sailor's Mouth / Tyrant builds |
| The Snob | Standard-suit multiplier ×1.0 → ×0.5 | Attacks the safe main line; forces non-standard suits |
| The Purist | Playing 2+ different suits voids subsequent words | Forces suit unison; counters Code-Switching builds |

**Sentence attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Anarchist | Sentence bonuses do not trigger | Checks Grammarian / Epic Poet builds |
| The Noun Lock | Verb-POS words cannot be submitted | Blocks Imperative lines; Wild POS shines |

**Phase / early-end attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Perfectionist | Early end disabled — all phases must be used | Counters Rush / Loan Shark; remaining-phase money naturally vanishes |
| The Guillotine | Phases −2 (base 4 → 2) | Pressure blind; counters Epic Poet, harmless to Rush |

**Loop-resource attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Hoarder | Discards disabled | Raw exposure to draw luck; gibberish escape valve appreciates |
| The Editor | Words of 4 letters or fewer score 0 | The deleted minimum-length rule, revived as a boss rule; blocks "I + RUN" budget parts |
| The Mute | Vowel tiles' Chips = 0 | Collapses Vowel Praise builds; Consonant Bricklayer unaffected; the one blind where vowel-less words (shh, brr) shine |

**Information attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Blindfold | Projected-score preview hidden | Attacks the game's own UI mechanism; early-end judgment goes by feel — the info-denial archetype (Balatro's face-down cards) |

**Economy attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| The Taxman | −1 gold per word submitted this blind | Pressures Miser / Loan Shark economies (values tied to §9) |

### 8.4 Finisher Bosses (Ante 8 only) — 2

| Boss | Effect | Character |
|---|---|---|
| The Proofreader | Every word already submitted this run scores 0 | A final exam of run-long vocabulary breadth — thematically the word game's finale |
| Babel | Each phase, one random POS rotates into a ban | Chaos type: sentence plans must be re-drafted in real time |

**Pool intent:** 12 bosses cover each system roughly once, and every major build among the 46 jokers has at least one counter boss (Rush ↔ Perfectionist, Epic Poet ↔ Guillotine, Vulgar ↔ Censor, sentences ↔ Anarchist, vowels ↔ Mute…). Bosses draw randomly from the pool per ante, Balatro-style.

---

## 9. Shop & Economy

### 9.1 Money Sources (four streams)

| Source | Amount (placeholder) |
|---|---|
| Blind clear reward | Small 3 / Big 4 / Boss 5 gold |
| Remaining phases on blind end | 1 gold per phase |
| Interest | 1 gold per 5 held, **cap 5** (max interest from 25 gold) |
| Selling jokers | Half of purchase price |

> **Interest is the heart** (adopted as-is): the cap creates the "save to 25, spend above it" rhythm and the early-game conflict between buying jokers and building an interest base. Jokers #9 Miser (Mult per held gold) and #28 Loan Shark (early-end scaling) run directly on this system, as does The Taxman boss.

### 9.2 Shop Layout — five stalls

Balatro-mirrored: **Item slots ×2** (jokers/consumables appear mixed) + **Pack slots ×2** + **Voucher slot ×1**. **Reroll:** base 5 gold, +1 per reroll, refreshes item slots only.

**Voucher slot rules (playtest-03 C).**
- **Reroll never refreshes the voucher slot** — it is immune to rerolls.
- **One voucher purchase per chapter (ante)**; only an effect that explicitly grants extra purchases can exceed this. Buying greys the slot for the rest of the chapter.
- **Restock timing:** the voucher slot restocks when the Deadline (boss blind) ends — the *next* chapter's shop carries the new voucher. Within a chapter, the same voucher persists across the Draft/Revision/Deadline shops.
- **Reappearance (Balatro-style):** purchased vouchers never reappear this run; **unpurchased** vouchers stay in the pool and may reappear in a later chapter (preserves "buy now or gamble on later").

**Joker pricing (placeholder):** Common 4–5 / Uncommon 6–7 / Rare 8–10 / Legendary 20.

### 9.3 Packs — where materials & fonts enter the economy

Tile acquisition is **pack-select only** (confirmed): no targeted single-letter purchase. Deck sculpting is therefore draft-flavored, fitting the roguelite grain; the "I have Q but no U" problem is solved not by the shop but by a consumable (Carving Knife, §10.1).

| Pack | Contents |
|---|---|
| Letter Pack | 3–5 tiles shown, choose 1–2 to add to the bag. Occasionally contains tiles with **materials/fonts pre-attached** (the Standard-pack analogy) |
| Emoji Pack | 2–4 jokers shown, choose 1 (Buffoon analogy) |
| Consumable Packs | Stationery Pack / Punctuation Pack / Forbidden Pack (Arcana / Celestial / Spectral analogies) — contents per §10 |

> **Impl note (code is a subset).** The design is **5 pack types** (Letter, Emoji, + the three Consumable packs). The engine currently ships a single consolidated **Consumable Pack** as an MVP stub — `PackKind` = `letter | emoji | consumable`, and its pool is a stub (`magnifier` only). The 3-way split into Stationery/Punctuation/Forbidden packs is the design target, pending implementation (like the full joker/consumable rosters). Collection §2.9 catalogs all 5.

### 9.4 Vouchers — 9, single tier

Single-tier launch set (the Balatro base+upgraded two-tier structure is deferred to content expansion). The game's system knobs become the merchandise:

| Voucher | Effect |
|---|---|
| Extra Hand | Hand size +1 |
| Extra Discard | Discards +1 per blind |
| Overtime | Phases +1 per blind *(priced high — multiplies with Epic Poet builds)* |
| Regular's Discount | Reroll cost −2 |
| Compound Interest | Interest cap 5 → 10 |
| Thrift | +1 gold per unused discard on blind end |
| Wide Shelf | Shop item slots +1 |
| Connoisseur | Higher rate of material/font pre-attached tiles in packs |
| Pencil Case | Consumable slots +1 |

---

## 10. Consumables

Three families mapping Balatro's trio, themed for a word game. **Held slots: 2** (expandable via Pencil Case). **Usable during blinds** — essential: Correction Tape and Shift only matter mid-blind. Acquired from shop item slots and the three consumable packs.

### 10.1 Stationery (Tarot-equivalent) — tile modification & tools, 9

| Item | Effect |
|---|---|
| Kiln | Apply a random material to 1 chosen tile *(the "apply" route for materials; packs are the "pre-attached" route)* |
| Fountain Pen | Apply a random font to 1 chosen tile |
| Shift | Convert up to 3 tiles to uppercase, or to lowercase |
| Eraser | **Permanently remove** up to 2 tiles from the bag *(the reserved deck-thinning tool — see the bag-size note in §2.1: thinning still buys draw consistency at 68, with less glut to cut than at 98)* |
| Correction Tape | Remove 1 hole (gibberish entry) from the current blind's sequence *(the reserved b-2 aftercare tool)* |
| Carving Knife | Change 1 tile's letter to match another owned tile's letter *(Death analogy; solves "Q but no U")* |
| Photocopier | Duplicate 1 tile (material & font included) |
| Piggy Bank | Double gold (cap +20) *(Hermit analogy — plugs into the interest economy)* |
| Magnifier 🔍 | Highlight up to 3 valid words spellable from the current hand (prefer highest-scoring) *(playtest-01 P2-1; hints as an economy resource — no free/always-on highlighting)* |

### 10.2 Punctuation (Planet-equivalent) — pattern level-up, 8

One per sentence pattern, 1:1 (full mapping and per-level effects in §5.4). Using a Punctuation card permanently levels its pattern: additive patterns gain flat amounts, multiplicative patterns gain multiplier increments — Balatro Planet behavior. Specializing punctuation into your most-played patterns is the intended play.

### 10.3 Forbidden Books (Spectral-equivalent) — drastic effects, 4

| Item | Effect |
|---|---|
| Book Burning | Destroy 5 random tiles from the bag; gain a random Legendary emoji joker *(Immolate+Ankh line)* |
| Apocrypha | Apply random materials to the entire hand; hand size permanently −1 |
| Scribbles | Randomly reassign the letters of 3 random tiles — a gamble |
| Apocalypse | This blind only: all words count as Vulgar suit *(a one-shot trial of Tyrant #33 — a Legendary preview)* |

---

## 11. Jokers (Emoji Tiles)

Jokers are represented as emoji tiles, acquired by shop purchase/draw (§9). Unlike Balatro jokers, which mostly play in the single layer of "score calculation," these jokers play across **3 layers**: **(1) Letter/Tile  (2) Suit (register)  (3) Sentence/Phase**.

**Notation.** Chips = base score, Mult = multiplier, Final = Chips × Mult. **Layer** = 1/2/3. **★** = scaling. All values are balancing placeholders.

### 11.1 Roles by Rarity

| Rarity | Role | Main layer |
|---|---|---|
| Common | Unconditional pure addition — early foundation | 1 |
| Uncommon | Conditional addition + start of scaling | 1–2 |
| Rare | Multiplication (×Mult) appears + full scaling — acceleration engine | 2–3 |
| Legendary | Rule-breaking — redefines the run (5 total) | 3 |

### 11.2 Common — 10

| # | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| 1 | Vowel Praise | +2 Mult per vowel in the word | 1 | — |
| 2 | Consonant Bricklayer | +4 Chips per consonant in the word | 1 | — |
| 3 | Uppercase Premium | +3 Chips per uppercase tile | 1 | — |
| 4 | Lowercase Lover | +1 Mult per lowercase tile | 1 | — |
| 5 | Ceramic Artisan | +2 Chips per base (ceramic) tile — rewards an un-enhanced stable build | 1 | — |
| 6 | Long-Word Fan | +30 Chips if word is 5+ letters | 1 | — |
| 7 | Short & Sharp | +8 Mult if word is 3 letters or fewer | 1 | — |
| 8 | Alphabetical Order | +15 Chips if the word contains consecutive letters (ab, cd…) | 1 | — |
| 9 | Miser | +1 Mult per 5 gold held — economy build seed | 1 | — |
| 10 | Jack of All Trades | Unconditional +4 Mult (baseline joker) | 1 | — |

### 11.3 Uncommon — 10

| # | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| 11 | Literary Judge | +50 Chips if word is Formal suit | 1–2 | — |
| 12 | Hipster | +7 Mult if word is Slang suit | 2 | — |
| 13 | Rare Earth | ×3 Chips on that letter when using Q·Z·X·J | 1 | — |
| 14 | Glasswork | +5 Mult per glass tile; 1 glass tile is lost each round | 1 | — |
| 15 | Voracious Reader | +1 Chips per total words made so far, accumulating | 1 | ★ |
| 16 | Classicist | Each Formal word made permanently raises this joker's Mult by +1 | 2 | ★ |
| 17 | Street Cred | Each Slang word made permanently raises Chips by +8 | 2 | ★ |
| 18 | Combo Artist | +6 Mult if different suit from the previous phase | 2 | — |
| 19 | Vowel Magnet | ×1.5 Mult if word has more vowels than consonants | 1 | — |
| 20 | Equilibrist | +40 Chips & +4 Mult if vowel and consonant counts are equal | 1 | — |

### 11.4 Rare — 11

| # | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| 21 | Drill Instructor | ×3 Mult on completing an Imperative (verb repeat/initial) | 3 | — |
| 22 | Grammarian | ×2 Mult on completing any valid sentence pattern (general amplifier) | 3 | — |
| 23 | Sailor's Mouth | Vulgar suit ×4 Mult (nullified by The Censor) | 2 | — |
| 24 | Rush Specialist | ×Mult scaling with phases left at clear: ×(1 + 0.5 × phasesLeft) | 3 | — |
| 25 | Epic Poet | +0.3 ×Mult per phase used, accumulating (that blind only) | 3 | ★ |
| 26 | Collector | +0.1 ×Mult permanently per sentence completed | 3 | ★ |
| 27 | Code-Switching | ×3 Mult if 3+ suits are mixed in one sentence | 2 | — |
| 28 | Loan Shark | Gold scaling with phases left at clear: +$1 per remaining phase | 3 | ★ |
| 29 | Alchemist | +12 Chips permanently each time you use an enhanced-material tile | 1 | ★ |
| 30 | Calligrapher | +2 Mult permanently each time you use a non-base font tile | 1 | ★ |
| 46 | Hypocrite | ×2 Mult if the sentence contains both a Formal and a Vulgar word *(demoted from the v0.1 tone-overlay base rule — variations live in jokers)* | 2–3 | — |

### 11.5 Legendary — 5

| # | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| 31 | Wild POS | All hand tiles count as any part of speech in sentence judgment — force-completes any pattern | 3 | — |
| 32 | Elision *(renamed from Ellipsis)* | An empty POS slot in a sentence pattern still counts as a match + all sentence bonuses ×1.5 | 3 | — |
| 33 | Tyrant | Treat all words as Vulgar suit + double all Vulgar ×Mult (extreme matchup with The Censor) | 2 | — |
| 34 | Infinite Narrative | Remove phase cap, halve per-phase target growth + +0.2 ×Mult per phase *(natural ceiling: bag depletion, §6.6)* | 3 | ★ |
| 35 | One Stroke | ×10 blind score on hitting target in 1 phase; if 2+ phases used, this joker is void this blind | 3 | — |

**Candidate addition (unconfirmed):** *Dadaist* — gibberish submissions count as Slang suit, ×2 Mult. Would elevate gibberish (§6.4) into a legitimate archetype, high-card-build style.

### 11.6 Scaling Axis Distribution (8 axes)

Scaling jokers' counters are deliberately spread out so that "which scaling joker you take" becomes "how you play."

| Scaling axis | Jokers |
|---|---|
| Total words made | Voracious Reader (15) |
| Formal suit accumulation | Classicist (16) |
| Slang suit accumulation | Street Cred (17) |
| Sentences completed | Collector (26) |
| Phase length | Epic Poet (25) · Infinite Narrative (34) |
| Early-end count | Loan Shark (28) |
| Material usage | Alchemist (29) |
| Font usage | Calligrapher (30) |

### 11.7 Core Oppositions & Balance Pressure Points

- **Rush ↔ Epic Poet.** At Rare, Rush Specialist (24) ↔ Epic Poet (25) oppose, and at Legendary, One Stroke (35) ↔ Infinite Narrative (34) form the finale of that opposition. This opposition is the game's spine, directly tied to the "early-end vs. phase-extension" tension in §7.2, and now checked from the boss side by The Perfectionist / The Guillotine (§8.3).
- **Rush economy combo.** Loan Shark (28) + One Stroke (35) create an extreme rush-economy build. Very strong when it runs, so its ceiling needs checking.
- **Epic Poet multiplicative stack.** 25, 26, 34 accumulate multiplication — the "no one ends early" problem meeting the projected-score preview erupts precisely here. Two structural brakes now exist: Infinite Narrative's built-in "halve target growth," and bag depletion (§6.6). Verify these two builds' ceilings first in playtesting.

### 11.8 Joker Editions (planned — not yet in the engine)

Distinct from tile materials/fonts (§2.2–2.3, which live on *letter* tiles): a **joker** carries an **edition**, ported from Balatro's Foil/Holo/Poly/Negative. This is design-forward — the current engine has **no `JokerEdition` type yet** (`OwnedJoker` is edition-less); it is recorded here so the two modifier systems are never conflated (a letter tile never takes an edition; a joker never takes a material/font).

| Edition | Effect (placeholder) |
|---|---|
| Base | no edition |
| Foil | +50 Chips |
| Holographic | +10 Mult |
| Polychrome | ×1.5 Mult |
| Negative | occupies no joker slot → **+1 owned-joker slot** |

- **Slot cap.** The owned-joker cap is base **5** (today the global `BALANCE.jokerSlots`; the planned per-run field is `RunState.jokerSlots`). Each Negative joker raises the effective cap by 1.
- **Acquisition (planned):** editions pre-attach on jokers found in Emoji Packs, or via a future consumable — to be designed alongside implementation.
- **Status:** planned; ship in a dedicated slice. Until then jokers are edition-less.

---

## 12. Open Questions & Next Steps

**Resolved since v0.1:** sentence pattern table (→ §5) · in-phase loop (→ §6) · blind/ante structure & boss pool (→ §8) · shop & economy (→ §9) · consumables (→ §10) · round-level suit synergy (→ Unison, §5.3).

**Still open:**

- **Value balancing across the board.** All numbers remain placeholders (jokers, patterns, unison, vouchers, prices, target-score curve). Playtest-driven.
- **Blind skip & tags.** Adoption itself deferred. Revisit trigger: unrecoverable early runs in playtests (§8.2).
- **Starting deck types.** Balatro's Red/Blue/Plasma analogy — bags with different tile compositions (vowel-heavy, uppercase, slang-friendly…). Untouched.
- **Stakes (difficulty) & unlock structure.** Replayability layer. Untouched.
- **Voucher tier 2 (upgraded versions).** Deferred to content expansion.
- **Interrogative pattern.** Auxiliary-inversion pattern + Question Mark punctuation; deferred to expansion (§5.2).
- **Dadaist joker.** Candidate; confirm inclusion with gibberish-archetype balancing (§11.5).
- **Font effects (all 5).** Fonts are still visual-only — §2.3 names the five styles but describes no effects. Fonts **own retrigger** (the seal role, §2 design note); do not spend it elsewhere. Materials closed this gap first (§2.2); fonts are the remaining half.
- **Stakes = matcher-leniency knobs (reframed, playtest-01).** True grammar checking stays out (§4.1 level 3); instead, future stake levels modulate knobs that already exist — modifier absorption on/off, hole forgiveness, unison strictness.
- **Word collection (도감) UI.** First-play-per-word tracking ships now (localStorage; gibberish excluded); the collection screen itself is a later milestone (playtest-01 P2-2).
- **Register/POS dataset build.** Frequency-top curation → seed lists + LLM batch classification → baked table; one-word = one-suit/POS resolution rule (§3.2, §4.2).
- **Finisher boss count.** 2 concepts exist; decide whether the pool needs more for endless-mode variety.
- **Jokers keyed to letter hands (§5.5).** Letter Hands ship without joker support; a family of jokers that trigger on / scale with specific hands (e.g. "+Mult per Twin this blind", "Straights also give $2") is open joker material.
- **Letter-hand leveling (if ever).** Punctuation levels sentence patterns only; whether letter hands should ever be levelable (and by what consumable) is deferred.
- **Ink colors = stakes (playtest-03 A).** The deferred difficulty/stake ladder is re-skinned as **Ink** (검정 → 빨강 …); red ink = the editor's pen. Reframed as matcher-leniency knobs (per playtest-01), not true grammar checking.
- **Touch long-press marking (playtest-03 F).** Discard-marking uses right-click (desktop-only); a long-press gesture for touch devices is open. No change now.
- **Suit dataset batch (playtest-03 F).** The real 20–30k LLM batch classification stays an offline design-side task; the lexicon loader format is kept stable so a larger baked table drops in without code changes.
