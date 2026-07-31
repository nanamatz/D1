# Play the Wor!d — Screen Inventory & Flow Spec

Derived from 18 Balatro reference screenshots. **The screenshots are layout/flow reference.** All visual language (colors, type, surfaces, motion) comes from `docs/UI_DESIGN.md` — now a **pixel-art / CRT aesthetic** in the Balatro lineage (the earlier "ceramic, un-Balatro" identity and its trade-dress guardrail are retired). Adopt the pixel-art idiom, CRT post-effect, and screen grammar freely; only avoid copying Balatro's *specific* art assets (its actual card illustrations, logo, exact sprites). Where a Balatro concept has no equivalent yet in our game, the screen ships as a **[PLACEHOLDER]** with minimal stub content, to be filled later.

## 0. Global UI patterns (recurring across screens)

- **Tab pills** along the top for sectioned screens (settings tabs, collection tabs); active tab marked with a small arrow indicator above.
- **Back button**: full-width gold bar pinned at the bottom of every sub-screen.
- **Carousel selector** `< value >` for enumerated options (Starting Pouch,
  Record, window mode).
- **Slider + value badge** for continuous options (volume, screenshake).
- **Button feedback (changed 2026-07-31):** every enabled UI button visibly enlarges on pointer hover and presses downward while held. The shared effect composes with each component's existing transform, so centred actions, card buttons, and icon controls never lose their positioning. Disabled buttons do not react.
- **Card tooltip — universal, no exceptions.** Hovering **any** interactive object anywhere opens an anchored tooltip: Emoji Tiles, consumables, letter tiles, vouchers, packs, Starting Pouches, Records, Tags, **and every item revealed inside an opened pack**. Contents: name, full base effect text, and — for scaling Emoji Tiles — the **current grown value** (e.g. "currently ×1.5"). Enhancement names remain coloured footer tags. With one supplemental definition it opens on the left. With two or three, exactly one definition folds into the main effect plate and the rest remain on the left; the fold priority is **material → font → edition**. Letter tiles use this for material/font/edition; Emoji Tiles use it for non-base editions. Any effect description that names a tile font automatically adds that font's canonical effect tooltip. A Record tooltip describes that level's added penalty and marks the ladder as cumulative. One shared component; a surface that renders objects without wiring it is a bug, not a gap. **Every tooltip is portalled to `document.body` and uses the highest UI layer. It must never be clipped, covered, or trapped by a product panel's overflow/stacking context. Left-side supplements keep that placement regardless of the main tooltip's up/down direction.** *(Changed 2026-07-31: multi-definition folding prevents a three-card side stack from obscuring the board.)*
  - **Reference proportions (changed 2026-07-31):** the shared image-like frame uses mint pixel edges, a charcoal scanlined shell, a pale inset description plate, and cyan/magenta title separation. Main width scales from 210–280px according to content, supplemental cards are approximately 64% of the main width, and every footer/enhancement tag is 72% of the main width. Heights remain content-driven within those proportions so Korean/English copy wraps without stretching a raster asset.
  - **Description face (changed 2026-07-31):** main and supplemental description plates use bundled Jost 700 with Noto Sans KR 700 fallback, compact tracking, and restrained cyan/magenta separation. This keeps Korean readable offline while giving effect copy the printed arcade tone of the reference.
  - **Hover feedback accompanies it:** anything that shows a tooltip also reacts to the cursor (lift/scale + shadow), so hoverability is discoverable without hunting.
  - **Pointer hit boxes stay stable:** cursor tilt uses the untransformed entry rectangle for the full hover and letter tiles do not translate their actual hit target. A stationary cursor on a tile boundary must not cause leave/re-enter flicker. Tile faces also keep overflow visible; material sheen is clipped internally, never by clipping the tile root, so material/font/edition tags and score popups remain intact.
  - **Letter-tile silhouette (changed 2026-07-30):** every material uses the Ceramic tile's outer border and rounded corners. Material identity is confined to face colour, texture, internal lines, and condition glyphs.
  - **The tooltip never inherits its subject's styling.** Tooltip text always uses the standard UI face at full contrast — a Light Italic tile does *not* get a thin italic tooltip, a dark-material tile does not get dark tooltip text. The tooltip describes the object; it does not imitate it. (Playtest: the Light Italic tooltip was unreadable for exactly this reason.)
  - **Enhancement stack (changed 2026-07-31):** material, font, and edition names render as distinct coloured tags stacked beneath the letter-card tooltip. Their normal-weight definitions follow the shared count-aware layout: one stays in a left card; with two or three, the highest-priority definition folds into the main plate and the remainder stay left.
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

- **Preloads only first-interaction assets** (fonts, the active WooDak sprite,
  Yellow Pouch, White LP, and first Draft emblem) and reports **real progress**,
  not a fake timer. Collection
  galleries and pack/card art load on demand; never eager-import the complete art
  registry, because cold deployments otherwise download and decode tens of MB before
  play begins.
