# Feature Work Order 03 — Effect Bug · Clarity · VFX · Probability

Confirmed batch from the 2026-07-27 design review. **The docs are already updated** for everything below (GDD §2.4 / §9.2 / §9.3 / §12, UI_DESIGN §3.1 / §4, screens-spec §2.0, AGENTS+CLAUDE guardrail) — implement against them; residual mismatches, the docs win and flag it.

Order: **A (bug — blocks trusting anything else) → B (clarity) → C (probability) → D (VFX/screens)**.

Deliberately NOT in this order (design-side, deferred by decision): pouch/bag types, the stakes/Ink-colour ladder, acronyms in the lexicon, Gambler card effects, the Legendary acquisition route, and the duplicate-breaker item. Do not start these.

**Resolved since the review** — two former blockers are now decided: the **font↔effect mapping is confirmed** (GDD §2.3 table — Light Italic `goldPlay` / Bold `chipPlay` / Inline `discardGain` / Black `retriggerPlay`), and the **Ink Pack name is settled** (Forbidden Books stays deferred, §10.3).

---

## A. BUG — materials, fonts, and editions may not be firing in game

Reported: enhancement effects appear to do nothing in play. **Diagnose before fixing**, and report which of these it is (they need different fixes):

1. **Hooks not wired** — the material/font/edition effects are defined but never invoked by the scoring pipeline.
2. **Font mapping was provisional** — `balance.ts` `fontEffects` may still hold the old placeholder assignment. This is no longer an open question: write the confirmed mapping from GDD §2.3 (Light Italic `goldPlay` / Bold `chipPlay` / Inline `discardGain` / Black `retriggerPlay`) and re-check whether fonts were only *appearing* inert because of it.
3. **Acquisition path blocked** — effects work, but enhanced tiles never reach the player (pack rolls not attaching material/font/edition, or attaching only `base`).
4. **Display-only** — effects fire but nothing shows them, so they read as broken.

**Deliverable:** a short written diagnosis per axis (material / font / edition) naming which of 1–4 applies, then the fix. Add a test per axis that asserts an enhanced tile actually changes the scored total (e.g. a Ceramic tile adds its chips; a `chipPlay` font adds its chips; a Foil edition adds its chips) — this class of bug must not be able to return silently.

**Note:** GDD §2.4 now states the three axes stack simultaneously. Verify a tile carrying material + font + edition pays all three.

**Also in scope for A:** apply the confirmed `fontEffects` mapping (above) and delete any `// PROVISIONAL` marker; this closes the corresponding GDD §12 item.

## B. Clarity

### B-1. Material legibility (UI_DESIGN §3.1)
Implement the per-material treatment table: face texture per material, **corner glyphs for conditional materials** (Glass = crack, Lead plate = dice pip, Ivory = `$`, Brass = hand), and **Wood's live growth counter** (its current +Chips, which changes as it grows).

### B-2. Per-material ink contrast
Add the light `--tile-ink` variant and apply it automatically on dark faces (Lead plate, Stone). Accessibility floor — verify contrast in both the monochrome start state and the fully-unlocked palette.

### B-3. Overwrite warning (GDD §2.4)
When an action would replace an existing same-axis enhancement, confirm first ("this tile is already Ceramic — replace with Polished?"). Cross-axis application applies silently.

## C. Probability tables

### C-1. Emoji tile rarity weights (GDD §9.2)
`balance.ts` `emoji.rarityWeights` = Common 70 / Uncommon 25 / Rare 5. **Legendary is excluded from shop and Charm Pack rolls** — it has no acquisition route yet (§12 open), so it must simply never roll rather than silently appearing.

### C-2. No duplicate Emoji Tiles (GDD §9.2)
Offer pools (shop item slots, Charm Packs) exclude tiles the player already owns; selling returns a tile to the pool. Build the exclusion as a **single shared filter** both call — not two implementations. The "explicit effect may break this" exception has no item yet; leave a documented hook so adding one later is a data change, not a refactor.

### C-3. Pack weights (GDD §9.3)
`pack.typeWeights` = Fable 4 / Constellation 4 / Tile 4 / Charm 2 / Ink 0.6; `pack.sizeWeights` = Normal 8 / Jumbo 3 / Mega 1, rolled independently. Ink stays unrollable until its Gambler registry lands — keep the weight in data but gated, so enabling it is a flag flip.

### C-4. Sim check
Add a `src/sim/` scenario reporting, over many runs: rarity distribution of offered tiles, how often a shop offers nothing new (the shrinking-pool effect of C-2), and pack type/size distribution. These weights are guesses until the sim says otherwise.

## D. VFX & screens

- **D-1 Tomato reactions** (UI_DESIGN §4.6): squash-pop on every scoring beat + occasional idle hop. This is the main fix for "the board is static".
- **D-2 Burning score boxes** (§4.7): chips/mult boxes ignite while the settling total is ≥ target, flame scaling with the overshoot. Must ignite **during** the count-up — it is the auto-settle tell, so igniting after the fact defeats the purpose. Respect reduced motion (static ember state, no animation).
- **D-3 Side interactions** (§4.8): ambient desk objects (coffee cup, pencil, paper plane) drift into the margins on a random timer; click = animation + SFX. **Cosmetic only — grants nothing.** One at a time, never over interactive board area, never blocking a click that was aimed at the board.
- **D-4 Loading screen** (screens-spec §2.0): real preload progress, pixel progress bar, greyscale on a fresh profile (§13), no artificial delay, silent (audio can decode but not play before the first gesture).

---

## Docs sync (already applied — verify, don't redo)
GDD **§2.4** (new: three-axis stacking + same-axis overwrite + Stone exception) · **§9.2** (rarity weights, Legendary exclusion, no-duplicate rule) · **§9.3** (type/size weights) · **§12** (new open items: duplicate-breaker item, Legendary route, acronyms) · UI_DESIGN **§3.1** (material legibility) and **§4.6–4.8** (tomato, burning boxes, side interactions) · screens-spec **§2.0** (loading screen) · AGENTS.md + CLAUDE.md (stacking/overwrite guardrail appended to the modifier-axes bullet).
