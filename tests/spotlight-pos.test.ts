import { describe, it, expect } from 'vitest';
import { placeSpotlightBubble, type Rect, type Viewport } from '../src/ui/spotlightPos';

const VP: Viewport = { w: 1280, h: 720 };
const WRAP_W = 360;
const WRAP_H = 280; // a tall bubble: Piyak portrait + text + button
const MARGIN = 12;

// The bubble must ALWAYS sit fully inside the viewport so its advance button is reachable.
const assertOnScreen = (pos: { left: number; top: number }, wrapH = WRAP_H) => {
  expect(pos.top).toBeGreaterThanOrEqual(MARGIN);
  expect(pos.top + wrapH).toBeLessThanOrEqual(VP.h - MARGIN);
  expect(pos.left).toBeGreaterThanOrEqual(MARGIN);
  expect(pos.left + WRAP_W).toBeLessThanOrEqual(VP.w - MARGIN);
};

describe('placeSpotlightBubble — always keeps the bubble on-screen', () => {
  it('a tall, high target (the shop sale region) does NOT push the bubble off the top', () => {
    // The regression: a ~480px region starting near the top → old code anchored the
    // bubble above its top and it overflowed the viewport, hiding the button.
    const region: Rect = { top: 150, left: 700, width: 520, height: 480 };
    const pos = placeSpotlightBubble(region, WRAP_W, WRAP_H, VP);
    assertOnScreen(pos);
  });

  it('places the bubble below a small target when there is room', () => {
    const tray: Rect = { top: 120, left: 400, width: 200, height: 60 };
    const pos = placeSpotlightBubble(tray, WRAP_W, WRAP_H, VP);
    expect(pos.top).toBe(120 + 60 + 20); // below + gap
    assertOnScreen(pos);
  });

  it('places the bubble above a low target that has no room below', () => {
    const dock: Rect = { top: 650, left: 40, width: 120, height: 50 };
    const pos = placeSpotlightBubble(dock, WRAP_W, WRAP_H, VP);
    expect(pos.top).toBeLessThan(650); // above the target
    assertOnScreen(pos);
  });

  it('clamps a target near the right edge so the bubble stays in view', () => {
    const rightish: Rect = { top: 100, left: 1250, width: 20, height: 40 };
    const pos = placeSpotlightBubble(rightish, WRAP_W, WRAP_H, VP);
    assertOnScreen(pos);
  });

  it('centers when there is no target', () => {
    const pos = placeSpotlightBubble(null, WRAP_W, WRAP_H, VP);
    expect(pos.left).toBe((VP.w - WRAP_W) / 2);
    expect(pos.top).toBe((VP.h - WRAP_H) / 2);
  });

  it('a bubble taller than the viewport still pins to the top margin (never negative)', () => {
    const region: Rect = { top: 100, left: 500, width: 300, height: 300 };
    const pos = placeSpotlightBubble(region, WRAP_W, 800, VP);
    expect(pos.top).toBe(MARGIN);
  });
});
