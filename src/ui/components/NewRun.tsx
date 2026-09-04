import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import { RECORD_IDS, isRecordUnlocked } from '../../engine/records';
import type { BlindKind, ChallengeId, PouchId, RecordId } from '../../engine/types';
import { useI18n } from '../i18n';
import { loadLifetime, recordWinsForPouch } from '../lifetime';
import { pouchUnlockWordCount } from '../profile';
import { richText } from '../richtext';
import { Tooltip } from './Tooltip';
import { formatScore } from '../formatScore';
import { PouchCard, RecordCard } from './ObjectCards';

const NewRunChallenges = import.meta.env.DEV
  ? lazy(() => import('./NewRunChallenges')
      .then(({ NewRunChallenges: component }) => ({ default: component })))
  : null;

/** Summary of the persisted run behind the Continue tab. */
export interface ContinueInfo {
  ante: number;
  blindKind: BlindKind;
  gold: number;
  seed: string;
  pouchId: PouchId;
  recordId: RecordId;
  committedScore: number;
  target: number;
  bestWord: { text: string; score: number } | null;
  challengeId?: ChallengeId | null;
}

export interface StartRunConfig {
  seed?: string;
  pouchId: PouchId;
  recordId: RecordId;
  customSeed: boolean;
  challengeId?: ChallengeId | null;
}

interface Props {
  initialPouchId?: PouchId;
  initialRecordId?: RecordId;
  onStart: (config: StartRunConfig) => void;
  onBack: () => void;
  continueInfo?: ContinueInfo | undefined;
  onContinue?: (() => void) | undefined;
  showChallenges: boolean;
}

type NewRunTab = 'new' | 'continue' | 'challenges';

