# Feature Work Order 01 — Tutorial · Sound · Font Effects (Seals)

Three confirmed systems. The docs (GDD §2.3 seal table, §12 items, UI_DESIGN §6.1, screens-spec Options/Settings/Fonts rows) have already been updated to match this work order — implement against them; if any residual mismatch surfaces, the docs win and flag it (spec-conflict protocol).

Suggested order: **C (font seals, smallest & unblocks tooltips) → B (sound phase 1) → A (tutorial, largest)**.

---

## A. Tutorial system — layered, with the cat as guide

Requirement: every element and mechanic gets explained **exactly once**. Do NOT front-load everything into the first run; layer it.

### A-1. Layer 1 — first-run guided intro (core loop only)
- Runs on a player's first run (skippable at any moment; "skip tutorial" also offered up front; re-triggerable from Options → Help).
- **Guide character: 우땅 (WooDak), the orangutan editor-mentor** (UI_DESIGN §6.1) — this is his designated future role per the GDD mascot spec, now activated. Reuses the shipped mascot grammar (breathe idle, pixel speech bubble, jump-pop entry). **Piyak (the cat) is NOT the tutorial guide** — she keeps her shipped shop-greeting role, and fronts only the shop-first-visit encounter card (A-2).
- Scope: ~6 short steps in the first blind only — ① spell a word from hand tiles → ② the settle sequence & chips×mult → ③ the target and committed score → ④ discard (marking hand tiles) → ⑤ the sentence tray & pattern forecast (one sentence: "words you play line up into a sentence — finish one for a bonus") → ⑥ auto-settle on clearing. Nothing else.
- Steps gate input minimally (highlight the relevant control, dim the rest); never soft-lock — every step has a "got it" advance.

### A-2. Layer 2 — first-encounter popups (everything else)
- A one-time explainer card fires the FIRST time the player encounters each element. Tracked via `seen` flags in localStorage (alongside the collection store).
- Encounter list (extend as systems ship): first joker acquired · first material tile in hand (per material? no — one generic materials card, tooltip covers specifics) · first font-effect tile · first Letter Hand triggered · first sentence pattern completed · first Unison · first gibberish submission (explain the hole) · shop first visit (cat greets — reuse guide framing) · each consumable family first seen · first voucher · first pack opening · **each boss on first encounter** (per-boss, since effects differ) · pouch widget first hover · Magnifier first owned.
- One shared popup component (small card, cat portrait optional, "don't show tips" toggle in Settings kills the whole layer).

### A-3. Layer 3 — Help / Glossary screen
- Options → Help: re-readable entries for everything Layer 1–2 covers, grouped by system. Entries can mirror the popup copy (single source of copy strings — write once in i18n, both ko/en).
- Optional nicety: entries unlock as encountered (ties into the discovery flags) with undiscovered shown greyed.

### A-4. Acceptance
- Fresh profile: guided intro plays; skipping works; every listed element shows its card exactly once across sessions; "don't show tips" suppresses Layer 2; Help screen lists all copy in both languages; reduced-motion respected in bubble animations.

## B. Sound — chiptune/8-bit, SFX first

Direction confirmed: chiptune/8-bit to match the pixel-art/CRT identity. **Phase 1 = SFX for the core loop; Phase 2 = BGM.**

### B-1. Phase 1 SFX set
Settle sequence (priority): tile pop per-scoring-beat · **chip count-up tick with rising pitch** (the Balatro dopamine staple — pitch escalates across consecutive ticks, resets per word) · joker trigger blip · letter-hand/suit stamp thunk · mult fill · total-roll whir · clear fanfare · fail/game-over sting.
Interaction: tile pickup/place/select · drag snap · discard swoosh · submit thock · button press · screen-transition whoosh (sync with the right-to-left slide).
Shop: purchase cha-ching · sell · reroll · pack open · voucher redeem · **cat meow on shop enter** (mascot beat).

