# WORD JOKER — UI Design Spec

**Design thesis: Balatro's arcade grammar, a stationer's materiality.**
We borrow Balatro's screen *grammar* — left info panel, joker shelf on top, hand fanned at the bottom, chunky panels with hard offset shadows, juicy score feedback — but the material world is our own: **ceramic letter tiles on a letterpress desk**, not cards on casino felt. Never copy Balatro's assets, fonts, or textures (trade-dress line); capture the feel through our own theme, which the GDD already provides (materials §2.2, fonts §2.3).

The visual contract is `docs/mockups/play-screen.html`. When spec and mockup disagree, the mockup wins.

---

## 1. Design tokens

### Palette

| Token | Hex | Use |
|---|---|---|
| `--bg-desk` | `#22443B` | table surface (deep desk-green, vignetted) |
| `--panel` | `#20303B` | UI panels (dark slate) |
| `--panel-edge` | `#39505E` | panel top-edge highlight |
| `--ink` | `#EDEAE2` | primary text on dark |
| `--ink-dim` | `#9DB0B8` | secondary text |
| `--chips` | `#3FA7F5` | Chips (blue — genre convention) |
| `--mult` | `#F5504E` | Mult (red — genre convention) |
| `--gold` | `#F0B23E` | money, projected score, early-end glow |
| `--tile-face` | `#F4EDDF` | ceramic tile face (warm ivory) |
| `--tile-ink` | `#2B2620` | tile letter ink |

Suit colors (word frames & badges): standard `#B9C4CB` · formal `#7E96F2` · slang `#F09437` · vulgar `#C6479E`. Vulgar is magenta, not red — red is reserved for Mult.

### Type

| Role | Face | Notes |
|---|---|---|
| Score display / big numbers | **Jersey 10** (Google Fonts) | condensed pixel feel for the arcade register; numbers only |
| Tile letters | **Jost** | the GDD's own Futura stand-in (§2.3). Font *editions* are Jost weights/styles: Medium 500 (base) · Light Italic 300i · Bold 700 · Inline (500 + text-stroke outline) · Black 900 |
| UI labels / body | **Baloo 2** | rounded, chunky, friendly; sentence case |

### Surface language

- Radius: panels 14px, tiles 10px, buttons 12px.
- **Hard offset shadow** is the signature surface cue: `box-shadow: 0 5px 0 rgba(0,0,0,.35)` (no blur). Buttons depress 3px on press (translateY + shadow shrink).
- Panels get a 1px `--panel-edge` top border as a bevel highlight.
- Background: `--bg-desk` + radial vignette + very subtle noise (CSS gradient noise, no image assets).

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
│  exchanges │                                              │
│  gold/ante │   HAND (11 ceramic tiles, slight fan/wobble) │
│            │        [PLAY WORD]   [EXCHANGE]              │
└────────────┴──────────────────────────────────────────────┘
```

**Signature element — the Sentence Tray.** Balatro has no equivalent: our played words accumulate left-to-right *as a sentence under construction*. Each played word is a mini-card group (its tiles shrunk), framed in its suit color, with a POS tag chip beneath. A gibberish play renders as a cracked/burned slot — the **hole** made visible. At the tray's right end, a pattern status chip shows the live judgment ("Transitive ✓ ×2" / "— no pattern"). This tray is the game's identity on screen; spend the polish budget here.

Sidebar (top→bottom): blind badge (kind + boss name when boss) with target score · committed score as `[chips]×[mult]` blue/red boxes · projected score in gold (pulses when ≥ target; early-end button lights up) · phase dots · exchange dots · gold · ante N/8.

---

## 3. Component inventory

| Component | Notes |
|---|---|
| `Tile` | 64px ceramic square: ivory face, glaze highlight (top-left radial), letter in Jost (case shown literally: h vs H), chip value bottom-right. **Material variants:** porcelain = whiter + cool border; polished = animated shine sweep; glass = translucent + inner glow; stone = gray speckle. **Font editions** = Jost weight/style per §1. Selected = raised 10px + gold outline. |
| `SentenceTray` | see §2. Includes `HoleSlot` (gibberish) and `PatternChip`. |
| `JokerCard` | chunky card with large emoji, name on hover tooltip; rarity = frame color (common gray / uncommon blue / rare red / legendary gold shimmer). |
| `ScoreBox` | blue chips box × red mult box, Jersey 10 numerals, count-up animation on settle. |
| `Button` | primary red (Play word), secondary blue (Exchange), gold variant (Cash out / early end). Depress on press. |
| `ProjectedPanel` | gold number + tiny breakdown line (pattern + unison), overwritten each phase (GDD §7.1). |

---

## 4. Juice spec (motion)

Priority order — implement top-down, cut from the bottom if time-boxed:

1. **Word settle sequence** (the core dopamine loop, GDD §7.1 layer 1): staged tiles fly to the tray → chips box counts up per tile (tick per letter) → suit stamp slams onto the word frame → mult box multiplies → committed score rolls. ~900ms total, skippable.
2. **Projected update**: after settle, pattern chip re-evaluates with a soft flip; projected number rolls to new value; if ≥ target, early-end button ignites (gold pulse).
3. **Tile idle wobble**: each hand tile rotates ±1.2° on its own slow sine (staggered delays) — the "alive" feel.
4. **Hover/select**: hover = lift 4px + straighten; select = rise 10px + gold ring.
5. **Boss intro**: boss badge stamps in with a screen shake (respect reduced motion).

Quality floor: `prefers-reduced-motion` disables wobble/shake and reduces settle to fades · keyboard focus visible on tiles and buttons (gold outline) · all color-coded info (suits, chips/mult) doubled with a text label — never color alone.

---

## 5. Implementation notes (slice ⑥)

- React + plain CSS custom properties (tokens above as `:root` vars). No Tailwind in the game screen — the styling is too bespoke; keep tokens in one `tokens.css`.
- Animation: CSS transitions/keyframes first; adopt a spring lib (framer-motion) only if the settle sequence demands it.
- The engine stays headless: UI subscribes to engine state snapshots; the settle sequence is driven by a `ScoreEvent[]` log the engine already produces per submission (chips/mult steps), replayed with timing by the UI.
- Screens after the play screen (shop, blind select, pack opening) reuse the same tokens/components; design them after slice ⑤ logic exists. The mockup covers the play screen only.
