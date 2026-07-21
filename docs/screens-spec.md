# Play the Wor!d — Screen Inventory & Flow Spec

Derived from 18 Balatro reference screenshots. **The screenshots are layout/flow reference.** All visual language (colors, type, surfaces, motion) comes from `docs/UI_DESIGN.md` — now a **pixel-art / CRT aesthetic** in the Balatro lineage (the earlier "ceramic, un-Balatro" identity and its trade-dress guardrail are retired). Adopt the pixel-art idiom, CRT post-effect, and screen grammar freely; only avoid copying Balatro's *specific* art assets (its actual card illustrations, logo, exact sprites). Where a Balatro concept has no equivalent yet in our game, the screen ships as a **[PLACEHOLDER]** with minimal stub content, to be filled later.

## 0. Global UI patterns (recurring across screens)

- **Tab pills** along the top for sectioned screens (settings tabs, collection tabs); active tab marked with a small arrow indicator above.
- **Back button**: full-width gold bar pinned at the bottom of every sub-screen.
- **Carousel selector** `< value >` for enumerated options (deck, stake, window mode).
- **Slider + value badge** for continuous options (volume, screenshake).
- **Card tooltip**: hovering any joker/consumable anywhere (shelf, shop, collection) opens an anchored tooltip: name, effect text, and — for scaling jokers — the **current grown value** (e.g. "currently ×1.5"). One shared component.
- **Pagination carousel**: long grids page with a `< Page N/M >` pill control (jokers, words).
- **Collection grid card**: shared component — discovered = full render + tooltip on hover; undiscovered = silhouette/back-face, no tooltip.
- **New-discovery badge**: category buttons and the main-menu Collection button show a `!` badge when they contain undiscovered-then-found items since last view.
- **Score popups**: during word settle, each tile pops a small `+N` chip-blue tag above it as it scores (adds to the juice spec, UI_DESIGN §4 step 1).

## 1. Screen flow map

```
Main Menu ─ Play ─→ New Run ─→ [Blind Select] → PLAY SCREEN ─(auto-settle)→ Fee Settlement → Shop ─┐
    │                                   ↑                                        │
    │                                   └────────────── next blind ←─────────────┘
    │                                   (loss) → Game Over → New Run / Main Menu
    ├─ Collection (도감)
    └─ Options ─┬─ Settings (Game / Video / Audio tabs)
                ├─ Statistics (+ per-joker stats [PLACEHOLDER])
                └─ Credits
In-run overlays: Run Info · Bag View · pause menu
```

## 2. Screens

### 2.1 Main Menu
Title treatment (our own logotype), buttons: **Play · Options · Collection · Quit**(desktop/web tab close N/A → hide on web). Profile chip bottom-left **[PLACEHOLDER: single profile "P1"]**, language toggle bottom-right (ko/en — i18n already shipped). Collection button badges a `!` when new words/jokers were discovered last run.

### 2.2 New Run
Top tabs: **New Run · Continue · Challenges**. **Continue resumes the saved run** (playtest-06): the run is persisted to `localStorage` (`wj.run`, via `src/ui/persist.ts`) on every state change, so it survives both leaving to the main menu and a page reload. The tab greys out when there is no run or the run ended (game over), and is **default-selected when a run exists** so hitting Play never wipes it by accident. Only a *resting* snapshot is saved — settle-animation fields are stripped, since the settle replays from a per-submission `ScoreEvent` log that cannot be resumed mid-flight. The save is versioned; a schema-mismatched or corrupt save is **discarded, not migrated**. Challenges **[PLACEHOLDER: hidden]**. Below, two stacked carousels + play:
- **Bag select** carousel **[PLACEHOLDER: one entry — "Standard Bag", 68 tiles]** (GDD §2.1; the 98→68 rebalance, playtest-04 C-2). Card-style preview + description panel. Structure ships now so future bags (GDD §12 starting decks) slot in.
- **Stake select** carousel **[PLACEHOLDER: one entry — "White Stake", no modifiers]** (GDD §12 stakes deferred).
- **Seeded run** toggle + seed input (engine already supports `RunState.seed`).
- Big blue **Play** button.

