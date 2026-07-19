# Piyak Pink Cushion — Design

Date: 2026-07-19
Status: approved (design), pending implementation

## Goal

삐약이 (Piyak) in the shop rail should look like he's lying on a **pink
cushion**. No cushion art exists; it is produced in-house (user decision).

## Asset (generated pixel art)

A Node script draws a flat pillow-shaped pixel-art cushion at logical
resolution ~48×20 px, scaled ×4 with nearest-neighbor to keep crisp pixels:
pink base, darker pink outline + bottom shade, top-left highlight, corner
stitch pixels. Output committed as `src/ui/assets/piyak-cushion.png`, with a
reference copy at `docs/PiyakCushion.png` (mascot-asset convention). The
generator script is throwaway (scratchpad), not committed.

## Rendering

`ShopMascot.tsx`: wrap the cat in a relative container; the cushion `<img>`
sits behind/below (absolute, bottom), width ~160px (slightly wider than the
140px cat); the cat is nudged down a few px so its body overlaps the
cushion's top edge — reading as "lying on it". Breathe animation stays on the
cat only; the cushion is static. `image-rendering: pixelated` on both.
Classes: `.mascot-seat` (container), `.mascot-cushion` (img).

## Docs

UI_DESIGN §6: one line — Piyak lies on a pink cushion
(`src/ui/assets/piyak-cushion.png`), same commit.

## Testing

Project verify skill: shop screen shows the cushion under Piyak (cat overlaps
its top edge, cushion doesn't cover the bubble), idle breathe unaffected,
≤720px still hides the whole mascot. Run-end WooDak untouched.
