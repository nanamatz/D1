import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { BALANCE } from '../../engine/balance';
import { audio } from '../audio';
import scoreTypewriterArt from '../assets/score-typewriter-chassis.png';
import { motionOff, usePrefersReducedMotion } from '../motion';
import {
  crossedScoreTarget,
  SCORE_TYPEWRITER_LED_COLORS,
  SCORE_TYPEWRITER_PANEL_LED_PHASES_MS,
  SCORE_TYPEWRITER_KEYCAPS,
  scoreTypewriterClearPeak,
  scoreTypewriterClearRepeatMs,
  scoreTypewriterKeySequence,
  scoreTypewriterKeySizeVariation,
  scoreTypewriterKeyTiming,
  scoreTypewriterLedSlot,
  scoreTypewriterPanelLedOrder,
  scoreTypewriterShake,
  scheduleScoreTypewriterClearRepeats,
  type ScoreTypewriterTier,
} from '../scoreTypewriter';

const TYPEWRITER_CHASSIS_SMOKE_POINTS = [
  [8, 34, -40], [18, 46, -180], [29, 28, -320], [40, 52, -110],
  [50, 35, -250], [61, 47, -390], [72, 29, -80], [82, 43, -220],
  [92, 35, -360], [24, 61, -60], [55, 59, -200], [85, 58, -340],
] as const;

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
  screenshake: number;
  reducedMotion: boolean;
  preview?: boolean;
}

