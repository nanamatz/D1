import { useState } from 'react';
import type { BlindKind } from '../../engine/types';
import { useI18n } from '../i18n';
import pouchUrl from '../assets/pouch.png';

/** Summary of the in-memory run behind the Continue tab. */
export interface ContinueInfo {
  ante: number;
  blindKind: BlindKind;
  gold: number;
  seed: string;
}

interface Props {
  onStart: (seed?: string) => void;
  onBack: () => void;
  /** The run left in memory (Options → Main Menu), or undefined if none. */
  continueInfo?: ContinueInfo | undefined;
  onContinue?: (() => void) | undefined;
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
 * structure ships so future starting bags (GDD §12) and stakes slot in.
 * Challenges is hidden.
 *
 * Continue resumes the run left in memory when you exit via Options → Main Menu.
 * It is session-scoped: there is still no save system, so a reload clears it and
 * the tab greys out again. It defaults to selected when a run exists, so hitting
 * Play after stepping away doesn't wipe the run by accident.
 */
export function NewRun({ onStart, onBack, continueInfo, onContinue }: Props) {
  const { t } = useI18n();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');
  const canContinue = !!continueInfo && !!onContinue;
  const [tab, setTab] = useState<'new' | 'continue'>(canContinue ? 'continue' : 'new');
  // The run can end (game over) while this screen is mounted; never strand the
  // user on a Continue tab that no longer has a run behind it.
  const active = tab === 'continue' && canContinue ? 'continue' : 'new';

  return (
    <div className="screen newrun">
      <div className="tabs">
        <button
          className={['tab', active === 'new' ? 'on' : ''].filter(Boolean).join(' ')}
          onClick={() => setTab('new')}
        >
          {t('newrun.tab.new')}
        </button>
        <button
          className={['tab', active === 'continue' ? 'on' : ''].filter(Boolean).join(' ')}
          disabled={!canContinue}
          onClick={() => setTab('continue')}
        >
          {t('newrun.tab.continue')}
        </button>
        {/* Challenges tab hidden by design until challenges exist */}
      </div>

      {active === 'continue' && continueInfo ? (
        <>
          <div className="panel newrun-body">
            <div className="continue-card">
              <div className="continue-art">📖</div>
              <h3 className="continue-title">{t('newrun.continueTitle')}</h3>
              <p className="select-desc">{t('newrun.continueHint')}</p>
              <div className="continue-stats">
                <span className="cs-chapter">
                  {t('newrun.continueChapter', {
                    n: continueInfo.ante,
                    blind: t(`blind.${continueInfo.blindKind}`),
                  })}
                </span>
                <span className="cs-gold">{t('newrun.continueGold', { n: continueInfo.gold })}</span>
                <span className="cs-seed">
                  {t('gameover.seed')}: {continueInfo.seed}
                </span>
              </div>
            </div>
          </div>
          <button className="btn exchange big play-run" onClick={onContinue}>
            {t('newrun.continueBtn')}
          </button>
          <button className="btn back-bar" onClick={onBack}>
            {t('common.back')}
          </button>
        </>
      ) : (
        <NewRunBody
          seeded={seeded}
          setSeeded={setSeeded}
          seed={seed}
          setSeed={setSeed}
          onStart={onStart}
          onBack={onBack}
        />
      )}
    </div>
  );
}

function NewRunBody({
  seeded,
  setSeeded,
  seed,
  setSeed,
  onStart,
  onBack,
}: {
  seeded: boolean;
  setSeeded: (v: boolean) => void;
  seed: string;
  setSeed: (v: string) => void;
  onStart: (seed?: string) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="panel newrun-body">
        <div className="select-card">
          <Carousel label={t('newrun.bag')} value={t('bag.standard.name')} />
          <div className="select-preview">
            <img className="bag-art" src={pouchUrl} alt="" />
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
    </>
  );
}