- Pixel-grammar progress bar + the title logotype; a mascot may idle here (WooDak — this is a natural first-contact beat, and it is *not* a tutorial step).
- **Respects the monochrome start (§13 Chromatic Unlocks):** on a fresh profile the loading screen is greyscale too, or the world's first color would leak before it is earned.
- Under the CRT pass like every other screen. Falls through immediately when assets are already cached — never add artificial delay.
- **Audio caveat:** decoding may begin here, but playback still cannot start until the first user gesture (feature-01 B-3), so the loading screen stays silent by design.

### 2.1 Main Menu
Title treatment (our own logotype), buttons: **Play · Options · Collection · Quit**. Quit shows on all builds: it attempts `window.close()` (works in a desktop shell / script-opened window) and always swaps the menu for a full-screen farewell ("Thanks for playing!"), so a normal browser tab that can't self-close still ends cleanly (2026-07-22). The four buttons keep this vertical order inside one dark CRT panel, with individual block shadows and fixed semantic colors: Play blue, Options orange, Collection green, Quit red. The bottom-left profile control is a compact dark card with a `Profile` header and inset active-profile-name button; the bottom-right language control mirrors that card and displays the currently selected language (`한국어` or `English`) without an icon. Collection badges a `!` when new words/jokers were discovered last run. (Main-menu visual refresh: 2026-07-31.)

**Profiles (changed 2026-07-31).** The profile button opens a three-slot screen matching the reference layout. P1 exists on first boot with the editable default name `P1`; P2/P3 begin empty. A slot tab only previews that slot and never changes the active profile; creating a slot also leaves the active profile unchanged. A selected non-active created slot becomes active only when the blue **Load Profile** button is pressed, which reloads the shell against that slot. The active slot instead shows a disabled **Current Profile** button and its smaller red Delete Profile button is also disabled. Selecting an empty slot shows a name field, Empty panel, Create Profile, disabled red Delete Profile, and Back. The empty and populated dashboards use the same panel dimensions and column proportions, so Create Profile matches Load Profile in both size and blue colour; Delete Profile is deliberately smaller and always red. Creating with a blank name uses `P2`/`P3`; every created profile can be renamed later. A created slot shows overall progress, four progress rows (word Collection, presentation, Starting Pouches, Record wins), lifetime wins, compact balance telemetry, profile status/load, Delete Profile, Reveal All, and Back. Balance telemetry counts only non-custom-seeded completed runs and shows recorded run count, win rate, and the Chapter with the most losses; per-Chapter loss counts remain profile-scoped in `wj.lifetime`. The eight progress save keys and profile metadata are isolated per slot while language, settings, and sort order remain machine-wide. Existing flat saves are P1. Delete Profile is available only for a non-active created slot and uses the same-button two-press warning: the first press only shows an inline destructive warning, and the second press deletes exactly the previewed slot. On the first Reveal All press, no effect is applied and a persistent per-profile warning explains the consequence. A later press fills every implemented locked/undiscovered registry in that profile and disables its Challenges; no other profile is changed. Once used, the Reveal All button is replaced by **Challenges disabled**. A profile that earns every implemented word, presentation, Starting Pouch, Record, and upgraded-voucher unlock naturally instead shows **Your world is complete**. The Reveal All button uses the same muted teal background as the main-menu profile control. The compact applied marker makes all dictionary entries read as discovered without creating fake per-word play counts or scores.

### 2.2 New Run
Top tabs: **New Run · Continue · Challenges**. **Continue resumes the saved run**
(playtest-06): `src/ui/persist.ts` writes `wj.run` through the single
`src/ui/storage.ts` persistence path on every state change (file-backed on
desktop, localStorage-backed on web), so it survives both leaving to the main
menu and a reload. The tab greys out when there is no run or the run ended (game
over), and is **default-selected when a run exists** so hitting Play never wipes
it by accident. Only a *resting* snapshot is saved — settle-animation fields are
stripped, since the settle replays from a per-submission `ScoreEvent` log that
cannot be resumed mid-flight. The save is versioned; a schema-mismatched or
corrupt save is **discarded, not migrated**. Challenges **[PLACEHOLDER:
hidden]**. Below, two stacked, non-wrapping carousel rows use the reference
layout: a tall left arrow, one central selection panel, and a tall right arrow.
The larger Pouch row sits above the compact Record row; both panels put the
object on the left, the localized title over a white effect plate on the right,
and ordered position dots below. Boundary arrows dim instead of wrapping.
Web and desktop persistence failures never crash play, but they are never
silent: a fixed highest-layer alert remains visible until a later write to that
same backend succeeds. It warns that recent progress may be lost and points to storage space
or file permissions. Desktop write health travels from the debounced atomic
save store through preload IPC; web health comes from caught localStorage writes.
- **Starting Pouch** carousel: all 14 GDD §12.2 entries in roster order.
  Unlocked entries show their object art, localized name, and complete effect.
  They show no unlock copy. Locked entries remain selectable as muted
  silhouettes with a centred lock; the panel title becomes **Locked / 잠김** and
  its white plate shows only the exact unlock condition, not the Pouch name or
  effect. The shared tooltip still identifies the Pouch and carries its full
  effect plus that condition. Play stays disabled while one is selected, and
  the Record row's navigation dims until an unlocked Pouch is selected. The
  selected art becomes the persistent in-run pouch widget.
