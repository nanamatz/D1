# Apply new art: default pouch, Turtle mascot, card-pack images

**Date:** 2026-07-22
**Status:** Approved

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

The default-pouch art replaces the old bag glyph everywhere a pouch/bag is shown:

- `BagView.tsx` — the in-game `.pouch-art` widget (`👝` → `<img>`); this also covers
  the blind-select screen, where the widget renders.
- `NewRun.tsx` — the New Run bag selector preview (`🎒` → `<img>`).
- `Collection.tsx` `BagsView` — the 도감 Pouches detail (`🎒` → `<img>`).

Minimal CSS sizes the image (`.pouch-art`, `.bag-art` / `.bag-art.big`). Count,
hover, and modal behaviour are unchanged.

## 2. Turtle WooDak skin

Turtle is a chromatic-unlock mascot skin, unlocked by playing `TURTLE`, matching
the ALIEN/GHOST/DOG/CAT pattern. Name: **Turtle** / **느무보**.

- `src/ui/unlocks.ts`: add `'turtle'` to the `{ kind:'mascot'; variant }` union;
  add row `{ id:'TURTLE', word:'TURTLE', effect:{ kind:'mascot', variant:'turtle' } }`.
- `src/ui/mascots.ts`: add `'turtle'` to `WooDakSkin`; import the art; add
  `WOODAK_SKINS` row `{ id:'turtle', unlockId:'TURTLE', nameKey:'mascot.turtle', art: turtleUrl }`.
  The Settings picker (`availableWooDakSkins`) and the 도감 (`mascotCollectionRows`)
  pick it up automatically.
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

- Pouch skins / additional pouch variants (only the single default is wired).
- The CAT mascot variant is retired from the roster (removed 2026-07-22 —
  no unlock row, no skin, no i18n).
- Any change to pack contents, sizes' show/pick/price, or roll weights.