### 2.3 Blind Select (before each blind)
Draft/Revision/Deadline cards with target score and reward preview. The **Deadline boss always shows its effect text** (playtest-04 D-6) — no hiding, no `?`. The chapter's boss is drawn at chapter start (`run.chapterBossId`) so the player can prepare from the first card. Skip/tags are **deferred by design** (GDD §8.2) — do NOT add a skip button.

### 2.4 Play Screen
Already specced (`docs/UI_DESIGN.md`, `docs/mockups/play-screen.html`). Additions:
- **Joker tooltips** with live scaling values (global pattern §0); shelf tooltips open **downward** (playtest-03 E-7).
- **Per-tile `+N` score popups** during settle (§0); joker wiggle + contribution popups (playtest-02 B).
- **Sidebar** (playtest-03 E-9, ref `docs/reference/balatro/RoundInfoUI.png`): stage banner (Draft/Revision/Deadline) + ❄target + reward `$$$`; round score; large **0 × 0** box; the **selected-tile status text** (letter-hand name / "not a word" / suit name) renders as plain text **above the 0×0 box** (no floating info near the hand); **Run Info** and **Options** buttons; phase & discard counts; `$` fee; **Chapter N/8**.
- **No cash-out button** — the blind auto-settles (GDD §7.2).
- **Unified board** (E-5): tray + hand are one continuous board; only the joker/consumable shelves have a dark translucent panel, with `N/max` counts under them (E-6). Sort buttons sit in the Play/Discard cluster (E-8). Play word = blue, Discard = red (playtest-02 C-5).
- **Pouch widget** (bottom-right) → **bottom drawer** per §2.8.

### 2.5 Fee Settlement (blind end; playtest-03 A)
Reached automatically on auto-settle. Direct mapping to GDD §9.1 — line-item settlement, revealed line by line with count-up:
```
FEE SETTLEMENT: $8
Clear reward .......... $3~5   ($$$ icons)
3 remaining phases (each $1) .. $3
Interest ($1 per $5, max 5) ... $1
```
Big gold banner button confirms and transitions to the Stationery Shop.

### 2.6 Shop (Stationery Shop)
Left rail: **Next Blind** (red) + **Reroll $N** (green, escalating). Main column, top → bottom (playtest-04 D-2): **owned jokers + consumables shelf → items for sale → vouchers & packs**. The owned shelf is the **same component/position as the play screen** (D-1); clicking an owned joker opens a **Sell $N** menu to its right, consumables a Use/Sell menu. Tooltips per §0.
- **Wide Shelf voucher** grows the item-slot count **immediately** this same visit (D-6/B-2) — a new item fills the extra slot.
- **Sticker Pack** joker choices are **greyed / non-selectable when joker slots are full** (D-5), with a "joker slots full" note.
- Voucher slot rules per GDD §9.2 (reroll-immune, one purchase per chapter, restocks at Deadline).
- **Shop mascot:** **삐약이 (Piyak)**, a pixel-art **tuxedo cat proprietor**, sits at the bottom of the left rail (behind-the-counter feel), not overlapping the slots. Idle animation (single-sprite CSS breathe) + a speech bubble showing one random `mascot.welcome.*` line per shop entry, per UI_DESIGN §6. Purchase/reroll reactions are a later layer. Art: `docs/Piyak.png` → `src/ui/assets/piyak.png`.

