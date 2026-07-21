# Play the Wor!d — UI Design Spec

> **Art-direction change (this revision): pixel-art + CRT.** The game now fully adopts a pixel-art/CRT aesthetic. The previous "ceramic letterpress, deliberately un-Balatro" identity and its trade-dress guardrail are **retired**. We still avoid copying Balatro's specific art assets, but the pixel-art idiom, CRT treatment, and Balatro-style screen grammar are all embraced. Existing screens are **restyled, not rebuilt** — semantic tokens and layout stay; surface treatment (pixelation, squared corners, blocky shadows, global CRT pass) changes. A pixel-art shop mascot (tuxedo cat proprietor) is added (§6).


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
| `--gold` | `#F0B23E` | money, projected score, early-end glow | **YELLOW** (locked `#A89E84`) |
| `--tile-face` | `#F4EDDF` | letter tile face (warm ivory, pixel-art shaded) | — |
| `--tile-ink` | `#2B2620` | tile letter ink | — |

Suit colors (word frames & badges): standard `#B9C4CB` · formal `#7E96F2` · slang `#F09437` · vulgar `#C6479E`. Vulgar is magenta, not red — red is reserved for Mult.

> **Chromatic unlocks (feature-02 C, GDD §13 — "truly monochrome").** The **entire** palette holds **neutral grey** locked values by default (not just the four accent tokens) — the slate chrome, tile faces, and suits are grey too, so the world starts *genuinely* black-and-white. Group assignment: **RED** = `--mult`, `--suit-vulgar`; **YELLOW** = `--gold`, `--suit-slang`, `--tile-face`; **GREEN** = `--bg-desk`; **BLUE** = `--chips`, `--suit-formal`, `--suit-standard`, `--panel`, `--panel-edge`, `--inset`, `--inset-edge`. Playing the color word toggles an `unlock-<group>` class on `<html>` that swaps in the true hex (token swapping in `tokens.css`), re-coloring progressively. A **`world-mono` guard** additionally greyscales the board (`filter: grayscale(1)`) *only while no color is unlocked*, covering hard-coded fills (materials, badge, stage backdrops); it's dropped on the first unlock. The fixed CRT overlay is outside the greyscaled containers. MUSIC/SOUND gate the audio buses, not colors. Info is never color-only (a11y), so the grey start stays readable.

### Type

| Role | Face | Notes |
|---|---|---|
| Score display / big numbers | **Jersey 10** (Google Fonts) | already a pixel face — keep; it now sets the tone for the whole UI rather than being the odd one out |
| Tile letters | **Jost** | the GDD's own Futura stand-in (§2.3). **Five fonts** map onto Jost weights/styles, matching the `TileFont` union (`medium`/`lightItalic`/`bold`/`inline`/`black`): Medium 500 (base) · Light Italic (Jost 300 italic) · Bold 700 · Inline (500 + text-stroke outline) · Black 900. The four non-base fonts now carry **seal effects** (GDD §2.3); tile tooltips read the effect text from `balance.ts` `fontEffects` — never hard-coded |
| UI labels / body | **Baloo 2** | rounded, chunky; sentence case |

> **Pixel-font note (art-shift) — RESOLVED to (a), "modern pixel hybrid".** Jost and Baloo 2 are smooth vector faces that read slightly against the pixel-art surfaces; we **keep them**, rendered at crisp sizes, and lean on Jersey 10 (already a pixel face) for headline/numeric moments. The two candidates considered were **(a)** keep the current faces as a hybrid — *chosen* — and **(b)** swap UI/tile faces for true bitmap fonts (Pixelify Sans / Silkscreen / Departure Mono), *rejected*. Because (a) is chosen, the **font mapping (GDD §2.3) is unchanged**: it stays **five** — Jost Medium 500 (base) / Light Italic (Jost 300 italic) / Bold 700 / Inline (500 + text-stroke) / Black 900 — matching `TileFont` and `fontClass()`. (An earlier draft of this note mis-stated a "Light Italic removed, 4 fonts" patch; no such patch exists in GDD §2.3, and the code carries all five — corrected here. Revisit only if the hybrid reads too soft in playtest; a later swap to (b) would then re-open the mapping.)

### Surface language (pixel-art / CRT)

- **Pixel grid.** Author UI at a low virtual resolution and scale up with integer nearest-neighbor (`image-rendering: pixelated`) so edges stay crisp. Borders/shadows are 1–2 "big pixels" wide, not sub-pixel.
- **Hard offset shadow** stays the signature surface cue but as blocky pixel shadow: a solid dark step down-right (no blur), e.g. a 4–5px hard offset that reads as a chunk, not a soft `box-shadow`. Buttons depress on press (translate + shadow collapse).
- Radius: keep corners **squared or 1-step chamfered** — rounded 14px radii read as non-pixel; prefer hard pixel corners or a single-pixel bevel.
- Panels get a light top-edge pixel highlight (`--panel-edge`) and a dark bottom-edge for the stamped/embossed look.
- **CRT post-effect** (global, toggleable in Settings, GDD/screens §2.11): scanlines + slight bloom + subtle barrel/vignette. Ship it as a full-screen overlay/shader pass so any screen inherits it. Must be **disable-able** (accessibility + the reduced-motion/low-end path), and scanline intensity should be a slider (the reference build exposed a "CRT" strength + "CRT bloom" toggle).
- Background: `--bg-desk` + vignette; noise/texture rendered at the pixel grid, not as a smooth gradient.