### B-2. Phase 2 BGM
Menu / play / Stationery Shop / **Deadline (boss) variation** — boss blind swaps to a tenser variant of the play track (Balatro-style). Loop-safe files.

### B-3. Tech notes
- **Browser autoplay policy:** the audio context can only start after the first user gesture — unlock on first click/tap (title screen interaction), queue nothing before that.
- Wire the existing Settings sliders (master/music/SFX — currently a stub mixer) to the real mixer; persist values.
- The **game-speed setting must scale SFX scheduling** in the settle sequence (sounds stay in sync with the beats at 1/2/4×).
- Library: implementer's choice (Howler.js is a solid default — sprite sheets, pooling, volume groups). Keep all playback behind one small `audio.ts` facade so the library is swappable.
- Assets: CC0 placeholder packs to start (e.g. Kenney) — **log every asset's source/license in `assets/AUDIO_LICENSES.md`**; real bespoke chiptune can replace later without code changes (facade + manifest).
- Reduced-motion does NOT mute audio (separate concerns); the mute path is the sliders.

## C. Font effects — Balatro-seal adoption (decision confirmed)

Fonts are the letter-tile edition layer: **Medium (base, no effect) + 4 effect fonts (Light Italic · Bold · Inline · Black)**. GDD §2.3 now carries the full seal-effect table — implement exactly that. One code check: `types.ts` `TileFont` must carry all five values (it should already), and CLAUDE.md's TileFont guardrail must say 5, not 4 — fix if stale.

### C-1. The four effects (Balatro-seal ports; values → balance.ts)

| Effect id | Trigger | Effect (placeholder) | Balatro origin |
|---|---|---|---|
| `goldPlay` | tile scores in a played word | +$3 | Gold Seal |
| `chipPlay` | tile scores in a played word | +30 Chips | (adapted) |
| `retriggerPlay` | tile scores in a played word | retrigger this tile's scoring contribution once | Red Seal |
| `discardGain` | tile is discarded | gain 1 random consumable **(requires a free consumable slot; otherwise nothing)** | Purple Seal |

Rules:
- "Scores in a played word" includes **gibberish** submissions (tile-level effects fire whenever the tile scores, consistent with the layer-1 rule for jokers and with materials).
- `retriggerPlay` stacks with any other retrigger sources that exist (do NOT special-case; retriggers compose). *(GDD §2 design note: retrigger is reserved for fonts — materials deliberately left it unspent; Lead plate is the Lucky-roll material. `retriggerPlay` is that reservation, spent.)*
- `discardGain` interacts with the discard-economy axis (Brass, Thrift) — intended synergy, no cap for now.

### C-2. Font ↔ effect mapping — DATA-DRIVEN, mapping TBD by design
- Implement as a table in `balance.ts`: `fontEffects: { lightItalic: <effectId>, bold: <effectId>, inline: <effectId>, black: <effectId> }`.
- **The design side will supply the mapping**; until then use any provisional assignment clearly marked `// PROVISIONAL — awaiting design mapping`. Reassignment must be a one-line data change.
- Tile tooltips (play screen + collection Fonts category) read the effect text from this table — never hard-code.

### C-3. Acceptance
- Each effect fires on its trigger incl. the gibberish rule; `discardGain` no-ops gracefully when slots are full (with a small "slots full" toast); tooltips show correct effect per current mapping; changing the mapping in balance.ts updates tooltips with no other edits; docs (GDD §2.3 + collection screen spec) updated to the 5-font seal design in the same change.

---

## Docs sync checklist (residuals — most sync is already applied in the docs)
1. CLAUDE.md → verify the TileFont guardrail says **5** values; add "tutorial seen-flags live beside collection flags in localStorage".
2. GDD §12 → when the design supplies the font↔effect mapping, replace the provisional `fontEffects` assignment and close that open item.
3. On implementing B (audio): create `assets/AUDIO_LICENSES.md`; on implementing A: add the Help screen and tips-toggle to code matching screens-spec §2.10/§2.11 (already specced).