### 2.7 Run End (Game Over / Published)
One screen, two framings on `gameover.won`: **loss** — red "Game Over", defeated-by panel; **win** — gold "출간 완료!/Published!", final-Deadline record panel; stats/seed/actions shared. A future **endless mode** button will join the action row (routing into Fee Settlement → shop; planned, not implemented). **우땅 (WooDak)**, the orangutan mentor mascot, stands beside the card (hidden ≤720px) with a speech bubble: discovery mention (`{n}` new words) → stat-based tip → random tip; a congratulation leads on a win. Idle = shared single-sprite breathe + slow sway. Art: `docs/WooDak.png` → `src/ui/assets/woodak.png`. Stats panel, translated to our terms:
- Best word (score + the word itself) · Most played pattern (e.g. "Transitive (16)")
- Words played · Tiles discarded · Items bought · Rerolls used
- **New discoveries: N** (ties into the collection tracking already shipped)
- Defeated by: boss badge · Chapter / stage reached
- **Seed + Copy button** (engine seed makes runs reproducible)
- Buttons: New Run · Main Menu. (The run-summary quip is now 우땅's speech bubble — see above.)

### 2.8 Pouch widget + centered modal (보따리)
**Persistent pouch widget** bottom-right: a pouch illustration + `remaining/total` text that updates on every draw/discard. **Hover** opens a **centered modal** (playtest-04 D-3, supersedes the bottom drawer); a grace timer bridges widget↔modal so it never flickers. While open, the hand + button cluster **slide down** to make room and restore on close. The modal is a wide, no-scroll layout: left = totals (vowels/consonants, materials, fonts); main = the A–Z grid showing **remaining tiles only** (playtest-04 item 1; no full-pouch toggle).

**Remaining-count definition (D-1):** `remaining` = the undrawn pouch (`blind.bag`) only — tiles in hand, played, or discarded have left the pouch.

**Remaining-count definition (D-1):** `remaining` = the undrawn pouch (`blind.bag`) **only** — tiles in hand, played, or discarded have left the pouch.

### 2.9 Collection (도감)
**Root screen = category button menu** (not tabs — too many categories): each button shows `discovered/total` and a `!` badge for new finds. Consumable families group visually into a sub-panel (like the reference's grouped box). Each category opens its own screen using the shared grid card + pagination patterns (§0).

| Category | Contents | Notes |
|---|---|---|
| **Words** | discovered words as tile-styled entries, `N/total`, filter by suit & length, paginated | our unique category; data already tracked |
| Jokers | all 46, rarity-ordered, paginated grid | tooltip shows full effect |
| Materials | 8 tile faces (ceramic + 7) | rendered as large pixel-art tile swatches; maps the reference's "enhanced cards" screen |
| Fonts | 5 (Futura variants) | rendered as the same letter in each style; shows each font's seal effect from `balance.ts` `fontEffects` (GDD §2.3); maps the reference's "editions" screen |
| Stationery | 9 (incl. Magnifier) | |
| Punctuation | 8 | shows which pattern each levels |
| Forbidden Books | 4 | |
| Packs | 5 pack types | Letter / Emoji / Stationery / Punctuation / Forbidden |
| Vouchers | 9 tickets | single tier — no upgraded pair slot |
| Bags | carousel detail view (bag art + description) | **[PLACEHOLDER: 1 entry]** |
| **Blinds & Bosses** | left: ante → base target table (from `balance.ts` anteBaseTargets, incl. endless rows); right: Small/Big badges + 12 boss chips + 2 finisher chips (undiscovered = `?`) | doubles as the player-facing difficulty-curve reference |

**Omitted by design (no equivalents — do not add):** Seals (their roles are absorbed into the font layer — GDD §2.3 seal-port — so no separate category) and Tags (skip/tag system deferred, GDD §8.2).

### 2.10 Options root
Buttons: **Settings · Statistics · Help · Credits** (Help = the tutorial glossary, feature-01 A-3; entries unlock as encountered). (Balatro's "deck customization" → our tile-skin customization is **[PLACEHOLDER: omit button entirely for now]**.)

### 2.11 Settings
Tabs — trimmed for a web game:
- **Game**: game speed (1/2/4 — settle-animation multiplier) · screenshake slider · reduced motion toggle (mirrors `prefers-reduced-motion`, user-overridable) · language (ko/en) · hint highlight color-blind-safe palette toggle · **"don't show tips" toggle** (kills the first-encounter tutorial popups, feature-01 A-2).
- **Graphics**: **CRT effect on/off · CRT intensity slider · CRT bloom on/off** (the pixel-art/CRT finish is now core identity — the reference build exposed exactly these; see UI_DESIGN §"Surface language") · pixel-perfect/integer-scale toggle.
- **Video**: fullscreen toggle · UI scale slider. (No monitor select/VSync — web.)
- **Audio**: master / music / SFX sliders with value badges — these drive the **live Web Audio mixer** (`src/ui/audio.ts`, feature-01 B). **Phase 1 ships SFX** (chiptune, fully synthesized — no asset files; the facade is the swap seam, see `assets/AUDIO_LICENSES.md`); the context unlocks on the first user gesture (autoplay policy) and settle-sequence SFX scale with the game-speed setting. **BGM is Phase 2 (still pending)** — the `music` slider is wired to the mixer bus but has no track to attenuate yet.

### 2.12 Statistics
Left column: Best word score · Highest ante/blind reached · Most played pattern · Most gold held · Wins/streak.
Right column: overall progress % — Collection %, Challenges **[PLACEHOLDER 0/0, hidden until challenges exist]**, stake wins **[PLACEHOLDER]**.
Sub-screen **Word/Joker stats** (reference: per-card bar chart): per-joker "blinds completed while owned" bar chart **[PLACEHOLDER: ship data hooks only, screen later]**.

## 3. Build notes

- All new screens are pure UI over existing engine state; no new game rules are introduced by this spec. Anything not in the engine yet (profiles, challenges, audio) ships as stubs behind the flagged placeholders.
- **Screen transitions — canonical (playtest-05 B; supersedes the E-1 "wipe").** One shared component (`src/ui/components/ScreenTransition.tsx`) drives every screen change. Reference feel: **Animal Crossing**.
  - **Type:** Overlay wipe — the outgoing panel stays fixed while the incoming panel swipes over it (masked). The outgoing tree stays *mounted under its original key* so it never remounts or re-runs effects; it renders frozen at its last props.
  - **Axis & direction — UNIFIED: horizontal, right-to-left.** New screens slide in from the **right, moving left**. Strict X-axis translation; no diagonal.
  - **Edge:** hard, pixel-crisp — no gradient/alpha fade. A dark, narrow, near-zero-blur semi-transparent shadow sits just off the leading edge to make the Z-depth step read.
  - **Z-order:** hierarchical — the incoming screen renders over the outgoing one.
  - **Curve:** Ease-Out Back (`cubic-bezier(.34,1.56,.64,1)`) — decelerates hard, **overshoots** the target, settles back. Never linear.
  - **Performance:** CSS `transform: translateX` on a GPU-composited layer; never per-frame React re-renders. The transform must **not** persist after the slide (`animation-fill-mode: backwards`, not `forwards`) or the panel stays a containing block for its `position: fixed` descendants.
  - **Applies to:** all screen swaps (menu↔run, blind→blind, →shop). **Exception:** Fee Settlement and Game Over are *overlays* on the still-visible board, not screen swaps (§2.4, playtest-04 A-2/A-4) — they keep the board's key and play no slide.
  - **Reduced motion:** `prefers-reduced-motion` replaces the slide+overshoot with a plain crossfade.
- Every string through i18n (ko/en) from day one.
- Priority order: **2.5 Cash Out → 2.6 Shop → 2.3 Blind Select → 2.7 Game Over → 2.2 New Run → 2.1 Main Menu → 2.8 Bag View → 2.9 Collection → 2.10–2.12 Options/Stats**. (The first four complete the run loop; the rest are shell.)
