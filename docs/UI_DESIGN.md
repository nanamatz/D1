# Play the Wor!d — UI Design Spec

> **Art direction:** pixel-art + CRT with Balatro-style screen grammar. **Layout changed 2026-07-28:** the in-run UI is rebuilt as one persistent table; sidebar, owned shelves, Run Info access and pouch remain fixed while lower work panels move.


**Design thesis: pixel-art arcade roguelite with a CRT finish.**
The game embraces a **pixel-art / CRT aesthetic** in the Balatro lineage: chunky pixel panels, a scanline+bloom CRT post-effect, punchy arcade score feedback. The prior "ceramic letterpress, deliberately un-Balatro" direction is **retired** (see changelog) — the earlier trade-dress guardrail no longer applies. We still don't copy Balatro's *actual art assets* (its specific card illustrations, its logo, its exact sprites), but we freely adopt the pixel-art idiom, CRT treatment, and screen grammar. Tiles read as **printed/stamped letter tiles rendered in pixel art** (the publishing-world fiction and materials/fonts from GDD §2.2–2.3 are unchanged — only their *rendering style* becomes pixel-art).

The visual contract is `docs/mockups/play-screen.html`. When spec and mockup disagree, the mockup wins.

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
| `--gold` | `#F0B23E` | money, current pattern, early-end glow | **YELLOW** (locked `#A89E84`) |
| `--tile-face` | `#F4EDDF` | letter tile face (warm ivory, pixel-art shaded) | — |
| `--tile-ink` | `#2B2620` | tile letter ink | — |

Suit colors (word frames & badges): standard `#B9C4CB` · formal `#7E96F2` · slang `#F09437` · vulgar `#C6479E`. Vulgar is magenta, not red — red is reserved for Mult.

> **Chromatic unlocks (feature-02 C, GDD §13 — "truly monochrome").** The **entire** palette holds **neutral grey** locked values by default (not just the four accent tokens) — the slate chrome, tile faces, and suits are grey too, so the world starts *genuinely* black-and-white. Group assignment: **RED** = `--mult`, `--suit-vulgar`; **YELLOW** = `--gold`, `--suit-slang`, `--tile-face`; **GREEN** = `--bg-desk`; **BLUE** = `--chips`, `--suit-formal`, `--suit-standard`, `--panel`, `--panel-edge`, `--inset`, `--inset-edge`. Playing the color word toggles an `unlock-<group>` class on `<html>` that swaps in the true hex (token swapping in `tokens.css`), re-coloring progressively. A **`world-mono` guard** additionally greyscales the board (`filter: grayscale(1)`) *only while no color is unlocked*, covering remaining hard-coded fills (materials and badges); it's dropped on the first unlock. The fixed CRT overlay is outside the greyscaled containers. MUSIC/SOUND gate the audio buses, not colors. Info is never color-only (a11y), so the grey start stays readable.

### Type

| Role | Face | Notes |
|---|---|---|
| Score display / big numbers | **Jersey 10** (Google Fonts) | already a pixel face — keep; it now sets the tone for the whole UI rather than being the odd one out |
| Tile letters | **Jost** | the GDD's own Futura stand-in (§2.3). **Five fonts** map onto Jost styles, matching the persisted `TileFont` union (`medium`/`lightItalic`/`bold`/`inline`/`black`): Medium 500 (base) · Light Italic (Jost 300 italic) · Underline (internal `bold`: Jost 500 + fixed 3px hard underline) · Inline (500 + text-stroke outline) · Black 900. The four non-base fonts carry **seal effects** (GDD §2.3); tile tooltips read the effect text from `balance.ts` `fontEffects` — never hard-coded |
| UI labels / body | **Baloo 2** | rounded, chunky; sentence case |
| Tooltip descriptions | **Jost 700 + Noto Sans KR 700 fallback** | compact printed-game copy with restrained cyan/magenta separation; tooltip titles remain in the chunkier UI face |

> **Pixel-font note (art-shift) — RESOLVED to (a), "modern pixel hybrid"; Underline changed 2026-07-31.** Jost and Baloo 2 are smooth vector faces that read slightly against the pixel-art surfaces; we **keep them**, rendered at crisp sizes, and lean on Jersey 10 (already a pixel face) for headline/numeric moments. The two candidates considered were **(a)** keep the current faces as a hybrid — *chosen* — and **(b)** swap UI/tile faces for true bitmap fonts (Pixelify Sans / Silkscreen / Departure Mono), *rejected*. The mapping stays **five** — Jost Medium 500 (base) / Light Italic (Jost 300 italic) / Underline (persisted `bold` id; Jost 500 plus hard underline) / Inline (500 + text-stroke) / Black 900 — matching `TileFont` and `fontClass()`. Underline replaces the visually ambiguous Bold 700 without changing saves or engine rules.