> **Migration note.** Existing components built to the old "ceramic/smooth" surface language (soft radii, blurless-but-fine offset shadows) are **restyled, not rebuilt** — the token names and layout stay; only the surface treatment (pixelation, CRT, squared corners, blocky shadows) changes. Keep all semantic tokens (`--chips`, `--mult`, `--gold`, suit colors) — they are genre conventions and remain correct.

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
│  projected ├──────────────────────────────────────────────┤
│  phases ●●○○   STAGED WORD preview (validity·suit·score)  │
│  discards  │                                              │
│  gold/ante │   HAND (11 pixel-art tiles, slight fan/wobble) │
│            │        [PLAY WORD]   [DISCARD]               │
└────────────┴──────────────────────────────────────────────┘
```

**Signature element — the Sentence Tray.** Balatro has no equivalent: our played words accumulate left-to-right *as a sentence under construction*. Each played word is a mini-card group (its tiles shrunk), framed in its suit color, with a POS tag chip beneath. A gibberish play renders as a cracked/burned slot — the **hole** made visible. At the tray's right end, a pattern status chip shows the live judgment ("Transitive ✓ ×2" / "— no pattern"). This tray is the game's identity on screen; spend the polish budget here.

Sidebar (top→bottom): blind badge (kind + boss name when boss) with target score · committed score as `[chips]×[mult]` blue/red boxes · projected score in gold (pulses when ≥ target — the auto-settle status indicator; there is **no** early-end/cash-out button, GDD §7.2) · phase dots · discard dots · gold · ante N/8.

---

## 3. Component inventory

| Component | Notes |
|---|---|
| `Tile` | 64px (integer-scaled) pixel-art letter tile: ivory face with pixel-shaded glaze highlight (top-left), letter (case shown literally: h vs H), chip value bottom-right. **Material variants (8, GDD §2.2)** rendered as pixel treatments: porcelain = whiter face + cool 1px border; polished = animated pixel shine sweep; glass = translucent + inner glow; stone = gray speckle/dither; **ivory = warm cream with a subtle sheen; brass = metallic gold dither + coin glint; lead = dark grey type-metal with a beveled edge**. **Font editions (4)** = per §1 Type note. Selected = raised + gold pixel outline. |
| `SentenceTray` | see §2. Includes `HoleSlot` (gibberish) and `PatternChip`. |
| `JokerCard` | chunky card with large emoji, name on hover tooltip; rarity = frame color (common gray / uncommon blue / rare red / legendary gold shimmer). |
| `ScoreBox` | blue chips box × red mult box, Jersey 10 numerals, count-up animation on settle. |
| `Button` | **Play word = blue, Discard = red** (Balatro convention, playtest-02 C-5), gold variant (Cash out / early end). Depress on press. |
| `ProjectedPanel` | gold number + tiny breakdown line (pattern + unison), overwritten each phase (GDD §7.1). |

---

## 4. Juice spec (motion)

Priority order — implement top-down, cut from the bottom if time-boxed:

1. **Word settle sequence** (the core dopamine loop, GDD §7.1 layer 1): staged tiles fly to the tray → chips box counts up per tile (tick per letter) → suit stamp slams onto the word frame → mult box multiplies → committed score rolls. ~900ms total, skippable.
2. **Projected update**: after settle, pattern chip re-evaluates with a soft flip; projected number rolls to new value; if ≥ target, the projected panel ignites (gold pulse) to signal the imminent **auto-settle** (a status cue, not a button — GDD §7.2).
3. **Tile idle wobble**: each hand tile rotates ±1.2° on its own slow sine (staggered delays) — the "alive" feel. **Jokers & consumables share this wobble family (feature-02 D-4)**; the firing joker is excluded so its settle wiggle wins.
4. **Hover/select**: hover = lift 4px + straighten; select = rise 10px + gold ring.
5. **Boss intro**: boss badge stamps in with a screen shake (respect reduced motion).
6. **Drag dot-outline (feature-02 D-2)**: while dragging a tile or a joker, the origin slot shows a dashed pixel outline and the live insertion gap shows a dashed bar (Balatro feel). Applies to hand, tile zone, and the joker shelf.

Quality floor: `prefers-reduced-motion` disables wobble/shake (incl. joker/consumable idle) and reduces settle to fades · keyboard focus visible on tiles and buttons (gold outline) · all color-coded info (suits, chips/mult) doubled with a text label — never color alone.

**Other feature-02 D visuals.** *D-1 joker reorder:* the owned-joker shelf is drag-reorderable and **order = hook execution order** (GDD §11 intro). *D-5 tomato score icon:* the icon beside score numbers (blind-badge target, round score) is a **pixel tomato** (`src/ui/assets/tomato.png`, from `docs/T_Tomato.png`; tomatoes thrown at bad manuscripts) — the term "Chips" and the blue chips box are unchanged. The tomato is greyscaled until **RED** unlocks (it belongs to the red group). *D-6 stage backgrounds:* per-stage backdrops under the CRT pass — **초고/Draft** = writer's desk, **퇴고/Revision** = marked-up manuscript, **마감/Deadline** = the red-pen office (tense red wash); desaturation-aware (GREEN unlock, C-3, will later gate their color). *D-7:* all Collection categories share the Words category's height (uniform). Where noted, icon/background art currently ships as an emoji/CSS placeholder pending the pixel-art pass.

---

## 5. Implementation notes (slice ⑥)

- React + plain CSS custom properties (tokens above as `:root` vars). No Tailwind in the game screen — the styling is too bespoke; keep tokens in one `tokens.css`.
- **Pixel-art rendering:** apply `image-rendering: pixelated` to sprite/tile layers; author art at a fixed virtual resolution and integer-scale. Avoid smooth CSS gradients/blurs on pixel surfaces (they break the aesthetic) — use dithering/stepped fills.
- **CRT effect (implemented):** `<CrtOverlay/>` (`src/ui/components/CrtOverlay.tsx`) — three fixed, `pointer-events:none` layers mounted once in App above the app root (scanlines · vignette+barrel · a faint **neutral** bloom kept white so the B&W start stays colorless). Always-on for now; the Settings on/off + intensity toggle (screens §2.11 Graphics) is still to be wired. Scanline flicker is disabled under reduced motion. Because it sits outside the board containers, the chromatic `world-mono` greyscale never touches it.
- Animation: CSS transitions/keyframes first; adopt a spring lib (framer-motion) only if the settle sequence demands it.
- The engine stays headless: UI subscribes to engine state snapshots; the settle sequence is driven by a `ScoreEvent[]` log the engine already produces per submission (chips/mult steps), replayed with timing by the UI.
- Screens after the play screen (shop, blind select, pack opening) reuse the same tokens/components; design them after slice ⑤ logic exists. The mockup covers the play screen only.

---

## 6. Shop mascot — 삐약이 (Piyak), pixel-art cat proprietor

The Stationery Shop (screens §2.6) has a **mascot character: 삐약이 (Piyak), a tuxedo cat who owns/runs the shop**, rendered in pixel-art with the CRT finish. Art: `docs/Piyak.png` (896×1195, transparent background), shipped as `src/ui/assets/piyak.png`.

- **Placement (shipped):** bottom of the shop's left rail, below the gold panel (proprietor behind the counter feel), never overlapping the item slots. Hidden on the ≤720px single-column layout, lying on a pink **cat-face plush cushion** (art supplied by design: `docs/Cushion.png`, trimmed to 564×530 and shipped as `src/ui/assets/piyak-cushion.png`) — the plush sits behind him, ears peeking above his back. (The earlier in-house generated pillow is retired.)
- **Idle animation (shipped, single-sprite):** CSS breathe — subtle vertical squash (scaleY ≈ 0.985, origin at the feet) on a ~3s ease loop. The part-based slicing (blink / tail-flick layers) from the earlier draft needs extra art frames and stays future work.
- **Role in shop (shipped: welcome barker):** on each shop entry Piyak shows one random line from the `mascot.welcome.*` pool (8 lines, i18n) in a pixel-grammar speech bubble (squared corners, ink border, blocky shadow). Purchase/reroll reactions remain a later layer. Track in screens §2.6.
- Respect `prefers-reduced-motion` (and the in-game force-reduced-motion option): freeze to a static frame, bubble appears without motion.

### 6.1 Run-end mascot — 우땅 (WooDak), pixel-art orangutan mentor

The run-end screen (screens §2.7) has the game's second mascot: **우땅 (WooDak), the player's ally/editor-mentor** (art `docs/WooDak.png`, 1024×1054 transparent, shipped as `src/ui/assets/woodak.png`). Reuses the §6 mascot grammar verbatim (`.mascot`/`.mascot-bubble`, breathe keyframe, pixel bubble) plus a slow ±1° sway on a wrapper element; ~150px wide, vertically centered beside the run-end card; enters with a jump-pop (rise + overshoot squash, ~0.45s) and the bubble pops right after landing; hidden ≤720px, frozen under reduced motion. Speech: one contextual line per run end (discoveries → stat tips → generic pool), congratulation prefix on a win; Korean voice tic "~우땅". Future roles (tutorial host, notifications) are planned, not implemented — **tutorial host is now confirmed** (WooDak guides the layered tutorial per `docs/feature-01-tutorial-sound-fontseals.md`; Piyak keeps shop greetings).
