import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../engine/balance';
import { audio } from '../audio';
import scoreTypewriterArt from '../assets/score-typewriter-chassis.png';
import { motionOff, usePrefersReducedMotion } from '../motion';
import {
  crossedScoreTarget,
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterClearPeak,
  scoreTypewriterClearRepeatMs,
  scoreTypewriterKeySequence,
  scoreTypewriterKeyTiming,
  scoreTypewriterShake,
  scheduleScoreTypewriterClearRepeats,
  type ScoreTypewriterTier,
} from '../scoreTypewriter';

interface Props {
  active: boolean;
  tier: ScoreTypewriterTier;
  beatId: string;
  primaryKeyId: string;
  liveTotal: number;
  target: number;
  targetCueEnabled?: boolean;
  blindKey: string;
  settleId?: number;
  resolutionActive?: boolean;
  holdActive?: boolean;
  gameSpeed: number;
  screenshake: number;
  reducedMotion: boolean;
}

/** Persistent, non-interactive score feedback in the viewport's left margin. */
export function ScoreTypewriter({
  active,
  tier,
  beatId,
  primaryKeyId,
  liveTotal,
  target,
  targetCueEnabled = true,
  blindKey,
  settleId = 0,
  resolutionActive = false,
  holdActive = false,
  gameSpeed,
  screenshake,
  reducedMotion,
}: Props) {
  const osReduce = usePrefersReducedMotion();
  const requestedReduce = reducedMotion || osReduce || motionOff();
  const beatSnapshot = useRef({ beatId, speed: gameSpeed, reduce: requestedReduce });
  if (beatSnapshot.current.beatId !== beatId) {
    beatSnapshot.current = { beatId, speed: gameSpeed, reduce: requestedReduce };
  } else if (!beatSnapshot.current.reduce && requestedReduce) {
    // Reduced Motion ON cancels this beat immediately; OFF waits for the next id.
    beatSnapshot.current.reduce = true;
  }
  const beatSpeed = beatSnapshot.current.speed;
  const reduce = beatSnapshot.current.reduce;
  const beatMs = BALANCE.scoreTypewriter.beatMs / beatSpeed;
  const previousTotal = useRef(liveTotal);
  const crossed = useRef(liveTotal >= target);
  const targetStrikeActive = useRef(false);
  const [targetPunch, setTargetPunch] = useState<{ id: number; durationMs: number } | null>(null);
  const [clearPeak, setClearPeak] = useState<ScoreTypewriterTier>(0);
  const [clearCycle, setClearCycle] = useState<number | null>(null);

  useEffect(() => {
    previousTotal.current = liveTotal;
    crossed.current = target > 0 && liveTotal >= target;
    targetStrikeActive.current = false;
    setTargetPunch(null);
    setClearPeak(0);
    // A blind transition re-arms the one-shot target cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindKey]);

  useEffect(() => {
    const justCrossed = targetCueEnabled
      && !crossed.current
      && crossedScoreTarget(previousTotal.current, liveTotal, target);
    previousTotal.current = liveTotal;
    if (!justCrossed) return;
    crossed.current = true;
    targetStrikeActive.current = true;
    setTargetPunch((value) => ({
      id: (value?.id ?? 0) + 1,
      durationMs: BALANCE.scoreTypewriter.targetCueMs / beatSpeed,
    }));
    audio.scoreTypewriterKey('Enter', true);
  }, [beatSpeed, liveTotal, target, targetCueEnabled]);

  useEffect(() => {
    if (!targetPunch) return;
    const timer = setTimeout(() => {
      targetStrikeActive.current = false;
      setTargetPunch(null);
    }, targetPunch.durationMs);
    return () => clearTimeout(timer);
  }, [targetPunch]);

  useEffect(() => {
    setClearPeak((previous) => scoreTypewriterClearPeak(
      previous,
      resolutionActive,
      active,
      tier,
    ));
  }, [active, resolutionActive, tier]);

  const heldPeak = resolutionActive && holdActive && !active ? clearPeak : 0;
  useLayoutEffect(() => {
    if (heldPeak === 0 || reduce) {
      setClearCycle(null);
      return;
    }
    return scheduleScoreTypewriterClearRepeats(
      scoreTypewriterClearRepeatMs(heldPeak, beatSpeed),
      setClearCycle,
    );
  }, [beatSpeed, blindKey, heldPeak, reduce, settleId]);

  const clearRepeating = heldPeak > 0 && clearCycle !== null && !reduce;
  const presentationActive = active || clearRepeating;
  const presentationTier = active ? tier : heldPeak;
  const presentationBeatId = clearRepeating
    ? `clear:${blindKey}:${settleId}:${clearCycle}`
    : beatId;
  const presentationPrimaryKeyId = clearRepeating ? 'Enter' : primaryKeyId;

  useLayoutEffect(() => {
    if (!presentationActive || presentationTier === 0 || reduce) return;
    const visualCount = BALANCE.scoreTypewriter.visualKeyCounts[presentationTier];
    const audibleCount = BALANCE.scoreTypewriter.audibleKeyCounts[presentationTier];
    const audibleSlots = Array.from(
      { length: audibleCount },
      (_, index) => Math.floor(index * visualCount / audibleCount),
    );
    const keySequence = scoreTypewriterKeySequence(
      presentationBeatId,
      visualCount,
      presentationPrimaryKeyId,
    );
    const timers = audibleSlots.map((pressIndex, index) => setTimeout(() => {
      const keyId = SCORE_TYPEWRITER_KEYCAPS[keySequence[pressIndex] ?? -1]?.id ?? 'Enter';
      if (clearRepeating && index === 0) {
        audio.scoreTypewriterKey(keyId, true);
        return;
      }
      if (pressIndex === 0 && presentationPrimaryKeyId === 'Enter' && targetStrikeActive.current) return;
      audio.scoreTypewriterKey(keyId);
    }, scoreTypewriterKeyTiming(
      presentationBeatId,
      beatSpeed,
      presentationTier,
      pressIndex,
      visualCount,
    ).delayMs));
    return () => timers.forEach(clearTimeout);
  }, [beatSpeed, clearRepeating, presentationActive, presentationBeatId,
    presentationPrimaryKeyId, presentationTier, reduce]);

  // The live target watcher above still runs for every count-up frame. The much
  // larger 101-key visual tree only changes when the current presentation beat does.
  const machine = useMemo(() => {
    const machineKey = presentationActive ? presentationBeatId : `idle-${blindKey}`;
    const visualCount = presentationActive
      ? BALANCE.scoreTypewriter.visualKeyCounts[presentationTier]
      : 0;
    const keySequence = scoreTypewriterKeySequence(
      presentationBeatId,
      visualCount,
      presentationPrimaryKeyId,
    );
    const keyTiming = new Map(keySequence.map((keyIndex, pressIndex) => [
      keyIndex,
      scoreTypewriterKeyTiming(
        presentationBeatId,
        beatSpeed,
        presentationTier,
        pressIndex,
        visualCount,
      ),
    ]));
    return (
      <div className="score-typewriter">
        <div key={machineKey} className="typewriter-machine">
          <img className="typewriter-art" src={scoreTypewriterArt} alt="" />
          <div className="typewriter-keys">
            {SCORE_TYPEWRITER_KEYCAPS.map((keycap, keyIndex) => {
              const timing = keyTiming.get(keyIndex);
              return (
                <button
                  key={keycap.id}
                  type="button"
                  className={`typewriter-key role-${keycap.role}${timing ? ' is-pressed' : ''}`}
                  data-key-id={keycap.id}
                  disabled
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{
                    '--key-x': `${keycap.x}%`,
                    '--key-y': `${keycap.y}%`,
                    '--key-w': `${keycap.w}%`,
                    '--key-h': `${keycap.h}%`,
                    ...(timing ? {
                      '--key-delay': `${timing.delayMs}ms`,
                      '--key-duration': `${timing.durationMs}ms`,
                    } : {}),
                  } as CSSProperties}
                >
                  {keycap.label}
                </button>
              );
            })}
          </div>
          <div className="typewriter-smoke"><i /><i /><i /></div>
          <div className="typewriter-flame">
            <svg
              viewBox="0 0 16 20"
              preserveAspectRatio="xMidYMid meet"
              shapeRendering="crispEdges"
              aria-hidden="true"
              focusable="false"
            >
              <rect className="typewriter-flame-outer" x="6" y="0" width="4" height="2" />
              <rect className="typewriter-flame-outer" x="4" y="2" width="8" height="2" />
              <rect className="typewriter-flame-outer" x="2" y="4" width="12" height="4" />
              <rect className="typewriter-flame-outer" x="0" y="8" width="4" height="8" />
              <rect className="typewriter-flame-outer" x="8" y="8" width="8" height="8" />
              <rect className="typewriter-flame-outer" x="0" y="16" width="16" height="4" />
              <rect className="typewriter-flame-core" x="8" y="6" width="4" height="8" />
            </svg>
          </div>
          <div className="typewriter-pop">POP!</div>
        </div>
      </div>
    );
  }, [beatSpeed, blindKey, presentationActive, presentationBeatId,
    presentationPrimaryKeyId, presentationTier]);

  if (typeof document === 'undefined') return null;
  const displayTier = active ? tier : heldPeak;
  const style = {
    '--typewriter-beat': `${beatMs}ms`,
    '--typewriter-target-cue': `${targetPunch?.durationMs ?? BALANCE.scoreTypewriter.targetCueMs / beatSpeed}ms`,
    '--typewriter-shake': String(scoreTypewriterShake(screenshake, displayTier)),
  } as CSSProperties;

  return createPortal(
    <div
      className={[
        'score-typewriter-dock',
        presentationActive && presentationTier > 0 && 'is-active',
        clearRepeating && 'is-clear-cycle',
        heldPeak > 0 && 'is-clear-held',
        `typewriter-tier-${displayTier}`,
        reduce && 'is-reduced',
        targetPunch && 'target-punched',
      ].filter(Boolean).join(' ')}
      style={style}
      data-tier={displayTier}
      aria-hidden="true"
    >
      {machine}
    </div>,
    document.body,
  );
}
