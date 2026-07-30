import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { patternChipsMult } from '../../engine/patterns';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import { patternLevelBus, type PatternLevelEvent } from '../patternLevel';
import { CardArt } from './CardArt';
import { patternSymbol } from '../patternSymbols';

const PATTERN_LEVEL_DURATION_MS = 3500;

/**
 * Full Constellation use sequence: the source card shakes while the old pattern
 * Mult/Chips appear, green deltas land in order, the level flips, then the card
 * dissolves. It stays transient presentation state, outside RunState.
 */
export function PatternLevelUp() {
  const { t } = useI18n();
  const [evt, setEvt] = useState<(PatternLevelEvent & { id: number }) | null>(null);

  useEffect(() => {
    let n = 0;
    return patternLevelBus.on((event) => {
      setEvt({ ...event, id: n++ });
      audio.play('voucherRedeem');
    });
  }, []);

  useEffect(() => {
    if (!evt) return;
    const multSound = window.setTimeout(() => audio.play('countTick', { step: 0 }), 1300);
    const chipSound = window.setTimeout(() => audio.play('countTick', { step: 1 }), 1880);
    const levelSound = window.setTimeout(() => audio.play('countTick', { step: 2 }), 2060);
    const timer = setTimeout(() => setEvt(null), PATTERN_LEVEL_DURATION_MS);
    return () => {
      window.clearTimeout(multSound);
      window.clearTimeout(chipSound);
      window.clearTimeout(levelSound);
      clearTimeout(timer);
    };
  }, [evt]);

  if (!evt) return null;
  const before = patternChipsMult(evt.pattern, evt.from);
  const after = patternChipsMult(evt.pattern, evt.to);
  const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1);

  return createPortal(
    <div className="pattern-levelup" key={evt.id} aria-live="polite">
      <div className="plu-stage">
        <div className="plu-source">
          <CardArt family="constellation" id={evt.cardId} className="plu-source-art" />
          <span className="plu-dissolve" aria-hidden />
        </div>
        <div className="plu-score">
          <div className="plu-name">
            <span className="pattern-symbol" aria-hidden>{patternSymbol(evt.pattern)}</span>
            {t(`pattern.${evt.pattern}`)}
          </div>
          <div className="plu-levels">
            <span className="plu-from">{t('sidebar.patternLevel', { n: evt.from })}</span>
            <span className="plu-arrow">→</span>
            <span className="plu-to">{t('sidebar.patternLevel', { n: evt.to })}</span>
          </div>
          <div className="plu-values">
            <div className="plu-value chips">
              <span className="plu-value-label">{t('patternLevel.chips')}</span>
              <span className="plu-old">{fmt(before.chips)}</span>
              <span className="plu-delta">+{fmt(after.chips - before.chips)}</span>
              <span className="plu-new">{fmt(after.chips)}</span>
            </div>
            <span className="plu-times">×</span>
            <div className="plu-value mult">
              <span className="plu-value-label">{t('patternLevel.mult')}</span>
              <span className="plu-old">{fmt(before.mult)}</span>
              <span className="plu-delta">+{fmt(after.mult - before.mult)}</span>
              <span className="plu-new">{fmt(after.mult)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
