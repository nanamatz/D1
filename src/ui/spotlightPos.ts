/**
 * Pure placement math for the coach-mark bubble (SpotlightBubble). Kept out of the
 * component so it can be unit-tested without a DOM/layout engine.
 *
 * The bubble is placed just below its target when there is room for its full height,
 * else just above; but EITHER way the result is clamped to the viewport so the whole
 * bubble — crucially its advance button — is always visible. Anchoring near the edge
 * of a *tall* target (e.g. the whole shop sale region) used to push a tall bubble off
 * the top of the screen, stranding the button (shop-tutorial "stuck" bug).
 */

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}
export interface Viewport {
  w: number;
  h: number;
}
export interface BubblePos {
  left: number;
  top: number;
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(v, Math.max(lo, hi)));

/**
 * Where to put the bubble's top-left, in viewport coords.
 * @param rect   the spotlighted target's rect, or null for a centered bubble
 * @param wrapW  the bubble's width (px)
 * @param wrapH  the bubble's measured height (px); 0 before first measure
 * @param vp     the viewport size (px)
 * @param gap    space between target and bubble (px)
 * @param margin min distance kept from every viewport edge (px)
 */
export function placeSpotlightBubble(
  rect: Rect | null,
  wrapW: number,
  wrapH: number,
  vp: Viewport,
  gap = 20,
  margin = 12,
): BubblePos {
  if (!rect) {
    return { left: (vp.w - wrapW) / 2, top: (vp.h - wrapH) / 2 };
  }
  const left = clamp(rect.left, margin, vp.w - wrapW - margin);
  const below = rect.top + rect.height + gap;
  const above = rect.top - wrapH - gap;
  // Use "below" only when the bubble's full height fits under the target.
  const fitsBelow = below + wrapH + margin <= vp.h;
  const top = clamp(fitsBelow ? below : above, margin, vp.h - wrapH - margin);
  return { left, top };
}