### Surface language (pixel-art / CRT)

- **Pixel grid.** Author UI at a low virtual resolution and scale up with integer nearest-neighbor (`image-rendering: pixelated`) so edges stay crisp. Borders/shadows are 1–2 "big pixels" wide, not sub-pixel.
- **Hard offset shadow** stays the signature surface cue but as blocky pixel shadow: a solid dark step down-right (no blur), e.g. a 4–5px hard offset that reads as a chunk, not a soft `box-shadow`. Buttons depress on press (translate + shadow collapse).
- Radius: panels and controls prefer squared or 1-step chamfered corners. **Card objects are the exception (changed 2026-07-30):** Emoji Tiles, consumables, sale offers, and vouchers share one rounded silhouette. Pack art keeps square corners.
- Panels get a light top-edge pixel highlight (`--panel-edge`) and a dark bottom-edge for the stamped/embossed look.
- **CRT post-effect** (global, toggleable in Settings, GDD/screens §2.11): scanlines + slight bloom + subtle barrel/vignette. Ship it as a full-screen overlay/shader pass so any screen inherits it. Must be **disable-able** (accessibility + the reduced-motion/low-end path), and scanline intensity should be a slider (the reference build exposed a "CRT" strength + "CRT bloom" toggle).
- Background: `--bg-desk` + vignette; noise/texture rendered at the pixel grid, not as a smooth gradient.

> **Migration note.** Existing components keep their semantic tokens (`--chips`, `--mult`, `--gold`, suit colors) while adopting the pixel/CRT surface. The earlier “layout stays” constraint is retired by the 2026-07-28 persistent-table rebuild.

