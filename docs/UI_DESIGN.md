# Play the Wor!d — UI Design Spec

**Score Keyboard panel LEDs (changed 2026-09-03):** Tier 5–6 active and clear-hold beats blink the three red/yellow/green indicator LEDs painted in the keyboard image, using a deterministic random-looking staggered order that changes each beat/cycle. The full-keyboard rainbow ring and Tier 6 jackpot sparks are retired. Reduced Motion freezes these LEDs at low intensity; Forced Colors hides them.

> **Art direction:** pixel-art + CRT with Balatro-style screen grammar. **Layout changed 2026-07-28:** the in-run UI is rebuilt as one persistent table; sidebar, owned shelves, Run Info access and pouch remain fixed while lower work panels move.


**Design thesis: pixel-art arcade roguelite with a CRT finish.**
The game embraces a **pixel-art / CRT aesthetic** in the Balatro lineage: chunky pixel panels, a scanline+bloom CRT post-effect, punchy arcade score feedback. The prior "ceramic letterpress, deliberately un-Balatro" direction is **retired** (see changelog) — the earlier trade-dress guardrail no longer applies. We still don't copy Balatro's *actual art assets* (its specific card illustrations, its logo, its exact sprites), but we freely adopt the pixel-art idiom, CRT treatment, and screen grammar. Tiles read as **printed/stamped letter tiles rendered in pixel art** (the publishing-world fiction and materials/fonts from GDD §2.2–2.3 are unchanged — only their *rendering style* becomes pixel-art).

This document and `docs/screens-spec.md` together are the visual contract. When
they disagree, the more recently dated decision wins and both documents must be
synchronized in the same change.

---

## 1. Design tokens

### Palette

| Token | Hex (true) | Use | Chromatic group (C) |
|---|---|---|---|
| `--bg-desk` | `#22443B` | table surface (deep desk-green, vignetted) | **GREEN** (locked `#313733`) |
| `--panel` | `#20303B` | UI panels (dark slate) | — |
| `--panel-edge` | `#39505E` | panel top-edge highlight | — |
| `--ink` | `#EDEAE2` | primary text on dark | — |
| `--ink-dim` | `#9DB0B8` | secondary text | — |
| `--chips` | `#3FA7F5` | Chips (blue — genre convention) | **BLUE** (locked `#8A9299`) |
| `--mult` | `#F5504E` | Mult (red — genre convention) | **RED** (locked `#9C8785`) |
| `--gold` | `#F0B23E` | money, current pattern, target-cross/score-keyboard accent | **YELLOW** (locked `#A89E84`) |
| `--tile-face` | `#F4EDDF` | letter tile face (warm ivory, pixel-art shaded) | — |
| `--tile-ink` | `#2B2620` | tile letter ink | — |

Suit colors (word frames & badges): standard `#B9C4CB` · formal `#7E96F2` · slang `#F09437` · vulgar `#C6479E`. Vulgar is magenta, not red — red is reserved for Mult.

> **Chromatic unlocks (feature-02 C, GDD §13 — "truly monochrome", raster expansion 2026-08-28).** The **entire** palette holds **neutral grey** locked values by default (not just the four accent tokens) — the slate chrome, tile faces, and suits are grey too, so the world starts *genuinely* black-and-white. Group assignment: **RED** = `--mult`, `--suit-vulgar`; **YELLOW** = `--gold`, `--suit-slang`, `--tile-face`; **GREEN** = `--bg-desk`; **BLUE** = `--chips`, `--suit-formal`, `--suit-standard`, `--panel`, `--panel-edge`, `--inset`, `--inset-edge`. Playing the color word toggles an `unlock-<group>` class on `<html>` that swaps in the true hex (token swapping in `tokens.css`), re-coloring progressively. The shared luminance-preserving `#unlock-chroma` matrix applies the same active set to Emoji Tiles, blind/Deadline emblems, Editorial Perk Tags, Vouchers, Packs, Fable/Constellation/Gambler cards, and Starting Pouch/Record art on every ordinary surface. Zero colors is greyscale, partial unlocks restore only their RGB channels, and all four restore the original master. Apply the matrix inside an art layer when the outer object owns hover/tilt/drop-shadow/tear/edition animation; locked silhouettes and boss-disabled states override it. Unlock Recap reward art, mascot/full-body art and native cursor switching, the CRT overlay, and semantic warning/focus states keep their dedicated presentation contracts. Blind-badge and blind-kind colors already use `--badge-bg`/`--kind-*` tokens; the **`world-mono` guard** only needs to catch remaining hard-coded fills such as material faces while no color is unlocked, and drops on the first unlock. MUSIC/SOUND gate the audio buses, not colors. Names, silhouettes, textures, ordered dots, labels, and tooltips keep identity non-color-only, so the grey start stays readable.

### Type

| Role | Face | Notes |
|---|---|---|
| Score display / big numbers | **Jersey 10** (Google Fonts) | already a pixel face — keep; it now sets the tone for the whole UI rather than being the odd one out |
| Tile letters | **Jost** | the GDD's own Futura stand-in (§2.3). **Five fonts** map onto Jost styles, matching the persisted `TileFont` union (`medium`/`lightItalic`/`bold`/`inline`/`black`): Medium 500 (base) · Light Italic (Jost 300 italic) · Void (internal `bold`: Jost 500 + `.48em` same-ink stroke, scaled to `.61`, closing counters; G restores an exaggerated bar/terminal so it cannot read as O) · Inline (500 + text-stroke outline) · Black 900. The four non-base fonts carry **seal effects** (GDD §2.3); tile tooltips read the effect text from `balance.ts` `fontEffects` — never hard-coded |
| UI labels / body | **Baloo 2** | rounded, chunky; sentence case |
| Tooltip descriptions | **Jost 700 + Noto Sans KR 700 fallback** | compact printed-game copy with restrained cyan/magenta separation; tooltip titles remain in the chunkier UI face |

> **Pixel-font note (art-shift) — RESOLVED to (a), "modern pixel hybrid"; Void changed 2026-08-01.** Jost and Baloo 2 are smooth vector faces that read slightly against the pixel-art surfaces; we **keep them**, rendered at crisp sizes, and lean on Jersey 10 (already a pixel face) for headline/numeric moments. The two candidates considered were **(a)** keep the current faces as a hybrid — *chosen* — and **(b)** swap UI/tile faces for true bitmap fonts (Pixelify Sans / Silkscreen / Departure Mono), *rejected*. The mapping stays **five** — Jost Medium 500 (base) / Light Italic (Jost 300 italic) / Void (persisted `bold` id; Jost 500 with counters consumed by expanded ink) / Inline (500 + text-stroke) / Black 900 — matching `TileFont` and `fontClass()`. Void replaces the visually ambiguous Bold 700 and the typographically out-of-axis Underline decoration without changing saves, font files, or engine rules; unlike Black, it closes the glyph's negative space instead of selecting a heavier weight.

### Surface language (pixel-art / CRT)

