# Play the Wor!d — Screen Inventory & Flow Spec

Derived from 18 Balatro reference screenshots. **The screenshots are layout/flow reference.** All visual language (colors, type, surfaces, motion) comes from `docs/UI_DESIGN.md` — now a **pixel-art / CRT aesthetic** in the Balatro lineage (the earlier "ceramic, un-Balatro" identity and its trade-dress guardrail are retired). Adopt the pixel-art idiom, CRT post-effect, and screen grammar freely; only avoid copying Balatro's *specific* art assets (its actual card illustrations, logo, exact sprites). Where a Balatro concept has no equivalent yet in our game, the screen ships as a **[PLACEHOLDER]** with minimal stub content, to be filled later.

## 0. Global UI patterns (recurring across screens)

- **Tab pills** along the top for sectioned screens (settings tabs, collection tabs); active tab marked with a small arrow indicator above.
- **Back button**: full-width gold bar pinned at the bottom of every sub-screen.
- **Carousel selector** `< value >` for enumerated options (Starting Pouch,
  Record, window mode).
- **Slider + value badge** for continuous options (volume, screenshake).
- **Button feedback (changed 2026-07-31):** every enabled UI button visibly enlarges on pointer hover and presses downward while held. The shared effect composes with each component's existing transform, so centred actions, card buttons, and icon controls never lose their positioning. Disabled buttons do not react.
- **Custom cursor (changed 2026-08-20):** fine-pointer devices use the selected, unlocked WooDak skin's original 32×32 normal/hover/active hand poses with a `(3,3)` fingertip hotspot and mandatory `default`/`pointer` fallbacks. Locked or invalid selections fall back to WooDak; Piyak is excluded. Matching monochrome poses remain until the first colour unlock removes `world-mono`. A letter tile always keeps the mascot hand—hover while available, active while pressed or dragged—rather than switching to the OS grab cursor. Text, help, non-letter dragging, crosshair, not-allowed, Windows forced-colors, and coarse/no-hover contexts retain system cursor semantics; this keeps the same UI ready for a future mobile build.
- **Modal frame (changed 2026-08-01):** Fee Settlement, Game Over, Run Info, Options, Pouch, Collection, and ordinary tutorial modals all use the Collection panel background and its double-line frame: `3px` panel edge, `3px` inset edge, `18px` radius, and a hard `7px` down-right shadow. A Collection opened inside Options suppresses the redundant outer frame. Spotlight coach-mark speech bubbles are not modal panels and keep their pixel-tail style.
- **Card tooltip — universal, no exceptions.** Hovering **any** interactive object anywhere opens an anchored tooltip: Emoji Tiles, consumables, letter tiles, vouchers, packs, Starting Pouches, Records, Tags, **and every item revealed inside an opened pack**. Contents: name, full base effect text, and — for scaling or decaying Emoji Tiles — the **current live value** (e.g. "currently ×1.5" or Folding Manuscript's current hand size). All main and supplemental tooltip copy is centre-aligned. Pouch Tag likewise appends `(currently +N Chips)`, calculated from `blind.bag` during an active/prepared blind and the complete `run.bag` in the Shop. Enhancement names remain coloured footer tags. With one supplemental definition it opens on the left. With two or three, exactly one definition folds into the main effect plate and the rest remain on the left; the fold priority is **material → font → edition**. Exception: when one description references exactly three Emoji Tile editions, all three edition definitions stay on the left; if another definition also exists, only the highest-priority non-edition definition may fold. Letter tiles use this for material/font/edition; Emoji Tiles use it for non-base editions. Any effect description that names a tile font automatically adds that font's canonical effect tooltip. A Record tooltip describes that level's added penalty and marks the ladder as cumulative. One shared component; a surface that renders objects without wiring it is a bug, not a gap. **Every tooltip is portalled to `document.body` and uses the highest UI layer. It must never be clipped, covered, or trapped by a product panel's overflow/stacking context. Left-side supplements keep that placement regardless of the main tooltip's up/down direction.** *(Changed 2026-08-06: current-value rows include explicit decays and hand-size state; multi-definition folding still prevents most three-card side stacks from obscuring the board.)*
  - **Edition outcome disclosure (changed 2026-08-20):** edition-granting consumables list Gray/Violet/Rainbow with their rich tags and supplemental definitions but omit individual outcome weights. A distinct activation chance, such as The Cowherd and the Weaver Girl's `1 in 4`, remains visible; seeded mechanics are unchanged.
  - **Emoji Tile performance split (changed 2026-08-20):** a standalone base performance/value occupies its own first line and the separate rule/decay explanation begins on the next line in both locales. Drying Ink therefore reads `+15 Mult`, then its vowel-decay rule. A value whose condition is semantically inseparable stays inline. Explicit locale newlines—not runtime parsing—drive the same copy in Shop, shelf, opened packs, and Collection; the live-value row remains separate.
  - **Reference proportions (changed 2026-08-01):** the shared image-like frame uses mint pixel edges, a charcoal scanlined shell, a pale inset description plate, and cyan/magenta title separation. Standard main width scales from 150–280px according to content. Letter-tile tooltips instead use one fixed 132px compact frame regardless of enhancement count, with the standard 18px title / 15px body sizes and a highlighted `[c:+N개의 칩]` / `[c:+N Chips]` score line. Each supplemental card derives its width from its own visible title and body copy, clamped to the shared 150–280px range and the viewport. Supplemental height follows wrapped content and uses the main tooltip's 7px top / 6px bottom shell padding. Footer/enhancement tags remain 72% of the main width; main-card heights also remain content-driven.
- **Description face (changed 2026-07-31):** main and supplemental description plates use bundled Jost 700 with Noto Sans KR 700 fallback, compact tracking, and restrained cyan/magenta separation. This keeps Korean readable offline while giving effect copy the printed arcade tone of the reference.
  Semantic highlight phrases are atomic line-breaking units: `+2 Mult` / `+2 배수`, money values, rarity names, and card-kind names may move to the next line as a whole but must never split internally.
  - **Text wrapping:** all descriptive copy wraps only at word boundaries (`word-break: keep-all`; `overflow-wrap: normal`); an unbroken token remains intact even if it overflows. Pouch selection and clicked-open pouch descriptions inherit the same rule.
  - **Hover feedback accompanies it:** anything that shows a tooltip also reacts to the cursor (lift/scale + shadow), so hoverability is discoverable without hunting.
  - **Pointer hit boxes stay stable:** cursor tilt uses the untransformed entry rectangle for the full hover and letter tiles do not translate their actual hit target. A stationary cursor on a tile boundary must not cause leave/re-enter flicker. Tile faces also keep overflow visible; material sheen is clipped internally, never by clipping the tile root, so material/font/edition tags and score popups remain intact.
  - **Letter-tile silhouette (changed 2026-07-30):** every material uses the Ceramic tile's outer border and rounded corners. Material identity is confined to face colour, texture, internal lines, and condition glyphs.
  - **The tooltip never inherits its subject's styling.** Tooltip text always uses the standard UI face at full contrast — a Light Italic tile does *not* get a thin italic tooltip, a dark-material tile does not get dark tooltip text. The tooltip describes the object; it does not imitate it. (Playtest: the Light Italic tooltip was unreadable for exactly this reason.)
  - **Enhancement stack (changed 2026-07-31):** material, font, and edition names render as distinct coloured tags stacked beneath the letter-card tooltip. Their normal-weight definitions follow the shared count-aware layout: one stays in a left card; with two or three, the highest-priority definition folds into the main plate and the remainder stay left.
- **Pagination carousel**: long grids page with a `< Page N/M >` pill control (jokers, words). Every Collection pager is circular: Previous from page 1 opens the last page and Next from the last page opens page 1.
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
    └─ Options ─┬─ Settings (Game / Video / Graphics / Audio tabs)
                ├─ Statistics (Overview / Words / Emoji Tiles tabs)
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
- Once the Main Menu is interactive, likely next-screen art may decode **one image
  per browser idle turn**: New Run carousel art from the menu, exact rolled Shop
  stock during Fee Settlement, and the disclosed Blind Select art while in the
  Shop. This background work never gates navigation and never expands to whole
  Collection or card registries.
- The bundled dictionary/lexicon import is also scheduled for one browser idle
  turn after the Main Menu becomes interactive. It never gates Loading or runs
  synchronously in the first visible menu turn; navigation that needs it cancels
  the idle reservation and immediately starts/awaits the same singleton load.
- Pixel-grammar progress bar + the title logotype; a mascot may idle here (WooDak — this is a natural first-contact beat, and it is *not* a tutorial step).
- **Respects the monochrome start (§13 Chromatic Unlocks):** on a fresh profile the loading screen is greyscale too, or the world's first color would leak before it is earned.
- Under the CRT pass like every other screen. Falls through immediately when assets are already cached — never add artificial delay.
- **Audio caveat:** decoding may begin here, but playback still cannot start until the first user gesture (feature-01 B-3), so the loading screen stays silent by design.

### 2.1 Main Menu
Title treatment (our own logotype), buttons: **Play · Options · Collection · Laboratory · Quit**. The title uses a stepped, diagonal hard-shadow extrusion and a slight perspective pitch so it reads as chunky 3D pixel art rather than flat type. It floats through eight discrete vertical/tilt steps while the red exclamation mark periodically punches through a short three-frame accent; both animations are Main-Menu-only and stop under either reduced-motion path. Behind the menu, a low-resolution phosphor grid and slow full-screen scan beam animate beneath the global CRT pass; both reduced-motion paths freeze the beam while retaining the static texture. Quit shows on all builds: it attempts `window.close()` (works in a desktop shell / script-opened window) and always swaps the menu for a full-screen farewell ("Thanks for playing!"), so a normal browser tab that can't self-close still ends cleanly (2026-07-22). The five buttons keep this vertical order inside one dark CRT panel, with individual block shadows and palette-mapped semantic colors. Laboratory opens a non-gameplay gallery containing every current random desk encounter; each sample reuses the live interaction component and may be reset independently after its one-shot exit. The bottom-left profile control is a compact dark card with a `Profile` header and inset active-profile-name button; when the active slot has a currently earned equipped register title, its localized name appears as a small validated second line beneath the profile name (no line is reserved for None). The bottom-right language control mirrors that card and displays the currently selected language (`한국어` or `English`) without an icon. Collection badges a `!` when new words/jokers were discovered last run. (Laboratory added 2026-08-05.)

**Profiles (changed 2026-08-18).** The profile button opens a three-slot screen matching the reference layout. P1 exists on first boot with the editable default name `P1`; P2/P3 begin empty. A slot tab only previews that slot and never changes the active profile; creating a slot also leaves the active profile unchanged. A selected non-active created slot becomes active only when the blue **Load Profile** button is pressed, which reloads the shell against that slot. The active slot instead shows a disabled **Current Profile** button and its smaller red Delete Profile button is also disabled. Selecting an empty slot shows a name field, Empty panel, Create Profile, disabled red Delete Profile, and Back. The empty and populated dashboards use the same panel dimensions and column proportions, so Create Profile matches Load Profile in both size and blue colour; the Empty inset keeps a compact 120px minimum height for breathing room instead of stretching through all unused dashboard space, and only the empty-state Create/Delete actions align to the top of their column. Delete Profile is deliberately smaller and always red. The dashboard uses the shared three-pixel modal frame and extends through its full-width Back button instead of leaving Back below the modal; that Back button keeps the shared intrinsic button height rather than stretching with the dashboard grid. Creating with a blank name uses `P2`/`P3`; every created profile can be renamed later. A created slot shows its validated current title directly below the editable name, overall progress, four progress rows (word Collection, presentation, Starting Pouches, Record wins), four keyboard-accessible register-title buttons, lifetime wins, compact balance telemetry, profile status/load, Delete Profile, Reveal All, and Back. Each title button derives the previewed slot's unique current-lexicon discoveries by the word's original register, shows only the highest cosmetic title and next numeric threshold (or `ALL`), and opens one shared inline radio/pressed selector containing None plus all earned tiers low→high. Mastering all four displays a separately selectable **God / 신** badge. Inactive created previews may select or clear their own title without becoming active. The semantic id is stored in that slot's `wj.lifetime`; unknown, malformed, or no-longer-earned selections display None, with stale earned-state mismatches reconciled after mount/slot change rather than during render. Reveal All exposes every title and God but never auto-equips or alters the prior selection. Titles have no gameplay effect. Balance telemetry counts only non-custom-seeded completed runs and shows recorded run count, win rate, and the Chapter with the most losses; per-Chapter loss counts remain profile-scoped in `wj.lifetime`. The nine progress save keys and profile metadata are isolated per slot while language, settings, and sort order remain machine-wide. Existing flat saves are P1. Delete Profile is available only for a non-active created slot and uses the same-button two-press warning: the first press only shows an inline destructive warning, and the second press deletes exactly the previewed slot. On the first Reveal All press, no effect is applied and a persistent per-profile warning explains the consequence. A later press fills every implemented locked/undiscovered registry in that profile and disables its Challenges; no other profile is changed. Once used, the Reveal All button is replaced by **Challenges disabled**. Its compact marker also makes all register mastery titles and God read as earned without synthetic word rows. A profile that earns every implemented word, presentation, Starting Pouch, Record, and upgraded-voucher unlock naturally instead shows **Your world is complete**. The Reveal All button uses the same muted teal background as the main-menu profile control and the same compact 34px height as Delete Profile. The compact applied marker makes all dictionary entries read as discovered without creating fake per-word play counts or scores.

The title selector's radio/pressed contract is implemented with native same-name
radio inputs: browser arrow/Home/End behavior is preserved, and opening the drawer
focuses the selected choice or its first None option. God remains a separate
`aria-pressed` header button.

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
corrupt save is **discarded, not migrated**. A saved Challenge shows its localized
name on Continue and restores its known `challengeId` plus seed; an unknown
non-null id discards the save.

The **Challenges** tab contains six ordered text rows: Red Pen, Rising Quota,
Narrow Desk, Three Passes, Balanced Burden, and Random Final. Challenge 1 starts
unlocked; completing N unlocks N+1; completed rows remain selectable for replay.
Each row exposes Locked/Available/Complete and uses a native button with
`aria-pressed`; the selected row shows its existing Pouch and Record art with the
shared tooltips/cursor reaction plus both localized effects. **Start Challenge**
uses a fresh random seed and replaces the same single `wj.run` as New Run, with
no seed input, confirmation modal, separate slot, reward art, or new currency.
Challenge Pouch/Record locks are bypassed only here. Reveal-All profiles retain
the list and genuine completion count but disable every Start action with a
reason. The tab strip is one `tablist`; all three controls expose `tab`,
`aria-selected`, and `aria-controls`, with matching `tabpanel` ids.

On the ordinary New Run tab, two stacked, non-wrapping carousel rows use the reference
layout: a tall left arrow, one central selection panel, and a tall right arrow.
The New Run tab initially selects the Pouch and Record used by the current or
most recently completed run; only a profile with no run history starts on Yellow
Pouch and White LP.
The larger Pouch row sits above the compact Record row; both panels put the
object on the left, the localized title over a white effect plate on the right,
and ordered position dots below. Both rows wrap in both directions: Previous on
the first item selects the last, and Next on the last selects the first.
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
- **Record** carousel: all 8 GDD §12.3 levels in ladder order. Each Starting
  Pouch has an independent Record ladder; changing Pouches immediately resolves
  lock state from that Pouch's wins without sharing progress. Locked levels are
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

Draft and Revision each show their fixed, seeded **Editorial Perk / 편집 특전** as a square pixel-art tag image immediately before the Skip control. The complete effect is available through the shared portalled tooltip and keyboard focus; the tag reacts to cursor position with the shared 3D tilt, lift, and sheen. Match the vertical reference hierarchy: the current card's full-width **Select** control is at the top, blind information fills the middle, and **OR / 또는** plus the `tag image → Skip` row is anchored at the bottom. Skip grants that exact perk and marks the old card Skipped without Fee Settlement or a shop. If the reward is immediate, its icon transfers into a focused `Tag Auto-Activated / 태그 자동 발동!` beat, brightens, and bursts away before the existing reward path runs. **Supply Tag** uses that beat and then creates up to two eligible Base Common Emoji Tiles, stopping at the shared profile, ownership, and effective-capacity gates. A free-pack Tag then opens the same ordinary Pack Opening flow as any other pack; it is not a duplicate or abbreviated pack implementation. Next-blind Tags advance in the tooltipped, cursor-reactive maximum-two lower-right stack; Select flashes `Tag Applied / 태그 적용!` and bursts them away on Play entry. Next-shop Tags remain in the stack through that blind and Fee Settlement. On the actual Shop screen, only Tags consumed by the generated stock flash `Shop Tag Applied / 문방구 태그 적용!` and burst away; an edition/voucher Tag that cannot resolve stays visible and may redeem on a later reroll or shop. **Reroll Tag** resolves on entry to the next actual Shop and changes that visit's reroll progression to $0, $1, $2… before ordinary discounts and floors. The next blind is constructed only after a free pack closes, ensuring pouch edits affect its opening draw. Upcoming perk icons and disabled Skip controls remain visible for planning. Deadline never renders Skip. Carried next-blind perks remain applied if another blind is skipped and are consumed only when Select begins an actual blind (GDD §8.2). Handy and Garbage tooltips display their live current-run payout. Skipping the tutorial-rigged first Draft disables the YELLOW coach lock for that run only, leaving the lesson available on the next new run. Reduced motion resolves the reward immediately. (changed 2026-08-21: 30 effect-specific image Tags; Supply and Reroll replace the retired Y/Omega effects)

### 2.4 Play Screen
Already specced in `docs/UI_DESIGN.md`; this section owns the screen-specific additions:
- **Joker tooltips** with live scaling values (global pattern §0); shelf tooltips open **downward** (playtest-03 E-7). Scaling Emoji Tiles always append a centred current-value row inside the white effect plate—even before their first trigger—formatted as `(현재 ×1 배수)` or `(현재 +0 칩)` with the value using the corresponding Mult/Chips colour.
- **Per-tile `+N` score popups** during settle (§0); joker wiggle + contribution popups (playtest-02 B).
- **Sidebar** (playtest-03 E-9): stage banner (Draft/Revision/Deadline) + ❄target + reward `$$$`; selected Record icon/name with its cumulative penalties in the tooltip; round score; large **0 × 0** box; the **selected-tile status text** (Word-Hand name / "not a word" / suit name) renders as plain text **above the 0×0 box** (no floating info near the hand); **Run Info** and **Options** buttons; phase & discard counts; `$` fee; **Chapter N/8**.
- **Run Info reference (changed 2026-08-14):** four tabs show Patterns, Word Hands, Blinds, and Vouchers. Pattern and Word Hand rows share a rightmost boxed run-use count after their Chips/Mult readout, rendered as a bare numeral with no unit suffix. Word Hands lists all nine hands in rank order with their fixed Chips/Mult bonus and run-use count; their conditions and gibberish eligibility use the same shared portalled row tooltip as sentence-pattern descriptions, not inline secondary copy. Type Economy, Vowelless, and Grand Palindrome mask both tooltip name and condition as `???` until first completion in that profile. The selected-tile sidebar status uses the same mask, while the successful settle stamp performs the reveal. The nine-row list scrolls inside the modal at short viewports so the modal itself can keep overflow visible for portalled tooltips. A hand with Mult uses the one-line coloured `+Chips ×Mult` readout: Chips keeps its additive `+`, while Mult drops the `+` after `×`.
- **No cash-out button** — the blind auto-settles (GDD §7.2).
- **Hand-tile discard marking (changed 2026-08-22):** right-click or hold an
  eligible unstaged hand tile with a primary touch for 500ms. Movement reaching
  the existing 5px Euclidean drag threshold first cancels the hold and keeps the
  ordinary drag path; movement below 5px preserves it. A successful hold toggles
  the existing mark exactly once, cannot turn into a drag before release, and
  suppresses its same-tile compatibility click/context menu. A shorter release
  remains the ordinary tap. Staged, disabled, boss-locked, guided-lesson, mouse,
  and pen inputs have no long-press marking. Pointer cancel/removal/eligibility
  change is a no-op, and Reduced Motion keeps the 500ms dwell.
- **Deadline entry reveal (changed 2026-07-29):** trigger only when the Deadline board actually enters `playing`, never while its card is visible on Blind Select. Continuing a saved run already inside that boss blind triggers the reveal again. Show the boss emblem, localized name, and full debuff text in a centred card whose height is **150% of the prior reveal**; once the entrance lands, hold it for **1 second**, then remove it with a lift/fade-out. It is informational and non-blocking; reduced motion removes the flourish.
- **Unopened Letter feedback (changed 2026-07-29):** after each hand play, the exact seeded-random tiles removed by the boss (up to four) visibly lift from the hand area one by one and fly into the discard direction while replacements settle. The animation is presentation-only; the engine-reported tile list is authoritative.
- **Zero-score boss feedback (changed 2026-08-20):** when the staged word will be debuffed to 0, every staged tile carries a red **Not Allowed** tag. The Play action remains available, but the preview hides POS and Word Hand. Submitting briefly shows a text-only white `Not Allowed` notice at the top centre of the workspace, using the title face at a materially larger size; it fades away automatically instead of persisting as a normal toast. The resulting tray word stays desaturated/dashed with no POS/Word Hand label so the wasted play remains legible. Only the 0-point settle plays—no tile/enhancement/Emoji/global score beats—and the submission is removed before Pattern/Unison display, joining the remaining eligible words on either side.
- **Stereotype Plate blocking (changed 2026-08-14):** its current threshold is the longest valid word already played this Chapter. A staged hand shorter than that threshold uses the blocked status and disables Play; this is an illegal submission, not the zero-score boss treatment above.
- **Briefcase balance beat:** after the last ordinary word hook (and separately
  after the last sentence-bonus hook), hold the final Chips/Mult pair, stamp a
  balance-scale pictogram, then tween both displayed axes to their exact
  arithmetic mean before multiplying. This beat is part of the settlement
  timeline and therefore extends `settleDurationMs()`; it may never be a hidden
  score rewrite or an untracked fixed delay. Reduced motion swaps the pair
  immediately but retains the labeled stamp.
- **Unified board** (E-5): tray + hand are one continuous board; only the joker/consumable shelves have a dark translucent panel, with `N/max` counts under them (E-6). Sort buttons sit in the Play/Discard cluster (E-8). Play word = blue, Discard = red (playtest-02 C-5).
- **Opening hand draw (feedback3):** only the individual tile flight animates; the hand row itself never translates. Its visible pouch origin is clamped inside the work panel so the clipped right edge cannot expose a temporary tile fragment.
- **Unified owned-card sizing (changed 2026-08-20):** shop offer stages, Emoji Tiles, held-consumable slots, and vertical vouchers share a rounded `124×165px` runtime footprint. Packs are the exception: sale packs use the requested older `131×229px` foreground and matching 131px row slots with a 12px gap; their panel reserves 84px below the row so Open is not clipped. Collection packs use `81×132px`; all pack art has square corners. Consumables remain in a 286px panel; the Emoji Tile panel takes the remaining shelf width with exactly 10px between panels. Empty positions have no placeholder. Owned Emoji Tiles use one fixed 12px inter-slot gap and the complete group is centred; when cards exceed available width, equal-width wrappers compress so the fixed-size cards progressively overlap. Hovered/focused/dragged cards rise above neighbours. Both panels share a fixed 187px outer height. The round-score panel always reserves its 22px live-pattern line so completing a pattern cannot reflow the rail. The main `.frame` and every shell-transition `.screen`/pane share the `1440×988px` outer design canvas, while existing inner content widths remain constrained. Viewport fit caps the requested UI scale instead of multiplying it, and reserves a 4px vertical rounding gutter; short viewports scale the canvas, long content scrolls normally, and menu↔run or shell slides cannot expose a shorter outgoing panel.
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
- Delayed clear rewards render as their own Editorial Perk line. Investment Tag
  remains in the run Tag stack through intervening blinds and activates above
  the overlay only when the successfully cleared Deadline reaches this screen.

Big gold banner button confirms and transitions to the Stationery Shop.
The modal is centred on the **physical viewport**, not on the main play column; the
persistent left rail must not shift it sideways.

After the monetary lines, a generated pixel-art proofreader stamp slams onto an
ink mark naming the awarded Word Hand. Stamp quantity is conveyed with ink pips,
never `Word Hand +1` or `+N stamps` text. If the award crosses a level, a
light-green localized `LEVEL UP! / 레벨 업!` VFX appears below it without showing level numerals.

### 2.6 Shop (Stationery Shop; changed 2026-07-28)
The completed blind does not navigate away. The persistent sidebar resets round score, Chips, Mult, hands and discards to zero and changes its blind badge to a large, centred marquee **SHOP** sign with a restrained idle glow/bulb cycle around all four outer edges. The SHOP badge stretches to the full inner width of the shop sidebar without changing its footprint, hit box, or baseline; reduced motion leaves the full perimeter visible and freezes its blink. The score reset is immediate: the consumed settle log/id, finalized-score fields, and sentence-bonus fields are cleared before the shop's first frame, and the count-up hook snaps to zero instead of replaying the last blind's score. Owned Emoji Tiles, consumables and the pouch remain in place, but the pouch contents/count immediately switch to the complete permanent `run.bag`; the completed blind's partial `blind.bag` is never shown in the shop. A lower shop panel rises in this order: **Next Blind → Reroll → items for sale → voucher → packs**. The three selling panels—items, voucher, and packs—centre their live offers with equal spacing and symmetric balance. Sold entries leave layout entirely, and every affected panel immediately recentres its remaining offers. Selecting an offer raises its complete product/price/action interaction owner by 59px (15px base + 44px action height), so the visible object and its hit-test geometry remain identical, and attaches its primary Buy/Redeem/Open button 8px directly below the actual foreground object. When available, **Use now** is the exception: it appears vertically centred 12px outside the product's right edge while Buy remains centred below. Buy and Use-now actions have a minimum 44px hit height. Card selection and its revealed action are separate buttons, so Redeem cannot toggle the card instead of firing. Tooltips are body-portalled per §0 and therefore do not depend on sale-panel overflow or stacking. (marquee changed 2026-08-20)
- **Catalog/Coupon Book vouchers** grow the item-slot count immediately in the same visit; each newly opened slot is filled without rerolling existing stock.
- A full consumable shelf disables **Buy** on consumable offers but leaves **Use now** available for affordable non-tile consumables; instant use never occupies a resting slot.
- Selecting a sale card keeps its purchase control attached below the card; when **Use now** is available, Buy stays below and Use now appears outside the card's right edge. Shop item ids and pack type/size pairs are unique within each stock roll. Shop-offered tile-targeting and blind-only Fables are Buy-only: they enter a held slot and cannot be used until a blind. A Gambler shows **Use now** only when its engine preconditions pass with no active tile field; otherwise it is Buy-only.
- **Charm Pack** emoji-tile choices are **greyed / non-selectable when joker slots are full** (D-5), with a "joker slots full" note.
- Voucher slot rules per GDD §9.2 (reroll-immune, ordinarily one purchase per chapter, Voucher Tag permits both next-shop choices, restocks at Deadline).
- **Voucher redemption (changed 2026-07-30):** Redeem shreds the voucher
  vertically from top to bottom: a cutter head descends, narrow cut lanes open
  behind it, and the separated strips drop away before the offer clears. Other
  shop actions are locked for that short beat; reduced motion clears it
  immediately.
- **Shop mascot:** **삐약이 (Piyak)**, a pixel-art **tuxedo cat proprietor**, sits at the bottom of the left rail (behind-the-counter feel), not overlapping the slots. Idle animation (single-sprite CSS breathe) + a speech bubble showing one random `mascot.welcome.*` line per shop entry, per UI_DESIGN §6. Purchase/reroll reactions are a later layer. Runtime art: `src/ui/assets/piyak.png`.

### 2.6.1 Pack opening (persistent-table panel)

Opening a pack sends the shop panel downward and replaces only the lower work panel; the persistent sidebar, owned shelves and pouch never unmount (changed again 2026-07-28; both the earlier overlay and dedicated screen are retired). Balatro's layout is the reference: **contents fan out large and centred, one clear action, no other UI competing.**

- **Layout:** pack contents fan across the centre as widened, image-first selection objects. A five-card fan uses a responsive five-column grid inside a widened, overflow-visible work panel: neither end cards nor their above-card tooltips may be clipped, and opening a pack must not create horizontal scrolling. The item art fills the whole choice footprint; names/effects stay in the tooltip, including live values such as The Heavenly Maiden and the Woodcutter's current Charm sell payout. A Tile-Pack choice uses a square footprint fitted to its tile image instead of inheriting the tall 5:7 consumable-card ratio. Tile-Pack and Charm-Pack **Select** actions are hidden until their stable choice shell is hovered or keyboard-focused. Every pack Select/Use action has a minimum 44px hit height. Every pack action is a sibling of—not a child of—the cursor-tilting card, and preserves its centring transform during active/disabled states, so pointerdown cannot move the button out from under pointerup. A Fable or Ink Pack first deals ten seeded tiles from the current pouch as its candidate field; random family choices appear with them. Candidates and compatible held Fable/Gambler Use actions on the persistent sibling shelf become active only after the 2265ms pack-ready gate and lock again during option/held-use resolution and closing. A revealed Fable has no button at rest. Selecting the card outlines it and reveals **Use** below; Use stays disabled until one to the effect's listed maximum valid candidates is selected for a tile-targeting effect, while a non-tile effect ignores candidate selection and never marks candidate tiles during its animation. Once ready, a compatible held Fable or Gambler can use the same active field. Direct-target Gamblers require exactly one valid candidate; Bridge, Butterflies, and Full Moon use the whole field; field-independent Gamblers ignore candidate selection. The held card is revalidated and consumed only when its existing preview/result sequence commits, then changed or removed candidates synchronize and selection clears without spending a pack pick or closing the pack. Created/copied tiles do not join the fixed ten-candidate row. Pressing Use casts from the card onto every selected direct target; direct tile-axis changes visibly preview and remain committed, while field-wide/random effects reuse the shared result vignette. Blind-only Fables reveal **Select** instead of Use and enter a held slot for later use; they do not gain a separate tooltip classification. Constellations use the same select-then-confirm structure, but always reveal **Use**, level the mapped pattern immediately, and ignore held-slot capacity. Current pack information and Skip sit along the bottom. The pick counter uses the pack's live family/size rules—Tile/Fable/Constellation show 3/5/5, Charm/Ink show 2/4/4, and Basic/Classic/Premium permit 1/1/2 picks—and decrements only when Use/Select resolves.
- **Open VFX (changed 2026-08-22):** reuse the selected pack illustration as two jaggedly clipped pieces inside one **2265ms** locked sequence, independent of game speed. During the 420ms stepped anticipation, the pack rattles, visibly compresses toward its lower anchor, and rebounds into the burst; body/top finish at 1100ms. The clipped split itself carries the tear, with no highlighted seam line drawn across the pack. From 420ms, one navy pixel back per actual option (2–5) pours for 700ms with a 60ms stagger, while flat gold/blue/red shards run from 400–1120ms. The existing real option shells begin their final fan landings at 1100ms, stagger by 60ms, and finish by 1820ms. The shortest two-choice spill remains visible until 1180ms, so outgoing fake backs overlap the incoming real shells without a blank frame or second landing. Ten candidates begin at 1500ms, stagger by 45ms, and finish exactly at the 2265ms ready point. Do not replace this with a generic scale-up, radial flash, smooth confetti, or unrelated box icon. Input remains locked through the ready point; reduced motion skips directly to enabled final choices.
- **Tile enhancement application (changed 2026-07-30):** whenever an existing
  candidate or hand tile changes, the shared tile renderer shows material as a
  warm forge burst with fragments, font as an inked type-press stamp, and edition
  as a chromatic ring/foil sweep. Simultaneous axes stagger material → font →
  edition. Reduced motion shows only the committed final face.
- **Skip:** a single, always-available Skip button. Packs may be left unpicked; unpicked contents are discarded. The close request establishes its gate immediately, cancels any pending held Fable/Gambler cast without consuming its card or RNG, and always completes the pack transition after the 360ms close beat.
- **Selection feedback is mandatory** (playtest: selecting an item currently does nothing visible): the chosen card lifts and pulses, gains a selected outline, the counter ticks down, and a confirm SFX fires. When the last pick is spent the overlay closes on a short beat, not instantly.
- **Every revealed item is hoverable with a full tooltip above the card** — see §0. Pack-choice tooltips never open beneath the revealed card.
- **Blocked picks read clearly:** when a choice cannot be taken (Emoji Tile slots full, §2.6), it greys with a reason label rather than failing silently on click.
- Under the CRT pass; respects reduced motion (fan appears without the flight animation).

During word settlement, contribution beats run at **600ms per tile/effect at 1× speed**, then divide at 2×/4×. Before beat zero, every submitted tile moves as one rigid row through a single desk slam lasting **650ms/400ms/280ms at 1×/2×/4×**, independent of word length. One shared contact tick starts all local material-family bursts together and may fire at most one settings-scaled screen shake and one `submitThock`; there is no tile stagger or final-tile transform. Reduced motion keeps the fixed 700ms settle with only a static contact highlight. Order is whole-word stamps → each played tile with its own enhancements and tile-triggered Emoji effects → global Emoji Tile list → held tiles frozen in visible play-time order → future consumable hooks → global/boss beats. The current tile lifts and bounces on every contribution. Its own base/material/font/edition values appear above it; an Emoji-authored tile effect only animates the target letter tile and shows its value once, below the firing Emoji Tile. The settle-complete signal derives from this same cadence. Speed and screen-shake edits never replay an in-flight submission: speed is snapshotted for that submission, Reduced Motion ON cancels outstanding work and switches it to the fixed 700ms branch, and OFF applies from the next submission. A chance-bearing Lead Plate material beat keeps a **600ms real-time minimum** at every speed so its rolled value remains visible, and the same duration source delays completion accordingly (group slam superseded per-tile impact on 2026-08-23).

Every definition left after the shared count-aware fold is an independent framed card stacked immediately left of its main tooltip, including material/font references, enhancement definitions, and Gibberish definitions. Its title uses the same bold white cyan/magenta-separated treatment as the main card. Every tooltip effect that needs a free consumable or Emoji Tile slot uses the shared capacity phrase “Requires available space” / “공간이 있어야 합니다” rather than naming the slot type.
Effect-description money values always use the shared gold `$` highlight. Any
description that mentions **Gibberish / 횡설수설** emphasizes that term in red
with a dotted underline and adds the shared secondary definition tooltip.
All localized effect/tooltip descriptions replace non-terminal periods with line
breaks and omit terminal periods while preserving decimal points. Every numeric value is tagged for emphasis. English and Korean keys, interpolation
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
breathe + slow sway. Runtime art: `src/ui/assets/woodak.png`. Stats panel, translated to our terms:
- Best word (intrinsic letter-chip sum + the word itself) · Most played pattern (e.g. "Transitive (16)")
- Words played · Tiles discarded · Items bought · Rerolls used
- **New discoveries: N** (ties into the collection tracking already shipped)
- Defeated by: boss badge · Chapter / stage reached
- **Seed + Copy button** (engine seed makes runs reproducible)
- Buttons: on the Chapter-8 win, Endless Mode · New Run · Main Menu; otherwise
  New Run · Main Menu. (The run-summary quip is now 우땅's speech bubble — see above.)
- An eligible Challenge Chapter-8 victory adds one compact localized
  **Challenge Complete · name** line; it does not add a reward screen.

### 2.8 Pouch widget + click view (주머니)
**Persistent pouch widget** bottom-right: the selected Starting Pouch's
illustration + `remaining/total` text that updates on every draw/discard. It is
an image swap in one shared box, never a pouch-specific layout. **Hover** opens
only a compact 13×2 A–Z grid at the workspace centre; every cell shows that
letter's current remaining count. It rises from below while the hand moves down
and the Play/Sort/Discard controls leave the bottom of the screen. **Click**
toggles the full Pouch view. The view rises from the bottom,
then settles at the exact centre of the game surface. Its content-sized width
and height follow the permanent tile count up to the viewport cap. It includes
a full-width Close button and no redundant title/remaining-count header.

The click view uses a wide two-column layout. Left = selected Pouch name/effect
plus permanent-Pouch vowel, consonant, and total tile counts; whole-Pouch
enhancement totals may follow, plus a compact **2-column × 13-row** A–Z grid
showing each letter's current remaining count. Main = every tile in the permanent Pouch, alphabetically ordered at
the exact in-game `64×64px` tile size. Tiles outside the current remaining Pouch
stay visible at reduced opacity. Every tile retains its live material, font, and
edition appearance, cursor tilt/sheen, and shared body-portalled tooltip.

**Remaining-count definition (D-1; shop exception 2026-07-31):** while a blind
is active or prepared, `remaining` = the undrawn pouch (`blind.bag`) **only** —
tiles in hand, played, or discarded have left it. In the shop, where no blind is
active, the same widget displays the complete permanent pouch (`run.bag`).
Coin Purse always starts from a total of 68; a letter with zero copies still
appears as a zero in the hover grid, but contributes no object to the click
view's permanent Pouch.

### 2.9 Collection (도감)
**Root screen = centred category modal** (not tabs — too many categories): a framed two-column menu uses thick red buttons and a full-width orange Back bar, following the reference layout. The left column is Emoji Tiles → Pouches → the paired Vouchers/Tags block → the inset Fable/Constellation/Gambler family panel; the right column is Enhanced Tiles → Editions → Card Packs → Palette → Mascots → Words → Blinds. Words and Blinds share the taller 84px category height; every ordinary standalone category and each of the three consumable buttons uses the 75px Voucher height. Emoji Tiles receives the freed left-column space and is 164px tall, keeping both columns equal in total height. Each button shows `discovered/total` and a `!` badge for new finds. The Words total is `???` until every eligible word is discovered, then reveals the actual count. Each category opens a content-sized detail modal using the shared grid card + pagination patterns (§0); every Collection pager is circular in both directions, including the one-at-a-time Pouch carousel. Card Packs alone reserves the tallest two-row gallery height across all family pages so paging never resizes its modal. Mobile collapses the menu to one column.

| Category | Contents | Notes |
|---|---|---|
| **Words** | profile challenge strip (highest-scoring word · longest word · most-played word · discoveries), then tabs: **Words** = tile-styled entries with search/suit filter and pagination; **Register Scores** = live Standard ×1 / Formal ×10 / Slang ×5 / Vulgar ×7 cards with role copy and discovery counts | Both tabs share one fixed-height, internally scrollable content slot so switching never resizes the modal. A successfully submitted valid word reveals its spelling and original register; gibberish, previews, and blocked submissions do not. Undiscovered slots show neutral `???` with no tooltip, accessible name, or register styling that exposes the hidden entry. Search and register filters operate only on discovered entries, and their result counts stay literal. Reveal All treats every dictionary entry as discovered without fabricating play statistics. Register Scores has no separate scoring-formula intro paragraph. Highest score uses only the intrinsic letter-chip sum; material/font/edition, Mult, Emoji Tile, boss, and sentence effects are excluded. Old settled-score records are recomputed from the word on read. Until full completion, the category total and unfiltered page total display `???`; the discovery record remains literal. |
| Jokers | all Emoji Tiles, rarity-ordered, paginated **5×3 grid (15 per page)** | image-only `124×165px` runtime frame, exactly matching the in-run card size (84×112 pixel masters scale with nearest-neighbour rendering); its detail modal removes the redundant outer padding and never shows an internal scrollbar; no wrapper or rarity border; shared idle float and cursor tilt/sheen; tooltip shows name, rarity, and full effect |

All 150 public Emoji Tile images use the shared `jokerArt` resolver on every rendered
surface. The developer-only Primordial image uses the same resolver but never appears in Collection.
| **Enhanced Tiles** | two paged views using the shared `< · page · >` footer: page 1 Materials = 9 tile faces (base + 8 enhanced, including Wood); page 2 Fonts = 5 Futura variants | both pages render large pixel-art tile swatches; Font tooltips show each seal effect from `balance.ts` `fontEffects` (GDD §2.3) (changed 2026-07-31) |
| **Editions** | Base / Gray / White / Rainbow / Violet | five runtime-size Emoji Tile samples in one unbroken horizontal row using the live edition overlays; the horizontal-scroll layer is separate from the overflow-visible card layer so lifted/tilted card tops are never clipped; narrow viewports scroll horizontally instead of wrapping; each tooltip names the edition and its effect; White remains Emoji-Tile-only per GDD §11.8 |
| Vouchers | 32 tickets | 16 base/upgraded pairs; four pairs per page; locked upgrades show only “Undiscovered” and the unseeded-run discovery hint — no name, effect, condition, or progress |
| **Tags** | all 30 Editorial Perks | two-page 5×3 pixel-icon gallery (15 per page); every effect-specific image uses the same idle/cursor tilt and shared tooltip as Blind Select; Tags are a complete rules reference and have no discovery lock |
| **Fable Cards** | 20 implemented cards | supplied pixel art keeps a path-only SVG master and uses its pixel-identical `500×700` PNG runtime derivative in a 5-column, 10-per-page gallery; hover shows the full effect |
| **Constellation Cards** | 12 implemented zodiac cards | supplied monochrome pixel art uses the same SVG-master/`500×700` PNG-runtime contract and 5-column, 10-per-page gallery; hover shows the mapped sentence pattern |
| **Gambler Cards** | 14 implemented cards | supplied artwork uses the same SVG-master/`500×700` PNG-runtime contract and 5-column, 10-per-page gallery; every card uses its live runtime tooltip |
| Card Packs | Tile 8 · Charm 4 · Fable 8 · Constellation 8 · Ink 4 | four-page image-only gallery: Tile, combined Charm + Ink, Fable, Constellation; every page contains eight cards and therefore shares the same two-row height; all 32 supplied artworks keep a shared `244×400` path-only SVG master and use its pixel-identical PNG runtime derivative plus the common idle and cursor tilt/sheen, with no persistent type/grade/coming-soon labels; hover or keyboard focus restores the shared type/description/grade tooltip |
| **Palette** | 11 chromatic unlocks (feature-02 C) | locked = grey silhouette + letter-count hint ("R _ _"); unlocked = the word in its group color |
| Mascots | WooDak skin roster | **primary skin picker** (moved from Settings 2026-07-29): one horizontal, centred, non-wrapping card row; discovered tooltip-wrapped cards and undiscovered raw cards share the same 150px basis width; locked skins use non-selectable silhouettes; unlocked cards select on click/keyboard and mark the equipped skin with a gold outline and Selected label |
| **Starting Pouches** | 14 object-art entries from GDD §12.2 | one-at-a-time circular `arrow | panel | arrow` carousel with art left, enlarged bold localized effect right, 14 position dots below, and the shared orange Back footer; signed/count values and voucher names use semantic highlight colours; unlocked = full art/effect with no unlock copy; locked = silhouette + generated arcade-pixel lock sprite + exact unlock condition only; the tooltip retains the actual name/effect (changed 2026-08-12) |
| **Blinds** | left: Chapter → base target table (from `balance.ts` anteBaseTargets, incl. endless rows); right: Draft/Revision badges + 21 boss chips (undiscovered = `?`) | doubles as the player-facing target-curve reference; boss cards retain their tooltip and use shared cursor tilt/sheen |

Fable reports `20/20`, Constellation reports `12/12`, and Gambler reports `14/14`
supplied artworks. All fourteen Gambler effects and their Ink Pack,
Comic-Book-gated Fable mixing, and Deer-in-Constellation routes ship per GDD
§10.3.

**Omitted by design (no equivalent — do not add):** Seals as a separate category (their roles are absorbed into the font layer — GDD §2.3 seal-port).

### 2.10 Options root
Buttons: **Settings · Statistics · Collection · Credits**. There is no Help screen (removed 2026-08-01: the glossary duplicated the in-play encounter popups and tooltips, which stay the only explainer surfaces). The guided tutorial has no replay button. (Balatro's "deck customization" → our tile-skin customization is **[PLACEHOLDER: omit button entirely for now]**.)

### 2.11 Settings
Mascot selection does not live here. It is owned by **Collection → Mascots**, so
discovery, inspection, and equipping share one surface.
The standalone screen and the in-run pause version are centred on the physical
viewport in fullscreen as well as windowed mode. In-run Options is portalled outside
the zoomed board root so fullscreen/UI scaling cannot pull it toward the top.
Tabs — trimmed for a web game:
- **Game**: game speed (1/2/4 — settle-animation multiplier) · screenshake slider · reduced motion toggle (mirrors `prefers-reduced-motion`, user-overridable) · language (ko/en) · hint highlight color-blind-safe palette toggle · **"don't show tips" toggle** (kills the first-encounter tutorial popups, feature-01 A-2).
- **Graphics**: **CRT effect on/off · scanline intensity slider · CRT bloom on/off** (see UI_DESIGN §"Surface language"). CRT Off hides scanlines, vignette, and bloom; Bloom is independently switchable. The board keeps its responsive viewport-fit zoom plus the UI-scale slider. There is no integer-scale option: quantizing the shared 1440×988 interface would make it unnecessarily small or letterboxed on common displays.
- **Video**: fullscreen toggle · UI scale slider. The fullscreen toggle mirrors the browser's actual `fullscreenElement`; when ESC exits fullscreen externally, the toggle immediately synchronizes to Off. (No monitor select/VSync — web.) Reveal All belongs exclusively to the selected profile screen (§2.1).
- **Audio** (changed 2026-08-19): master / music / SFX sliders with value badges drive the **live Web Audio mixer** (`src/ui/audio.ts`, feature-01 B). SFX and two loop-safe synthesized BGM contexts (menu/run) are shipped; Shop keeps the run loop playing through a muffled low-pass, and Deadline uses the unchanged run loop. No remote audio assets are required. The context unlocks on the first user gesture (autoplay policy), settle-sequence SFX scale with game speed, and the `MUSIC`/`SOUND` Palette entries gate their respective buses. The Audio tab has no sound-effect or music preview controls.
All 14 value settings use the shared tooltip on row hover, native-control focus, and touch pin; Escape, outside tap, tab change, and unmount close it without consuming the setting action.

### 2.12 Statistics
The accessible **Overview / Words / Emoji Tiles** tabs replace the earlier placeholder. Overview shows Best word intrinsic letter-chip score · Highest ante/blind reached · Most played pattern (ties prefer the higher sentence-pattern rank) · Most gold held · Wins · Best streak.
Right column: overall progress % — Collection %, Challenges completed out of
**6** (or **Disabled** after Reveal All), and Records won summed across all 14 independent
Pouch ladders. Custom-seeded and Challenge wins are excluded from Pouch/Record
unlock progress, Emoji Tile Record stickers, and balance telemetry. Challenge
wins still count in ordinary lifetime runs/wins/streak and other real-play
progress. Profile exposes completed balance-run count,
win rate, and the most common loss Chapter; the profile save retains the full
per-Chapter loss histogram.
**Words** lists only genuinely played collection entries with plays, intrinsic Chips, and first discovery date in bounded 50-row pages; the collection is loaded once and sorting begins only when this tab opens. Reveal All never fabricates plays. **Emoji Tiles** lists the production roster and each definition's finalized blinds completed while owned. Copies count once per blind, locked names remain `???`, skipped blinds do not count, and developer-only Primordial is excluded.
Run-end totals use a persisted UI-only run observation id plus the profile lifetime's last completion token and cumulative pattern/Emoji Tile baselines. Reloading Game Over, retrying a blind-stat write, or continuing Endless therefore cannot add runs, wins, patterns, or owned-blind counts twice; replaying the same custom seed still creates a distinct observation id and remains a separate run.

### 2.13 Credits

The Credits panel uses four compact, accessible tabs so attribution never
overflows the shell screen: **Team · Visuals · Audio · Fonts**. Team names Ben
Kim for game design/planning, development, and art direction, with an AI-use
disclosure. Visuals disclose the ChatGPT/Claude-assisted generation and editing
workflow without implying rights in third-party material. Audio distinguishes
original runtime-synthesized BGM/most SFX from the 17 local Kenney Casino Audio
1.1 samples used for pack, reroll, and chip sounds under CC0 1.0. Fonts list
Jost, Noto Sans KR, Baloo 2, and Jersey 10 with their exact authorship and SIL
OFL 1.1 source information. A tab-independent native **Legal Notices** disclosure
shows the bundled English license texts in a bounded internal scroller, followed
by `© 2026 Ben Kim`; it uses no fetch, CDN, link navigation, or new window.
The distributable copies live under `public/licenses/` so browser and `file://`
desktop builds carry the same version-locked software, font, audio, and lexical
notices.

## 3. Build notes

- All screens are pure UI over headless engine state. Starting-Pouch/Record rules
  come from GDD §12 and engine definitions; New Run, tooltips, settlement, and
  Collection only present their resolved values. Challenges are headless
  `ChallengeDef { id, pouchId, recordId }` presets that reuse that same resolution
  order; UI components never recreate their effects or balance values.
- **Persistent in-run table (changed 2026-07-28).** `ScreenTransition` is retired from blind↔shop↔pack↔blind-select changes and remains available only for shell navigation such as menu↔run.
  - **Panel direction:** phase panels enter from below and leave toward the bottom. Use Ease-Out Back for entry and a short ease-in for exit.
  - **Performance:** CSS transforms on the panel wrapper; never per-frame React re-renders. Action resolution waits for the exit beat so an unmount cannot cut it off.
  - **In-run motion:** lower panels enter upward and leave downward. Sidebar, owned shelves, Run Info access and pouch remain mounted. Fee Settlement and Game Over remain overlays.
  - **Reduced motion:** `prefers-reduced-motion` removes panel travel.
- **Panel and board animations are sequential.** Blind cards leave downward before the hand draw and play/sort/discard controls enter. Pack contents begin only after the shop panel has left.
- Every string through i18n (ko/en) from day one.
- The five `WOODAK_SKINS` entries own 30 local cursor PNGs (normal/hover/active × monochrome/colour). Loading decodes the selected skin's six files before the first interactive screen and hides the non-interactive loading-screen cursor; a later skin/unlock change keeps the current mascot hand until the next six files decode, then swaps all states atomically. Vite resolves their imported URLs into the offline bundle; there is no runtime fetch or external URL, so the same output works on the web, Electron `file://`, and a future coarse-pointer mobile build where custom cursor rules do not apply.
- `npm run e2e:smoke` builds and drives the shipped `file://` app through
  Collection → New Run → Play → reload/Continue → Fee Settlement → Shop → Pack.
- Priority order: **2.5 Fee Settlement → 2.6 Shop → 2.3 Blind Select → 2.7
  Game Over → 2.2 New Run → 2.1 Main Menu → 2.8 Pouch View → 2.9 Collection →
  2.10–2.12 Options/Stats**. (The first four complete the run loop; the rest are
  shell.)
