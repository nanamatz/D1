import { useState } from 'react';
import { useI18n } from '../i18n';

interface Props {
  onStart: (seed?: string) => void;
  onBack: () => void;
}

/** Carousel `< value >` selector (spec §0). Single-entry stubs disable the arrows. */
function Carousel({ label, value }: { label: string; value: string }) {
  return (
    <div className="carousel">
      <span className="label">{label}</span>
      <div className="carousel-row">
        <button className="car-arrow" disabled aria-hidden>
          ‹
        </button>
        <span className="car-value">{value}</span>
        <button className="car-arrow" disabled aria-hidden>
          ›
        </button>
      </div>
    </div>
  );
}

/**
 * New Run (spec §2.2). Bag/stake carousels are single-entry placeholders — the
 * structure ships so future starting bags (GDD §12) and stakes slot in. Continue
 * is greyed (no save system); Challenges is hidden.
 */
export function NewRun({ onStart, onBack }: Props) {
  const { t } = useI18n();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');

  return (
    <div className="screen newrun">
      <div className="tabs">
        <button className="tab on">{t('newrun.tab.new')}</button>
        <button className="tab" disabled>
          {t('newrun.tab.continue')}
        </button>
        {/* Challenges tab hidden by design until challenges exist */}
      </div>

      <div className="panel newrun-body">
        <div className="select-card">
          <Carousel label={t('newrun.bag')} value={t('bag.standard.name')} />
          <div className="select-preview">
            <div className="bag-art">🎒</div>
            <p className="select-desc">{t('bag.standard.desc')}</p>
          </div>
        </div>

        <Carousel label={t('newrun.stake')} value={t('stake.white.name')} />

        <label className="seed-toggle">
          <input type="checkbox" checked={seeded} onChange={(e) => setSeeded(e.target.checked)} />
          <span>{t('newrun.seeded')}</span>
        </label>
        {seeded && (
          <input
            className="seed-input"
            type="text"
            value={seed}
            placeholder={t('newrun.seedPlaceholder')}
            onChange={(e) => setSeed(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

      <button
        className="btn exchange big play-run"
        onClick={() => onStart(seeded ? seed : undefined)}
      >
        {t('newrun.play')}
      </button>

      <button className="btn back-bar" onClick={onBack}>
        {t('common.back')}
      </button>
    </div>
  );
}