- **Pixel grid.** Author raster art at fixed pixel resolutions and render it with `image-rendering: pixelated`. Every shell-transition canvas—Main Menu, New Run, Run, Collection, Options, Profile, and Laboratory—shares the `1440×988` outer board (`--board-max` / `--board-h`) and responsive viewport-fit zoom plus the Settings UI-scale slider. Screens use that common minimum-height canvas while their existing inner content widths remain constrained; short viewports fit-scale and long content scrolls normally. This prevents the outgoing/incoming slide from clipping against mismatched screen heights. The scale is intentionally not quantized to integer steps, avoiding excessive letterboxing or an undersized board. Borders/shadows are 1–2 "big pixels" wide, not sub-pixel. (changed 2026-08-20)
- **Hard offset shadow** stays the signature surface cue but as blocky pixel shadow: a solid dark step down-right (no blur), e.g. a 4–5px hard offset that reads as a chunk, not a soft `box-shadow`. Buttons depress on press (translate + shadow collapse).
- Radius: panels and controls prefer squared or 1-step chamfered corners. **Card objects are the exception (changed 2026-07-30):** Emoji Tiles, consumables, sale offers, and vouchers share one rounded silhouette. Pack art keeps square corners.
- Panels get a light top-edge pixel highlight (`--panel-edge`) and a dark bottom-edge for the stamped/embossed look.
- **Modal frame (changed 2026-08-01):** every modal panel uses the Collection frame: `3px` `--panel-edge` outer border, `3px` inset `--inset-edge`, `18px` radius, and a hard `7px` down-right shadow. Nested Collection views render only their inner Collection frame, never a duplicate outer frame. Coach-mark mascot speech bubbles keep their separate pixel-tail grammar.
- **CRT post-effect** (global, toggleable in Settings, GDD/screens §2.11): scanlines + slight bloom + subtle barrel/vignette. Ship it as a full-screen overlay/shader pass so any screen inherits it. Must be **disable-able** (accessibility + the reduced-motion/low-end path), and scanline intensity should be a slider (the reference build exposed a "CRT" strength + "CRT bloom" toggle).
- **WooDak hand cursor (changed 2026-08-20):** fine-pointer devices use an original 32×32 pixel hand belonging to the selected, unlocked WooDak skin. Each skin ships normal, hover, and pressed/active poses with a `(3,3)` fingertip hotspot; locked, invalid, or missing-art selections fall back to WooDak, while Piyak never participates. Every pose has a matching monochrome derivative used during `world-mono`, then its colour master appears after the first colour unlock. Letter tiles keep the mascot hover pose at rest and the active pose throughout press/drag instead of switching to an OS grab cursor. The selected six files decode before the first interactive screen; later changes keep the previous mascot hand visible until the replacement set is decoded, preventing keyword-fallback flashes. Text, help, non-letter dragging, crosshair, not-allowed, Windows forced-colors, and coarse/no-hover environments retain system cursor semantics.
- Background: `--bg-desk` + vignette; noise/texture rendered at the pixel grid, not as a smooth gradient. The Main Menu adds a low-resolution phosphor grid and one slow composited scan beam beneath the global CRT overlay; reduced motion freezes the beam. Its logotype uses stepped diagonal hard-shadow extrusion plus a slight perspective pitch for a 3D pixel-art silhouette, floats through eight discrete vertical/tilt steps, and periodically punches the red exclamation mark through a short three-frame accent. These title animations are Main-Menu-only and stop under either reduced-motion path.
- **Startup developer ident (input skip changed 2026-08-31).** Before the real Loading screen, show only the bundled Sweet Turtles mark—no publisher beat—as a two-sided `300px` coin capped at `62vmin`. Its front is the true circular, centred `object-fit: cover` logo; its neutral metal back carries raised `ST`, never mirrored logo art or text. The ident covers the physical viewport with literal `#000` above the global CRT layer, independent of palette/background tokens. The logo and complete ident always render in their original colours with `filter: none`; they never read profile unlocks or use `#unlock-chroma`. The normal automatic beat remains 3850ms: 0–1000ms drops from `-34vmin`, fades in over 120ms, and rotates vertically on `rotateX` from `0→1260deg` while scaling `.70→1.04`; contact compresses the coin and expands its shadow; 1000–1220ms bounces `-18px` and turns `1260→1440deg`; 1220–1450ms relands/decelerates to `1710deg`; 1450–1600ms snaps to exactly `1800deg` (five turns, front visible); 1600–3600ms locks the front for exactly two seconds, plays one ring shine, and reveals the Sweet Turtles name; 3600–3850ms fades the whole ident out. The cue combines one bright metallic ding at the initial appearance, deterministic spin ticks, contact/body impact, bounce clink, and final metallic shine through a fixed peak-safe output wholly separate from every game mixer setting, mute, and Palette audio gate. Web playback is one best-effort ungestured attempt and never queues for a later gesture; Electron enables that attempt before window creation. Either reduced-motion path still auto-completes at 2240ms with no drop, flip, bounce, shadow, or shine: a static front fades in for 120ms, stays fully visible for exactly two seconds, and fades out for 120ms while one small metallic brand chime plays. The beat starts only after the local image loads and decodes. Preparation shows only the black backdrop and consumes but ignores input. Once the ready logo or text fallback becomes one viewport-sized accessible button surface, its localized action name explains that any ordinary key, primary mouse/touch/pen press, or accessibility click continues immediately to Loading; there is no separate visible Skip button. The error/two-second-timeout fallback stays silent and auto-completes after 700ms. One pre-locked finish path arbitrates input and automatic timers, and unmount cancels every pending visual/audio timer and disposes a running ident cue. The consumed gesture never reaches Loading/Main Menu or the gameplay mixer unlock/button-press path. No path adds fake loading progress or persistence.
- **Gameplay speed/audio settings (layout/copy clarified 2026-08-30):** Game offers only 1× and 2×. The note is exactly `Audio / 오디오`. Music and SFX share one four-column `label | slider | value | mute` grid: desktop `minmax(72px,1fr) minmax(140px,160px) 44px 76px` with 12px gaps, and ≤480px `64px minmax(96px,1fr) 36px 68px` with 8px gaps. Both native checkboxes visibly read `Mute / 음소거` but retain bus-qualified accessible names. There is no public Master control. A slider edit never unmutes, and unmute restores that slider's retained value. Gameplay gain is the Palette bus gate AND not-muted, then group volume × recipe gain. Legacy Master 80/Music 70/SFX 80 migrates once to Music 56/SFX 64; Master 0 preserves both stored groups and mutes them. New mute booleans make stale Master irrelevant, and normalized writes drop it. The startup ident remains outside this contract.
- **Unified Video settings (changed 2026-09-03):** Settings has exactly Game / Video / Audio tabs; the former Graphics controls follow Resolution, Fullscreen, and UI scale inside Video. The Windows desktop Resolution selector offers 960×600, 1280×800, 1600×900, and 1920×1080 as equal windowed-content choices, disables decorated sizes that do not fit the active work area and reports manual sizes as Custom. Fullscreen disables it. Browsers show a disabled automatic/browser-managed row. These choices change only the viewport around the fixed 1440×988 continuously fit-scaled board; they never switch physical display or render resolution, quantize scale, or persist a duplicate value in `wj.settings`.
- **Palette Convenience / 팔레트 편의성 Settings action (changed 2026-09-03):** the Game tab ends with one ordinary Settings row for the current profile's four colors plus MUSIC/SOUND. It uses a compact blue exchange button and an inline warning below the row, not a modal. First press arms and announces the irreversible warning; second press persists the profile grant, durably absorbs the synthetic ids into any active/saved-run recap baseline, then fires one atomic aggregate reveal containing only actually added definitions. Reuse the global 2.6-second, click-dismissible, Reduced-Motion-aware `ChromaticReveal` grammar with one neutral wash and one fanfare; its `document.body` portal is above the pause overlay and below the tooltip layer, so it remains visible from in-run Settings. Show only `The world has been restored` / `세상을 되찾았습니다`, never six individual word reveals. Tab change, Back, or unmount clears the armed state, and completion leaves a disabled final label. It never includes mascot skins, broader progress, or synthetic run-end recap entries.
- **SHOP marquee (changed 2026-08-20):** the existing sidebar badge footprint and hit box stay fixed, while the light treatment runs around all four outer edges rather than occupying a single bottom row. Reduced motion keeps the complete perimeter visible and freezes only its blink cycle.

> **Migration note.** Existing components keep their semantic tokens (`--chips`, `--mult`, `--gold`, suit colors) while adopting the pixel/CRT surface. The earlier “layout stays” constraint is retired by the 2026-07-28 persistent-table rebuild.

The 1536×864 reference framing is the placement baseline: a fixed left rail occupies
roughly 22% of the width, owned shelves reserve the upper band, the pouch owns the
lower-right dock, and phase-specific content aligns to the remaining work surface
rather than the full viewport centre. Blind cards use the broad lower work surface;
play hands and ordinary pack choices sit lower; Fable and Ink packs use two tiers
(ten candidate tiles above, card choices below) with pack information and Skip at
the bottom. Fable cards have no resting button: selection reveals Use, or Select for
a blind-only card. The ten pouch candidates appear during opening but become
interactive only when the shared 2265ms pack-ready gate opens; compatible held
Fable/Gambler Use actions on the persistent sibling shelf share that lock during
opening, option/held-use resolution, and closing. Once ready, either a revealed
targeting card or a compatible held card can use the same active field. Direct target changes
preview before commit; field-wide/random results reuse the shared vignette. Overlays such as Fee
Settlement and Options are the exception: they centre
on the physical viewport.

Shop Buy/Use-now controls and pack Select/Use controls use a minimum **44px**
height; held-consumable Use matches it. Their visible button is also the full hit
target—no smaller nested click region.

---

## 2. Play screen layout (primary screen)

```
┌────────────┬──────────────────────────────────────────────┐
│  SIDEBAR   │  JOKER SHELF (owned emoji jokers)  CONSUMABLES│
│  blind     ├──────────────────────────────────────────────┤
│  badge +   │                                              │
│  target    │   SENTENCE TRAY  ← signature element         │
│            │   [THE][CAT] … words placed left→right,      │
│  score     │   suit-framed, POS tag under each,           │
│  chips×mult│   pattern status chip at the right end       │
│            │                                              │
│  pattern   ├──────────────────────────────────────────────┤
│  phases ●●○○   STAGED WORD preview (validity·suit·score)  │
│  discards  │                                              │
│  gold/ante │   HAND (10 pixel-art tiles, slight fan/wobble) │
│            │        [PLAY WORD]   [DISCARD]               │
└────────────┴──────────────────────────────────────────────┘
```

**Signature element — the Sentence Tray.** Balatro has no equivalent: our played words accumulate left-to-right *as a sentence under construction*. Each played word is a mini-card group (its tiles shrunk), framed independently in its suit color, with every lexical POS candidate rendered as its own localized chip beneath—never slash-joined. Every POS chip uses the same compact rectangular shape with no family marker, but all ten ids have distinct neutral tokens and distinct unlocked colours: noun/interjection belong to BLUE, the three verb subtypes to RED, adjective/adverb/article to YELLOW, and conjunction/preposition to GREEN. No two ids share their final colour. The localized label remains authoritative while locked neutral luminances preserve the distinction in `world-mono`. Once a pattern wins, compatible candidates from the headless judgment are accented and alternatives are dimmed through their background/border—not container opacity; equivalent winning parses keep their union active. Resolved chips expose localized compatible/alternative accessibility labels without single-selection semantics, and forced-colors mode preserves the resolution-state distinction with solid versus dashed borders plus a non-layout-shifting active outline. With no pattern all candidates remain equal. Candidate rows wrap without overlap (up to seven tags). The staged-word preview reuses the same separate chips without inventing a selected POS. Gibberish keeps the cracked/burned **hole** label and debuffed words keep Not Allowed with no POS. At the tray's right end, a pattern status chip shows the live judgment ("Transitive ✓ ×2" / "— no pattern"). This tray is the game's identity on screen; spend the polish budget here. (changed 2026-08-30: ten unique POS colours)

**Hand-tile input (changed 2026-08-22):** tap/Enter/Space stages a tile;
pointer movement reaching 5px becomes the existing drag. Right-click marks an
eligible hand tile for discard; a primary touch held for 500ms performs that same
mark once. Sub-5px touch jitter preserves the hold. A completed hold is consumed
through release, so it never also drags, stages, or fires a second context-menu
mark. The guided lesson's discard step is the sole right-click lock exception: only
its seventh opening-order spare may be marked, then the ordinary Discard button must
commit it. Guided-lesson touch long-press remains disabled. Staged, disabled,
boss-locked, mouse, and pen gestures do not gain touch long-press behavior. Reduced
Motion does not shorten the input dwell.

**Guided action spotlight (changed 2026-08-30; tracking corrected 2026-09-03):** the discard/build/submit steps all target one dynamic `.tutorial-action-target`, assigned only to the currently permitted DOM action. The unmarked spare advertises right-click; after marking, enabled Discard advertises left-click; each next protected YELLOW physical tile and enabled Play advertise left-click. `SpotlightBubble` keeps its body portal and per-RAF rect tracking, applies 8px padding, and has no `top`/`left`/`width`/`height` transition; animated or replaced targets are followed on the next paint rather than chased by a positional tween. Fine mouse pointers alone see a neutral 40×40 CSS mouse just outside and within 48px of that rect; coarse pointers see none, and both reduced-motion paths keep it static. Its neutral contrast remains readable through `world-mono`.

**Palette reminder toast (changed 2026-09-03):** use a `document.body` portal so it stays pinned to the physical viewport's top-right outside the filtered/zoomed board. The complete pixel-panel notice is one full-width native button in a polite status live region, with its close mark inside the hit target. Enter from beyond the right edge in 240ms, hold six seconds, and leave right in 180ms; hover/focus pauses the hold. Both Reduced Motion sources remove transform/opacity animation and show/remove instantly. It is non-modal and never dims, blocks, or reflows the play board.

