# Play the Wor!d — Screen Inventory & Flow Spec

Derived from 18 Balatro reference screenshots. **The screenshots are layout/flow reference.** All visual language (colors, type, surfaces, motion) comes from `docs/UI_DESIGN.md` — now a **pixel-art / CRT aesthetic** in the Balatro lineage (the earlier "ceramic, un-Balatro" identity and its trade-dress guardrail are retired). Adopt the pixel-art idiom, CRT post-effect, and screen grammar freely; only avoid copying Balatro's *specific* art assets (its actual card illustrations, logo, exact sprites). Where a Balatro concept has no equivalent yet in our game, the screen ships as a **[PLACEHOLDER]** with minimal stub content, to be filled later.

## 0. Global UI patterns (recurring across screens)

- **Tab pills** along the top for sectioned screens (settings tabs, collection tabs); active tab marked with a small arrow indicator above.
- **Back button**: full-width gold bar pinned at the bottom of every sub-screen.
- **Carousel selector** `< value >` for enumerated options (deck, stake, window mode).
- **Slider + value badge** for continuous options (volume, screenshake).
- **Card tooltip — universal, no exceptions.** Hovering **any** interactive object anywhere opens an anchored tooltip: Emoji Tiles, consumables, letter tiles, vouchers, packs, **and every item revealed inside an opened pack**. Contents: name, full effect text, and — for scaling Emoji Tiles — the **current grown value** (e.g. "currently ×1.5") and for letter tiles the material/font/edition each spelled out. One shared component; a surface that renders objects without wiring it is a bug, not a gap. **Every tooltip is portalled to `document.body` and uses the highest UI layer. It must never be clipped, covered, or trapped by a product panel's overflow/stacking context.**
  - **Hover feedback accompanies it:** anything that shows a tooltip also reacts to the cursor (lift/scale + shadow), so hoverability is discoverable without hunting.
  - **Pointer hit boxes stay stable:** cursor tilt uses the untransformed entry rectangle for the full hover and letter tiles do not translate their actual hit target. A stationary cursor on a tile boundary must not cause leave/re-enter flicker. Tile faces also keep overflow visible; material sheen is clipped internally, never by clipping the tile root, so material/font/edition tags and score popups remain intact.
  - **The tooltip never inherits its subject's styling.** Tooltip text always uses the standard UI face at full contrast — a Light Italic tile does *not* get a thin italic tooltip, a dark-material tile does not get dark tooltip text. The tooltip describes the object; it does not imitate it. (Playtest: the Light Italic tooltip was unreadable for exactly this reason.)
  - **Axis-name emphasis (changed 2026-07-29):** material and font names inside letter-card tooltip descriptions use the shared gold/dark-gold emphasis treatment at a slightly larger, heavier size; the effect sentence remains normal body copy.
- **Pagination carousel**: long grids page with a `< Page N/M >` pill control (jokers, words).
- **Collection grid card**: shared component — discovered = full render + tooltip on hover; undiscovered = silhouette/back-face, no tooltip. Voucher, Fable, Constellation, and Gambler cards share a subtle idle float/sway and cursor-position 3D tilt with moving sheen; reduced-motion settings freeze both.
- **New-discovery badge**: category buttons and the main-menu Collection button show a `!` badge when they contain undiscovered-then-found items since last view.
- **Score popups**: during word settle, each tile pops a small `+N` chip-blue tag above it as it scores (adds to the juice spec, UI_DESIGN §4 step 1).

## 1. Screen flow map

```
Main Menu ─ Play ─→ New Run ─→ PERSISTENT RUN TABLE
                                      ├─ Blind work panel
                                      ├─ Fee Settlement overlay
                                      ├─ Shop / Pack panel
                                      └─ Blind-select panel
    │                                   ↑                                        │
    │                                   └────────────── next blind ←─────────────┘
    │                                   (loss) → Game Over → New Run / Main Menu
    ├─ Collection (도감)
    └─ Options ─┬─ Settings (Game / Video / Audio tabs)
                ├─ Statistics (+ per-joker stats [PLACEHOLDER])
                └─ Credits
Persistent in-run surfaces: sidebar · Emoji Tile/consumable shelves · pouch
In-run overlays: Run Info · Fee Settlement · pause menu
```