- **Record** carousel: all 8 GDD §12.3 levels in ladder order. Locked levels are
  visible and inspectable, but disable Play. The title, added penalty, ordered
  dots, and lock state communicate the sequential ladder; **no Record unlock
  condition is written in the panel, tooltip, or Collection**. Non-base
  descriptions carry a clear **cumulative** note without repeating earlier rows.
- **Seeded run** toggle + seed input (engine already supports `RunState.seed`).
  Mark it clearly: custom-seeded wins do not unlock Pouches or advance Records.
- Seed controls sit to the left of the centred blue **Play** button; the full
  width gold **Back** bar closes the screen.

### 2.3 Blind Select (before each blind; changed 2026-07-31)
The persistent sidebar, owned shelves and pouch remain mounted. Its blind badge reads “Choose the next blind” in a larger type size, centred geometrically in the full badge rather than sharing flow with the decorative caret. The shop panel exits downward and the Draft/Revision/Deadline cards rise from below. The transition layer clips its leaving transform instead of becoming a temporary scroll container, so selecting or skipping a blind never flashes a horizontal or vertical scrollbar. All non-current cards, including the content-heavy upcoming Deadline card, have the same fixed height. Only the current card is materially taller, uses a 5px accent-colour border plus an outer accent ring, and enlarges its blind title; opacity alone is not sufficient emphasis. A current Deadline card reserves additional vertical space for its boss-reroll control, so the control never overlaps boss content or the select action. The stage-selection heading sits above the raised current card with a larger font and reserved gap, so an emphasized Revision card cannot cover it. Selecting the card sends the cards downward, then deals the hand and reveals play/sort/discard controls. Target and reward preview remain unchanged. The **Deadline boss always shows its effect text** (playtest-04 D-6) — no hiding, no `?`. The chapter's boss is drawn at chapter start (`run.chapterBossId`) so the player can prepare from the first card. A Sketch Book/Portrait boss-reroll control appears and accepts input only when that Deadline card is the **current** blind; the earlier Draft/Revision screens may preview the boss but cannot reroll it.

Draft and Revision each show their fixed, seeded **Editorial Perk / 편집 특전** as a square pixel-art tag image immediately before the Skip control. The complete effect is available through the shared portalled tooltip and keyboard focus; the tag reacts to cursor position with the shared 3D tilt, lift, and sheen. Match the vertical reference hierarchy: the current card's full-width **Select** control is at the top, blind information fills the middle, and **OR / 또는** plus the `tag image → Skip` row is anchored at the bottom. Skip grants that exact perk, sends the cards down, marks the old card Skipped, and prepares the next blind without Fee Settlement or a shop. A free-pack Tag opens its pack first and constructs the next blind only after the pack closes, ensuring pouch edits affect its opening draw. Upcoming perk icons and disabled Skip controls remain visible for planning. Deadline never renders Skip. Carried next-blind perks remain applied if another blind is skipped and are consumed only when Select begins an actual blind (GDD §8.2). Handy and Garbage tooltips display their live current-run payout. Skipping the tutorial-rigged first Draft disables the YELLOW coach lock for that run only, leaving the lesson available on the next new run. (changed 2026-07-31: 27 effect-specific image Tags and reference-aligned vertical actions)

### 2.4 Play Screen
Already specced (`docs/UI_DESIGN.md`, `docs/mockups/play-screen.html`). Additions:
- **Joker tooltips** with live scaling values (global pattern §0); shelf tooltips open **downward** (playtest-03 E-7). Scaling Emoji Tiles always append a centred current-value row inside the white effect plate—even before their first trigger—formatted as `(현재 ×1 배수)` or `(현재 +0 칩)` with the value using the corresponding Mult/Chips colour.
- **Per-tile `+N` score popups** during settle (§0); joker wiggle + contribution popups (playtest-02 B).
- **Sidebar** (playtest-03 E-9, ref `docs/reference/balatro/RoundInfoUI.png`): stage banner (Draft/Revision/Deadline) + ❄target + reward `$$$`; selected Record icon/name with its cumulative penalties in the tooltip; round score; large **0 × 0** box; the **selected-tile status text** (letter-hand name / "not a word" / suit name) renders as plain text **above the 0×0 box** (no floating info near the hand); **Run Info** and **Options** buttons; phase & discard counts; `$` fee; **Chapter N/8**.
- **Run Info reference (added 2026-07-31):** four tabs show Patterns, Letter Hands, Blinds, and Vouchers. Letter Hands lists all six hands in rank order with their condition, fixed Chips/Mult bonus, and whether gibberish qualifies.
- **No cash-out button** — the blind auto-settles (GDD §7.2).
- **Deadline entry reveal (changed 2026-07-29):** trigger only when the Deadline board actually enters `playing`, never while its card is visible on Blind Select. Continuing a saved run already inside that boss blind triggers the reveal again. Show the boss emblem, localized name, and full debuff text in a centred card whose height is **150% of the prior reveal**; once the entrance lands, hold it for **1 second**, then remove it with a lift/fade-out. It is informational and non-blocking; reduced motion removes the flourish.
- **Unopened Letter feedback (changed 2026-07-29):** after each hand play, the exact seeded-random tiles removed by the boss (up to four) visibly lift from the hand area one by one and fly into the discard direction while replacements settle. The animation is presentation-only; the engine-reported tile list is authoritative.
- **Zero-score boss feedback (changed 2026-07-29):** when the staged word will be debuffed to 0, every staged tile carries a red **Not Allowed** tag. The Play action remains available. Submitting briefly shows a text-only white `Not Allowed` notice at the top centre of the workspace, using the title face at a materially larger size; it fades away automatically instead of persisting as a normal toast. The resulting tray word stays desaturated/dashed so the wasted play remains legible.
- **Briefcase balance beat:** after the last ordinary word hook (and separately
  after the last sentence-bonus hook), hold the final Chips/Mult pair, stamp a
  balance-scale pictogram, then tween both displayed axes to their exact
  arithmetic mean before multiplying. This beat is part of the settlement
  timeline and therefore extends `settleDurationMs()`; it may never be a hidden
  score rewrite or an untracked fixed delay. Reduced motion swaps the pair
  immediately but retains the labeled stamp.
