# Collection material tooltips — design

Date: 2026-07-19. Approved in-session.

## Goal

The Collection (도감) materials view shows only tile swatches + names. Add the
effect description as a hover tooltip per material, matching how jokers /
vouchers / bosses already present theirs.

## Design

- **UI:** `MaterialsView` (`src/ui/components/Collection.tsx`) wraps each swatch
  in the shared `<Tooltip>` (`down`, same as every other collection tooltip —
  the screen is top-aligned).
  - `title` = `t('material.<id>')`, `body` = `t('materialdesc.<id>')`.
- **Copy:** new `materialdesc.<id>` keys in `locales/en.json` + `ko.json` for
  all 8 materials (ceramic included: "base material — no effect"). Follows the
  `jokerdesc.*` convention: numbers hardcoded in copy (must match
  `BALANCE.materials`), rich-text markup `[c:…]`/`[m:…]`/`[b:…]`, gold written
  `+$N` (thrift voucher precedent), blind-end phrasing "[b:블라인드] 종료 시".
- **Effects source of truth:** `src/engine/materials.ts` + `BALANCE.materials`
  (GDD §2.2). No engine changes.
- **Test:** extend `tests/materials-registries.test.ts` (I-1 regression guard)
  to require `materialdesc.<id>` in both locales for every material.

## Out of scope

Fonts (서체) — GDD §2.3 marks font effects as undefined/visual-only, so no
effect tooltip exists to show. In-game tile tooltips (StagePanel C-4) keep
showing name-only for now.
