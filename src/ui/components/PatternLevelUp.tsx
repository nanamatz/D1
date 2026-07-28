import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { patternLevelBus, type PatternLevelEvent } from '../patternLevel';
import { audio } from '../audio';
import { useI18n } from '../i18n';

/**
 * feedback #6: the constellation level-up flourish. On a Constellation card use, a
 * centred badge shows the pattern name and its level ticking from N to N+1 (the new
 * number pops in over the old). Auto-dismisses; portalled to <body> so it floats over
 * whatever screen the card was used on (board or shop). Reduced motion → static.
 */
export function PatternLevelUp() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<(PatternLevelEvent & { id: number }) | null>(null);

  useEffect(() => {
    let n = 0;
    return patternLevelBus.on((e) => {
      setEvt({ ...e, id: n++ });
      audio.play('voucherRedeem');
    });
  }, []);

  useEffect(() => {
    if (!evt) return;
    const timer = setTimeout(() => setEvt(null), 1700);
    return () => clearTimeout(timer);
  }, [evt]);

  if (!evt) return null;
  return createPortal(
    <div className="pattern-levelup" key={evt.id} aria-live="polite">
      <div className="plu-card">
        <div className="plu-badge">{t('patternLevel.up')}</div>
        <div className="plu-name">{t(`pattern.${evt.pattern}`)}</div>
        <div className="plu-levels">
          <span className="plu-from">{t('sidebar.patternLevel', { n: evt.from })}</span>
          <span className="plu-arrow">→</span>
          <span className="plu-to" key={evt.to}>{t('sidebar.patternLevel', { n: evt.to })}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
