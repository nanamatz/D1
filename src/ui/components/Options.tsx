import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Lexicon } from '../../engine/lexicon';
import { collectionStatsPage, loadCollection, sortedCollectionStats, type Collection as WordCollection } from '../collection';
import { ALL_JOKERS } from '../../engine/jokers';
import { POUCH_IDS } from '../../engine/pouches';
import { RECORD_IDS } from '../../engine/records';
import { CHALLENGE_DEFS } from '../../engine/challenges';
import {
  JOKER_RECORD_STICKER_TOTAL,
  jokerRecordStickerCount,
  loadLifetime,
  mostPlayedPattern,
  recordWinCount,
} from '../lifetime';
import { useSettings } from '../settings';
import { audio } from '../audio';
import { isEmojiUnlocked, loadEmojiUnlockProgress } from '../emojiUnlocks';
import { useI18n } from '../i18n';
import { formatScore } from '../formatScore';
import { THIRD_PARTY_NOTICES } from '../legalNotices';
import { voicedKeys } from '../mascots';
import { Collection } from './Collection';
import { Tooltip } from './Tooltip';
import { UiIcon } from './UiIcon';

type View = 'root' | 'settings' | 'stats' | 'credits' | 'collection';
type Tab = 'game' | 'video' | 'graphics' | 'audio';
type StatsTab = 'overview' | 'words' | 'jokers';
type CreditsTab = 'team' | 'visuals' | 'audio' | 'fonts';

const CREDIT_TABS: readonly CreditsTab[] = ['team', 'visuals', 'audio', 'fonts'];

export function collectionProgressPercent(
  collection: WordCollection,
  lexicon: Pick<Lexicon, 'size' | 'isWord'>,
  unlockAllApplied: boolean,
): number {
  if (unlockAllApplied) return 100;
  if (lexicon.size <= 0) return 0;
  let discovered = 0;
  for (const word of Object.keys(collection)) {
    if (lexicon.isWord(word)) discovered += 1;
  }
  return Math.min(100, Math.round((discovered / lexicon.size) * 1000) / 10);
}

interface Props {
  lexicon: Lexicon;
  onBack: () => void;
  /** In-run only (pause menu): abandon this run and go to New Run. */
  onNewRun?: () => void;
  /** In-run only (pause menu): leave to the main menu, run kept in memory. */
  onMainMenu?: () => void;
}

/**
 * Options root → Settings / New Run / Main Menu / Statistics / Collection /
 * Credits (spec §2.10–2.12; order per playtest-06 #4). New Run and Main Menu are
 * pause-menu only — they render just when their handler is supplied, so opening
 * Options from the main menu still shows the plain Settings/Stats/Collection set.
 */
