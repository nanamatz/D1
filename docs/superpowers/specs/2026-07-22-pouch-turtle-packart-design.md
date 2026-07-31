# Apply new art: default pouch, Turtle mascot, card-pack images

**Date:** 2026-07-22
**Status:** Approved

> **Amended 2026-07-30 — Starting Pouches + Records.** The single default
> Pouch was the first asset, not a permanent one-entry roster. GDD §12 now
> defines 14 Starting Pouches and 8 cumulative Records. The old
> starting-bag/stake/Ink-difficulty placeholders are retired; Ink Pack remains
> unrelated consumable-pack terminology.

## Goal

Wire three sets of newly-prepared pixel-art assets into the UI, following the
established headless-engine / art-in-UI split (`bossArt.ts`, `mascots.ts`):

1. A **default pouch** icon replaces the `👝` glyph in the pouch widget.
2. A new **Turtle** WooDak skin, unlocked by playing the word `TURTLE`.
3. **Card-pack** art per size, with per-size variants chosen by the seeded RNG,
   plus a display rename of the pack-size tiers.

## Source assets

- `docs/Arts/Icons/T_DefaultPouch.png`
- `docs/Arts/Mascots/T_Turtle.png`
- `docs/Arts/CardPacks/T_BasicPack{1,2,3}.png` (3), `T_ClassicPack{1,2}.png` (2),
  `T_PremiumPack{1,2}.png` (2)

Runtime copies live under `src/ui/assets/` so Vite bundles them (engine never
imports them):

- `assets/pouch.png`
- `assets/turtle.png`
- `assets/packs/T_BasicPack{1,2,3}.png`, `T_ClassicPack{1,2}.png`, `T_PremiumPack{1,2}.png`

## 1. Pouch icon

The default-pouch art replaced the old bag glyph everywhere the original single
Pouch was shown:

- `BagView.tsx` — the in-game `.pouch-art` widget (`👝` → `<img>`); this also covers
  the blind-select screen, where the widget renders.
- `NewRun.tsx` — the then-single New Run selector preview (`🎒` → `<img>`), now
  the 14-entry Starting-Pouch selector.
- `Collection.tsx` `PouchesView` — the Collection Pouches detail
  (`🎒` → `<img>`).

Minimal CSS sizes the image (`.pouch-art`, `.bag-art` / `.bag-art.big`). Count,
hover, and modal behaviour are unchanged.

**2026-07-30 family contract.** Treat this default as **Yellow Pouch**, the first
of the 14-entry Starting-Pouch family. Every runtime image uses the same exact
`510×511` transparent RGBA canvas and comparable occupied bounds as
`src/ui/assets/pouch.png`.
Each is a simple standalone pixel-art object with no text, scene, frame, smooth
gradient, or lighting setup. All variants reuse the shared 72×72 in-run,
140×140 New Run, and 86×86 Collection boxes; the selected Pouch changes the image,
not component dimensions.

Records use their own shared resolver and transparent selector frame. White,
Red, Green, Blue, and Yellow LP are pixel-identical black vinyl except for the
centre label; Clear LP has a white label and semi-transparent acrylic disc; CD
is visibly smaller than LP; DVD matches CD size with a distinct rainbow surface.
See GDD §12.3 and `docs/UI_DESIGN.md` for the canonical art contract.

## 2. Turtle WooDak skin

Turtle is a chromatic-unlock mascot skin, unlocked by playing `TURTLE`, matching
the ALIEN/GHOST/DOG/CAT pattern. Name: **Turtle** / **느무보**.

- `src/ui/unlocks.ts`: add `'turtle'` to the `{ kind:'mascot'; variant }` union;
  add row `{ id:'TURTLE', word:'TURTLE', effect:{ kind:'mascot', variant:'turtle' } }`.
- `src/ui/mascots.ts`: add `'turtle'` to `WooDakSkin`; import the art; add
  `WOODAK_SKINS` row `{ id:'turtle', unlockId:'TURTLE', nameKey:'mascot.turtle', art: turtleUrl }`.
  The Collection mascot picker (`mascotCollectionRows`) picks it up automatically;
  `availableWooDakSkins` remains the availability helper.
- i18n: `mascot.turtle` = `"Turtle"` (en) / `"느무보"` (ko).

Gibberish never unlocks; valid words only (existing unlock rule, unchanged).

## 3. Pack-size display rename

Display strings only — engine ids stay `normal` / `jumbo` / `mega`
(terminology-is-display-strings rule):

| id | en | ko |
|----|----|----|
| normal | Basic | 기본 |
| jumbo | Classic | 클래식 |
| mega | Premium | 프리미엄 |

## 4. Pack art + seeded variant

Each pack instance shows one of its size's art variants, chosen by the one
seeded RNG at stock time (reproducible per run seed).

- `src/engine/types.ts`: `PackSlot` gains `artVariant: number`.
- `src/engine/balance.ts`: `pack.artVariants = { normal: 3, jumbo: 2, mega: 2 }`
  (config, keyed to the available art count — no magic number in code).
- `src/engine/shop.ts` `rollPacks`: set
  `artVariant: rng.int(BALANCE.pack.artVariants[size])`.
- `src/ui/packArt.ts` (new): `PACK_ART: Record<PackSize, string[]>` mapping
  `normal → [basic1, basic2, basic3]`, `jumbo → [classic1, classic2]`,
  `mega → [premium1, premium2]`; `packArt(size, variant)` returns the URL
  (variant guarded by modulo so an out-of-range index is safe). The engine never
  imports an image — only the UI maps `(size, artVariant) → PNG`, same split as
  `bossArt.ts`.

**Tile-pack only (2026-07-22).** The art is tile/Type-pack art, so it is shown
**only for pack type `tile`**; every other pack type keeps the `📦` glyph until it
gets its own art. `artVariant` is still rolled for every pack (harmless, unused for
non-tile) so tile packs stay seed-reproducible.

- `src/ui/components/Shop.tsx`: tile pack → pack art; other types → `📦`.
- `src/ui/components/PackOpening.tsx`: tile pack → header art; others → none.
- `src/ui/components/Collection.tsx` `PacksView`: the tile entry shows the art
  (`packArt('normal', 0)` as its representative); other type entries keep `📦`.

## Tests

- `src/engine` test: `rollPacks` sets `artVariant` within
  `[0, artVariants[size])` for every stocked pack, and the same seed reproduces
  the same variants.
- `packArt(size, variant)` returns a defined URL for every size and every valid
  variant index.
- Typecheck + build.

## Out of scope

- This historical patch still wires only the first Pouch asset. Producing and
  wiring the remaining 13 Pouches and 8 Record assets is follow-up work governed
  by the 2026-07-30 amendment above—not an open design question.
- The CAT mascot variant is retired from the roster (removed 2026-07-22 —
  no unlock row, no skin, no i18n).
- Any change to pack contents, sizes' show/pick/price, or roll weights.
