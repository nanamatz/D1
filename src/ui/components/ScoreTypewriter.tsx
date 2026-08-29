import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../engine/balance';
import { audio } from '../audio';
import scoreTypewriterArt from '../assets/score-typewriter-chassis.png';
import { motionOff } from '../motion';
import {
  crossedScoreTarget,
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterBeatHash,
  scoreTypewriterKeySequence,
  scoreTypewriterKeyTiming,
  scoreTypewriterShake,
  type ScoreTypewriterTier,
} from '../scoreTypewriter';

interface Props {
  active: boolean;
  tier: ScoreTypewriterTier;
  beatId: string;
  liveTotal: number;
  target: number;
  blindKey: string;
  gameSpeed: number;
  screenshake: number;
  reducedMotion: boolean;
}

/** Persistent, non-interactive score feedback in the viewport's left margin. */
export function ScoreTypewriter({
  active,
  tier,
  beatId,
  liveTotal,
  target,
  blindKey,
  gameSpeed,
  screenshake,
  reducedMotion,
}: Props) {
  const requestedReduce = reducedMotion || motionOff();
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
  const [targetPunch, setTargetPunch] = useState<{ id: number; durationMs: number } | null>(null);

  useEffect(() => {
    previousTotal.current = liveTotal;
    crossed.current = target > 0 && liveTotal >= target;
    setTargetPunch(null);
    // A blind transition re-arms the one-shot target cue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blindKey]);

  useEffect(() => {
    const justCrossed = !crossed.current && crossedScoreTarget(previousTotal.current, liveTotal, target);
    previousTotal.current = liveTotal;
    if (!justCrossed) return;
    crossed.current = true;
    setTargetPunch((value) => ({
      id: (value?.id ?? 0) + 1,
      durationMs: BALANCE.scoreTypewriter.targetCueMs / beatSpeed,
    }));
    audio.play('deskBell');
  }, [beatSpeed, liveTotal, target]);

  useEffect(() => {
    if (!targetPunch) return;
    const timer = setTimeout(() => setTargetPunch(null), targetPunch.durationMs);
    return () => clearTimeout(timer);
  }, [targetPunch]);

  useEffect(() => {
    if (!active || tier === 0 || reduce) return;
    const visualCount = BALANCE.scoreTypewriter.visualKeyCounts[tier];
    const audibleCount = BALANCE.scoreTypewriter.audibleKeyCounts[tier];
    const audibleSlots = Array.from(
      { length: audibleCount },
      (_, index) => Math.floor((index + 1) * visualCount / (audibleCount + 1)),
    );
    const timers = audibleSlots.map((pressIndex, index) => setTimeout(() => {
      audio.play('deskKeycap', { step: (scoreTypewriterBeatHash(beatId) + index) % 5 });
    }, scoreTypewriterKeyTiming(beatId, beatSpeed, tier, pressIndex, visualCount).delayMs));
    return () => timers.forEach(clearTimeout);
  }, [active, beatId, beatSpeed, reduce, tier]);

  if (typeof document === 'undefined') return null;
  const style = {
    '--typewriter-beat': `${beatMs}ms`,
    '--typewriter-target-cue': `${targetPunch?.durationMs ?? BALANCE.scoreTypewriter.targetCueMs / beatSpeed}ms`,
    '--typewriter-shake': String(scoreTypewriterShake(screenshake, tier)),
  } as CSSProperties;
  const machineKey = active ? beatId : `idle-${blindKey}`;
  const visualCount = active ? BALANCE.scoreTypewriter.visualKeyCounts[tier] : 0;
  const keySequence = scoreTypewriterKeySequence(beatId, visualCount);
  const keyTiming = new Map(keySequence.map((keyIndex, pressIndex) => [
    keyIndex,
    scoreTypewriterKeyTiming(beatId, beatSpeed, tier, pressIndex, visualCount),
  ]));

  return createPortal(
    <div
      className={[
        'score-typewriter-dock',
        active && tier > 0 && 'is-active',
        `typewriter-tier-${tier}`,
        reduce && 'is-reduced',
        targetPunch && 'target-punched',
      ].filter(Boolean).join(' ')}
      style={style}
      data-tier={tier}
      aria-hidden="true"
    >
      <div key={machineKey} className="score-typewriter">
        <img className="typewriter-art" src={scoreTypewriterArt} alt="" />
        <div className="typewriter-carriage"><span /></div>
        <div className="typewriter-keys">
          {SCORE_TYPEWRITER_KEYCAPS.map((keycap, keyIndex) => {
            const timing = keyTiming.get(keyIndex);
            return (
              <button
                key={keycap.id}
                type="button"
                className={`typewriter-key${timing ? ' is-pressed' : ''}`}
                disabled
                tabIndex={-1}
                aria-hidden="true"
                style={{
                  '--key-x': `${keycap.x}%`,
                  '--key-y': `${keycap.y}%`,
                  '--key-scale': keycap.scale,
                  '--key-tilt': `${keycap.tilt}deg`,
                  ...(timing ? {
                    '--key-delay': `${timing.delayMs}ms`,
                    '--key-duration': `${timing.durationMs}ms`,
                  } : {}),
                } as CSSProperties}
              />
            );
          })}
        </div>
        <div className="typewriter-smoke"><i /><i /><i /></div>
        <div className="typewriter-flame"><i /><i /></div>
        <div className="typewriter-pop">POP!</div>
      </div>
      {targetPunch && <div key={targetPunch.id} className="typewriter-ding">DING!</div>}
    </div>,
    document.body,
  );
}
