# Piyak Cushion Depth + Sunken Overlap — Design

Date: 2026-07-19
Status: approved (design), pending implementation

## Goal

The pink cushion reads flat and sits fully behind the cat. Give it 3D depth
and make it overlap the cat's lower body ("sunken into the cushion").

## Changes

1. **Asset v2 (regenerated, same paths):** the generator gains
   - an inner, lighter **top-face ellipse** (top face vs. side wall split);
   - a 4-band shade ramp: top highlight → top face → side base → deep bottom
     shade (extra dark row inside the bottom rim);
   - a **baked ground shadow**: 1–2 bottom rows of semi-transparent black
     ellipse for grounding.
   Output overwrites `src/ui/assets/piyak-cushion.png` + `docs/PiyakCushion.png`.
2. **Z-order + position (the key fix):** the cat currently renders ON TOP of
   the cushion, so raising the cushion just hides it. Swap the DOM order in
   `ShopMascot.tsx` (cat first, cushion second) so the cushion renders in
   front, and raise it (`bottom` offset up, tuned by screenshot) so its upper
   rim covers ~15px of the cat's lower body — the lying-in-the-cushion look.
   Exact offsets are tuned during verification.
3. **Docs:** UI_DESIGN §6 cushion phrase notes the sunken-in overlap. Same
   commit.

Files: generator (scratchpad, not committed), `src/ui/assets/piyak-cushion.png`,
`docs/PiyakCushion.png`, `src/ui/components/ShopMascot.tsx`,
`src/ui/styles/screens.css`, `docs/UI_DESIGN.md`.

## Testing

Project verify skill: shop screenshot — cushion rim visibly in front of the
cat's lower body, top-face/side shading and ground shadow read as volume,
bubble unobstructed, breathe (cat only) unaffected, ≤720px hides all.
