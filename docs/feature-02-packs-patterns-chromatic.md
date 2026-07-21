# Feature Work Order 02 — Pattern Chips×Mult · Packs · Chromatic Unlocks · UX Batch

Four groups: **A = pattern-scoring restructure** (engine, replaces GDD §5.2's add/multiply scheme — decision confirmed), **B = pack system** (names + sizes), **C = the chromatic unlock gimmick** (new meta system), **D = UX/design batch**. Apply the spec-conflict protocol: every change lands in the docs in the same pass.

Two interpreted assumptions, flagged: ① the pack-size list's second "Jumbo" is read as **Mega** (Normal 3-pick-1 / Jumbo 5-pick-1 / Mega 5-pick-2 — Balatro's exact structure); ② the **Forbidden Books pack** was absent from the list — recommendation below keeps it as a rare 5th type, pending design confirmation.

---

## A. Sentence-pattern scoring — unified base Chips × Mult (decision confirmed)

Replaces the per-pattern add/multiply operations (old §5.2) and the op-specific punctuation level effects (old §5.4). Balatro-hand-style: every pattern owns a base [Chips × Mult] pair; leveling raises both.

### A-1. Formula
```
sentence bonus = (patternChips + 15 × absorbedModifiers + unisonChips)
              × (patternMult × unisonMult)
```
- Added to the blind score at sentence finalization (auto-settle sequence unchanged, §7.2/§7.4).
- Unison folds in unchanged: Standard contributes +50 to the chips side; Formal ×1.25 / Slang ×1.5 / Vulgar ×2 on the mult side.
- Modifier absorption unifies to the chips side (+15 each; the old ×0.15-for-multiply-patterns variant is gone).
- `PatternDef.op` (add/multiply) is removed from types; migrate `balance.ts` patterns to `{ baseChips, baseMult, levelChips, levelMult }`.

### A-2. Base values (placeholders → balance.ts; hierarchy preserved from the old ranks)

| # | Pattern | Base | Per level (+Chips, +Mult) |
|---|---|---|---|
| 1 | Outcry | 10 × 1 | +10, +0.5 |
| 2 | Imperative | 15 × 2 | +10, +0.5 |
| 3 | Chant | 15 × 2, **plus +10 Chips per repeat beyond the 3rd** | +10, +0.5 (repeat bonus also +5/level) |
| 4 | Simple | 25 × 2 | +15, +1 |
| 5 | Descriptive | 30 × 3 | +15, +1 |
| 6 | Transitive | 40 × 3 | +20, +1 |
| 7 | Ditransitive | 50 × 4 | +25, +1.5 |
| 8 | Compound | 60 × 4 | +30, +1.5 |

### A-3. Run Info — the pattern table (currently levels only)
Run Info gains the Balatro-style hand list: all 8 patterns × [name | level | current Chips × Mult], updating live as Punctuation cards level them. The staged-word/sentence forecast keeps showing projected totals, but the *source values* are now inspectable here.

### A-4. Docs sync
GDD §5.2 rewritten to the table above; §5.3 note that unison applies inside the formula (values unchanged); §5.4 punctuation effects become uniform per-pattern (+levelChips/+levelMult); §7.4 wording sweep; cross-reference sweep for "add/multiply pattern" mentions (CLAUDE.md guardrails included if any).

## B. Pack system

### B-1. Types & names (publishing-world naming)

| Pack | Contents | Name (ko / en) | Balatro analog |
|---|---|---|---|
| Pattern pack | Punctuation cards (pattern level-ups) | **조판 팩 / Typesetting Pack** | Celestial |
| Joker pack | joker (emoji) choices | **스티커 팩 / Sticker Pack** *(renames "Emoji Pack" everywhere)* | Buffoon |
| Consumable pack | Stationery consumable choices | **문구 팩 / Stationery Pack** | Arcana |
| Tile pack | letter tiles, enhanced (material/font) variants appear | **활자 팩 / Type Pack** *(renames "Letter Pack")* | Standard |
| *(recommended, confirm)* | Forbidden Books items, rare appearance | **금서고 팩 / Forbidden Stacks** | Spectral |

### B-2. Sizes (all pack types)
**Normal: 3 shown, pick up to 1 · Jumbo: 5 shown, pick up to 1 · Mega: 5 shown, pick up to 2.** Prices placeholder (Balatro reference: 4/6/8) → balance.ts. Shop pack slots may roll any type × size; Mega/Jumbo rarer (weights in balance.ts).

### B-3. Docs sync
GDD §9.3 table replaced with B-1/B-2; rename sweep (Emoji Pack → Sticker Pack, Letter Pack → Type Pack) across GDD/screens-spec/UI_DESIGN/code identifiers' display strings (code ids may stay; display via i18n).

## C. Chromatic unlocks — "writing the world into color" (new meta system)