Sidebar (top→bottom): blind badge (kind + boss name when boss) with target score; the current Deadline boss emblem is keyboard-focusable and opens the shared portalled localized name/full-description tooltip (including live parameters such as Dead Letter's letter) ·
selected Record icon/name · committed score as `[chips]×[mult]` blue/red boxes ·
current highest valid sentence-pattern name and live bonus score in gold as
`pattern name : score` (there is **no** early-end/cash-out button, GDD §7.2) · phase dots ·
discard dots · gold · Chapter N/8. The `bb-art` blind emblem carries a restrained
3px idle float/scale loop, disabled by either reduced-motion setting. During a
round, the selected Starting Pouch art occupies the pouch dock beyond the right
edge of `main.main` and the black play surface (`right: -96px`) while retaining
a visible click target.

---

## 3. Component inventory

| Component | Notes |
|---|---|
| `Tile` | 64px (integer-scaled) pixel-art letter tile: face, uppercase A–Z letter, chip value bottom-right. Carries up to **three stacked axes** (GDD §2.4): material + font + edition. See the material legibility rules below. Selected = raised + gold pixel outline. Hand tiles reuse one input controller for tap, 5px-threshold drag, right-click discard mark, and 500ms primary-touch discard mark. |
| `SentenceTray` | see §2. Includes `HoleSlot` (gibberish) and `PatternChip`. |
| `RunInfo` | Four-tab modal for Patterns, Word Hands, Blinds, and Vouchers. An active Challenge adds one conditional full-width gold pixel banner between the header and tabs: minimum 56px high, 10×16px padding, 3px frame, inset edge, 4px hard shadow, and 22px safely wrapping localized text. Normal runs reserve no banner space. Patterns starts with nine public rows. Object Complement, Ditransitive, and Complex are omitted entirely—no placeholder, tooltip, or accessibility node—until the current run's first successful authoritative highest-pattern activation; Compound stays public. Revealed rows persist through Continue for that run, while a new run hides them again. Existing level, Chips/Mult, tooltip, and finalized run-use-count presentation applies unchanged once a row exists. |
| `JokerCard` | **Fixed 124×165px near-3:4 image-only runtime contract**, shared with the resized shop offer and held-consumable footprints. Existing 84×112 pixel masters scale with `object-fit: contain` and `image-rendering: pixelated`; those 30 masters in `src/ui/assets/jokers/` are the canonical references for every new entry. Match their roster-wide **Pac-Man-style early maze-arcade** system: deep navy playfield, white/red/yellow/cyan-led 3–5-color palette, one large blocky silhouette, hard un-antialiased pixel edges, and the same sprite scale/line weight. No painterly object icon, gradient, shadow, scenery, texture, lighting, or small decoration. This means the visual grammar only—never copy Pac-Man characters, ghosts, maze layouts, or other original assets. Reuse the same source on shelf, shop, opened-pack, and Collection surfaces through the shared actual-object renderer, which owns idle float, cursor tilt, and sheen by default. A composite such as Shop/Pack may pass `motion=false` only because its parent already owns that motion; never nest motion owners. Name, effect, and rarity stay in the tooltip. Collection alone may overlay the highest earned Record as the small upper-right mastery sticker; it reuses `recordArt`, has no gameplay effect, and its Record is explained by the shared tooltip. |

**Tile score ink (changed 2026-08-01):** every live base score has a distinct
letter/value ink: `3 #54432f` (the established colour, unchanged), `6 #3f694d`,
`9 #315f86`, `12 #5b4f8b`, `15 #844b78`, `24 #9b4938`, and `30 #8a6420`.
These inks follow the chromatic palette unlocks: **YELLOW** restores 3/30,
**GREEN** restores 6, **BLUE** restores 9/12, and **RED** restores 15/24. Before
their group unlocks they use luminance-matched neutral-grey tokens. Stone remains
unclassified/letterless, and dark material faces still override score ink with
the accessibility light ink.

The held-consumable panel keeps its 286px width. The Emoji Tile panel fills all
remaining shelf width with an exact 10px gap between panels. Empty-slot
placeholders are not rendered. Owned Emoji Tiles use a fixed 12px inter-slot gap
and the whole live group is centred. Actual 124×165 cards never resize: their
layout wrappers shrink evenly only when available width is insufficient,
producing progressive overlap. Hover, focus, and drag lift the active card above its
neighbours. Both panels share the same fixed 187px outer height and reuse the
sidebar's dark translucent `--rail-surface` background and edge.

Scaling Emoji Tile tooltips use the standard title → white effect plate → rarity
badge stack. Inside the effect plate, a separate centred muted row always shows
the live value, including before the first trigger: `(현재 ×1 배수)` for
multiplicative growth or `(현재 +0 칩)` for additive Chips growth. The numeric
value uses the matching Mult/Chips highlight colour.
When an Emoji Tile has a standalone current performance/value followed by a
separate rule, decay, or condition explanation, the localized base value ends
its own line and the explanation starts on the next line (for example Drying
Ink: `+15 Mult` then its vowel-decay rule). Copy whose value and condition form
one inseparable rule stays inline. This explicit locale newline is shared by the
Shop, owned shelf, opened packs, and Collection; the separate live-value row is
unchanged. (changed 2026-08-20)
Pouch Tag uses the same row for its conditional live payout, formatted as
`(현재 +N 칩)` from the current remaining pouch count. Active/prepared blinds
read `blind.bag`; the Shop reads the complete permanent `run.bag`.
For additive Chips/Mult values, only the numeric portion uses the axis colour.
A filled Chips/Mult box is reserved for multiplication and wraps only the
leading `×N` factor. `Chips`/`Mult` and `칩`/`배수` always use the normal
body colour outside the box. Every semantically highlighted phrase is an atomic
line-breaking unit: combinations such as `+2 Mult` / `+2 배수`, money values,
rarity names, and card-kind names move to the next line as a whole and never
split internally (changed 2026-07-31).
Non-base edition names stack as coloured tags beneath that main stack instead
of being appended to the effect plate. Their effect definitions render in a
separate card immediately to the main tooltip's left. Letter-tile material,
font, and edition enhancements follow the same tag-and-definition pattern. One
supplement remains immediately left of the main tooltip. With two or three, the
highest-priority one folds into the main effect plate and the rest stay left;
priority is **material → font → edition**. This distribution also includes
automatically referenced font, edition, and Gibberish definitions. When one
description references exactly three Emoji Tile editions, all three edition
definitions stay left; if another definition exists, only the highest-priority
non-edition definition may fold. This distribution is otherwise unchanged when
the main tooltip opens downward. Any tooltip effect copy that names a tile font
automatically adds that font's canonical effect card. Explicitly marked Gray,
Violet, Rainbow, and White edition names likewise use their edition colour in
the copy and add that edition's canonical effect card; property/object names
containing the same word do not count. *(Changed 2026-08-01: referenced editions
join the count-aware supplemental-tooltip packing introduced by feedback3.)*
Edition-granting consumable descriptions name their possible editions but hide
the individual outcome weights; this does not alter internal seeded weights or
a separate activation chance such as `1 in 4`. (changed 2026-08-20)
*(Changed 2026-07-31: feedback3 compacted
multi-definition stacks while preserving every explanation.)*
The shared tooltip frame follows the reference as a scalable image-like panel:
mint pixel edge, charcoal scanlined shell, pale inset plate, and white titles
with subtle cyan/magenta separation. Standard main width is content-responsive
from 150–280px. Letter-tile tooltips instead use one fixed 132px compact frame
regardless of enhancement count, with the standard 18px title and 15px body sizes
so the highlighted `[c:+N개의 칩]` / `[c:+N Chips]` line does not leave sparse empty
space. Each left supplement derives its width from its own visible title and body
copy, clamped to the shared 150–280px range and the viewport. Supplemental height
follows wrapped content, with the same 7px top / 6px bottom shell padding as the
main tooltip. Bottom tags remain 72% of their main card.

All descriptive copy wraps only at word boundaries (`word-break: keep-all` and
`overflow-wrap: normal`); an unbroken token is never split. Pouch selection and
clicked-open Pouch descriptions use the same rule. All tooltip copy uses the enlarged readability scale: 18px title, 15px body,
13px live-value row, and a 280px maximum card width. Shared tooltips are rendered
through a `document.body` portal above the CRT and every product panel, so their
layout is never clipped or covered by the hovered surface.
Money amounts in effect descriptions always use the shared gold `$` highlight
markup. **Gibberish / 횡설수설** references use the shared red underlined term
style and automatically add a secondary definition card explaining its ×1
scoring and sentence-pattern hole.
Emoji Tile rarity names inside tooltip copy use explicit semantic markup and
inherit the exact Common/Uncommon/Rare/Legendary colour of the matching rarity
badge in both locales.
All effect/tooltip descriptions in both locales replace non-terminal periods
with line breaks and omit terminal periods; decimal points remain intact.
Every literal numeric value in those descriptions uses semantic rich-text
markup, and matching locales keep the same placeholders and highlight axes.
`scripts/check-locales.mjs` enforces these rules during every build.

**Emoji Tile art (direction corrected 2026-07-30).** The original 30 assets and
every promoted roster asset must be brought into the Pac-Man-style maze-arcade
system above. Generic painterly pixel icons are not acceptable. Masters live
under `src/ui/assets/jokers/` and scale into the shared 124×165 runtime frame.
The ten reviewed 3×3 source sheets for the promoted 86 are retained under
`docs/Arts/emoji-bank-pacman-sheets/`; each runtime master maps to exactly one
named cell rather than being inferred from one oversized contact sheet.
`src/ui/jokerArt.ts` is the single resolver
used by shelf, shop, opened-pack, and Collection surfaces. All assets use the
image-only early-arcade style. Collection presents them at the same 124×165
runtime size in a paginated 5×3 grid (15 per page), fitted without an internal
scrollbar.
| `VoucherCard` | **One shared vertical rounded card** in the shop, Collection, and Run Info (`124×165px` at the base UI scale, changed 2026-07-30). The centered icon uses the matching PNG from `docs/Arts/Voucher/` for each of the 32 vouchers (including `StoryBook.png`); warm paper/dither, heavy pixel frame, vertical VOUCHER marks, and a black inset nameplate remain. Price and purchase controls sit outside the card. Every voucher uses the shared card idle float and cursor-following 3D tilt/sheen. **Collection layout (changed 2026-07-27):** four base→upgrade pairs per page in a 2×2 pair grid, four pages total. Locked upgrades render as muted `?` cards named **Undiscovered / 발견되지 않음**. Their tooltip contains only “Redeem this voucher in an unseeded run to discover what it does.” / “시드되지 않은 런에서 이 바우처를 교환하여 기능을 알아보세요.” The real name, effect, unlock condition, and progress are not exposed until unlocked. |
| `TagIcon` | **Square 160×160 transparent pixel-art master** with an ivory stepped frame, deep-navy inset, and one large effect-specific arcade symbol. All 30 masters live in `src/ui/assets/skip-rewards/`; Blind Select and Collection use the same resolver, shared tooltip, idle float, keyboard focus, cursor tilt/lift, and sheen. No words, numbers, scenery, gradients, or generic repeated badge substitute. Collection presents a 5×3, 15-per-page gallery. |
| `ShopOffer` | **Image-first sale slot (action width corrected 2026-09-03).** Emoji Tiles, consumables, and vertical vouchers use the shared rounded `124×165px` stage. Sale packs use the requested older `131×229px` foreground with square corners; their row slots are also 131px wide so the normal 12px inter-item gap remains visible. The pack panel reserves 84px below its layout row so the attached Open button stays inside the persistent run layer instead of being clipped at the bottom. Collection packs remain `81×132px` with square corners. Price and contextual action live in one moving interaction layer: selection raises the product, price tag, attached action, and their hit-test owner together by the 15px base lift plus the 44px action-button height, 59px total. The voucher/pack background panels keep a `273px` minimum height. Product motion remains unclipped. The price badge sits 23px above the image and the selected **Buy / 구매**, **Redeem / 교환**, or **Open / 열기** button attaches beneath it at the original 82px minimum width; the shop-scoped width wins over the larger global blue-button rule. **Use now / 즉시 사용** appears vertically centred 12px outside the right edge. Names and classifications remain available through the shared tooltip. |
| `HeldConsumable` | **Object-layer shelf rendering (resized 2026-07-29; actions changed 2026-09-02).** The `124×165px` held slot matches the shop offer and Emoji Tile footprint and is only a transparent layout reservation. Supplied 5:7 Fable/Constellation art fits directly inside that foreground object without distortion—no beige wrapper card, inset image box, persistent name, crop, rectangular sheen, or empty-slot placeholder. The foreground itself owns idle motion, cursor tilt, keyboard focus, click selection, and the shared tooltip. Shop, shelf, opened-pack, and Collection copies resolve through the same consumable-tooltip helpers, including referenced material sub-tooltips and any run-dependent live value wherever a run is available; intentionally hidden locked Collection entries remain the exception. Sell and Use are descendants of the same `TiltCard` as the art, so cursor tilt, rotation, scaling, lift, and idle motion transform the card and actions together. The selected card remains pointer-active so a second click closes this reversible action menu. Sell is vertically centred at the card's right and Use sits beneath it; both match the shop Buy button's dimensions. Owned Emoji Tiles use the same centred Sell position and shared `TiltCard` interaction. |
| `ScoreBox` | blue Chips box × red Mult box, Jersey 10 numerals, count-up animation on settle. Both axes use shared `formatScore`: integer rounding, comma groups below 10,000,000, scientific notation from 10,000,000, and an em dash for non-finite values. Each formatted string is reused once and independently classed by visible length: ≤7 characters uses 52px, 8–9 uses 38px, and ≥10 uses 30px. The inner numeral is centred, single-line, and clipped to its box while the outer box stays overflow-visible for contribution VFX. Accessible labels announce localized Chips and Mult with those exact formatted values. The actual axes are never redistributed. Semantic effect popups keep their own axis precision. |
| `Button` | **Play word, Buy, and Redeem = blue; Discard and Sell = red; Use and Use Now = green**. Gold remains for Cash out / early end. Depress on press. |
| `CurrentPatternStatus` | During play, gold pattern symbol + localized name for the highest valid pattern formed by already-submitted words + its live sentence-bonus score, formatted as `pattern name : score` (GDD §7.1). At finalization this same reserved line becomes the shared Pattern/Unison/Mixed headline; it keeps the complete visible/accessibility text and semantic colour contract, and the score box adds no duplicate pattern stamp. |
| `PouchArt` | One resolver for all 14 Starting Pouches (GDD §12.2). Every runtime image uses the current default's exact `510×511` transparent RGBA canvas and comparable occupied bounds; copies fit with `object-fit: contain` into the shared 72×72 dock, 140×140 New Run preview, and 176×176 Collection carousel preview. Actual interactive Pouch renders use the shared renderer, which owns one idle/tilt/sheen layer by default and exposes `motion=false` only to an existing composite motion owner. New Run and Collection use a circular large `arrow | panel | arrow` selector: Previous wraps first→last and Next wraps last→first. Collection shows one Pouch at a time with art on the left, localized name/effect on the right, and 14 position dots below. The effect panel uses enlarged bold copy; signed/count values, scoring axes, money, and owned voucher names use the shared semantic rich-text colours. Unlocked panels show name/effect without unlock copy; locked panels show a muted silhouette, the centred generated `pouch-lock.png` arcade-pixel sprite, `Locked / 잠김`, and the unlock condition only. The tooltip still supplies actual name/effect and, only while locked, the condition. Art is a simple standalone pixel object—no text, scene, frame, smooth gradient, lighting, or pouch-specific wrapper. Military Pouch carries a chunky olive/khaki camouflage pattern inside the unchanged shared silhouette and hardware. |
| `RecordArt` | One resolver for the 8 cumulative Records (GDD §12.3), also on a `510×511` transparent RGBA canvas. White/Red/Green/Blue/Yellow LP share pixel-identical black vinyl and change only the centre-label colour. Clear LP uses a white label and semi-transparent dithered acrylic disc. CD is visibly smaller than LP in the shared frame; DVD matches CD size with a distinct rainbow-iridescent pixel pattern. Actual interactive Record renders use the shared renderer, which owns one idle/tilt/sheen layer by default and exposes `motion=false` only to an existing composite motion owner. New Run gives Records a compact 88×88 preview below the Pouch selector. Every Starting Pouch has its own independent Record ladder, so changing Pouches recomputes the lock state from that Pouch's wins. Name, added penalty, cumulative marker, ordered dots, and lock state communicate the ladder; unlock-condition copy never appears in the panel or tooltip. Records have no Collection category. |
| `UnlockRecap` | A separate body-centred run-end dialog shown before the ordinary summary only when new availability exists. Its overlay is portalled to `document.body`, outside `.frame`, so the fixed dialog stays viewport-centred and its full-colour reward exception cannot be re-greyscaled by the board's `world-mono` filter or displaced by board zoom; ordinary Game Over remains in the run frame. It reuses the canonical Emoji, Voucher, Pouch, Record, and mascot art resolvers; Challenge cards pair their preset Pouch + Record, while color/audio use the shared swatch/`UiIcon` grammar. The outer recap card stays static: each physical Emoji/Voucher/Pouch/Record object owns exactly one shared motion layer, including both members of Record+Pouch and Challenge pairs, with no pair-level or nested tilt. A mascot card title and tooltip use the localized mascot display name (for example `누렁이`), never its unlocking word (`DOG`). The speaker portrait and its single compact unlock line use the currently selected WooDak skin's `voicedKeys` chain; win/context copy is deferred to the ordinary summary, and a newly unlocked mascot appears only as its content card until selected. The recap bubble sizes to its copy up to a `260px` outer cap and uses `--fs-2xl` text; visible body, card-name, pager, and confirmation copy also use `--fs-xl` or larger. Cards are tooltipped, focusable, and ARIA-labelled. Every page contains at most three cards. Card tracks stay fixed at `148×214px` regardless of page population; mobile uses `min(132px, available column width)×178px` in two columns. The grid and pager slots reserve their full page height even when the final page is sparse or pagination is unnecessary, so the modal never resizes between pages or unlock counts. Overflow uses the shared circular `< · page · >` pager rather than scrolling, and cards have no pop animation under reduced motion. |

**Shop Use Now money ledger (changed 2026-09-04).** Only money-gaining Fables
identified by the registry's `doubleGold` and `jokerSellGold` effect kinds replace
the ordinary net-delta popup. Their successful atomic transaction presents one
nonzero signed price beat first and the full nonzero payout second. Each full-motion
beat has its own trigger animation above the consumable result vignette; Reduced
Motion removes travel but retains both texts in cost-then-payout DOM and readable
visual order. The shared result vignette opens once and keeps the full payout.
Rapid transactions queue instead of replacing an unseen beat. Both co-mounted
money readouts suppress the matching ordinary net popup, but only the Shop rail
owns the one portalled ledger/live region; all signed text uses `formatScore`.

Roster-specific Pouch reads are fixed: Lucky Pouch has one centred gold circular
emblem; Pencil Case and Coin Purse are open and empty with no pencils or coins;
the case-shaped object is displayed as **Briefcase / 서류 가방** while its
internal id remains `lunchBag`.

---

### 3.1 Material legibility (playtest: "I can't tell which material a tile is")

Nine materials (GDD §2.2) cannot be separated by face tint alone at 64px — especially under the CRT pass, which softens fine differences. Three rules:

**① Every material gets a texture/detail cue, not just a hue.** Texture must survive desaturation (the game may be running fully monochrome, §13). **All nine materials share Ceramic's exact outer border, 10px radius, and rounded silhouette (changed 2026-07-30); material identity must stay inside that common edge.**

**② Material identity stays in the face treatment and shared tooltip (Wood copy changed 2026-09-04).** Persistent condition symbols were retired because they competed with the letter score. Wood alone keeps its live +Chips growth value, coloured with the Chips ink, including on submitted mini tiles. A concrete tile's main tooltip shows one combined current Chips total (letter Chips + live Wood bonus), for example `+18 Chips`; the supplemental generic Wood reference states only the +10-per-play growth rule, so a Wood reference such as Woodpecker never invents a current +15 value. Porcelain rosettes sit bottom-left and top-right so the bottom-right score stays clear.

| Material | Face treatment | Extra face value |
|---|---|---|
| Ceramic (base) | warm face, quiet inset rim and corner dimples | — |
| Porcelain | bright glaze, cobalt inset ring and bottom-left/top-right rosettes | — (flat +Chips) |
| Polished | mirror-bright bevel, broad fixed diagonal buff band, corner sparkles + frequent animated pixel shine sweep | — (flat +Mult) |
| Glass | translucent facets, inner glow and crossed crack lines | — |
| Stone | heavy internal bevel and high-contrast pits, **no letter** | — |
| Lead plate | dark type-metal face and diagonal wear scratches | — |
| Ivory | cream face, gold inset ridge and curved Schreger-line grain | — |
| Brass | engraved face, double inset edge, etched ring and corner screws | — |
| Wood | strong grain and a visible knot | **live growth counter** — the tile's current +Chips, since it permanently grows +10 per play; a Wood tile that has grown must *look* grown |

**③ Ink contrast is per-material.** `--tile-ink` gets a light variant for dark faces (Lead plate, Stone, and any future dark material); the letter and chip value switch to it automatically. Never let a dark face keep the default dark ink — this is an accessibility floor, not a preference.

Font and edition sit *on top of* material, so a tile can show all three at once: read font from the letter's weight/style, edition from its overlay (gray sheen / violet shimmer / rainbow cycle), and material from face texture plus tooltip. Keep the three visual languages non-overlapping.

**Enhancement application motion (changed 2026-07-30).** `TileView` compares the
same tile id's three axes and plays a distinct application beat whenever one is
replaced: material expands as a warm forge burst with outward fragments; font
lands vertically like an inked type press; edition receives a chromatic ring and
foil sweep. If several axes change together, they play in material → font →
edition order with a short stagger. This is one shared tile-level treatment, so
hand, shop, pouch-candidate, pack, and Collection surfaces cannot drift. Reduced
motion shows the committed final face immediately.

**Letter-tile editions (changed 2026-08-05)** use the same colour vocabulary as Emoji Tiles: Gray = high-contrast gunmetal with a three-pixel silver frame and diagonal print hatching, Violet = ash violet, and Rainbow = animated rainbow. Gray uses normal blending so it remains unmistakable beside a base tile; Violet/Rainbow stay translucent beneath the material texture, and every edition still leaves material grain, hardware, cracks, and highlights readable. White is Emoji-Tile-only and never renders on a letter tile.
**Emoji Tile editions (changed 2026-07-31)** use background colour, not persistent special-character badges: Gray = ash gray, Violet = ash violet, Rainbow = animated rainbow, White = white. The treatment overlays the existing Pac-Man-style pixel-art master without adding labels, borders, or scenery. Every non-base Emoji Tile tooltip names the edition in a stacked bottom tag and explains its effect in the left supplemental card.
**Collection reference (changed 2026-08-14):** Collection → Editions presents Base, Gray, White, Rainbow, and Violet as five runtime-size Emoji Tile samples in one unbroken horizontal row using those same live overlays. Narrow viewports scroll horizontally rather than wrapping. Hover/focus copy reuses the canonical edition name and effect; White is not shown as a letter-tile edition. Collection → Emoji Tiles counts only profile-eligible definitions as discovered; an undiscovered tile fully hides its artwork behind a neutral card and lock mark. Its tooltip reads `Not discovered / 발견되지 않음` and only advises purchasing or using it in an unseeded run; identity, effect, condition, progress, and any Record sticker remain hidden. A discovered tile with Chapter-8 mastery overlays the existing art for its highest cleared Record at the upper right; the sticker stays inside the card's tilt layer and adds a supplemental tooltip definition naming that Record.

## 4. Juice spec (motion)

Priority order — implement top-down, cut from the bottom if time-boxed:

1. **Word settle sequence** (the core dopamine loop, GDD §7.1 layer 1; group slam changed 2026-08-23): whole-word stamps (suit/gibberish and the highest Word Hand) → played letter tiles from first to last, with each tile's base score, material/font/edition, and tile-triggered Emoji effects kept together → the owned Emoji Tile list from first to last → tiles still held in the hand, frozen in their visible order at Play time → consumable hooks (reserved for future mechanics) → global/boss beats → committed score rolls. **Play first runs a UI-only physical-impact prologue before score-event beat zero:** all submitted tiles move as one rigid `.submitted-tiles` row through anticipation, drop, contact, and recoil. Its duration is independent of word length: **650ms/400ms at 1×/2×**. One contact tick applies every local material-family burst simultaneously and fires at most one settings-scaled screen shake and one `submitThock`; it never staggers or gives the last tile a special transform. Ceramic/Porcelain/Ivory throw dry square dust, Polished/Lead Plate/Brass ring and glint, Glass produces a non-destructive angular flash, and Stone/Wood throw block/grain debris. Reduced motion keeps the existing fixed 700ms settle, removes movement/debris/shake/slam audio, and shows only a static contact highlight. The stronger Word-Hand ring appears only when the existing `letterHand` score event lands, so the prologue never reveals a hand early. The currently evaluated tile lifts slightly; every score/effect beat makes it bounce. A letter tile's own base/material/font/edition contribution uses the source tile's glow/wiggle plus a large popup above it with Chips, Mult, multiplicative factor, gold, chance, or retrigger as applicable. When an Emoji Tile effect targets a played or held letter tile, that letter tile still glows/wiggles but does **not** repeat the score tag; the single value readout appears below the firing Emoji Tile. Retrigger-only beats display localized `Again / 다시` instead of a font-dependent symbol or an empty tag. Additive Mult popups use the red Mult colour and render `+N` only; they do not append a redundant `×`. Every firing Emoji Tile shows its effect in a large popup below its owned slot: Chips reuse the blue diamond score-box treatment, additive Mult is red `+N`, multiplicative Mult is red `×N`, money uses the gold `$` readout, flat score uses the tomato symbol, and an effect without a numeric/symbolic readout displays localized `Applied / 적용`. A compound Emoji effect emits one beat per actual application: Type Orchestra fires once per distinct non-Medium font, on that font's first tile in word order, each showing `×1.25`; Medium emits nothing and repeated copies of one enhanced font do not add beats. **Whenever a scaling Emoji Tile's live value increases, the same owned-slot wiggle and axis-coloured numeric popup must fire; scoring growth is an ordered score-event beat, while discard/consumable/blind-end growth fires directly from the committed state change. Wastebasket uses this state-change route for its first-discard `+$2` wiggle and popup, while the central `run.gold` watcher owns the single coin sound; its blind reset is silent, and the post-blind cleanup event re-arms it after temporary boss debuffs are removed. Decreases stay silent by default, but the explicit decay roster—Dulling Pencil, Drying Ink, and Folding Manuscript—updates its tooltip value and emits the matching negative popup. Each value clamps at zero; on its terminal trigger the popup completes before the owner is removed. Blind resets always stay silent.** Score-box-only feedback is insufficient. The **1× baseline is 600ms per ordinary scoring beat**, divided at 2×; settle completion uses the same calculated duration. Chance-bearing Lead Plate beats keep a **600ms real-time floor** at every speed so their result badge can appear before the next beat, with completion derived from that same timing. Enhanced Emoji Tiles keep the ordinary 0.55-second popup/0.32-second wiggle and use a **1000ms timeline slot at 1×**; the longer slot is separation between adjacent trigger/enhancement beats, not a stretched animation.
   **Conditional-growth timing (changed 2026-09-04):** a conditional growth or decay beat follows its exact committed cause before any unrelated beat. Each actual Glass destruction material/result beat is followed immediately by its applicable destruction-growth Emoji Tiles in physical shelf order. This visual placement does not apply the new value retroactively to the shattering word; Term Insurance and Type Foundry use it from later words. Survival, prevention, duplicate destruction, and debuff add no growth beat.
   **Owned-list edition order (changed 2026-09-03):** within the global owned Emoji Tile list, each physical owner presents its Gray/Violet/Rainbow scoring edition before its intrinsic effect and growth/decay beats, then advances left-to-right. Base/White add no scoring-edition beat. Tile-bound Emoji effects remain in the earlier played-letter phase.
   Settings changes never replay an in-flight submission: its speed is snapshotted at start, screen-shake changes affect only later hits, Reduced Motion ON cancels outstanding work and switches immediately to the fixed 700ms static branch, and OFF applies from the next submission.
   “Per actual application” applies uniformly to every per-letter, material,
   font, position, and held-tile Emoji effect: the running axes mutate on that
   tile's beat, and a full-tile retrigger repeats every applicable effect. For a
   held Black tile, that means its held-tile Emoji hooks and material repeat in
   their existing order; held base Chips and editions remain inactive, and an
   otherwise inert tile emits no retrigger beat. (changed 2026-09-04)
   **Briefcase adds the final axis beat** (GDD §12.2): after every ordinary
   word hook, show a balance-scale stamp and tween the Chips and Mult boxes from
   their final values to their exact shared arithmetic mean, then multiply.
   Repeat independently after every sentence-bonus hook. The beat belongs to the
   score-event log and `settleDurationMs()`; never hide the transform or guess
   its duration. Reduced motion keeps the labeled stamp and snaps the values.
   A debuffed submission is the explicit short-circuit: after pure word-rule
   lookup it shows only a 0-point settle. It has no POS/Word Hand label or
   tile/Emoji/global contribution beats and is removed before sentence-pattern
   Unison, and register-synergy presentation, while remaining visible as a disabled tray play.
   Normal eligible words on either side join for judgment. (changed 2026-08-20)
2. **Pattern update** (Score Keyboard sample mapping changed 2026-09-02): immediately after submit, the visible positive projection delta is snapshotted once for that `settleId` as Score Keyboard sentence assist; the pattern symbol/name still re-evaluate with a soft flip after settle. Later BUILD/LAND changes never reclassify the peak. Reaching the target is signalled separately by the once-per-blind main-Enter strike only when the engine's post-boss `projectedScore` authoritatively clears it, so Will's earlier pre-halving axes cannot fire a false cue. Enter uses its mapped WAV at the existing `deskEnter` accent gain, with the synthesized `deskEnter` bottom-out/return only as playback-failure fallback, while scoring continues toward the settle-complete gate (GDD §7.2).
3. **Tile idle wobble**: each hand tile rotates ±1.2° on its own slow sine (staggered delays) — the "alive" feel. Fresh tiles fly from the live pouch position through `useFlip`; the visible origin is clamped one tile inside the work panel so a tile can never flash as a clipped fragment at the right/bottom edge. The hand row has no separate entrance translation. Wobble is suspended during the flight and starts from the flight's matching −1.2° landing angle, so entry never hands off through a visible extra hop. **Jokers & consumables share this wobble family (feature-02 D-4)**; the firing joker is excluded so its settle wiggle wins.
4. **Card motion (changed 2026-07-30):** vouchers, packs, and every Fable, Constellation, and Gambler card idle with a slow 3px float plus ±0.45° sway. Pointer movement pauses the idle loop, lifts and scales the card, tilts it in 3D toward the cursor, and moves a radial sheen with the pointer; leaving eases flat and resumes the idle phase. Keyboard focus straightens, lifts, and adds a gold outline. Generic select = rise 10px + gold ring; shop-offer select raises the complete product/price/action layer by 59px (15px base + 44px action height). Collection pack entries keep the grid image-only—no persistent pack-type, grade, or coming-soon label—but restore the shared type/description/grade tooltip on hover or keyboard focus.

   **Consumable resolution (changed 2026-08-06):** every Fable or Gambler effect without a bespoke target/Constellation sequence opens the shared result vignette after the card cast. The effect commits and opens its vignette before a final pack pick removes the pack surface; pack closing must never cover or precede the result. Effect prose wraps only at word boundaries (`word-break: keep-all`; `overflow-wrap: normal`); an unbroken token remains intact even if it overflows. The vignette is derived from the committed run-state diff: destroyed letter tiles crack and burst into pixel shards before collapsing, destroyed Emoji Tiles collapse, and changed and created objects then pop in. Economy changes use a large, borderless `$` readout; chance outcomes, including edition-enhancement success and failure, use display-sized text. Hand-size and pattern changes keep their compact value stamps. This includes pouch-only creations that do not enter the current hand. Full Moon therefore visibly destroys its chosen random tile and then reveals all three created enhanced vowels. Rendered result objects retain their shared tooltips. Reduced motion keeps the result readable while removing the movement.
   **Pack opening (changed 2026-08-22):** the complete gated sequence uses the restored **2265ms** baseline and stays independent of the 1×/2× game-speed setting. During the 420ms anticipation, the pack rattles, visibly compresses toward its lower anchor, and rebounds into the burst; body/top collapse finishes at 1100ms, the tear flash at 840ms, and the ink burst at 1000ms. The jagged clipped split carries the tear without a highlighted seam line across the pack. Exactly one fake back per real option (2–5) starts at 420ms, staggers by 60ms, and the fifth finishes at 1360ms; rectangular gold/blue/red shards run from 400–1120ms. The existing real option shells—not duplicate placeholders—begin landing on their final fan paths at 1100ms, stagger by 60ms, and finish by 1820ms. This overlaps even the two-choice spill, whose last fake back ends at 1180ms, so there is no blank flash or second landing. The ten candidate tiles start at 1500ms, stagger by 45ms, and the tenth finishes exactly at the 2265ms ready point. Pack input—including compatible held Fable/Gambler actions on the sibling shelf—stays locked through opening, option/held-use resolution, and closing. Keep shapes blocky, shadows hard, and timing stepped; reduced motion reveals and enables the choices immediately.
   **Constellation use (changed 2026-07-29):** the used card shakes while the
   score panel shows the pattern's old Mult and Chips. A green `+Mult` merges
   first, followed by green `+Chips`; the level label then flips old → new and
   the card exits with a stepped pixel dissolve. The complete sequence lasts
   **3.5 seconds**.
5. **Boss intro (changed 2026-07-29):** only actual entry into a `playing` Deadline board triggers the centred, non-blocking card—Blind Select never does, while Continue into an active saved Deadline does. It is positioned at the centre of `.phase-workspace`, excluding the persistent sidebar and owned shelves, rather than at the centre of the full frame/viewport. It shows the boss emblem, localized name, and full debuff text at 150% of the prior card height, completes its overshooting stamp/pop, holds for 1 second, then leaves with a short lift/fade. Reduced motion removes both animations. The earlier badge-only stamp is retired.
6. **Boss Not Allowed notice (changed 2026-07-29):** a zero-score
   submission flashes `Not Allowed` as large, white, title-face text at the
   workspace's top centre. It has no toast plate or border and dismisses itself
   after its short entrance/hold/exit animation.
7. **Finisher presentation (changed 2026-07-31):** the four Chapter-8-multiple
   finishers use their own square pixel emblems. Blueprint turns every owned
   Emoji Tile into a black card back showing the live selected WooDak skin from
   `mascotSrc('woodak')`; it never uses Pac-Man characters or a fixed mascot
   import. Ultrasound leaves the disabled card in place and marks it with a
   dark/desaturated treatment plus a large ×. Its next random marker remains presentation-frozen through the whole scoring timeline, then lands with a disable beat after settle completion; the disabled tile's edition is inert too. Nokdo's forced letter tile keeps
   the ordinary tile face and gains a gold forced-selection tag.
6. **Tomato reactions** (the score icon, D-5): the tomato has a continuous, restrained pixel-step **Idle** loop (1px lift, tiny alternating tilt/squash), then gives a compact, springy **bounce on every scoring beat** — the scoring reaction temporarily replaces Idle while chips count up. Between beats it also occasionally **hops** on a long random timer (a few times per blind, never rhythmic enough to distract). Its panel-relative anchor is a separate, non-animated layout layer: score and idle motion always begin at the displayed tomato position, stay within roughly 4px vertically, and never replace the anchor transform or jump across the panel. Both OS and in-game reduced-motion settings disable every tomato loop.
7. **Score Keyboard / 점수 키보드 (sentence assist 2026-08-31; sampled key mapping changed 2026-09-02):** a non-interactive fictional vintage terminal keyboard is fixed in the left viewport margin. The local **1774×887 transparent RGBA pixel-art master** is a natural 2:1 landscape object with three empty flat key wells and no baked caps or legends. Raster and DOM keys share one wrapper rotated 90° counter-clockwise into a vertical 1:2 dock. Width is `min(230px, 13vw, gutter − 16px, (100vh − 32px) / 2)`, height is `width × 2`, the dock is vertically centred, and `object-fit: contain` preserves the art without crop, stretch, filter, or active-opacity changes. A UI-only formula/row registry places **101 fully opaque labelled DOM caps** across the main, navigation, and numpad wells: ESC, F1–F12, PRINT/SCROLL/BREAK, the standard no-Windows-key main block, ten navigation/arrow keys, and 17 numpad keys. A–Z appears once; Backspace/Tab/Caps/Enter/shifts/Space/numpad 0/+ /Enter keep their authentic 2u/1.5u/1.75u/2.25u/2.25–2.75u/7u/2u proportions. Every cap remains disabled, untabbable, accessibility-hidden, fully opaque, and part of the deterministic candidate pool. Each `settleId` resets to Tier 0. Only a positive current-submission score beat activates classification. Compute `local = max(0, Chips × Mult + flat score)`, add the settle-id-snapshotted visible `sentenceAssist = max(0, projectedScore − committedScore)` (zero under `previewHidden`), divide by the positive finite target, and classify Idle below 1× and Tiers 1–6 at `[1, 1.1, 1.2, 1.3, 1.4, 1.5]`; present `max(previous peak, raw tier)`. Decrease/zero/gold/stat/invalid beats and sentence assist alone neither demote nor promote it; committed/earlier scores and later sentence BUILD/LAND never enter directly. The current beat's peak drives one semantic primary before deterministic fill: submitted letter (or Stone→Space), Enter for suit/length/Word Hand/global, stable F1–F12 for untargeted Emoji Tiles, Break for bosses, Tab for Tags, Space for Pouches, and Enter fallback. Tiers retain 3/5/8/12/16/20 visible and 1/2/3/4/5/6 audible presses; the primary sounds first. Each audible slot resolves the same visual key and uses a locally bundled 32-WAV pool: registry index i maps to sample (i mod 32) + 1, while an unknown id uses main Enter. Samples load only on play and fall back to the matching existing synthesized recipe on failure. Normal settle completion returns idle. An actual clear with a non-zero peak, including a sentence-assisted peak following a positive local beat, starts cycle 0 immediately after settle completion, then repeats the existing score-keyboard renderer through BUILD/LAND, final count-up, verdict, and the live Fee Settlement row/total animation. Synthetic ids are `clear:{blindKey}:${settleId}:${cycle}`; main Enter is always primary and its first audible slot uses Enter's mapped WAV at the existing `deskEnter` accent gain, while deterministic fill uses each visible key's mapped WAV at the ordinary `deskKeycap` gain to complete the tier count. Repeat intervals are 460ms × `[2, 1.75, 1.5, 1.25, 1, 1]` for Tiers 1–6 divided by the clearing submission's snapshotted 1×/2× speed. Each cycle replays local body/key motion (Tier 1 shake factor 0.1), Tier-4 smoke, and Tiers-5–6 smoke/flame/POP; Tier 6 held ambient uses low .72, high .92, 18px glow, and 400ms speed, while tier light remains between cycles. Collect's transition to Shop, terminal modal, next blind, unmount, or Reduced Motion ON cancels current/future cycle work synchronously. Temporary settle/tile/Emoji VFX still finish on their ordinary timelines. Loss, Tier 0, a true local-zero sentence-only clear, and non-clear paths never loop. The target-cross event remains one logical once-per-blind Enter strike; celebration cycles intentionally reuse Enter's mapped WAV at the `deskEnter` accent gain without retriggering that event. Reduced Motion keeps a static peak/Enter accent and the existing target-cross audio exception, with no repeat audio or moving VFX. The portal retains explicit `world-mono` grayscale until colour unlock, and neither the hold nor active state changes raster/key opacity or filters. No cycle affects global shake or settle timing.
   **Panel LED override (changed 2026-09-03):** each physical cap has one immutable slot in a six-colour rainbow. Only actually pressed keys emit hard-edged pixel light into the cap gaps. Tiers 5–6 deterministically cover all six colours and keep one key-anchored, beat-synchronised flame per pressed cap; Tier 6 makes those flames 25% larger and may add one ember pixel. Tier 4 keeps smoke, and Tiers 5–6 keep smoke and POP. In Tiers 5–6, the image's red/yellow/green indicator LEDs at the top panel also blink continuously with a deterministic random-looking staggered phase order that changes each beat/cycle during active and clear-held beats; Tiers 0–4 leave them off. The panel LEDs and flames remain fully coloured regardless of Palette progress or `world-mono`; this supersedes the earlier blanket portal-grayscale sentence above. Reduced Motion freezes panel LEDs at low intensity, hides moving key VFX, and preserves the existing static pressed/Enter accent, while Forced Colors hides decorative panel LEDs/key-flame. The former full-keyboard rainbow ring and Tier 6 jackpot sparks are retired. Idle and unpressed keys stay dark, and key/audio counts, sampled mapping, lifecycle, and timing remain unchanged.

   When authoritative BUILD publishes a finalized pattern after the last word's
   settle-complete signal, the workspace shows one localized title-scale
   **Lv.N · zodiac symbol · pattern name** callout using the existing 1.7-second
   Not Allowed animation family. Live projection, ordinary settles, and
   Unison-only finals do not show it; Reduced Motion keeps a readable fade.
   During that sentence-bonus landing, reuse the round panel's reserved live-
   pattern line as the finalized headline instead of adding a gold score-box
   stamp. Pattern-only reads **Lv.N · zodiac symbol · pattern name**; Unison-only
   reads **suit + Unison + Chips/Mult value**; Mixed-only reads **synergy name +
   ×factor Chips**; pattern plus style joins both with a middle dot. The full
   headline takes the Unison suit or Mixed Chips colour (pattern-only stays
   gold), wraps compactly without clipping long English combinations, and keeps
   visible text plus one complete accessible label. Only Modifier, one Effects
   row containing every non-neutral Chips/Mult/flat-score value, and Pouch remain
   as supplemental full-width Word-Hand-footprint tags in that order. The
   finalized headline and rows remain through LAND, final count-up, verdict, and
   live Fee Settlement; Collect clears them in the Shop transition. Zero or one
   supplemental row keeps score/controls at 136/332px; two rows use 159/309px;
   three rows use 182/286px. Each pair totals 468px, with no blank reserved row; a visible internal gap separates the ScoreBox from the first supplemental row without changing those fixed heights.
8. **Side interactions** (ambient, non-gameplay; right-only changed 2026-08-27): the random encounter pool contains a linked pixel-art coffee cup/pot pair, hotel-style call bell, blank cheque, two tactile toys—**Wax Ball / 왁뿌볼** and a standalone mechanical **Keycap / 키캡**—**Shaco's Surprise Box / 샤코의 깜짝 상자**, a hovering **Flying Pest / 날벌레**, **Bulldog Roulette / 불독 룰렛**, and a covered **Nuclear Launch Button / 핵 발사 버튼**. Each is set down from above. Most leave after one completed interaction; Bulldog Roulette remains until its winning tooth is found, and the launch button requires two deliberate clicks. Coffee state starts full, so only the filled cup is eligible; three staggered pixel-steam wisps rise while it waits, and clicking drains its separately layered coffee with a sustained water-draining rush, keeps it empty throughout the exit, then removes it. Only after that drink may the coffee pot roll. Clicking the pot plays a continuous water-pouring stream with small splashes, restores the shared coffee state as it exits, and makes the filled cup eligible again while making the pot ineligible. Clicking the call bell visibly pushes its independently layered top switch down before it springs back, shakes the bell body, emits stepped side-ring marks with a natural struck-metal resonance, then the bell exits. Wax Ball cracks/pops with a loud layered dry snack-like crunch; the complete, unclipped standalone Keycap depresses with an audible mechanical down/up click and emits stepped impact marks before each exits. Clicking Shaco's Surprise Box replaces its closed frame with an opened frame whose spring-mounted clown doll overshoots upward with a synthesized boing before the encounter exits. The Flying Pest jitters in place until clicked; a layered fly swatter then slaps diagonally across it with a sharp impact burst, and the insect spins downward out of view. Bulldog Roulette exposes eight individually clickable teeth and seeds one winning tooth on spawn. A safe tooth depresses with a plastic click and remains pressed without dismissing the encounter; the winning tooth snaps the bulldog's mouth shut with a bite sound, then sends it out. The Nuclear Launch Button arrives as a square bolted metal panel with its oversized red button behind a cyan glass safety cover. The first click flips the cover open with a glass-and-metal clack; only the second click depresses the button, flashes its warning lights, plays a rising alarm and low launch impact, then sends the panel out. The blank cheque may be **signed by dragging anywhere across the whole cheque object** (mouse or touch): its quantized SVG stroke and pixel pen follow the pointer while short paper-scratch bursts track actual drag movement. A small, low-contrast localized “Sign here” hint rests above the signature line and disappears as soon as drawing begins. A click or tiny accidental mark is rejected and cleared; only a deliberate stroke completes the signature, after which the cheque exits. During a run, the safe right-gutter footprint may shrink objects below their full responsive master ranges (ordinary objects 112–168px; landscape cheque 144–260px)—down to 68px for ordinary objects at 960px—rather than overlap the board. The **right margin alone** owns three non-overlapping vertical zones, ordered oldest-first from the bottom and compacted when an object exits; its lowest zone starts at least 136px above the viewport bottom (or 14vh, whichever is larger), clearing the complete tile-pouch dock. The left margin is reserved for the persistent Score Keyboard. **Purely cosmetic and never required**: encounters grant nothing, never overlap the interactive board, and never punish being ignored. At most one generic encounter (pot, cheque, tactile toy, surprise box, Flying Pest, Bulldog Roulette, or Nuclear Launch Button) is active alongside the independent cup/bell slots; overall encounter frequency uses a randomized **70–140 seconds** between rolls.
   **Rotating Laboratory screen (DEV-only; changed 2026-09-04):** Main Menu → Laboratory keeps the shared 1440×988 shell, CRT treatment, Back, and Escape, but its interior is a single replaceable review surface rather than a gallery. Only a completed player-facing implementation or change that cannot be inspected immediately in Collection or Run Info qualifies; internal-only refactors do not. The next qualifying change replaces the prior contents, while automatic tests retain old preview regressions. Always reuse the real production component/data and never add engine, RNG, run, discovery, profile, settings, or storage state. The current surface replays the exported production money-ledger renderer with fixed `$10 → −$3 → +$7 → $14` data, existing bilingual Goose copy, and the real Reduced Motion/Forced Colors behavior. The former hidden-pattern, Score Feedback, and Desk Encounters Laboratory previews are retired; actual run behavior and automatic regressions remain unchanged.
9. **Drag dot-outline (feature-02 D-2)**: while dragging a tile or a joker, the origin slot shows a dashed pixel outline and the live insertion gap shows a dashed bar (Balatro feel). Applies to hand, tile zone, and the joker shelf. Newly acquired consumables and Emoji Tiles pop into their owned shelf slot once with a compact overshoot; existing contents do not replay this animation merely because a screen remounts (added 2026-07-28).
10. **Drag physics — the hand must feel alive (playtest 2026-07-27).** Balatro's hand feel comes from tweened, spring-driven motion (its DOTween work), not from snapping elements to coordinates. Applies to letter tiles *and* Emoji Tiles, in hand, tile zone, and shelf:
    - **Follow with lag.** The dragged card chases the cursor via a spring rather than locking to it — a small trailing offset that catches up on release.
    - **Lean into motion.** Rotation is driven by horizontal drag velocity (clamped, e.g. ±12°): moving fast tilts the card, stopping lets it right itself. This single detail is most of the "weight" people feel.
    - **Grab and release.** On grab: scale up slightly, shadow deepens, card rises above its neighbours. On release: spring to the target slot **with overshoot** (the Ease-Out Back family already used for screen transitions), never a linear snap.
    - **Neighbours yield smoothly.** Cards displaced by the insertion gap move on their own springs with a small per-card stagger, so the hand ripples instead of reflowing in one frame.
    - **Cursor proximity.** Un-dragged hand cards tilt/lift slightly toward a nearby cursor, so the hand responds before anything is even picked up.
    - **Implementation:** GPU-composited `transform` only, driven by one rAF spring loop or a spring library — **never per-frame React re-renders of the hand** (the existing rule for transitions applies here with more force, since many cards animate at once). Pointer capture so a fast drag can't lose the card.
    - **Click stability (feedback2, 2026-07-30):** a click or a drag released into the tile's original insertion slot is a complete no-op for hand order and must not switch an active auto-sort to manual. Only a drop that actually changes the displayed order enables manual ordering; that displayed order becomes the persisted hand order.
    - Reduced motion: keep instant, un-tweened positioning; drop tilt, overshoot, and proximity response.

Quality floor: `prefers-reduced-motion` and the in-game reduced-motion toggle disable wobble/shake, shared card idle, cursor tilt, and sheen (including joker/consumable idle) and reduce settle to fades · keyboard focus visible on tiles, cards, and buttons (gold outline) · every enabled button enlarges on pointer hover and presses down while held without replacing its component transform · all color-coded info (suits, chips/mult) doubled with a text label — never color alone. The mascot-hand cursor is presentation only: native semantic cursors and keyword fallbacks remain available, forced-colors uses system cursors, and touch/coarse-pointer devices do not load a custom cursor state. Every native scroll surface uses the shared pixel-pencil scrollbar (graphite, exposed wood, yellow barrel, ferrule, eraser), and uses `overflow: auto` so it appears only when content genuinely exceeds its surface; decorative or transient overflow is clipped instead. Sentence-pattern levels use yellow through 3, orange through 5, green through 8, blue through 12, purple through 16, then red; the same band colors the Constellation level-up reveal. Pattern rows reserve a fixed-width level field plus a 12px gap before the zodiac mark so level digit count never shifts the symbol/name column.

**Other feature-02 D visuals.** *D-1 joker reorder:* the owned-joker shelf is drag-reorderable and **order = hook execution order** (GDD §11 intro). *D-5 tomato score icon:* the icon beside score numbers (blind-badge target, round score) is a **pixel tomato** (`docs/Arts/Icons/T_Tomato.png` → `src/ui/assets/tomato.png`; tomatoes thrown at bad manuscripts) — the term "Chips" and the blue chips box are unchanged. The tomato is greyscaled until **RED** unlocks (it belongs to the red group). *D-6 retired 2026-07-30:* the main `.frame` is transparent; Draft/Revision/Deadline no longer paint per-stage backdrops. *D-7 (changed 2026-08-12):* Collection uses a centred framed modal. The left column is Emoji Tiles → Pouches → paired Vouchers/Tags → the inset Fable/Constellation/Gambler family panel; the right column is Enhanced Tiles → Editions → Card Packs → Palette → Mascots → Words → Blinds. Tags show all 30 effect-specific icons in a two-page 5×3 gallery with the same tooltips and motion used on Blind Select. Words and Blinds use the 84px category height; ordinary standalone categories and all three consumable buttons use the 75px Voucher height. Emoji Tiles expands to 164px with the space released by the consumable panel, keeping both columns equal in total height. Enhanced Tiles combines the former Materials and Fonts pages as two views behind the shared `< · page · >` pager, not tabs. Records no longer has a Collection category. All three consumable families keep high-detail, path-only, 32-color SVG authoring masters normalized without cropping to the Fable standard: a `500×700` 5:7 output canvas with a `250×350` logical pixel grid. Runtime surfaces use their pixel-identical `500×700` PNG derivatives to avoid parsing more than one million SVG path commands; `scripts/check-card-assets.mjs` verifies both forms. Card Packs follow the same master/runtime split at `244×400`, reducing their shipped runtime art bytes by about 69% while retaining editable path-only masters. They share the same framed SVG component in the 5-column, 10-per-page Collection galleries and in shop, pack, and held-card surfaces. Fable retains its original English title plates, while localized names remain available in tooltips and accessible labels. All fourteen Gambler effects, Ink Pack acquisition, and runtime tooltips ship. Detail modals have no shared fixed minimum height and instead size to their actual grid rows, except Card Packs, whose four eight-card pages (Tile, combined Charm + Ink, Fable, Constellation) share the same two-row gallery height. The orange Back bar spans the modal footer; mobile collapses the menu to one column. Where noted, icon/background art currently ships as an emoji/CSS placeholder pending the pixel-art pass.

The Collection consumable-family buttons participate in chromatic unlocks through
semantic tokens: **Fable = RED** (`--mult`), **Constellation = BLUE** (`--chips`),
and **Gambler = GREEN** (`--btn-green`). A locked group therefore renders its
button in the token's neutral default instead of leaking the family color.

*D-7a Words reference + records (changed 2026-08-12):* Collection → Words begins
with a compact four-card challenge strip: highest-scoring word (intrinsic
letter-chip sum only), longest discovered word, most-played word, and total
discoveries. Beneath it, **Words** and **Register Scores** tabs separate the
searchable word gallery from the live Standard ×1 / Formal ×10 / Slang ×5 /
Vulgar ×7 register reference. The explanatory formula paragraph above the
register cards is removed; the cards retain multiplier, role, and discovery
count. The
dictionary total and unfiltered page total remain `???` until full discovery.
Undiscovered word slots render as neutral `???` with no spelling, register style,
tooltip, or accessibility metadata; only successfully submitted valid words reveal
their name and original register. Search and register filters use discovered words
only, so filtered result counts stay literal without exposing hidden entries.
Reveal All presents every entry as discovered but creates no synthetic play records.
Every Collection pager is circular in both
directions, including the Starting-Pouch carousel; New Run's Pouch and Record
selectors use the same first↔last wrapping behavior.

The Profile progress column also shows one compact keyboard-button card per
register with that previewed slot's highest cosmetic title and progress toward
the next numeric threshold (or `ALL`, never the secret lexicon total). Activating
a card opens one shared inline drawer containing None plus every earned tier from
low to high; native same-name radio inputs provide browser arrow-key behavior,
the selected choice has a gold state, and opening focuses the selected or first choice.
Full mastery of all four adds a selectable **God / 신** header badge. The current
effective title appears directly below the editable profile name. These choices
derive from the slot's existing word Collection and current lexicon; Reveal All
exposes every choice but does not auto-equip one, and inactive preview slots remain
independent. Main Menu shows the active profile's validated equipped title as a
small second line beneath its name. Selection is cosmetic only.

*D-7b pattern pictograms (added 2026-07-30):* the zodiac mark already engraved
at the top of each Constellation card becomes the shared pictogram for its
mapped sentence pattern. The same bordered mark precedes the pattern name in
the sentence tray, shared live/finalized current-pattern headline, Run Info,
Constellation-use sequence, and run summary; the score box duplicates none of
that pattern provenance. Constellation tooltips repeat the mark and mapped pattern.

*D-7c Run Info pattern examples (changed 2026-09-04):* each visible sentence-pattern
row opens the shared portalled tooltip on hover, keyboard focus, or touch pin. The
existing description stays above a compact tray containing only uppercase word
boxes—no Example/예시 heading, divider, role/POS text, or clause captions. Each
ordinary box is filled and bordered with its selected POS tag colour; special
grammar tokens use a neutral marker tone, so ISNT never receives a fabricated POS
colour. Every example, including Compound and Complex, lists all boxes in one
uninterrupted left-to-right row with no arrows or row breaks; constrained viewports
scroll that row horizontally instead of wrapping it. The row fills the tooltip width,
centres the group, and distributes the boxes evenly. Tokens have hard pixel edges
and readable text/borders in monochrome and Forced Colors, with no new animation or
image asset. The visual tray is hidden
from assistive technology in favour of one localized word-sequence summary.
Pattern-only vertical containment chooses the available side of the row and keeps
the portalled tooltip inside the physical viewport.

*D-8 mascot equip (changed 2026-07-31):* skin selection lives in **Collection →
Mascots**, not Settings. Unlocked portrait cards are keyboard/cursor selectable;
the equipped card carries a gold outline and Selected badge. Discovered
tooltip-wrapped cards and undiscovered raw cards share the same 150px basis
width. Locked silhouettes remain visible but non-interactive. Profile Reveal All
writes the selected profile's actual mascot unlock ids, so those art-backed skins
become discovered and selectable without affecting another profile.

*D-8a mascot art originality (changed 2026-08-02):* ALIEN, GHOST, and TURTLE
use original local character art whose species and silhouette clearly communicate
the matching unlock word. They share the project's chunky pixel edges, navy
outline, compact palette, and CRT treatment, but must not reuse a recognizable
third-party mascot silhouette, face, costume, or arcade-sprite composition.

---

## 5. Implementation notes (slice ⑥)

- React + plain CSS custom properties (tokens above as `:root` vars). No Tailwind in the game screen — the styling is too bespoke; keep tokens in one `tokens.css`.
- **Pixel-art rendering:** apply `image-rendering: pixelated` to sprite/tile layers and author raster art at a fixed resolution. The surrounding interface uses responsive zoom. Avoid smooth CSS gradients/blurs on pixel surfaces (they break the aesthetic) — use dithering/stepped fills.
- **CRT effect (implemented):** `<CrtOverlay/>` (`src/ui/components/CrtOverlay.tsx`) provides three fixed, `pointer-events:none` layers above the app root: scanlines · vignette/barrel · faint neutral bloom. Settings can disable the complete pass, scale scanline alpha from 0 to 0.12, and disable bloom independently. Reduced motion freezes only scanline flicker. Because the overlay sits outside the board containers, the chromatic `world-mono` greyscale never touches it.
- Animation: CSS transitions/keyframes first; adopt a spring lib (framer-motion) only if the settle sequence demands it.
- The engine stays headless: UI subscribes to engine state snapshots; the settle sequence is driven by a `ScoreEvent[]` log the engine already produces per submission (chips/mult steps), replayed with timing by the UI.
- Shop, blind select, pack opening and tile modification reuse the play table rather than becoming separate screens. Only their work panels move, entering upward and leaving downward. Draft/Revision Blind Select cards place Select at the top and an `OR → image tag + Skip` group at the bottom. Each of the 30 seeded Editorial Perks uses its own effect-specific square pixel-art PNG, shared portalled tooltip, and pointer-driven 3D tilt/lift/sheen; upcoming offers remain visible but inactive. A skipped card gets a high-contrast striped/stamped state, while its source Tag is dimmed and non-interactive. Immediate Tags transfer into a focused `Tag Auto-Activated` beat, brighten/burst away, and only then reveal their effect; free-pack Tags continue directly into the ordinary pack-opening panel. Next-blind Tags wait in the maximum-two lower-right stack and burst on Play entry. Next-shop Tags remain in that stack through play and Fee Settlement, then flash `Shop Tag Applied` and burst only when the Shop stock (including a later reroll) actually consumes their effect; unresolved Tags remain. Deadline has no Skip (changed 2026-07-31, GDD §8.2; resolution-specific Tag timing added by feedback; Lead Story retired).
- Emoji Tiles whose hooks resolve on Blind Select confirmation fire on their owned shelf card in acquisition order as the blind opens. Only hooks that actually apply receive the trigger beat; Megalith additionally launches each created Stone tile from its firing card into the persistent pouch widget before the pouch pulses on receipt.

---

## 6. Shop mascot — 삐약이 (Piyak), pixel-art cat proprietor

The Stationery Shop (screens §2.6) has a **mascot character: 삐약이 (Piyak), a tuxedo cat who owns/runs the shop**, rendered in pixel-art with the CRT finish. Runtime art: `src/ui/assets/piyak.png`.

- **Placement (shipped):** bottom of the shop's left rail, below the gold panel (proprietor behind the counter feel), never overlapping the item slots. Hidden on the ≤720px single-column layout, lying on a pink **cat-face plush cushion** (`docs/Arts/Mascots/T_Cushion.png` → `src/ui/assets/piyak-cushion.png`) — the plush sits behind him, ears peeking above his back. (The earlier in-house generated pillow is retired.)
- **Idle animation (shipped, single-sprite):** CSS breathe — subtle vertical squash (scaleY ≈ 0.985, origin at the feet) on a ~3s ease loop. The part-based slicing (blink / tail-flick layers) from the earlier draft needs extra art frames and stays future work.
- **Role in shop (shipped: welcome barker):** on each shop entry Piyak shows one random line from the `voice.piyak.welcome.*` pool (8 lines, i18n, resolved through `voicedKeys`) in a pixel-grammar speech bubble (squared corners, ink border, blocky shadow). Shared mascot, tutorial, and guided-intro dialogue uses at least `--fs-lg`; bubbles size to their copy inside the existing surface cap and use greedy normal wrapping only at word boundaries (`word-break: keep-all`; `overflow-wrap: normal`; no balanced wrapping). Purchase/reroll reactions remain a later layer. Track in screens §2.6.
- Respect `prefers-reduced-motion` (and the in-game force-reduced-motion option): freeze to a static frame, bubble appears without motion.

### 6.1 Run-end mascot — 우땅 (WooDak), pixel-art orangutan mentor

The run-end screen (screens §2.7) has the game's second mascot: **우땅 (WooDak), the player's ally/editor-mentor** (`src/ui/assets/woodak.png`). Reuses the §6 mascot grammar verbatim (`.mascot`/`.mascot-bubble`, breathe keyframe, pixel bubble) plus a slow ±1° sway on a wrapper element; ~150px wide, vertically centered beside the run-end card; enters with a jump-pop (rise + overshoot squash, ~0.45s) and the bubble pops right after landing; hidden ≤720px, frozen under reduced motion. Speech: one contextual line per run end (discoveries → stat tips → generic pool), congratulation prefix on a win; Korean voice tic "~우땅". WooDak also guides every layered tutorial encounter except Piyak's fixed shop greeting through `src/ui/tutorial.ts`; those coach-mark bubbles remain visible at ≤720px. The integrated run-end unlock recap is the sole broader notification-role exception.

**Score Keyboard jackpot/smoke follow-up (changed 2026-09-03):** the red/yellow/green indicators flash in the deterministic random-looking order with rapid hard-edged jackpot pulses. Align each light's centre with the corresponding raster indicator and spread the light sideways with pixel-hard rays. Tier 4–6 pressed caps emit visible smoke and Tier 5–6 caps emit larger visible flames, using per-key 0.95–1.05 variation; Tier 6 keeps ×1.35 smoke and ×1.25 flame base multipliers. Seven small chassis-smoke sources appear at Tier 5, while Tier 6 uses all twelve at larger size and dark-gray tone. Do not use one large smoke overlay.
