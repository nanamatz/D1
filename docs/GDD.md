# Play the Wor!d

**Word-combination roguelite — Game Design Document**
*Balatro-inspired word-building roguelite*

Version 0.2 — systems expansion

**Changelog v0.1 → v0.2**

- Terminology corrected: **blind** = one round; **ante** = 3 blinds (Small → Big → Boss). Former uses of "ante" in the scoring pipeline now read "blind".
- New: **Sentence Pattern Table** (the game's "poker hand table") — 12 patterns, matching rules, Unison bonus. Tone-overlay concept from v0.1 §4.1 Level 2 replaced by the single Unison rule (design diet).
- New: **Core Loop** chapter — hand size, draw/refill, discard budget, gibberish submission (b-2), no minimum word length.
- New: **Blinds, Antes & Bosses** — scaling, run length, boss pool (12, single flat pool; the 2 ante-8 finishers were retired 2026-07-21, see §8.4). Blind skip / tags: adoption itself deferred.
- New: **Shop & Economy** — money sources, interest, shop layout, packs, 32 two-tier vouchers.
- Changed 2026-07-26: **Consumables** now use 3 card families — Fable (18 implemented), Constellation (12 implemented), and Gambler (14 artworks; 12 effects implemented 2026-07-30, 2 deliberately pending). The former Stationery/Punctuation display names and Forbidden Books placeholders are retired (§10).
- Changed 2026-07-27: the third card family's display name is **Gambler Cards / 노름꾼 카드** (was "Ink Cards / 잉크 카드"). The **Ink name moves to the pack**: a third consumable pack, the **Ink Pack / 잉크 팩**, is the source of Gambler cards, alongside the Fable and Constellation packs (§9.3, §10.3). Collection key `inkCards` and other engine ids are unchanged (display-only rename).
- Changed 2026-07-30: the twelve confirmed Gambler-card effects ship (`src/engine/gamblers.ts`) and the Ink Pack rolls in the shop;
  Rainman and Sake Cup have art but no engine id.
- Changed 2026-07-29: twelve Gambler-card effects are confirmed; Rainman and Sake Cup remain pending until the Emoji Tile roster is selected. Phoenix is the Legendary Emoji Tile route, Boar is the explicit duplicate-ownership exception, Deer may rarely appear in Constellation Packs, and Gambler cards may enter Fable Packs only after Comic Book is owned (§9.2–§10.3).
- Changed 2026-07-29: Emoji Tiles now have profile unlocks. A starter subset is available immediately; every other tile needs its own condition completed in an unseeded run, and locked tiles are absent from every acquisition pool (§9.2, §11).
- Changed 2026-07-29: the Rare roster is replaced by 11 confirmed tiles and the
  Legendary roster by Book of Margins, Tyrant, Type Foundry, Tower of Babel, and
  Misbound. Common 32 and Uncommon 35 remain a review baseline with additional
  deduplicated candidates in `docs/EMOJI_TILE_IDEA_BANK.md` (§11).
- Changed 2026-07-29: Emoji Tile art uses the shared **124×165px (near-3:4)**
  runtime card footprint. Existing 84×112 pixel masters scale into it with
  nearest-neighbour rendering; the family still does not reuse the 5:7
  consumable-card canvas (§11).
- Changed 2026-07-26: the sentence-pattern table expanded from 8 to 12 with Object Complement, Interrogative, Negative, and Complex. Interrogatives use lexical/auxiliary detection without a `?` tile; apostrophe-free negative contractions are valid tile words (§5.2–§5.4).
- Historical note: #32 was once renamed Ellipsis → Elision and Hypocrite once
  carried id #46. The 2026-07-29 Rare/Legendary replacement retires those
  historical ids; Hypocrite is now R2 and Elision is no longer active.

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
11. [Emoji Tiles](#11-emoji-tiles)
12. [Open Questions & Next Steps](#12-open-questions--next-steps)

---

## 1. Overview

**Core concept.** A roguelite where you score with *word combinations* instead of poker hands. Players use *alphabet tiles* instead of cards, and the structure of Balatro — deck, suits, enhancements, jokers, blinds, antes — is ported into the grammar of a word game. Built on a Scrabble-style letter-scoring base, it differentiates itself with two meta-layers Balatro does not have: the **register suit** and the **part-of-speech / sentence system**.

**Language.** English (confirmed).
**Art direction.** Pixel-art with a CRT finish, in the Balatro lineage (the earlier "ceramic letterpress, deliberately un-Balatro" direction is retired). Tile materials/fonts (§2.2–2.3) and the publishing-world fiction (§1.2) are unchanged in *design* — only their *rendering style* is pixel-art. Full visual spec in `docs/UI_DESIGN.md`; a pixel-art shop mascot — 삐약이 (Piyak), the tuxedo cat proprietor — lives in the Stationery Shop (art: docs/Piyak.png). A second mascot, **우땅 (WooDak)** — a pixel-art orangutan, the player's ally/editor-mentor — appears on the run-end screen with tips and discovery mentions, and will later host tutorials and notifications (art: docs/WooDak.png).
**Special characters.** Excluded as playable tiles (punctuation-shaped pattern levels return as Constellation cards; see §10). *Re-examined and re-affirmed in playtest-05 D:* wildcard/blank tiles and `?`/`!` mood-marker tiles were both explored and **dropped**, because each duplicated a system we already have — alphabet sculpting now belongs to Fable #16 and the pouch's draft-flavored tools; mood markers overlap the Constellation cards and would force a large change to the §5 pattern system. Revisit only if a concrete need appears that no existing system covers.

### 1.1 Balatro → This Game Mapping

| Balatro | This Game | Notes |
|---|---|---|
| Deck / Cards | Alphabet tiles (the "bag") | Scrabble-style per-letter score & count; 68 tiles (§2.1) |
| Suits (♠♥♦♣) | 4 register suits | Formal / Standard / Slang / Vulgar — asymmetric |
| Enhancement | 9 tile materials | Ceramic (base) + Porcelain, Polished, Glass, Stone, Lead plate, Ivory, Brass, Wood |
| Edition / Seal | 5 letter fonts | Futura Medium (base) + 4 styles |
| Joker | Emoji tiles | 4 rarities + Legendary; shop purchase/draw; rule-breaking |
| Hand (play) | Phase | Base 5 per blind; variable via emoji tiles/vouchers |
| Discard | Discard | Budget per blind; discarded tiles exit for the blind |
| Poker hand table | Sentence pattern table | POS sequence matching (§5) |
| Flush | Unison bonus | All words in the sequence share one suit |
| High card | Gibberish submission | Non-word tile dump; letter chips only |
| Blind (Small/Big/Boss) | Blind | One round: phases + discard budget + target score |
| Ante | Ante | 3 blinds; base target rises per ante |
| Tarot cards | Fable Cards | 18 one-shot tile/economy/tool effects |
| Planet cards | Constellation Cards | Sentence-pattern level-up consumables |
| Spectral cards | Gambler Cards | Third family (delivered by the Ink Pack, §9.3); 12 implemented, 2 pending |
| Vouchers | Vouchers | 16 base + 16 upgraded permanent run effects |
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

**One object, one name (2026-07-30).** The owned joker object is **Emoji Tile / 이모지 타일** in every string (GDD §11). **Charm / 부적** survives only as the name of the pack that contains them — **Charm Pack / 부적 팩** (§9.3). Text that called the object a Charm was corrected; text naming the pack was not.

---

## 2. Tile System

A tile is the smallest unit of the game. Each tile is one **uppercase** alphabet
letter (the sole exception being Stone, which has none — §2.2), one intrinsic
classification, and three independent modifier axes.

- **Intrinsic classification — Vowel / Consonant**
- **Modifier axis A — Material:** the enhancement slot
- **Modifier axis B — Font:** the seal-effect slot
- **Modifier axis C — Edition:** base / Foil / Holographic / Polychrome

> **Decision — uppercase only (changed 2026-07-30).** Letter case is not a tile
> axis. Every letter is stored and displayed as A–Z; all lowercase-tile planning
> and case-dependent Emoji Tiles are retired.

> **Design note — axis independence.** A tile can carry one material, one font,
> and one edition simultaneously. The 9×5×4 combinations are the core engine of
> build variety.

> **Design note — retrigger stays on fonts.** Fonts retain the seal-effect roles
> (§2.3), so retrigger belongs to fonts, never to materials. Tile editions remain
> a separate visual/scoring axis (§2.4, §11.8).

**Tile permanence.** Tiles are permanent assets, like Balatro's deck cards. Tiles submitted during a blind are consumed for that blind and return to the bag when the blind ends. The bag is sculpted across a run via packs (add) and consumables (remove/transform) — see §9–10.

### 2.1 Per-Letter Score & Count (rebalanced — diverges from Scrabble on purpose)

Letter **scores** are Scrabble-standard **× 3** (feel pass 2026-07-21, `BALANCE.letterChips`): the base floor was raised so tiles feel more impactful, while the ratios that reward rare letters are preserved exactly. Pattern/unison/letter-hand/material constants are untouched by this scaling — only the per-tile letter chip does. `src/sim/feel-chip-scale.ts` confirms the ante curve (§8.2) isn't trivialized by the change (left unscaled). The **counts** were separately rebalanced (playtest-04 C-2, chosen by `src/sim/tile-pool.ts`): the bag shrank **98 → 68** and its extremes were **compressed** — the E-glut cut (12 → 6) and rare letters raised (1 → 2). Scrabble's distribution assumes board-adjacency; standalone-word spelling wants a flatter curve. Blanks excluded.

| Score | Letters (count) | Tiles |
|---|---|---|
| 3 pt | E×6, A×5, I×5, O×4, U×3, N×3, R×3, T×3, L×2, S×2 | 36 |
| 6 pt | D×2, G×2 | 4 |
| 9 pt | B×2, C×2, M×2, P×2 | 8 |
| 12 pt | F×2, H×2, V×2, W×2, Y×2 | 10 |
| 15 pt | K×2 | 2 |
| 24 pt | J×2, X×2 | 4 |
| 30 pt | Q×2, Z×2 | 4 |
| **Total** | — | **68** |

**Why (sim, 4000 hands @ hand 11):** vs. the old 98-tile bag, rare letters now appear **~2× as often** per hand (1.24 → 2.57), so deck-building and rare-letter payoffs gain traction; the longest makeable word stays healthy (6.9 → 6.2 letters) and the gibberish-forced rate stays near zero (0.1% → 0.3%). Connected knobs (hand size, target curve, Epic-Poet/pouch-depletion cap) get retuned against sim drift as needed.

**Note.** Y is treated as a consonant under the traditional classification (vowel/consonant axis). Room is left to handle it as a semivowel exception in specific emoji tiles or sentence judgments.

> **Bag-size note.** The rebalanced 68-tile bag (C-2) sits between Balatro's 52-card deck and the old 98. Adding a few tiles now moves the odds more than at 98; **thinning** still buys draw consistency but with less glut to cut. Adding lives in the shop (packs); removal is deliberately reserved for consumables (Eraser, §10).

### 2.2 Materials (Enhancement Layer)

| Material | Korean | Effect | Balatro source |
|---|---|---|---|
| Ceramic (base) | 도자기 | Base — un-enhanced baseline tile (id `ceramic`) | plain card |
| Porcelain | 자기 | **+30 Chips** (id `porcelain`) | Bonus |
| Polished | 광택 | **+4 Mult** | Mult |
| Glass | 유리 | **×2 Mult**, 1/4 chance to destroy the tile after the word settles | Glass |
| Stone | 석재 | **+50 Chips, no letter** (see below) | Stone |
| Lead plate | 연판 | **1/5 → +20 Mult; 1/15 → $20** (independent rolls) | Lucky |
| Ivory | 상아 | **$3** if held in hand at blind end | Gold |
| Brass | 황동 | **×1.5 Mult** while held in hand | Steel |
| Wood | 목재 | Starts at **+15 Chips**; permanently gains **+10 Chips** each time that tile is played during the run | custom |

Effects are **per tile** and stack: three Porcelain tiles in one word give +90 Chips; two Ivory tiles held at blind end pay $6. Wood growth is stored on that individual tile and survives blind transitions for the rest of the run.

**Risk budget: Glass only.** Every other material is pure upside. Stone's letter loss is a trade-off known at the moment it is applied, not a gamble, so it does not break this rule. A destroyed Glass tile leaves the run permanently.

**Numbers are Balatro's reference values except for the custom Wood growth curve.** They are a validated point to tune *from*, not a claim that they fit our scale — our letter chips are Scrabble values × 3 ("TASTE" = 15 Chips) and our hand is 11 tiles against Balatro's 8, so per-tile effects amplify far harder here. Three predicted breakages are recorded for `src/sim` to measure: Brass compounding (≈×11 off ~6 held tiles), Porcelain over-tuning, and the economy values (Ivory/Lead plate) surviving unscaled because our gold scale already matches Balatro's. See `docs/superpowers/specs/2026-07-17-tile-materials-design.md`.

**Names follow the ids (changed 2026-07-30).** The display names used to be
inverted against the engine identifiers — id `porcelain` was shown as "Ceramic /
도자기" and id `ceramic` as "Porcelain / 자기" — which made every code reference
read backwards. The DISPLAY names moved to match the ids; the ids themselves are
untouched, so no saved tile needs migrating. Consequences: the base material is
now **Ceramic / 도자기**, the +30 Chips material is **Porcelain / 자기**, and the
Common Emoji Tile that pays on the base is renamed **Ceramic Artisan / 도자기
장인** (§11.2 C6, id `ceramicArtisan`). A `MaterialDef` no longer carries
`nameKo`/`nameEn` at all — those fields were unread and had drifted (연마 vs
광택), so display names now live only in `locales/*.json`.

**Why there is no Wild material.** Balatro's Wild card ("counts as any suit") has no translation here: **suit is a property of the word, not the tile** — the lexicon assigns it (§3.1). A tile has no suit to widen. Wood occupies the added custom effect slot instead.

**Stone has no letter.** Our analog of Balatro Stone's "no rank or suit" is *no letter*: `material = stone` ⟺ the tile carries no letter. A stone tile therefore cannot spell, so any word containing one fails the lexicon lookup and resolves as **gibberish** (§6.4) — chips × 1.0, no suit multiplier, always submittable. This is deliberate, and it is what stops Stone from being strictly the best tile in the game: if stone were merely skipped while spelling, `stone+C+A+T` would read "CAT" and collect +50 Chips *and* the suit multiplier. The consequence is that Stone becomes the heart of the gibberish archetype — an identity that falls out of our own rules rather than being imported. A stone is **neither vowel nor consonant** (§2.1), so vowel/consonant emoji tiles must skip it.

**Acquisition:** materials enter play pre-attached on tiles found in Tile Packs (§9.3), or through the matching Fable cards (§10.1). A Fable that turns a tile into Stone hides and remembers its letter; a later non-Stone transformation restores it.

### 2.3 Fonts (Edition Layer)

| Font | Position |
|---|---|
| Futura Medium | Base |
| Futura Light Italic | Edition |
| Futura Bold | Edition |
| Futura Inline | Edition |
| Futura Black | Edition |

**Acquisition:** pre-attached in Type Packs, or applied by the Fountain Pen consumable (§10.1).

**Effects — the Balatro-seal port (confirmed).** The four non-base fonts carry the seal roles, honoring the §2 design note (this layer absorbs both edition and seal; **retrigger lives here**, materials left it unspent). Effect ids and values (→ `balance.ts`):

| Effect id | Trigger | Effect | Balatro origin |
|---|---|---|---|
| `goldPlay` | tile scores in a played word | +$3 | Gold Seal (verbatim) |
| `chipPlay` | tile scores in a played word | +30 Chips | adapted (Blue Seal's planet-generation has no clean analog; value borrows Bonus-card's +30) |
| `retriggerPlay` | tile scores in a played word | retrigger this tile's scoring contribution once | Red Seal (verbatim) — the reserved retrigger, spent here |
| `discardGain` | tile is discarded | gain 1 random consumable; **requires a free consumable slot**, otherwise nothing | Purple Seal (tarot→consumable) |

Rules: "scores in a played word" **includes gibberish** (tile-level effects fire whenever the tile scores, consistent with materials and layer-1 emoji tiles); `retriggerPlay` composes with any other retrigger sources rather than being special-cased; `discardGain` joins the discard-economy axis. Values follow the same Balatro-verbatim-then-tune philosophy as §2.2.

**Font ↔ effect mapping (confirmed 2026-07-27).** Assigned so that a glyph's visual weight predicts its effect's character — the heavier the ink, the more it does to the score:

| Font | Effect | Reading |
|---|---|---|
| Light Italic | `goldPlay` — +$3 when the tile scores | the lightest touch pays out sideways, in money rather than score |
| Bold | `chipPlay` — +30 Chips when the tile scores | thick ink = substantial, the plainly additive one |
| Inline | `discardGain` — gain 1 consumable when discarded (needs a free slot) | the hollow glyph has something inside it |
| Black | `retriggerPlay` — retrigger the tile's scoring contribution once | the heaviest ink prints twice |

Implemented as a `fontEffects` table in `balance.ts` keyed by font id (`lightItalic`/`bold`/`inline`/`black` → effect id); tooltips read from it, never hard-coded. Reassignment stays a one-line data change.

> **Decision — fonts unified as style variants within the Futura family.** A font functions as a visual signal that "this tile has a special effect." Weight/italic/inline variants within one family are instantly distinguishable from a single glyph while keeping the screen's tone coherent. Mixing distinct typefaces blurs the information axis ("is this a different font, or a different letter/material?"), so it is avoided. Room is left to give only the top rarity an exceptional emphasis. (License note: Futura is a paid commercial font. Prototype-stage alternatives — Jost, Spartan, Century Gothic family.)

### 2.4 Enhancement Stacking & Replacement

A letter tile carries **three independent enhancement axes at once**: `material` (§2.2) + `font` (§2.3) + `edition` (§11.8). All three stack — a Ceramic / Bold / Foil tile pays its material, font, and edition effects in the same word. Emoji Tiles carry only `JokerEdition` and never take a material or font.

**Same-axis replacement is destructive (rule).** Applying an enhancement to a tile that already carries one **on the same axis** overwrites it; the previous one is discarded, not stored or refunded. Re-applying Polished to a Ceramic tile leaves a Polished tile, not both. Cross-axis application never conflicts (a Fable that sets material leaves font and edition untouched). **The overwrite applies immediately, with no confirmation prompt** (revised 2026-07-28: the earlier warn-before-overwrite modal was removed — players learn the rule by doing, and the modal only added friction).

**One exception — Stone's letter memory (§2.2).** Because `material = stone` also strips the tile's letter, a Stone transformation *hides and remembers* the letter, and a later non-Stone material restores it. This is a property of the letter, not of the material slot: the material itself is still overwritten normally.

---

## 3. Register Suit System

A completed word is classified into one of 4 types, like a Balatro suit. The classification axis is **register alone**, so the categories are mutually exclusive. This suit is the basis of the conditional penalty/bonus mechanics.

### 3.1 The Four Suits and Base Multipliers

| Suit | Character | Rarity | Base multiplier (placeholder) | Position |
|---|---|---|---|---|
| Standard | Everyday vocabulary | Overwhelming majority | ×1.0 | Safe main line |
| Formal | Academic / literary | Fewer than majority | ×1.5 | Mid-game main candidate |
| Slang | Colloquial / informal | Few | ×2.0 | Strong when combined with emoji tiles |
| Vulgar | Profanity / taboo | Fewest | ×3.0 | High-risk jackpot |

> **Key design — Balatro suits are "symmetric," this game's are "asymmetric."** Balatro's 4 suits have equal counts in the deck, so no base-multiplier difference is applied. This game's suits differ in *how easy they are to make* (Standard common → Vulgar rare). Treating this asymmetry as a resource rather than a defect, harder-to-make suits get higher base multipliers, embedding a risk-reward curve into the suit structure itself. On top of that, "suit-pushing emoji tiles" (layer 2) recreate Balatro-style build bias.

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

**Level 2 — Register Combination (adopted, simplified in v0.2).** v0.1 sketched a full "tone overlay" table (Academic / Tirade / Hypocrite / Mishmash…). This bloated the base rules, so it has been dieted down following the Balatro principle — *base rules stay minimal; the zoo of variations lives in emoji tiles.* What remains in the base game is a single rule, the **Unison bonus** (§5.3). Hypocrite is Rare tile R2; Mishmash stays retired.

**Level 3 — Semantic Judgment (not adopted).** Judging semantic validity — "cat eats fish" works but "fish eats cat" is odd — depends on an LLM, so it is excluded. Since scoring with absurd, funny sentences is part of this genre's fun, passing anything that is merely grammatical is also the better game-design choice.

### 4.2 POS Tag Set

**Noun (incl. pronoun) · Verb (subtypes: intransitive / transitive / linking) · Adjective · Adverb · Article/Determiner · Conjunction · Preposition · Interjection.**

Verb subtypes are required because they distinguish Descriptive from Transitive patterns (the "pizza tastes good" problem).

> **Data note — POS tags are nearly free.** The cost of adding POS tags to the register pipeline is low. POS has many clean sources (Wiktionary, WordNet), making it easier than register. The "one word, multiple POS" problem (taste = noun/verb, sick = adjective/noun) has the same structure as suit resolution, and in a game it is actually an opportunity — let the same tile take a different POS depending on which slot it is placed in, adding a strategic axis.

---

## 5. Sentence Pattern Table

This is the game's poker hand table: the hierarchy from weak to strong, per-pattern payouts and operations, and the matching rules.

### 5.1 Matching Rules

1. **Whole-sequence match.** The entire phase sequence must equal a pattern. No partial matching. A gibberish hole (§6.4) anywhere in the sequence voids all pattern matches — Correction Tape is the current counter.
2. **Highest single pattern only.** If a sequence satisfies multiple patterns, only the highest-value one applies (a full house does not also pay as a pair).
3. **Modifier absorption.** Articles, adjectives, and adverbs are *flesh*, not *skeleton*. "CAT EATS FISH" and "THE BIG CAT EATS FISH" are the same Transitive pattern; **each absorbed modifier adds +15 Chips to the sentence bonus's Chips side** (uniform across all patterns — placeholder). This keeps the table small while making longer sentences naturally more valuable.

### 5.2 The Twelve Patterns (weak → strong)

Every pattern owns a base **[Chips × Mult]** pair (Balatro-hand style). The sentence bonus is a *self-contained* value — computed from the pattern's Chips×Mult, modifiers, and Unison — and **added** to the blind's committed score at finalization. Patterns no longer "add flat" vs "multiply the running total"; that op split (v0.2) is retired.

```
sentence bonus = (patternChips + 15 × absorbedModifiers + unisonChips)
              × (patternMult × unisonMult)
```

At finalization the gold pattern/level stamp remains the primary beat. Every
non-pattern contributor is displayed separately beside it: absorbed modifiers
use a Chips-coloured tag, Unison uses a gold tag, and post-pattern Emoji Tile,
voucher, or boss adjustments use an effect-coloured tag. They must never be
folded invisibly into the pattern label.

| # | Pattern | POS skeleton | Example | Min. phases | Base (Chips × Mult) | Per level (+Chips, +Mult) |
|---|---|---|---|---|---|---|
| 1 | Outcry | Interjection alone | SHH / WOW | 1 | 10 × 1 | +10, +0.5 |
| 2 | Imperative | Verb + Noun | EAT FISH | 2 | 15 × 2 | +10, +0.5 |
| 3 | Chant | Same verb ×3+ | RUN RUN RUN RUN | 3+ | 15 × 2, **+10 Chips per repeat beyond the 3rd** | +10, +0.5 (repeat bonus +5/level) |
| 4 | Simple | Noun + intransitive V | BIRDS FLY | 2 | 25 × 2 | +15, +1 |
| 5 | Descriptive | Noun + linking V + Adj | PIZZA TASTES GOOD | 3 | 30 × 3 | +15, +1 |
| 6 | Transitive | Noun + transitive V + Noun | CAT EATS FISH | 3 | 40 × 3 | +20, +1 |
| 7 | Ditransitive | Noun + TV + Noun + Noun | I GIVE HIM FISH | 4 | 50 × 4 | +25, +1.5 |
| 8 | Compound | [clause] + Conj + [clause] | CATS RUN AND DOGS SLEEP | 5+ | 60 × 4 | +30, +1.5 |
| 9 | Object Complement (5형식) | Noun + selected TV + Noun + Noun/Adj | I MADE HIM HAPPY | 4 | 75 × 5 | +35, +2 |
| 10 | Interrogative | interrogative/auxiliary opener + subject/predicate | ARE YOU READY | 2+ | 90 × 5 | +40, +2 |
| 11 | Negative | clause containing NOT/NEVER or a negative contraction | SHE ISNT HERE | 3+ | 110 × 6 | +45, +2.5 |
| 12 | Complex | subordinator + [clause] + [clause] | BECAUSE IT RAINED I STAYED HOME | 5+ | 130 × 6 | +50, +2.5 |

(Values are placeholders in `balance.ts` under `patterns`; the hierarchy is preserved from the old ranks.)

Design intent:

- **Outcry** gives vowel-less interjections (shh, brr) a home in the pattern table.
- **Imperative requires an object (verb + noun)** — a bare verb no longer scores (changed: "RUN" alone once counted as a 1-phase high-card, but in play a lone verb tile spiked the projection off a single submission, so the pattern now needs at least a verb and a noun). The fun of verb repetition still has a home in **Chant**, preserving the RUN×4 showcase as its own pattern.
- **The Chips×Mult ladder climbs together** — both sides grow from #1→#12, so structural sentences (higher Mult) reward suit/emoji tile Chips investment more. The "structural sentences pay off big" principle from §7.3 now lives in the Mult column rather than a separate multiply-the-total op.
- **#7–12 are tight-to-impossible in the base 5 phases** — the reason to seek future phase-extension effects is built into the table itself.
- **Object Complement uses a controlled verb family** (`MAKE/CALL/FIND/NAME/KEEP/CONSIDER/ELECT/PAINT` and inflections), because POS alone cannot distinguish `I GIVE HIM FISH` (Ditransitive) from `I MADE HIM HAPPY` (Object Complement).
- **Interrogative does not require a Question Mark tile.** An interrogative word or auxiliary opener is sufficient. This preserves the alphabet-only pouch rule (§2.1).
- **Elliptical WHY questions count.** `WHY ME` is parsed as `WHY [IS IT] ME`; the understood predicate need not be played.
- **Negative contractions omit apostrophes on tiles:** `DONT`, `ISNT`, `ARENT`, `CANT`, etc. are valid words for pattern judgment.
- **Complex requires two complete clauses** after an initial subordinator such as `BECAUSE`, `WHEN`, or `IF`.

### 5.3 Unison Bonus (the flush substitute)

One rule replaces the v0.1 tone-overlay table:

> **Unison.** If the sequence has 2+ words and *all* words share one suit, a bonus applies, sized by suit rarity: **Standard +50 Chips · Formal ×1.25 · Slang ×1.5 · Vulgar ×2** (placeholders).

Unison folds directly into the §5.2 formula: **Standard adds to the Chips side; Formal/Slang/Vulgar multiply the Mult side** (values unchanged). It therefore amplifies the pattern's Chips — a register-mult Unison with *no* pattern (no Chips to multiply) contributes nothing, unlike the retired scheme where Unison multiplied the whole committed total. This preserves the flush role ("commit to one suit across phases → reward") within one bonus. All richer combination rules (Hypocrite, etc.) live in emoji tiles.

Note on Vulgar stacking: suit base ×3 plus Unison-Vulgar ×2 is an intentional double reward (jackpot identity), with the ladder deliberately gentler than the v0.1 Tirade (×3) draft. Exact values are playtest material.

### 5.4 Constellation Mapping (level-up consumables)

Each pattern pairs 1:1 with a Constellation card (§10.2), Balatro-Planet style. Leveling is now **uniform**: each use raises that pattern's base by its `+Chips, +Mult` per-level values (the §5.2 right column) — the old multiplier-only vs flat-only split is gone.

| Constellation | Levels up | Per level (placeholder) |
|---|---|---|
| Libra / 천칭자리 | Outcry | +10 Chips, +0.5 Mult |
| Leo / 사자자리 | Imperative | +10 Chips, +0.5 Mult |
| Aquarius / 물병자리 | Chant | +10 Chips, +0.5 Mult (repeat bonus +5 Chips/level) |
| Aries / 양자리 | Simple | +15 Chips, +1 Mult |
| Taurus / 황소자리 | Descriptive | +15 Chips, +1 Mult |
| Gemini / 쌍둥이자리 | Transitive | +20 Chips, +1 Mult |
| Cancer / 게자리 | Ditransitive | +25 Chips, +1.5 Mult |
| Virgo / 처녀자리 | Compound | +30 Chips, +1.5 Mult |
| Scorpio / 전갈자리 | Object Complement | +35 Chips, +2 Mult |
| Sagittarius / 궁수자리 | Interrogative | +40 Chips, +2 Mult |
| Capricorn / 염소자리 | Negative | +45 Chips, +2.5 Mult |
| Pisces / 물고기자리 | Complex | +50 Chips, +2.5 Mult |

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
- **Out of scope (for now):** leveling letter hands (Constellation cards level sentence patterns only) and emoji tiles keyed to letter hands — see §12 open items.

---

## 6. Core Loop: Phases, Hand & Discard

### 6.1 Loop Skeleton (one blind)

Blind starts → shuffle the bag (68-tile deck) → fill the hand (e.g. 11 tiles) → **[Phase: spell a word from hand tiles → submit → settle → draw back up by the number of tiles used]** repeat → early end or phases exhausted → blind ends; all used tiles return to the bag.

This parallels Balatro exactly: cards played within a blind do not return until the blind ends; the deck (bag) is a permanent, sculptable asset (§2, §9–10).

### 6.2 Hand Size — 11 (a balance knob)

Baseline hand size **11** (placeholder within the 10–12 band). Larger than Balatro's 8 because poker *selects* from a hand while this game must *spell* — more degrees of freedom are needed; larger than Scrabble's 7 because Scrabble extends existing board letters while this game builds standalone words. Hand size is an adjustable resource like Balatro's: vouchers +1, certain bosses −2. This single number is a primary difficulty lever; tune against "average word length achieved" in playtests.

### 6.3 Discard — per-blind budget (Balatro-aligned; playtest-02 A-1)

Mirroring Balatro's discards (3 per blind, up to 5 cards each): **4 discards per blind, up to 5 tiles each** (structure confirmed; values are placeholders). **Discarded tiles exit play for the rest of the blind** — they move to the discarded pile (like played tiles) and are NOT returned to the bag mid-blind; the same number are drawn from the remaining bag. Discarded tiles return to the bag only when the blind ends. (Earlier design returned tiles to the bag immediately; that was dropped in favor of the Balatro-aligned semantics so a discarded letter can't be redrawn within the same blind.)

The budget is **per blind, not per phase** — this is the point. Sharing the budget across phases creates inter-phase resource management ("burn discards now or save them for later phases"). A per-phase allowance would reduce it to a resetting convenience with no strategic weight.

### 6.4 Gibberish Submission (the high-card equivalent) — decision b-2

Letter scores are intrinsic tile value, so they must be recoverable regardless of word validity. Therefore:

- Any tile set may be submitted even if it is not a dictionary word.
- **Payout:** sum of letter Chips × 1.0. No suit (hence no suit multiplier), no POS.
- **Sequence effect (b-2):** the gibberish entry is recorded as a **hole** in the sentence sequence. Under whole-sequence matching (§5.1) a hole voids all pattern matches. Correction Tape removes a hole.
- **Letter hands (§5.5):** even as a hole, a gibberish submission can still score the gibberish-eligible letter hands — **Vowel Flush** and **Straight**. The Straight jackpot (dumping Q-R-S-T-U-V) is the headline case; suit/POS stay null and the hole is still recorded.
- **Emoji tile interaction:** layer-1 (letter-level) emoji tiles fire on gibberish; layer-2/3 naturally cannot because suit and POS are null. R9 Dadaist is the explicit exception: it supplies Slang only for word scoring and applies ×2 Mult, while POS remains null and the sentence hole remains. No other rule is silently restored.
- **UI note:** the projected-score preview (§7) shows the sentence bonus collapsing the moment a gibberish submission is staged — the rule explains itself without warning dialogs.
- **UX surfacing (playtest-01 P0-3):** when staged tiles are not a valid word, the staged preview must say so explicitly (e.g. *"Not a word — submit as gibberish: +N chips, breaks the sentence"*) and the play button relabels to *Submit gibberish*. With the escape valve visible, the "my phase was wasted" complaint becomes impossible.

### 6.5 No Minimum Word Length

The Scrabble-style 2-letter floor is **removed**. Scrabble needs the floor because turns are unlimited; here **phases are the scarce resource**, so opportunity cost self-regulates cheap plays. Two ripples, both welcome:

- **"I" and "a" become budget sentence parts.** I (pronoun) + RUN (verb) = Simple in 2 phases. Opens a rush/sentence hybrid line; meshes with Emoji Tile C8 Short & Sharp.
- **1-tile gibberish = a paid mini-discard.** Dumping one dead tile spends a phase (and leaves a hole) instead of discard budget — a deliberate discard↔phase↔hole currency triangle.

The removed minimum-word-length floor stays removed globally. (It was once slated to return as a boss rule — "The Editor" — but the 2026-07-21 boss roster dropped that boss; no current boss re-imposes a length floor. §8.3.)

### 6.6 Bag Depletion — the natural cap on long blinds

If the bag empties mid-blind, **no refill**; play continues on the remaining hand. Normally irrelevant (68 tiles), but any future phase-extension build remains physically capped by its available tile supply.

---

## 7. Scoring Pipeline

Score uses the same **Chips × Mult** structure as Balatro. Because the sentence bonus requires viewing all phases, settlement is two-layered rather than per-hand independent.

### 7.1 Two-Layer Settlement + Projected Score

- **Layer 1 — individual word score (settled immediately).** On each phase submission, (letter score × suit multiplier × emoji tiles) is settled and accumulated immediately. Irreversible. Secures per-phase feedback.
- **Layer 2 — sentence bonus (projected → final).** Each phase, the "sequence so far" is judged (§5) and the projected score is updated — **overwrite, not accumulate**. The bonus is finalized from the sequence at the moment the blind ends.

> **Displayed round score = committed ONLY (playtest-04 A — canonical fix for "score drops").** The big round number on screen is the **committed** score (layer 1) and **never decreases** — it climbs, per beat, during each word's settle. The **sentence bonus is a separate on-screen forecast** ("if the sentence ends like this: +N"), a ghost near the target, not part of the committed number. Merging the two (showing committed + projected as one number) makes a pattern-breaking word *lower* the total — the exact bug this split removes. The bonus resolves visibly in the settle sequence (§7.2) when it's the deciding factor.

> **Why "overwrite"? — resolving the double-counting problem.** Committing the sentence bonus every phase creates double-counting/cancellation problems. Instead, separate the committed score and the projected score, and re-judge the entire sequence wholesale each time. Re-judgment cost is negligible (short sequences). Fully compatible with variable phases: whatever the phase count, only the end-of-blind sequence matters.

### 7.2 Auto-Settle & Phase Economy (playtest-03 B — replaces the early-end button)

The old "cash-out button unlocks at projected ≥ target" was a fake choice: surplus score is worthless and remaining phases pay gold, so continuing past the target was always wrong. **Auto-settle** removes the non-choice.

- **Trigger.** After a submission's **full settle sequence** (word settle → letter-hand/suit stamps → **sentence-finalize animation**: pattern + unison bonuses visibly landing on the score), if the total ≥ target the blind auto-resolves to **Fee Settlement** — the round number rolls up, then after a short verdict beat the settlement modal opens (there is **no** intermediate "Cleared! + Settle button" screen; item 4 removed it — the modal's own Collect button confirms). There is no cash-out fake choice: it never offers to continue past target, so surplus score stays worthless and remaining-phase gold still rewards a fast clear. The sentence bonus must be *seen* pushing the score over when it is the deciding factor — this is the game's highlight moment, so the beat lets it land before the modal covers the board.
- **Remaining phases = money.** Unchanged: 1 gold per remaining phase, paid as a Fee Settlement line item (§9.1).
- **Redefinitions.** *Early end* := a blind cleared with ≥1 phase remaining (now automatic, not chosen). A 1-phase clear of a 5-phase blind still pays more remaining-phase gold than a last-phase clear; the confirmed Rare/Legendary roster no longer adds the retired Rush Specialist or Loan Shark bonuses.
- **Boss exceptions.** The auto-settle machinery keeps two dormant hooks for boss variations that don't yet exist in the roster: `earlyEndDisabled` (would force a single settlement check after all phases are used — the old "Perfectionist") and `previewHidden` (would hide the projection so the auto-clear arrives unpredictably — the old "Blindfold"). The current 12-boss roster (§8.3, 2026-07-21) sets neither; the flags remain in the engine so such a boss can be added without re-plumbing. Ancient Paper (`ancientPaper`) is a *different* info attack — it hides only vowel-tile identities, not the projection.

### 7.3 Sentence Bonus = base Chips × Mult (unified)

Every pattern owns a base **[Chips × Mult]** (§5.2); the sentence bonus is `(patternChips + 15×modifiers + unisonChips) × (patternMult × unisonMult)`, **added** to the committed total at finalization. There is no per-pattern "+ vs ×" operation — the strong/structural patterns simply carry a higher Mult (and Chips). This replaces the v0.2 add/multiply split.

> **Balance warning — high-Mult sentences × projected-score preview.** Because the bonus's Mult amplifies its own Chips (pattern base + modifiers + Standard Unison), high-Mult patterns still spike hard when the player also stacks Chips. If "one more phase visibly doubles the forecast" no one ends early. This is both an intended temptation and a balance pressure point — how easily/often high-Mult sentences can be made governs game tempo. The #1 playtest observation point.

### 7.4 Final Pipeline Summary

**Each phase:** submit word → settle & accumulate individual score (letter × suit multiplier × emoji tiles) → re-judge sentence with current sequence → display updated projected score (pattern bonus + unison) → once the full settle sequence has played, if projected ≥ target the blind's clear is detected and, after the sentence bonus lands and a short beat, it auto-resolves to Fee Settlement (§7.2 — no early-end button, no intermediate verdict screen).

**On ending (early/final):** finalize the sentence bonus from the sequence — `(patternChips + 15×modifiers + unisonChips) × (patternMult × unisonMult)` per §5.2, Unison folded in (§5.3) — add it to the committed total → grant 1 gold per remaining phase → end blind.

### 7.5 Variable Phases

Base 5 phases per blind. Future effects may increase it; the player may also end
in a single phase. Longer sentences seek pattern/modifier value, while fast
clears preserve remaining-phase gold. The confirmed Rare/Legendary roster no
longer hard-codes the retired Rush ↔ Epic Poet pair.

---

## 8. Blinds, Antes & Bosses

### 8.1 Terminology (corrected in v0.2)

- **Blind** = one round. Grants phases (base 5) + an discard budget; cleared by exceeding the target score. Early-end and remaining-phase rewards operate at this unit.
- **Ante** = a set of 3 blinds: **Small → Big → Boss**. The base target rises per ante.

All v0.1 uses of "ante" in the scoring chapter meant "blind" and are corrected throughout.

### 8.2 Scaling & Run Length

Balatro-mirrored: per-ante base score with **Small ×1 / Big ×1.5 / Boss ×2**; exponential growth between antes (Balatro's curve steps roughly ×1.6–2.5 per ante — exact curve is playtest material, tuned together with the emoji tile power curve). **A run = 8 antes + endless mode** (default, adopted as-is). **Victory (implemented):** clearing the ante-8 Deadline ends the run as a win — the engine flags it (`BlindOutcome.won`) while still paying out and advancing the run, and the UI routes to the run-end screen's win framing, skipping Fee Settlement and the shop. **Endless mode (planned, not yet implemented):** the win modal will gain an "무한 모드 →" button that routes into the normal Fee Settlement → shop flow and continues record-chasing chapters (ante 9+ target formula comes with it).

**Blind skip & tags: deferred.** Adoption itself is on hold, not just the tag pool. Recorded implication: with no skip, every blind is a mandatory stop, removing one tempo-variation tool; in Balatro, skipping doubles as a recovery route for weak early builds (rush to shops for jokers). **Trigger to revisit:** if playtests show unrecoverable early runs when emoji-tile luck is poor.

### 8.3 Boss Pool — Design Principles & 12 Bosses

Balatro bosses work because they (1) attack **one system at a time** (readable), (2) are crippling or harmless **depending on the build** (build check), and (3) always have **counterplay** (jokers/consumables). Applying that to our systems — score output, suits, POS, sentences, phases, discard, hand, preview, economy. The roster is themed to the publishing frame (each boss is a kind of paper/document); its engine ids are the semantic names in parentheses (see `src/engine/bosses.ts`), and each carries a pixel-art emblem in `docs/Arts/`.

**Score / target attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| Wanted · 수배 전단 (`wanted`) | Extra-large blind — target ×2 | Raw check on total scoring throughput; a pressure blind |
| Will · 유서 (`will`) | Base Chips **and** Mult halved (×0.5 each) | Attacks every build's base output; rewards patterns/multipliers |
| Forbidden Paper · 금서 (`forbiddenPaper`) | Only one suit may be played this blind — once a suit is established, words of any other suit void to 0 (gibberish exempt) | Forces original-suit unison; Tower of Babel cannot bypass legality |

**Suit / POS attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| White Paper · 백지 (`whitePaper`) | Vulgar-suit words score 0 (debuffed) | Counter to Tyrant builds |
| Burnt Paper · 그을린 종이 (`burntPaper`) | Verb-POS words score 0 (debuffed) | Blocks Imperative/verb lines; noun & Wild-POS builds shine |

**Repetition attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Memoirs · 회고록 (`memoirs`) | Any word already played **this ante** (Draft + Revision + earlier Deadline phases) scores 0 | Punishes narrow vocab; rewards run-long breadth |

**Debuff readability (changed 2026-07-29).** A word that an active boss will
reduce to 0 remains playable, but the staged tiles receive a red **Not Allowed**
tag before submission. Playing it shows the same warning and keeps the submitted
word in the sentence tray with a disabled/desaturated treatment. This applies
uniformly to Forbidden Paper, Memoirs, Burnt Paper, and White Paper; the boss
data predicate is the source of truth for both scoring and preview UI.

**Phase attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| History Book · 역사책 (`historyBook`) | This boss blind has **2 fewer phases** (base 5 → 3, minimum 1); other blinds are unchanged | Pressure blind; makes Rotary Press harder to activate |

**Loop-resource attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| Contract · 계약서 (`contract`) | Start with 0 discards | Raw exposure to draw luck; gibberish escape valve appreciates |
| Budget Book · 가계부 (`budgetBook`) | Hand size −3 | Squeezes word length and options; a smaller build space |
| Unopened Letter · 미개봉 편지 (`letter`) | Each play discards up to 4 random hand tiles (they exit play, refilled from the bag) | Disrupts planned holds; churns the hand every phase |

**Information attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Ancient Paper · 고대 문서 (`ancientPaper`) | All vowel tiles are dealt **face-down** — identity hidden until played; they score normally | Info-denial; spelling by feel — the face-down archetype (Balatro's face-down cards) |

**Economy attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Bond · 채권 (`bond`) | −$1 per **tile** played this blind | Pressures Miser / Interest Glutton economies (values tied to §9) |

### 8.4 Finisher Bosses

**Retired (2026-07-21).** The earlier design carried two ante-8-only finishers (The Proofreader, Babel) on top of a 12-boss pool. The publishing-frame roster above is a single flat pool of **12**, drawn randomly each ante including ante 8 — there is no separate finisher tier. Memoirs (`memoirs`) inherits the Proofreader's "already-played words are dead" idea, scoped to the ante rather than the whole run. A dedicated ante-8 finisher may return later; if so it is added to this section, not folded silently into §8.3.

**Pool intent:** the 12 bosses cover each system roughly once, and major builds
among the current §11 Emoji Tile roster have readable checks (Rotary Press ↔
History Book, Tyrant ↔ White Paper, Tower of Babel ↔ Forbidden Paper, narrow
vocabulary ↔ Memoirs, economy ↔ Bond). Bosses draw randomly from the pool per
ante, Balatro-style.

**Debuff convention.** "Debuffed" (White Paper, Burnt Paper, Memoirs) means the affected word scores **0** — its Chips and Mult are both zeroed after emoji tiles, mirroring Balatro's disabled cards (decision 2026-07-21).

---

## 9. Shop & Economy

### 9.1 Money Sources (four streams)

| Source | Amount (placeholder) |
|---|---|
| Blind clear reward | Small 3 / Big 4 / Boss 5 gold |
| Remaining phases on blind end | 1 gold per phase |
| Interest | 1 gold per 5 held, **cap 5** (max interest from 25 gold) |
| Selling emoji tiles | Half of purchase price |

> **Interest is the heart** (adopted as-is): the cap creates the "save to 25, spend above it" rhythm and the early-game conflict between buying Emoji Tiles and building an interest base. Miser converts held gold into current Mult, while R10 Interest Glutton converts interest actually received into next-round Mult; Bond (§8.3) pressures both economies.

### 9.2 Shop Layout — five stalls

Balatro-mirrored: **Item slots ×2** + **Pack slots ×2** + **Voucher slot ×1**. Item-slot base type weights are **Emoji Tile 80 · letter tile 10 · Fable 5 · Constellation 5** (`balance.ts` `shop.itemWeights`). Unavailable types are removed and the remaining weights are normalized: letter tiles still require EN-KO Dictionary, and Encyclopedia still enables their modifiers. Story Book/Novel and Bible/The Law retain their ×2/×4 multipliers on the corresponding base weight. Gambler cards do not enter ordinary item slots; their existing Comic Book-gated Fable-Pack route remains unchanged. **Reroll:** base 5 gold, +1 per reroll, refreshes item slots only.

**Offer interaction (pack rollback 2026-07-30).** Shop stalls are image-first. Emoji Tiles, consumables, and the vertical voucher use the shared rounded `124×165px` stage. Sale packs use the requested older `131×229px` foreground with square corners. Their row slots match the 131px art width, preserving the normal 12px gap between packs, and the pack panel reserves enough lower space for the attached Open button to remain inside the persistent run layer. The price tag shares one foreground layer with the product and action. Selecting an offer raises that complete layer by 59px — the 15px base lift plus the 44px action-button height — and reveals the attached action: **Buy** for ordinary stock, **Redeem** for the voucher, and **Open** for packs. This does not reflow the stall layout. When an instant-use option exists, Buy remains below while **Use now** appears vertically centred outside the product's right edge. Product animation is never clipped. Voucher and pack background panels retain a `273px` minimum height. Only one offer action is expanded at a time; sold stalls render as empty placeholders.

**Persistent framing (changed 2026-07-28).** The shop is a lower panel on the same run table as the blind. The sidebar resets score/Chips/Mult/hand/discard readouts and displays SHOP; owned Emoji Tiles, consumables and the pouch remain mounted. Because the sidebar and settlement provider stay mounted, shop entry also consumes the previous blind's UI-only settle log/id and finalized sentence fields before the first shop frame; the zero reset is immediate and must never replay the prior score animation.

**Full consumable slots and shop consumables (changed 2026-07-29).** A full held-consumable zone disables **Buy** for a consumable offer. An affordable shop Constellation still offers **Use now** even when the zone is full: it charges the same price, levels its pattern immediately, and never occupies a resting slot. A shop-offered Fable whose effect targets letter tiles is the exception: it shows **Buy only**, enters a held slot, and may be used only during a blind; it cannot use pouch tiles from the shop and has no Use-now fallback when slots are full. Blind-only Fables follow the same Buy-only presentation.

**No duplicate live offers (changed 2026-07-29).** Item slots cannot show the same item id twice in one stock roll, even when repeated pool entries supply type weights. Pack slots cannot show the same type/size pair twice in one shop.

**Voucher slot rules (playtest-03 C).**
- **Reroll never refreshes the voucher slot** — it is immune to rerolls.
- **One voucher purchase per chapter (ante)**; only an effect that explicitly grants extra purchases can exceed this. Buying greys the slot for the rest of the chapter.
- **Restock timing:** the voucher slot restocks when the Deadline (boss blind) ends — the *next* chapter's shop carries the new voucher. Within a chapter, the same voucher persists across the Draft/Revision/Deadline shops.
- **Reappearance (Balatro-style):** purchased vouchers never reappear this run; **unpurchased** vouchers stay in the pool and may reappear in a later chapter (preserves "buy now or gamble on later").

**Emoji tile pricing (placeholder):** Common 4–5 / Uncommon 6–7 / Rare 8–10 / Legendary 20.

**Emoji tile appearance rates by rarity (placeholder → `balance.ts` `emoji.rarityWeights`).** Balatro's reference distribution, adopted as the tuning start point: **Common 70% · Uncommon 25% · Rare 5%**. **Legendary (5 tiles) never rolls from the shop or ordinary Charm Packs.** Its designed acquisition route is the Phoenix Gambler card (§10.3), which creates one random unowned Legendary. Until the Gambler registry is implemented, Legendary tiles remain unobtainable in runtime play.

**Profile lock filter (design confirmed 2026-07-29; implementation pending).**
Common, Uncommon, and Rare use an immediately available starter subset plus
individual unlock conditions. Only an **unseeded** run advances or earns those
unlocks. A locked non-Legendary tile is excluded from shop stock, Charm Packs,
Fable creation, Crane-and-Sun random creation, and every future non-Legendary
acquisition route. Legendary has no unlock gate: Phoenix always draws from all
five unowned Legendary definitions. The 116-tile roster is fixed; starter
membership and persistent achievement tracking remain pending.

**No duplicate Emoji Tiles (rule, expanded 2026-07-29).** A run cannot acquire
an Emoji Tile it already owns. This applies to shop stock and purchase, Charm
Pack offers and picks, Fable-created random tiles, and every other random or
direct acquisition path. The pool shrinks as a run goes long (intended), and
selling a tile returns it to the pool. **Copy Editor is the explicit exception:**
while owned, duplicate offers and acquisitions are allowed, but slot limits
still apply.
**Exception — only an explicit effect may break this.** Boar (§10.3) is the
designed exception: it creates a copy of one random owned Emoji Tile and destroys
the others. Its copy may duplicate the selected definition; Negative itself is not
copied. Until the Gambler registry is implemented, no runtime path bypasses the
shared ownership gate.

### 9.3 Packs — where materials & fonts enter the economy

Tile acquisition is pack-select by default. **EN-KO Dictionary** also allows individual letter tiles to appear in shop card slots; **Encyclopedia** lets those shop tiles roll material, font, and edition modifiers.

**Five pack types in the design** (publishing-world names; Balatro analogs in parentheses), each rolling at one of **three sizes**. *(Changed 2026-07-27: the third consumable pack returns as the **Ink Pack** — the source of the Gambler cards (§10.3) — so the consumable packs are Fable / Ink / Constellation. The older Forbidden Stacks / Spectral naming stays retired. All five packs below now roll in the shop.)*

| Pack (ko / en) | Contents | Analog |
|---|---|---|
| 별자리 팩 / **Constellation Pack** | Constellation cards — selected and **used immediately inside the pack** to level up their sentence pattern (§5.4), independent of held-slot capacity. Deer may replace a choice at a very low rate once the Gambler registry lands (§10.3). | Celestial |
| 부적 팩 / **Charm Pack** | Emoji tile choices | Buffoon |
| 우화 팩 / **Fable Pack** | Fable card choices (§10.1) plus ten seeded pouch tiles used as the candidate field for tile-targeting Fable effects. Fables resolve inside the opened pack; blind-only Fables are selected into a held slot instead. Comic Book can add Gambler cards once that content pool lands | Arcana |
| 잉크 팩 / **Ink Pack** | Gambler card choices (§10.3), plus ten seeded pouch tiles as the candidate field for tile-targeting Gambler effects | Spectral |
| 타일 팩 / **Tile Pack** | Letter tiles; enhanced (material/font) variants may appear pre-attached | Standard |

**Sizes (all types):** **Normal** — 3 shown, pick up to 1 · **Jumbo** — 5 shown, pick up to 1 · **Mega** — 5 shown, pick up to 2 (Balatro's exact structure). Prices placeholder **4 / 6 / 8** by size (`balance.ts` `pack.size`). Shop pack slots roll any type × size; Mega/Jumbo are rarer (weights in `balance.ts` `pack.typeWeights` / `pack.sizeWeights`). **Four families have supplied art** (`src/ui/packArt.ts`): **Tile** 8 (Basic ×4, Classic ×2, Premium ×2), **Charm** 4 (Basic ×2, Classic, Premium), **Constellation** 8 (Basic ×4, Classic ×2, Premium ×2), and **Ink** 4 (Basic ×2, Classic, Premium); **Fable** awaits art. All 24 runtime illustrations are 32-color, path-only SVGs normalized to a shared `244×400` canvas and `122×200` logical grid; source PNGs remain in `docs/Arts/CardPacks`. Each pack has an idle animation and a shared open sequence (shake → burst → cards fly in).

**Appearance weights (placeholder → `balance.ts`).** Balatro's shape, mapped onto our five families. Type weights (`pack.typeWeights`): **Fable 4 · Constellation 4 · Tile 4 · Charm 2 · Ink 0.6** — the two consumable staples and tiles are the common backbone, Charm (emoji tiles) is deliberately scarcer because each pull is a build decision, and Ink is the rare thrill (Spectral's role). Size weights (`pack.sizeWeights`): **Normal 8 · Jumbo 3 · Mega 1**. Type/size pair weights are their product and shop pack slots draw those pairs without replacement, so duplicate packs cannot appear together. All values are tuning starts for `src/sim`, not claims of balance.

**Cross-family Gambler rolls (design confirmed 2026-07-29; values B0 placeholders).**
Without Comic Book, a Fable Pack has exactly **0%** chance to contain a Gambler
card. With Comic Book owned, each Fable choice has a **5%** replacement chance,
capped at one Gambler card per pack. Deer is a separate exception that may replace
one Constellation choice at **1% per pack**, also capped at one. These rolls use
the seeded RNG and their values live in `balance.ts`
(`pack.gamblerInFableChance`, `pack.deerInConstellationChance`).

> **Impl note (updated 2026-07-30).** All **five** engine pack types × 3 sizes ship (weights, prices, opening UI). Tile/Charm are complete; the Fable pool contains the 18 implemented cards in §10.1; Constellation offers the 12 zodiac pattern cards; the **Ink Pack** offers the 12 implemented Gambler cards (§10.3) and deals the same ten-tile pouch candidate field a Fable Pack does. Selecting a Constellation in its pack reveals **Use**; it levels the mapped pattern directly and never enters the held consumable zone. A Gambler chosen in a pack follows the Fable confirm-then-**Use** flow and resolves against those candidates. Comic Book is required before a Gambler can rarely replace a Fable-Pack choice; Deer may very rarely replace a Constellation-Pack choice. *(Changed 2026-07-30: Comic Book previously mixed **Constellation** cards into Fable packs — a placeholder while the Gambler registry was missing. It now does what §9.4 says: adds Gambler cards.)* Code ids stay semantic (`PackType` = `pattern | joker | consumable | tile | ink`); display names are i18n-only.

### 9.4 Vouchers — 16 base + 16 upgraded

Changed 2026-07-26: the former 9-item single-tier set is retired. Every pair has a base voucher and a profile-unlocked upgrade. An upgrade can enter the run pool only after its profile condition is met **and** its base voucher is owned in that run. One purchase per chapter and fixed chapter offers still apply.

**Collection disclosure (changed 2026-07-27).** A profile-locked upgrade is
listed as **Undiscovered / 발견되지 않음**. Its Collection tooltip shows only the
unseeded-run redemption hint; its real name, effect, unlock condition, and
progress remain hidden until the profile unlock is earned.

| Base → Upgrade | Base effect → upgraded effect | Upgrade unlock |
|---|---|---|
| Story Book → Novel | Fable shop weight ×2 → ×4 | Buy 50 Fable cards from shops |
| Bible → The Law | Constellation shop weight ×2 → ×4 | Buy 50 Constellation cards from shops |
| Fashion Book → Fashion Magazine | Reroll −$2 → an additional −$2 | 100 shop rerolls |
| Flyer → Wanted Poster | Foil/Holo/Poly rate ×2 → ×4 on letter tiles and Emoji Tiles | Own 5 editioned Emoji Tiles at once |
| Newspaper → Papyrus | Shop cards/packs 25% off → 50% off | Use 10 vouchers in one run |
| Memo → Notebook | +1 phase per round → another +1 | Play 5,000 tiles |
| Poetry Book → Sheet Music | +1 discard per round → another +1 | Discard 5,000 tiles |
| Four-cut Photo → Picture Diary | Hand size +1 → another +1 | Reduce hand size to 8 |
| EN-KO Dictionary → Encyclopedia | Shop may sell plain tiles → shop tiles may carry material/font/edition | Buy 20 shop tiles |
| Receipt → Household Ledger | Interest cap $10 → $20 | Hit the interest cap 10 rounds consecutively |
| Sketch Book → Portrait | One boss reroll per chapter for $10 → unlimited $10 rerolls; the control is available only on Blind Select when the current blind is the Deadline, never while it is merely upcoming | Discover all 12 current bosses (temporary cap) |
| Catalog → Coupon Book | Shop card slots 3 → 4 | Spend $2,500 in shops |
| History Book → Old Book | −1 Chapter and −1 hand size → another −1 Chapter and −1 discard/round; each redemption preserves the already-scheduled blind kind/index | Reach Chapter 12 |
| Blank Paper → Kung Fu Manual | No effect → +1 Emoji Tile slot | Use Blank Paper 10 times |
| B&W Photo → Yearbook | Constellation pack guarantees the most-played pattern's card → a held matching card grants ×1.5 sentence Mult | Use 100 Constellation cards |
| Zero Score → Comic Book | +1 consumable slot → Gambler cards may appear in Fable packs | Use 50 Fable cards |

All voucher tuning values live in `balance.ts`. Profile progress lives at `wj.vouchers`, outside `RunState`.

**History Book timing (changed 2026-07-29).** Redeeming History Book immediately lowers the current Chapter by 1 (Chapter 1 may become Chapter 0) and lowers hand size by 1. It does not rewind the blind sequence: the Draft, Revision, or Deadline already scheduled after the shop remains scheduled at the same `blindIndex`, now using the lowered Ante's target. Old Book follows the same scheduled-blind rule for its additional Ante reduction.

---

## 10. Consumables

Three families mapping Balatro's trio, themed for a word game. **Held slots: 2** (expandable via Zero Score). **Usable during blinds** — essential: Correction Tape and Shift only matter mid-blind. Acquired from shop item slots and packs.

**Fable Pack resolution (changed 2026-07-29).** A revealed Fable initially has no action button. Selecting its card reveals **Use**; tile-targeting Fables keep Use disabled until at least one and no more than the effect's listed maximum candidate-tile count is selected from the ten seeded pouch tiles, while non-tile effects ignore candidate selection and never animate candidate targets. The candidate field is selectable immediately when the pack opens. While it is open, a compatible tile-targeting Fable already held on the consumable shelf may also use those selected pouch candidates; this is the only shop-phase exception to the normal staged-hand targeting rule. Enabled and disabled Use states occupy the same fixed position. Using previews the resulting letter/material/font/edition on every target and plays the complete card-to-target application animation; the transformed candidate image remains in that committed state instead of reverting when the preview ends. Only after that animation ends does a pack-dealt Fable hold for 0.5 seconds and close (or reflow for another Mega-pack pick). The Fable resolves without occupying a held slot. A blind-only Fable is the exception: selecting it reveals **Select** instead of Use, and Select moves it into a held consumable slot for later blind use (disabled when no slot is free). No additional instant/blind-only classification is added to the card tooltip.

**Constellation Pack resolution (changed 2026-07-29).** A revealed Constellation follows the same select-then-confirm interaction, but its action is always named **Use**, never Select. Use immediately levels the mapped sentence pattern, plays the full Constellation level-up sequence, ignores held-consumable capacity, and does not place the card in a held slot.

**Held-slot presentation (changed 2026-07-27).** A held consumable is the supplied card illustration acting directly as an interactive foreground object. The shelf slot reserves transparent space only: it does not add a second card background, inset image frame, persistent name, or crop. Idle/hover/focus/select motion applies to the image object itself, and clicking raises it above the shelf with Sell/Use actions attached beneath the image without reflowing the shelf.

### 10.1 Fable Cards (Tarot-equivalent), 18

Held targeted effects normally use the tiles currently staged on the board. A
target-requiring held card cannot be consumed until one to its listed maximum valid
target count is staged. While a Fable Pack is open, the same held effect instead may
target the pack's immediately active ten seeded pouch candidates under the same
range. Random creation
respects the destination slot cap.

**Art rendering (changed 2026-07-26).** All 18 supplied pixel illustrations are
high-detail, path-only SVG assets normalized to one `500×700` canvas (fixed 5:7
ratio, 32-color palette, `250×350` logical pixel grid). Every source illustration
is stretched to the full common image bounds established by The North Wind and
the Sun, so all 18 cards have identical visible width and height with no cropping
or unequal internal margins. No SVG embeds a raster image. Collection, shop, pack
opening, and the held-card shelf all reuse the shared framed component. The
original English title plate remains part of each traced illustration; the
localized card name is also available through the surrounding tooltip and
accessible label.

| # | Fable | Effect |
|---:|---|---|
| 1 | The North Wind and the Sun | Magnifier: show up to 3 spellable words in the current hand |
| 2 | The Boy Who Cried Wolf | Create the last Fable or Constellation card used this run; Use/Use now stays disabled until one has been used this run |
| 3 | The Ant and the Grasshopper | Create up to 2 random Fable cards while slots are available |
| 4 | The Golden Axe and the Silver Axe | Turn 2 selected tiles into Lead Plate |
| 5 | The Fox and the Crane | Turn 1 selected tile into Stone |
| 6 | The Tortoise and the Hare | Turn 2 selected tiles into Polished |
| 7 | The Fox and the Sour Grapes | Turn 2 selected tiles into Ceramic (+30 Chips) |
| 8 | The Lion and the Mouse | Turn 1 selected tile into Glass |
| 9 | The Goose That Laid the Golden Eggs | Gain gold equal to current gold, capped at +$20 |
| 10 | The Town Mouse and the Country Mouse | Create up to 2 random Constellation cards while slots are available |
| 11 | The Bear and the Travelers | Turn 1 selected tile into Ivory |
| 12 | Belling the Cat | Turn 1 selected tile into Brass |
| 13 | The Wolf and the Crane | Turn 1 selected tile into Wood |
| 14 | Heungbu and Nolbu | Create 1 random Emoji Tile if an Emoji Tile slot is available |
| 15 | The Cowherd and the Weaver Girl | 1/4 chance to give one random uneditioned Emoji Tile Foil, Holographic, or Polychrome; unusable if none is eligible |
| 16 | The Rabbit and the Turtle | Raise 2 selected tile letters by one alphabet rank; Z wraps to A |
| 17 | The Heavenly Maiden and the Woodcutter | Gain the total sell value of all owned Emoji Tiles, capped at +$50; its tooltip shows the live capped payout from the currently owned Emoji Tiles |
| 18 | Shim Cheong | Destroy 1–2 selected tiles, removing them from the run's pouch |

### 10.2 Constellation Cards (Planet-equivalent) — pattern level-up, 12

One per sentence pattern, 1:1 (full mapping and per-level effects in §5.4). Using a Constellation card permanently levels its pattern: each use raises **both** the pattern's base Chips and base Mult by its per-level values (§5.2) — Balatro Planet behavior. Specializing into the most-played patterns is the intended play.

**Use sequence (changed 2026-07-29).** The used card shakes while the score
panel presents the pattern's current Mult and Chips. The green `+Mult` increment
merges first, then the green `+Chips` increment. The level label then transitions
from the old level to the new one, the shake ends, and the card pixel-dissolves.
The full presentation lasts **3.5 seconds** (changed 2026-07-29: 500ms faster
than the prior 4.0-second timing).
All displayed values are derived from the same §5.2 balance rows used by scoring.

Each of the 12 monochrome zodiac illustrations is traced into a 32-color,
path-only SVG and stretched without cropping to the Fable card standard:
`500×700` output, fixed 5:7 ratio, and a `250×350` logical pixel grid (changed
2026-07-27). Collection, shop, pack, and held-card surfaces all use the same
shared SVG frame component as Fable and Gambler cards. The correctly
spelled `Aquarius.svg` / `aquarius` mapping is retained.

### 10.3 Gambler Cards — 12 implemented, 2 pending

**Gambler cards / 노름꾼 카드** are the third card family (renamed from "Ink
Cards / 잉크 카드", 2026-07-27) and already have a Collection category. Their
designed native source is the **Ink Pack / 잉크 팩** (§9.3) — the Ink name moved
from the family to its pack. Fourteen supplied illustrations are registered in
the UI-only gallery: Barn Swallow, Boar, Bridge, Bush Warbler, Butterflies,
Crane and Sun, Cuckoo, Curtain, Deer, Full Moon, Geese, Phoenix, Rainman, and
Sake Cup (a hwatu/화투 motif set — hence the gambler framing). Each source PNG
is traced into the same 32-color, path-only SVG standard as Fable and
Constellation cards: `500×700`, fixed 5:7 ratio, and a `250×350` logical pixel
grid. All three families use the same shared SVG frame. Twelve effects were
confirmed on 2026-07-29 and **ship as of 2026-07-30** in `src/engine/gamblers.ts`
with every acquisition route wired (§9.3). Rainman and Sake Cup stay deliberately
pending until the Emoji Tile roster is selected: they have art in the UI-only
gallery but **no engine id**, so they can never be drawn. The former Forbidden Books/Spectral placeholder
roster stays retired — the Ink name now belongs to the pack, not to a card
family. The Collection key stays `inkCards` (display-only rename).

**Class (confirmed 2026-07-27): Gambler cards are our Spectral analog.** They are
**rare, powerful, and usually double-edged** — the family that changes a run
rather than nudging it, in the way Balatro's spectrals do (dramatic upside paid
for with a cost or a risk). This justifies the Ink Pack's low roll weight (§9.3,
weight 0.6): the pack is a jackpot, not a staple. The hwatu motif set reinforces
the framing — these are gambles.

**Ink Pack naming: settled.** The pack is the **Ink Pack / 잉크 팩** and the Gambler cards are its contents. The "Forbidden Books / 금서 팩" line stays **deferred** — not revived as a separate sixth pack, not used as an alternate name for this one. Revisit only if a concrete need appears that the five existing families cannot cover.

**Acquisition routing (confirmed 2026-07-29).** Ink Packs are the native route.
A Fable Pack can contain a Gambler card only while Comic Book is owned; without
that voucher the chance is 0 (§9.3 B0: 5% per choice, maximum one per pack).
Deer alone may also very rarely replace a Constellation-Pack choice (§9.3 B0:
1% per pack, maximum one). All rolls use the seeded RNG.

**Target field.** A held Gambler card used during a blind targets the current
hand. A tile-targeting Gambler used directly from a pack instead targets that
pack's seeded pouch-candidate field, following the same preview-before-commit
discipline as Fables. Font changes overwrite only the font axis. Letter
duplication/change preserves material, font, edition, hidden Stone letter, and
per-tile Wood growth unless the individual effect says otherwise. Created tiles
receive new ids and enter the run's pouch permanently.

| # | Gambler card | Effect |
|---:|---|---|
| 1 | Barn Swallow / 제비 | Change one selected letter tile's font to **Black**. Preserve material and edition. |
| 2 | Boar / 멧돼지 | Seed-select one owned Emoji Tile, keep the original, create one complete copy, then destroy every other owned Emoji Tile. Foil/Holographic/Polychrome copy; a Negative original produces a Base copy. This is the explicit exception to unique Emoji Tile ownership. |
| 3 | Bridge / 다리 | Permanently change every tile in the active tile field to one seeded random shared letter A–Z, then permanently reduce hand size by 1. Preserve all modifier axes; for Stone, change the hidden letter. Hand-size floor: **5** (`BALANCE.gambler.bridgeHandSizeFloor`, first-pass tuning value — the card is unusable at the floor). |
| 4 | Bush Warbler / 휘파람새 | Change one selected letter tile's font to **Light Italic**. Preserve material and edition. |
| 5 | Butterflies / 나비 | Permanently destroy 5 seeded-random tiles in the active tile field and gain $20. Unusable with fewer than 5 candidates. |
| 6 | Crane and Sun / 학과 해 | Create one seeded-random unowned Rare Emoji Tile, then set held gold to $0. Unusable without an eligible tile or free slot. |
| 7 | Cuckoo / 뻐꾸기 | Change one selected letter tile's font to **Inline**. Preserve material and edition. |
| 8 | Curtain / 휘장 | Create two complete copies of one selected letter tile in the active field and add them permanently to the pouch. Copy letter/hidden letter, material, font, edition, and Wood growth; assign new ids. |
| 9 | Deer / 사슴 | Raise all 12 sentence-pattern levels by 1. May also appear very rarely in Constellation Packs and resolves immediately without occupying a held slot. |
| 10 | Full Moon / 보름달 | Permanently destroy 1 seeded-random tile in the active field, then create 3 random enhanced vowel tiles using A/E/I/O/U and random non-base materials. Stone is excluded because it would erase the promised vowel. |
| 11 | Geese / 기러기 | Change one selected letter tile's font to **Bold**. Preserve material and edition. |
| 12 | Phoenix / 봉황 | Create one seeded-random unowned Legendary Emoji Tile. Unusable without an eligible tile or free slot. This is the normal-play Legendary acquisition route. |
| 13 | Rainman / 우중인 | **Effect pending** until the Emoji Tile roster and its scaling/decay coverage are selected. |
| 14 | Sake Cup / 사케 잔 | **Effect pending** until the Emoji Tile roster and its probability/duplication coverage are selected. |

**Implementation notes (2026-07-30).** The registry is data + a single
`useGambler(id, run, blind, field, selectedIds, rng)` entry point. `field` is the
**active tile field**: the live hand during a blind, the pack's seeded pouch
candidates inside an opened pack — one code path for both, since tile edits are
applied by id through the same helpers Fables use. Butterflies and Full Moon
report their removals through the shared `tilesDestroyed` event, so Type Foundry
(§11.5 L3) grows off them. A tile-targeting Gambler cannot be used from the shop
(no field exists there) and must be held for a blind, exactly like a
tile-targeting Fable. Gambler use counts toward no voucher unlock: Comic Book
counts Fables and Yearbook counts Constellations (§9.4).

The larger, non-canonical Emoji Tile candidate pool and the design questions left
open by Bridge, Full Moon, and pack targeting live in
`docs/EMOJI_TILE_IDEA_BANK.md`. No candidate in that document becomes canonical
until it is moved into §11.

---

## 11. Emoji Tiles

> **Terminology (2026-07-23).** The player-facing term is **Emoji Tile / 이모지 타일**.
> The engine identifier stays `joker` (`JokerDef`, `src/engine/jokers/`,
> `BALANCE.jokerSlots`) — display terms never rename engine identifiers.

**Roster status (updated 2026-07-30).** The active roster contains **116 authored
definitions**: Common 24 + Uncommon 42 + Rare 45 + Legendary 5. This promotes
the idea bank's 19 Common, 33 Uncommon, and 34 Rare alternatives without
replacing the earlier 30 entries. The separate 97-tile redesign in
`docs/superpowers/specs/2026-07-29-emoji-tile-roster-design.md` remains
postponed and is not an implementation source.

**Implementation status (roster complete, 2026-07-30).** All 116 definitions
ship as data + event hooks, one file each under `src/engine/jokers/`.
**Art is complete:** all 116 definitions have 84×112 pixel
masters registered through the shared resolver. The shared 124×165 runtime
frame is wired to the owned shelf, shop,
opened Charm Pack, held-consumable shelf, and Collection.
The six former proof tiles—Jack of All Trades, Vowel Praise, Consonant
Bricklayer, Hipster, Grammarian, and Rush Specialist—are fully retired and
removed from the registry. Profile unlock filtering and
the Phoenix-only Legendary acquisition route remain pending, so every
definition is deliberately visible to review code paths while Legendary
tiles still have no normal runtime acquisition path.

Two engine notes fall out of the roster pass. **Glasswork (U4)** shrinks the
permanent pouch in its `blindEnd` hook; `onBlindEnded` compares the bag length
around the emit and re-announces the shrink as `tilesDestroyed`, so Type
Foundry (L3) and any future destruction-fed tile see it generically rather than
by special case. **Tyrant (L2)** applies its Vulgar rewrite as an additive delta
from the word's own suit multiplier to `suitMult.vulgar × 2`, which keeps it
independent of shelf order; `submission.suit` stays canonical for bosses,
Unison, and sentence history.

**Unlock model (design retained; implementation pending).** The achievement
conditions listed in the idea bank remain future profile progression. Until
that system lands, all Common/Uncommon/Rare entries participate in their normal
offer pools; Legendary has no normal offer weight and is acquired through Phoenix.

**Emoji tiles** are acquired by shop purchase/draw (§9). Unlike Balatro's jokers, which mostly play in the single layer of "score calculation," emoji tiles play across **3 layers**: **(1) Letter/Tile  (2) Suit (register)  (3) Sentence/Phase**.

**Notation.** Chips = base score, Mult = multiplier, Final = Chips × Mult. **Layer** = 1/2/3. **★** = scaling. All values are balancing placeholders.

**Shelf order = execution order (feature-02 D-1).** Owned emoji tiles fire in their left-to-right shelf order, and that order is **drag-reorderable** on the owned-emoji-tile shelf (persisted in run state). Ordering is strategic in the Balatro sense — an additive emoji tile placed before a multiplicative one is worth more than after it — so reordering is a real decision, not cosmetic.

**Art canvas (changed 2026-07-29).** Every Emoji Tile renders in the shared
shop/owned-card footprint: **124×165px, near-3:4 ratio**. The existing 84×112
pixel masters scale with `object-fit: contain` and nearest-neighbour rendering;
new art targets the runtime frame. It must fit without cropping or distortion
and its defining silhouette must remain readable there. This family does **not** use the 5:7
Fable/Constellation/Gambler canvas or the `244×400` Pack canvas. Shelf, shop,
opened-pack, and Collection surfaces reuse the same source art with
aspect-ratio-preserving scaling. The image asset is the entire visible card:
no wrapper panel, persistent name, edition label, or rarity-colored border.
Names, effects, and rarity live in the tooltip. Art uses one unified
**Pac-Man-style early maze-arcade** pixel language. The existing 30 masters in
`src/ui/assets/jokers/` are the canonical references: deep navy playfield,
white/red/yellow/cyan-led 3–5-color palette, one large blocky silhouette, hard
un-antialiased pixel edges, and a shared sprite scale/line weight. Do not use
painterly object icons, gradients, shadows, scenery, texture, lighting, or tiny decoration.
“Pac-Man-style” describes the common maze-arcade grammar and palette only; never
copy Pac-Man characters, ghosts, maze layouts, or other original assets.
(Changed 2026-07-30: made the previously implicit roster-wide art direction explicit
after a generic pixel-icon interpretation drifted from the intended look.)
Every surface applies the shared idle motion and cursor-following
tilt/sheen directly to that image.

### 11.1 Roles by Rarity

| Rarity | Role | Main layer |
|---|---|---|
| Common | Unconditional pure addition — early foundation | 1 |
| Uncommon | Conditional addition + start of scaling | 1–2 |
| Rare | Multiplication (×Mult) appears + full scaling — acceleration engine | 2–3 |
| Legendary | Rule-breaking — redefines the run (5 total) | 3 |

The compact tables below retain the original 30 entries. The promoted 86 rows
in `docs/EMOJI_TILE_IDEA_BANK.md` §§2–4.2 are equally normative and complete
the active 116-entry roster.

### 11.2 Common — active 24

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| C6 | Ceramic Artisan | +5 Chips per unenhanced base Ceramic tile | 1 | — |
| C7 | Long-Word Fan | +30 Chips if word is 5+ letters | 1 | — |
| C8 | Short & Sharp | +8 Mult if word is 3 letters or fewer | 1 | — |
| C9 | Alphabetical Order | +15 Mult if the word contains consecutive letters | 1 | — |
| C10 | Miser | +1 Mult per 5 gold held | 1 | — |

### 11.3 Uncommon — active 42

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| U1 | Literary Judge | +50 Chips if word is Formal suit | 1–2 | — |
| U3 | Rare Earth | ×3 Chips on that letter when using Q·Z·X·J | 1 | — |
| U4 | Glasswork | +5 Mult per glass tile; 1 glass tile is lost each round | 1 | — |
| U5 | Voracious Reader | +1 Chips per total words made so far, accumulating | 1 | ★ |
| U6 | Classicist | Each Formal word made permanently raises this tile's Mult by +1 | 2 | ★ |
| U7 | Street Cred | Each Slang word made permanently raises Chips by +8 | 2 | ★ |
| U8 | Combo Artist | +6 Mult if different suit from the previous phase | 2 | — |
| U9 | Vowel Magnet | ×1.5 Mult if word has more vowels than consonants | 1 | — |
| U10 | Equilibrist | +40 Chips & +4 Mult if vowel and consonant counts are equal | 1 | — |

### 11.4 Rare — active 45

| ID | Name | Effect | Layer | Scaling / unlock |
|---|---|---|---|---|
| R1 | Carte Blanche | +1 Emoji Tile slot and Emoji Tile shop prices −$2 | 3 | Buy 40 Emoji Tiles from shops |
| R2 | Hypocrite | ×2 Mult if the sentence contains both a Formal and a Vulgar word | 2–3 | Start |
| R3 | Rhyme Chain | If the previous phase's word ends in the same two letters, its blind-only streak multiplier compounds ×1.5; a miss resets the streak | 3 | Start |
| R4 | Out of Print | Whenever one alphabet letter has no copies left in the permanent pouch, permanently gain +25 Chips and +3 Mult | 1 | ★ · Remove every copy of one letter |
| R5 | Stargazer | Starts at ×1; permanently gain +0.15 ×Mult whenever a Constellation card is used | 3 | ★ · Use 30 Constellation cards |
| R6 | Fable Hoard | ×1.25 Mult per currently held consumable | 3 | End 5 rounds with consumable slots full |
| R7 | Anonymous | ×2.5 Mult while every effective Emoji Tile slot is full | 3 | Reach Ante 4 with 5 Emoji Tiles |
| R8 | Censor's Bane | ×2.5 Mult during Deadline/boss blinds | 3 | Clear all 12 bosses |
| R9 | Dadaist | Treat gibberish as Slang for word scoring and apply ×2 Mult; POS remains null and the sentence hole remains | 2 | Clear a blind using only gibberish |
| R10 | Interest Glutton | For every $1 interest received at round end, gain +2 Mult during the next round | 3 | Hold $100 in one run |
| R11 | Rotary Press | On the last phase, retrigger once the committed individual-word scoring log of every word submitted this blind; never retrigger the sentence bonus | 3 | Use 8 phases in one blind |

### 11.5 Legendary — confirmed 5

Legendary tiles have no profile unlock gate. They never appear in shops or
ordinary packs; Phoenix is their only acquisition route and always draws from
all five unowned definitions.

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| L1 | Book of Margins | +3 Emoji Tile slots; after all slot modifiers, this tile applies ×2 per empty effective slot | 3 | dynamic exponential |
| L2 | Tyrant | Treat every valid word as Vulgar and double every Vulgar ×Mult effect | 2 | — |
| L3 | Type Foundry | Starts at ×1; whenever a letter tile is permanently destroyed, compound this tile's factor ×1.5 for the rest of the run | 1 | ★ exponential |
| L4 | Tower of Babel | Each valid word counts as all four suits for suit-trigger conditions. Boss legality and Unison continue to use the word's original suit | 2 | — |
| L5 | Misbound | Starts at ×1. At round end, 1/12 chance to self-destruct; if it survives, permanently gain +0.2 ×Mult | 3 | ★ |

### 11.6 Scaling Axis Distribution

The confirmed Rare/Legendary growth axes deliberately spend different resources.
Common/Uncommon additions may expand the table after their review.

| Scaling axis | Emoji Tiles |
|---|---|
| Total words made | Voracious Reader (U5) |
| Formal suit accumulation | Classicist (U6) |
| Slang suit accumulation | Street Cred (U7) |
| Removing a complete alphabet family | Out of Print (R4) |
| Constellation use | Stargazer (R5) |
| Interest received | Interest Glutton (R10, next-round additive) |
| Empty Emoji Tile slots | Book of Margins (L1) |
| Permanent letter-tile destruction | Type Foundry (L3) |
| Survived rounds | Misbound (L5) |

### 11.7 Core Oppositions & Balance Pressure Points

- **Empty ↔ full shelf.** Book of Margins (L1) rewards leaving effective slots
  empty; Anonymous (R7) works only when every slot is full. They cannot both
  operate at peak efficiency.
- **Destruction cost ↔ destruction engine.** Type Foundry (L3) turns Glass,
  Shredder, Butterflies, Full Moon, and future permanent destruction into
  exponential growth. The shrinking 68-tile pouch is its natural cost; verify
  that it is enough.
- **One suit ↔ every suit.** Unison rewards original-suit commitment. Tower of
  Babel (L4) broadens suit-trigger conditions but explicitly cannot forge
  Unison or bypass boss legality.
- **Rhyme streak.** Rhyme Chain (R3) is a blind-only combo, not a growth tile. It depends on real lexicon clusters and
  draw odds. Measure actual same-suffix streaks rather than balancing from a
  theoretical maximum.
- **Misbound lifetime.** Its +0.2 growth and 1/12 self-destruction must be tuned
  together from expected rounds survived.

### 11.8 Editions (implemented)

Changed 2026-07-26 for the Flyer voucher pair: letter tiles and Emoji Tiles each carry a dedicated edition field. `TileEdition` and `JokerEdition` are separate type unions; neither replaces a letter tile's material/font, and Emoji Tiles still never receive letter material/font modifiers.

| Edition | Effect (placeholder) |
|---|---|
| Base | no edition |
| Foil | +50 Chips |
| Holographic | +10 Mult |
| Polychrome | ×1.5 Mult |
| Negative | occupies no joker slot → **+1 owned-joker slot** |

- **Slot cap.** The owned-emoji-tile cap is `RunState.jokerSlots` (base 5). Kung Fu Manual raises it by 1; each Negative Emoji Tile raises effective capacity by 1.
- **Acquisition:** editions may pre-attach to letter tiles and Emoji Tiles in packs, and to shop tiles unlocked by Encyclopedia. Flyer/Wanted Poster multiply Foil/Holo/Poly odds.

---

## 12. Open Questions & Next Steps

**Resolved since v0.1:** sentence pattern table (→ §5) · in-phase loop (→ §6) · blind/ante structure & boss pool (→ §8) · shop & economy (→ §9) · consumables (→ §10) · round-level suit synergy (→ Unison, §5.3).

**Still open:**

- **Value balancing across the board.** All numbers remain placeholders (emoji tiles, patterns, unison, vouchers, prices, target-score curve). Playtest-driven.
- **Blind skip & tags.** Adoption itself deferred. Revisit trigger: unrecoverable early runs in playtests (§8.2).
- **Starting deck types.** Balatro's Red/Blue/Plasma analogy — bags with different tile compositions (vowel-heavy, rare-letter-heavy, slang-friendly…). Untouched.
- **Stakes (difficulty) & stake-ladder unlock structure.** Replayability layer.
  Untouched; this is separate from the confirmed per-Emoji-Tile profile unlocks
  in §11.
- **Duplicate-offer item (Showman-equivalent).** Boar now supplies a one-shot
  cloning exception (§10.3), but it does not allow duplicate shop/pack offers.
  Whether the candidate Copy Editor Emoji Tile from
  `docs/EMOJI_TILE_IDEA_BANK.md` should fill that broader role remains open.
- **Legendary runtime route.** Phoenix is the designed normal-play route (§10.3),
  while §9.2 still excludes Legendary from shop/Charm-Pack rolls. The 5
  Legendary tiles remain unreachable only until the Gambler engine registry is
  implemented.
- **Acronyms in the lexicon.** Adding MVP/VIP-class abbreviations is requested.
  Tiles are uppercase-only, so acronyms use the ordinary validity/scoring path.
  They are absent from ENABLE-class lists and need a separate curated list
  feeding §3.2's pipeline.
- **Gambler card implementation + final 2 effects.** All 14 artworks and the
  Collection category exist; 12 effects are confirmed, while Rainman and Sake
  Cup wait on the selected Emoji Tile roster (§10.3). The engine registry, Ink
  Pack roll, Comic-Book Fable mixing, Deer Constellation mixing, target
  interaction, and persistence remain unimplemented.
- **Tutorial system.** Layered (first-run guided intro → first-encounter one-time popups → Help/Glossary screen), hosted by **우땅 (WooDak)** per §1's mascot roles; Piyak keeps shop greetings. Work order: `docs/feature-01-tutorial-sound-fontseals.md`.
- **Audio.** Chiptune/8-bit, SFX-first (settle-sequence sounds with pitch-escalating chip ticks before any BGM); real mixer replaces the Settings stub. Same work order.
- **Stakes = matcher-leniency knobs (reframed, playtest-01).** True grammar checking stays out (§4.1 level 3); instead, future stake levels modulate knobs that already exist — modifier absorption on/off, hole forgiveness, unison strictness.
- **Word collection (도감) UI.** First-play-per-word tracking ships now (localStorage; gibberish excluded); the collection screen itself is a later milestone (playtest-01 P2-2).
- **Register/POS dataset build.** Frequency-top curation → seed lists + LLM batch classification → baked table; one-word = one-suit/POS resolution rule (§3.2, §4.2).
- **Finisher boss count.** 2 concepts exist; decide whether the pool needs more for endless-mode variety.
- **Emoji tiles keyed to letter hands (§5.5).** Letter Hands ship without emoji-tile support; a family of emoji tiles that trigger on / scale with specific hands (e.g. "+Mult per Twin this blind", "Straights also give $2") is open emoji-tile material.
- **Emoji Tile balance verification.** The 116-tile active roster is implemented.
  Run 8-Ante and endless simulations over the promoted Common 19, Uncommon 33,
  and Rare 34 effects; the separate 97-tile redesign remains postponed.
- **Emoji Tile profile unlock implementation.** The unseeded-only unlock rule and
  locked-pool exclusion are confirmed (§9.2, §11), but the final starter subset,
  achievements, profile storage schema, Collection disclosure, and offer filters
  build on the now-fixed 116-tile roster. Adding a persistence key requires matching
  updates in `src/ui/storage.ts` and `desktop/save-store.js`.
- **Letter-hand leveling (if ever).** Constellation cards level sentence patterns only; whether letter hands should ever be levelable (and by what consumable) is deferred.
- **Ink colors = stakes (playtest-03 A).** The deferred difficulty/stake ladder is re-skinned as **Ink** (검정 → 빨강 …); red ink = the editor's pen. Reframed as matcher-leniency knobs (per playtest-01), not true grammar checking.
- **Touch long-press marking (playtest-03 F).** Discard-marking uses right-click (desktop-only); a long-press gesture for touch devices is open. No change now.
- **Suit dataset batch (playtest-03 F).** The real 20–30k LLM batch classification stays an offline design-side task; the lexicon loader format is kept stable so a larger baked table drops in without code changes.

---

## 13. Chromatic Unlocks — "writing the world into color" (feature-02 C)

The game begins **desaturated and silent**; playing specific words permanently unlocks presentation layers. This is the literal enactment of the title — you *play the world into existence*. Persistent **per profile** (localStorage `wj.unlocks`, beside collection/tutorial flags). **Valid words only** unlock (gibberish never does).

**System shape.** One data-driven registry (`src/ui/unlocks.ts`): `word → { effect }`. A word-played check fires on each valid submission; on the first-ever play of a listed word it records the unlock and fires a **celebration reveal** (the color washes in / audio fades up). Adding a future unlock = adding a registry row — **never a hard-coded word check in a component**.

**Initial table (C-2).**

| Word | Unlocks |
|---|---|
| RED | red token group — `--mult`, red buttons, rare-emoji-tile frames |
| YELLOW | gold token group — money, gold UI, early-end glow |
| GREEN | green token group — desk/blind backgrounds (`--bg-desk`) |
| BLUE | blue token group — `--chips`, blue buttons |
| MUSIC | BGM bus enabled (wraps the feature-01 mixer's music bus) |
| SOUND | SFX bus enabled (wraps the SFX bus) |
| KOREAN | Korean-locale celebration entry (the language is separately selectable in Settings from the start — the gimmick is the reward, not the gate) |
| ALIEN / GHOST / DOG / TURTLE | **WooDak ally skins** — selectable in **Collection → Mascots** once unlocked *and* art exists (moved from Settings → Game on 2026-07-29; registry `src/ui/mascots.ts`, resolver `mascotSrc`). The selected card is outlined and labeled; locked silhouettes cannot be selected. **All four shipped** (`alien.png`/`ghost.png`/`dog.png`/`turtle.png`). Piyak (shop) is never re-skinned. (CAT retired from the roster, 2026-07-22.) Display names: DOG = 누렁이 / Nurungi, GHOST = 이고야 / Egoya, ALIEN = 이고지 / Egoji, TURTLE = 느무보 / Nemubo. The unlock **words** stay GHOST / ALIEN / DOG / TURTLE — the name is display copy (`mascot.<id>`), the word is the trigger. |

**"Grayscale" = full token desaturation + a monochrome guard (C-3, revised).** The **whole** palette (chips, mult, gold, suits, tile faces, slate chrome, backgrounds) defaults to neutral **greys**, so the world starts *genuinely* black-and-white. Each color word restores its group's true hues via an `unlock-<group>` class on `<html>` (token swapping) with a wash animation — so the world re-colors **progressively** (RED→mult/vulgar/the tomato icon, YELLOW→gold/slang/warm tile faces, GREEN→desk/blind backgrounds, BLUE→chips/formal/standard suits + the slate UI chrome). Because some fills are hard-coded (material tile faces and the blind badge) beyond the tokens' reach, a **`world-mono` guard** additionally applies `filter: grayscale(1)` to the board *only while no color group is unlocked* — guaranteeing a truly colorless start — and is dropped the moment any color is played, after which token desaturation carries the reveal. The main `.frame` itself is transparent as of 2026-07-30; the former per-stage backdrops are retired. The fixed CRT overlay sits outside the greyscaled containers, so it is never affected. The chips/mult info floor is safe — color is never the sole info channel (a11y rule) — so the monochrome start is playable.

**Audio gating (C-6).** MUSIC/SOUND gate the real mixer's buses — **default off** (the game starts silent) until the word is played or the override is on. Requires feature-01 B (audio) shipped; color groups are independent.

**Escape hatch (C-4).** Settings → Video: a **"reveal all presentation"** override (unlock everything now) — buried but present, for accessibility/streamers/impatient players. The gimmick stays the **celebratory path**: even with the override on, the first real play of a word still fires the celebration + collection record once.

**Discoverability (C-5).** New Collection category **팔레트 (Palette)** — locked entries are grey silhouettes with a letter-count hint ("R _ _"), unlocked entries show the word in its group color. The first-run tutorial (2026-07-21) is a scripted, **hard-locked YELLOW lesson**: the opening hand is rigged to contain Y‑E‑L‑L‑O‑W and the target is lowered (10) so the board is locked to spelling YELLOW and only that. A WooDak coach-mark frames the grey world (so it never reads as a rendering bug), then the player builds and submits YELLOW — the yellow palette washes in ("Gold floods back in.") and clears the blind, teaching word-building, submission, and the Palette by doing. See `docs/superpowers/specs/2026-07-21-yellow-first-lesson-design.md`.
