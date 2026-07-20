import { type CSSProperties, type ReactNode, useCallback, useLayoutEffect, useState } from 'react';
import piyakUrl from '../assets/piyak.png';
import woodakUrl from '../assets/woodak.png';

const MASCOT_SRC: Record<'piyak' | 'woodak', string> = { piyak: piyakUrl, woodak: woodakUrl };

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Dim overlay + box-shadow spotlight on a target element + a mascot speech bubble,
 * positioned below/above the target (centered when there's no target). The shared
 * coach-mark presentation used by the guided intro (A-1) and the spotlight-style
 * encounter popups. `children` fill the bubble body; the caller supplies the
 * dismiss/advance buttons. No backdrop-click dismiss (dismiss via the buttons only).
 *
 * Re-measures over the screen-transition slide (rAF + timed re-measures) so the
 * spotlight settles onto the real position instead of catching the target mid-slide.
 */
export function SpotlightBubble({
  target,
  mascot,
  children,
}: {
  target: string | null;
  mascot?: 'piyak' | 'woodak';
  children: ReactNode;
}) {
  const [rect, setRect] = useState<Rect | null>(null);

  const measure = useCallback(() => {
    if (!target) { setRect(null); return; }
    const el = document.querySelector(target);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [target]);

  useLayoutEffect(() => {
    measure();
    // The intro opens the instant the play board mounts, while the screen-transition
    // slide-in is still animating — a one-shot measure catches the target mid-slide
    // (off-screen). Re-measure a few times over the transition's lifetime so the
    // spotlight settles onto the real position (the .intro-spot CSS transition glides
    // it into place). rAF handles the immediate post-paint frame; the timeouts cover
    // the ~600ms slide.
    const raf = requestAnimationFrame(measure);
    const timers = [120, 360, 650].map((ms) => setTimeout(measure, ms));
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      for (const t of timers) clearTimeout(t);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const pad = 8;
  const box = rect && {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  };
  // Place the bubble below the target when there's room, else above; centered w/o a rect.
  const belowRoom = rect ? rect.top + rect.height + 200 < window.innerHeight : true;
  const wrapStyle: CSSProperties | undefined = rect
    ? {
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)),
        ...(belowRoom
          ? { top: rect.top + rect.height + pad + 12 }
          : { bottom: window.innerHeight - rect.top + pad + 12 }),
      }
    : undefined;

  return (
    <div className="intro-overlay" role="dialog" aria-modal="true">
      {box && (
        <div
          className="intro-spot"
          style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
        />
      )}
      <div className={['intro-wrap', rect ? '' : 'center'].filter(Boolean).join(' ')} style={wrapStyle}>
        <div className="mascot intro-mascot">
          <div className="mascot-bubble intro-bubble">{children}</div>
          {mascot && (
            <div className="mascot-sway">
              <img
                className={['mascot-cat', mascot === 'woodak' ? 'woodak-img' : ''].filter(Boolean).join(' ')}
                src={MASCOT_SRC[mascot]}
                alt=""
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
