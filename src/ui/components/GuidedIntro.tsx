import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { tilesByIds } from '../game';
import { INTRO_STEPS, TUTORIAL_WORD, markIntroSeen } from '../tutorial';
import { SpotlightBubble } from './SpotlightBubble';
import type { UseGame } from '../useGame';

/**
 * Guided first-run lesson (rebuilt 2026-07-21). A scripted, learn-by-doing walkthrough:
 * frame the grey world → build YELLOW → submit it. The board is hard-locked to spelling
 * YELLOW (StagePanel `lockWord`, wired in RunView), and the build/submit steps auto-advance
 * when the player actually performs them — so the flow can't run ahead of the player and the
 * player can't run ahead of the flow. Submitting washes the yellow palette in (ChromaticReveal)
 * and clears the target-10 blind. Skip finishes early and releases the lock (accessibility).
 */
export function GuidedIntro({ g, onClose }: { g: UseGame; onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const cur = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;

  const finish = () => { markIntroSeen(); onClose(); };
  const advance = () => { if (last) finish(); else setStep((s) => s + 1); };

  // 'staged' step: advance once the staged tiles spell the lesson word.
  const stagedWord = tilesByIds(g.state.blind.hand, g.state.selected)
    .map((tl) => tl.letter ?? '')
    .join('')
    .toUpperCase();
  useEffect(() => {
    if (cur.advance === 'staged' && stagedWord === TUTORIAL_WORD) advance();
    // advance is stable enough for this one-shot; deps track the trigger inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.advance, stagedWord]);

  // 'played' step: settleId bumps on every submitted word — advance (== finish) on the play.
  // Capture the baseline ONLY when the step changes (not when settleId changes), or the
  // comparison would re-baseline to the new value and never fire.
  const settleId = g.state.settleId;
  const baseSettle = useRef(settleId);
  useEffect(() => { baseSettle.current = g.state.settleId; }, [step]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (cur.advance === 'played' && settleId !== baseSettle.current) advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur.advance, settleId]);

  const gated = cur.advance && cur.advance !== 'next';

  return (
    <SpotlightBubble target={cur.selector} mascot="woodak" passthrough={!!gated}>
      <div className="intro-title">{t(`intro.step.${cur.key}.title`)}</div>
      <p className="intro-body">{richText(t(`intro.step.${cur.key}.body`))}</p>
      <div className="intro-actions">
        <button className="btn sm intro-skip" onClick={finish}>{t('intro.skip')}</button>
        <span className="intro-dots">{step + 1} / {INTRO_STEPS.length}</span>
        {gated ? (
          <span className="intro-hint">{t(`intro.hint.${cur.key}`)}</span>
        ) : (
          <button className="btn blue sm intro-next" onClick={advance}>
            {last ? t('intro.done') : t('intro.next')}
          </button>
        )}
      </div>
    </SpotlightBubble>
  );
}
