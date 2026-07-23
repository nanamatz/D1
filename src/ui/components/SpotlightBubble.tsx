import { type CSSProperties, type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { mascotSrc } from '../mascots';
import { placeSpotlightBubble, type Rect } from '../spotlightPos';

/**
 * Dim overlay + box-shadow spotlight on a target element + a mascot speech bubble,
 * positioned below/above the target (centered when there's no target). The shared
 * coach-mark presentation used by the guided intro (A-1) and the spotlight-style
 * encounter popups. `children` fill the bubble body; the caller supplies the
 * dismiss/advance buttons. No backdrop-click dismiss (dismiss via the buttons only).
 *
 * Two subtleties this handles:
 * 1. **Containing block.** The overlay is `position: fixed`, but during the monochrome
 *    start the board's `.frame` carries `filter: grayscale(1)` (the world-mono guard) and
 *    the `#root` carries `zoom` — EITHER makes an ancestor a containing block / rescales a
 *    fixed descendant, so an overlay rendered inside the board is positioned relative to
 *    `.frame` (offset by its viewport position) instead of the viewport, and the spotlight
 *    lands ~80px off the target (playtest bug). We `createPortal` the overlay to
 *    `document.body`, escaping both, so `getBoundingClientRect()` (viewport coords) maps
 *    1:1 to the fixed overlay — no offset, no zoom compensation needed.
 * 2. **Entry slide.** The intro opens as the board slides in, moving the target for ~1s.
 *    We track the target every animation frame while the coach-mark is open (re-rendering
 *    only when the rect actually changes) so the spotlight follows it smoothly and always
 *    ends on the settled position — instead of a fixed-timeout guess that could freeze on
 *    a mid-slide frame.
 */
export function SpotlightBubble({
  target,
  mascot,
  passthrough = false,
  children,
}: {
  target: string | null;
  mascot?: 'piyak' | 'woodak';
  /** Let clicks pass THROUGH the dimmed backdrop to the board (the bubble stays clickable).
   *  Used by the lesson's interactive steps, where the player must click the spotlighted
   *  board element — the board is hard-locked, so pass-through can't derail the flow. */
  passthrough?: boolean;
  children: ReactNode;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  // The bubble's own measured height — needed to keep it (and its button) fully on
  // screen when anchored above/beside a target. Tracked every frame like the rect.
  const [wrapH, setWrapH] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!target) { setRect(null); return; }
    let raf = 0;
    const same = (a: Rect | null, b: Rect | null) =>
      a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height);
    const tick = () => {
      const el = document.querySelector(target);
      let next: Rect | null = null;
      if (el) {
        const r = el.getBoundingClientRect();
        next = { top: r.top, left: r.left, width: r.width, height: r.height };
      }
      setRect((cur) => (same(cur, next) ? cur : next)); // same ref → no re-render on idle frames
      const h = wrapRef.current?.offsetHeight ?? 0;
      setWrapH((cur) => (cur === h ? cur : h));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  const pad = 8;
  const box = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  // Place the bubble adjacent to the target but ALWAYS clamped inside the viewport, so
  // a tall/high target can't push it (and its advance button) off-screen. Centered w/o
  // a rect (handled by the `.center` class). See spotlightPos.ts.
  const WRAP_W = 360;
  const wrapStyle: CSSProperties | undefined = rect
    ? placeSpotlightBubble(rect, WRAP_W, wrapH, { w: window.innerWidth, h: window.innerHeight })
    : undefined;

  // Portal to body so the fixed overlay is viewport-relative — see (1) above.
  return createPortal(
    <div
      className={['intro-overlay', passthrough ? 'passthrough' : ''].filter(Boolean).join(' ')}
      role="dialog"
      aria-modal={passthrough ? undefined : true}
    >
      {box && (
        <div
          className="intro-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div
        ref={wrapRef}
        className={['intro-wrap', rect ? '' : 'center'].filter(Boolean).join(' ')}
        style={wrapStyle}
      >
        <div className="mascot intro-mascot">
          <div className="mascot-bubble intro-bubble">{children}</div>
          {mascot && (
            <div className="mascot-sway">
              <img
                className={['mascot-cat', mascot === 'woodak' ? 'woodak-img' : ''].filter(Boolean).join(' ')}
                src={mascotSrc(mascot)}
                alt=""
              />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