export function Options({ lexicon, onBack, onNewRun, onMainMenu }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('root');
  const previousView = useRef<View>(view);

  useEffect(() => {
    if (previousView.current !== view) audio.play('transitionWhoosh');
    previousView.current = view;
  }, [view]);

  if (view === 'root') {
    return (
      <div className="screen options">
        <h2 className="scr-title">{t('options.title')}</h2>
        <div className="menu-buttons">
          <button className="btn exchange" onClick={() => setView('settings')}>
            {t('options.settings')}
          </button>
          {onNewRun && (
            <button className="btn exchange" onClick={onNewRun}>
              {t('options.newRun')}
            </button>
          )}
          {onMainMenu && (
            <button className="btn exchange" onClick={onMainMenu}>
              {t('options.mainMenu')}
            </button>
          )}
          <button className="btn exchange" onClick={() => setView('stats')}>
            {t('options.statistics')}
          </button>
          <button className="btn exchange" onClick={() => setView('collection')}>
            {t('options.collection')}
          </button>
          <button className="btn exchange" onClick={() => setView('credits')}>
            {t('options.credits')}
          </button>
        </div>
        <button className="btn back-bar" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  const back = () => setView('root');
  // During a run the Collection escapes the pause card completely. Its full-screen
  // layout otherwise inherits the card's max-height/overflow and gets clipped at
  // both edges with a second scrollbar.
  if (view === 'collection') {
    const collection = <Collection lexicon={lexicon} onBack={back} />;
    return onNewRun || onMainMenu
      ? createPortal(<div className="overlay collection-overlay">{collection}</div>, document.body)
      : collection;
  }
  return (
    <div className="screen options">
      {view === 'settings' && <SettingsView />}
      {view === 'stats' && <StatsView lexicon={lexicon} />}
      {view === 'credits' && <CreditsView />}
      <button className="btn back-bar" onClick={back}>
        {t('common.back')}
      </button>
    </div>
  );
}

// ---------- reusable controls ----------
export function Slider({
  label,
  value,
  min,
  max,
  onChange,
  tooltip,
  tooltipDisabled,
  mute,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  tooltip: string;
  tooltipDisabled: boolean;
  mute?: {
    label: string;
    ariaLabel: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
  };
}) {
  return (
    <Tooltip title={label} body={tooltip} touchPin disabled={tooltipDisabled}>
      <div className={['set-row', mute && 'audio-set-row'].filter(Boolean).join(' ')}>
        <span className="set-label">{label}</span>
        <div className="set-control">
          <input
            aria-label={label}
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <span className="set-badge">{value}</span>
          {mute && (
            <label className="audio-mute">
              <input
                aria-label={mute.ariaLabel}
                type="checkbox"
                checked={mute.checked}
                onChange={(event) => mute.onChange(event.currentTarget.checked)}
              />
              <span aria-hidden="true">{mute.label}</span>
            </label>
          )}
        </div>
      </div>
    </Tooltip>
  );
}

export function Toggle({
  label,
  on,
  onChange,
  tooltip,
  tooltipDisabled,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
  tooltip: string;
  tooltipDisabled: boolean;
}) {
  return (
    <Tooltip title={label} body={tooltip} touchPin disabled={tooltipDisabled}>
      <div className="set-row">
        <span className="set-label">{label}</span>
        <button
          aria-label={label}
          className={['toggle', on ? 'on' : ''].filter(Boolean).join(' ')}
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
        >
          <span className="knob" />
        </button>
      </div>
    </Tooltip>
  );
}

// ---------- Settings ----------
function SettingsView() {
  const { t, lang, setLang } = useI18n();
  const { settings, set } = useSettings();
  const [tab, setTab] = useState<Tab>('game');

  return (
    <>
      <h2 className="scr-title">{t('options.settings')}</h2>
      <div className="tabs" role="tablist" aria-label={t('options.settings')}>
        {(['game', 'video', 'graphics', 'audio'] as Tab[]).map((x) => (
          <button key={x} role="tab" aria-selected={x === tab} aria-controls={`settings-${x}`} className={['tab', x === tab ? 'on' : ''].filter(Boolean).join(' ')} onClick={() => setTab(x)}>
            {t(`settings.tab.${x}`)}
          </button>
        ))}
      </div>

      {/* All three panels are always rendered and stacked in one grid cell, so the
          panel's height is the tallest tab's and never jumps between tabs. The
          inactive ones are `visibility: hidden`, which also drops them from the
          tab order and the accessibility tree. */}
      <div className="panel set-panel">
        <div id="settings-game" role="tabpanel" aria-hidden={tab !== 'game'} className={['set-tabpanel', tab === 'game' ? 'on' : ''].filter(Boolean).join(' ')}>
          <Tooltip title={t('settings.gameSpeed')} body={t('settings.tooltip.gameSpeed')} touchPin disabled={tab !== 'game'}>
            <div className="set-row">
              <span className="set-label">{t('settings.gameSpeed')}</span>
              <div className="segmented">
                {([1, 2] as const).map((s) => (
                  <button
                    key={s}
                    className={['seg', s === settings.gameSpeed ? 'on' : ''].filter(Boolean).join(' ')}
                    onClick={() => set('gameSpeed', s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
          </Tooltip>
            <Slider
              label={t('settings.screenshake')}
              tooltip={t('settings.tooltip.screenshake')}
              tooltipDisabled={tab !== 'game'}
              value={settings.screenshake}
              min={0}
              max={100}
              onChange={(v) => set('screenshake', v)}
            />
            <Toggle
              label={t('settings.reducedMotion')}
              tooltip={t('settings.tooltip.reducedMotion')}
              tooltipDisabled={tab !== 'game'}
              on={settings.reducedMotion}
              onChange={(v) => set('reducedMotion', v)}
            />
            <Toggle
              label={t('settings.colorBlind')}
              tooltip={t('settings.tooltip.colorBlind')}
              tooltipDisabled={tab !== 'game'}
              on={settings.colorBlind}
              onChange={(v) => set('colorBlind', v)}
            />
            <Toggle
              label={t('settings.tips')}
              tooltip={t('settings.tooltip.tips')}
              tooltipDisabled={tab !== 'game'}
              on={settings.tips}
              onChange={(v) => set('tips', v)}
            />
            <Tooltip title={t('settings.language')} body={t('settings.tooltip.language')} touchPin disabled={tab !== 'game'}>
              <div className="set-row">
                <span className="set-label">{t('settings.language')}</span>
                <button className="btn exchange sm" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
                  {lang === 'en' ? 'English' : '한국어'}
                </button>
              </div>
            </Tooltip>
        </div>

        <div id="settings-video" role="tabpanel" aria-hidden={tab !== 'video'} className={['set-tabpanel', tab === 'video' ? 'on' : ''].filter(Boolean).join(' ')}>
            <Toggle
              label={t('settings.fullscreen')}
              tooltip={t('settings.tooltip.fullscreen')}
              tooltipDisabled={tab !== 'video'}
              on={settings.fullscreen}
              onChange={(v) => {
                if (v) {
                  document.documentElement.requestFullscreen?.().catch(() => set('fullscreen', false));
                } else if (document.fullscreenElement) {
                  document.exitFullscreen?.().catch(() => set('fullscreen', true));
                }
              }}
            />
            <Slider
              label={t('settings.uiScale')}
              tooltip={t('settings.tooltip.uiScale')}
              tooltipDisabled={tab !== 'video'}
              value={settings.uiScale}
              min={80}
              max={120}
              onChange={(v) => set('uiScale', v)}
            />
        </div>

        <div id="settings-graphics" role="tabpanel" aria-hidden={tab !== 'graphics'} className={['set-tabpanel', tab === 'graphics' ? 'on' : ''].filter(Boolean).join(' ')}>
          <Toggle label={t('settings.crtEnabled')} tooltip={t('settings.tooltip.crtEnabled')} tooltipDisabled={tab !== 'graphics'} on={settings.crtEnabled} onChange={(v) => set('crtEnabled', v)} />
          <Slider label={t('settings.crtIntensity')} tooltip={t('settings.tooltip.crtIntensity')} tooltipDisabled={tab !== 'graphics'} value={settings.crtIntensity} min={0} max={100} onChange={(v) => set('crtIntensity', v)} />
          <Toggle label={t('settings.crtBloom')} tooltip={t('settings.tooltip.crtBloom')} tooltipDisabled={tab !== 'graphics'} on={settings.crtBloom} onChange={(v) => set('crtBloom', v)} />
        </div>

        <div id="settings-audio" role="tabpanel" aria-hidden={tab !== 'audio'} className={['set-tabpanel', tab === 'audio' ? 'on' : ''].filter(Boolean).join(' ')}>
            <p className="set-note">{t('settings.audioNote')}</p>
            {(!audio.isBusEnabled('sfx') || !audio.isBusEnabled('music')) && (
              <p className="set-note locked-hint"><UiIcon name="mutedSpeaker" className="inline-ui-icon" /> {t('settings.audioLockedHint')}</p>
            )}
            <Slider
              label={t('settings.music')}
              tooltip={t('settings.tooltip.music')}
              tooltipDisabled={tab !== 'audio'}
              value={settings.music}
              min={0}
              max={100}
              onChange={(v) => set('music', v)}
              mute={{
                label: t('settings.mute'),
                ariaLabel: t('settings.musicMute'),
                checked: settings.musicMuted,
                onChange: (checked) => set('musicMuted', checked),
              }}
            />
            <Slider
              label={t('settings.sfx')}
              tooltip={t('settings.tooltip.sfx')}
              tooltipDisabled={tab !== 'audio'}
              value={settings.sfx}
              min={0}
              max={100}
              onChange={(v) => set('sfx', v)}
              mute={{
                label: t('settings.mute'),
                ariaLabel: t('settings.sfxMute'),
                checked: settings.sfxMuted,
                onChange: (checked) => set('sfxMuted', checked),
              }}
            />
        </div>
      </div>
    </>
  );
}

// ---------- Statistics ----------
function StatsView({ lexicon }: { lexicon: Lexicon }) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<StatsTab>('overview');
  const [wordPage, setWordPage] = useState(0);
  const [snapshot] = useState(() => {
    const collection = loadCollection();
    return {
      collection,
      lifetime: loadLifetime(undefined, collection),
      emojiProgress: loadEmojiUnlockProgress(),
    };
  });
  const lt = snapshot.lifetime;
  const topPattern = mostPlayedPattern(lt.patternPlayCounts);
  const collectionCount = Object.keys(snapshot.collection).length;
  const collPct = useMemo(
    () => collectionProgressPercent(snapshot.collection, lexicon, lt.unlockAllApplied),
    [snapshot.collection, lexicon, lt.unlockAllApplied],
  );
  const sortedWords = useMemo(
    () => tab === 'words' ? sortedCollectionStats(snapshot.collection) : [],
    [snapshot.collection, tab],
  );
  const words = useMemo(
    () => tab === 'words' ? collectionStatsPage(sortedWords, wordPage) : null,
    [sortedWords, tab, wordPage],
  );

  return (
    <>
      <h2 className="scr-title">{t('options.statistics')}</h2>
      <div className="tabs" role="tablist" aria-label={t('options.statistics')}>
        {(['overview', 'words', 'jokers'] as StatsTab[]).map((id) => (
          <button key={id} role="tab" aria-selected={tab === id} aria-controls={`stats-${id}`} className={['tab', tab === id ? 'on' : ''].filter(Boolean).join(' ')} onClick={() => setTab(id)}>
            {t(`stats.tab.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'overview' && <div id="stats-overview" role="tabpanel" className="stats-cols">
        <div className="panel">
          <div className="label">{t('stats.records')}</div>
          <Stat k={t('stats.bestWord')} v={lt.bestWord ? `${lt.bestWord.toUpperCase()} · ${lt.bestWordScore}` : '—'} />
          <Stat k={t('stats.highestAnte')} v={lt.highestAnte || '—'} />
          <Stat k={t('stats.highestEndlessAnte')} v={lt.highestEndlessAnte || '—'} />
          <Stat k={t('stats.bestEndlessScore')} v={lt.bestEndlessScore ? formatScore(lt.bestEndlessScore) : '—'} />
          <Stat k={t('stats.mostGold')} v={lt.mostGold ? `$${lt.mostGold}` : '—'} />
          <Stat k={t('stats.runs')} v={lt.runs} />
          <Stat k={t('stats.wins')} v={lt.wins} />
          <Stat k={t('stats.bestWinStreak')} v={lt.bestWinStreak} />
          <Stat k={t('stats.mostPlayedPattern')} v={topPattern ? `${t(`pattern.${topPattern.id}`)} ×${topPattern.count}` : '—'} />
        </div>
        <div className="panel">
          <div className="label">{t('stats.progress')}</div>
          <Stat k={t('stats.collection')} v={`${collPct}%`} />
          <Stat
            k={t('stats.recordWins')}
            v={`${recordWinCount(lt)}/${POUCH_IDS.length * RECORD_IDS.length}`}
          />
          <Stat
            k={t('stats.jokerRecordStickers')}
            v={`${jokerRecordStickerCount(lt)}/${JOKER_RECORD_STICKER_TOTAL}`}
          />
          <Stat
            k={t('stats.challenges')}
            v={lt.challengesDisabled
              ? t('challenge.disabledShort')
              : `${lt.completedChallenges.length}/${CHALLENGE_DEFS.length}`}
          />
        </div>
      </div>}
      {tab === 'words' && words && <div id="stats-words" role="tabpanel" className="panel stats-detail">
        {collectionCount === 0 ? <p className="set-note">{t('stats.noWords')}</p> : (
          <table><thead><tr><th>{t('stats.word')}</th><th>{t('stats.plays')}</th><th>{t('stats.intrinsicChips')}</th><th>{t('stats.firstDiscovery')}</th></tr></thead>
            <tbody>{words.entries.map(([word, entry]) => (
              <tr key={word}><td>{word.toUpperCase()}</td><td>{entry.plays}</td><td>{entry.bestScore}</td><td>{entry.firstPlayedAt ? new Date(entry.firstPlayedAt).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US') : '—'}</td></tr>
            ))}</tbody></table>
        )}
        {words.pages > 1 && <div className="stats-pager">
          <button className="btn exchange sm" aria-label={t('stats.previousPage')} disabled={words.page === 0} onClick={() => setWordPage((page) => Math.max(0, page - 1))}>←</button>
          <span>{words.page + 1}/{words.pages}</span>
          <button className="btn exchange sm" aria-label={t('stats.nextPage')} disabled={words.page + 1 >= words.pages} onClick={() => setWordPage((page) => Math.min(words.pages - 1, page + 1))}>→</button>
        </div>}
      </div>}
      {tab === 'jokers' && <div id="stats-jokers" role="tabpanel" className="panel stats-detail">
        <table><thead><tr><th>{t('stats.emojiTile')}</th><th>{t('stats.blindsOwned')}</th></tr></thead>
          <tbody>{ALL_JOKERS.map((def) => {
            const unlocked = isEmojiUnlocked(def.id, snapshot.emojiProgress);
            return <tr key={def.id}><td>{unlocked ? (lang === 'ko' ? def.nameKo : def.nameEn) : '???'}</td><td>{lt.jokerBlindsCompleted[def.id] ?? 0}</td></tr>;
          })}</tbody></table>
      </div>}
    </>
  );
}

function Stat({ k, v, muted }: { k: string; v: string | number; muted?: boolean }) {
  return (
    <div className={['go-stat', muted ? 'muted-stat' : ''].filter(Boolean).join(' ')}>
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

// ---------- Credits ----------
function CreditsView() {
  const { t } = useI18n();
  const [tab, setTab] = useState<CreditsTab>('team');
  return (
    <>
      <h2 className="scr-title">{t('options.credits')}</h2>
      <div className="panel credits">
        {/* Same bang treatment as the main-menu logotype (.lt-bang). */}
        <p className="cr-title">
          Play the Wor<span className="lt-bang">!</span>d
        </p>
        <p>{t('credits.tagline')}</p>
        <div className="ri-tabs cr-tabs" role="tablist" aria-label={t('options.credits')}>
          {CREDIT_TABS.map((id) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`credits-${id}`}
              className={['ri-tab', tab === id ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(id)}
            >
              {t(`credits.tab.${id}`)}
            </button>
          ))}
        </div>
        <div id={`credits-${tab}`} className="cr-body" role="tabpanel">
          {tab === 'team' && (
            <>
              <div className="cr-row"><span>{t('credits.planning')}</span><b>SweetTurtles</b></div>
              <div className="cr-row"><span>{t('credits.development')}</span><b>SweetTurtles</b></div>
              <p className="cr-dim">{t('credits.aiDisclosure')}</p>
            </>
          )}
          {tab === 'visuals' && (
            <>
              <p>{t('credits.visuals')}</p>
              <p className="cr-dim">{t('credits.aiTools')}</p>
            </>
          )}
          {tab === 'audio' && (
            <>
              <p>{t('credits.audio')}</p>
              <p className="cr-dim">{t('credits.audioSource')}</p>
              <p className="cr-dim">{t('credits.aiTools')}</p>
            </>
          )}
          {tab === 'fonts' && (
            <>
              <div className="cr-fonts">
                <p><b>Jost</b><span>The Jost Project Authors</span></p>
                <p><b>Noto Sans KR</b><span>Google Inc.</span></p>
                <p><b>Baloo 2</b><span>The Baloo 2 Project Authors</span></p>
                <p><b>Jersey 10</b><span>The Soft Type Project Authors</span></p>
              </div>
              <p className="cr-dim">{t('credits.fontSource')}</p>
            </>
          )}
        </div>
        <details className="cr-legal">
          <summary>{t('credits.legal.open')}</summary>
          <div className="cr-legal-body">
            <p>{t('credits.legal.intro')}</p>
            <p className="cr-dim">{t('credits.legal.verbatim')}</p>
            <pre>{THIRD_PARTY_NOTICES}</pre>
          </div>
        </details>
        <p className="cr-copyright">© 2026 SweetTurtles</p>
      </div>
    </>
  );
}
