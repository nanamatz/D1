/**
 * Shared screen transition (playtest-05 B; replaces the vague E-1 wipe).
 *
 * Overlay wipe, Animal-Crossing feel: the outgoing screen stays fixed while the
 * incoming screen slides in from the RIGHT moving LEFT (one unified direction,
 * strict X axis) over it — hard pixel-crisp edge, a narrow leading-edge shadow for
 * the Z-depth step, and an Ease-Out Back curve that overshoots then settles.
 *
 * The outgoing tree is kept MOUNTED under its original key for the duration, so it
 * never remounts or re-runs effects; it renders frozen at the props it last had
 * (that frozen-ness is the "outgoing panel stays fixed" the spec asks for).
 *
 * Motion is pure CSS transform on a composited layer — never per-frame React
 * re-renders. Reduced motion → a plain crossfade (see screens.css).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Entry {
  key: string;
  node: ReactNode;
}

interface Props {
  /** Identity of the current screen — a change plays the transition. */
  screenKey: string;
  children: ReactNode;
}

/**
 * Safety net: drop the outgoing screen even if `animationend` never arrives —
 * the force-reduced-motion setting kills animations outright (`animation: none`),
 * so the event would never fire and the outgoing tree would leak.
 *
 * MUST stay above the slide duration in screens.css (currently 0.75s), or this
 * fires mid-slide and the outgoing screen vanishes out from under it.
 */
const MAX_TRANSITION_MS = 1100;

export function ScreenTransition({ screenKey, children }: Props) {
  const live = useRef<Entry>({ key: screenKey, node: children });
  const [outgoing, setOutgoing] = useState<Entry | null>(null);
  const [shownKey, setShownKey] = useState(screenKey);

  // Adjust state during render (React's documented derived-state-from-props
  // pattern) so the outgoing screen lands in the SAME committed render as the
  // incoming one. That keeps its key continuously present in the children array,
  // which is what preserves its mounted tree instead of remounting it.
  if (shownKey !== screenKey) {
    setOutgoing(live.current);
    setShownKey(screenKey);
  }

  // `live` trails one render behind: during the render where screenKey changes it
  // still holds the screen we are leaving, which is exactly what we freeze above.
  useEffect(() => {
    live.current = { key: screenKey, node: children };
  });

  useEffect(() => {
    if (!outgoing) return;
    const id = setTimeout(() => setOutgoing(null), MAX_TRANSITION_MS);
    return () => clearTimeout(id);
  }, [outgoing]);

  const transitioning = outgoing !== null;

  return (
    <div className={['screen-stack', transitioning && 'transitioning'].filter(Boolean).join(' ')}>
      {outgoing && (
        <div key={outgoing.key} className="screen-pane screen-out" aria-hidden="true">
          {outgoing.node}
        </div>
      )}
      <div
        key={screenKey}
        className={['screen-pane', 'screen-in', transitioning && 'screen-anim']
          .filter(Boolean)
          .join(' ')}
        // Descendant animations (tiles, jokers) bubble their animationend too —
        // only the panel's own slide ends the transition.
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget) setOutgoing(null);
        }}
      >
        {children}
      </div>
    </div>
  );
}