## 2. Screens

### 2.0 Loading screen (asset preload)

Shown once on app start, before the Main Menu. The build now carries real weight — pixel art, 24 pack illustrations, mascot sprites, and (after feature-01 B) an audio bundle — so a blank first paint is no longer acceptable.

- **Preloads only first-interaction assets** (fonts, the active WooDak sprite, pouch,
  and first Draft emblem) and reports **real progress**, not a fake timer. Collection
  galleries and pack/card art load on demand; never eager-import the complete art
  registry, because cold deployments otherwise download and decode tens of MB before
  play begins.
- Pixel-grammar progress bar + the title logotype; a mascot may idle here (WooDak — this is a natural first-contact beat, and it is *not* a tutorial step).
- **Respects the monochrome start (§13 Chromatic Unlocks):** on a fresh profile the loading screen is greyscale too, or the world's first color would leak before it is earned.
- Under the CRT pass like every other screen. Falls through immediately when assets are already cached — never add artificial delay.
- **Audio caveat:** decoding may begin here, but playback still cannot start until the first user gesture (feature-01 B-3), so the loading screen stays silent by design.

### 2.1 Main Menu
Title treatment (our own logotype), buttons: **Play · Options · Collection · Quit**. Quit shows on all builds: it attempts `window.close()` (works in a desktop shell / script-opened window) and always swaps the menu for a full-screen farewell ("Thanks for playing!"), so a normal browser tab that can't self-close still ends cleanly (2026-07-22). Profile chip bottom-left **[PLACEHOLDER: single profile "P1"]**, language toggle bottom-right (ko/en — i18n already shipped). Collection button badges a `!` when new words/jokers were discovered last run.

### 2.2 New Run
Top tabs: **New Run · Continue · Challenges**. **Continue resumes the saved run** (playtest-06): the run is persisted to `localStorage` (`wj.run`, via `src/ui/persist.ts`) on every state change, so it survives both leaving to the main menu and a page reload. The tab greys out when there is no run or the run ended (game over), and is **default-selected when a run exists** so hitting Play never wipes it by accident. Only a *resting* snapshot is saved — settle-animation fields are stripped, since the settle replays from a per-submission `ScoreEvent` log that cannot be resumed mid-flight. The save is versioned; a schema-mismatched or corrupt save is **discarded, not migrated**. Challenges **[PLACEHOLDER: hidden]**. Below, two stacked carousels + play:
- **Bag select** carousel **[PLACEHOLDER: one entry — "Standard Bag", 68 tiles]** (GDD §2.1; the 98→68 rebalance, playtest-04 C-2). Card-style preview + description panel. Structure ships now so future bags (GDD §12 starting decks) slot in.
- **Stake select** carousel **[PLACEHOLDER: one entry — "White Stake", no modifiers]** (GDD §12 stakes deferred).
- **Seeded run** toggle + seed input (engine already supports `RunState.seed`).
- Big blue **Play** button.

