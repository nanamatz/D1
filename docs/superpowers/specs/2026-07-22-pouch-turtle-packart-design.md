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

`src/ui/components/BagView.tsx`: replace the `👝` text inside `.pouch-art` with
`<img src={pouchUrl} alt="">`. Add minimal CSS to size the image to the widget.
Count, hover, and modal behaviour are unchanged.

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
| normal | Base | 기본 |
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
- `src/ui/components/Shop.tsx`: replace the `📦` glyph with the pack art.
- `src/ui/components/PackOpening.tsx`: show the pack art in the header next to the
  `type · size` title.

## Tests

- `src/engine` test: `rollPacks` sets `artVariant` within
  `[0, artVariants[size])` for every stocked pack, and the same seed reproduces
  the same variants.
- `packArt(size, variant)` returns a defined URL for every size and every valid
  variant index.
- Typecheck + build.

## Out of scope

- Pouch skins / additional pouch variants (only the single default is wired).
- Mascot art for CAT (stays `art: null`).
- Any change to pack contents, sizes' show/pick/price, or roll weights.