- **Unified board** (E-5): tray + hand are one continuous board; only the joker/consumable shelves have a dark translucent panel, with `N/max` counts under them (E-6). Sort buttons sit in the Play/Discard cluster (E-8). Play word = blue, Discard = red (playtest-02 C-5).
- **Opening hand draw (feedback3):** only the individual tile flight animates; the hand row itself never translates. Its visible pouch origin is clamped inside the work panel so the clipped right edge cannot expose a temporary tile fragment.
- **Unified owned-card sizing (changed 2026-07-30):** shop offer stages, Emoji Tiles, held-consumable slots, and vertical vouchers share a rounded `124×165px` runtime footprint. Packs are the exception: sale packs use the requested older `131×229px` foreground and matching 131px row slots with a 12px gap; their panel reserves 84px below the row so Open is not clipped. Collection packs use `81×132px`; all pack art has square corners. Consumables remain in a 286px panel; the Emoji Tile panel takes the remaining shelf width with exactly 10px between panels. Empty positions have no placeholder. Owned Emoji Tiles use one fixed 12px inter-slot gap and the complete group is centred; when cards exceed available width, equal-width wrappers compress so the fixed-size cards progressively overlap. Hovered/focused/dragged cards rise above neighbours. Both panels share a fixed 187px outer height. The main `.frame` is transparent, and the board design height keeps the tray/stage/action layout docked to the viewport bottom.
- **Shared rail surface and shop baseline (changed 2026-07-30):** the Emoji Tile and consumable panels use the exact dark translucent background/edge tokens from the Run Info sidebar. The shop phase panel bottom-aligns its complete layout with zero bottom padding, so its lower edge lands on the same baseline as the sidebar.
- **Pouch widget** (bottom-right) → **centered hover modal** per §2.8.

### 2.5 Fee Settlement (blind end; playtest-03 A)
Reached automatically on auto-settle. Direct mapping to GDD §9.1 — line-item settlement, revealed line by line with count-up:
```
FEE SETTLEMENT: $8
Clear reward .......... $3~5   ($$$ icons)
3 remaining phases (each $1) .. $3
Interest ($1 per $5, max 5) ... $1
```
Lines are modifier-aware, not cosmetic hard-coding:

- Purple Pouch shows `$2` per remaining phase, adds `$1` per remaining discard,
  and shows interest as `$0`/disabled.
- Red LP shows a cleared Draft's clear reward as `$0`; its other lines remain.
- DVD shows interest as `$0`/disabled. Purple + DVD still renders one zero
  interest line, never a duplicated penalty.

Big gold banner button confirms and transitions to the Stationery Shop.
The modal is centred on the **physical viewport**, not on the main play column; the
persistent left rail must not shift it sideways.