### 2.3 Blind Select (before each blind; changed 2026-07-28)
The persistent sidebar, owned shelves and pouch remain mounted. Its blind badge reads “Choose the next blind” in a larger type size, centred geometrically in the full badge rather than sharing flow with the decorative caret. The shop panel exits downward and the Draft/Revision/Deadline cards rise from below. The transition layer clips its leaving transform instead of becoming a temporary scroll container, so selecting a blind never flashes a horizontal or vertical scrollbar. All non-current cards, including the content-heavy upcoming Deadline card, have the same fixed height. Only the current card is materially taller, uses a 5px accent-colour border plus an outer accent ring, and enlarges its blind title; opacity alone is not sufficient emphasis. A current Deadline card reserves additional vertical space for its boss-reroll control, so the control never overlaps boss content or the select action. The stage-selection heading sits above the raised current card with a larger font and reserved gap, so an emphasized Revision card cannot cover it. Selecting the card sends the cards downward, then deals the hand and reveals play/sort/discard controls. Target and reward preview remain unchanged. The **Deadline boss always shows its effect text** (playtest-04 D-6) — no hiding, no `?`. The chapter's boss is drawn at chapter start (`run.chapterBossId`) so the player can prepare from the first card. A Sketch Book/Portrait boss-reroll control appears and accepts input only when that Deadline card is the **current** blind; the earlier Draft/Revision screens may preview the boss but cannot reroll it. Skip/tags are **deferred by design** (GDD §8.2) — do NOT add a skip button.

### 2.4 Play Screen
Already specced (`docs/UI_DESIGN.md`, `docs/mockups/play-screen.html`). Additions:
- **Joker tooltips** with live scaling values (global pattern §0); shelf tooltips open **downward** (playtest-03 E-7). Scaling Emoji Tiles always append a centred current-value row inside the white effect plate—even before their first trigger—formatted as `(현재 ×1 배수)` or `(현재 +0 칩)` with the value using the corresponding Mult/Chips colour.
- **Per-tile `+N` score popups** during settle (§0); joker wiggle + contribution popups (playtest-02 B).
- **Sidebar** (playtest-03 E-9, ref `docs/reference/balatro/RoundInfoUI.png`): stage banner (Draft/Revision/Deadline) + ❄target + reward `$$$`; round score; large **0 × 0** box; the **selected-tile status text** (letter-hand name / "not a word" / suit name) renders as plain text **above the 0×0 box** (no floating info near the hand); **Run Info** and **Options** buttons; phase & discard counts; `$` fee; **Chapter N/8**.
- **No cash-out button** — the blind auto-settles (GDD §7.2).
- **Deadline entry reveal (changed 2026-07-29):** trigger only when the Deadline board actually enters `playing`, never while its card is visible on Blind Select. Continuing a saved run already inside that boss blind triggers the reveal again. Show the boss emblem, localized name, and full debuff text in a centred card whose height is **150% of the prior reveal**; once the entrance lands, hold it for **1 second**, then remove it with a lift/fade-out. It is informational and non-blocking; reduced motion removes the flourish.
- **Unopened Letter feedback (changed 2026-07-29):** after each hand play, the exact seeded-random tiles removed by the boss (up to four) visibly lift from the hand area one by one and fly into the discard direction while replacements settle. The animation is presentation-only; the engine-reported tile list is authoritative.
- **Zero-score boss feedback (changed 2026-07-29):** when the staged word will be debuffed to 0, every staged tile carries a red **Not Allowed** tag. The Play action remains available. Submitting briefly shows a text-only white `Not Allowed` notice at the top centre of the workspace, using the title face at a materially larger size; it fades away automatically instead of persisting as a normal toast. The resulting tray word stays desaturated/dashed so the wasted play remains legible.
- **Unified board** (E-5): tray + hand are one continuous board; only the joker/consumable shelves have a dark translucent panel, with `N/max` counts under them (E-6). Sort buttons sit in the Play/Discard cluster (E-8). Play word = blue, Discard = red (playtest-02 C-5).
- **Unified owned-card sizing (changed 2026-07-30):** shop offer stages, Emoji Tiles, held-consumable slots, and vertical vouchers share a rounded `124×165px` runtime footprint. Packs are the exception: sale packs use the requested older `131×229px` foreground and matching 131px row slots with a 12px gap; their panel reserves 84px below the row so Open is not clipped. Collection packs use `81×132px`; all pack art has square corners. Consumables remain in a 286px panel; the Emoji Tile panel takes the remaining shelf width with exactly 10px between panels. Empty positions have no placeholder. Owned Emoji Tiles use one fixed 12px inter-slot gap and the complete group is centred; when cards exceed available width, equal-width wrappers compress so the fixed-size cards progressively overlap. Hovered/focused/dragged cards rise above neighbours. Both panels share a fixed 187px outer height. The main `.frame` is transparent, and the board design height keeps the tray/stage/action layout docked to the viewport bottom.
- **Shared rail surface and shop baseline (changed 2026-07-30):** the Emoji Tile and consumable panels use the exact dark translucent background/edge tokens from the Run Info sidebar. The shop phase panel bottom-aligns its complete layout with zero bottom padding, so its lower edge lands on the same baseline as the sidebar.
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
The modal is centred on the **physical viewport**, not on the main play column; the
persistent left rail must not shift it sideways.

