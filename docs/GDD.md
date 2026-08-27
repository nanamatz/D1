# Play the Wor!d

**Word-combination roguelite — Game Design Document**
*Balatro-inspired word-building roguelite*

Version 0.2 — systems expansion

**Changelog v0.1 → v0.2**

- Terminology corrected: **blind** = one round; **ante** = 3 blinds (Small → Big → Boss). Former uses of "ante" in the scoring pipeline now read "blind".
- New: **Sentence Pattern Table** (the game's "poker hand table") — 12 patterns, matching rules, Unison bonus. Tone-overlay concept from v0.1 §4.1 Level 2 replaced by the single Unison rule (design diet).
- New: **Core Loop** chapter — hand size, draw/refill, discard budget, gibberish submission (b-2), no minimum word length.
- New: **Blinds, Antes & Bosses** — scaling, Chapter-8 victory + Endless Mode, 15 regular bosses, and a six-boss finisher tier every eight Chapters (§8.4). Draft/Revision skipping and 30 Editorial Perks now ship (§8.2; alphabet-lore expansion 2026-08-12).
- New: **Shop & Economy** — money sources, interest, shop layout, packs, 32 two-tier vouchers.
- Changed 2026-08-04: the Stationery Shop and pack economy adopt the Balatro-reference probability and price policy. Item weights are Emoji Tile 20 / Fable 4 / Constellation 4, voucher-gated letter tile 4, and Lucky-Pouch Gambler 2; pack type weights are 4/4/4/1.2/0.6 and sizes 8/4/1. Emoji Tile prices are the project override **$4/$6/$9/$15** by rarity (§9.2–§9.3, §11.8).
- Changed 2026-08-14: Word Hands gain run-only levels. A cleared blind awards Proof Stamps equal to the most-played Word Hand's play count; a handless blind awards one seeded-random stamp from the profile's discovered hands only. Level costs are 1 stamp through level 5, 3 through level 8, then 5. The Crow and the Pitcher joins the Fable roster as a two-stamp accelerator (§5.5, §10.1).
- Changed 2026-08-14: **Consumables** use 3 card families — Fable (20 implemented), Constellation (12 implemented), and Gambler (14 implemented). The Ass in the Lion's Skin completes the Fable roster with a targeted letter-tile edition effect (§10).
- Changed 2026-07-27: the third card family's display name is **Gambler Cards / 노름꾼 카드** (was "Ink Cards / 잉크 카드"). The **Ink name moves to the pack**: a third consumable pack, the **Ink Pack / 잉크 팩**, is the source of Gambler cards, alongside the Fable and Constellation packs (§9.3, §10.3). Collection key `inkCards` and other engine ids are unchanged (display-only rename).
- Changed 2026-08-03: all fourteen Gambler-card effects ship (`src/engine/gamblers.ts`) and the Ink Pack rolls them in the shop.
- Changed 2026-08-02: Full Moon's three created vowels now each receive one seeded-random non-base enhancement axis (material, font, or letter-tile edition), rather than always receiving a material (§10.3).
- Changed 2026-07-30: the deferred starting-deck and stake/Ink concepts are
  retired. Runs now choose one of **14 Starting Pouches** and one of **8
  cumulative Records** (White LP → DVD); the complete effects, unlock ladder,
  composition order, and art contracts are fixed in §12. The **Ink Pack** keeps
  its name and remains unrelated to difficulty.
- Changed 2026-07-31: **도시락 가방 / Lunch Bag** is renamed
  **서류 가방 / Briefcase** to match its case-shaped art; the saved engine id
  remains `lunchBag`. Pouch object art also removes the pencils from Pencil
  Case and the coins from Coin Purse, while Lucky Pouch gains a centred gold
  circular emblem (§12.2).
- Changed 2026-08-03: all fourteen Gambler-card effects are confirmed. Phoenix is the Legendary Emoji Tile route, Boar is the explicit duplicate-ownership exception, Rainman and Sake Cup modify owned Emoji Tile editions, and ordinary Gambler cards may enter Fable Packs only after Comic Book is owned (§9.2–§10.3). The 2026-08-07 acquisition pass makes Deer and Phoenix Ink-Pack-only.
- Changed 2026-08-05: Emoji Tile profile unlocks ship for unseeded runs. After the 2026-08-12 roster additions and duplicate-condition cleanup, the 150-tile public roster starts with 76 ordinary tiles plus all 5 Legendary definitions profile-eligible; 69 Common/Uncommon/Rare tiles use persistent achievement gates. Locked ids are removed from every ordinary offer and direct-creation path (§9.2, §11).
- Changed 2026-08-22: the deterministic headless board-verification harness now covers all 150 public Emoji Tiles, paired control/focal cohorts, actual Chapter 38 completion, market exposure, and the 14×8 Pouch/Record matrix. Bounded baseline and full-budget artifacts ship in `docs/balance/`; a separate skip-reward counterfactual harness verifies all 30 Editorial Perks. These are measurement only and do not retune any value (§12.4).
- Changed 2026-08-26: Term Insurance no longer prevents destruction. It starts at ×1 and gains +0.2 ×Mult for each letter tile actually destroyed (§11.4).
- Changed 2026-08-06: Hand Scholar starts at ×1 and increases its multiplicative factor by ×0.5 per distinct Word Hand recorded this run, with an explicit ×4 cap. Hands played before acquisition count immediately. Every run-history Emoji Tile seeds and reconciles from the authoritative run-wide ledger (§11.6).
- Changed 2026-08-12: Word Hands add the hidden knowledge tier Type Economy, Vowelless, and Grand Palindrome above the original six. All three require valid dictionary words and persist their first discovery per profile; Hand Scholar unlocks after eight distinct hands in one run (§5.5, §11.4).
- Changed 2026-08-06: Glasswork no longer removes a Glass tile from the permanent pouch at blind end; it only gives +7 Mult per played Glass tile (§11.3).
- Changed 2026-08-06: Rare Emoji Tile Blacksmith starts at +0 Chips and permanently gains +10 Chips whenever an existing letter tile receives a material, font, or edition enhancement. Held tile-targeting Fables may use the pouch candidates in either an open Fable Pack or Ink Pack (§9.3, §10.1, §11.4).
- Changed 2026-08-06: Triplet now ranks above Longword, so a valid 6+ letter word containing the same letter three times triggers Triplet instead of being shadowed by Longword (§5.5).
- Changed 2026-08-06: Cleaning Sign displays as `청소 표지판` in Korean and removes $2 for each tile discarded, rather than once per discard action (§8.4).
- Changed 2026-08-18: register base Mult is Standard ×1, Formal ×10, Slang ×5, and Vulgar ×7. Formal becomes the highest-authority reward while Vulgar's former jackpot is moderated. Profile register titles derive from unique current-lexicon discoveries and one earned title may be equipped cosmetically by stable semantic id in `wj.lifetime`; there is no gameplay effect or new save key (§3.1).
- Changed 2026-08-22: the curated acronym families MVP and VIP ship as the four noun surfaces `mvp`, `mvps`, `vip`, and `vips`. Punctuation and unlisted initialisms remain invalid; the canonical offline source is `lexicon-pipeline/curated-abbreviations.json` (§3.2).
- Changed 2026-08-06: sentence-pattern base Mult is compressed to ×1/×2/×3/×4 by rank band while base Chips stay unchanged. Every Constellation level now adds its fixed Chips increment and +1 Mult linearly; the former ×1.5 geometric growth is retired (§5.2–§5.4).
- Changed 2026-08-07: sentence-pattern construction difficulty is classified independently from payout rank. Easy/Medium/Hard Constellation levels add +15/+30/+45 Chips respectively while every pattern continues to gain +1 Mult (§5.2–§5.4).
- Changed 2026-08-07: Deer and Phoenix are Ink-Pack-only jackpots at 0.3% per choice each. The other 12 Gambler Cards roll uniformly; Lucky Pouch shop and starting-card routes, plus Comic Book replacements, exclude both jackpots (§9.3, §10.3, §12.2).
- Changed 2026-08-07: The Cowherd and the Weaver Girl keeps its 25% success chance, then selects Gray/Violet/Rainbow at 50%/35%/15% (§10.1).
- Changed 2026-07-29: the Rare roster is replaced by 11 confirmed tiles and the
  Legendary roster by Book of Margins, Tyrant, Type Foundry, Tower of Babel, and
  Misbound. The historical candidate review is preserved in
  `docs/superpowers/specs/2026-07-29-emoji-tile-roster-design.md`; it is not an
  implementation source (§11).
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
12. [Starting Pouches & Records](#12-starting-pouches--records)
13. [Chromatic Unlocks](#13-chromatic-unlocks--writing-the-world-into-color)
14. [Steam Achievements](#14-steam-achievements)

---

## 1. Overview

**Core concept.** A roguelite where you score with *word combinations* instead of poker hands. Players use *alphabet tiles* instead of cards, and the structure of Balatro — deck, suits, enhancements, jokers, blinds, antes — is ported into the grammar of a word game. Built on a Scrabble-style letter-scoring base, it differentiates itself with two meta-layers Balatro does not have: the **register suit** and the **part-of-speech / sentence system**.

**Language.** English (confirmed).
**Art direction.** Pixel-art with a CRT finish, in the Balatro lineage (the earlier "ceramic letterpress, deliberately un-Balatro" direction is retired). Tile materials/fonts (§2.2–2.3) and the publishing-world fiction (§1.2) are unchanged in *design* — only their *rendering style* is pixel-art. Full visual spec in `docs/UI_DESIGN.md`; a pixel-art shop mascot — 삐약이 (Piyak), the tuxedo cat proprietor — lives in the Stationery Shop (`src/ui/assets/piyak.png`). A second mascot, **우땅 (WooDak)** — a pixel-art orangutan and the player's ally/editor-mentor — appears on the run-end screen with tips and discovery mentions and hosts every tutorial encounter except Piyak's shop greeting (`src/ui/assets/woodak.png`). A broader notification role is not currently specified.
**Special characters.** Excluded as playable tiles (punctuation-shaped pattern levels return as Constellation cards; see §10). *Re-examined and re-affirmed in playtest-05 D:* wildcard/blank tiles and `?`/`!` mood-marker tiles were both explored and **dropped**, because each duplicated a system we already have — alphabet sculpting now belongs to Fable #16 and the pouch's draft-flavored tools; mood markers overlap the Constellation cards and would force a large change to the §5 pattern system. Revisit only if a concrete need appears that no existing system covers.

### 1.1 Balatro → This Game Mapping

| Balatro | This Game | Notes |
|---|---|---|
| Deck / Cards | Alphabet tiles in a Pouch | Scrabble-style per-letter score & count; normally 68 tiles (§2.1) |
| Deck archetype | Starting Pouch | Choose one of 14 run-defining starts (§12.2) |
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
| Tarot cards | Fable Cards | 20 one-shot tile/economy/tool effects |
| Planet cards | Constellation Cards | Sentence-pattern level-up consumables |
| Spectral cards | Gambler Cards | Third family (delivered by the Ink Pack, §9.3); 14 implemented |
| Vouchers | Vouchers | 16 base + 16 upgraded permanent run effects |
| Stakes / difficulty | Records | 8 cumulative levels: five LPs, Clear LP, CD, DVD (§12.3) |
| Blind skip / Tags | Skip / Editorial Perks | Draft and Revision may be traded for one disclosed publishing-world reward; Deadline is mandatory (§8.2) |

### 1.2 Fiction & Glossary — the publishing frame (playtest-03 A)

The fiction: **you are a writer**. Poker/Balatro structure terms are re-skinned into a publishing vocabulary; **Chips/Mult stay** (functional clarity). **Display strings only** — code identifiers (`blind`, `ante`, `BlindKind`…) are unchanged; the glossary lives in i18n (`ko.json`/`en.json`). Renaming engine identifiers would be churn with no player value.

| Concept (code) | Korean | English | Notes |
|---|---|---|---|
| run | 집필 | Run | flavor only; "run" fine in en |
| ante | **N장 / 챕터** | **Chapter** | Use `1장`, `2장` when attached to a number; use `챕터` when the term stands alone (`이번 챕터`, `챕터마다`, `챕터 −1`) |
| small blind | **초고** | **Draft** | |
| big blind | **퇴고** | **Revision** | |
| boss blind | **마감** | **Deadline** | the editors come to judge |
| money (`gold`) | **원고료** | **Fee** | `$` symbol stays |
| Cash Out screen | **원고료 정산** | **Fee Settlement** | |
| shop | **문방구** | **Stationery Shop** | |
| bag/deck | **주머니** | **Pouch** | selected Starting Pouch also supplies the in-run tile-pouch art |
| starting run modifier | **시작 주머니** | **Starting Pouch** | one of 14; code may retain existing `bag` identifiers |
| difficulty | **음반** | **Record** | cumulative White LP → DVD ladder (§12.3) |

**One object, one name (2026-07-30).** The owned joker object is **Emoji Tile / 이모지 타일** in every string (GDD §11). **Charm / 부적** survives only as the name of the pack that contains them — **Charm Pack / 부적 팩** (§9.3). Text that called the object a Charm was corrected; text naming the pack was not.

---

## 2. Tile System

A tile is the smallest unit of the game. Each tile is one **uppercase** alphabet
letter (the sole exception being Stone, which has none — §2.2), one intrinsic
classification, and three independent modifier axes.

- **Intrinsic classification — Vowel / Consonant**
- **Modifier axis A — Material:** the enhancement slot
- **Modifier axis B — Font:** the seal-effect slot
- **Modifier axis C — Edition:** base / Gray / Violet / Rainbow

> **Decision — uppercase only (changed 2026-07-30).** Letter case is not a tile
> axis. Every letter is stored and displayed as A–Z; all lowercase-tile planning
> and case-dependent Emoji Tiles are retired.

> **Design note — axis independence.** A tile can carry one material, one font,
> and one edition simultaneously. The 9×5×4 combinations are the core engine of
> build variety. Stone is the exception: it cannot carry a non-base font.

> **Design note — retrigger stays on fonts.** Fonts retain the seal-effect roles
> (§2.3), so retrigger belongs to fonts, never to materials. Tile editions remain
> a separate visual/scoring axis (§2.4, §11.8).

**Tile permanence.** Tiles are permanent assets, like Balatro's deck cards. Tiles submitted during a blind are consumed for that blind and return to the bag when the blind ends. The bag is sculpted across a run via packs (add) and consumables (remove/transform) — see §9–10.

**Transformation presentation (changed 2026-07-30).** Replacing an existing
tile axis commits only that axis, then the UI plays its shared axis-specific beat:
material = forge burst, font = type-press stamp, edition = chromatic foil sweep.
Multi-axis changes stagger in that order. This presentation never changes the
headless mutation rule and is skipped under reduced motion.

### 2.1 Per-Letter Score & Count (rebalanced — diverges from Scrabble on purpose)

Letter **scores** are Scrabble-standard **× 3** (feel pass 2026-07-21, `BALANCE.letterChips`): the base floor was raised so tiles feel more impactful, while the ratios that reward rare letters are preserved exactly. Pattern/unison/Word-Hand/material constants are untouched by this scaling — only the per-tile letter chip does. `src/sim/feel-chip-scale.ts` confirms the ante curve (§8.2) isn't trivialized by the change (left unscaled). The **counts** were separately rebalanced (playtest-04 C-2, chosen by `src/sim/tile-pool.ts`): the bag shrank **98 → 68** and its extremes were **compressed** — the E-glut cut (12 → 6) and rare letters raised (1 → 2). Scrabble's distribution assumes board-adjacency; standalone-word spelling wants a flatter curve. Blanks excluded.

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

**Historical pool sim (4000 hands @ the then-current hand 11):** vs. the old 98-tile bag, rare letters appeared **~2× as often** per hand (1.24 → 2.57), the longest makeable word stayed healthy (6.9 → 6.2 letters), and the gibberish-forced rate stayed near zero (0.1% → 0.3%). The live baseline is now 10; re-run this sim when retuning the pool.

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
| Lead plate | 연판 | **1/5 → +20 Mult; 1/5 → $20** (independent rolls) | Lucky, gold chance retuned 2026-07-30 |
| Ivory | 상아 | **$3** if held in hand at blind end | Gold |
| Brass | 황동 | While held in hand, **×1.5 the current total Mult** after all owned Emoji Tile scoring effects | Steel |
| Wood | 목재 | Starts at **+15 Chips**; permanently gains **+10 Chips** each time that tile is played during the run | custom |

Effects are **per tile** and stack: three Porcelain tiles in one word give +90 Chips; two Ivory tiles held at blind end pay $6. Wood growth is stored on that individual tile and survives blind transitions for the rest of the run.

**Risk budget: Glass only.** Every other material is pure upside. Stone's letter loss is a trade-off known at the moment it is applied, not a gamble, so it does not break this rule. A destroyed Glass tile leaves the run permanently. Its submitted-word tile visibly shatters on the material-result beat and remains cracked in the sentence record; an insured survival stays intact.

**Numbers started from Balatro's reference values, then follow playtest tuning.** Wood uses its custom growth curve and Lead plate's $20 chance was raised from 1/15 to 1/5 on 2026-07-30. They remain values to verify against our scale — our letter chips are Scrabble values × 3 ("TASTE" = 15 Chips) and our hand is 10 tiles against Balatro's 8, so per-tile effects amplify harder here. See `docs/superpowers/specs/2026-07-17-tile-materials-design.md`.

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

**Stone has no letter or font enhancement.** Our analog of Balatro Stone's "no rank or suit" is *no letter*: `material = stone` ⟺ the tile carries no letter. Turning a tile into Stone also resets its font to Medium, font-changing cards cannot target it, and Tile Packs never attach a font to a rolled Stone. A stone tile therefore cannot spell, so any word containing one fails the lexicon lookup and resolves as **gibberish** (§6.4) — chips × 1.0, no suit multiplier, always submittable. This is deliberate, and it is what stops Stone from being strictly the best tile in the game: if stone were merely skipped while spelling, `stone+C+A+T` would read "CAT" and collect +50 Chips *and* the suit multiplier. The consequence is that Stone becomes the heart of the gibberish archetype — an identity that falls out of our own rules rather than being imported. A stone is **neither vowel nor consonant** (§2.1), so vowel/consonant emoji tiles must skip it.

**Acquisition:** materials enter play pre-attached on tiles found in Tile Packs (§9.3), or through the matching Fable cards (§10.1). A Fable that turns a tile into Stone hides and remembers its letter; a later non-Stone transformation restores it.

### 2.3 Fonts (Edition Layer)

| Font | Position |
|---|---|
| Futura Medium | Base |
| Futura Light Italic | Edition |
| Void (`bold` internally; Jost CSS style) | Edition |
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
| Void (`bold` internally) | `chipPlay` — +30 Chips when the tile scores | extra ink consumes the glyph's negative space, matching the additive score bonus |
| Inline | `discardGain` — gain 1 consumable when discarded (needs a free slot) | the hollow glyph has something inside it |
| Black | `retriggerPlay` — retrigger the tile's scoring contribution once | the heaviest ink prints twice |

Implemented as a `fontEffects` table in `balance.ts` keyed by font id (`lightItalic`/`bold`/`inline`/`black` → effect id); tooltips read from it, never hard-coded. The persisted `bold` id displays as **Void / 보이드** for save compatibility. Reassignment stays a one-line data change.

> **Decision — fonts unified as style variants within the Futura/Jost family (changed 2026-08-05).** A font functions as a visual signal that "this tile has a special effect." Medium 500, Bold 700, and Black 900 were not distinguishable enough on the small tile, while an underline is decoration rather than a font style. The persisted `bold` display is therefore **Void**: a `.48em` same-colour stroke expands the bundled Jost 500 ink until enclosed counters close, then the glyph is scaled to `.61` to retain its tile footprint. Inline empties the body; Void consumes the negative space; Black keeps open counters but uses the natural 900 weight. Because the expansion otherwise makes G read as O, Void G restores an exaggerated horizontal bar and terminal outside the bowl. The internal `bold` id remains for save compatibility. (License note: commercial Futura is not bundled; the shipped Jost files are OFL-1.1.)

### 2.4 Enhancement Stacking & Replacement

A letter tile carries **three enhancement axes at once**: `material` (§2.2) + `font` (§2.3) + `edition` (§11.8). All three normally stack — a Ceramic / Void / Gray tile pays its material, font, and edition effects in the same word. Stone alone forces the font axis to Medium. Emoji Tiles carry only `JokerEdition` and never take a material or font.

**Same-axis replacement is destructive (rule).** Applying an enhancement to a tile that already carries one **on the same axis** overwrites it; the previous one is discarded, not stored or refunded. Re-applying Polished to a Ceramic tile leaves a Polished tile, not both. Cross-axis application normally does not conflict; Stone is the sole exception and discards any font enhancement. **The overwrite applies immediately, with no confirmation prompt** (revised 2026-07-28: the earlier warn-before-overwrite modal was removed — players learn the rule by doing, and the modal only added friction).

**One exception — Stone's letter memory (§2.2).** Because `material = stone` also strips the tile's letter, a Stone transformation *hides and remembers* the letter, and a later non-Stone material restores it. This is a property of the letter, not of the material slot: the material itself is still overwritten normally.

---

## 3. Register Suit System

A completed word is classified into one of 4 types, like a Balatro suit. The classification axis is **register alone**, so the categories are mutually exclusive. This suit is the basis of the conditional penalty/bonus mechanics.

### 3.1 The Four Suits and Base Multipliers

| Suit | Character | Rarity | Base multiplier | Position |
|---|---|---|---|---|
| Standard | Everyday vocabulary | Overwhelming majority | ×1 | Safe main line |
| Formal | Academic / literary | Fewer than majority | ×10 | Highest-authority reward |
| Slang | Generation/group/era-limited nonstandard speech | Few | ×5 | Strong when combined with emoji tiles |
| Vulgar | Profanity / taboo | Fewest | ×7 | Strong but moderated rare reward |

> **Key design — Balatro suits are "symmetric," this game's are "asymmetric."** Balatro's 4 suits have equal counts in the deck, so no base-multiplier difference is applied. This game's suits differ in both availability and register identity. Standard remains the safe baseline; Slang and Vulgar reward rarer vocabulary; Formal sits highest because its academic/literary authority is the system's capstone rather than a strict rarity ranking. "Suit-pushing emoji tiles" (layer 2) recreate Balatro-style build bias on top of that asymmetric reward curve.

> **Balance warning — reward identity, not rarity alone.** If nonstandard registers appear *too* rarely while only their multipliers are high, players will treat them as "suits I can't make anyway" and ignore them. Formal ×10 deliberately owns the highest-authority payoff, while Vulgar ×7 stays hard but worthwhile without its former swingy jackpot identity. Censor-type bosses still provide its adversarial build relationship.

**Word length adds to Mult (2026-07-30).** A valid word's score is `letter chips × (suit multiplier + length × BALANCE.wordLength.multPerLetter)`, with `multPerLetter` = 1 — a 5-letter Standard word settles at `chips × 6.0`. Length is **added** to the suit multiplier, not multiplied by it, so the register asymmetry above keeps its weight instead of being swamped by a linear length term. Gibberish is excluded (§6.4): it stays at `chips × 1.0`, so dumping eight random tiles never competes with spelling. The length bonus is applied **after** per-tile materials, matching `loop.ts::scoreSubmission`; `scoreWord` follows the same order — this ordering is load-bearing because Glass multiplies Mult, and `(suitMult + length) × glassFactor` differs from `(suitMult × glassFactor) + length`. Sim: `src/sim/length-mult.ts`.

**Collection surfacing (added 2026-07-30).** Collection → Words has a separate
Register Scores tab that exposes these four live `balance.ts` multipliers and
their risk/reward roles. The Words tab also shows profile-derived challenge
records: highest-scoring word (intrinsic letter-chip sum only; material, font,
edition, Mult, Emoji Tile, boss, and sentence effects are excluded), longest
discovered word, most-played word, and total discoveries. `wj.collection`
stores each word's first-play time, play count, and intrinsic score without
adding a save key; old settled-score records are recomputed from the word on read.
Only successfully submitted valid words reveal their spelling and original
register; gibberish, previews, and blocked submissions do not. Replays update the
existing play record without adding another discovery. Undiscovered dictionary
slots render as neutral `???` entries and expose no spelling or register through
tooltips or accessibility metadata. Search and register filters operate only on
discovered entries, so their result counts remain literal without leaking hidden
dictionary facts. The full dictionary total is secret: the category total and
unfiltered Words pager show `???` until every eligible word has been discovered,
then reveal the actual total; the discovery record continues to show the literal
number found so far.

Profile titles are cosmetic milestones derived from the unique keys already in
that profile's `wj.collection`, classified by each word's original suit in the
current lexicon. Repeated plays, gibberish, stale collection rows, and temporary
suit rewrites do not count. One earned title may be equipped per profile; the
stable semantic id (for example `standard.reader`, `formal.professor`, or `god`)
lives in that slot's existing `wj.lifetime`, never a localized name or tier index.
Equipping is cosmetic and changes no scoring, economy, RNG, or engine state. A
stored title that is unknown or no longer earned resolves to no title and is
reconciled to `null` when that profile is opened. The full-register tier uses the live lexicon total,
which stays hidden until mastery; Reveal All's compact `unlockAllApplied` marker
synthetically grants all four mastery titles and **God / 신** while Challenges
remain disabled.

Selecting a higher tier leaves every earned lower tier selectable. Profile shows
one shared inline selector opened from the four register cards; God becomes a
separate selectable badge only after all four registers are mastered. Reveal All
unlocks the choices but never changes the equipped title. Inactive profile slots
may choose independently without becoming active; Main Menu displays only the
active slot's validated equipped title beneath its name.

| Register | Discovery titles (threshold → title) | Full-register title |
|---|---|---|
| Standard | 50 Reader · 100 Speller · 200 Word Collector · 500 Wordsmith · 1,000 Editor · 10,000 Lexicographer · 100,000 Living Dictionary | Master of Standard / 표준어 정복자 |
| Formal | 10 Scribe · 25 Essayist · 50 Scholar · 100 Rhetorician · 250 Orator · 500 Erudite / 박학다식 · 1,000 Doctor / 박사 | Professor / 교수 |
| Slang | 5 Trickster · 10 Free Spirit · 25 Roughneck · 50 From the Streets · 100 Wild Life · 250 Brain Rot / 브레인 롯 · 500 Trend Setter | Influencer / 인플루언서 |
| Vulgar | 1 Kid · 5 Elementary Schooler · 10 Middle Schooler · 25 Juvenile Delinquent · 50 Crank · 100 Rapper · 200 Gangster | Buddha / 부처 |

Mastering all four registers grants **God / 신**.

### 3.2 Register Data Acquisition Pipeline

A "clean English word set with register labels" does not exist. So this is a problem of *assembly*, not download. The authoritative decision rules are `docs/# 영단어 레지스터 분류 기준.md`.

- **Standard is the maximum/default set.** Every baked word receives a suit and is counted in the audit. Semantic source inspection is concentrated on non-standard candidates; entries with no qualifying evidence, and ambiguous entries, resolve to Standard.
- **Separate validity (layer 1) from suit (layer 2).** Valid-word judgment is solved via an open word-list HashSet (ENABLE/TWL, etc.). Suit lookup is a separate table above it.
- **Representative meaning only.** Wiktionary usage categories locate candidate words, then the first English dictionary definition's usage label is checked—not every sense on the page. The mapping is Vulgar = vulgar/taboo/obscene/offensive/slur; Slang = slang/internet slang/AAVE/dialect slang; Formal = formal/literary/archaic/technical/legal/poetic/officialese. Informal, colloquial, pejorative, rare, difficult, dialectal, or unmarked alone remain Standard. Explicit boundary examples in the criteria document override source disagreement. Only POS-compatible inflections inherit a non-standard lemma tag, and every non-standard evidence path is baked into `data/register-audit.json`.
- **Precedence applies after representative-meaning selection.** If that one meaning matches multiple classes, resolve **Vulgar > Slang > Formal > Standard**. Do not promote a common Standard meaning because a secondary sense is slang, vulgar, or technical.
- **Bake public lexical sources offline.** Moby POS supplies broad POS labels and Princeton WordNet 3.0 supplies complementary POS plus verb frames. Exact-headword source tags augment legacy LLM tags; explicit curated POS overrides win. Bake the merged result into a table rather than doing any classification at runtime.
- **Use the playable ENABLE subset plus curated acronym families (changed 2026-08-22).** The validity pool contains every ENABLE word of **18 letters or fewer**, 13 apostrophe-free tile-grammar exceptions, and exactly four curated acronym surfaces: `mvp`, `mvps`, `vip`, and `vips` (172,232 dictionary words; 172,255 baked lexicon entries including 23 retained entries outside the dictionary). Acronyms use lowercase canonical keys, render through the existing uppercase tile spelling, and are Standard nouns; punctuation and unlisted initialisms such as CEO remain invalid. `lexicon-pipeline/curated-abbreviations.json` is their one canonical offline source and both baked outputs consume it. The 608 longer ENABLE words are excluded because 18 is the designed playable-word ceiling after Copy Editor is considered. The former 50k frequency cutoff remains retired; it excluded valid base words such as `uremia` while retaining derivatives such as `uremic`.
- **Inflected forms are IN; every baked word has POS (playtest-01 P0; changed 2026-08-06).** Plurals, past tense, -ing, and comparatives validate when they remain within the 18-letter ceiling (do not lemmatize eligible forms away). Exact-headword public-domain Moby POS and Princeton WordNet 3.0 tags augment legacy classifications; explicit curated POS overrides remain authoritative. Missing words use the same sources, including transitive/intransitive verb frames, with deterministic morphology/fallback for obscure residual forms. Register words without a non-standard tag still default to Standard; production data validation forbids an empty POS list.

> **One word = one suit.** Choose the word's most frequent/representative meaning; if that cannot be determined reliably, use the general dictionary's first sense. Classify only that meaning in the numbered order Vulgar → Slang → Formal → Standard, and fall back to Standard when ambiguous. Thus `sick` (ill) and `lit` (set alight) remain Standard even though each has a Slang secondary sense.

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

Verb subtypes remain in the lexicon for Descriptive and Object Complement judgment. Simple and Transitive accept any verb subtype, while Ditransitive requires the controlled `GIVE`/`TELL`/`SEND`/`SHOW` family and its baked inflections (changed 2026-08-21).

Multi-POS words keep every lexical candidate visible as a separate localized tag. When a highest-ranked pattern exists, its judgment also returns the ephemeral compatible POS set for each eligible word: a uniquely required candidate is selected, while candidates used by any equivalent winning parse remain selected as a union. This presentation result never mutates or persists the submission. With no pattern, candidates remain equal and unselected. (changed 2026-08-21)

> **Data note — POS tags are nearly free.** The cost of adding POS tags to the register pipeline is low. POS has many clean sources (Wiktionary, WordNet), making it easier than register. The "one word, multiple POS" problem (taste = noun/verb, sick = adjective/noun) has the same structure as suit resolution, and in a game it is actually an opportunity — let the same tile take a different POS depending on which slot it is placed in, adding a strategic axis.

---

## 5. Sentence Pattern Table

This is the game's poker hand table: the hierarchy from weak to strong, per-pattern payouts and operations, and the matching rules.

### 5.1 Matching Rules

1. **Whole-sequence match.** Apply any boss sentence transform to the raw submission history first (so Orphan Line always removes the literal first submitted word), then remove every debuffed submission and join the remaining eligible words in their original order. A debuffed word is not a hole and contributes neither POS nor register to Pattern/Unison judgment. The resulting entire sequence must equal a pattern. No partial matching. A gibberish hole (§6.4) remains in that eligible sequence and voids all pattern matches — Correction Tape is the current counter. (changed 2026-08-20: debuffed words are removed rather than zeroed after scoring)
2. **Highest single pattern only.** If a sequence satisfies multiple patterns, only the highest-value one applies (a full house does not also pay as a pair).
3. **Modifier absorption.** Articles, adjectives, and adverbs are *flesh*, not *skeleton*. "CAT EATS FISH" and "THE BIG CAT EATS FISH" are the same Transitive pattern; **each absorbed modifier adds +15 Chips to the sentence bonus's Chips side** (uniform across all patterns — placeholder). This keeps the table small while making longer sentences naturally more valuable.
4. **POS compatibility follows the winner.** POS highlighting is derived from the same highest-pattern judgment, never reconstructed in the UI. For each eligible word, every lexical POS candidate that preserves the exact winning pattern outcome (including its modifier/repeat result) remains active; this keeps the union of equivalent parses instead of choosing an arbitrary verb subtype. Boss-transformed or debuffed-out raw words have no selected POS. This compatibility trace is ephemeral and does not change scoring, rank, or stored submissions. (changed 2026-08-21)

### 5.2 The Twelve Patterns (weak → strong)

Every pattern owns a base **[Chips × Mult]** pair (Balatro-hand style). At sentence finalization, the blind's committed score becomes the current Chips axis: pattern, modifier, Unison, and post-pattern Chips add to it, then pattern, Unison, and post-pattern Mult multiply the combined axis. This makes structural scoring scale with a late-game build instead of remaining a fixed additive payout. Base Mult is deliberately compressed to ×1/×2/×3/×4 by rank band so an unupgraded pattern does not decide the blind by itself. Every level-up adds the pattern's construction-difficulty tier Chips increment (**Easy +15 · Medium +30 · Hard +45**) and +1 Mult linearly (`BALANCE.patternLevelGrowthFactor = 1`); therefore the current Chips/Mult and every displayed level-up delta remain natural numbers. Rank remains payout precedence, not a proxy for construction difficulty.

```
sentenceChips = patternChips + 15 × absorbedModifiers + unisonChips
sentenceMult  = patternMult × unisonMult
final score   = (committedScore + sentenceChips) × sentenceMult
sentence gain = final score − committedScore
```

At finalization the gold pattern/level stamp remains the primary beat and reads
**level → zodiac symbol → pattern name** from left to right. Every
non-pattern contributor is displayed separately beside it: absorbed modifiers
use a Chips-coloured tag, Unison uses a gold tag, and post-pattern Emoji Tile,
voucher, or boss adjustments use an effect-coloured tag. They must never be
folded invisibly into the pattern label. The level field reserves a fixed width
and a visible gap before the zodiac symbol so one- and multi-digit levels keep
the symbol/name columns aligned.

| # | Pattern | Difficulty | POS skeleton | Example | Min. phases | Base (Chips × Mult) | Per level (+Chips, +Mult) |
|---|---|---|---|---|---|---|---|
| 1 | Outcry | Easy | Interjection alone | SHH / WOW | 1 | 25 × 1 | +15, +1 |
| 2 | Simple | Easy | Noun + Verb | BIRDS FLY | 2 | 35 × 1 | +15, +1 |
| 3 | Imperative | Easy | Verb + Noun | EAT FISH | 2 | 40 × 1 | +15, +1 |
| 4 | Transitive | Medium | Noun + Verb + Noun | CAT EATS FISH | 3 | 50 × 2 | +30, +1 |
| 5 | Negative | Medium | subject + predicate containing a negative marker or contraction | SHE ISNT HERE | 3+ | 55 × 2 | +30, +1 |
| 6 | Interrogative | Easy | interrogative/auxiliary opener + subject/predicate | ARE YOU READY | 2+ | 60 × 2 | +15, +1 |
| 7 | Descriptive | Medium | Noun + linking V + Adj | PIZZA SEEMS TASTY | 3 | 75 × 3 | +30, +1 |
| 8 | Chant | Hard | Same verb ×2+ | EAT EAT | 2+ | 90 × 3, **+10 Chips per repeat beyond the 2nd** | +45, +1 (repeat bonus +10/level) |
| 9 | Object Complement (5형식) | Hard | Noun + selected TV + Noun + Noun/Adj | I MADE HIM HAPPY | 4 | 115 × 3 | +45, +1 |
| 10 | Ditransitive | Hard | Noun + controlled giving V + Noun + Noun | I GIVE HIM FISH | 4 | 135 × 3 | +45, +1 |
| 11 | Compound | Hard | [clause] + Conj + [clause] | CATS RUN AND DOGS SLEEP | 5+ | 165 × 4 | +45, +1 |
| 12 | Complex | Hard | subordinator + [clause] + [clause] | BECAUSE IT RAINED I STAYED HOME | 5+ | 195 × 4 | +45, +1 |

(Values live in `balance.ts` under `patterns`; changed 2026-08-21 to follow the approved construction-difficulty rank, with the bottom five patterns raised by +10 base Chips. Difficulty-tier level growth remains unchanged.)

Design intent:

- **Outcry** gives vowel-less interjections (shh, brr) a home in the pattern table.
- **Imperative requires an object (verb + noun)** — a bare verb no longer scores (changed: "RUN" alone once counted as a 1-phase high-card, but in play a lone verb tile spiked the projection off a single submission, so the pattern now needs at least a verb and a noun). The fun of verb repetition still has a home in **Chant**, which now starts at two consecutive copies of the same verb.
- **Simple and Transitive accept any verb subtype. Ditransitive uses a controlled giving-verb family** (`GIVE/GIVES/GAVE/GIVEN/GIVING`, `TELL/TELLS/TOLD/TELLING`, `SEND/SENDS/SENT/SENDING`, `SHOW/SHOWS/SHOWED/SHOWN/SHOWING`). Its word count and order stay fixed; Descriptive and Object Complement retain their specialized verb checks.
- **The Chips×Mult ladder climbs together** — both sides grow from #1→#12, so structural sentences add more Chips and apply a stronger factor to the committed blind score. The "structural sentences pay off big" principle from §7.3 lives directly in both axes.
- **The Hard tier is tight in the base 5 phases** — especially Compound and Complex at 5+ words; phase-extension effects create room for modifiers or longer clause forms.
- **Construction difficulty is independent of payout rank.** Easy = a short, broad lexical skeleton (Outcry, Imperative, Simple, Interrogative); Medium = three-word structure or a required negative marker (Descriptive, Transitive, Negative); Hard = exact repetition, four-object structure, a controlled verb, or two full clauses (Chant, Ditransitive, Compound, Object Complement, Complex). Outcry is structurally Easy even though its one-word sequence must also clear the blind to survive; target viability is measured separately in simulation.
- **Object Complement uses a controlled verb family** (`MAKE/CALL/FIND/NAME/KEEP/CONSIDER/ELECT/PAINT` and inflections), because POS alone cannot distinguish `I GIVE HIM FISH` (Ditransitive) from `I MADE HIM HAPPY` (Object Complement).
- **Interrogative does not require a Question Mark tile.** An interrogative word or auxiliary opener is sufficient. This preserves the alphabet-only pouch rule (§2.1).
- **Elliptical WHY questions count.** `WHY ME` is parsed as `WHY [IS IT] ME`; the understood predicate need not be played.
- **Negative contractions omit apostrophes on tiles:** `DONT`, `ISNT`, `ARENT`, `CANT`, etc. are valid words for pattern judgment.
- **Overlap is highest-only, never additive.** Interrogative outranks Negative, Negative outranks Transitive, and Imperative outranks Simple; those priorities resolve shared parses deterministically.
- **Complex requires two complete clauses** after an initial subordinator such as `BECAUSE`, `WHEN`, or `IF`.

### 5.3 Unison Bonus (the flush substitute)

One rule replaces the v0.1 tone-overlay table:

> **Unison.** If the sequence has 2+ words and *all* words share one suit, a bonus applies, sized by suit rarity: **Standard +50 Chips · Formal ×1.25 · Slang ×1.5 · Vulgar ×2** (placeholders).

Unison folds directly into the §5.2 formula: **Standard adds to the Chips side; Formal/Slang/Vulgar multiply the Mult side** (values unchanged). A register-mult Unison therefore scales the committed blind score even when no sentence pattern matches. This preserves the flush role ("commit to one suit across phases → reward") while keeping all richer combination rules (Hypocrite, etc.) in emoji tiles.

Note on Vulgar stacking: suit base ×7 plus Unison-Vulgar ×2 remains a strong double reward, moderated below Formal's ×10 authority payoff. Exact values remain playtest material.

### 5.4 Constellation Mapping (level-up consumables)

Each pattern pairs 1:1 with a Constellation card (§10.2), Balatro-Planet style. Leveling is **linear**: each use adds the §5.2 right-column's difficulty-tier Chips increment and +1 Mult.

**Visual mapping (added 2026-07-30).** Each pattern reuses the zodiac mark
engraved at the top of its paired card as its pictogram: Outcry ♎, Simple ♈,
Imperative ♌, Transitive ♊, Negative ♑, Interrogative ♐, Descriptive ♉,
Chant ♒, Object Complement ♏, Ditransitive ♋, Compound ♍, Complex ♓. Pattern
status, preview, Run Info, settlement, run summary, and Constellation tooltips
all show this same mark, so the mapping is readable before effect prose.

| Constellation | Levels up | Increment per level |
|---|---|---|
| Libra / 천칭자리 | Outcry | +15 Chips, +1 Mult |
| Aries / 양자리 | Simple | +15 Chips, +1 Mult |
| Leo / 사자자리 | Imperative | +15 Chips, +1 Mult |
| Gemini / 쌍둥이자리 | Transitive | +30 Chips, +1 Mult |
| Capricorn / 염소자리 | Negative | +30 Chips, +1 Mult |
| Sagittarius / 궁수자리 | Interrogative | +15 Chips, +1 Mult |
| Taurus / 황소자리 | Descriptive | +30 Chips, +1 Mult |
| Aquarius / 물병자리 | Chant | +45 Chips, +1 Mult (repeat bonus +10 Chips/level) |
| Scorpio / 전갈자리 | Object Complement | +45 Chips, +1 Mult |
| Cancer / 게자리 | Ditransitive | +45 Chips, +1 Mult |
| Virgo / 처녀자리 | Compound | +45 Chips, +1 Mult |
| Pisces / 물고기자리 | Complex | +45 Chips, +1 Mult |

### 5.5 Word Hands (단어 족보) — per-word structure bonuses (playtest-02 A-2)

Sentence patterns are the *run-level* payoff (evaluated across the whole sequence at blind end). **Word Hands** supply the *word-level* dopamine — a per-word "hand type" (Balatro's poker hands, transposed to letter structure) evaluated at submission. Engine ids remain `letterHands` / `LetterHandId`; this is a display-term change only.

- **Scoring placement.** The matched hand's Chips add to the current word Chips and its Mult multiplies the current word Mult inside `WordScoringContext`, layer 1: `wordScore = (currentWordChips + handChips) × (currentWordMult × handMult)`. Values live in `balance.ts`. The length multiplier (§3.1) folds in just before this, on the Mult side; Longword is the Chips side of the same idea, so the two stack rather than duplicating.
- **Highest single hand only** (consistent with the sentence-pattern rule, §5.1 rule 2).
- **Gibberish eligibility.** Vowel Flush and Straight **fire on gibberish too** (a deliberate jackpot — e.g. dumping Q-R-S-T-U-V); every other Word Hand is valid-words-only. See §6.4.
- **Knowledge tier (changed 2026-08-12).** Ranks 7–9 are difficult valid-word structures hidden until first completion. Y uses the shared vowel/consonant classification and is currently a consonant, so Vowelless starts at 5 physical letters. Type Economy and Grand Palindrome likewise use physical spelling length; Dummy Data's effective-length increase remains Longword-only.
- **Collision policy.** The highest rank remains the one scored and recorded. An Emoji Tile whose text explicitly says a hand is **contained** checks raw structure independently of that winner: Grand Palindrome can trigger Mirror Image, and a Type Economy word containing all five vowels can trigger Gathering while only Type Economy supplies the base Word-Hand score.
- **Run-only levels and Proof Stamps (changed 2026-08-21).** Every Word Hand starts at level 1. Clearing a blind awards the most-played scored hand one stamp per time it scored in that blind; if several hands tie, the latest tied hand wins. If no Word Hand scored, one profile-discovered hand receives one seeded-random stamp; an undiscovered knowledge-tier hand never enters this random pool until its first completion. A loss and a skipped blind award none. Advancing from current levels 1–5 costs 1 stamp, levels 6–8 cost 3, and level 9 onward costs 5; one award may cross multiple levels and keeps any remainder. Each level adds the hand row's rank-band Chips increment (+5 for ranks 1–3, +10 for ranks 4–6, +15 for ranks 7–9), while every third level gained adds +1 to its Mult factor. Fee Settlement presents the award as a proof-stamp tool slamming onto the awarded hand's ink mark, then rebounding and fading away so the hand name remains unobscured; multiple stamps use visual pips instead of a `+N` text line. Crossing a level shows only a light-green localized `LEVEL UP! / 레벨 업!` VFX below the stamp—no old/new level numerals. Run Info shows live level and stamp progress.

| Rank | Hand | Condition | Example | Bonus | Gibberish |
|---|---|---|---|---|---|
| 1 | Twin | two identical letters adjacent | b**OO**k | +15 Chips, ×1 Mult | no |
| 2 | Longword | 6+ letters | LETTER | +30 Chips, ×2 Mult | no |
| 3 | Triplet | same letter ×3 anywhere | b**A**n**A**n**A** | +45 Chips, ×2 Mult | no |
| 4 | Palindrome | reads the same reversed (len ≥ 3) | LEVEL | +45 Chips, ×3 Mult | no |
| 5 | Vowel Flush | contains all of A,E,I,O,U | SEQUOIA | +75 Chips, ×4 Mult | **yes** |
| 6 | Straight | 5 consecutive alphabet values (any order) | Q-R-S-T-U | +90 Chips, ×5 Mult | **yes** |
| 7 | Type Economy | 8+ physical letters, no repeated letter | DIALOGUE | +105 Chips, ×6 Mult | no |
| 8 | Vowelless | 5+ physical letters, no A/E/I/O/U | CRYPT | +120 Chips, ×7 Mult | no |
| 9 | Grand Palindrome | valid palindrome, 7+ physical letters | ROTATOR | +150 Chips, ×8 Mult | no |

- **Shipped-lexicon check (2026-08-22).** Among 172,255 valid entries, Vowelless has 60 candidates under the live Y-as-consonant rule (the hypothetical Y-as-vowel branch has 17), Type Economy has 10,164, and Grand Palindrome has 7. The four curated acronym surfaces qualify for none of these hands, so the sampled candidate counts and seeded 100,000-hand upper-bound rates remain roughly 1.56%, 7.56%, and 0.017% respectively; these are perfect-dictionary-solver rates, not expected human completion rates.
- **Preview, discovery & settle.** The original six always show by name. An undiscovered knowledge-tier match renders as `???` in both the staged-word status and Run Info name/condition; its score axes remain visible. Completing it writes the id into the active profile's `wj.lifetime`, and the settle stamp reveals the real name on that play. Profile → Reveal All marks all three discovered. The settle sequence otherwise stamps the matched name normally (UI_DESIGN §4).
- **In-game reference (changed 2026-08-14).** Run Info → Word Hands lists all nine ranks, current levels, live Chips/Mult bonuses, stamp progress, and run-use counts. As with sentence patterns, each condition/description lives in that row's shared portalled tooltip instead of inline copy. The nine-row list owns a bounded vertical scroll area at short viewports. It renders the operation as `+Chips ×Mult`: Chips keeps its additive `+`, while Mult is a multiplicative factor. Run Info → Patterns likewise shows each finalized pattern's run-wide use count to the right of its Chips/Mult axes.
- **Out of scope (for now):** dedicated Emoji Tiles keyed to Word Hand levels—see §12.4.

---

## 6. Core Loop: Phases, Hand & Discard

### 6.1 Loop Skeleton (one blind)

Blind starts → shuffle the bag (68-tile deck) → fill the hand (e.g. 10 tiles) → **[Phase: spell a word from hand tiles → submit → settle → draw back up by the number of tiles used]** repeat → early end or phases exhausted → blind ends; all used tiles return to the bag.

This parallels Balatro exactly: cards played within a blind do not return until the blind ends; the deck (bag) is a permanent, sculptable asset (§2, §9–10).

### 6.2 Hand Size — 10 (a balance knob)

Baseline hand size **10** (placeholder within the 10–12 band). Larger than
Balatro's 8 because poker *selects* from a hand while this game must *spell* —
more degrees of freedom are needed; larger than Scrabble's 7 because Scrabble
extends existing board letters while this game builds standalone words. Hand
size is an adjustable resource: Five-Color Lucky Pouch +1, Four-cut Photo and
Picture Diary +1 each, and boss hooks may reduce it, with a final minimum of 1 (§12). This single
number is a primary difficulty lever; tune against “average word length
achieved” in playtests.

The normal unique-source ceiling is **17**: `10 + 1 + 1 + 1 + 1 + 1 + 2`, from
the base, Five-Color Lucky Pouch, Four-cut Photo, Picture Diary, Juggler Tag,
Spare Drawer, and Folding Manuscript. Copy Editor is accounted for by a designed
**18-letter validity ceiling**: longer strings always follow the gibberish path,
even if an exceptional combination produces a hand larger than 18.

### 6.3 Discard — per-blind budget (Balatro-aligned; playtest-02 A-1)

Baseline is **4 discards per blind, with no per-use tile cap**: one discard may
dump any number of marked hand tiles. Yellow Pouch adds 1 and Yellow LP subtracts
1, with a final minimum of 0 (§12). **Discarded tiles exit play for the rest of
the blind** — they move to the discarded pile (like played tiles) and are NOT
returned to the bag mid-blind; the same number are drawn from the remaining bag.
Discarded tiles return to the bag only when the blind ends. (Earlier design
returned tiles to the bag immediately; that was dropped in favor of the
Balatro-aligned semantics so a discarded letter can't be redrawn within the same
blind.)

**Discard marking input (shipped 2026-08-22).** Right-click marks an eligible
unstaged hand tile. On touch, holding that tile for **500ms** calls the same mark
toggle exactly once; moving **5px or more** first cancels the hold and continues
the existing drag, while a shorter hold remains the ordinary staging tap. A
successful hold cannot become a drag before release and consumes its same-tile
compatibility click/context menu. Staged, disabled, boss-locked, and guided-lesson
tiles do not gain a long-press mark. Reduced Motion keeps the same 500ms input
dwell because it is not an animation.

The budget is **per blind, not per phase** — this is the point. Sharing the budget across phases creates inter-phase resource management ("burn discards now or save them for later phases"). A per-phase allowance would reduce it to a resetting convenience with no strategic weight.

### 6.4 Gibberish Submission (the high-card equivalent) — decision b-2

Letter scores are intrinsic tile value, so they must be recoverable regardless of word validity. Therefore:

- Any tile set may be submitted even if it is not a dictionary word.
- **Payout:** sum of letter Chips × 1.0. No suit (hence no suit multiplier), no
  POS. **Briefcase is the sole Starting-Pouch exception:** after every ordinary
  gibberish hook, it balances those final `Chips × 1.0` axes per §12.2.
- **Sequence effect (b-2):** the gibberish entry is recorded as a **hole** in the sentence sequence. Under whole-sequence matching (§5.1) a hole voids all pattern matches. Correction Tape removes a hole.
- **Word Hands (§5.5):** even as a hole, a gibberish submission can still score the gibberish-eligible Word Hands — **Vowel Flush** and **Straight**. The Straight jackpot (dumping Q-R-S-T-U) is the headline case; suit/POS stay null and the hole is still recorded.
- **Emoji tile interaction:** layer-1 (letter-level) emoji tiles fire on gibberish; layer-2/3 naturally cannot because suit and POS are null. R9 Dadaist is the explicit exception: it supplies final Slang membership, shows the Slang tag, and applies ×2.5 Mult, while `suit`/POS remain null and the sentence hole remains. No other rule is silently restored.
- **UI note:** after a gibberish word is submitted, the current sentence-pattern label disappears because the sequence no longer matches — the rule explains itself without warning dialogs.
- **UX surfacing (playtest-01 P0-3):** when staged tiles are not a valid word, the staged preview must say so explicitly (e.g. *"Not a word — submit as gibberish: +N chips, breaks the sentence"*) and the play button relabels to *Submit gibberish*. With the escape valve visible, the "my phase was wasted" complaint becomes impossible.

### 6.5 No Minimum Word Length

The Scrabble-style 2-letter floor is **removed**. Scrabble needs the floor because turns are unlimited; here **phases are the scarce resource**, so opportunity cost self-regulates cheap plays. Two ripples, both welcome:

- **"I" and "a" become budget sentence parts.** I (pronoun) + RUN (verb) = Simple in 2 phases. Opens a rush/sentence hybrid line; meshes with Emoji Tile C8 Short & Sharp.
- **1-tile gibberish = a paid mini-discard.** Dumping one dead tile spends a phase (and leaves a hole) instead of discard budget — a deliberate discard↔phase↔hole currency triangle.

The removed fixed minimum-word-length floor stays removed globally. Stereotype Plate is the sole conditional exception: during that Deadline it blocks a hand shorter than the longest valid word already played in the current Chapter (§8.3). This threshold comes from play history rather than a universal word-length rule.

### 6.6 Bag Depletion — the natural cap on long blinds

If the bag empties mid-blind, **no refill**; play continues on the remaining hand. Normally irrelevant (68 tiles), but any future phase-extension build remains physically capped by its available tile supply. **Zombie is the sole explicit exception:** after a play it moves every played physical letter tile from the blind's discard history back into the current blind's undrawn pouch.

**Exhaustion resolves the blind (2026-07-30).** If the hand *and* the pouch are both empty, the board cannot be played further, so the blind resolves immediately through the normal settlement path — the sentence bonus is finalized and, if the total still misses the target, the run ends. Reachable two ways: playing the last tiles, or discarding the whole hand with a dry pouch (§6.3 — discarded tiles do not come back mid-blind). One predicate, `blindExhausted`, serves both call sites; it does **not** short-circuit to Game Over, so the deciding sentence bonus is still seen landing (§7.2).

---

## 7. Scoring Pipeline

Score uses the same **Chips × Mult** structure as Balatro. Because the sentence bonus requires viewing all phases, settlement is two-layered rather than per-hand independent.

### 7.1 Two-Layer Settlement + Current Pattern Display

- **Layer 1 — individual word score (settled immediately).** On each phase submission, (letter score × suit multiplier × emoji tiles) is settled and accumulated immediately. Irreversible. Secures per-phase feedback.
- **Layer 2 — sentence bonus (projected → final).** Each phase, the "sequence so far" is judged (§5) and the projected score is updated — **overwrite, not accumulate**. The bonus is finalized from the sequence at the moment the blind ends.

> **Displayed round score = committed ONLY (playtest-04 A; changed 2026-07-31).** The big round number on screen is the **committed** score (layer 1) and **never decreases** — it climbs during each word's settle. Beside it, the UI shows the **current highest valid sentence pattern** and its live sentence-bonus score as `pattern name : score` (for example, `의문문 : 120`). That score is still a projection which may be overwritten as the sentence changes; it is never folded into the round number during play. The engine uses the same projected score for auto-clear, and the bonus resolves visibly in the settle sequence (§7.2) when it is the deciding factor.

> **Presentation speed baseline (group slam changed 2026-08-23).** Ordinary score beats use 600ms, enhanced Emoji beats 1000ms, and the final hold is 650ms. Before beat zero, every submitted tile moves as one rigid row through a single anticipation/drop/contact/recoil desk slam; its length-independent duration is 650ms/400ms/280ms at 1×/2×/4×. The shared contact tick applies every material-family burst simultaneously and fires at most one settings-scaled screen shake and one `submitThock`; later score-event ordering, audio, and shake remain unchanged. Lead Plate chance beats keep a 600ms real-time minimum, tile creation keeps 480ms, reduced motion stays fixed at 700ms with only a static contact highlight, and pack opening stays fixed at 2265ms. `settleDurationMs()` remains the single source for the settle-complete signal. Speed and screen-shake edits never replay an in-flight submission: speed is snapshotted for that submission, Reduced Motion ON cancels outstanding work and switches it to the fixed 700ms branch, and OFF applies from the next submission. (This user-approved group treatment supersedes the 2026-08-22 per-tile stagger.)

> **Why "overwrite"? — resolving the double-counting problem.** Committing the sentence bonus every phase creates double-counting/cancellation problems. Instead, separate the committed score and the projected score, and re-judge the entire sequence wholesale each time. Re-judgment cost is negligible (short sequences). Fully compatible with variable phases: whatever the phase count, only the end-of-blind sequence matters.

### 7.2 Auto-Settle & Phase Economy (playtest-03 B — replaces the early-end button)

The old "cash-out button unlocks at projected ≥ target" was a fake choice: surplus score is worthless and remaining phases pay gold, so continuing past the target was always wrong. **Auto-settle** removes the non-choice.

- **Trigger.** After a submission's **full settle sequence** (word settle → Word-Hand/suit stamps → **sentence-finalize animation**: pattern + unison bonuses visibly landing on the score), if the total ≥ target the blind auto-resolves to **Fee Settlement** — the round number rolls up, then after a short verdict beat the settlement modal opens (there is **no** intermediate "Cleared! + Settle button" screen; item 4 removed it — the modal's own Collect button confirms). There is no cash-out fake choice: it never offers to continue past target, so surplus score stays worthless and remaining-phase gold still rewards a fast clear. The sentence bonus must be *seen* pushing the score over when it is the deciding factor — this is the game's highlight moment, so the beat lets it land before the modal covers the board.
- **Final-score authority.** Every sentence-scoring hook, including Broken Sentence when no pattern exists, is included in the live projection before the end trigger is tested. Once the sentence-finalize sequence publishes `finalScore`, that exact value—not a later recomputation—is the sole input to clear/Game Over resolution. Its temporary Emoji Tile trigger state is cleared before either result modal appears.
- **Remaining phases = money.** Normally 1 gold per remaining phase, paid as a
  Fee Settlement line item (§9.1). Purple Pouch replaces this with $2 per phase
  and adds $1 per remaining discard (§12.2).
- **Redefinitions.** *Early end* := a blind cleared with ≥1 phase remaining (now automatic, not chosen). A 1-phase clear of a 5-phase blind still pays more remaining-phase gold than a last-phase clear; the confirmed Rare/Legendary roster no longer adds the retired Rush Specialist or Loan Shark bonuses.
- **Boss exceptions.** The auto-settle machinery keeps two dormant hooks for boss variations that don't yet exist in the roster: `earlyEndDisabled` (would force a single settlement check after all phases are used — the old "Perfectionist") and `previewHidden` (would hide the projection so the auto-clear arrives unpredictably — the old "Blindfold"). The current 21-boss roster (§8.3–§8.4, 2026-08-20) sets neither; the flags remain in the engine so such a boss can be added without re-plumbing. Ancient Paper (`ancientPaper`) is a *different* info attack — it hides only vowel-tile identities, not the projection.

### 7.3 Sentence Pattern = add Chips, then multiply Mult

Every pattern owns a base **[Chips × Mult]** (§5.2). At finalization, the Chips side adds to the committed score and the Mult side multiplies the combined result: `final = (committedScore + sentenceChips) × sentenceMult`. There is no per-pattern operation split; every pattern uses the same axis rule.

> **Balance warning — high-Mult sentences.** Sentence Mult now amplifies the whole committed blind score as well as pattern/modifier/Standard-Unison Chips. High-Mult patterns therefore scale strongly with late-game word builds; target curves and pattern levels must be verified together.

### 7.4 Final Pipeline Summary

**Probability-result presentation (changed 2026-08-04).** Any player-facing
object effect that makes a seeded success/failure or survive/destroy roll during
card use, scoring, or blind-end resolution must return that actual result to the
UI. The result appears as a compact trigger popup anchored immediately above or
below the same letter tile or Emoji Tile — never as a centred modal — with its
exact chance and an explicit Success/Failure or Survived/Destroyed verdict. This applies to The
Cowherd and the Weaver Girl, Lead Plate, Glass, Misbound, and future trigger
rolls. Shop/pack generation and random target selection show their generated or
selected object directly and do not add a redundant probability verdict.

**Per-qualifying-unit Emoji effects (changed 2026-08-26).** An effect described
as “each/per/마다” resolves once for every qualifying unit, never as one batched
count. Units include physical tiles, sentence-word records, POS tags, distinct
letters/materials/fonts, destroyed/created/enhanced tiles, held consumables, and
currency groups. Each unit mutates the running axis or growth state, emits its
own ordered engine event, and produces one Emoji Tile trigger presentation.
Multipliers compose sequentially. Tile units carry their source tile id;
sentence units keep sentence order; distinct axes attach to their first tile.
Retriggers repeat all eligible tile-unit effects. Boolean wording such as
“contains/includes” fires once even when several tags qualify. Stored growth is
the exception: every new growth cause emits independently, but the stored
current factor is applied to a later word once rather than replaying all historic
stacks. The UI replays engine events and never reconstructs or aggregates them.

**Each phase:** submit word → settle & accumulate individual score (letter × suit multiplier × emoji tiles) → re-judge sentence with current sequence → display the current highest valid pattern name while updating projected score internally → once the full settle sequence has played, if projected ≥ target the blind's clear is detected and, after the sentence bonus lands and a short beat, it auto-resolves to Fee Settlement (§7.2 — no early-end button, no intermediate verdict screen).

**On ending (early/final):** finalize the sentence axes from the sequence — add
pattern/modifier/Unison Chips to the committed score, then multiply by the
pattern/Unison Mult per §5.2–§5.3 → grant the
selected Pouch/Record's Fee Settlement lines (§9.1, §12) → end blind.

**Briefcase insertion point (§12.2):** after all hooks have finalized a word's
Chips and Mult, but before their product, balance the two axes to their arithmetic
mean. Repeat independently for the finalized sentence-bonus axes. No other
Starting Pouch rewrites the scoring pipeline.

### 7.5 Variable Phases

Base 5 phases per blind. Blue Pouch adds 1; Leather Pouch and Clear LP each
subtract 1, with a final minimum of 1 (§12). Other effects may modify it; the
player may also end in a single phase. Longer sentences seek pattern/modifier
value, while fast clears preserve remaining-phase gold. The confirmed Rare/Legendary roster no
longer hard-codes the retired Rush ↔ Epic Poet pair.

---

## 8. Blinds, Antes & Bosses

### 8.1 Terminology (corrected in v0.2)

- **Blind** = one round. Grants phases (base 5) + an discard budget; cleared by exceeding the target score. Early-end and remaining-phase rewards operate at this unit.
- **Ante** = a set of 3 blinds: **Small → Big → Boss**. The base target rises per ante.

All v0.1 uses of "ante" in the scoring chapter meant "blind" and are corrected throughout.

### 8.2 Scaling & Run Length

Balatro-mirrored: per-ante base score with **Small ×1 / Big ×1.5 / Boss ×2**. **A run's victory point is Chapter 8, followed by optional Endless Mode.** Clearing the Chapter-8 Deadline opens the Published screen. **New Run** ends the run; **Endless Mode →** preserves the already-earned win and continues through the normal Fee Settlement → shop flow into Chapter 9.

For an active Challenge, that same Chapter-8 Deadline clear is its sole
completion boundary. Endless play, a later loss, abandoning, and skipped blinds
cannot grant or revoke completion. The Published screen adds a compact Challenge
Complete line when the profile is eligible to record it (§12.1).

**Endless curve (implemented 2026-07-31).** For Chapter `a ≥ 9`, let `c = a − 8`. The base target is `105000 × (1.6 + (0.75c)^(1+0.2c))^c`, truncated downward to two significant digits before blind, Pouch, Record, and boss multipliers apply. This double-exponential curve deliberately outruns slot-limited scaling. Chapter 38 is the explicit finite-number endpoint: clearing its Deadline ends the endless run; Chapter 39 is never created. UI score text switches to compact scientific notation at one billion. Profile statistics track the best finalized blind score across every mode; Lifetime statistics separately track the highest Endless Chapter and best finalized Endless blind score.

**Curve re-tuned 2026-07-30** for the word-length Mult bonus (§3.1): `anteBaseTargets` scaled to hold the shape `src/sim/feel-chip-scale.ts` recorded (ante 1 ~77.5% clear, antes 2–4 falling off sharply), verified with `src/sim/length-mult.ts`. Pattern, Unison, Word-Hand and material constants were **not** scaled with it, so they are relatively weaker than before this pass — a known follow-up, not an oversight.

**Record/Pouch target modifiers (changed 2026-07-30).** Green LP adds
`×1.15^(Chapter−1)` and Briefcase adds ×2. They multiply the ordinary
Chapter/blind/boss target and round only once at the end (§12.1–§12.3).

**Blind skip & Editorial Perks (implemented 2026-07-31).** Draft and Revision may
be skipped; Deadline may never be skipped. Skipping immediately advances to the
next blind and forfeits every output of the skipped blind: clear reward, remaining
Phase/Discard rewards, interest, word/pattern and Emoji Tile growth triggers, Fee
Settlement, and the following Stationery Shop visit. The Chapter and scheduled
Deadline boss do not change.

Each Chapter rolls one seeded offer for Draft and one for Revision. Chapter 1's
Draft offer is uniform across all 30 rewards and its Revision offer across the
remaining 29. On later Chapter rolls, both Tags from the immediately preceding
Chapter are excluded first, leaving uniform 28/27-entry Draft/Revision pools.
This also prevents History Book or Old Book from restoring the same Tags when a
lowered Chapter number advances back to the number that originally rolled them.
The complete reward—including House Style's exact pattern—is disclosed on Blind
Select before the player chooses. There is no post-choice failure roll and no
Chapter gating in this first balance slice.

| Editorial Perk / 편집 특전 | Effect |
|---|---|
| Advance Payment · 선인세 | Gain **$7** immediately |
| House Style · 편집 지침 | Raise the disclosed sentence pattern by **1 level** immediately |
| Extra Pages · 증면 | The next blind actually played gets **+1 Phase** |
| Copy Pass · 교정 패스 | The next blind actually played gets **+1 Discard** |
| Quota Relief · 할당량 완화 | The next blind actually played has a **15% lower target** |
| Publicity Deal · 홍보 계약 | Add **$5** to the next successfully collected blind-clear reward |
| Cover Quote · 추천사 | The next blind actually played starts with **75 committed score** |
| Uncommon Tag · 고급 태그 | Add one free **Uncommon Emoji Tile** to the next shop |
| Rare Tag · 레어 태그 | Add one free **Rare Emoji Tile** to the next shop |
| White Tag · 화이트 태그 | The next base-edition shop Emoji Tile becomes **free + White** |
| Violet Tag · 바이올렛 태그 | The next base-edition shop Emoji Tile becomes **free + Violet** |
| Rainbow Tag · 레인보우 태그 | The next base-edition shop Emoji Tile becomes **free + Rainbow** |
| Gray Tag · 그레이 태그 | The next base-edition shop Emoji Tile becomes **free + Gray** |
| Investment Tag · 투자 태그 | Add **$25** to the next successfully cleared Deadline reward; its held Tag activates and disappears only when that Deadline reaches Fee Settlement |
| Voucher Tag · 바우처 태그 | Add one Voucher to the next shop; both choices may be purchased in that shop |
| Boss Tag · 보스 태그 | Immediately reroll the scheduled Deadline from its correct regular/finisher pool |
| Tile Tag · 타일 태그 | Immediately open a free **Premium Tile Pack** |
| Fable Tag · 우화 태그 | Immediately open a free **Premium Fable Pack** |
| Constellation Tag · 별자리 태그 | Immediately open a free **Premium Constellation Pack** |
| Charm Tag · 부적 태그 | Immediately open a free **Premium Charm Pack** |
| Handy Tag · 유용한 태그 | Gain **$1 per hand submitted this run** |
| Garbage Tag · 쓰레기 태그 | Gain **$1 per unused Discard banked on successful blind clears this run** |
| Ink Tag · 잉크 태그 | Immediately open a free **Basic Ink Pack** |
| Coupon Tag · 쿠폰 태그 | The next shop's **initial item stock and card packs are free**; rerolled stock is normally priced |
| Juggler Tag · 저글러 태그 | The next blind actually played gets **+2 hand size** |
| Economy Tag · 경제 태그 | Immediately gain current Fee again, capped at **+$25** |
| Reroll Tag · 리롤 태그 | The next shop's item-reroll progression starts at **$0**, then rises by $1 per reroll |
| Lipogram Tag · 리포그램 태그 | Disclose one seeded letter; the next played blind has a **30% lower target**, but valid words containing that letter are debuffed to 0 |
| Scarlet Tag · 주홍 태그 | Disclose one seeded letter; every physical tile of that letter retriggers once in the next played blind |
| Supply Tag · 보급 태그 | Immediately create up to **2 Base Common Emoji Tiles**, stopping at the effective slot limit and shared ownership/profile gates |

Next-blind effects stack and survive another skip; they are consumed only when
the player selects Play. Publicity, Investment, and next-shop effects persist
until their named successful resolution. An edition tag waits through a stock
roll with no base-edition Emoji Tile and may resolve on a reroll. Shop-facing Tag
icons remain visible through the played blind and Fee Settlement. They burst away
on the Shop screen only when `applyPendingShopTags` returns them in `appliedTags`;
an unresolved Tag stays visible and may redeem on a later reroll/shop. Reroll Tag
resolves on shop entry, then its visit-local $0/$1/$2 progression persists through
that shop's rerolls. Rewards classified
by `isImmediateSkipReward` are first presented as an acquired Tag, then auto-activate
and burst away; only after that sequence completes does the existing skip-reward
path mutate the run. Free-pack Tags enter the ordinary Pack Opening flow after the
burst and still resolve **before** the next blind is constructed, so every pouch
mutation is present when that blind draws. Reduced motion commits without the beat.
Delayed clear-reward Tags remain numerically distinct in the headless earnings
breakdown. Fee Settlement renders their money as an **Editorial Perk bonus** line
instead of silently folding it into the ordinary clear reward.
The two offers rolled for a Chapter must have different Tag ids, and neither id
may match either offer from the immediately preceding Chapter.
`src/engine/skipRewards.ts` is the headless source of truth,
all values live in `BALANCE.skipRewards`, and `RunState.skipOffers` persists the
Chapter's disclosed offers for seeded reproducibility. *(Changed 2026-07-31:
feedback expanded the original eight-entry publishing pool, then retired Lead
Story / 표지 기사; the alphabet-lore pass expanded the live pool to 30 entries.)* The
uninterrupted chain of next-blind selected offers feeding the next actually played blind is
derived from `skippedThisChapter`: up to two Tag icons wait at the lower-right
table edge, then flash `Tag Applied` and burst away as Play enters that blind.
They do not reappear on later screens; the source card's Tag remains non-interactive.
The tuning target remains a 20–35% skip rate.

### 8.3 Boss Pool — Design Principles & 15 Regular Bosses

Balatro bosses work because they (1) attack **one system at a time** (readable), (2) are crippling or harmless **depending on the build** (build check), and (3) always have **counterplay** (jokers/consumables). Applying that to our systems — score output, suits, POS, sentences, phases, discard, hand, preview, economy. The roster is themed to the publishing frame (each boss is a kind of paper/document); its engine ids are the semantic names in parentheses (see `src/engine/bosses.ts`), and each carries a pixel-art emblem in `docs/Arts/`.

**Score / target attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| Wanted · 수배 전단 (`wanted`) | Extra-large blind — target ×2 | Raw check on total scoring throughput; a pressure blind |
| Will · 유서 (`will`) | Base Chips **and** Mult halved (×0.5 each) | Attacks every build's base output; rewards patterns/multipliers |
| Forbidden Paper · 금서 (`forbiddenPaper`) | Only one suit may be played this blind — once a suit is established, a word sharing none of its final register tags voids to 0 (gibberish exempt) | Forces register overlap; Tower of Babel can supply one through its four final tags |
| Dead Letter · 사문자 (`deadLetter`) | On entry, seed one letter that has at least two physical copies in the blind; valid words containing it are debuffed to 0 | The letter is disclosed after entry; spell around it or use gibberish |

**Suit / POS attacks**

| Boss | Effect | Targets / counters |
|---|---|---|
| White Paper · 백지 (`whitePaper`) | Vulgar-suit words score 0 (debuffed) | Counter to Tyrant builds |
| Burnt Paper · 그을린 종이 (`burntPaper`) | Verb-POS words score 0 (debuffed) | Wastes the verb play; the remaining eligible words may still form a sentence |

**Repetition attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Memoirs · 회고록 (`memoirs`) | Any word already played **this ante** (Draft + Revision + earlier Deadline phases) scores 0 | Punishes narrow vocab; rewards run-long breadth |
| Stereotype Plate · 스테레오타입 판 (`stereotypePlate`) | Only hands at least as long as the longest valid word already played this Chapter may be submitted | Keep the Chapter's earlier maximum manageable; once active, maintain or exceed it |

**Debuff readability (changed 2026-07-29).** A word that an active boss will
reduce to 0 remains playable, but the staged tiles receive a red **Not Allowed**
tag before submission. Playing it shows the same warning and keeps the submitted
word in the sentence tray with a disabled/desaturated treatment and no POS or
Word Hand label. This applies
uniformly to Forbidden Paper, Memoirs, Burnt Paper, White Paper, and Dead Letter;
the boss data predicate is the source of truth for both
scoring and preview UI. The physical play, phase, draw, boss after-play action,
Collection/presentation discovery, and Chapter word history still resolve; all
score hooks, score-side RNG, score/progress ledgers, and Emoji Tile progress stop.

**Submission blocking (changed 2026-08-14).** Stereotype Plate is not a 0-score
debuff. A staged hand below its current Chapter threshold is marked blocked, and
Play is disabled; the headless submit path rejects the same hand. The threshold
is derived only from valid words already recorded this Chapter, but once set it
applies to every attempted hand, including gibberish.

**Sentence attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Orphan Line · 고아행 (`orphanLine`) | The first submitted word scores individually but is excluded from sentence-pattern and Unison judging | Front-load raw word score; build the grammar skeleton from word two onward |

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
| Ancient Paper · 고대 문서 (`ancientPaper`) | All vowel tiles are dealt **face-down** — letter, value, material, font, and edition are hidden behind one identical back until played; they score normally | Info-denial; spelling by feel — the face-down archetype (Balatro's face-down cards) |

**Economy attack**

| Boss | Effect | Targets / counters |
|---|---|---|
| Bond · 채권 (`bond`) | −$1 per **hand played** this blind | Pressures Miser / Interest Glutton economies (values tied to §9) |

### 8.4 Finisher Bosses

**Expanded 2026-08-05 to a six-boss tier.** A finisher is drawn only for the Deadline of every Chapter divisible by 8 (8, 16, 24, 32). All other Deadlines use the 15-boss pool in §8.3. Each finisher pays **$8** instead of the ordinary boss reward. The draw and every in-blind random choice use the run's seeded RNG.

| Finisher | Effect | Presentation / counterplay |
|---|---|---|
| Cleaning Sign · 청소 표지판 (`cleaningSign`) | −$2 per **discarded tile**; gold cannot fall below $0. | Pressures large discards without disabling the action. |
| Medusa · 메두사 (`medusa`) | After each hand, turn 2 seeded-random held non-Stone tiles into Stone; Stone tiles cannot be discarded during this blind. | Shrinks discard flexibility while leaving Stone playable as a gibberish escape. |
| Nokdo Script · 녹도 문자 (`nokdoScript`) | One random letter tile must remain selected and must be included in the next submitted word. It cannot be deselected or discarded. Consumables may still transform it—including changing it to Stone—or destroy it. If it leaves the hand, another random hand tile becomes forced; an empty hand has none. | A parchment bearing deer-track-like glyphs; build or consume around the forced tile. |
| Blueprint · 블루프린트 (`blueprint`) | On Deadline entry, shuffle the owned Emoji Tiles once and deal every one face-down. Their order and hidden faces then remain fixed for the blind; all effects stay active. Every face is restored as soon as the blind ends. | Every back is black and displays `mascotSrc('woodak')`, so it always follows the player's currently selected WooDak skin. |
| Vital Sign · 바이탈 사인 (`vitalSign`) | Target is ×3 the ordinary boss Deadline target (therefore base Chapter target ×6 before Pouch/Record modifiers). | Vital-sign monitor emblem; pure throughput check. |
| Ultrasound Photo · 초음파 사진 (`ultrasound`) | On entry, disable one random owned Emoji Tile. After every played word, clear that marker and randomly disable one for the next play. The new marker is presented only after the complete score/trigger timeline lands. A disabled tile contributes no hook or Emoji-Tile edition effect. With no Emoji Tiles, nothing is disabled. | Ultrasound-photo emblem; the disabled tile stays in its slot, visibly darkened and marked after a short disable beat. |

**Scheduled-blind invariant.** History Book or Old Book can lower Chapter 8 to
7 after its finisher has already been scheduled. The existing `chapterBossId`
and blind kind/index are preserved, so that Deadline remains the same finisher.
Deadline-only boss rerolls also stay within the finisher pool by deriving the
pool from the scheduled boss id, not the lowered Chapter number.

**No-repeat cycles (changed 2026-08-12).** The 15 ordinary bosses and six
finishers each keep an independent seeded draw history. A boss cannot appear
again until every boss in its own pool has appeared once; the pool then starts
a new cycle. Chapter previews, Sketch Book rerolls, and Boss Tags all consume
the same cycle, so rerolling never bypasses the rule.

**Pool intent:** the 15 regular bosses cover each system roughly once, while the
six finishers are periodic build checks. Memoirs remains scoped to the chapter;
the old Proofreader/Babel finishers remain retired.

**Debuff convention (changed 2026-08-26).** "Debuffed" (including boss and Lipogram Tag predicates) means an allowed physical play whose ordinary scoring pipeline stops immediately after pure word preparation/rule lookup. It normally produces one 0-point settle and never runs tile/material/font/edition scoring, Word Hands, played/held/owned Emoji Tile scoring hooks, `wordChecked`, `tilesPlayed`, `wordScored`, Briefcase balancing, score bonuses, score-side chance RNG, or score/progress mutations. **Uncensored is the sole exception:** a debuffed dictionary word emits one Uncensored +100 Chips event and settles at `100 × 1`; every other short-circuit restriction remains in force. The submission keeps `posUsed = null` and is removed before Pattern and Unison judgment, so normal words before and after it become adjacent. It remains visible as a disabled tray record; physical tile/phase consumption, draw, boss `afterPlay`, actual-play Collection/chromatic/mascot discovery, and `wordsThisAnte` remain intact. Gibberish is unchanged: it scores its normal layer-1 payout and remains a sentence hole.

---

## 9. Shop & Economy

### 9.1 Money Sources (four streams)

| Source | Amount (placeholder) |
|---|---|
| Blind clear reward | Small 3 / Big 4 / ordinary Boss 5 / Finisher Boss 8 gold |
| Remaining phases on blind end | 1 gold per phase |
| Interest | 1 gold per 5 held, **cap 5** (max interest from 25 gold) |
| Selling Emoji Tiles/cards | Half of the currently recalculated shop price, rounded down (minimum $1) |

> **Interest is the heart** (adopted as-is): the cap creates the "save to 25, spend above it" rhythm and the early-game conflict between buying Emoji Tiles and building an interest base. Miser converts held gold into current Mult, while R10 Interest Glutton converts interest actually received into next-round Mult; Bond (§8.3) pressures both economies.

**Starting-Pouch/Record overrides (§12).** Purple Pouch replaces the remaining
phase rate with $2, adds $1 per remaining discard, and forces interest to $0.
Red LP makes only the Draft clear reward $0. DVD also forces interest to $0.
These are explicit line-item overrides; all unaffected income streams remain.

### 9.2 Shop Layout — five stalls

Balatro-mirrored baseline: **Item slots ×2** + **Pack slots ×2** + **Voucher slot ×1**. The first Stationery Shop actually entered in a run guarantees one **Basic Charm Pack**; skipped blinds do not consume this guarantee. Voucher Tag may add one temporary second Voucher choice, and rarity tags may append their guaranteed free Emoji Tile; these are disclosed reward exceptions, not changes to ordinary stock counts. Available item-family weights are **Emoji Tile 20 · Fable 4 · Constellation 4** (`balance.ts` `shop.itemWeights`). EN-KO Dictionary adds letter tiles at weight **4**; Encyclopedia lets those shop tiles roll material and edition, but no font. **Lucky Pouch** adds implemented Gambler Cards as a separate weight-**2** family (§12.2). Unavailable families are removed and the remaining weights normalize automatically. Story Book/Novel and Bible/The Law multiply the corresponding base weight by **×2/×8**. **Reroll:** base 5 Fee, +1 per reroll, refreshes item slots only; packs and the Voucher are unchanged. Reroll Tag changes that next visited shop's base to 0, producing $0, $1, $2… before ordinary discounts/floors.

**Offer interaction (pack rollback 2026-07-30).** Shop stalls are image-first. Emoji Tiles, consumables, and the vertical voucher use the shared rounded `124×165px` stage. Sale packs use the requested older `131×229px` foreground with square corners. Their row slots match the 131px art width, preserving the normal 12px gap between packs, and the pack panel reserves enough lower space for the attached Open button to remain inside the persistent run layer. The price tag shares one foreground layer with the product and action. Selecting an offer raises that complete layer by 59px — the 15px base lift plus the 44px action-button height — and reveals the attached action: **Buy** for ordinary stock, **Redeem** for the voucher, and **Open** for packs. This does not reflow the stall layout. When an instant-use option exists, Buy remains below while **Use now** appears vertically centred outside the product's right edge. Product animation is never clipped. Voucher and pack background panels retain a `273px` minimum height. Only one offer action is expanded at a time; sold stalls render as empty placeholders.

**Persistent framing (changed 2026-07-31).** The shop is a lower panel on the same run table as the blind. The sidebar resets score/Chips/Mult/hand/discard readouts and displays SHOP; owned Emoji Tiles, consumables and the pouch remain mounted. On the shop's first frame the pouch switches from the completed blind's undrawn remainder to the complete permanent `run.bag`; stale `blind.bag` contents must never remain visible there. Because the sidebar and settlement provider stay mounted, shop entry also consumes the previous blind's UI-only settle log/id and finalized sentence fields before the first shop frame; the zero reset is immediate and must never replay the prior score animation.

**Full consumable slots and shop consumables (changed 2026-08-05).** A full held-consumable zone disables **Buy** for a consumable offer. An affordable shop Constellation still offers **Use now** even when the zone is full: it charges the same price, levels its pattern immediately, and never occupies a resting slot. A shop-offered Fable whose effect targets letter tiles is the exception: it shows **Buy only**, enters a held slot, and may be used only during a blind; it cannot use pouch tiles from the shop and has no Use-now fallback when slots are full. Blind-only Fables follow the same Buy-only presentation. Gambler cards follow their live engine preconditions: a field-free card shows **Use now** only when it can resolve immediately, while every card that needs an active tile field is Buy-only and must be held for a blind.

**No duplicate live offers (changed 2026-08-05).** Ordinarily, item slots cannot show the same item id twice, and owned Emoji Tiles, Fables, Constellations, and Gambler cards are removed from shop and pack candidate pools. A non-tile object currently displayed in the shop's item stock is also excluded from packs opened in that same shop, so taking a pack option can never stale the matching Buy action; this cross-surface exclusion remains active while Copy Editor is owned. Copy Editor still lets those object families draw owned ids and repeated ids within one stock or one pack. Pack slots themselves still cannot show the same type/size pair twice in one shop.

**Voucher slot rules (playtest-03 C).**
- **Reroll never refreshes the voucher slot** — it is immune to rerolls.
- **One voucher purchase per chapter (ante)**; only an effect that explicitly grants extra purchases can exceed this. Buying greys the slot for the rest of the chapter.
- **Voucher Tag adds one extra purchase.** It shows a second, distinct Voucher in the next shop, and both choices may be redeemed there. The first redemption still sets the Chapter lock; the tagged survivor is the sole exception and disappears after its second redemption or on leaving the shop.
- **Restock timing:** the voucher slot restocks when the Deadline (boss blind) ends — the *next* chapter's shop carries the new voucher. Within a chapter, the same voucher persists across the Draft/Revision/Deadline shops.
- **Base→upgrade cooldown (changed 2026-08-04):** redeeming a base Voucher suppresses its unlocked upgrade from the immediately following Chapter restock. The upgrade returns to the ordinary uniform pool at the next restock after that. Voucher Tag applies this one-restock cooldown to each base it redeems.
- **Reappearance (Balatro-style, changed 2026-08-14):** purchased vouchers never reappear this run. An **unpurchased** voucher remains in the pool but cannot be the immediately next Chapter's offer; after at least one different Chapter offer, it may reappear.
- **Redemption presentation (changed 2026-07-30):** Redeem shreds the voucher
  vertically from top to bottom: a cutter head descends, narrow cut lanes open
  behind it, and the separated strips drop away before the slot clears. Shop
  actions are briefly locked so the visual delay cannot double-buy or leave the
  shop midway. Reduced motion commits immediately.

**Price policy (changed 2026-08-07):** Emoji Tiles use fixed rarity prices **Common $4 · Uncommon $6 · Rare $9 · Legendary $15**. Letter tiles cost $1; Fable/Constellation cards $3; Gambler cards $4; Basic/Classic/Premium packs $4/$6/$8; Vouchers $10. Gray/Violet/Rainbow/White editions add **$2/$3/$5/$5** to an Emoji Tile, and letter-tile editions use the same applicable surcharge. Newspaper/Papyrus apply 25%/50% after the surcharge, round down, and enforce a $1 minimum; Coupon Tag's explicit free stock remains $0. Selling recalculates that item's **current** discounted, edition-adjusted price, halves it, rounds down, and enforces a $1 minimum. A non-Base Emoji Tile is always worth at least $1 more than its otherwise identical Base edition, even when discounts and rounding would collapse both values. Buying a discount Voucher can still lower the sale value of already-owned objects.

**Emoji tile appearance rates by rarity (`balance.ts` `emoji.rarityWeights`).** Balatro's reference distribution is **Common 70% · Uncommon 25% · Rare 5%**. **Legendary (5 tiles) never rolls from the shop or ordinary Charm Packs.** Its implemented acquisition route is the Phoenix Gambler card (§10.3), available only as an Ink-Pack jackpot, which creates one random unowned Legendary.

**Profile lock filter (implemented 2026-08-05; corrected 2026-08-26).** Common,
Uncommon, and Rare use an immediately available **76-tile ordinary starter
subset** plus **69** individual unlock conditions (**10 / 29 / 30** by rarity). The five
Legendary definitions have no profile gate. Only an **unseeded** run advances or
earns achievements; progress is profile-scoped in `wj.emojiUnlocks`. Locked
non-Legendary ids are excluded from shop stock and stale purchases, Charm Pack
offers and picks, Fable random creation, Crane-and-Sun Rare creation, and every
future ordinary acquisition route. Phoenix remains the special Legendary route
and draws from all five unowned Legendary definitions. Collection fully covers
undiscovered artwork and shows `Not discovered / 발견되지 않음` plus a generic
unseeded-run purchase/use hint; identity, effect, condition, and progress remain
hidden. Achievement
thresholds live in `BALANCE.emoji.unlockTargets`, condition text in
`locales/{en,ko}.json`, and semantic event evaluation in
`src/ui/emojiUnlocks.ts`; engine pool functions receive only the eligible-id set
and remain headless. Profile Reveal All unlocks the full achievement registry.
Newly earned gated Emoji Tiles are included in the integrated run-end unlock
recap described in `docs/screens-spec.md` §2.7; Reveal All's synthetic bulk
grant is never recapped.

**No duplicate owned objects (rule, expanded 2026-08-05).** Ordinarily, a run
cannot acquire an Emoji Tile, Fable, Constellation, or Gambler card whose id it
already owns. The shared gates filter shop stock and purchase, pack offers and
picks, and direct/random acquisition routes. Selling or consuming an object
returns its id to the ordinary pool.
**Exceptions — only an explicit effect may break this.** While Copy Editor is
owned, shops and packs may offer and acquire duplicate ids from all four object
families; selling Copy Editor ends that permission and has no copy-on-sell effect.
Boar (§10.3) remains a one-shot direct-copy exception: it keeps one complete
copy of a random owned Emoji Tile and destroys the others.

### 9.3 Packs — where materials & fonts enter the economy

Tile acquisition is pack-select by default. **EN-KO Dictionary** also allows individual letter tiles to appear in shop card slots; **Encyclopedia** lets those shop tiles roll material and edition modifiers. Shop tiles never roll a font.

**Five pack types in the design** (publishing-world names; Balatro analogs in parentheses), each rolling at one of **three sizes**. *(Changed 2026-07-27: the third consumable pack returns as the **Ink Pack** — the source of the Gambler cards (§10.3) — so the consumable packs are Fable / Ink / Constellation. The older Forbidden Stacks / Spectral naming stays retired. All five packs below now roll in the shop.)*

| Pack (ko / en) | Contents | Analog |
|---|---|---|
| 별자리 팩 / **Constellation Pack** | Constellation cards — selected and **used immediately inside the pack** to level up their sentence pattern (§5.4), independent of held-slot capacity | Celestial |
| 부적 팩 / **Charm Pack** | Emoji tile choices | Buffoon |
| 우화 팩 / **Fable Pack** | Fable card choices (§10.1) plus ten seeded pouch tiles used as the active candidate field for compatible dealt or held Fable/Gambler effects. Fables resolve inside the opened pack; blind-only Fables are selected into a held slot instead. Comic Book may add one ordinary Gambler card. | Arcana |
| 잉크 팩 / **Ink Pack** | Gambler card choices (§10.3), plus ten seeded pouch tiles as the active candidate field for compatible dealt or held Fable/Gambler effects | Spectral |
| 타일 팩 / **Tile Pack** | Letter tiles; enhanced (material/font) variants may appear pre-attached | Standard |

**Sizes:** Tile/Fable/Constellation Packs show **3/5/5** choices at Basic/Classic/Premium; Charm/Ink Packs show **2/4/4**. The player may take up to **1/1/2**, respectively. Prices are **$4/$6/$8** by size (`balance.ts` `pack.size`). **All five families have supplied art** (`src/ui/packArt.ts`): **Tile** 8 (Basic ×4, Classic ×2, Premium ×2), **Charm** 4 (Basic ×2, Classic, Premium), **Fable** 8 (Basic ×4, Classic ×2, Premium ×2), **Constellation** 8 (Basic ×4, Classic ×2, Premium ×2), and **Ink** 4 (Basic ×2, Classic, Premium). All 32 illustrations keep 32-color, path-only SVG masters normalized to a shared `244×400` canvas and `122×200` logical grid, while runtime surfaces load pixel-identical `244×400` PNG derivatives; original source PNGs remain in `docs/Arts/CardPacks`. `scripts/check-card-assets.mjs` verifies both forms. Each pack has an idle animation and one game-speed-independent **2265ms** locked open sequence: the illustrated pack rattles, compresses toward its lower anchor, and rebounds into the burst over the first 420ms; its top then tears away, exactly one fake back per real choice (2–5) pours out, and the existing real choice shells start landing directly on their final fan paths at 1100ms and finish by 1820ms. Even the shortest two-choice fake spill remains visible until 1180ms, overlapping the incoming real shells so there is no blank flash or second landing; all ten candidates still begin at 1500ms and finish by the 2265ms ready point. Reduced motion reveals and enables the fan immediately (changed 2026-08-22).

**Appearance weights (changed 2026-08-04).** Type weights (`pack.typeWeights`) are **Fable 4 · Constellation 4 · Tile 4 · Charm 1.2 · Ink 0.6**. Size weights (`pack.sizeWeights`) are **Basic 8 · Classic 4 · Premium 1**. A type/size pair's weight is their product; the two shop pack slots draw without replacement, so duplicate pairs cannot appear together.

**Tile modifiers.** Every Tile-Pack choice rolls its three axes independently: non-base material **40%**, non-base font **20%**, and edition **8%** (Gray 4% / Violet 2.8% / Rainbow 1.2%). A rolled Stone always forces the font result back to Medium. Flyer/Wanted Poster raise only that edition table to 16%/32%. An Encyclopedia shop tile instead rolls material 40%, no font, and a fixed edition table totaling 20% (Gray 10% / Violet 7% / Rainbow 3%), unaffected by Flyer/Wanted Poster.

**Ink-only jackpots and ordinary rolls (changed 2026-08-07).** Every Ink choice reserves an independent **0.3% Phoenix** band and **0.3% Deer** band. The remaining 99.4% is divided uniformly among the 12 ordinary Gambler Cards, so each ordinary card has an **8.2833% base chance on the first fully eligible choice**. Ordinary choices are drawn without replacement inside one pack; later-choice odds therefore normalize over the remaining eligible pool. If a rolled jackpot is ineligible, its band falls back to an ordinary card and never increases the other jackpot's chance. Fable and Constellation Packs never roll either jackpot. Comic Book gives each Fable choice a **5%** chance to become an ordinary Gambler card, capped at one replacement per pack. Constellation choices exclude cards already held in the consumable shelf; B&W Photo's forced favorite remains the explicit inclusion exception. All rolls use the seeded RNG and values live in `balance.ts` (`pack.phoenixChance`, `pack.deerChance`, `pack.gamblerInFableChance`).

> **Impl note (updated 2026-08-20).** All **five** engine pack types × 3 sizes ship (weights, prices, opening UI). Tile/Charm are complete; the Fable pool contains 20 implemented cards; Constellation offers 12 zodiac cards; the **Ink Pack** offers the 12 ordinary Gambler cards plus the per-choice Phoenix/Deer jackpots (§10.3) and deals the same ten-tile pouch candidate field a Fable Pack does. Compatible held tile-targeting Fables and held Gamblers may resolve against either pack's candidates. Selecting a Constellation in its pack reveals **Use**; it levels the mapped pattern directly and never enters the held consumable zone. A Gambler chosen in a pack follows the Fable confirm-then-**Use** flow and resolves against those candidates. Code ids stay semantic (`PackType` = `pattern | joker | consumable | tile | ink`); display names are i18n-only.

### 9.4 Vouchers — 16 base + 16 upgraded

Changed 2026-07-26: the former 9-item single-tier set is retired. Every pair has a base voucher and a profile-unlocked upgrade. An upgrade can enter the run pool only after its profile condition is met **and** its base voucher is owned in that run. The base's immediately following restock is skipped once before the upgrade becomes eligible. One purchase per chapter and fixed chapter offers still apply.

**Collection disclosure (changed 2026-07-27).** A profile-locked upgrade is
listed as **Undiscovered / 발견되지 않음**. Its Collection tooltip shows only the
unseeded-run redemption hint; its real name, effect, unlock condition, and
progress remain hidden until the profile unlock is earned.

All 16 numeric achievement thresholds live in
`BALANCE.voucher.unlockTargets`; `VOUCHER_UNLOCK_RULES` references those values
and preserves the localized condition wording below. Custom-seeded runs neither
advance nor evaluate Voucher achievements. A newly discovered upgrade appears
in the integrated run-end unlock recap (`docs/screens-spec.md` §2.7).

| Base → Upgrade | Base effect → upgraded effect | Upgrade unlock |
|---|---|---|
| Story Book → Novel | Fable shop weight ×2 → ×8 | Buy 50 Fable cards from shops |
| Bible → The Law | Constellation shop weight ×2 → ×8 | Buy 50 Constellation cards from shops |
| Fashion Book → Fashion Magazine | Reroll −$2 → an additional −$2 | 100 shop rerolls |
| Newspaper → Papyrus | Shop cards/packs 25% off → 50% off | Use 10 vouchers in one run |
| Flyer → Wanted Poster | Use the Flyer → Wanted Poster Gray/Violet/Rainbow probability tables in §11.8; White remains 0.3% | Own 5 editioned Emoji Tiles at once |
| Memo → Notebook | +1 phase per round → another +1 | Play 5,000 tiles |
| Poetry Book → Sheet Music | +1 discard per round → another +1 | Discard 5,000 tiles |
| Four-cut Photo → Picture Diary | Hand size +1 → another +1 | Reduce hand size to 8 |
| EN-KO Dictionary → Encyclopedia | Shop may sell plain tiles → shop tiles may carry material/edition (never font) | Buy 20 shop tiles |
| Receipt → Household Ledger | Interest cap $10 → $20 | Hit the interest cap 10 rounds consecutively |
| Sketch Book → Portrait | One boss reroll per chapter for $10 → unlimited $10 rerolls; the control is available only on Blind Select when the current blind is the Deadline, never while it is merely upcoming | Discover all 15 regular bosses (finishers do not substitute) |
| Catalog → Coupon Book | Shop card slots 3 → 4 | Spend $2,500 in shops |
| History Book → Old Book | −1 Chapter and −1 hand size → another −1 Chapter and −1 discard/round; each redemption preserves the already-scheduled blind kind/index and boss id | Win by clearing the Chapter-8 Deadline |
| Blank Paper → Kung Fu Manual | No effect → +1 Emoji Tile slot | Use Blank Paper 10 times |
| B&W Photo → Yearbook | Constellation pack guarantees the most-played pattern's card → a held matching card grants ×1.5 sentence Mult | Use 100 Constellation cards |
| Zero Score → Comic Book | +1 consumable slot → Gambler cards may appear in Fable packs | Use 50 Fable cards |

All voucher tuning values live in `balance.ts`. Profile progress lives at `wj.vouchers`, outside `RunState`.

**History Book timing (changed 2026-07-31).** Redeeming History Book immediately lowers the current Chapter by 1 (Chapter 1 may become Chapter 0) and lowers hand size by 1. It does not rewind the blind sequence: the Draft, Revision, Deadline, and exact scheduled boss id remain at the same `blindIndex`, now using the lowered Ante's target. Old Book follows the same rule for its additional Ante reduction. This explicitly preserves a Chapter-8 finisher when the Chapter number becomes 7.

---

## 10. Consumables

Three families mapping Balatro's trio, themed for a word game. **Held slots: 2**
(expandable via Zero Score; Military Pouch subtracts 1, §12.2). **Usable during
blinds** — essential: Correction Tape and Shift only matter mid-blind. Acquired
from shop item slots and packs.

**Fable/Ink Pack pouch-candidate resolution (changed 2026-08-21).** A revealed Fable initially has no action button. Selecting its card reveals **Use**; tile-targeting Fables keep Use disabled until at least one and no more than the effect's listed maximum candidate-tile count is selected from the ten seeded pouch tiles, while non-tile effects ignore candidate selection and never animate candidate targets. The candidate field appears during opening but becomes selectable only when the shared 2265ms pack-ready gate opens. Compatible held tile-targeting Fable and held Gambler Use actions on the persistent sibling shelf share that lock during opening, option/held-use resolution, and closing; once ready, they may use the active field. Direct-target Gamblers require exactly one eligible selected candidate; Bridge, Butterflies, and Full Moon use the whole field and ignore selection; the remaining field-independent Gamblers ignore the candidates and retain their ordinary preconditions. This is the only shop-phase exception to normal blind-hand targeting. A held use revalidates the live candidate row immediately before commit, consumes only the held card, synchronizes changed or removed candidates, clears selection, and leaves the pack options, pick count, and open state untouched; created or copied tiles enter the pouch but not the fixed candidate row. Preview and delayed commit replay the same seeded action key, block conflicting shelf mutations until resolution, and advance RNG exactly once only after success; cancellation consumes neither the card nor RNG. A pack close request immediately blocks new held uses, cancels a pending one, and still completes the pack transition after its close animation. Enabled and disabled Use states occupy the same fixed position. Direct letter/material/font/edition changes preview before commit, while other outcomes use the shared result vignette. Only after the animation ends does a pack-dealt Fable hold for 0.5 seconds and close (or reflow for another Mega-pack pick). A blind-only Fable is the exception: selecting it reveals **Select** instead of Use, and Select moves it into a held consumable slot for later blind use (disabled when no slot is free). No additional instant/blind-only classification is added to the card tooltip.

**Constellation Pack resolution (changed 2026-07-29).** A revealed Constellation follows the same select-then-confirm interaction, but its action is always named **Use**, never Select. Use immediately levels the mapped sentence pattern, plays the full Constellation level-up sequence, ignores held-consumable capacity, and does not place the card in a held slot.

**Held-slot presentation (changed 2026-07-31).** A held consumable is the supplied card illustration acting directly as an interactive foreground object. The shelf slot reserves transparent space only: it does not add a second card background, inset image frame, persistent name, or crop. Sell and Use belong to the same mouse-interaction transform as the image, so idle motion, pointer tilt, rotation, scaling, and lift move the card and buttons together without reflowing the shelf. Sell is vertically centred at the image's right and Use sits beneath it; both match the shop Buy button's dimensions. An owned Emoji Tile and its Sell button use the same centred position, dimensions, and shared pointer transform.

### 10.1 Fable Cards (Tarot-equivalent), 20

Held targeted effects normally use the tiles currently staged on the board. A
target-requiring held card cannot be consumed until one to its listed maximum valid
target count is staged. While a Fable or Ink Pack is open, the same held effect instead may
target the pack's immediately active ten seeded pouch candidates under the same
range. Random creation
respects the destination slot cap.

**Art rendering (changed 2026-08-14).** All 20 supplied pixel illustrations keep
high-detail, path-only SVG masters normalized to one `500×700` canvas (fixed 5:7
ratio, 32-color palette, `250×350` logical pixel grid). Every source illustration
is stretched to the full common image bounds established by The North Wind and
the Sun, so all 20 cards have identical visible width and height with no cropping
or unequal internal margins. No SVG master embeds a raster image. Collection,
shop, pack opening, and the held-card shelf reuse pixel-identical `500×700` PNG
runtime derivatives inside the shared framed component; this avoids parsing the
masters' dense path data without changing their pixels. The original English
title plate remains part of each traced illustration; the localized card name is
also available through the surrounding tooltip and accessible label.

| # | Fable | Effect |
|---:|---|---|
| 1 | The North Wind and the Sun | Magnifier: show up to 3 spellable words in the current hand |
| 2 | The Boy Who Cried Wolf | Create the last Fable or Constellation card used this run; Use/Use now stays disabled until one has been used this run |
| 3 | The Ant and the Grasshopper | Create up to 2 random Fable cards while slots are available |
| 4 | The Golden Axe and the Silver Axe | Turn 2 selected tiles into Lead Plate |
| 5 | The Fox and the Crane | Turn 1 selected tile into Stone |
| 6 | The Tortoise and the Hare | Turn 2 selected tiles into Polished |
| 7 | The Fox and the Sour Grapes | Turn 2 selected tiles into Porcelain (+30 Chips) |
| 8 | The Lion and the Mouse | Turn 1 selected tile into Glass |
| 9 | The Goose That Laid the Golden Eggs | Gain gold equal to current gold, capped at +$20 |
| 10 | The Town Mouse and the Country Mouse | Create up to 2 distinct random Constellation cards while slots are available; cards created by one use never duplicate each other |
| 11 | The Bear and the Travelers | Turn 1 selected tile into Ivory |
| 12 | Belling the Cat | Turn 1 selected tile into Brass |
| 13 | The Wolf and the Crane | Turn 1 selected tile into Wood |
| 14 | Heungbu and Nolbu | Create 1 random Emoji Tile if an Emoji Tile slot is available |
| 15 | The Cowherd and the Weaver Girl | 1/4 chance to give one random uneditioned Emoji Tile an edition; a success selects Gray/Violet/Rainbow at 50%/35%/15%; unusable if none is eligible |
| 16 | The Rabbit and the Turtle | Raise 2 selected tile letters by one alphabet rank; Z wraps to A |
| 17 | The Heavenly Maiden and the Woodcutter | Gain the total sell value of all owned Emoji Tiles, capped at +$50; its tooltip shows the live capped payout from the currently owned Emoji Tiles |
| 18 | Shim Cheong | Destroy 1–2 selected tiles, removing them from the run's pouch |
| 19 | The Crow and the Pitcher | Add 2 Proof Stamps to the most recently scored Word Hand |
| 20 | The Ass in the Lion's Skin | 1/4 chance to give 1 selected Base letter tile a seeded-random Gray/Violet/Rainbow edition at 50%/35%/15%; preserve its material and font |

The edition outcome weights above remain authoritative internal tuning. Player-facing descriptions list Gray, Violet, and Rainbow without their individual 50%/35%/15% weights; both The Cowherd and the Weaver Girl and The Ass in the Lion's Skin disclose their separate 1-in-4 activation chances. A failed Ass attempt still consumes the Fable and fires the ordinary Fable-use/chance presentation, but does not mutate or count the tile as enhanced. (Changed 2026-08-21.)

The Crow and the Pitcher's result vignette names the affected Word Hand and
shows its exact `Lv before → Lv after`. The Ass in the Lion's Skin visibly
previews the selected letter tile changing from its Base state to the rolled
edition before or as the mutation commits; a generic `Applied` result is never
the sole feedback for either card.

### 10.2 Constellation Cards (Planet-equivalent) — pattern level-up, 12

One per sentence pattern, 1:1 (full mapping and increments in §5.4). Using a Constellation card permanently levels its pattern: each use adds the pattern's fixed Chips increment and +1 Mult (§5.2). Specializing into the most-played patterns is the intended play.

**Use sequence (changed 2026-07-29).** The used card shakes while the score
panel presents the pattern's current Mult and Chips. The green `+Mult` increment
merges first, then the green `+Chips` increment. The level label then transitions
from the old level to the new one, the shake ends, and the card pixel-dissolves.
The full presentation lasts **3.5 seconds** (changed 2026-07-29: 500ms faster
than the prior 4.0-second timing).
All displayed values are derived from the same §5.2 balance rows used by scoring.

Each of the 12 monochrome zodiac illustrations keeps a 32-color, path-only SVG
master stretched without cropping to the Fable card standard: `500×700` output,
fixed 5:7 ratio, and a `250×350` logical pixel grid. Collection, shop, pack, and
held-card surfaces use its pixel-identical PNG runtime derivative in the same
shared SVG frame component as Fable and Gambler cards (changed 2026-07-31).
The correctly spelled `Aquarius.svg` / `aquarius` mapping is retained.

### 10.3 Gambler Cards — 14 implemented

**Gambler cards / 노름꾼 카드** are the third card family (renamed from "Ink
Cards / 잉크 카드", 2026-07-27) and already have a Collection category. Their
designed native source is the **Ink Pack / 잉크 팩** (§9.3) — the Ink name moved
from the family to its pack. Fourteen supplied illustrations are registered in
the UI-only gallery: Barn Swallow, Boar, Bridge, Bush Warbler, Butterflies,
Crane and Sun, Cuckoo, Curtain, Deer, Full Moon, Geese, Phoenix, Rainman, and
Sake Cup (a hwatu/화투 motif set — hence the gambler framing). Each source PNG
is traced into the same 32-color, path-only SVG master standard as Fable and
Constellation cards: `500×700`, fixed 5:7 ratio, and a `250×350` logical pixel
grid. Runtime uses the trace's pixel-identical PNG derivative inside the shared
SVG frame (changed 2026-07-31). All fourteen effects
**ship as of 2026-08-03** in `src/engine/gamblers.ts`
with every acquisition route wired (§9.3). The former Forbidden Books/Spectral placeholder
roster stays retired — the Ink name now belongs to the pack, not to a card
family. The Collection key stays `inkCards` (display-only rename).

**Class (confirmed 2026-07-27): Gambler cards are our Spectral analog.** They are
**rare, powerful, and usually double-edged** — the family that changes a run
rather than nudging it, in the way Balatro's spectrals do (dramatic upside paid
for with a cost or a risk). This justifies the Ink Pack's low roll weight (§9.3,
weight 0.6): the pack is a jackpot, not a staple. The hwatu motif set reinforces
the framing — these are gambles.

**Ink Pack naming: settled.** The pack is the **Ink Pack / 잉크 팩** and the Gambler cards are its contents. The "Forbidden Books / 금서 팩" line stays **deferred** — not revived as a separate sixth pack, not used as an alternate name for this one. Revisit only if a concrete need appears that the five existing families cannot cover.

**Acquisition routing (changed 2026-08-07).** Ink Packs are the only route for
Deer and Phoenix, each with an independent 0.3% band per choice. The other 12
Gambler Cards share the remaining 99.4% uniformly and are drawn without
replacement. Comic Book enables one ordinary Gambler replacement at 5% per
eligible Fable choice, maximum one per pack. Lucky Pouch's starting card and
shop family also use only the uniformly distributed ordinary 12. All rolls use
the seeded RNG.

**Target field (changed 2026-08-20).** A held Gambler card used during a blind targets the current
hand. A Gambler dealt by or already held while either a Fable or Ink Pack is open instead uses that
pack's seeded pouch-candidate field. Direct font changes follow the same preview-before-commit
discipline as Fables; other mutations use the shared result vignette. Font changes overwrite only the font axis and cannot target Stone. Letter
duplication/change preserves material, font, edition, hidden Stone letter, and
per-tile Wood growth unless the individual effect says otherwise. Created tiles
receive new ids and enter the run's pouch permanently.

| # | Gambler card | Effect |
|---:|---|---|
| 1 | Barn Swallow / 제비 | Change one selected letter tile's font to **Black**. Preserve material and edition. |
| 2 | Boar / 멧돼지 | Seed-select one owned Emoji Tile, keep the original, create one complete copy, then destroy every other owned Emoji Tile. Gray/Violet/Rainbow copy; a White original produces a Base copy. This is the explicit exception to unique Emoji Tile ownership. |
| 3 | Bridge / 다리 | Permanently change every tile in the active tile field to one seeded random shared letter A–Z, then permanently reduce hand size by 1. Preserve all modifier axes; for Stone, change the hidden letter. Hand-size floor: **5** (`BALANCE.gambler.bridgeHandSizeFloor`, first-pass tuning value — the card is unusable at the floor). |
| 4 | Bush Warbler / 휘파람새 | Change one selected letter tile's font to **Light Italic**. Preserve material and edition. |
| 5 | Butterflies / 나비 | Permanently destroy 5 seeded-random tiles in the active tile field and gain $20. Unusable with fewer than 5 candidates. |
| 6 | Crane and Sun / 학과 해 | Create one seeded-random unowned Rare Emoji Tile, then set held gold to $0. Unusable without an eligible tile or free slot. |
| 7 | Cuckoo / 뻐꾸기 | Change one selected letter tile's font to **Inline**. Preserve material and edition. |
| 8 | Curtain / 휘장 | Create two complete copies of one selected letter tile in the active field and add them permanently to the pouch. Copy letter/hidden letter, material, font, edition, and Wood growth; assign new ids. |
| 9 | Deer / 사슴 | Raise all 12 sentence-pattern levels by 1. Appears only as a 0.3% per-choice Ink-Pack jackpot. |
| 10 | Full Moon / 보름달 | Permanently destroy 1 seeded-random tile in the active field, then create 3 random enhanced vowel tiles using A/E/I/O/U. Each created tile receives one seeded-random non-base enhancement from material, font, or letter-tile edition; Stone is excluded because it would erase the promised vowel. |
| 11 | Geese / 기러기 | Change one selected letter tile's font to **Void** (`bold` internally). Preserve material and edition. |
| 12 | Phoenix / 봉황 | Create one seeded-random unowned Legendary Emoji Tile. Unusable without an eligible tile or free slot. This is the normal-play Legendary acquisition route. |
| 13 | Rainman / 우중인 | Give one seeded-random owned **non-White** Emoji Tile the **White** edition, then permanently reduce hand size by 1. An already-White tile is never selected; the card is unusable without an eligible tile or at the hand-size floor of 1, so it is never consumed without applying its edition. |
| 14 | Sake Cup / 사케 잔 | Give one seeded-random owned **non-Rainbow** Emoji Tile the **Rainbow** edition, then destroy every other owned Emoji Tile. Unusable without an eligible tile, so it is never consumed without changing the kept tile's edition. |

**Implementation notes (updated 2026-08-03).** The registry is data + a single
`useGambler(id, run, blind, field, selectedIds, rng)` entry point. `field` is the
**active tile field**: the live hand during a blind, the pack's seeded pouch
candidates inside an opened pack — one code path for both, since tile edits are
applied by id through the same helpers Fables use. Butterflies and Full Moon
report their removals through the shared `tilesDestroyed` event, so Type Foundry
(§11.5 L3) grows off them. The shop has no active tile field, so every
field-dependent Gambler must be bought and held for a blind, exactly like a
tile-targeting Fable. A field-free Gambler shows **Use now** only when its other
preconditions pass. Gambler use counts toward no voucher unlock: Comic Book
counts Fables and Yearbook counts Constellations (§9.4).

The historical, non-canonical 97-tile candidate review lives in
`docs/superpowers/specs/2026-07-29-emoji-tile-roster-design.md`. It remains
postponed and no candidate there is canonical unless it is moved into §11.

---

## 11. Emoji Tiles

> **Terminology (2026-07-23).** The player-facing term is **Emoji Tile / 이모지 타일**.
> The engine identifier stays `joker` (`JokerDef`, `src/engine/jokers/`,
> `BALANCE.jokerSlots`) — display terms never rename engine identifiers.

**Roster status (updated 2026-08-12).** The public roster contains **150 authored
definitions**: Common 34 + Uncommon 57 + Rare 54 + Legendary 5. A separately
registered developer-only Primordial definition is excluded from that count,
production offers, and Collection. The separate 97-tile redesign in
`docs/superpowers/specs/2026-07-29-emoji-tile-roster-design.md` remains
postponed and is not an implementation source.

**Implementation status (roster complete, 2026-08-12).** All 150 public definitions
ship as data + event hooks, one file each under `src/engine/jokers/`.
**Art is complete:** all 150 public definitions plus the developer-only definition have 84×112 pixel
masters registered through the shared resolver. The shared 124×165 runtime
frame is wired to the owned shelf, shop,
opened Charm Pack, held-consumable shelf, and Collection.
The six former proof tiles—Jack of All Trades, Vowel Praise, Consonant
Bricklayer, Hipster, Grammarian, and Rush Specialist—are fully retired and
removed from the registry. Vowel Symphony, Letter Ladder Badge, Palindromist,
Straight Shooter, Twin Peaks, and Threefold Seal are likewise retired because
the newer Word-Hand tiles occupy their activation conditions. Profile unlock
filtering ships for ordinary offers and direct creation; Phoenix remains the
sole Legendary acquisition route.

Three engine notes fall out of the roster pass. **Stenographer (C06 / 속기사)**
adds +4 Mult once only when the current submitted word is strictly shorter
than the immediately previous submitted word; equal lengths and the first word
never trigger it. **Hollow Promise (U21)** pays $2 for each Inline discard-gain
trigger blocked specifically because the consumable shelf has no free slot.
**Tyrant (L2)** applies its Vulgar rewrite as an additive delta
from the word's own suit multiplier to `suitMult.vulgar × 2`, which keeps it
independent of shelf order; the submitted word's final register and visible tag
become Vulgar, so bosses, Unison, and sentence-history effects see the rewrite.

**Unlock model (implemented).** Persistent achievement gates filter locked
Common/Uncommon/Rare ids from ordinary offers and direct creation. Ungated
entries participate immediately; Legendary has no normal offer weight and is
acquired through Phoenix.

**Emoji tiles** are acquired by shop purchase/draw (§9). Unlike Balatro's jokers, which mostly play in the single layer of "score calculation," emoji tiles play across **3 layers**: **(1) Letter/Tile  (2) Suit (register)  (3) Sentence/Phase**.

**Notation.** Chips = base score, Mult = multiplier, Final = Chips × Mult. **Layer** = 1/2/3. **★** = scaling. All values are balancing placeholders.

**Ease pass (2026-08-02).** Common, Uncommon, and Rare reward magnitudes were
raised by roughly 25% (with clean integer rounding); multiplicative effects
raise their amount above ×1 by the same proportion. Activation conditions and
costs stay stable except where a numeric utility is itself the reward. The five
Legendary definitions are intentionally unchanged.

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

**Pouch Tag live disclosure (changed 2026-07-31).** Its tooltip appends the
current payout as `(Currently +N Chips)` / `(현재 +N 칩)`. The value uses the
same scoring helper as its hook: `blind.bag` during active/prepared blinds and
the complete permanent `run.bag` in the Shop.

**Emoji Tile revision (changed 2026-08-26; supersedes older roster prose and
table cells below wherever they conflict).** Player-facing “word” means a
non-debuffed dictionary word; only explicitly named Gibberish effects are an
exception, and Gibberish/debuff breaks previous/consecutive comparisons.
This lexical qualifier applies only when an effect's condition says “word.”
Physical tile/material/font effects and run-, pouch-, inventory-, phase-, or
owned-object conditions remain layer-1 effects and still resolve on Gibberish.
Stored growth earned by valid-word causes also applies its current value once to
Gibberish; the invalid submission never creates a new word-qualified growth cause.
Values
and mechanics are authoritative in `BALANCE.jokers` and the hook registry. The
revision includes Stenographer ×2; Fill in the Blank +80 Chips; Bookmark +50;
Beehive base +66 and +6 growth; Recycling $2; Vowel Magnet ×1.5; Equilibrist
+50 Chips then ×1.5; Everyday Hero ×1.5; One Voice +75; Scrap Dealer +0.2 Mult
per permanent-pouch Brass tile; Heavy Press +40 per Void; Hollow Promise $2 per
discarded Inline; Discarded Draft +7; Clean Copy +10; Full Desk +25; Bestseller
6+; Sentence Opener noun-tag ×1.5; Modifier Stack +5 per raw POS tag; Correction
Mark +13 once when consecutive words share any POS; Serial persistent +20 growth;
Gematria +15 as one event per matching sentence word; Carte Blanche $2 discount;
Alphabet Press ×1.5 per letter participating in an ascending consecutive run;
Word Hunter base ×1/+0.1; Night Owl threshold 17; Golem +8 per Stone; Iota ×2 on
I; Biochemistry +0.5 on a pre-play most-used Word Hand; and Misbound +0.5 on
survival. Growth persists for the run unless an explicit scope says otherwise.

**Type Orchestra (changed 2026-08-26).** If a submitted word contains at least
two distinct fonts, every distinct font including Medium applies ×1.25 Mult once,
on that font's first tile in word order. A one-font word does not trigger it.

**Lifecycle/rule changes (2026-08-26).** Glass Insurance prevents every Glass
break. Term Insurance prevents none, starts at ×1, and gains +0.2 per actually
destroyed physical tile for later words. Blackletter Engine converts surviving
Medium tiles in the blind's first word to Black only after that word settles, so
the new Black effect begins on later plays. Golden Type permanently adds +50
intrinsic Chips to the physical tile for every actual tile-gold event; this
survives Stone transforms, complete copies, and saves, and affects only later
tile triggers. Stone Tongue ignores all Stone tiles for spelling. Loaded Lead
Dice creates exactly three non-recursive retriggers only when both original Lead
Plate rolls fail; Cubism grows once when either original roll succeeds. Alphabet
Poet treats physical Z as A for spelling/lexicon/POS/register/Word-Hand rules but
retains Z's physical identity and Chips. Tyrant rewrites a word to Vulgar and
applies its own ×2 word Mult once. Echo Chamber dynamically copies the active
hook and data-driven passive capability of the immediately-right Emoji Tile at
Echo's shelf position; Book of Margins slots, Carte Blanche discount, and Copy
Editor duplicate permission therefore copy without pipeline special cases. Disabled,
missing, Tower, or recursion-guarded targets do nothing, copied state is
independent, and only Echo's own edition applies.

**Legacy scaler normalization (changed 2026-08-26).** Loading a pre-revision
run preserves earned proc counts while mapping old absolute values to the new
rates: Misbound `+0.8 → +0.5`, Biochemistry `+0.45 → +0.5`, and Serial
`+13 Chips → +20 Chips`. A per-effect state marker makes this migration
idempotent, applies to Echo-namespaced copied state, and removes retired Term
Insurance prevention counters without bumping the run-save version.

### 11.1 Roles by Rarity

| Rarity | Role | Main layer |
|---|---|---|
| Common | Unconditional pure addition — early foundation | 1 |
| Uncommon | Conditional addition + start of scaling | 1–2 |
| Rare | Multiplication (×Mult) appears + full scaling — acceleration engine | 2–3 |
| Legendary | Rule-breaking — redefines the run (5 total) | 3 |
| Primordial | Developer-only debug rule; never part of the public roster | 3 |

The compact tables below retain representative legacy entries and list the
newest additions explicitly; the headless registry remains authoritative for
the complete 150-entry public roster.

### 11.2 Common — active 34

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| C6 | Ceramic Artisan | +7 Chips per unenhanced base tile | 1 | — |
| C7 | Long-Word Fan | +80 Chips if word is 5+ letters | 1 | — |
| C8 | Short & Sharp | +10 Mult if word is 3 letters or fewer | 1 | — |
| C9 | Alphabetical Order | +15 Mult if the word contains consecutive letters | 1 | — |
| C10 | Miser | +2 Mult per 5 gold held | 1 | — |
| C33 | Three-Leaf Clover · 세잎클로버 | At blind end, add $3 to this tile's sell value | 3 | ★ gold |
| C49 | Megalith · 거석상 | On Blind Select confirmation, add one Stone tile to the pouch and current blind bag | 3 | tile generation |
| C30 | The Scarlet Letter · 주홍 글자 | Starts at ×1; gain +0.1 ×Mult for every physical A tile discarded this run, including discards before acquisition | 1 | ×Mult |
| C50 | Peddler · 행상인 | Add the total current sell value of all owned Emoji Tiles to word Mult | 1 | dynamic Mult |
| C51 | Storyteller · 이야기꾼 | Gain +1 Mult per Fable card used this run, including uses before acquisition | 1 | dynamic Mult |
| C52 | Recycling · 리사이클링 | At each blind selection choose one seeded A–Z letter; gain $2 for every matching tile discarded | 3 | gold |
| C53 | Beehive Tile · 벌집 타일 | Starts at +66 Chips; gain and apply +6 Chips whenever a six-letter word is played | 1 | ★ Chips |
| C54 | Cubism · 입체주의 | Starts at ×1; when an original Lead Plate tile effect succeeds, add +0.25 to its factor | 1 | ★ ×Mult |

### 11.3 Uncommon — active 57

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| U1 | Literary Judge | +69 Chips if word is Formal suit | 1–2 | — |
| U3 | Rare Earth | ×3 Chips on that letter when using Q·Z·X·J | 1 | — |
| U4 | Glasswork | +7 Mult per played Glass tile | 1 | — |
| U5 | Voracious Reader | +5 Chips per total words made so far, accumulating | 1 | ★ |
| U6 | Classicist | Each Formal word made permanently raises this tile's Mult by +8 | 2 | ★ |
| U7 | Street Cred | Each Slang word made permanently raises Chips by +30 | 2 | ★ |
| U8 | Combo Artist | +8 Mult if different suit from the previous word | 2 | — |
| U9 | Vowel Magnet | ×1.5 Mult if word has more vowels than consonants | 1 | — |
| U10 | Equilibrist | +50 Chips and ×1.5 Mult if vowel and consonant counts are equal | 1 | — |
| U45 | Noise Cancelling · 노이즈캔슬링 | Starts at ×1; gain +0.25 Mult per blind skipped this run | 1 | dynamic |
| U5A | Astronomer · 천문학자 (`stargazer`) | Starts at ×1; permanently gain +0.1 ×Mult whenever a Constellation card is used | 3 | ★ |
| U50 | Host · 숙주 | On Blind Select confirmation, destroy the Emoji Tile immediately to the left and permanently gain +Mult equal to twice its sell value | 1 | ★ Mult |
| U53 | Gematria · 게마트리아 | +15 Mult separately for each matching word in the current sentence, including the current submission | 1 | — |
| U54 | Cadmus's Teeth · 카드모스의 이빨 | Permanently gain +10 Chips for each alphabet letter first discarded this run; buying it late includes prior letters | 1 | ★ Chips |
| U22 | Scrap Dealer · 고물상 | Add +0.2 Mult separately for each Brass tile in the permanent pouch | 1 | dynamic +Mult |
| U55 | Strawberry Jam · 딸기잼 | If the current highest Word Hand was already played earlier this blind, ×3 Mult | 1 | ×Mult |
| U56 | Bald · 대머리 | At each blind selection choose one seeded A–Z letter; every matching scored tile gives ×1.5 Mult | 1 | ×Mult |
| U57 | Shuriken · 수리검 | Starts at ×2 Mult; permanently lose ×0.01 from its factor per tile discarded, floored at ×0 | 1 | decreasing ×Mult |
| U58 | Earthquake · 대지진 | Retrigger every played tile once for the next 10 successful hands, then expire | 1 | countdown |
| U59 | Dog Food · 개 사료 | Starts at +0 Mult; gain +2 Mult whenever paid shop item stock is rerolled | 1 | ★ Mult |
| U60 | Delisting · 상장폐지 | If the blind's first discard contains exactly one tile, permanently destroy it and gain $3 | 3 | tile destruction · gold |
| U61 | Great Depression · 대공황 | At blind clear, gain an additional uncapped $1 interest per $5 held; full interest-disable effects still set it to zero | 3 | gold |
| U62 | Leak · 누수 | Starts with one stack per tile the permanent pouch is below 68; whenever it reaches a new smallest size, add one stack per newly missing tile; pouch additions never remove stacks; each stack gives +4 Mult and the current Mult is displayed | 1 | ★ Mult |

### 11.4 Rare — active 54

| ID | Name | Effect | Layer | Scaling / unlock |
|---|---|---|---|---|
| R1 | Carte Blanche | All Emoji Tile buy and sell prices −$2, including this tile, with the normal price floor | 3 | Buy 40 Emoji Tiles from shops |
| R2 | Hypocrite | ×5 Mult if the sentence contains both a Formal and a Vulgar word | 2–3 | Start |
| R3 | Rhyme Chain | If the previous phase's word ends in the same two letters, its blind-only streak multiplier compounds ×3; a miss resets the streak | 3 | Start |
| R4 | Out of Print | Gain +50 Chips and +8 Mult for each alphabet letter with no copies left in the permanent pouch; its current totals are displayed | 1 | dynamic · Remove every copy of one letter |
| R6 | Fable Hoard | ×1.5 Mult per currently held consumable; no effect text is shown at zero consumables | 3 | End 5 rounds with consumable slots full |
| R7 | Anonymous | ×3 Mult while every effective Emoji Tile slot is full | 3 | Reach Ante 4 with 5 Emoji Tiles |
| R8 | Censor's Bane | ×3 Mult during Deadline/boss blinds | 3 | Clear 25 Deadlines cumulatively |
| R9 | Dadaist | Give gibberish final Slang membership and its visible tag, then apply ×2.5 Mult; `suit`/POS remain null and the sentence hole remains | 2 | Clear a blind using only gibberish |
| R10 | Interest Glutton | For every $1 interest received at round end, gain +5 Mult during the next round | 3 | Hold $100 in one run |
| R11 | Rotary Press | On the last phase, retrigger once the committed individual-word scoring log of every word submitted this blind; never retrigger the sentence bonus | 3 | Use 8 phases in one blind |
| R30 | Hand Scholar · 족보 학자 | Starts at ×1; +0.5 to its factor per distinct Word Hand played this run, capped at ×4 | 1 | Complete 8 distinct Word Hands in one run |
| R44 | Term Insurance · 단기 보험 | Starts at ×1; each actually destroyed letter tile gains +0.2 ×Mult, with no destruction prevention | 1 | ×Mult |
| R46 | Counterfeit · 모조품 | If the blind's first word has a physical length of 1, create a complete copy of that tile in the hand and permanent pouch | 1 | tile generation |
| R47 | 25th Blessing · 25번째 축복 | Each held Y gives ×1.5 Mult; a played Y is not held | 1 | dynamic exponential |
| R48 | Blood Type A · 혈액형 A | Each scored A or O tile permanently adds +8 Chips to this Emoji Tile, including retriggers; starts at +0 and displays its current Chips | 1 | ★ Chips |
| R41 | Copy Editor · 카피 에디터 | While owned, Emoji Tiles, Fables, Constellations, and Gambler cards may repeat in shops and packs | 3 | rule change |
| R51 | Dummy Data · 더미 데이터 | Increase the played word's effective length by 2 for length Mult, Longword, and word-length Emoji Tile checks | 1 | rule change |
| R52 | Blacksmith · 대장간 | Starts at +0 Chips; whenever an existing letter tile receives a material, font, or edition enhancement, gain +10 Chips | 1 | ★ Chips · Start |
| R55 | Golem · 골렘 | +8 Mult per Stone tile in the word | 1 | — |
| R56 | Temurah · 테무라 | If this word is a different anagram of the immediately previous word, ×5 Mult | 1 | — |
| R57 | Alphabet Poet · 알파벳 시인 | Treat physical Z as A for spelling, lexicon, POS, register, Word Hand, and spelling-based Emoji Tile rules; preserve Z's physical identity, display, base Chips, material, font, and Z-specific conditions | 3 | rule change |
| R58 | Iota Stroke · 이오타 획 | If the word contains I, ×2 Mult | 1 | — |
| R59 | Zombie · 좀비 | After a play, return every played physical letter tile to the current blind's undrawn pouch | 1 | rule change |
| R60 | Biochemistry · 생화학 | Starts at ×1; playing any pre-play most-used Word Hand (ties included) gains +0.5 ×Mult | 1 | ×Mult |
| R61 | Ambidextrous · 양손잡이 | If the played hand contains Twin, ×2 Mult | 1 | ×Mult |
| R62 | Third Party · 제3자 | If the played hand contains Triplet, ×3 Mult | 1 | ×Mult |
| R63 | Mirror Image · 거울상 | If the played hand contains Palindrome, ×3 Mult | 1 | ×Mult |
| R64 | Gathering · 모임 | If the played hand contains Vowel Flush, ×2 Mult | 1 | ×Mult |
| R65 | Straight Talk · 직설 | If the played hand contains Straight, ×3 Mult | 1 | ×Mult |

### 11.5 Legendary — confirmed 5

Legendary tiles have no profile unlock gate. They never appear in shops or
ordinary packs; Phoenix is their only acquisition route and always draws from
all five unowned definitions.

Only the 69 gated Common/Uncommon/Rare achievements can create Emoji Tile
entries in the integrated run-end unlock recap. The 76 ordinary starter tiles
and five always-eligible Legendary definitions are baseline availability, not
unlock notices.

| ID | Name | Effect | Layer | Scaling |
|---|---|---|---|---|
| L1 | Book of Margins | +3 Emoji Tile slots; after all slot modifiers, this tile applies ×2 per empty effective slot | 3 | dynamic exponential |
| L2 | Tyrant | Treat every word as Vulgar; each such word gets ×2 Mult once at Tyrant's shelf position | 2 | — |
| L3 | Type Foundry | Starts at ×1; whenever a letter tile is permanently destroyed, compound this tile's factor ×1.5 for the rest of the run | 1 | ★ exponential |
| L4 | Tower of Babel | Each valid submitted word gains all four final register tags; register conditions, boss legality, Unison, and sentence-history effects use that membership | 2 | — |
| L5 | Misbound | Starts at ×1. At blind end, 1/1,000 chance to self-destruct; if it survives, gain +0.5 ×Mult | 3 | ★ |

> **Tower redesign is pending.** The requested “copy every other owned Emoji
> Tile” replacement is specified in
> `docs/superpowers/specs/2026-08-26-tower-of-babel-redesign.md`. It is not live
> in this slice; the current four-register behavior remains authoritative until
> the dedicated uid/capability/QA/simulation slice lands.

### 11.5a Developer-only Primordial

**Developer's Grace / 개발자의 은총 (P1)** sets every subsequent blind target
to 1 while owned. In `import.meta.env.DEV` builds it is a free, pinned Emoji
Tile in the first actually entered shop, including after rerolls. It is absent
from production stock, public rarity counts, random grants, unlock progress,
and Collection.

### 11.6 Scaling Axis Distribution

The confirmed Rare/Legendary growth axes deliberately spend different resources.
Common/Uncommon additions may expand the table after their review.

Effects whose copy says “this run” or “so far” read the run-wide history, not
only events observed after acquisition. Buying Noise Cancelling, Voracious
Reader, Hand Scholar, Word Hunter, or Royalty Contract later therefore includes
all earlier qualifying skips, words, and Word Hands immediately. Hand Scholar's
current multiplicative factor is `1 + distinct Word Hands × 0.5`, capped
explicitly at ×4 even though the registry now contains nine entries. Word Hunter
(R31) starts at ×1 and gains +0.1 to its factor per unique word first played
this run; its factor is reconstructed from run history under the revised rate.

| Scaling axis | Emoji Tiles |
|---|---|
| Total words made | Voracious Reader (U5) |
| Unique valid words | Word Hunter (R31), Royalty Contract (U35) |
| Unique Word Hand types | Hand Scholar (R30) |
| Skipped blinds | Noise Cancelling (U45) |
| Formal suit accumulation | Classicist (U6) |
| Slang suit accumulation | Street Cred (U7) |
| Removing a complete alphabet family | Out of Print (R4) |
| Constellation use | Astronomer (`stargazer`, U5A) |
| Interest received | Interest Glutton (R10, next-round additive) |
| Empty Emoji Tile slots | Book of Margins (L1) |
| Permanent letter-tile destruction | Type Foundry (L3) |
| Letter-tile enhancements | Blacksmith (R52) |
| Survived rounds | Misbound (L5) |

### 11.7 Core Oppositions & Balance Pressure Points

- **Empty ↔ full shelf.** Book of Margins (L1) rewards leaving effective slots
  empty; Anonymous (R7) works only when every slot is full. They cannot both
  operate at peak efficiency.
- **Destruction cost ↔ destruction engine.** Type Foundry (L3) turns Glass,
  Shredder, Butterflies, Full Moon, and future permanent destruction into
  exponential growth. The shrinking 68-tile pouch is its natural cost; verify
  that it is enough.
- **One suit ↔ every suit.** Unison rewards shared final-register membership.
  Tower of Babel (L4) supplies all four tags, so it can bridge an Unison or the
  Forbidden Paper lock, at the cost of also satisfying every hostile register check.
- **Rhyme streak.** Rhyme Chain (R3) is a blind-only combo, not a growth tile. It depends on real lexicon clusters and
  draw odds. Measure actual same-suffix streaks rather than balancing from a
  theoretical maximum.
- **Misbound lifetime.** Its +0.5 growth and 1/1,000 self-destruction must be tuned
  together from expected rounds survived.

### 11.8 Editions (implemented)

Changed 2026-07-26 for the Flyer voucher pair: letter tiles and Emoji Tiles each carry a dedicated edition field. `TileEdition` and `JokerEdition` are separate type unions; neither replaces a letter tile's material/font, and Emoji Tiles still never receive letter material/font modifiers.
Changed 2026-07-30: the shared edition vocabulary and serialized ids are Gray, Violet, and Rainbow; `JokerEdition` additionally owns the Emoji-Tile-only White edition.
Changed 2026-08-04: random edition rolls adopt weighted Balatro-reference bands. Emoji Tiles roll Gray/Violet/Rainbow/White at **2%/1.4%/0.3%/0.3%**; Flyer changes them to **4%/2.8%/0.9%/0.3%**, and Wanted Poster to **8%/5.6%/2.1%/0.3%**. White stays fixed at 0.3%. Tile-Pack letters roll Gray/Violet/Rainbow at **4%/2.8%/1.2%**, raised to **8%/5.6%/2.4%** and **16%/11.2%/4.8%**. Encyclopedia shop tiles use the separate fixed **10%/7%/3%** table and never roll White.

| Edition | Effect | Letter tile display | Emoji Tile display |
|---|---|---|---|
| Base | no edition | original material | original background |
| Gray | +50 Chips | ash-gray colour layer | ash-gray background |
| Violet | +10 Mult | ash-violet colour layer | ash-violet background |
| Rainbow | ×1.5 Mult | animated rainbow colour layer | animated rainbow background |
| White | occupies no joker slot → **+1 owned-joker slot** | unavailable | white background |

- **Slot cap.** The owned-emoji-tile cap is `RunState.jokerSlots` (base 5).
  Five-Color Lucky Pouch and CD each subtract 1; Leather Pouch and Kung Fu
  Manual each add 1 (§12); each White Emoji Tile raises effective capacity by 1.
  Signed baseline modifiers compose before the zero floor.
- **Acquisition:** editions may pre-attach to letter tiles and Emoji Tiles in packs, and to shop tiles unlocked by Encyclopedia. Flyer/Wanted Poster select the higher Gray/Violet/Rainbow tables above; Encyclopedia shop tiles ignore them.
- **Letter-tile presentation (changed 2026-07-31):** colour is the canonical edition indicator, matching the Emoji Tile palette. Its translucent, luminance-preserving layer sits beneath the material texture so material identity remains readable. White is not a `TileEdition` and never appears on a letter tile.
- **Emoji Tile presentation (changed 2026-07-30):** background colour is the canonical edition indicator. The rejected alternative (`@`, `#`, `*`, `~`) is not rendered; it would violate the image-only Emoji Tile rule. Tooltips always name the edition and spell out its effect.
- **Collection reference (changed 2026-07-31):** Collection → Editions shows Base, Gray, White, Rainbow, and Violet on five runtime-size Emoji Tile samples with the live overlays and canonical effect tooltips. White remains Emoji-Tile-only.

---

## 12. Starting Pouches & Records

The former open-ended starting-deck ideas and stake/Ink difficulty proposal are
retired (changed 2026-07-30). Every new run now selects exactly **one Starting
Pouch** and exactly **one Record**. A Starting Pouch defines the run's starting
build; a Record defines cumulative difficulty. “Round” in the effects below
means one blind (Draft, Revision, or Deadline); “hand per round” means a
**phase**, while “hand size” means the number of letter tiles held. The Ink Pack
remains a consumable pack and has no relationship to Records.

Every numeric modifier and shop weight in this section lives in `balance.ts`;
Pouch and Record definitions reference those values rather than embedding magic
numbers in reducers or components.

### 12.1 Shared rules, composition, and unlocks

- **One Pouch, one Record.** Starting Pouches never stack with one another.
  Records do stack: selecting a level applies that row and every row above it.
- **Modifier order.** Build the ordinary 68-tile run first, apply the selected
  Starting Pouch's one-time contents and run modifiers, then apply every active
  Record modifier. Per-blind voucher, Emoji Tile, and boss hooks apply through
  their normal data/hooks after those run baselines are established.
- **Signed modifiers add before floors.** Hand size and phases have a minimum of
  **1**; discards, Emoji Tile slots, and consumable slots have a minimum of
  **0**. No intermediate clamp may erase a later positive modifier.
- **Target modifiers multiply, then round once.** Let `T` be the normal target
  after Chapter, blind-kind, and boss target modifiers. The Green LP multiplier
  and Briefcase multiplier compose as
  `round(T × 1.15^(Chapter−1) × 2)` when both are active. Omit the factor for an
  inactive effect; do not round between factors.
- **No-interest priority.** Purple Pouch and DVD each force round-end interest to
  **$0**. Owning both is still one zero, not an additional penalty. Receipt,
  Household Ledger, or any future interest-cap modifier cannot restore interest;
  effects that read “interest received” observe zero.
- **Starting vouchers.** A voucher granted by a Pouch is owned and applied from
  the run's first frame **before the initial voucher offer is rolled**, cannot
  be offered again, does not consume the current Chapter's voucher purchase, and
  does not set `voucherLocked`. It is a starting grant, not a redemption, so it
  does not increment redemption-based profile progress. A profile-unlocked
  upgrade may still appear because its base is already owned.
- **Unlock persistence.** Pouch and Record unlocks are profile-scoped. The
  Record ladder is tracked independently for each Starting Pouch: winning a
  Record with one Pouch unlocks the next Record only for that same Pouch and
  never advances another Pouch's ladder. A word
  threshold counts distinct valid words in the Collection; gibberish and repeat
  plays do not increase it. A “win” means clearing the Chapter 8 Deadline.
  Persistence goes through `src/ui/storage.ts`, never direct `localStorage`; if
  implementation adds a save key, mirror it in `desktop/save-store.js`.
- **Custom-seed rule.** A run created from a player-entered custom seed can be
  played and reproduced, but its win cannot satisfy a Pouch win condition or
  advance the Record ladder, Emoji achievements, Voucher achievements, or
  Challenge completion. Palette words and distinct-word Collection thresholds
  still count, so word-threshold Pouches may unlock. Ordinary unseeded wins may
  satisfy every matching condition at once.
- **Challenge rule.** Challenges and custom seeds are mutually exclusive.
  Starting one Challenge uses a fresh ordinary `randomSeed()`, replaces the one
  existing `wj.run` slot like New Run, and stores its known `challengeId` beside
  the seed so Continue reproduces it. An ordinary run stores `null`/no active id;
  an unknown non-null saved id is rejected rather than silently loaded as a
  normal run. Challenge presets bypass Pouch/Record profile locks only inside
  the Challenge start path and never unlock those choices in ordinary New Run.
  Palette, Emoji, and Voucher progress remains eligible. Win-based Pouch rewards
  and the Record ladder do not progress, while word-threshold Pouches still
  follow genuine Collection discoveries. Completing Challenge N may add only Challenge N+1 to the integrated
  run-end recap; completing Challenge 6 adds no Challenge notice.
- **Seeded starting randomness.** Lucky Pouch's starting card and Coin Purse's
  letters consume the run's single seeded RNG stream. The same Pouch, Record,
  and seed must reproduce the same start. No Starting Pouch effect may call
  `Math.random()`.

Useful composition checks:

- Yellow Pouch + Yellow LP: `4 + 1 − 1 = 4` discards.
- Blue Pouch + Clear LP: `5 + 1 − 1 = 5` phases.
- Five-Color Lucky Pouch + Blue LP: `10 + 1 − 1 = 10` hand size.
- Five-Color Lucky Pouch + CD: `5 − 1 − 1 = 3` Emoji Tile slots.
- Leather Pouch + CD: `5 + 1 − 1 = 5` Emoji Tile slots.

**Challenges v1 (implemented 2026-08-22).** Challenges are six headless fixed
Pouch + cumulative Record presets. They introduce no new effect, balance number,
currency, reward, or art; construction uses the same Pouch-then-Record order and
`BALANCE` values above.

| # | Challenge (ko / en) | Pouch | Record |
|---:|---|---|---|
| 1 | **빨간 펜 / Red Pen** | Yellow Pouch | Red LP |
| 2 | **치솟는 할당량 / Rising Quota** | Green Pouch | Green LP |
| 3 | **좁은 책상 / Narrow Desk** | Five-Color Lucky Pouch | Yellow LP |
| 4 | **세 번의 교정 / Three Passes** | Leather Pouch | Clear LP |
| 5 | **균형의 부담 / Balanced Burden** | Briefcase | CD |
| 6 | **무작위 최종고 / Random Final** | Coin Purse | DVD |

Challenge 1 is available by default; completing N unlocks N+1, and completed
entries remain replayable. Only a Chapter-8 Deadline victory records completion.
Challenges 1–5 grant only the next unlock; Challenge 6 displays `6/6 Mastered`;
there is no separate Challenge reward; a newly opened Challenge 2–6 instead
appears in the integrated run-end unlock recap. Challenge runs still count genuine word plays and
Collection discoveries, Palette/audio/mascot and secret Word-Hand discovery,
Emoji/Voucher achievements, and ordinary lifetime run/win/streak/pattern/owned-
Emoji statistics. They do **not** award Starting-Pouch wins, advance any
Pouch-specific Record ladder, stamp Emoji Tiles, or enter balance telemetry.
Therefore standard win rewards require `!customSeed && challengeId == null`.
Completion ids live, known-only and deduplicated, in the active profile's existing
`wj.lifetime`; no save key or run-save version is added.

### 12.2 Starting Pouches — 14

| # | Starting Pouch (ko / en) | Effect | Profile unlock |
|---:|---|---|---|
| 1 | **노란 주머니 / Yellow Pouch** | +1 discard per round | Default |
| 2 | **파란 주머니 / Blue Pouch** | +1 phase per round | Discover 25 distinct valid words |
| 3 | **초록 주머니 / Green Pouch** | Start with an additional **$10** | Discover 50 distinct valid words |
| 4 | **보라 주머니 / Purple Pouch** | On a clear, gain **$2 per remaining phase** and **$1 per remaining discard**; **interest is always $0** | Discover 100 distinct valid words |
| 5 | **복주머니 / Lucky Pouch** | Gambler Cards may roll in ordinary shop item slots; start with one seeded-random implemented Gambler Card | Win with Yellow Pouch |
| 6 | **오색 복주머니 / Five-Color Lucky Pouch** | Hand size +1; Emoji Tile slots −1 | Win with Blue Pouch |
| 7 | **황금 복주머니 / Golden Lucky Pouch** | Every starting A/E/I/O/U tile begins with the Brass material; Y remains a consonant | Win with Green Pouch |
| 8 | **가죽 파우치 / Leather Pouch** | Emoji Tile slots +1; phases per round −1 | Win with Purple Pouch |
| 9 | **밀리터리 파우치 / Military Pouch** | Start owning B&W Photo; consumable slots −1 | Win on White LP |
| 10 | **명품 가방 / Luxury Bag** | Start owning Newspaper and holding two **The Goose That Laid the Golden Eggs** Fable Cards | Win on Red LP |
| 11 | **필통 / Pencil Case** | Start owning Zero Score and holding two **The Boy Who Cried Wolf** Fable Cards | Win on Green LP |
| 12 | **서류 가방 / Briefcase** | Balance each word's and sentence bonus's final Chips/Mult axes; all blind targets ×2 | Win on Blue LP |
| 13 | **장바구니 / Shopping Basket** | Start owning Story Book, Bible, and Catalog | Win on Yellow LP |
| 14 | **동전 지갑 / Coin Purse** | Keep 68 tiles, but independently reassign every starting tile to a seeded-uniform A–Z letter; any letter may have zero copies | Win on Clear LP |

**Purple Pouch settlement.** Its phase line replaces the ordinary $1-per-phase
line with $2 per phase, adds a separate $1-per-unused-discard line, and suppresses
the interest line to $0. These rewards pay only after a clear; a lost blind never
opens Fee Settlement. Red LP suppresses only a Draft's clear-reward line, so
Purple's remaining-resource lines still pay on a cleared Draft.

**Lucky Pouch shop route.** This is an explicit acquisition-route exception:
the 12 ordinary Gambler Cards become eligible in ordinary shop item slots under
a data-defined shop weight, in addition to their Ink Pack and Comic Book routes.
Deer and Phoenix remain Ink-Pack-only. The starting card is chosen uniformly
from the same ordinary 12 and occupies one held-consumable slot. Within either
Lucky-Pouch route, each ordinary card is therefore 8.3333% likely.

**Briefcase balance transform.** Resolve one individual word through every normal
base, letter, material, font, edition, Word Hand, suit, Emoji Tile, voucher,
and boss hook. Then, immediately before that word's final product, replace its
axes with:

`mean = (finalChips + finalMult) / 2`

`wordScore = mean × mean`

Do the same **independently** for the sentence contribution axes after pattern,
modifier, Unison, Emoji Tile, voucher, and boss hooks, immediately before adding
sentence Chips to the committed score and applying sentence Mult. Do not include
the already-committed word total in the mean. Keep the arithmetic mean at full precision—no floor, ceiling, or nearest
integer step in the transform. The UI may format a value without mutating the
headless value. Thus `100 × 50` becomes `75 × 75 = 5,625`. Gibberish participates
as its final `Chips × 1.0` axes; this Pouch is the explicit exception to the
ordinary fixed `×1.0` gibberish payout in §6.4. A debuffed play never reaches
Briefcase balancing and remains zero.

This creates Briefcase's distinct curve: by the arithmetic-mean/geometric-mean
relationship, uneven positive axes gain more than already-balanced axes. Early
high-Chips effects can carry weak Mult; late multiplicative-Mult builds
automatically pull Chips upward and can reach an unusually high ceiling. The
transition between those plans is its weak period, while the ×2 target is the
always-on price for the upside.

**Coin Purse generation.** Start from the ordinary 68 stable tile ids. In stable
id order, draw one uniform integer in `[0, 26)` per tile and replace its letter
with the matching A–Z value, recalculating vowel/consonant classification. The
result is a 68-draw multinomial distribution: total size always remains 68, but
every per-letter count may be zero. Starting material, font, edition, and other
per-tile state remain at their ordinary base values.

**Starting-Pouch art contract.** All 14 are simple, standalone pixel-art objects
with transparent backgrounds—no scene, text, smooth gradient, lighting setup, or
decorative frame. Runtime deliveries use the exact current default-pouch
`510×511` transparent RGBA canvas with comparable occupied bounds. They fit into
the shared 72×72 in-run, 140×140 New Run, and 176×176 Collection carousel boxes. This is
one common asset family, not 14 differently sized UI components. Military Pouch
uses a chunky olive/khaki camouflage textile pattern contained inside the shared
silhouette; its clasp, dark outline, and object scale remain unchanged. Lucky
Pouch has one centred gold circular emblem. Pencil Case and Coin Purse are shown
open and empty, with no pencils or coins. The case-shaped asset is retained
under the Briefcase display name.

**Selection disclosure (changed 2026-07-31).** An unlocked Pouch shows its
name/effect without unlock copy. A locked Pouch's New Run panel instead shows a
muted locked object and its exact unlock condition; its tooltip retains the
actual name/effect. This disclosure rule also gates Collection unlock copy to
locked Pouches only.

### 12.3 Records — 8 cumulative difficulty levels

Records are the run difficulty system: a Slay-the-Spire-style ascending ladder
whose penalties accumulate from LP through DVD. Every Starting Pouch owns a
separate copy of this ladder. White LP is available by default for each Pouch;
winning the highest unlocked level unlocks the next row for that Pouch only. The table's “adds”
column describes the new penalty at that level—every earlier penalty remains
active.

The ordered selector, position dots, and lock state communicate this progression
in New Run. Record unlock-condition text is intentionally not rendered in that
surface or its tooltip; the rules remain explicit in this design table. Records
have no Collection category.

| Level | Record (ko / en) | Adds at this level | Unlock |
|---:|---|---|---|
| 1 | **흰색 LP 판 / White LP** | No penalty | Default |
| 2 | **붉은색 LP 판 / Red LP** | Draft clear reward becomes $0; remaining-resource and interest lines are unchanged | Win on White LP |
| 3 | **초록색 LP 판 / Green LP** | Every blind target gains `×1.15^(Chapter−1)` | Win on Red LP |
| 4 | **파란색 LP 판 / Blue LP** | Hand size −1 | Win on Green LP |
| 5 | **노란색 LP 판 / Yellow LP** | Discards per round −1 | Win on Blue LP |
| 6 | **투명한 LP 판 / Clear LP** | Phases per round −1 | Win on Yellow LP |
| 7 | **CD / CD** | Emoji Tile slots −1 | Win on Clear LP |
| 8 | **DVD / DVD** | Interest is always $0 | Win on CD |

For example, DVD includes Red LP's Draft reward removal, Green LP's target
growth, Blue/Yellow/Clear resource reductions, CD's Emoji Tile slot reduction,
and DVD's no-interest rule.

At Green LP, Chapter 1's added factor is 1.0, Chapter 2's is 1.15, Chapter 3's
is 1.3225, and so on. Apply it to every Draft, Revision, and Deadline after the
ordinary target—including boss target modifiers—has been established, then
compose Briefcase's ×2 if selected (§12.1).

**Record art contract.** Every Record image is pixel art on the same `510×511`
transparent RGBA selection canvas used by the Pouch family.

- White, Red, Green, Blue, and Yellow LP use one pixel-identical black-vinyl
  master; **only the centre label sticker colour changes**.
- Clear LP keeps a white centre label and replaces the vinyl with a
  semi-transparent acrylic disc. Use stepped highlights/dither rather than a
  smooth opacity gradient.
- CD uses a conventional silver reflective-disc treatment and its visible
  diameter is smaller than an LP in the same selector frame.
- DVD matches the CD's physical size but uses a clearly different iridescent
  rainbow surface pattern.

**Emoji Tile Record stickers (added 2026-08-14).** Clearing the Chapter 8
Deadline in an ordinary unseeded run stamps every production Emoji Tile still
owned after blind-end hooks resolve with the selected Record. A disabled tile
still qualifies; one destroyed or sold before that snapshot does not. Copies
collapse to their shared definition id. The profile stores only the highest
Record per Emoji Tile, and a higher sticker counts every lower cumulative tier.
Collection -> Emoji Tiles renders that Record's existing art as a small
upper-right sticker and explains the exact Record in the shared tooltip. The
The Statistics total is therefore `150 Emoji Tiles × 8 Records = 1,200`.
Stickers are profile-scoped mastery marks with no gameplay effect, never enter
`RunState`, and custom-seed, Challenge, or post-victory Endless play cannot award them.
Profile Reveal All exposes the current production roster but never fabricates
Record stickers. Already-earned stickers remain intact while Challenges are
disabled through its existing rule.

### 12.4 Open Questions & Next Steps

**Resolved since v0.1:** sentence pattern table (→ §5) · in-phase loop (→ §6) ·
blind/ante structure & boss pool (→ §8) · shop & economy (→ §9) · consumables
(→ §10) · Starting Pouches and Records (→ §12) · round-level suit synergy
(→ Unison, §5.3).

**Still open:**

- **Value balancing across the board.** Emoji Tiles, patterns, Unison, vouchers,
  prices, target curves, Pouch effects, and Record penalties need simulation and
  playtest tuning without changing §12's confirmed identities.
- **Blind skip & Editorial Perk balance (harness + full proxy sweep shipped
  2026-08-22).** `src/sim/skip-verification.ts` verifies all 30 ids and timing
  buckets, engine-owned free-pack/next-blind/next-shop/delayed resolution,
  consecutive skips, offer no-repeat, the Deadline guard, and Chapter 38 without
  Chapter 39. The bounded baseline and the 2,000-seed
  `2026-08-22-skip-verification-full.{json,md}` artifact use a neutral
  single-decision counterfactual proxy; they are not player behavior or a tuning
  claim. The pre-correction JSON is retained as an immutable provenance archive;
  `2026-08-22-skip-verification-full-pre-tune-corrected.{json,md}` replays its
  original Emoji-factor snapshot with corrected Coupon/free-pack semantics, while
  the main full artifact records the current tuned snapshot. Human playtests must
  still measure the
  §8.2 target skip rate (20–35%) before any timing gate, chaining reward, or
  skip-synergy Emoji Tile is considered.
- **Register/POS dataset refresh.** The complete baked table and reproducible
  register audit exist (§3.2, §4.2); refresh the licensed offline snapshots when
  source dictionaries or the authoritative classification criteria change.
- **Emoji Tiles keyed to Word Hands (§5.5).** The dedicated family now covers
  Twin, Triplet, Palindrome, Vowel Flush, and Straight; future hands may expand it.
- **Emoji Tile balance verification (full sweep shipped 2026-08-22).**
  `src/sim/board-verification.ts` now verifies the exact 150-tile public roster,
  deterministic paired control/focal traversal, market exposure, Chapter 38
  completion without Chapter 39, and the 14×8 Pouch/Record matrix. The committed
  baseline and `2026-08-22-board-verification-full.{json,md}` artifacts record the
  bounded and exact full budgets. Outlier flags require two independent semantic
  axes and never auto-retune values. The separate 256-pair
  `2026-08-22-emoji-flag-rerun.json` screens twelve approved candidates with
  mean 95% intervals and four-block sign stability; Formal Invitation and Tip Jar
  are explicitly direct-authored-gold screens, not semantic outliers. The
  source-hashed `2026-08-22-emoji-flag-rerun-1024.json` adds a 1,024-pair
  confirmation for Word Hunter, Classicist, Blood Type A, and Biochemistry.
  That screen approved a bounded first tuning pass: Word Hunter's unique-word
  gain was later revised to +0.1 and Biochemistry's non-consecutive most-used-hand gain to +0.5; the paired
  post-tune artifact records their effect reduction without changing saved
  factors in existing runs. Further tuning decisions and the separate 97-tile
  redesign remain open.
- **Lexicon audit sampling.** Full ENABLE POS coverage shipped 2026-08-03. Future
  work is quality sampling/correction of obscure fallback entries; authoritative
  corrections remain baked data and the loader format stays stable.

---

## 13. Chromatic Unlocks — "writing the world into color" (feature-02 C)

The game begins **desaturated and silent**; playing specific words permanently unlocks presentation layers. This is the literal enactment of the title — you *play the world into existence*. Persistent **per profile** (localStorage `wj.unlocks`, beside collection/tutorial flags). **Valid words only** unlock (gibberish never does).

**System shape.** One data-driven registry (`src/ui/unlocks.ts`): `word → { effect }`. A word-played check fires on each valid submission; on the first-ever play of a listed word it records the unlock and fires a **celebration reveal** (the color washes in / audio fades up). Adding a future unlock = adding a registry row — **never a hard-coded word check in a component**.

The immediate `ChromaticReveal` remains, and the same newly played Palette ids
are summarized once in the integrated run-end unlock recap. Confirmation is
persisted: reload before confirmation repeats the recap, while confirmation
before Endless advances its baseline so those entries never repeat at the later
terminal screen. Reveal All's synthetic bulk state is absorbed into the baseline.

**Initial table (C-2).** **Language is not a palette unlock (changed 2026-07-30).** Korean was a celebration entry for something the player already had — the language selector was never gated — so the row was removed along with the `locale` effect kind. The Palette now has three sections: 색상 / 음향 / 캐릭터.

| Word | Unlocks |
|---|---|
| RED | red token group — `--mult`, red buttons, rare-emoji-tile frames |
| YELLOW | gold token group — money, gold UI, early-end glow |
| GREEN | green token group — desk/blind backgrounds (`--bg-desk`) |
| BLUE | blue token group — `--chips`, blue buttons |
| MUSIC | BGM bus enabled (wraps the feature-01 mixer's music bus) |
| SOUND | SFX bus enabled (wraps the SFX bus) |
| ALIEN / GHOST / DOG / TURTLE | **WooDak ally skins** — selectable in **Collection → Mascots** once unlocked *and* art exists (moved from Settings → Game on 2026-07-29; registry `src/ui/mascots.ts`, resolver `mascotSrc`). The selected card is outlined and labeled; locked silhouettes cannot be selected. **All four shipped** (`alien.png`/`ghost.png`/`dog.png`/`turtle.png`). The selected, unlocked skin also supplies the game's normal/hover/active hand cursor; a locked, invalid, or missing-art selection falls back to WooDak, and Piyak never supplies a cursor. ALIEN/GHOST/TURTLE use original local character designs that visibly match their unlock theme while sharing only the project's pixel-art treatment; recognizable third-party character or arcade-sprite features are prohibited (art replaced 2026-08-02). Piyak (shop) is never re-skinned. (CAT retired from the roster, 2026-07-22.) Display names: DOG = 누렁이 / Nurungi, GHOST = 이고야 / Egoya, ALIEN = 이고지 / Egoji, TURTLE = 느무보 / Nemubo. The unlock **words** stay GHOST / ALIEN / DOG / TURTLE — the name is display copy (`mascot.<id>`), the word is the trigger. |

**"Grayscale" = full token desaturation + a monochrome guard (C-3, revised).** The **whole** palette (chips, mult, gold, suits, tile faces, slate chrome, backgrounds) defaults to neutral **greys**, so the world starts *genuinely* black-and-white. Each color word restores its group's true hues via an `unlock-<group>` class on `<html>` (token swapping) with a wash animation — so the world re-colors **progressively** (RED→mult/vulgar/the tomato icon, YELLOW→gold/slang/warm tile faces, GREEN→desk/blind backgrounds, BLUE→chips/formal/standard suits + the slate UI chrome). Because some fills are hard-coded (material tile faces and the blind badge) beyond the tokens' reach, a **`world-mono` guard** additionally applies `filter: grayscale(1)` to the board *only while no color group is unlocked* — guaranteeing a truly colorless start — and is dropped the moment any color is played, after which token desaturation carries the reveal. Native cursor images sit outside that filtered board, so every mascot hand has a matching monochrome derivative used while `world-mono` is present and switches to its colour master after the first colour group unlocks. The main `.frame` itself is transparent as of 2026-07-30; the former per-stage backdrops are retired. The fixed CRT overlay sits outside the greyscaled containers, so it is never affected. The chips/mult info floor is safe — color is never the sole info channel (a11y rule) — so the monochrome start is playable.

**Audio gating (C-6).** MUSIC/SOUND gate the shipped real mixer's buses — **default off** (the game starts silent) until the word is played or the override is on. Color groups are independent.

All enabled native buttons and ARIA button controls play the shared button-press
SFX through one delegated UI listener. A primary pointer press fires it once on
`pointerdown`, synchronized with the mascot cursor's active frame; Enter or Space
fires it once on `keydown`, with repeat and the following native synthetic click
ignored. Disabled/`aria-disabled` controls, right-clicks, and desk objects with
their own semantic sounds stay silent on this shared path. Shell navigation, Collection/Options
sub-screens, and in-run phase panels play the transition whoosh on destination
change. Both paths still pass through the SOUND-gated SFX bus.

**Profile unlock-all (C-4, changed 2026-07-31).** The Profile screen owns the
**Reveal All / 모두 잠금 해제** escape hatch; Settings has no device-wide
override. The first press changes no unlock or discovery state and only persists
that the selected profile saw the warning. A later press fills that profile's
word Collection, Palette/audio/mascot registry, Starting Pouch wins, Record wins,
upgraded-voucher registry, and marks Challenges disabled for that profile. It
never fills or alters `completedChallenges`: the Challenge list and prior genuine
completions remain visible, but every Start action is disabled. A Challenge run
saved before Reveal All may still Continue, while its eventual win records no
Challenge completion.
The word Collection uses the per-profile applied marker to present every
dictionary entry as discovered, including its spelling, original register,
search, and filter visibility; it does not fabricate play-count or score records.
The operation is permanently isolated to the selected profile slot and never
changes another slot.
After the escape hatch is applied, its button is permanently replaced by
**Challenges disabled / 도전과제 비활성화됨**. If the profile instead earns every
currently implemented word, Palette/audio/mascot, Starting Pouch, Record, and
upgraded-voucher unlock without using the escape hatch, the button is replaced
by **Your world is complete / 당신의 세상이 완성됨**. The escape-hatch state takes
precedence over natural-completion presentation.

**Discoverability (C-5).** New Collection category **팔레트 (Palette)** — locked entries are grey silhouettes with a letter-count hint ("R _ _"), unlocked entries show the word in its group color. The first-run tutorial (2026-07-21) is a scripted, **hard-locked YELLOW lesson**: the opening hand is rigged to contain Y‑E‑L‑L‑O‑W. The target is **not** lowered — it stays the normal ante-1 value, so submitting YELLOW (252 under the §3.1 length bonus) ends the *lesson* but does **not** clear the blind; the board then unlocks and the player plays on to reach the target (the old `TUTORIAL_TARGET`=10 override was retired 2026-07-22). A WooDak coach-mark frames the grey world (so it never reads as a rendering bug), then the player builds and submits YELLOW — the yellow palette washes in ("Gold floods back in.") teaching word-building, submission, and the Palette by doing. `anteBaseTargets[0]` must stay above a single YELLOW score; `tests/yellow-lesson.test.ts` guards it. See `docs/superpowers/specs/2026-07-21-yellow-first-lesson-design.md`.

The build-step copy also notes that during normal play, right-clicking a hand
tile marks it for discard. This adds no step, and discard stays locked during
the lesson. (Changed 2026-08-25.)

---

## 14. Steam Achievements

Steam Achievement v1 is presentation/persistence integration only; it never
enters `RunState` or the headless engine. It is active only in a packaged Windows
x64 build launched by Steam. Browser builds, direct executable launches, missing
Steam, and initialization failures silently retain ordinary play and saves.

Each profile's optional `steamEligible` v1 ledger records only semantic evidence:
unseeded standard runs/wins, Pouch/Record/pair wins, genuine Challenge completions,
and the highest genuinely earned Record sticker per Emoji Tile. Custom seeds and
Profile Reveal All never add evidence. A legacy profile receives one conservative
backfill from existing balance, Challenge, and sticker progress; Pouch/Record
unlock backfill is omitted when Reveal All was applied. P1-P3 are aggregated by
run/win sum, set union, and per-Emoji maximum sticker rank, with int32 clamping.

The renderer sends one versioned payload containing exactly eight non-negative
integer stats. The Electron main process validates the sender and fixed schema,
then reconciles every value as `max(local, Steam)` so progress never decreases.
It coalesces writes and retries independently of save health. Achievement ids
remain main-process-only and are unlocked through Steam Partner stat progress:

| Steam stat | Achievement thresholds |
|---|---|
| `std_runs` | `ACH_FIRST_DRAFT` 1; `ACH_REGULAR_COLUMN` 10 |
| `std_wins` | `ACH_PUBLISHED` 1; `ACH_TEN_PRINTINGS` 10; `ACH_TWENTY_FIVE_PRINTINGS` 25 |
| `pouches_won` | `ACH_PACK_LIGHT` 3; `ACH_POUCH_CABINET` 7; `ACH_WORLD_IN_A_BAG` 14 |
| `records_won` | `ACH_B_SIDE` 4; `ACH_FULL_DISCOGRAPHY` 8 |
| `pouch_record_pairs` | `ACH_CROSS_PRESS` 16 |
| `challenges_completed` | `ACH_CHALLENGE_ACCEPTED` 1; `ACH_SIX_ASSIGNMENTS` 6 |
| `emoji_mastered` | `ACH_FIRST_PROOF` 1; `ACH_EMOJI_BOARD` 25 |
| `emoji_record_sticker_tiers` | `ACH_STICKER_ALBUM` 100 |

No AppID or `steam_appid.txt` ships in the repository or depot; production uses
only the AppID supplied by the Steam launch environment. Overlay forcing remains
deferred. `profile.json` has one main-process-only root
`steamOwner:{version:1,steamId64}` outside every profile slot and renderer save
snapshot. It protects Steam statistics/evidence from cross-account contamination;
it does not promise account-specific isolation of the whole Cloud file.

Only a matching owner may add `steamEligible` evidence or send stats. An unowned
zero-stat save binds automatically after both primary and backup are durably
written. Positive legacy evidence requires one explicit permanent-link prompt;
decline disables Steam progress for the session. Mismatch, malformed ownership,
direct launch, initialization failure, pending decision, and failed owner writes
all fail closed while ordinary play and saves continue unchanged. The Steam id
never reaches renderer state, UI copy, or logs. (Ownership added 2026-08-25.)