### 2.6 Shop (Stationery Shop; changed 2026-07-28)
The completed blind does not navigate away. The persistent sidebar resets round score, Chips, Mult, hands and discards to zero and changes its blind badge to a large, centred marquee **SHOP** sign with a restrained idle glow/bulb cycle. The SHOP badge stretches to the full inner width of the shop sidebar. The score reset is immediate: the consumed settle log/id, finalized-score fields, and sentence-bonus fields are cleared before the shop's first frame, and the count-up hook snaps to zero instead of replaying the last blind's score. Owned Emoji Tiles, consumables and the pouch remain in place, but the pouch contents/count immediately switch to the complete permanent `run.bag`; the completed blind's partial `blind.bag` is never shown in the shop. A lower shop panel rises in this order: **Next Blind → Reroll → items for sale → voucher → packs**. The three selling panels—items, voucher, and packs—centre their live offers with equal spacing and symmetric balance. Sold entries leave layout entirely, and every affected panel immediately recentres its remaining offers. Selecting an offer raises its complete product/price/action interaction owner by 59px (15px base + 44px action height), so the visible object and its hit-test geometry remain identical, and attaches its primary Buy/Redeem/Open button 8px directly below the actual foreground object. When available, **Use now** is the exception: it appears vertically centred 12px outside the product's right edge while Buy remains centred below. Buy and Use-now actions have a minimum 44px hit height. Card selection and its revealed action are separate buttons, so Redeem cannot toggle the card instead of firing. Tooltips are body-portalled per §0 and therefore do not depend on sale-panel overflow or stacking.
- **Catalog/Coupon Book vouchers** grow the item-slot count immediately in the same visit; each newly opened slot is filled without rerolling existing stock.
- A full consumable shelf disables **Buy** on consumable offers but leaves **Use now** available for affordable non-tile consumables; instant use never occupies a resting slot.
- Selecting a sale card keeps its purchase control attached below the card; when **Use now** is available, Buy stays below and Use now appears outside the card's right edge. Shop item ids and pack type/size pairs are unique within each stock roll. Shop-offered tile-targeting and blind-only Fables are Buy-only: they enter a held slot and cannot be used until a blind.
- **Charm Pack** emoji-tile choices are **greyed / non-selectable when joker slots are full** (D-5), with a "joker slots full" note.
- Voucher slot rules per GDD §9.2 (reroll-immune, one purchase per chapter, restocks at Deadline).
- **Voucher redemption (changed 2026-07-30):** Redeem shreds the voucher
  vertically from top to bottom: a cutter head descends, narrow cut lanes open
  behind it, and the separated strips drop away before the offer clears. Other
  shop actions are locked for that short beat; reduced motion clears it
  immediately.
- **Shop mascot:** **삐약이 (Piyak)**, a pixel-art **tuxedo cat proprietor**, sits at the bottom of the left rail (behind-the-counter feel), not overlapping the slots. Idle animation (single-sprite CSS breathe) + a speech bubble showing one random `mascot.welcome.*` line per shop entry, per UI_DESIGN §6. Purchase/reroll reactions are a later layer. Art: `docs/Piyak.png` → `src/ui/assets/piyak.png`.

### 2.6.1 Pack opening (persistent-table panel)

Opening a pack sends the shop panel downward and replaces only the lower work panel; the persistent sidebar, owned shelves and pouch never unmount (changed again 2026-07-28; both the earlier overlay and dedicated screen are retired). Balatro's layout is the reference: **contents fan out large and centred, one clear action, no other UI competing.**

- **Layout:** pack contents fan across the centre as widened, image-first selection objects. A five-card fan uses a responsive five-column grid inside a widened, overflow-visible work panel: neither end cards nor their above-card tooltips may be clipped, and opening a pack must not create horizontal scrolling. The item art fills the whole choice footprint; names/effects stay in the tooltip, including live values such as The Heavenly Maiden and the Woodcutter's current Charm sell payout. A Tile-Pack choice uses a square footprint fitted to its tile image instead of inheriting the tall 5:7 consumable-card ratio. Tile-Pack and Charm-Pack **Select** actions are hidden until their stable choice shell is hovered or keyboard-focused. Every pack Select/Use action has a minimum 44px hit height. Every pack action is a sibling of—not a child of—the cursor-tilting card, and preserves its centring transform during active/disabled states, so pointerdown cannot move the button out from under pointerup. A Fable Pack first deals ten seeded tiles from the current pouch as the immediately active candidate field for tile-targeting Fable effects; random Fable choices appear with them. A revealed Fable has no button at rest. Selecting the card outlines it and reveals **Use** below; Use stays disabled until one to the effect's listed maximum valid candidates is selected for a tile-targeting effect, while a non-tile effect ignores candidate selection and never marks candidate tiles during its animation. A compatible targeting Fable already on the persistent consumable shelf can use the same candidate selection while the pack is open. Its enabled and disabled states use the same fixed button position. Pressing Use casts from the card onto every selected target tile; the target visibly changes letter/material/font/edition as applicable, remains in that committed appearance when the preview ends, and the complete animation plays before a 0.5-second result hold and pack close/reflow for a dealt card. Blind-only Fables reveal **Select** instead of Use and enter a held slot for later use; they do not gain a separate tooltip classification. Constellations use the same select-then-confirm structure, but always reveal **Use**, level the mapped pattern immediately, and ignore held-slot capacity. Current pack information and Skip sit along the bottom. The pick counter is explicit — "Pick 1 of 3" / "Pick 2 of 5" (§9.3 sizes) —and decrements only when Use/Select resolves.
- **Tile enhancement application (changed 2026-07-30):** whenever an existing
  candidate or hand tile changes, the shared tile renderer shows material as a
  warm forge burst with fragments, font as an inked type-press stamp, and edition
  as a chromatic ring/foil sweep. Simultaneous axes stagger material → font →
  edition. Reduced motion shows only the committed final face.