### 2.6 Shop (Stationery Shop; changed 2026-07-28)
The completed blind does not navigate away. The persistent sidebar resets round score, Chips, Mult, hands and discards to zero and changes its blind badge to a large, centred marquee **SHOP** sign with a restrained idle glow/bulb cycle. The SHOP badge stretches to the full inner width of the shop sidebar. The score reset is immediate: the consumed settle log/id, finalized-score fields, and sentence-bonus fields are cleared before the shop's first frame, and the count-up hook snaps to zero instead of replaying the last blind's score. Owned Emoji Tiles, consumables and the pouch remain in place. A lower shop panel rises in this order: **Next Blind → Reroll → items for sale → voucher → packs**. The three selling panels—items, voucher, and packs—centre their live offers with equal spacing and symmetric balance. Sold entries leave layout entirely, and every affected panel immediately recentres its remaining offers. Selecting an offer raises its complete product/price/action interaction owner by 59px (15px base + 44px action height), so the visible object and its hit-test geometry remain identical, and attaches its primary Buy/Redeem/Open button 8px directly below the actual foreground object. When available, **Use now** is the exception: it appears vertically centred 12px outside the product's right edge while Buy remains centred below. Buy and Use-now actions have a minimum 44px hit height. Card selection and its revealed action are separate buttons, so Redeem cannot toggle the card instead of firing. Tooltips are body-portalled per §0 and therefore do not depend on sale-panel overflow or stacking.
- **Catalog/Coupon Book vouchers** grow the item-slot count immediately in the same visit; each newly opened slot is filled without rerolling existing stock.
- A full consumable shelf disables **Buy** on consumable offers but leaves **Use now** available for affordable non-tile consumables; instant use never occupies a resting slot.
- Selecting a sale card keeps its purchase control attached below the card; when **Use now** is available, Buy stays below and Use now appears outside the card's right edge. Shop item ids and pack type/size pairs are unique within each stock roll. Shop-offered tile-targeting and blind-only Fables are Buy-only: they enter a held slot and cannot be used until a blind.
- **Charm Pack** emoji-tile choices are **greyed / non-selectable when joker slots are full** (D-5), with a "joker slots full" note.
- Voucher slot rules per GDD §9.2 (reroll-immune, one purchase per chapter, restocks at Deadline).
- **Shop mascot:** **삐약이 (Piyak)**, a pixel-art **tuxedo cat proprietor**, sits at the bottom of the left rail (behind-the-counter feel), not overlapping the slots. Idle animation (single-sprite CSS breathe) + a speech bubble showing one random `mascot.welcome.*` line per shop entry, per UI_DESIGN §6. Purchase/reroll reactions are a later layer. Art: `docs/Piyak.png` → `src/ui/assets/piyak.png`.

### 2.6.1 Pack opening (persistent-table panel)

Opening a pack sends the shop panel downward and replaces only the lower work panel; the persistent sidebar, owned shelves and pouch never unmount (changed again 2026-07-28; both the earlier overlay and dedicated screen are retired). Balatro's layout is the reference: **contents fan out large and centred, one clear action, no other UI competing.**

