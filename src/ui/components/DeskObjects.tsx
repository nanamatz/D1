import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import coffeeCup from '../assets/desk-coffee-cup.png';

/**
 * D-3 · ambient side interactions (UI_DESIGN §4.8). Occasional desk objects drift
 * into the MARGINS of the play screen on a random timer; clicking one plays a small
 * animation + SFX. **Purely cosmetic — grants nothing**, one at a time, and they
 * live in the viewport margins (portaled to <body>, pinned to the screen edges) so
 * a mis-click can never hit the board. Reduced motion drops the drift (they fade in
 * place) and never auto-hops.
 *
 * Art is an emoji/CSS placeholder pending the pixel-art pass (UI_DESIGN §4 D-7 note).
 */
interface DeskObj {
  kind: 'cup' | 'pencil' | 'plane';
  glyph: string;
  sfx: SfxName;
  side: 'left' | 'right';
  top: number; // vh
  spawn: number; // key to remount the drift
}

const KINDS: Omit<DeskObj, 'side' | 'top' | 'spawn'>[] = [
  { kind: 'cup', glyph: '☕', sfx: 'deskCup' },
  { kind: 'pencil', glyph: '✏️', sfx: 'deskPencil' },
  { kind: 'plane', glyph: '🛩️', sfx: 'deskPlane' },
];

const reduced = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('force-reduced-motion'));

export function DeskObjects({ active }: { active: boolean }) {
  const [obj, setObj] = useState<DeskObj | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [drinking, setDrinking] = useState(false);
  const seq = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoLeave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRemove = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) {
      setObj(null);
      return;
    }
    let live = true;
    const clearTimers = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (autoLeave.current) clearTimeout(autoLeave.current);
      if (autoRemove.current) clearTimeout(autoRemove.current);
      autoLeave.current = null;
      autoRemove.current = null;
    };
    const scheduleNext = () => {
      // Random gap between appearances — a few times per blind, never rhythmic.
      const gap = 16000 + Math.random() * 26000;
      timers.current.push(
        setTimeout(() => {
          if (!live) return;
          const base = KINDS[Math.floor(Math.random() * KINDS.length)]!;
          setLeaving(false);
          setDrinking(false);
          setObj({
            ...base,
            side: Math.random() < 0.5 ? 'left' : 'right',
            top: 30 + Math.random() * 40, // 30–70vh, clear of the top rail
            spawn: seq.current++,
          });
          // Auto-drift back out if the player ignores it.
          autoLeave.current = setTimeout(() => {
            if (!live) return;
            setLeaving(true);
            autoRemove.current = setTimeout(() => live && setObj(null), 700);
          }, 7000);
          scheduleNext();
        }, gap),
      );
    };
    scheduleNext();
    return () => {
      live = false;
      clearTimers();
    };
  }, [active]);

  if (!obj) return null;

  const onClick = () => {
    if (leaving || drinking) return;
    if (autoLeave.current) clearTimeout(autoLeave.current);
    if (autoRemove.current) clearTimeout(autoRemove.current);
    autoLeave.current = null;
    autoRemove.current = null;
    audio.play(obj.sfx);
    if (obj.kind === 'cup') {
      setDrinking(true);
      autoLeave.current = setTimeout(() => setLeaving(true), 900);
      autoRemove.current = setTimeout(() => setObj(null), 1480);
      return;
    }
    setLeaving(true);
    autoRemove.current = setTimeout(() => setObj(null), 520);
  };

  const cls = [
    'desk-object',
    `desk-${obj.kind}`,
    `desk-${obj.side}`,
    drinking ? 'desk-drinking' : '',
    leaving ? 'desk-leaving' : 'desk-entering',
    reduced() ? 'desk-still' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return createPortal(
    <button
      key={obj.spawn}
      className={cls}
      style={{ top: `${obj.top}vh` }}
      onClick={onClick}
      aria-hidden
      tabIndex={-1}
    >
      {obj.kind === 'cup' ? (
        <span className="desk-glyph desk-cup-sprite">
          <span className="desk-coffee-liquid" aria-hidden />
          <img className="desk-cup-art" src={coffeeCup} alt="" draggable={false} />
        </span>
      ) : (
        <span className="desk-glyph">{obj.glyph}</span>
      )}
    </button>,
    document.body,
  );
}