- **Skip:** a single, always-available Skip button. Packs may be left unpicked; unpicked contents are discarded.
- **Selection feedback is mandatory** (playtest: selecting an item currently does nothing visible): the chosen card lifts and pulses, gains a selected outline, the counter ticks down, and a confirm SFX fires. When the last pick is spent the overlay closes on a short beat, not instantly.
- **Every revealed item is hoverable with a full tooltip above the card** — see §0. Pack-choice tooltips never open beneath the revealed card.
- **Blocked picks read clearly:** when a choice cannot be taken (Emoji Tile slots full, §2.6), it greys with a reason label rather than failing silently on click.
- Under the CRT pass; respects reduced motion (fan appears without the flight animation).

During word settlement, contribution beats run at **600ms per tile/effect at 1× speed** (rolled back from 800ms on 2026-07-29). Order is whole-word stamps → each played tile with its own enhancements and tile-triggered Emoji effects → global Emoji Tile list → held tiles frozen in visible play-time order → future consumable hooks → global/boss beats. The current tile lifts and bounces on every contribution. The settle-complete signal derives from this same cadence; 2×/4× game speed still scale it rather than introducing a second timer. Enhanced tile triggers repeat their Chips/Mult/gold/retrigger value above the source tile.

Every definition left after the shared count-aware fold is an independent framed card stacked immediately left of its main tooltip, including material/font references, enhancement definitions, and Gibberish definitions. Its title uses the same bold white cyan/magenta-separated treatment as the main card. Every tooltip effect that needs a free consumable or Emoji Tile slot uses the shared capacity phrase “Requires available space” / “공간이 있어야 합니다” rather than naming the slot type.
Effect-description money values always use the shared gold `$` highlight. Any
description that mentions **Gibberish / 횡설수설** emphasizes that term in red
with a dotted underline and adds the shared secondary definition tooltip.
All localized effect/tooltip descriptions omit period punctuation while
preserving decimal points, and tag every numeric value for emphasis. English and Korean keys, interpolation
variables, and highlight-axis counts must remain paired; the build-time locale
lint rejects drift.
For additive Chips/Mult values, only the numeric portion uses the axis colour.
Filled axis boxes are exclusive to multiplication and wrap only the `×N`
factor. The trailing `Chips`/`Mult` or `칩`/`배수` label always remains in
the normal body colour.