- **Layout:** pack contents fan across the centre as widened, image-first selection objects. A five-card fan uses a responsive five-column grid inside a widened, overflow-visible work panel: neither end cards nor their above-card tooltips may be clipped, and opening a pack must not create horizontal scrolling. The item art fills the whole choice footprint; names/effects stay in the tooltip, including live values such as The Heavenly Maiden and the Woodcutter's current Charm sell payout. A Tile-Pack choice uses a square footprint fitted to its tile image instead of inheriting the tall 5:7 consumable-card ratio. Tile-Pack and Charm-Pack **Select** actions are hidden until their stable choice shell is hovered or keyboard-focused. Every pack Select/Use action has a minimum 44px hit height. Every pack action is a sibling of—not a child of—the cursor-tilting card, and preserves its centring transform during active/disabled states, so pointerdown cannot move the button out from under pointerup. A Fable Pack first deals ten seeded tiles from the current pouch as the immediately active candidate field for tile-targeting Fable effects; random Fable choices appear with them. A revealed Fable has no button at rest. Selecting the card outlines it and reveals **Use** below; Use stays disabled until one to the effect's listed maximum valid candidates is selected for a tile-targeting effect, while a non-tile effect ignores candidate selection and never marks candidate tiles during its animation. A compatible targeting Fable already on the persistent consumable shelf can use the same candidate selection while the pack is open. Its enabled and disabled states use the same fixed button position. Pressing Use casts from the card onto every selected target tile; the target visibly changes letter/material/font/edition as applicable, remains in that committed appearance when the preview ends, and the complete animation plays before a 0.5-second result hold and pack close/reflow for a dealt card. Blind-only Fables reveal **Select** instead of Use and enter a held slot for later use; they do not gain a separate tooltip classification. Constellations use the same select-then-confirm structure, but always reveal **Use**, level the mapped pattern immediately, and ignore held-slot capacity. Current pack information and Skip sit along the bottom. The pick counter is explicit — "Pick 1 of 3" / "Pick 2 of 5" (§9.3 sizes) —and decrements only when Use/Select resolves.
- **Skip:** a single, always-available Skip button. Packs may be left unpicked; unpicked contents are discarded.
- **Selection feedback is mandatory** (playtest: selecting an item currently does nothing visible): the chosen card lifts and pulses, gains a selected outline, the counter ticks down, and a confirm SFX fires. When the last pick is spent the overlay closes on a short beat, not instantly.
- **Every revealed item is hoverable with a full tooltip above the card** — see §0. Pack-choice tooltips never open beneath the revealed card.
- **Blocked picks read clearly:** when a choice cannot be taken (Emoji Tile slots full, §2.6), it greys with a reason label rather than failing silently on click.
- Under the CRT pass; respects reduced motion (fan appears without the flight animation).

During word settlement, contribution beats run at **600ms per tile/effect at 1× speed** (rolled back from 800ms on 2026-07-29). Order is whole-word stamps → each played tile with its own enhancements and tile-triggered Emoji effects → global Emoji Tile list → held tiles frozen in visible play-time order → future consumable hooks → global/boss beats. The current tile lifts and bounces on every contribution. The settle-complete signal derives from this same cadence; 2×/4× game speed still scale it rather than introducing a second timer. Enhanced tile triggers repeat their Chips/Mult/gold/retrigger value above the source tile.

The secondary material/font tooltip title is larger, bold, and gold so it is immediately clear which referenced axis the additional explanation belongs to. Font-effect copy phrases its capacity condition positively (“when a consumable slot is empty” / “소모품 슬롯이 비어있는 경우”).

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
**Root screen = centred category modal** (not tabs — too many categories): a framed two-column menu uses thick red buttons and a full-width orange Back bar, following the reference layout. Each button shows `discovered/total` and a `!` badge for new finds. Button height is proportional to a normalized estimate of the category's visible content rows; the two columns have equal total weight. Each category opens a content-sized detail modal using the shared grid card + pagination patterns (§0), so short categories no longer inherit the Words view's height. Mobile collapses the menu to one column.

