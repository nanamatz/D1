import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { audio } from '../audio';
import type { SfxName } from '../audio';
import { motionOff } from '../motion';
import coffeeCup from '../assets/desk-coffee-cup.png';
import callBell from '../assets/desk-call-bell.png';
import blankCheck from '../assets/desk-blank-check.png';
import { clamp } from '../math';
import { useI18n } from '../i18n';

/**
 * D-3 ambient side interactions (UI_DESIGN §4.8). One-shot cup, bell, and cheque
 * encounters live in the viewport margins, portaled to <body>, so they never
 * affect the headless engine or block the game board.
 */
type DeskKind = 'cup' | 'bell' | 'check';

interface DeskObj {
  kind: DeskKind;
  sfx: SfxName;
  side: 'left' | 'right';
  spawn: number;
}

const BASE_KINDS: Pick<DeskObj, 'kind' | 'sfx'>[] = [
  { kind: 'cup', sfx: 'deskCup' },
  { kind: 'bell', sfx: 'deskBell' },
  { kind: 'check', sfx: 'deskCheck' },
];
const ENCOUNTER_GAP_MIN_MS = 70_000;
const ENCOUNTER_GAP_SPREAD_MS = 70_000;
const SIGNATURE_VIEWBOX_WIDTH = 100;
const SIGNATURE_VIEWBOX_HEIGHT = 40;
const SIGNATURE_MIN_DISTANCE = 48;
const SIGNATURE_MIN_POINTS = 6;

interface SignaturePoint {
  x: number;
  y: number;
}

const reduced = motionOff;