export function availableNewRunTabs(showChallenges: boolean, canContinue: boolean) {
  return [
    { id: 'new' as const, disabled: false },
    { id: 'continue' as const, disabled: !canContinue },
    ...(showChallenges ? [{ id: 'challenges' as const, disabled: false }] : []),
  ];
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
    onSelect(ids[(index + delta + ids.length) % ids.length]!);
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
        disabled={disabled}
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
        disabled={disabled}
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
export function NewRun({
  initialPouchId = 'yellow',
  initialRecordId = 'whiteLp',
  onStart,
  onBack,
  continueInfo,
  onContinue,
  showChallenges,
}: Props) {
  const { t } = useI18n();
  const [seeded, setSeeded] = useState(false);
  const [seed, setSeed] = useState('');
  const canContinue = !!continueInfo && !!onContinue;
  const [tab, setTab] = useState<NewRunTab>(
    canContinue ? 'continue' : 'new',
  );
  const challengesAvailable = showChallenges && NewRunChallenges !== null;
  const active = tab === 'continue' && !canContinue
    ? 'new'
    : tab === 'challenges' && !challengesAvailable
      ? 'new'
      : tab;
  const tabs = availableNewRunTabs(challengesAvailable, canContinue);

  return (
    <div className="screen newrun">
      <div className="panel newrun-modal">
        <div className="tabs" role="tablist" aria-label={t('newrun.tabs')}>
          {tabs.map(({ id, disabled }) => (
            <button
              key={id}
              id={`newrun-tab-${id}`}
              role="tab"
              aria-selected={active === id}
              aria-controls={`newrun-panel-${id}`}
              className={['tab', active === id ? 'on' : ''].filter(Boolean).join(' ')}
              disabled={disabled}
              onClick={() => setTab(id)}
            >
              {t(`newrun.tab.${id}`)}
            </button>
          ))}
        </div>

        <div
          id={`newrun-panel-${active}`}
          className="newrun-panel"
          role="tabpanel"
          aria-labelledby={`newrun-tab-${active}`}
        >
          {active === 'continue' && continueInfo ? (
            <ContinueBody info={continueInfo} onContinue={onContinue!} />
          ) : active === 'challenges' && NewRunChallenges ? (
            <Suspense fallback={(
              <>
                <div className="newrun-content" />
                <div className="newrun-action-row" />
                <div className="newrun-note-row" />
              </>
            )}>
              <NewRunChallenges onStart={onStart} />
            </Suspense>
          ) : (
            <NewRunBody
              initialPouchId={initialPouchId}
              initialRecordId={initialRecordId}
              seeded={seeded}
              setSeeded={setSeeded}
              seed={seed}
              setSeed={setSeed}
              onStart={onStart}
            />
          )}
        </div>

        <button className="btn back-bar" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    </div>
  );
}

function ContinueBody({ info, onContinue }: { info: ContinueInfo; onContinue: () => void }) {
  const { t } = useI18n();
  const object = (kind: 'pouch' | 'record', id: PouchId | RecordId) => {
    const name = t(`${kind}.${id}.name`);
    const cumulative = kind === 'record' && id !== 'whiteLp' ? t('newrun.cumulative') : '';
    const props = {
      className: `run-choice-art run-choice-art-${kind} continue-object-art continue-object-art-${kind}`,
      role: 'img',
      tabIndex: 0,
      'aria-label': name,
    } as const;
    return (
      <Tooltip title={name} body={[t(`${kind}.${id}.desc`), cumulative].filter(Boolean).join('\n')} down>
        {kind === 'pouch'
          ? <PouchCard id={id as PouchId} {...props} />
          : <RecordCard id={id as RecordId} {...props} />}
      </Tooltip>
    );
  };
  const bestWord = info.bestWord
    ? `${info.bestWord.text.toUpperCase()} · ${formatScore(info.bestWord.score)}`
    : '—';

  return (
    <>
      <div className="newrun-content continue-content">
        <section className="continue-object-row continue-pouch-row">
          {object('pouch', info.pouchId)}
          <div className="continue-object-copy">
            <h2>{t(`pouch.${info.pouchId}.name`)}</h2>
            <p>{richText(t(`pouch.${info.pouchId}.desc`))}</p>
          </div>
          <dl className="continue-summary">
            <div><dt>{t('newrun.summaryChapter')}</dt><dd>{t('newrun.continueChapter', {
              n: info.ante,
              blind: t(`blind.${info.blindKind}`),
            })}</dd></div>
            <div><dt>{t('newrun.summaryScore')}</dt><dd>{t('newrun.continueScore', {
              score: formatScore(info.committedScore),
              target: formatScore(info.target),
            })}</dd></div>
            <div><dt>{t('newrun.summaryMoney')}</dt><dd>{t('newrun.continueMoneyValue', {
              n: formatScore(info.gold),
            })}</dd></div>
            <div><dt>{t('newrun.summaryBest')}</dt><dd>{bestWord}</dd></div>
            <div><dt>{t('gameover.seed')}</dt><dd className="cs-seed" title={info.seed}>{info.seed}</dd></div>
          </dl>
        </section>
        <section className="continue-object-row continue-record-row">
          {object('record', info.recordId)}
          <div className="continue-object-copy">
            <h2>{t(`record.${info.recordId}.name`)}</h2>
            <div className="continue-record-effect">
              <p>{richText(t(`record.${info.recordId}.desc`))}</p>
              {info.recordId !== 'whiteLp' && <p className="cumulative-note">{t('newrun.cumulative')}</p>}
            </div>
          </div>
        </section>
      </div>
      <div className="newrun-action-row">
        <button className="btn exchange big play-run" onClick={onContinue}>
          {t('newrun.continueBtn')}
        </button>
      </div>
      <div className="newrun-note-row" aria-live="polite">
        {info.challengeId && t('challenge.current', {
          name: t(`challenge.${info.challengeId}.name`),
        })}
      </div>
    </>
  );
}

function NewRunBody({
  initialPouchId,
  initialRecordId,
  seeded,
  setSeeded,
  seed,
  setSeed,
  onStart,
}: {
  initialPouchId: PouchId;
  initialRecordId: RecordId;
  seeded: boolean;
  setSeeded: (value: boolean) => void;
  seed: string;
  setSeed: (value: string) => void;
  onStart: (config: StartRunConfig) => void;
}) {
  const { t } = useI18n();
  const [pouchId, setPouchId] = useState<PouchId>(initialPouchId);
  const [recordId, setRecordId] = useState<RecordId>(initialRecordId);
  const progress = useMemo(() => {
    const lifetime = loadLifetime();
    return {
      discoveredWords: pouchUnlockWordCount(),
      pouchWins: new Set(lifetime.pouchWins),
      recordWins: new Set(lifetime.recordWins),
      recordWinsByPouch: lifetime.recordWinsByPouch,
    };
  }, []);
  const pouchUnlocked = isPouchUnlocked(pouchId, progress);
  const recordUnlocked = isRecordUnlocked(recordId, recordWinsForPouch(progress, pouchId));
  const canStart = pouchUnlocked && recordUnlocked && (!seeded || seed.trim().length > 0);

  const choice = (
    kind: 'pouch' | 'record',
    id: PouchId | RecordId,
    unlocked: boolean,
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
          {kind === 'pouch' ? (
            <PouchCard
              id={id as PouchId}
              className="run-choice-art run-choice-art-pouch"
              role="img"
              tabIndex={0}
              aria-label={title}
            >
              {!unlocked && <span className="run-choice-lock" aria-hidden />}
            </PouchCard>
          ) : (
            <RecordCard
              id={id as RecordId}
              className="run-choice-art run-choice-art-record"
              role="img"
              tabIndex={0}
              aria-label={title}
            >
              {!unlocked && <span className="run-choice-lock" aria-hidden />}
            </RecordCard>
          )}
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
      <div className="newrun-content newrun-body">
        <Carousel
          label={t('newrun.bag')}
          kind="pouch"
          ids={POUCH_IDS}
          selected={pouchId}
          onSelect={setPouchId}
          name={(id) => t(`pouch.${id}.name`)}
        >
          {choice('pouch', pouchId, pouchUnlocked)}
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
          {choice('record', recordId, recordUnlocked)}
        </Carousel>

        <div className="seed-controls">
          <label className="seed-toggle">
            <input type="checkbox" checked={seeded} onChange={(event) => setSeeded(event.target.checked)} />
            <span>{t('newrun.seeded')}</span>
          </label>
          {seeded && (
            <input
              className="seed-input"
              type="text"
              value={seed}
              placeholder={t('newrun.seedPlaceholder')}
              onChange={(event) => setSeed(event.target.value)}
              spellCheck={false}
            />
          )}
        </div>
      </div>

      <div className="newrun-action-row">
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
      <div className="newrun-note-row" aria-live="polite">
        {seeded && t('newrun.seedNoUnlocks')}
      </div>
    </>
  );
}
