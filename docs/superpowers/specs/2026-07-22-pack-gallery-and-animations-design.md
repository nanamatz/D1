# Card packs: 4-type taxonomy, collection gallery, idle & opening animations

**Date:** 2026-07-22
**Status:** Approved

Reference layout: `docs/Arts/Reference.png` (paged pack-collection gallery — grid
of pack artwork, `‹ page n/m ›` pager, Back bar).

## Goal

1. Cut the pack taxonomy to **4 types** and rename them; remove Forbidden Stacks.
2. Rebuild Collection → Packs as a **paged gallery** matching the reference.
3. Give every pack a subtle **idle animation**.
4. Play a shared **open sequence** (shake → burst → cards fly in) when a pack opens.

## Part A — Pack taxonomy (engine + i18n + docs)

Confirmed types: `pattern | joker | consumable | tile`. `forbidden` is removed.

- **Remove `forbidden` pack type:** `PackType` (`types.ts`), `balance.pack.typeWeights`,
  `PACK_TYPES` (`shop.ts`, `Collection.tsx`), `packs.ts` (`forbidden` case,
  `FORBIDDEN_POOL`, the `'forbidden'` `PackOption` kind), `PackOpening.tsx`
  (`forbidden` emoji/tooltip/slot-block branches).
- **Remove forbidden items** `bookBurning/apocrypha/scribbles/apocalypse`: from
  `ConsumableId`, the `'forbidden'` value of `ConsumableFamily`, and their i18n
  (`consumable.*`, `consumabledesc.*`). Fix any family lookups that enumerated it.
- **Display renames** (i18n only — engine ids stay `pattern/joker/consumable/tile`):

  | id | EN | KO |
  |----|----|----|
  | joker | Charm Pack | 부적 팩 |
  | pattern | Ink Pack | 잉크 팩 |
  | tile | Tile Pack | 타일 팩 |
  | consumable | Consumable Pack | 소모품 팩 |

  Also update `packdesc.*` bodies to match; remove `pack.type.forbidden` /
  `packdesc.forbidden`.
- **Docs:** GDD §9.3 (5→4 types + rename table), §10.3 / the "Forbidden" section
  (drop Forbidden Books as a shipped pack), CLAUDE.md pack mentions, and
  `tutorial.firstConsumable` copy (drop "forbidden books").
- The `forbiddenPaper` boss ("금서") is a different system — **untouched**.

### Art normalization (2026-07-22 follow-up)

The 7 source pack PNGs are drawn at slightly different ratios (~0.59–0.63 w/h), which
made `object-fit: contain` render them at inconsistent sizes. `scripts/normalize-pack-art.mjs`
(`npm run normalize:packs`, uses `pngjs`) pads each with **transparent margins**
(centered — no scaling, crop, or distortion) to a common **0.61** ratio and writes the
bundled copies under `src/ui/assets/packs`. Source art in `docs/Arts/CardPacks` stays
pristine; re-run the script whenever it changes. The gallery/shop boxes match that ratio.

## Part B — Collection → Packs paged gallery

Rebuild `PacksView`:
- Grid of pack artwork; a `‹ 페이지 n/m ›` pager (reuse `Pager`); the existing Back
  bar stays.
- **One page per pack type** (matching Reference.png's per-type pages), in order
  Tile → Charm → Ink → Consumable. Art-backed types show every variant in size order
  (Basic → Classic → Premium); a type without art (Consumable) shows a single
  **"coming soon" silhouette**. *(Update 2026-07-23: Charm ×4 and Ink ×8 art added, so
  only Consumable remains coming-soon — 4 pages of 7 / 4 / 8 / 1.)*
- Pagination via a pure `packGalleryPages()` returning, per page, the ordered entries
  (`{ kind: 'art', type, size, src } | { kind: 'comingSoon', type }`) — unit-tested.

## Part C — Pack idle animation

A shared CSS idle on every pack image (gallery cards + shop pack cards):
`@keyframes packIdle` — slow bob (`translateY`) + slight `rotate`, ~3s
`ease-in-out infinite`, **staggered** by `animation-delay` (nth-child) so cards
don't move in unison. Disabled under `prefers-reduced-motion` and
`body.force-reduced-motion`.

## Part D — Shared pack-opening sequence

`PackOpening` gains a phase machine: `opening → revealed`.
1. `opening`: the pack (tile art, or a generic pack shape for the others) sits
   center and **shakes** (~400ms).
2. **Flash + burst**: white flash + CSS particle pop; pack scales up and vanishes.
3. `revealed`: the option cards **fly/scale in**, staggered.

CSS keyframes + `useState` phase + timers (no new dependency). Under reduced-motion,
skip straight to `revealed` with a quick fade — no shake/burst. Common to all types.

## Testing

- Engine: `rollPack`/`rollShopStock` never yield `forbidden`; `PACK_TYPES.length === 4`;
  forbidden items removed (compile-time). Repair existing pack tests that referenced
  `forbidden`.
- `packGalleryPages()` pagination: correct entry order, page count, per-page chunking.
- Idle + opening animations verified by driving the running app (screenshots).

## Out of scope

- Real art for Charm/Consumable/Ink packs (silhouettes until it exists).
- Renaming individual jokers/consumables (only the **pack** labels change).
- Any change to pack sizes, show/pick counts, prices, or the tile-pack art itself.
