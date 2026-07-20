import { useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { INTRO_STEPS, markIntroSeen } from '../tutorial';
import { SpotlightBubble } from './SpotlightBubble';

/**
 * Guided first-run walkthrough (work order A-1). Passive coach-marks over the
 * shared SpotlightBubble: dims the board, spotlights the current step's target,
 * and narrates it with a WooDak bubble. Advance is always via Next — never gated
 * on performing the action, so it can't soft-lock.
 */
export function GuidedIntro({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const cur = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;

  const finish = () => { markIntroSeen(); onClose(); };
  const next = () => { if (last) finish(); else setStep((s) => s + 1); };

  return (
    <SpotlightBubble target={cur.selector} mascot="woodak">
      <div className="intro-title">{t(`intro.step.${cur.key}.title`)}</div>
      <p className="intro-body">{richText(t(`intro.step.${cur.key}.body`))}</p>
      <div className="intro-actions">
        <button className="btn sm intro-skip" onClick={finish}>{t('intro.skip')}</button>
        <span className="intro-dots">{step + 1} / {INTRO_STEPS.length}</span>
        <button className="btn blue sm intro-next" onClick={next}>
          {last ? t('intro.done') : t('intro.next')}
        </button>
      </div>
    </SpotlightBubble>
  );
}