| Category | Contents | Notes |
|---|---|---|
| **Words** | discovered words as tile-styled entries, `N/total`, filter by suit & length, paginated | our unique category; data already tracked |
| Jokers | all Emoji Tiles, rarity-ordered, paginated **5×3 grid (15 per page)** | image-only `124×165px` runtime frame, exactly matching the in-run card size (84×112 pixel masters scale with nearest-neighbour rendering); its detail modal removes the redundant outer padding and never shows an internal scrollbar; no wrapper or rarity border; shared idle float and cursor tilt/sheen; tooltip shows name, rarity, and full effect |

All 116 Emoji Tile images use the shared `jokerArt` resolver on every rendered
surface.
| Materials | 9 tile faces (base + 8 enhanced, including Wood) | rendered as large pixel-art tile swatches; maps the reference's "enhanced cards" screen |
| Fonts | 5 (Futura variants) | rendered as the same letter in each style; shows each font's seal effect from `balance.ts` `fontEffects` (GDD §2.3); maps the reference's "editions" screen |
| Vouchers | 32 tickets | 16 base/upgraded pairs; four pairs per page; locked upgrades show only “Undiscovered” and the unseeded-run discovery hint — no name, effect, condition, or progress |
| **Fable Cards** | 18 implemented cards | supplied pixel art normalized to the shared `500×700` 5:7 SVG surface, in a 5-column, 10-per-page gallery; hover shows the full effect |
| **Constellation Cards** | 12 implemented zodiac cards | supplied monochrome pixel art normalized to the same `500×700` path-only SVG surface and 5-column, 10-per-page gallery; hover shows the mapped sentence pattern |
| **Gambler Cards** | 14 artworks; 12 effects confirmed, 2 pending; engine pending | supplied artwork normalized to the same `500×700` path-only SVG surface and 5-column, 10-per-page gallery; until the registry is implemented, hover continues to mark runtime effects as pending |
| Packs | Tile 8 · Charm 4 · Constellation 8 · Ink 4 | image-only paged gallery; all 24 supplied artworks use a shared `244×400` path-only SVG canvas plus the common idle and cursor tilt/sheen, with no persistent type/grade/coming-soon labels; hover or keyboard focus restores the shared type/description/grade tooltip |
| **Palette** | 11 chromatic unlocks (feature-02 C) | locked = grey silhouette + letter-count hint ("R _ _"); unlocked = the word in its group color |
| Mascots | WooDak skin roster | **primary skin picker** (moved from Settings 2026-07-29): one horizontal, centred, non-wrapping card row; locked skins use non-selectable silhouettes; unlocked cards have tooltip + cursor tilt/sheen, select on click/keyboard, and mark the equipped skin with a gold outline and Selected label |
| Bags | carousel detail view (bag art + description) | **[PLACEHOLDER: 1 entry]** |
| **Blinds & Bosses** | left: ante → base target table (from `balance.ts` anteBaseTargets, incl. endless rows); right: Small/Big badges + 12 boss chips + 2 finisher chips (undiscovered = `?`) | doubles as the player-facing difficulty-curve reference; boss cards retain their tooltip and use shared cursor tilt/sheen |

Fable reports `18/18`, Constellation reports `12/12`, and Gambler reports `14/14` supplied artworks. Twelve Gambler effects are confirmed in GDD §10.3; Rainman and Sake Cup remain pending. The family's engine registry and acquisition (Ink Pack, Comic-Book-gated Fable mixing, and Deer in Constellation Packs) remain unimplemented even though its Collection artwork is visible.

**Omitted by design (no equivalents — do not add):** Seals (their roles are absorbed into the font layer — GDD §2.3 seal-port — so no separate category) and Tags (skip/tag system deferred, GDD §8.2).

