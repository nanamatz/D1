import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { BALANCE } from '../../engine/balance';
import { useI18n } from '../i18n';
import type { ScoreTypewriterTier } from '../scoreTypewriter';
import { DESK_KINDS, DeskObjects, type DeskKind } from './DeskObjects';
import { ScoreTypewriter } from './ScoreTypewriter';

type LabTab = 'score' | 'encounters';
type PreviewTier = Exclude<ScoreTypewriterTier, 0>;
type PreviewSpeed = 1 | 2;

const PREVIEW_TIERS: readonly PreviewTier[] = [1, 2, 3, 4, 5];
const PREVIEW_SPEEDS: readonly PreviewSpeed[] = [1, 2];
const LAB_TABS: readonly LabTab[] = ['score', 'encounters'];
const TARGET_CUE_TARGET = 100;

function EncounterSample({ kind }: { kind: DeskKind }) {
  const { t } = useI18n();
  const [resetToken, setResetToken] = useState(0);

  return (
    <article className="desk-lab-card">
      <div className="desk-lab-copy">
        <strong>{t(`desk.encounter.${kind}.name`)}</strong>
        <span>{t(`desk.encounter.${kind}.desc`)}</span>
      </div>
      <div className="desk-lab-stage">
        <DeskObjects active sampleKind={kind} resetToken={resetToken} />
      </div>
      <button className="btn desk-lab-replay" onClick={() => setResetToken((value) => value + 1)}>
        {t('desk.lab.replay')}
      </button>
    </article>
  );
}

