import { useMemo, useState, type ReactNode } from 'react';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import { RECORD_IDS, isRecordUnlocked } from '../../engine/records';
import type { BlindKind, PouchId, RecordId } from '../../engine/types';
import { useI18n } from '../i18n';
import { loadLifetime } from '../lifetime';
import { pouchUnlockWordCount } from '../profile';
import { pouchArt } from '../pouchArt';
import { recordArt } from '../recordArt';
import { richText } from '../richtext';
import { Tooltip } from './Tooltip';

/** Summary of the persisted run behind the Continue tab. */
export interface ContinueInfo {
  ante: number;
  blindKind: BlindKind;
  gold: number;
  seed: string;
}

export interface StartRunConfig {
  seed?: string;
  pouchId: PouchId;
  recordId: RecordId;
  customSeed: boolean;
}

interface Props {
  onStart: (config: StartRunConfig) => void;
  onBack: () => void;
  continueInfo?: ContinueInfo | undefined;
  onContinue?: (() => void) | undefined;
}

interface CarouselProps<T extends string> {
  label: string;
  kind: 'pouch' | 'record';
  ids: readonly T[];
  selected: T;
  onSelect: (id: T) => void;
  name: (id: T) => string;
  disabled?: boolean;
  children: ReactNode;
}

/** Wrapping selector for all pouch and cumulative difficulty entries. */
function Carousel<T extends string>({
  label,
  kind,
  ids,
  selected,
  onSelect,
  name,
  disabled = false,
  children,
}: CarouselProps<T>) {
  const index = Math.max(0, ids.indexOf(selected));
  const move = (delta: number) => {
    if (disabled) return;
    const next = ids[index + delta];
    if (next) onSelect(next);
  };
  return (
    <section
      className={[
        'run-choice',
        `run-choice-${kind}`,
        disabled && 'choice-disabled',
      ].filter(Boolean).join(' ')}
      aria-label={`${label}: ${name(selected)}, ${index + 1}/${ids.length}`}
      aria-disabled={disabled || undefined}
    >
      <button
        type="button"
        className="car-arrow"
        disabled={disabled || index === 0}
        onClick={() => move(-1)}
        aria-label={`${label}: previous`}
      >
        ‹
      </button>
      <div className="run-choice-stage">
        <span className="run-choice-label">{label}</span>
        {children}
        <div className="carousel-dots" aria-hidden="true">
          {ids.map((id, dot) => (
            <span
              key={id}
              className={[
                'carousel-dot',
                dot === index && 'current',
                dot < index && 'past',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="car-arrow"
        disabled={disabled || index === ids.length - 1}
        onClick={() => move(1)}
        aria-label={`${label}: next`}
      >
        ›
      </button>
    </section>
  );
}

/**
 * New Run. Starting Pouch and cumulative Record difficulty are profile-gated.
 * Profile reads stay in UI; engine helpers only evaluate supplied progress.
 */
export function NewRun({ onStart, onBack, continueInfo, onContinue }: Props) {
  const { t } = useI18n();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');
  const canContinue = !!continueInfo && !!onContinue;
  const [tab, setTab] = useState<'new' | 'continue'>(canContinue ? 'continue' : 'new');
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
      </div>

      {active === 'continue' && continueInfo ? (
        <>
          <div className="panel newrun-body">
            <div className="continue-card">
              <div className="continue-art">📝</div>
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
  setSeeded: (value: boolean) => void;
  seed: string;
  setSeed: (value: string) => void;
  onStart: (config: StartRunConfig) => void;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [pouchId, setPouchId] = useState<PouchId>('yellow');
  const [recordId, setRecordId] = useState<RecordId>('whiteLp');
  const progress = useMemo(() => {
    const lifetime = loadLifetime();
    return {
      discoveredWords: pouchUnlockWordCount(),
      pouchWins: new Set(lifetime.pouchWins),
      recordWins: new Set(lifetime.recordWins),
    };
  }, []);
  const pouchUnlocked = isPouchUnlocked(pouchId, progress);
  const recordUnlocked = isRecordUnlocked(recordId, progress.recordWins);
  const canStart = pouchUnlocked && recordUnlocked && (!seeded || seed.trim().length > 0);

  const choice = (
    kind: 'pouch' | 'record',
    id: PouchId | RecordId,
    unlocked: boolean,
    src: string,
  ) => {
    const name = t(`${kind}.${id}.name`);
    const body = t(`${kind}.${id}.desc`);
    const lockedPouch = kind === 'pouch' && !unlocked;
    const unlock = lockedPouch
      ? t('newrun.unlock', { requirement: t(`pouch.${id}.unlock`) })
      : '';
    const title = lockedPouch ? t('newrun.locked') : name;
    const detail = lockedPouch ? unlock : body;
    const cumulative = kind === 'record' && id !== 'whiteLp'
      ? t('newrun.cumulative')
      : '';
    return (
      <div className={['select-preview', !unlocked && 'locked'].filter(Boolean).join(' ')}>
        <Tooltip
          title={name}
          body={[body, unlock, cumulative].filter(Boolean).join('\n')}
          down
        >
          <div
            className={['run-choice-art', `run-choice-art-${kind}`].join(' ')}
            role="img"
            tabIndex={0}
            aria-label={title}
          >
            <img src={src} alt="" />
            {!unlocked && <span className="run-choice-lock" aria-hidden />}
          </div>
        </Tooltip>
        <div className="run-choice-copy">
          <h2 className="run-choice-title" aria-live="polite">{title}</h2>
          <div className="run-choice-effect">
            <p className="select-desc">{richText(detail)}</p>
            {cumulative && <p className="cumulative-note">{cumulative}</p>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="panel newrun-body">
        <Carousel
          label={t('newrun.bag')}
          kind="pouch"
          ids={POUCH_IDS}
          selected={pouchId}
          onSelect={setPouchId}
          name={(id) => t(`pouch.${id}.name`)}
        >
          {choice('pouch', pouchId, pouchUnlocked, pouchArt(pouchId))}
        </Carousel>

        <Carousel
          label={t('newrun.record')}
          kind="record"
          ids={RECORD_IDS}
          selected={recordId}
          onSelect={setRecordId}
          name={(id) => t(`record.${id}.name`)}
          disabled={!pouchUnlocked}
        >
          {choice('record', recordId, recordUnlocked, recordArt(recordId))}
        </Carousel>

      </div>

      <div className="run-start-row">
        <div className="seed-controls">
          <label className="seed-toggle">
            <input type="checkbox" checked={seeded} onChange={(event) => setSeeded(event.target.checked)} />
            <span>{t('newrun.seeded')}</span>
          </label>
          {seeded && (
            <>
              <input
                className="seed-input"
                type="text"
                value={seed}
                placeholder={t('newrun.seedPlaceholder')}
                onChange={(event) => setSeed(event.target.value)}
                spellCheck={false}
              />
              <p className="seed-unlock-note">{t('newrun.seedNoUnlocks')}</p>
            </>
          )}
        </div>

        <button
          className="btn exchange big play-run"
          disabled={!canStart}
          onClick={() => onStart({
            ...(seeded ? { seed: seed.trim() } : {}),
            pouchId,
            recordId,
            customSeed: seeded,
          })}
        >
          {t('newrun.play')}
        </button>
      </div>

      <button className="btn back-bar" onClick={onBack}>
        {t('common.back')}
      </button>
    </>
  );
}