export function DeskObjects({ active }: { active: boolean }) {
  const { t } = useI18n();
  const [cup, setCup] = useState<DeskObj | null>(null);
  const [bell, setBell] = useState<DeskObj | null>(null);
  const [encounter, setEncounter] = useState<DeskObj | null>(null);
  const [cupDrinking, setCupDrinking] = useState(false);
  const [cupLeaving, setCupLeaving] = useState(false);
  const [bellRinging, setBellRinging] = useState(false);
  const [bellLeaving, setBellLeaving] = useState(false);
  const [encounterLeaving, setEncounterLeaving] = useState(false);
  const [encounterInteracting, setEncounterInteracting] = useState(false);
  const [encounterCycle, setEncounterCycle] = useState(0);
  const [signaturePoints, setSignaturePoints] = useState<SignaturePoint[]>([]);
  const [signatureDrawing, setSignatureDrawing] = useState(false);
  const seq = useRef(0);
  const signaturePointer = useRef<number | null>(null);
  const signaturePointsRef = useRef<SignaturePoint[]>([]);
  const interactionTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, delay: number) => {
    interactionTimers.current.push(setTimeout(fn, delay));
  };

  useEffect(() => {
    if (active) return;
    interactionTimers.current.forEach(clearTimeout);
    interactionTimers.current = [];
    setCup(null);
    setBell(null);
    setEncounter(null);
    setCupDrinking(false);
    setCupLeaving(false);
    setBellRinging(false);
    setBellLeaving(false);
    setEncounterLeaving(false);
    setEncounterInteracting(false);
    signaturePointer.current = null;
    signaturePointsRef.current = [];
    setSignaturePoints([]);
    setSignatureDrawing(false);
  }, [active]);

  useEffect(
    () => () => {
      interactionTimers.current.forEach(clearTimeout);
    },
    [],
  );

  useEffect(() => {
    if (!active || encounter) return;
    let live = true;
    const gap = ENCOUNTER_GAP_MIN_MS + Math.random() * ENCOUNTER_GAP_SPREAD_MS;
    const timer = setTimeout(() => {
      if (!live) return;

      const candidates = BASE_KINDS.filter(
        ({ kind }) => (kind !== 'cup' || !cup) && (kind !== 'bell' || !bell),
      );
      const base = candidates[Math.floor(Math.random() * candidates.length)]!;
      const next: DeskObj = {
        ...base,
        side: Math.random() < 0.5 ? 'left' : 'right',
        spawn: seq.current++,
      };

      if (next.kind === 'cup') {
        setCup(next);
        setEncounterCycle((n) => n + 1);
      } else if (next.kind === 'bell') {
        setBell(next);
        setEncounterCycle((n) => n + 1);
      } else {
        setEncounterLeaving(false);
        setEncounterInteracting(false);
        signaturePointsRef.current = [];
        setSignaturePoints([]);
        setSignatureDrawing(false);
        setEncounter(next);
      }
    }, gap);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [active, encounter, encounterCycle, cup, bell]);

  const finishEncounter = () => {
    setEncounter(null);
    setEncounterLeaving(false);
    setEncounterInteracting(false);
    signaturePointer.current = null;
    signaturePointsRef.current = [];
    setSignaturePoints([]);
    setSignatureDrawing(false);
    setEncounterCycle((n) => n + 1);
  };

  const drinkCoffee = () => {
    if (!cup || cupDrinking || cupLeaving) return;
    audio.play('deskCup');
    setCupDrinking(true);
    later(() => {
      setCupDrinking(false);
      setCupLeaving(true);
    }, 820);
    later(() => {
      setCup(null);
      setCupLeaving(false);
      setEncounterCycle((n) => n + 1);
    }, 1280);
  };

  const ringBell = () => {
    if (!bell || bellRinging || bellLeaving) return;
    audio.play('deskBell');
    setBellRinging(true);
    later(() => {
      setBellRinging(false);
      setBellLeaving(true);
    }, 760);
    later(() => {
      setBell(null);
      setBellLeaving(false);
      setEncounterCycle((n) => n + 1);
    }, 1180);
  };

  const signaturePoint = (
    event: ReactPointerEvent<HTMLSpanElement>,
  ): SignaturePoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * SIGNATURE_VIEWBOX_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * SIGNATURE_VIEWBOX_HEIGHT;
    return {
      // Two-unit quantisation keeps the hand-drawn stroke consistent with the
      // surrounding pixel art instead of producing a perfectly smooth vector.
      x: Math.round(clamp(x, 0, SIGNATURE_VIEWBOX_WIDTH) / 2) * 2,
      y: Math.round(clamp(y, 0, SIGNATURE_VIEWBOX_HEIGHT) / 2) * 2,
    };
  };

  const beginSignature = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (
      encounter?.kind !== 'check' ||
      encounterLeaving ||
      encounterInteracting ||
      signaturePointer.current !== null ||
      (event.pointerType === 'mouse' && event.button !== 0)
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = signaturePoint(event);
    signaturePointer.current = event.pointerId;
    signaturePointsRef.current = [point];
    setSignaturePoints([point]);
    setSignatureDrawing(true);
    audio.play('deskCheck');
  };

  const drawSignature = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (signaturePointer.current !== event.pointerId) return;
    event.preventDefault();
    const point = signaturePoint(event);
    const previous = signaturePointsRef.current.at(-1);
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return;
    const next = [...signaturePointsRef.current, point];
    signaturePointsRef.current = next;
    setSignaturePoints(next);
  };

  const endSignature = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (signaturePointer.current !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    signaturePointer.current = null;
    setSignatureDrawing(false);

    const points = signaturePointsRef.current;
    const distance = points.slice(1).reduce((total, point, index) => {
      const previous = points[index]!;
      return total + Math.hypot(point.x - previous.x, point.y - previous.y);
    }, 0);

    // A click or tiny accidental nudge is not a signature. Keep the cheque in
    // place and clear the mark so the player can make a deliberate new stroke.
    if (points.length < SIGNATURE_MIN_POINTS || distance < SIGNATURE_MIN_DISTANCE) {
      signaturePointsRef.current = [];
      setSignaturePoints([]);
      return;
    }

    setEncounterInteracting(true);
    later(() => setEncounterLeaving(true), 320);
    later(finishEncounter, 900);
  };

  const cancelSignature = (event: ReactPointerEvent<HTMLSpanElement>) => {
    if (signaturePointer.current !== event.pointerId) return;
    signaturePointer.current = null;
    signaturePointsRef.current = [];
    setSignaturePoints([]);
    setSignatureDrawing(false);
  };

  const still = reduced() ? 'desk-still' : '';
  // Three independent height zones PER SIDE (six total), oldest at the bottom.
  // Removing an object compacts only the stack on that same side.
  const liveObjects = [cup, bell, encounter].filter(
    (obj): obj is DeskObj => obj !== null,
  );
  const sideStack = (side: DeskObj['side']): DeskObj[] =>
    liveObjects.filter((obj) => obj.side === side).sort((a, b) => a.spawn - b.spawn);
  const slotClass = (obj: DeskObj): string =>
    `desk-slot-${sideStack(obj.side).indexOf(obj)}`;
  const cupClass = cup
    ? [
        'desk-object',
        'desk-cup',
        `desk-${cup.side}`,
        slotClass(cup),
        cupDrinking && 'desk-drinking',
        cupLeaving ? 'desk-leaving' : 'desk-entering',
        still,
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const bellClass = bell
    ? [
        'desk-object',
        'desk-bell',
        `desk-${bell.side}`,
        slotClass(bell),
        bellRinging && 'desk-ringing',
        bellLeaving ? 'desk-leaving' : 'desk-entering',
        still,
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const encounterClass = encounter
    ? [
        'desk-object',
        `desk-${encounter.kind}`,
        `desk-${encounter.side}`,
        slotClass(encounter),
        encounterInteracting && encounter.kind === 'check' && 'desk-signing',
        signatureDrawing && encounter.kind === 'check' && 'desk-drawing',
        encounterLeaving ? 'desk-leaving' : 'desk-entering',
        still,
      ]
        .filter(Boolean)
        .join(' ')
    : '';

  if (!cup && !bell && !encounter) return null;

  return createPortal(
    <>
      {cup && (
        <button
          key={cup.spawn}
          className={cupClass}
          onClick={drinkCoffee}
          aria-hidden
          tabIndex={-1}
        >
          <span className="desk-glyph desk-cup-sprite">
            <span className="desk-coffee-steam" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="desk-coffee-liquid" aria-hidden />
            <img className="desk-cup-art" src={coffeeCup} alt="" draggable={false} />
          </span>
        </button>
      )}

      {bell && (
        <button
          key={bell.spawn}
          className={bellClass}
          onClick={ringBell}
          aria-hidden
          tabIndex={-1}
        >
          <span className="desk-glyph desk-bell-sprite">
            <span className="desk-bell-rings" aria-hidden>
              <i />
              <i />
            </span>
            <img
              className="desk-bell-art desk-bell-body"
              src={callBell}
              alt=""
              draggable={false}
            />
            <img
              className="desk-bell-art desk-bell-switch"
              src={callBell}
              alt=""
              draggable={false}
            />
          </span>
        </button>
      )}

      {encounter?.kind === 'check' && (
        <div key={encounter.spawn} className={encounterClass} aria-hidden>
          <span className="desk-glyph desk-check-sprite">
            <img className="desk-check-art" src={blankCheck} alt="" draggable={false} />
            <span
              className="desk-check-sign-zone"
              onPointerDown={beginSignature}
              onPointerMove={drawSignature}
              onPointerUp={endSignature}
              onPointerCancel={cancelSignature}
            >
              <span className="desk-check-guide">{t('desk.check.sign')}</span>
              <svg
                className="desk-check-signature"
                viewBox="0 0 100 40"
                preserveAspectRatio="none"
                aria-hidden
              >
                <polyline
                  points={signaturePoints.map(({ x, y }) => `${x},${y}`).join(' ')}
                />
              </svg>
              <span
                className="desk-check-pen"
                style={
                  signaturePoints.length
                    ? ({
                        left: `${signaturePoints.at(-1)!.x}%`,
                        top: `${
                          (signaturePoints.at(-1)!.y / SIGNATURE_VIEWBOX_HEIGHT) * 100
                        }%`,
                      } satisfies CSSProperties)
                    : undefined
                }
                aria-hidden
              />
            </span>
          </span>
        </div>
      )}
    </>,
    document.body,
  );
}