interface PresentationLayer {
  id: string;
  tier: ScoreTypewriterTier;
  primaryKeyId: string;
  clearRepeating: boolean;
  shake: number;
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
  screenshake,
  reducedMotion,
  preview = false,
}: Props) {
  const osReduce = usePrefersReducedMotion();
  const requestedReduce = reducedMotion || osReduce || motionOff();
  const beatSnapshot = useRef({ beatId, reduce: requestedReduce });
  if (beatSnapshot.current.beatId !== beatId) {
    beatSnapshot.current = { beatId, reduce: requestedReduce };
  } else if (!beatSnapshot.current.reduce && requestedReduce) {
    // Reduced Motion ON cancels this beat immediately; OFF waits for the next id.
    beatSnapshot.current.reduce = true;
  }
  const reduce = beatSnapshot.current.reduce;
  const beatMs = BALANCE.scoreTypewriter.beatMs;
  const previousTotal = useRef(liveTotal);
  const crossed = useRef(liveTotal >= target);
  const targetStrikeActive = useRef(false);
  const [targetPunch, setTargetPunch] = useState<{ id: number; durationMs: number } | null>(null);
  const [clearPeak, setClearPeak] = useState<ScoreTypewriterTier>(0);
  const [clearCycle, setClearCycle] = useState<number | null>(null);
  const [presentationLayers, setPresentationLayers] = useState<PresentationLayer[]>([]);
  const presentationTimers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const previousResolutionActive = useRef(resolutionActive);
  const screenshakeRef = useRef(screenshake);
  screenshakeRef.current = screenshake;

  useLayoutEffect(() => {
    setPresentationLayers([]);
    return () => {
      presentationTimers.current.forEach(clearTimeout);
      presentationTimers.current.clear();
    };
  }, [blindKey, reduce]);

  useLayoutEffect(() => {
    const stopped = previousResolutionActive.current && !resolutionActive;
    previousResolutionActive.current = resolutionActive;
    if (!stopped) return;
    presentationTimers.current.forEach(clearTimeout);
    presentationTimers.current.clear();
    setPresentationLayers([]);
  }, [resolutionActive]);

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
      durationMs: BALANCE.scoreTypewriter.targetCueMs,
    }));
    audio.scoreTypewriterKey('Enter', true);
  }, [liveTotal, target, targetCueEnabled]);

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
      scoreTypewriterClearRepeatMs(heldPeak),
      setClearCycle,
    );
  }, [blindKey, heldPeak, reduce, settleId]);

  const clearRepeating = heldPeak > 0 && clearCycle !== null && !reduce;
  const presentationActive = active || clearRepeating;
  const presentationTier = active ? tier : heldPeak;
  const presentationBeatId = clearRepeating
    ? `clear:${blindKey}:${settleId}:${clearCycle}`
    : beatId;
  const presentationPrimaryKeyId = clearRepeating ? 'Enter' : primaryKeyId;

  useLayoutEffect(() => {
    if (!presentationActive || presentationTier === 0 || reduce) return;
    const layer = {
      id: presentationBeatId,
      tier: presentationTier,
      primaryKeyId: presentationPrimaryKeyId,
      clearRepeating,
      shake: scoreTypewriterShake(screenshakeRef.current, presentationTier),
    } satisfies PresentationLayer;
    setPresentationLayers((current) => current.some(({ id }) => id === layer.id)
      ? current
      : [...current, layer]);

    const schedule = (callback: () => void, delayMs: number) => {
      const timer = setTimeout(() => {
        presentationTimers.current.delete(timer);
        callback();
      }, delayMs);
      presentationTimers.current.add(timer);
    };
    schedule(() => {
      setPresentationLayers((current) => current.filter(({ id }) => id !== layer.id));
    }, beatMs);

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
    audibleSlots.forEach((pressIndex, index) => schedule(() => {
      const keyId = SCORE_TYPEWRITER_KEYCAPS[keySequence[pressIndex] ?? -1]?.id ?? 'Enter';
      if (clearRepeating && index === 0) {
        audio.scoreTypewriterKey(keyId, true);
        return;
      }
      if (pressIndex === 0 && presentationPrimaryKeyId === 'Enter' && targetStrikeActive.current) return;
      audio.scoreTypewriterKey(keyId);
    }, scoreTypewriterKeyTiming(
      presentationBeatId,
      presentationTier,
      pressIndex,
      visualCount,
    ).delayMs));
  }, [clearRepeating, presentationActive, presentationBeatId,
    presentationPrimaryKeyId, presentationTier, reduce, beatMs, blindKey]);

  // The live target watcher above still runs for every count-up frame. The much
  // larger 101-key visual tree only changes when the current presentation beat does.
  const machines = useMemo(() => {
    const layers = presentationLayers.length > 0
      ? presentationLayers.map((layer) => ({ ...layer, active: true }))
      : [{
          id: `idle-${blindKey}`,
          tier: heldPeak,
          primaryKeyId: 'Enter',
          clearRepeating: false,
          shake: scoreTypewriterShake(screenshake, active ? tier : heldPeak),
          active: false,
        } satisfies PresentationLayer & { active: boolean }];
    return layers.map((layer) => {
      const visualCount = layer.active
        ? BALANCE.scoreTypewriter.visualKeyCounts[layer.tier]
        : 0;
      const keySequence = scoreTypewriterKeySequence(
        layer.id,
        visualCount,
        layer.primaryKeyId,
      );
      const keyTiming = new Map(keySequence.map((keyIndex, pressIndex) => [
        keyIndex,
        scoreTypewriterKeyTiming(
          layer.id,
          layer.tier,
          pressIndex,
          visualCount,
        ),
      ]));
      const panelLedOrder = scoreTypewriterPanelLedOrder(layer.id);
      return (
        <div
          key={layer.id}
          className={[
            'score-typewriter',
            layer.active && 'is-active',
            layer.clearRepeating && 'is-clear-cycle',
            `typewriter-tier-${layer.tier}`,
          ].filter(Boolean).join(' ')}
          style={{ '--typewriter-shake': String(layer.shake) } as CSSProperties}
          data-presentation-beat-id={layer.active ? layer.id : undefined}
        >
          <div className="typewriter-machine">
            <img className="typewriter-art" src={scoreTypewriterArt} alt="" />
            <div className="typewriter-keys">
            {SCORE_TYPEWRITER_KEYCAPS.map((keycap, keyIndex) => {
              const timing = keyTiming.get(keyIndex);
              const ledSlot = scoreTypewriterLedSlot(keyIndex);
              const keySizeVariation = scoreTypewriterKeySizeVariation(layer.id, keyIndex);
              return (
                <button
                  key={keycap.id}
                  type="button"
                  className={`typewriter-key role-${keycap.role}${timing ? ' is-pressed' : ''}`}
                  data-key-id={keycap.id}
                  data-led-slot={ledSlot}
                  disabled
                  tabIndex={-1}
                  aria-hidden="true"
                  style={{
                    '--key-x': `${keycap.x}%`,
                    '--key-y': `${keycap.y}%`,
                    '--key-w': `${keycap.w}%`,
                    '--key-h': `${keycap.h}%`,
                    '--key-led': SCORE_TYPEWRITER_LED_COLORS[ledSlot],
                    '--key-smoke-scale': String(keySizeVariation * (layer.tier === 6 ? 1.35 : 1)),
                    '--key-flame-scale': String(keySizeVariation * (layer.tier === 6 ? 1.25 : 1)),
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
          <div className="typewriter-panel-leds" aria-hidden="true">
            {['red', 'yellow', 'green'].map((color, index) => (
              <i
                key={color}
                className={`typewriter-panel-led typewriter-panel-led-${color}`}
                style={{ animationDelay: `${SCORE_TYPEWRITER_PANEL_LED_PHASES_MS[panelLedOrder[index] ?? index]}ms` }}
              />
            ))}
          </div>
          <div className="typewriter-chassis-smoke" aria-hidden="true">
            {TYPEWRITER_CHASSIS_SMOKE_POINTS.map(([x, y, delay], index) => (
              <i
                key={index}
                style={{
                  '--chassis-smoke-x': `${x}%`,
                  '--chassis-smoke-y': `${y}%`,
                  '--chassis-smoke-delay': `${delay}ms`,
                  '--chassis-smoke-scale': String(
                    scoreTypewriterKeySizeVariation(layer.id, index),
                  ),
                } as CSSProperties}
              />
            ))}
            </div>
            <div className="typewriter-pop">POP!</div>
          </div>
        </div>
      );
    });
  }, [active, blindKey, heldPeak, presentationLayers, screenshake, tier]);

  if (typeof document === 'undefined' && !preview) return null;
  const latestLayer = presentationLayers[presentationLayers.length - 1];
  const displayTier = latestLayer?.tier ?? (active ? tier : heldPeak);
  const hasPresentation = presentationLayers.length > 0;
  const dockTier = displayTier > 0 && (heldPeak > 0 || reduce || targetPunch)
    ? `typewriter-tier-${displayTier}`
    : null;
  const style = {
    '--typewriter-beat': `${beatMs}ms`,
    '--typewriter-target-cue': `${targetPunch?.durationMs ?? BALANCE.scoreTypewriter.targetCueMs}ms`,
    '--typewriter-shake': String(scoreTypewriterShake(screenshake, displayTier)),
  } as CSSProperties;

  const dock = (
    <div
      className={[
        'score-typewriter-dock',
        preview && 'is-lab-preview',
        hasPresentation && 'is-active',
        (clearRepeating || latestLayer?.clearRepeating) && 'is-clear-cycle',
        heldPeak > 0 && 'is-clear-held',
        dockTier,
        reduce && 'is-reduced',
        targetPunch && 'target-punched',
      ].filter(Boolean).join(' ')}
      style={style}
      data-tier={displayTier}
      aria-hidden="true"
    >
      {machines}
    </div>
  );
  return preview ? dock : createPortal(dock, document.body);
}
