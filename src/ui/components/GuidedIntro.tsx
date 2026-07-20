import { type CSSProperties, useCallback, useLayoutEffect, useState } from 'react';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { INTRO_STEPS, markIntroSeen } from '../tutorial';
import woodakUrl from '../assets/woodak.png';

interface Rect { top: number; left: number; width: number; height: number }

/**
 * Guided first-run walkthrough (work order A-1). Passive coach-marks: dims the
 * board, spotlights the current step's target (measured live), and narrates it
 * with a WooDak bubble. Advance is always via Next — never gated on the player
 * performing the action, so it can't soft-lock. A missing target falls back to a
 * centered bubble. Mounted inside the play board so the target selectors resolve.
 */
export function GuidedIntro({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cur = INTRO_STEPS[step]!;
  const last = step === INTRO_STEPS.length - 1;

  const measure = useCallback(() => {
    const el = document.querySelector(INTRO_STEPS[step]!.selector);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

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

  const finish = () => { markIntroSeen(); onClose(); };
  const next = () => { if (last) finish(); else setStep((s) => s + 1); };

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
      <div
        className={['intro-wrap', rect ? '' : 'center'].filter(Boolean).join(' ')}
        style={wrapStyle}
      >
        <div className="mascot intro-mascot">
          <div className="mascot-bubble intro-bubble">
            <div className="intro-title">{t(`intro.step.${cur.key}.title`)}</div>
            <p className="intro-body">{richText(t(`intro.step.${cur.key}.body`))}</p>
            <div className="intro-actions">
              <button className="btn sm intro-skip" onClick={finish}>{t('intro.skip')}</button>
              <span className="intro-dots">{step + 1} / {INTRO_STEPS.length}</span>
              <button className="btn blue sm intro-next" onClick={next}>
                {last ? t('intro.done') : t('intro.next')}
              </button>
            </div>
          </div>
          <div className="mascot-sway">
            <img className="mascot-cat woodak-img" src={woodakUrl} alt="" />
          </div>
        </div>
      </div>
    </div>
  );
}