The 1536×864 reference framing is the placement baseline: a fixed left rail occupies
roughly 22% of the width, owned shelves reserve the upper band, the pouch owns the
lower-right dock, and phase-specific content aligns to the remaining work surface
rather than the full viewport centre. Blind cards use the broad lower work surface;
play hands and ordinary pack choices sit lower; Fable packs use two tiers (ten
candidate tiles above, Fable choices below) with pack information and Skip at the
bottom. Fable cards have no resting button: selection reveals Use, or Select for a
blind-only card. The ten pouch candidates are interactive as soon as a Fable Pack
opens, so either a revealed targeting Fable or a compatible targeting Fable already
held on the consumable shelf can use the same selection. Overlays such as Fee
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
│  gold/ante │   HAND (11 pixel-art tiles, slight fan/wobble) │
│            │        [PLAY WORD]   [DISCARD]               │
└────────────┴──────────────────────────────────────────────┘
```

**Signature element — the Sentence Tray.** Balatro has no equivalent: our played words accumulate left-to-right *as a sentence under construction*. Each played word is a mini-card group (its tiles shrunk), framed in its suit color, with a POS tag chip beneath. A gibberish play renders as a cracked/burned slot — the **hole** made visible. At the tray's right end, a pattern status chip shows the live judgment ("Transitive ✓ ×2" / "— no pattern"). This tray is the game's identity on screen; spend the polish budget here.

Sidebar (top→bottom): blind badge (kind + boss name when boss) with target score ·
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
| `Tile` | 64px (integer-scaled) pixel-art letter tile: face, uppercase A–Z letter, chip value bottom-right. Carries up to **three stacked axes** (GDD §2.4): material + font + edition. See the material legibility rules below. Selected = raised + gold pixel outline. |
| `SentenceTray` | see §2. Includes `HoleSlot` (gibberish) and `PatternChip`. |
| `JokerCard` | **Fixed 124×165px near-3:4 image-only runtime contract**, shared with the resized shop offer and held-consumable footprints. Existing 84×112 pixel masters scale with `object-fit: contain` and `image-rendering: pixelated`; those 30 masters in `src/ui/assets/jokers/` are the canonical references for every new entry. Match their roster-wide **Pac-Man-style early maze-arcade** system: deep navy playfield, white/red/yellow/cyan-led 3–5-color palette, one large blocky silhouette, hard un-antialiased pixel edges, and the same sprite scale/line weight. No painterly object icon, gradient, shadow, scenery, texture, lighting, or small decoration. This means the visual grammar only—never copy Pac-Man characters, ghosts, maze layouts, or other original assets. Reuse the same source on shelf, shop, opened-pack, and Collection surfaces. Idle float, cursor tilt, and sheen apply directly to the image; name, effect, and rarity stay in the tooltip. |

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
For additive Chips/Mult values, only the numeric portion uses the axis colour.
A filled Chips/Mult box is reserved for multiplication and wraps only the
leading `×N` factor. `Chips`/`Mult` and `칩`/`배수` always use the normal
body colour outside the box.
Non-base edition names stack as coloured tags beneath that main stack instead
of being appended to the effect plate. Their effect definitions render in a
separate card immediately to the main tooltip's left. Letter-tile material,
font, and edition enhancements follow the same tag-and-definition pattern. One
supplement remains immediately left of the main tooltip. With two or three, the
highest-priority one folds into the main effect plate and the rest stay left;
priority is **material → font → edition**. This distribution also includes
automatically referenced font and Gibberish definitions and is unchanged when
the main tooltip opens downward. Any tooltip effect copy that names a tile font
automatically adds that font's canonical effect card; property/object names
containing the same word do not count. *(Changed 2026-07-31: feedback3 compacted
multi-definition stacks while preserving every explanation.)*
The shared tooltip frame follows the reference as a scalable image-like panel:
mint pixel edge, charcoal scanlined shell, pale inset plate, and white titles
with subtle cyan/magenta separation. Main width is content-responsive from
210–280px; each independent left supplement is about 64% of the main width and
each bottom tag is 72%. Height is never baked into a bitmap—it follows wrapped
copy while preserving these horizontal and internal-padding proportions.

All tooltip copy uses the enlarged readability scale: 18px title, 15px body,
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
All effect/tooltip descriptions in both locales omit period punctuation; decimal
points remain intact.
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
| `VoucherCard` | **One shared vertical rounded card** in the shop, Collection, and Run Info (`124×165px` at the base UI scale, changed 2026-07-30). The centered icon uses the matching PNG from `docs/Arts/Voucher/` for each of the 32 vouchers (including `StoryBook.png`); warm paper/dither, heavy pixel frame, vertical VOUCHER marks, and a black inset nameplate remain. Price and purchase controls sit outside the card. Every voucher uses the shared card idle float and cursor-following 3D tilt/sheen. **Collection layout (`docs/reference.png`, changed 2026-07-27):** four base→upgrade pairs per page in a 2×2 pair grid, four pages total. Locked upgrades render as muted `?` cards named **Undiscovered / 발견되지 않음**. Their tooltip contains only “Redeem this voucher in an unseeded run to discover what it does.” / “시드되지 않은 런에서 이 바우처를 교환하여 기능을 알아보세요.” The real name, effect, unlock condition, and progress are not exposed until unlocked. |
| `TagIcon` | **Square 160×160 transparent pixel-art master** with an ivory stepped frame, deep-navy inset, and one large effect-specific arcade symbol. All 27 masters live in `src/ui/assets/skip-rewards/`; Blind Select and Collection use the same resolver, shared tooltip, idle float, keyboard focus, cursor tilt/lift, and sheen. No words, numbers, scenery, gradients, or generic repeated badge substitute. Collection presents a 5×3, 15-per-page gallery. |
| `ShopOffer` | **Image-first sale slot (pack rollback 2026-07-30).** Emoji Tiles, consumables, and vertical vouchers use the shared rounded `124×165px` stage. Sale packs use the requested older `131×229px` foreground with square corners; their row slots are also 131px wide so the normal 12px inter-item gap remains visible. The pack panel reserves 84px below its layout row so the attached Open button stays inside the persistent run layer instead of being clipped at the bottom. Collection packs remain `81×132px` with square corners. Price and contextual action live in one moving interaction layer: selection raises the product, price tag, attached action, and their hit-test owner together by the 15px base lift plus the 44px action-button height, 59px total. The voucher/pack background panels keep a `273px` minimum height. Product motion remains unclipped. The price badge sits 23px above the image and the selected **Buy / 구매**, **Redeem / 교환**, or **Open / 열기** button attaches beneath it; **Use now / 즉시 사용** appears vertically centred 12px outside the right edge. Names and classifications remain available through the shared tooltip. |
| `HeldConsumable` | **Object-layer shelf rendering (resized 2026-07-29; actions changed 2026-07-31).** The `124×165px` held slot matches the shop offer and Emoji Tile footprint and is only a transparent layout reservation. Supplied 5:7 Fable/Constellation art fits directly inside that foreground object without distortion—no beige wrapper card, inset image box, persistent name, crop, rectangular sheen, or empty-slot placeholder. The foreground itself owns idle motion, cursor tilt, keyboard focus, click selection, and the shared tooltip. Shop, shelf, opened-pack, and Collection copies resolve through the same consumable-tooltip helpers, including referenced material sub-tooltips and any run-dependent live value wherever a run is available; intentionally hidden locked Collection entries remain the exception. Sell and Use are descendants of the same `TiltCard` as the art, so cursor tilt, rotation, scaling, lift, and idle motion transform the card and actions together. Sell is vertically centred at the card's right and Use sits beneath it; both match the shop Buy button's dimensions. Owned Emoji Tiles use the same centred Sell position and shared `TiltCard` interaction. |
| `ScoreBox` | blue chips box × red mult box, Jersey 10 numerals, count-up animation on settle. |
| `Button` | **Play word = blue, Discard = red** (Balatro convention, playtest-02 C-5), gold variant (Cash out / early end). Depress on press. |
| `CurrentPatternStatus` | gold pattern symbol + localized name for the highest valid pattern formed by already-submitted words + its live sentence-bonus score, formatted as `pattern name : score` (GDD §7.1). |
| `PouchArt` | One resolver for all 14 Starting Pouches (GDD §12.2). Every runtime image uses the current default's exact `510×511` transparent RGBA canvas and comparable occupied bounds; copies fit with `object-fit: contain` into the shared 72×72 dock, 140×140 New Run preview, and 176×176 Collection carousel preview. New Run and Collection use a large `arrow | panel | arrow` selector. Collection shows one Pouch at a time with art on the left, localized name/effect on the right, and 14 position dots below. The effect panel uses enlarged bold copy; signed/count values, scoring axes, money, and owned voucher names use the shared semantic rich-text colours. Unlocked panels show name/effect without unlock copy; locked panels show a muted silhouette, the centred generated `pouch-lock.png` arcade-pixel sprite, `Locked / 잠김`, and the unlock condition only. The tooltip still supplies actual name/effect and, only while locked, the condition. Art is a simple standalone pixel object—no text, scene, frame, smooth gradient, lighting, or pouch-specific wrapper. Military Pouch carries a chunky olive/khaki camouflage pattern inside the unchanged shared silhouette and hardware. |
| `RecordArt` | One resolver for the 8 cumulative Records (GDD §12.3), also on a `510×511` transparent RGBA canvas. White/Red/Green/Blue/Yellow LP share pixel-identical black vinyl and change only the centre-label colour. Clear LP uses a white label and semi-transparent dithered acrylic disc. CD is visibly smaller than LP in the shared frame; DVD matches CD size with a distinct rainbow-iridescent pixel pattern. New Run gives Records a compact 88×88 preview below the Pouch selector. Name, added penalty, cumulative marker, ordered dots, and lock state communicate the ladder; unlock-condition copy never appears in the panel or tooltip. Records have no Collection category. |

Roster-specific Pouch reads are fixed: Lucky Pouch has one centred gold circular
emblem; Pencil Case and Coin Purse are open and empty with no pencils or coins;
the case-shaped object is displayed as **Briefcase / 서류 가방** while its
internal id remains `lunchBag`.

---

### 3.1 Material legibility (playtest: "I can't tell which material a tile is")

Nine materials (GDD §2.2) cannot be separated by face tint alone at 64px — especially under the CRT pass, which softens fine differences. Three rules:

**① Every material gets a texture/detail cue, not just a hue.** Texture must survive desaturation (the game may be running fully monochrome, §13). **All nine materials share Ceramic's exact outer border, 10px radius, and rounded silhouette (changed 2026-07-30); material identity must stay inside that common edge.**

**② Materials whose effect fires on a *condition* wear that condition as a corner glyph.** The player must be able to read "why is this tile special" without opening a tooltip — this is the single biggest clarity win.

| Material | Face treatment | Corner glyph |
|---|---|---|
| Ceramic (base) | warm face, quiet inset rim and corner dimples | — |
| Porcelain | bright glaze, cobalt inset ring and opposite-corner rosettes | — (flat +Chips) |
| Polished | warm base face, fixed diagonal buff band + animated pixel shine sweep | — (flat +Mult) |
| Glass | translucent facets, inner glow and crossed crack lines | **crack/risk mark** (1/4 destroy) |
| Stone | heavy internal bevel and high-contrast pits, **no letter** | — |
| Lead plate | dark type-metal face, four rivets and diagonal wear scratches | **dice pip** (Lucky rolls) |
| Ivory | cream face, gold inset ridge and curved Schreger-line grain | **$** (pays at blind end *if held*) |
| Brass | engraved face, double inset edge, etched ring and corner screws | **hand icon** (×1.5 *while held*) |
| Wood | strong grain and a visible knot | **live growth counter** — the tile's current +Chips, since it permanently grows +10 per play; a Wood tile that has grown must *look* grown |

**③ Ink contrast is per-material.** `--tile-ink` gets a light variant for dark faces (Lead plate, Stone, and any future dark material); the letter and chip value switch to it automatically. Never let a dark face keep the default dark ink — this is an accessibility floor, not a preference.

Font and edition sit *on top of* material, so a tile can show all three at once: read font from the glyph's weight/style, edition from its overlay (gray sheen / violet shimmer / rainbow cycle), material from face + glyph. Keep the three visual languages non-overlapping.

**Enhancement application motion (changed 2026-07-30).** `TileView` compares the
same tile id's three axes and plays a distinct application beat whenever one is
replaced: material expands as a warm forge burst with outward fragments; font
lands vertically like an inked type press; edition receives a chromatic ring and
foil sweep. If several axes change together, they play in material → font →
edition order with a short stagger. This is one shared tile-level treatment, so
hand, shop, pouch-candidate, pack, and Collection surfaces cannot drift. Reduced
motion shows the committed final face immediately.

**Letter-tile editions (changed 2026-07-31)** use the same colour vocabulary as Emoji Tiles: Gray = ash gray, Violet = ash violet, and Rainbow = animated rainbow. The colour is a translucent, luminance-preserving layer beneath the material texture, so material grain, hardware, cracks, and highlights remain the stronger identity. White is Emoji-Tile-only and never renders on a letter tile.
**Emoji Tile editions (changed 2026-07-31)** use background colour, not persistent special-character badges: Gray = ash gray, Violet = ash violet, Rainbow = animated rainbow, White = white. The treatment overlays the existing Pac-Man-style pixel-art master without adding labels, borders, or scenery. Every non-base Emoji Tile tooltip names the edition in a stacked bottom tag and explains its effect in the left supplemental card.
**Collection reference (changed 2026-07-31):** Collection → Editions presents Base, Gray, White, Rainbow, and Violet as five runtime-size Emoji Tile samples in one unbroken horizontal row using those same live overlays. Narrow viewports scroll horizontally rather than wrapping. Hover/focus copy reuses the canonical edition name and effect; White is not shown as a letter-tile edition.

## 4. Juice spec (motion)

Priority order — implement top-down, cut from the bottom if time-boxed:

1. **Word settle sequence** (the core dopamine loop, GDD §7.1 layer 1): whole-word stamps (suit/gibberish and the highest Letter Hand) → played letter tiles from first to last, with each tile's base score, material/font/edition, and tile-triggered Emoji effects kept together → the owned Emoji Tile list from first to last → tiles still held in the hand, frozen in their visible order at Play time → consumable hooks (reserved for future mechanics) → global/boss beats → committed score rolls. The currently evaluated tile lifts slightly; every score/effect beat makes it bounce. Every tile-specific beat also fires at the source letter tile itself, whether that tile is now in the played-word tray or remains in hand: the tile flashes/bounces and a popup above it shows Chips, Mult, multiplicative factor, gold, or retrigger as applicable. Additive Mult popups use the red Mult colour and render `+N` only; they do not append a redundant `×`. Score-box-only feedback is insufficient. The readable base cadence is **600ms per scoring beat at 1×** (rolled back from 800ms on 2026-07-29), scaled by the game-speed setting; settle completion uses the same calculated duration.
   **Briefcase adds the final axis beat** (GDD §12.2): after every ordinary
   word hook, show a balance-scale stamp and tween the Chips and Mult boxes from
   their final values to their exact shared arithmetic mean, then multiply.
   Repeat independently after every sentence-bonus hook. The beat belongs to the
   score-event log and `settleDurationMs()`; never hide the transform or guess
   its duration. Reduced motion keeps the labeled stamp and snaps the values.
2. **Pattern update**: after settle, the current-pattern symbol and name re-evaluate with a soft flip. Projected score updates internally; if it reaches the target, the score boxes ignite to signal the imminent **auto-settle** (a status cue, not a button — GDD §7.2).
3. **Tile idle wobble**: each hand tile rotates ±1.2° on its own slow sine (staggered delays) — the "alive" feel. Fresh tiles fly from the live pouch position through `useFlip`; the visible origin is clamped one tile inside the work panel so a tile can never flash as a clipped fragment at the right/bottom edge. The hand row has no separate entrance translation. Wobble is suspended during the flight and starts from the flight's matching −1.2° landing angle, so entry never hands off through a visible extra hop. **Jokers & consumables share this wobble family (feature-02 D-4)**; the firing joker is excluded so its settle wiggle wins.
4. **Card motion (changed 2026-07-30):** vouchers, packs, and every Fable, Constellation, and Gambler card idle with a slow 3px float plus ±0.45° sway. Pointer movement pauses the idle loop, lifts and scales the card, tilts it in 3D toward the cursor, and moves a radial sheen with the pointer; leaving eases flat and resumes the idle phase. Keyboard focus straightens, lifts, and adds a gold outline. Generic select = rise 10px + gold ring; shop-offer select raises the complete product/price/action layer by 59px (15px base + 44px action height). Collection pack entries keep the grid image-only—no persistent pack-type, grade, or coming-soon label—but restore the shared type/description/grade tooltip on hover or keyboard focus.
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
   dark/desaturated treatment plus a large ×. Nokdo's forced letter tile keeps
   the ordinary tile face and gains a gold forced-selection tag.
6. **Tomato reactions** (the score icon, D-5): the tomato has a continuous, restrained pixel-step **Idle** loop (1px lift, tiny alternating tilt/squash), then gives a compact, springy **bounce on every scoring beat** — the scoring reaction temporarily replaces Idle while chips count up. Between beats it also occasionally **hops** on a long random timer (a few times per blind, never rhythmic enough to distract). Its panel-relative anchor is a separate, non-animated layout layer: score and idle motion always begin at the displayed tomato position, stay within roughly 4px vertically, and never replace the anchor transform or jump across the panel. Both OS and in-game reduced-motion settings disable every tomato loop.
7. **Burning score boxes** (Balatro port; timing clarified 2026-07-28): on the exact settle beat where `committedBefore + current chips × current mult` reaches the blind target, the chips and mult boxes ignite—even while either number is still climbing—and remain lit through the rest of the blind; **flame size scales with the size of the overshoot**. Sentence-bonus landing uses its live finalized total by the same rule. This is not decoration — with auto-settle (GDD §7.2) there is no cash-out button, so the flame *is* the "you've cleared it" signal. Never wait for the settle to finish before ignition.
   During that sentence-bonus landing, the pattern and level remain on the gold
   stamp while every other source is split into its own compact tag: modifiers
   (Chips colour), Unison (gold), and post-pattern Emoji Tile/voucher/boss
   effects (effect colour). The player must be able to distinguish what the
   pattern supplied from what modified it.
8. **Side interactions** (ambient, non-gameplay; revised 2026-07-28): the encounter pool contains a pixel-art coffee cup, hotel-style call bell, blank cheque, and a conditional coffee-pot refill. Each is set down from above. Three staggered pixel-steam wisps rise from the cup while it waits; clicking drains its separately layered coffee with a distinct *slurp* but **the empty cup remains on the desk**. While—and only while—that persistent cup is empty, the coffee-pot refill joins subsequent random encounter rolls at a deliberately low **12%** chance. The refill always inherits the cup's left/right side, so both remain in the same side layer. Clicking the pot tilts it and produces a tapered, width-varying coffee stream with an amber edge, separated droplets, cup-surface pixel splash and settling liquid wobble; the cup refills and restores its steam, then only the pot exits. The call bell is persistent for the rest of the active round: every click visibly pushes its independently layered top switch down before it springs back, then shakes the bell body, emits stepped side-ring marks with a bright *ding*, and re-arms without leaving. The blank cheque may be **signed by dragging anywhere across the whole cheque object** (mouse or touch): its quantized SVG stroke and pixel pen follow the pointer with a paper-scratch SFX. A click or tiny accidental mark is rejected and cleared; only a deliberate stroke completes the signature, after which the cheque exits. Cup, bell, and pot are responsive between 112–168px; the landscape cheque uses a viewport-safe 144–260px footprint. The left and right margins each own **three non-overlapping vertical zones** (six total), ordered oldest-first from the bottom and compacted independently when a same-side object exits. The right stack's lowest zone starts at least 136px above the viewport bottom (or 14vh, whichever is larger), clearing the complete tile-pouch dock. **Purely cosmetic and never required**: they grant nothing, never overlap the interactive board, and never punish being ignored. Persistent cup/bell fixtures do not block later encounter rolls; at most one transient cheque or refill is active at once. Selection weights remain unchanged; overall encounter frequency is reduced by extending each subsequent roll to a randomized **70–140 seconds**.
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

Quality floor: `prefers-reduced-motion` and the in-game reduced-motion toggle disable wobble/shake, shared card idle, cursor tilt, and sheen (including joker/consumable idle) and reduce settle to fades · keyboard focus visible on tiles, cards, and buttons (gold outline) · every enabled button enlarges on pointer hover and presses down while held without replacing its component transform · all color-coded info (suits, chips/mult) doubled with a text label — never color alone.

**Other feature-02 D visuals.** *D-1 joker reorder:* the owned-joker shelf is drag-reorderable and **order = hook execution order** (GDD §11 intro). *D-5 tomato score icon:* the icon beside score numbers (blind-badge target, round score) is a **pixel tomato** (`src/ui/assets/tomato.png`, from `docs/T_Tomato.png`; tomatoes thrown at bad manuscripts) — the term "Chips" and the blue chips box are unchanged. The tomato is greyscaled until **RED** unlocks (it belongs to the red group). *D-6 retired 2026-07-30:* the main `.frame` is transparent; Draft/Revision/Deadline no longer paint per-stage backdrops. *D-7 (changed 2026-07-31):* Collection uses a centred framed modal. The left column is Emoji Tiles → Pouches → paired Vouchers/Tags → the inset Fable/Constellation/Gambler family panel; the right column is Enhanced Tiles → Editions → Card Packs → Palette → Mascots → Words → Blinds. Tags show all 27 effect-specific icons in a two-page 5×3 gallery with the same tooltips and motion used on Blind Select. Words and Blinds use the 84px category height; ordinary standalone categories and all three consumable buttons use the 75px Voucher height. Emoji Tiles expands to 164px with the space released by the consumable panel, keeping both columns equal in total height. Enhanced Tiles combines the former Materials and Fonts pages as two views behind the shared `< · page · >` pager, not tabs. Records no longer has a Collection category. All three consumable families keep high-detail, path-only, 32-color SVG authoring masters normalized without cropping to the Fable standard: a `500×700` 5:7 output canvas with a `250×350` logical pixel grid. Runtime surfaces use their pixel-identical `500×700` PNG derivatives to avoid parsing more than one million SVG path commands; `scripts/check-card-assets.mjs` verifies both forms. Card Packs follow the same master/runtime split at `244×400`, reducing their shipped runtime art bytes by about 69% while retaining editable path-only masters. They share the same framed SVG component in the 5-column, 10-per-page Collection galleries and in shop, pack, and held-card surfaces. Fable retains its original English title plates, while localized names remain available in tooltips and accessible labels. Twelve Gambler effects, Ink Pack acquisition, and runtime tooltips ship; Rainman and Sake Cup remain art-only/Pending. Detail modals have no shared fixed minimum height and instead size to their actual grid rows, except Card Packs, whose four eight-card pages (Tile, combined Charm + Ink, Fable, Constellation) share the same two-row gallery height. The orange Back bar spans the modal footer; mobile collapses the menu to one column. Where noted, icon/background art currently ships as an emoji/CSS placeholder pending the pixel-art pass.

*D-7a Words reference + records (added 2026-07-30):* Collection → Words begins
with a compact four-card challenge strip: highest-scoring word (intrinsic
letter-chip sum only), longest discovered word, most-played word, and total
discoveries. Beneath it, **Words** and **Register Scores** tabs separate the
searchable word gallery from the live ×1/×1.5/×2/×3 register reference.

*D-7b pattern pictograms (added 2026-07-30):* the zodiac mark already engraved
at the top of each Constellation card becomes the shared pictogram for its
mapped sentence pattern. The same bordered mark precedes the pattern name in
the sentence tray, current-pattern status, Run Info, sentence-bonus stamp,
Constellation-use sequence, and run summary; Constellation tooltips repeat the
mark and mapped pattern.

*D-8 mascot equip (changed 2026-07-31):* skin selection lives in **Collection →
Mascots**, not Settings. Unlocked portrait cards are keyboard/cursor selectable;
the equipped card carries a gold outline and Selected badge. Discovered
tooltip-wrapped cards and undiscovered raw cards share the same 150px basis
width. Locked silhouettes remain visible but non-interactive. Profile Reveal All
writes the selected profile's actual mascot unlock ids, so those art-backed skins
become discovered and selectable without affecting another profile.

---

## 5. Implementation notes (slice ⑥)

- React + plain CSS custom properties (tokens above as `:root` vars). No Tailwind in the game screen — the styling is too bespoke; keep tokens in one `tokens.css`.
- **Pixel-art rendering:** apply `image-rendering: pixelated` to sprite/tile layers; author art at a fixed virtual resolution and integer-scale. Avoid smooth CSS gradients/blurs on pixel surfaces (they break the aesthetic) — use dithering/stepped fills.
- **CRT effect (implemented):** `<CrtOverlay/>` (`src/ui/components/CrtOverlay.tsx`) — three fixed, `pointer-events:none` layers mounted once in App above the app root (scanlines · vignette+barrel · a faint **neutral** bloom kept white so the B&W start stays colorless). Always-on for now; the Settings on/off + intensity toggle (screens §2.11 Graphics) is still to be wired. Scanline flicker is disabled under reduced motion. Because it sits outside the board containers, the chromatic `world-mono` greyscale never touches it.
- Animation: CSS transitions/keyframes first; adopt a spring lib (framer-motion) only if the settle sequence demands it.
- The engine stays headless: UI subscribes to engine state snapshots; the settle sequence is driven by a `ScoreEvent[]` log the engine already produces per submission (chips/mult steps), replayed with timing by the UI.
- Shop, blind select, pack opening and tile modification reuse the play table rather than becoming separate screens. Only their work panels move, entering upward and leaving downward. Draft/Revision Blind Select cards place Select at the top and an `OR → image tag + Skip` group at the bottom. Each of the 27 seeded Editorial Perks uses its own effect-specific square pixel-art PNG, shared portalled tooltip, and pointer-driven 3D tilt/lift/sheen; upcoming offers remain visible but inactive. Deadline has no Skip. A free-pack reward temporarily owns the work panel and the next blind is drawn only after it closes (changed 2026-07-31, GDD §8.2).

---

## 6. Shop mascot — 삐약이 (Piyak), pixel-art cat proprietor

The Stationery Shop (screens §2.6) has a **mascot character: 삐약이 (Piyak), a tuxedo cat who owns/runs the shop**, rendered in pixel-art with the CRT finish. Art: `docs/Piyak.png` (896×1195, transparent background), shipped as `src/ui/assets/piyak.png`.

- **Placement (shipped):** bottom of the shop's left rail, below the gold panel (proprietor behind the counter feel), never overlapping the item slots. Hidden on the ≤720px single-column layout, lying on a pink **cat-face plush cushion** (art supplied by design: `docs/Cushion.png`, trimmed to 564×530 and shipped as `src/ui/assets/piyak-cushion.png`) — the plush sits behind him, ears peeking above his back. (The earlier in-house generated pillow is retired.)
- **Idle animation (shipped, single-sprite):** CSS breathe — subtle vertical squash (scaleY ≈ 0.985, origin at the feet) on a ~3s ease loop. The part-based slicing (blink / tail-flick layers) from the earlier draft needs extra art frames and stays future work.
- **Role in shop (shipped: welcome barker):** on each shop entry Piyak shows one random line from the `mascot.welcome.*` pool (8 lines, i18n) in a pixel-grammar speech bubble (squared corners, ink border, blocky shadow). Purchase/reroll reactions remain a later layer. Track in screens §2.6.
- Respect `prefers-reduced-motion` (and the in-game force-reduced-motion option): freeze to a static frame, bubble appears without motion.

### 6.1 Run-end mascot — 우땅 (WooDak), pixel-art orangutan mentor

The run-end screen (screens §2.7) has the game's second mascot: **우땅 (WooDak), the player's ally/editor-mentor** (art `docs/WooDak.png`, 1024×1054 transparent, shipped as `src/ui/assets/woodak.png`). Reuses the §6 mascot grammar verbatim (`.mascot`/`.mascot-bubble`, breathe keyframe, pixel bubble) plus a slow ±1° sway on a wrapper element; ~150px wide, vertically centered beside the run-end card; enters with a jump-pop (rise + overshoot squash, ~0.45s) and the bubble pops right after landing; hidden ≤720px, frozen under reduced motion. Speech: one contextual line per run end (discoveries → stat tips → generic pool), congratulation prefix on a win; Korean voice tic "~우땅". Future roles (tutorial host, notifications) are planned, not implemented — **tutorial host is now confirmed** (WooDak guides the layered tutorial per `docs/feature-01-tutorial-sound-fontseals.md`; Piyak keeps shop greetings).