The game begins **desaturated and silent**; playing specific words permanently unlocks presentation layers. This is the literal enactment of the title — you play the world into existence. Persistent **per profile** (localStorage, beside collection/tutorial flags). Valid words only (gibberish never unlocks).

### C-1. System shape
One data-driven registry (`unlocks.ts`): `word → { effectId, celebrationCopy }`. A `wordPlayed` listener checks it; on first play, fire the **celebration reveal** (color washes in / audio fades up) and record to the collection. Adding future unlock words = adding rows.

### C-2. Initial unlock table

| Word | Unlocks |
|---|---|
| RED | red token group — `--mult`, red buttons, rare-joker frames… |
| YELLOW | gold token group — money, gold UI, early-end glow |
| GREEN | green token group — desk/blind backgrounds |
| BLUE | blue token group — `--chips`, blue buttons |
| MUSIC | BGM enabled (wraps the feature-01 mixer's music bus) |
| SOUND | SFX enabled (wraps the SFX bus) |
| KOREAN | Korean locale **celebration-unlock** (see C-4) |
| MONSTER / GHOST / DOG / CAT | mascot variant skins — **data slots now, art later** (register the rows; effect no-ops until variant art exists) |

### C-3. Implementation of "grayscale"
Not a screen-wide filter: **token-group swapping.** Palette tokens are grouped by unlock color; the locked state maps each group to desaturated equivalents, unlock swaps the true values in with a wash animation. (A blanket `filter: grayscale` would kill unlocked colors too and fight the CRT pass.) The chips/mult info floor is safe — color is never the sole info channel (existing a11y rule) — so the desaturated start is playable.

### C-4. Escape hatch (decision confirmed: option b)
- **Settings → Accessibility/Graphics: "presentation unlocks" manual override** (unlock all, or per-item). Buried but present — for accessibility, streamers, and impatient players.
- The gimmick remains the **celebratory path**: even if something was manually unlocked, the first time the word is actually played, the celebration + collection record still fire (once).
- **KOREAN specifically:** the language is manually selectable in Settings from the start (a Korean player is never forced through English); playing KOREAN triggers the special celebration + collection entry. The gimmick is the reward, not the gate, for language.

### C-5. Discoverability
- New Collection category: **팔레트 (Palette)** — locked entries as silhouettes with letter-count hints ("R _ _"), unlocked entries in full color with the triggering word.
- WooDak's tip pool gains occasional unlock hints; the first-run tutorial includes one WooDak line framing the desaturated world ("이 세계는 아직 다 쓰이지 않았어~우땅") so it never reads as a rendering bug.

### C-6. Ordering dependency
Requires feature-01 B (audio) shipped first — MUSIC/SOUND gate the real mixer's buses (default off until unlocked or overridden). Color groups can ship independently of audio.

### C-7. Docs sync
GDD: new subsection (suggest §13 or under §1 as "Chromatic Unlocks") + §12 item closed/updated; screens-spec: Palette collection category + Settings override toggle; UI_DESIGN: token-group table annotated with unlock groups; CLAUDE.md: add "presentation unlock flags live beside collection/tutorial flags; unlock registry is data-driven — never hard-code a word check in components."

## D. UX / design batch

- **D-1 Joker reorder by drag** — owned-joker shelf supports drag reordering; **order = hook execution order** (strategic, Balatro-style: additive-before-multiplicative matters). Persist order in run state; document the rule in the joker tooltip area or Help.
- **D-2 Drag dot-outline** — while dragging a tile: dashed pixel outline at the origin slot and at the live insertion gap (Balatro feel). Applies to hand, tile zone, and the joker shelf (D-1).
- **D-3 Gibberish tutorial step** — restyle to the spotlight + speech-bubble grammar used by the other steps (consistency).
- **D-4 Joker & consumable idle animations** — same wobble family as tiles (staggered slow sine, ±1–1.5°), respecting reduced motion.
- **D-5 Tomato score icon (decision confirmed: icon only)** — replace the poker-chip icon beside score numbers (blind badge target, round score) with a **pixel tomato**; the term "Chips" and the blue chips box are unchanged. New tiny pixel asset; thematically: tomatoes thrown at bad manuscripts.
- **D-6 Stage backgrounds** — per-stage backdrops in the publishing fiction: **초고/Draft** = writer's desk · **퇴고/Revision** = marked-up manuscript · **마감/Deadline** = the editor's red-pen office (tense variant). Pixel-art, sits under the CRT pass, desaturation-aware (C-3: background colors belong to unlock groups where applicable — GREEN gates them).
- **D-7 Collection modal heights** — all categories use the Words modal's height (uniform).
- **D-8 BGM** — no new work here: composed/wired in feature-01 B-2, then gated by C's MUSIC unlock (C-6 ordering).

---

## Suggested order
**A** (engine restructure — unblocks Run Info + forecast correctness) → **B** (packs — small, shop-complete) → **D** (batch) → **C** (chromatic — largest new system, needs feature-01 B first for the audio half; color half can start anytime).