### 2.7 Run End (Game Over / Published)
One screen with three framings: **loss** — red "Game Over", defeated-by panel;
**Chapter-8 win** — gold "출간 완료!/Published!" with **Endless Mode →** in the
action row; **post-win end** — "Endless Run Ended" (or "Beyond Publication!" for
the Chapter-38 endpoint). Endless Mode routes into the already-earned win's Fee
Settlement → shop flow. New Run/Main Menu instead finish and clear that run.
**우땅 (WooDak)**, the orangutan mentor mascot, stands beside the card (hidden
≤720px) with a speech bubble: discovery mention (`{n}` new words) → stat-based
tip → random tip; a congratulation leads on a win. Idle = shared single-sprite
breathe + slow sway. Art: `docs/WooDak.png` →
`src/ui/assets/woodak.png`. Stats panel, translated to our terms:
- Best word (intrinsic letter-chip sum + the word itself) · Most played pattern (e.g. "Transitive (16)")
- Words played · Tiles discarded · Items bought · Rerolls used
- **New discoveries: N** (ties into the collection tracking already shipped)
- Defeated by: boss badge · Chapter / stage reached
- **Seed + Copy button** (engine seed makes runs reproducible)
- Buttons: on the Chapter-8 win, Endless Mode · New Run · Main Menu; otherwise
  New Run · Main Menu. (The run-summary quip is now 우땅's speech bubble — see above.)

### 2.8 Pouch widget + centered modal (주머니)
**Persistent pouch widget** bottom-right: the selected Starting Pouch's
illustration + `remaining/total` text that updates on every draw/discard. It is
an image swap in one shared box, never a pouch-specific layout. **Hover** opens a
**centered modal** (playtest-04 D-3, supersedes the bottom drawer); a grace timer
bridges widget↔modal so it never flickers. While open, the hand + button cluster
**slide down** to make room and restore on close. The modal is a wide, no-scroll
layout: left = selected Pouch name/effect and totals
(vowels/consonants/materials/fonts); main = the A–Z grid showing **remaining
tiles only** (playtest-04 item 1; no full-pouch toggle).

**Remaining-count definition (D-1; shop exception 2026-07-31):** while a blind
is active or prepared, `remaining` = the undrawn pouch (`blind.bag`) **only** —
tiles in hand, played, or discarded have left it. In the shop, where no blind is
active, the same widget displays the complete permanent pouch (`run.bag`).
Coin Purse always starts from a total of 68; letters with zero copies simply do
not appear among its remaining tile objects.

### 2.9 Collection (도감)
**Root screen = centred category modal** (not tabs — too many categories): a framed two-column menu uses thick red buttons and a full-width orange Back bar, following the reference layout. The left column is Emoji Tiles → Pouches → the paired Vouchers/Tags block → the inset Fable/Constellation/Gambler family panel; the right column is Enhanced Tiles → Editions → Card Packs → Palette → Mascots → Words → Blinds. Words and Blinds share the taller 84px category height; every ordinary standalone category and each of the three consumable buttons uses the 75px Voucher height. Emoji Tiles receives the freed left-column space and is 164px tall, keeping both columns equal in total height. Each button shows `discovered/total` and a `!` badge for new finds. Each category opens a content-sized detail modal using the shared grid card + pagination patterns (§0); Card Packs alone reserves the tallest two-row gallery height across all family pages so paging never resizes its modal. Mobile collapses the menu to one column.

| Category | Contents | Notes |
|---|---|---|
| **Words** | profile challenge strip (highest-scoring word · longest word · most-played word · discoveries), then tabs: **Words** = tile-styled entries with search/suit filter and pagination; **Register Scores** = the live Standard/Formal/Slang/Vulgar multipliers and risk/reward copy | highest score uses only the intrinsic letter-chip sum; material/font/edition, Mult, Emoji Tile, boss, and sentence effects are excluded. Old settled-score records are recomputed from the word on read |
| Jokers | all Emoji Tiles, rarity-ordered, paginated **5×3 grid (15 per page)** | image-only `124×165px` runtime frame, exactly matching the in-run card size (84×112 pixel masters scale with nearest-neighbour rendering); its detail modal removes the redundant outer padding and never shows an internal scrollbar; no wrapper or rarity border; shared idle float and cursor tilt/sheen; tooltip shows name, rarity, and full effect |

All 116 Emoji Tile images use the shared `jokerArt` resolver on every rendered
surface.
| **Enhanced Tiles** | two paged views using the shared `< · page · >` footer: page 1 Materials = 9 tile faces (base + 8 enhanced, including Wood); page 2 Fonts = 5 Futura variants | both pages render large pixel-art tile swatches; Font tooltips show each seal effect from `balance.ts` `fontEffects` (GDD §2.3) (changed 2026-07-31) |
| **Editions** | Base / Gray / White / Rainbow / Violet | five runtime-size Emoji Tile samples in one unbroken horizontal row using the live edition overlays; narrow viewports scroll horizontally instead of wrapping; each tooltip names the edition and its effect; White remains Emoji-Tile-only per GDD §11.8 |
| Vouchers | 32 tickets | 16 base/upgraded pairs; four pairs per page; locked upgrades show only “Undiscovered” and the unseeded-run discovery hint — no name, effect, condition, or progress |
| **Tags** | all 27 Editorial Perks | two-page 5×3 pixel-icon gallery (15 per page); every effect-specific image uses the same idle/cursor tilt and shared tooltip as Blind Select; Tags are a complete rules reference and have no discovery lock |
| **Fable Cards** | 18 implemented cards | supplied pixel art keeps a path-only SVG master and uses its pixel-identical `500×700` PNG runtime derivative in a 5-column, 10-per-page gallery; hover shows the full effect |
| **Constellation Cards** | 12 implemented zodiac cards | supplied monochrome pixel art uses the same SVG-master/`500×700` PNG-runtime contract and 5-column, 10-per-page gallery; hover shows the mapped sentence pattern |
| **Gambler Cards** | 14 artworks; 12 implemented effects, 2 pending | supplied artwork uses the same SVG-master/`500×700` PNG-runtime contract and 5-column, 10-per-page gallery; Rainman and Sake Cup remain art-only and show Pending, while the other 12 use live runtime tooltips |
| Card Packs | Tile 8 · Charm 4 · Fable 8 · Constellation 8 · Ink 4 | four-page image-only gallery: Tile, combined Charm + Ink, Fable, Constellation; every page contains eight cards and therefore shares the same two-row height; all 32 supplied artworks keep a shared `244×400` path-only SVG master and use its pixel-identical PNG runtime derivative plus the common idle and cursor tilt/sheen, with no persistent type/grade/coming-soon labels; hover or keyboard focus restores the shared type/description/grade tooltip |
| **Palette** | 11 chromatic unlocks (feature-02 C) | locked = grey silhouette + letter-count hint ("R _ _"); unlocked = the word in its group color |
| Mascots | WooDak skin roster | **primary skin picker** (moved from Settings 2026-07-29): one horizontal, centred, non-wrapping card row; discovered tooltip-wrapped cards and undiscovered raw cards share the same 150px basis width; locked skins use non-selectable silhouettes; unlocked cards select on click/keyboard and mark the equipped skin with a gold outline and Selected label |
| **Starting Pouches** | 14 object-art entries from GDD §12.2 | one-at-a-time `arrow | panel | arrow` carousel with art left, enlarged bold localized effect right, 14 position dots below, and the shared orange Back footer; signed/count values and voucher names use semantic highlight colours; unlocked = full art/effect with no unlock copy; locked = silhouette + generated arcade-pixel lock sprite + exact unlock condition only; the tooltip retains the actual name/effect (changed 2026-07-31) |
| **Blinds** | left: Chapter → base target table (from `balance.ts` anteBaseTargets, incl. endless rows); right: Draft/Revision badges + 12 boss chips (undiscovered = `?`) | doubles as the player-facing target-curve reference; boss cards retain their tooltip and use shared cursor tilt/sheen |

Fable reports `18/18`, Constellation reports `12/12`, and Gambler reports `14/14`
supplied artworks. Twelve Gambler effects and their Ink Pack,
Comic-Book-gated Fable mixing, and Deer-in-Constellation routes ship per GDD
§10.3; Rainman and Sake Cup remain art-only and pending.

**Omitted by design (no equivalent — do not add):** Seals as a separate category (their roles are absorbed into the font layer — GDD §2.3 seal-port).

### 2.10 Options root
Buttons: **Settings · Statistics · Help · Credits**. Help is the complete tutorial glossary in a responsive two-column grid (one column on narrow screens); every term title and mascot-voiced explanation is visible regardless of encounter status. The guided tutorial has no replay button. (Balatro's "deck customization" → our tile-skin customization is **[PLACEHOLDER: omit button entirely for now]**.)

### 2.11 Settings
Mascot selection does not live here. It is owned by **Collection → Mascots**, so
discovery, inspection, and equipping share one surface.
The standalone screen and the in-run pause version are centred on the physical
viewport in fullscreen as well as windowed mode. In-run Options is portalled outside
the zoomed board root so fullscreen/UI scaling cannot pull it toward the top.
Tabs — trimmed for a web game:
- **Game**: game speed (1/2/4 — settle-animation multiplier) · screenshake slider · reduced motion toggle (mirrors `prefers-reduced-motion`, user-overridable) · language (ko/en) · hint highlight color-blind-safe palette toggle · **"don't show tips" toggle** (kills the first-encounter tutorial popups, feature-01 A-2).
- **Graphics**: **CRT effect on/off · CRT intensity slider · CRT bloom on/off** (the pixel-art/CRT finish is now core identity — the reference build exposed exactly these; see UI_DESIGN §"Surface language") · pixel-perfect/integer-scale toggle.
- **Video**: fullscreen toggle · UI scale slider. The fullscreen toggle mirrors the browser's actual `fullscreenElement`; when ESC exits fullscreen externally, the toggle immediately synchronizes to Off. (No monitor select/VSync — web.) Reveal All belongs exclusively to the selected profile screen (§2.1).
- **Audio**: master / music / SFX sliders with value badges drive the **live Web Audio mixer** (`src/ui/audio.ts`, feature-01 B). SFX and four loop-safe synthesized BGM contexts (menu/play/shop/Deadline) are shipped; no remote audio assets are required. The context unlocks on the first user gesture (autoplay policy), settle-sequence SFX scale with game speed, and the `MUSIC`/`SOUND` Palette entries gate their respective buses.

### 2.12 Statistics
Left column: Best word intrinsic letter-chip score · Highest ante/blind reached · Most played pattern · Most gold held · Wins/streak.
Right column: overall progress % — Collection %, Challenges **[PLACEHOLDER 0/0,
hidden until challenges exist]**, and Records won. Custom-seeded wins are
excluded from Pouch/Record unlock progress and balance telemetry. Until the
dedicated Statistics screen ships, Profile exposes completed balance-run count,
win rate, and the most common loss Chapter; the profile save retains the full
per-Chapter loss histogram.
Sub-screen **Word/Joker stats** (reference: per-card bar chart): per-joker "blinds completed while owned" bar chart **[PLACEHOLDER: ship data hooks only, screen later]**.

## 3. Build notes

- All screens are pure UI over headless engine state. Starting-Pouch/Record rules
  come from GDD §12 and engine definitions; New Run, tooltips, settlement, and
  Collection only present their resolved values. Formal challenges remain a
  flagged placeholder.
- **Persistent in-run table (changed 2026-07-28).** `ScreenTransition` is retired from blind↔shop↔pack↔blind-select changes and remains available only for shell navigation such as menu↔run.
  - **Panel direction:** phase panels enter from below and leave toward the bottom. Use Ease-Out Back for entry and a short ease-in for exit.
  - **Performance:** CSS transforms on the panel wrapper; never per-frame React re-renders. Action resolution waits for the exit beat so an unmount cannot cut it off.
  - **In-run motion:** lower panels enter upward and leave downward. Sidebar, owned shelves, Run Info access and pouch remain mounted. Fee Settlement and Game Over remain overlays.
  - **Reduced motion:** `prefers-reduced-motion` removes panel travel.
- **Panel and board animations are sequential.** Blind cards leave downward before the hand draw and play/sort/discard controls enter. Pack contents begin only after the shop panel has left.
- Every string through i18n (ko/en) from day one.
- `npm run e2e:smoke` builds and drives the shipped `file://` app through
  Collection → New Run → Play → reload/Continue → Fee Settlement → Shop → Pack.
- Priority order: **2.5 Fee Settlement → 2.6 Shop → 2.3 Blind Select → 2.7
  Game Over → 2.2 New Run → 2.1 Main Menu → 2.8 Pouch View → 2.9 Collection →
  2.10–2.12 Options/Stats**. (The first four complete the run loop; the rest are
  shell.)