### 2.10 Options root
Buttons: **Settings · Statistics · Help · Credits** (Help = the tutorial glossary, feature-01 A-3; entries unlock as encountered). (Balatro's "deck customization" → our tile-skin customization is **[PLACEHOLDER: omit button entirely for now]**.)

### 2.11 Settings
Mascot selection does not live here. It is owned by **Collection → Mascots**, so
discovery, inspection, and equipping share one surface.
The standalone screen and the in-run pause version are centred on the physical
viewport in fullscreen as well as windowed mode. In-run Options is portalled outside
the zoomed board root so fullscreen/UI scaling cannot pull it toward the top.
Tabs — trimmed for a web game:
- **Game**: game speed (1/2/4 — settle-animation multiplier) · screenshake slider · reduced motion toggle (mirrors `prefers-reduced-motion`, user-overridable) · language (ko/en) · hint highlight color-blind-safe palette toggle · **"don't show tips" toggle** (kills the first-encounter tutorial popups, feature-01 A-2).
- **Graphics**: **CRT effect on/off · CRT intensity slider · CRT bloom on/off** (the pixel-art/CRT finish is now core identity — the reference build exposed exactly these; see UI_DESIGN §"Surface language") · pixel-perfect/integer-scale toggle.
- **Video**: fullscreen toggle · UI scale slider · **"reveal all presentation" toggle** (chromatic-unlock override, feature-02 C-4 — unlocks every color/audio now; the first real play of a word still fires its celebration + Palette record once). The fullscreen toggle mirrors the browser's actual `fullscreenElement`; when ESC exits fullscreen externally, the toggle immediately synchronizes to Off. (No monitor select/VSync — web.)
- **Audio**: master / music / SFX sliders with value badges — these drive the **live Web Audio mixer** (`src/ui/audio.ts`, feature-01 B). **Phase 1 ships SFX** (chiptune, fully synthesized — no asset files; the facade is the swap seam, see `assets/AUDIO_LICENSES.md`); the context unlocks on the first user gesture (autoplay policy) and settle-sequence SFX scale with the game-speed setting. **BGM is Phase 2 (still pending)** — the `music` slider is wired to the mixer bus but has no track to attenuate yet.

### 2.12 Statistics
Left column: Best word score · Highest ante/blind reached · Most played pattern · Most gold held · Wins/streak.
Right column: overall progress % — Collection %, Challenges **[PLACEHOLDER 0/0, hidden until challenges exist]**, stake wins **[PLACEHOLDER]**.
Sub-screen **Word/Joker stats** (reference: per-card bar chart): per-joker "blinds completed while owned" bar chart **[PLACEHOLDER: ship data hooks only, screen later]**.

## 3. Build notes

- All new screens are pure UI over existing engine state; no new game rules are introduced by this spec. Anything not in the engine yet (profiles, challenges, audio) ships as stubs behind the flagged placeholders.
- **Persistent in-run table (changed 2026-07-28).** `ScreenTransition` is retired from blind↔shop↔pack↔blind-select changes and remains available only for shell navigation such as menu↔run.
  - **Panel direction:** phase panels enter from below and leave toward the bottom. Use Ease-Out Back for entry and a short ease-in for exit.
  - **Performance:** CSS transforms on the panel wrapper; never per-frame React re-renders. Action resolution waits for the exit beat so an unmount cannot cut it off.
  - **In-run motion:** lower panels enter upward and leave downward. Sidebar, owned shelves, Run Info access and pouch remain mounted. Fee Settlement and Game Over remain overlays.
  - **Reduced motion:** `prefers-reduced-motion` removes panel travel.
- **Panel and board animations are sequential.** Blind cards leave downward before the hand draw and play/sort/discard controls enter. Pack contents begin only after the shop panel has left.
- Every string through i18n (ko/en) from day one.
- Priority order: **2.5 Cash Out → 2.6 Shop → 2.3 Blind Select → 2.7 Game Over → 2.2 New Run → 2.1 Main Menu → 2.8 Bag View → 2.9 Collection → 2.10–2.12 Options/Stats**. (The first four complete the run loop; the rest are shell.)