export function DeskEncounterLab({ onBack }: { onBack: () => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<LabTab>('score');
  const [selectedTier, setSelectedTier] = useState<PreviewTier>(1);
  const [activeTier, setActiveTier] = useState<ScoreTypewriterTier>(0);
  const [beatId, setBeatId] = useState(0);
  const [targetReplay, setTargetReplay] = useState(0);
  const [liveTotal, setLiveTotal] = useState(TARGET_CUE_TARGET - 1);
  const [speed, setSpeed] = useState<PreviewSpeed>(1);
  const [screenshake, setScreenshake] = useState(50);
  const [reducedMotion, setReducedMotion] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const targetFrame = useRef<number | null>(null);
  const tabRefs = useRef<Partial<Record<LabTab, HTMLButtonElement | null>>>({});

  const idle = () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    idleTimer.current = null;
    setActiveTier(0);
  };

  const replayTier = (tier: PreviewTier = selectedTier) => {
    idle();
    setSelectedTier(tier);
    setActiveTier(tier);
    setBeatId((value) => value + 1);
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null;
      setActiveTier(0);
    }, BALANCE.scoreTypewriter.beatMs / speed);
  };

  const replayTarget = () => {
    idle();
    setBeatId((value) => value + 1);
    setLiveTotal(TARGET_CUE_TARGET - 1);
    setTargetReplay((value) => value + 1);
  };

  useEffect(() => {
    if (targetReplay === 0) return;
    targetFrame.current = window.requestAnimationFrame(() => {
      targetFrame.current = null;
      setLiveTotal(TARGET_CUE_TARGET);
    });
    return () => {
      if (targetFrame.current !== null) window.cancelAnimationFrame(targetFrame.current);
      targetFrame.current = null;
    };
  }, [targetReplay]);

  useEffect(() => () => {
    if (idleTimer.current !== null) window.clearTimeout(idleTimer.current);
    if (targetFrame.current !== null) window.cancelAnimationFrame(targetFrame.current);
  }, []);

  const selectTab = (next: LabTab) => {
    if (next !== 'score') {
      idle();
      if (targetFrame.current !== null) window.cancelAnimationFrame(targetFrame.current);
      targetFrame.current = null;
    }
    setTab(next);
  };

  const onTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const index = LAB_TABS.indexOf(tab);
    const next = event.key === 'ArrowLeft'
      ? LAB_TABS[(index - 1 + LAB_TABS.length) % LAB_TABS.length]
      : event.key === 'ArrowRight'
        ? LAB_TABS[(index + 1) % LAB_TABS.length]
        : event.key === 'Home'
          ? LAB_TABS[0]
          : event.key === 'End'
            ? LAB_TABS[LAB_TABS.length - 1]
            : undefined;
    if (!next) return;
    event.preventDefault();
    selectTab(next);
    tabRefs.current[next]?.focus();
  };

  const leaveLab = () => {
    selectTab('encounters');
    onBack();
  };

  return (
    <div className="screen desk-lab">
      <header className="desk-lab-head">
        <h1>{t('desk.lab.title')}</h1>
        <p>{t('desk.lab.subtitle')}</p>
      </header>
      <div className="desk-lab-tabs" role="tablist" aria-label={t('desk.lab.title')}>
        <button
          ref={(node) => { tabRefs.current.score = node; }}
          id="desk-lab-tab-score"
          className="btn"
          role="tab"
          aria-selected={tab === 'score'}
          aria-controls="desk-lab-panel-score"
          tabIndex={tab === 'score' ? 0 : -1}
          onClick={() => selectTab('score')}
          onKeyDown={onTabKeyDown}
        >
          {t('desk.lab.tab.score')}
        </button>
        <button
          ref={(node) => { tabRefs.current.encounters = node; }}
          id="desk-lab-tab-encounters"
          className="btn"
          role="tab"
          aria-selected={tab === 'encounters'}
          aria-controls="desk-lab-panel-encounters"
          tabIndex={tab === 'encounters' ? 0 : -1}
          onClick={() => selectTab('encounters')}
          onKeyDown={onTabKeyDown}
        >
          {t('desk.lab.tab.encounters')}
        </button>
      </div>
      <section
        id="desk-lab-panel-score"
        className="desk-lab-panel score-feedback-lab"
        role="tabpanel"
        aria-labelledby="desk-lab-tab-score"
        hidden={tab !== 'score'}
        tabIndex={0}
      >
        {tab === 'score' && (
          <>
            <ScoreTypewriter
              active={activeTier > 0}
              tier={activeTier}
              beatId={`lab-beat-${beatId}`}
              primaryKeyId="Enter"
              liveTotal={liveTotal}
              target={TARGET_CUE_TARGET}
              blindKey={`lab-target-${targetReplay}`}
              gameSpeed={speed}
              screenshake={screenshake}
              reducedMotion={reducedMotion}
            />
            <p>{t('desk.lab.score.subtitle')}</p>
            <div className="score-lab-group">
              <strong>{t('desk.lab.score.tier')}</strong>
              <div className="score-lab-buttons">
                <button className="btn" onClick={idle}>
                  {t('desk.lab.score.idle')}
                </button>
                {PREVIEW_TIERS.map((tier) => (
                  <button
                    key={tier}
                    className="btn"
                    aria-pressed={selectedTier === tier}
                    onClick={() => replayTier(tier)}
                  >
                    {t('desk.lab.score.tierValue', { tier })}
                  </button>
                ))}
                <button className="btn score-lab-replay" onClick={() => replayTier()}>
                  {t('desk.lab.score.replay')}
                </button>
              </div>
            </div>
            <div className="score-lab-group">
              <strong>{t('desk.lab.score.target')}</strong>
              <button className="btn score-lab-target" onClick={replayTarget}>
                {t('desk.lab.score.targetReplay')}
              </button>
            </div>
            <div className="score-lab-group">
              <strong>{t('settings.gameSpeed')}</strong>
              <div className="score-lab-buttons">
                {PREVIEW_SPEEDS.map((value) => (
                  <button
                    key={value}
                    className="btn"
                    aria-pressed={speed === value}
                    onClick={() => setSpeed(value)}
                  >
                    {value}×
                  </button>
                ))}
              </div>
            </div>
            <label className="score-lab-slider">
              <strong>{t('settings.screenshake')}</strong>
              <input
                type="range"
                min="0"
                max="100"
                value={screenshake}
                onChange={(event) => setScreenshake(Number(event.currentTarget.value))}
              />
              <span>{screenshake}%</span>
            </label>
            <label className="score-lab-check">
              <input
                type="checkbox"
                checked={reducedMotion}
                onChange={(event) => setReducedMotion(event.currentTarget.checked)}
              />
              <strong>{t('settings.reducedMotion')}</strong>
            </label>
          </>
        )}
      </section>
      <section
        id="desk-lab-panel-encounters"
        className="desk-lab-panel"
        role="tabpanel"
        aria-labelledby="desk-lab-tab-encounters"
        hidden={tab !== 'encounters'}
        tabIndex={0}
      >
        {tab === 'encounters' && (
          <>
            <p className="desk-lab-panel-copy">{t('desk.lab.encounters.subtitle')}</p>
            <div className="desk-lab-grid">
              {DESK_KINDS.map((kind) => <EncounterSample key={kind} kind={kind} />)}
            </div>
          </>
        )}
      </section>
      <button className="btn desk-lab-back" onClick={leaveLab}>{t('common.back')}</button>
    </div>
  );
}
