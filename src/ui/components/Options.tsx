import { useState } from 'react';
import type { Lexicon } from '../../engine/lexicon';
import { collectionSize } from '../collection';
import { loadLifetime } from '../lifetime';
import { useSettings } from '../settings';
import { audio } from '../audio';
import { availableWooDakSkins } from '../mascots';
import { activeUnlocks } from '../unlocks';
import { useI18n } from '../i18n';
import { Collection } from './Collection';
import { ENCOUNTERS, hasSeen, resetIntro, type EncounterGroup } from '../tutorial';
import { richText } from '../richtext';

type View = 'root' | 'settings' | 'stats' | 'credits' | 'collection' | 'help';
type Tab = 'game' | 'video' | 'audio';

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
 * Help / Credits (spec §2.10–2.12; order per playtest-06 #4). New Run and Main Menu are
 * pause-menu only — they render just when their handler is supplied, so opening
 * Options from the main menu still shows the plain Settings/Stats/Collection set.
 */
export function Options({ lexicon, onBack, onNewRun, onMainMenu }: Props) {
  const { t } = useI18n();
  const [view, setView] = useState<View>('root');

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
          <button className="btn exchange" onClick={() => setView('help')}>
            {t('options.help')}
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
  // The Collection brings its own full screen + back bar, so render it directly
  // rather than nesting it inside the options frame.
  if (view === 'collection') return <Collection lexicon={lexicon} onBack={back} />;
  return (
    <div className="screen options">
      {view === 'settings' && <SettingsView />}
      {view === 'stats' && <StatsView lexicon={lexicon} />}
      {view === 'help' && <HelpView {...(onNewRun ? { onNewRun } : {})} />}
      {view === 'credits' && <CreditsView />}
      <button className="btn back-bar" onClick={back}>
        {t('common.back')}
      </button>
    </div>
  );
}

// ---------- reusable controls ----------
function Slider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <div className="set-control">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="set-badge">{value}</span>
      </div>
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="set-row">
      <span className="set-label">{label}</span>
      <button
        className={['toggle', on ? 'on' : ''].filter(Boolean).join(' ')}
        role="switch"
        aria-checked={on}
        onClick={() => onChange(!on)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

// ---------- Settings ----------
function SettingsView() {
  const { t, lang, setLang } = useI18n();
  const { settings, set } = useSettings();
  const [tab, setTab] = useState<Tab>('game');
  // 2026-07-21: WooDak ally skins the player may pick — default + unlocked art skins.
  // Hidden entirely while only the default exists, so it is never a one-option row.
  const mascotSkins = availableWooDakSkins(activeUnlocks(settings.unlockAll));

  return (
    <>
      <h2 className="scr-title">{t('options.settings')}</h2>
      <div className="tabs">
        {(['game', 'video', 'audio'] as Tab[]).map((x) => (
          <button key={x} className={['tab', x === tab ? 'on' : ''].filter(Boolean).join(' ')} onClick={() => setTab(x)}>
            {t(`settings.tab.${x}`)}
          </button>
        ))}
      </div>

      {/* All three panels are always rendered and stacked in one grid cell, so the
          panel's height is the tallest tab's and never jumps between tabs. The
          inactive ones are `visibility: hidden`, which also drops them from the
          tab order and the accessibility tree. */}
      <div className="panel set-panel">
        <div className={['set-tabpanel', tab === 'game' ? 'on' : ''].filter(Boolean).join(' ')}>
            <div className="set-row">
              <span className="set-label">{t('settings.gameSpeed')}</span>
              <div className="segmented">
                {([1, 2, 4] as const).map((s) => (
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
            <Slider
              label={t('settings.screenshake')}
              value={settings.screenshake}
              min={0}
              max={100}
              onChange={(v) => set('screenshake', v)}
            />
            <Toggle
              label={t('settings.reducedMotion')}
              on={settings.reducedMotion}
              onChange={(v) => set('reducedMotion', v)}
            />
            <Toggle
              label={t('settings.colorBlind')}
              on={settings.colorBlind}
              onChange={(v) => set('colorBlind', v)}
            />
            <Toggle
              label={t('settings.tips')}
              on={settings.tips}
              onChange={(v) => set('tips', v)}
            />
            <div className="set-row">
              <span className="set-label">{t('settings.language')}</span>
              <button className="btn exchange sm" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
                {lang === 'en' ? 'English' : '한국어'}
              </button>
            </div>
            {mascotSkins.length > 1 && (
              <div className="set-row">
                <span className="set-label">{t('settings.mascot')}</span>
                <div className="mascot-picker">
                  {mascotSkins.map((s) => (
                    <button
                      key={s.id}
                      className={['mascot-choice', s.id === settings.mascot ? 'on' : ''].filter(Boolean).join(' ')}
                      onClick={() => set('mascot', s.id)}
                      aria-pressed={s.id === settings.mascot}
                      title={t(s.nameKey)}
                    >
                      <img src={s.art ?? ''} alt={t(s.nameKey)} />
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        <div className={['set-tabpanel', tab === 'video' ? 'on' : ''].filter(Boolean).join(' ')}>
            <Toggle
              label={t('settings.fullscreen')}
              on={settings.fullscreen}
              onChange={(v) => {
                set('fullscreen', v);
                if (v) document.documentElement.requestFullscreen?.().catch(() => {});
                else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
              }}
            />
            <Slider
              label={t('settings.uiScale')}
              value={settings.uiScale}
              min={80}
              max={120}
              onChange={(v) => set('uiScale', v)}
            />
            {/* C-4: presentation-unlock override — reveal all colors/audio now. The
                chromatic gimmick stays the celebratory path; playing the word still
                fires the reveal + collection record even when this is on. */}
            <Toggle
              label={t('settings.unlockAll')}
              on={settings.unlockAll}
              onChange={(v) => set('unlockAll', v)}
            />
            <p className="set-note">{t('settings.unlockAllNote')}</p>
        </div>

        <div className={['set-tabpanel', tab === 'audio' ? 'on' : ''].filter(Boolean).join(' ')}>
            <p className="set-note">{t('settings.audioNote')}</p>
            {(!audio.isBusEnabled('sfx') || !audio.isBusEnabled('music')) && (
              <p className="set-note locked-hint">🔇 {t('settings.audioLockedHint')}</p>
            )}
            <Slider label={t('settings.master')} value={settings.master} min={0} max={100} onChange={(v) => set('master', v)} />
            <Slider label={t('settings.music')} value={settings.music} min={0} max={100} onChange={(v) => set('music', v)} />
            <Slider label={t('settings.sfx')} value={settings.sfx} min={0} max={100} onChange={(v) => set('sfx', v)} />
        </div>
      </div>
    </>
  );
}

// ---------- Statistics ----------
function StatsView({ lexicon }: { lexicon: Lexicon }) {
  const { t } = useI18n();
  const lt = loadLifetime();
  const collPct = lexicon.size > 0 ? Math.round((collectionSize() / lexicon.size) * 1000) / 10 : 0;

  return (
    <>
      <h2 className="scr-title">{t('options.statistics')}</h2>
      <div className="stats-cols">
        <div className="panel">
          <div className="label">{t('stats.records')}</div>
          <Stat k={t('stats.bestWord')} v={lt.bestWord ? `${lt.bestWord.toUpperCase()} · ${lt.bestWordScore}` : '—'} />
          <Stat k={t('stats.highestAnte')} v={lt.highestAnte || '—'} />
          <Stat k={t('stats.mostGold')} v={lt.mostGold ? `$${lt.mostGold}` : '—'} />
          <Stat k={t('stats.runs')} v={lt.runs} />
        </div>
        <div className="panel">
          <div className="label">{t('stats.progress')}</div>
          <Stat k={t('stats.collection')} v={`${collPct}%`} />
          <Stat k={t('stats.challenges')} v="0/0" muted />
          <Stat k={t('stats.stakeWins')} v="—" muted />
        </div>
      </div>
      <p className="set-note">{t('stats.cardStubs')}</p>
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

// ---------- Help ----------
function HelpView({ onNewRun }: { onNewRun?: () => void }) {
  const { t } = useI18n();
  const [replayed, setReplayed] = useState(false);
  const groups: EncounterGroup[] = ['tiles', 'scoring', 'economy', 'run'];
  // The lesson rigs the opening hand at run start, so replaying means a fresh run. From the
  // pause menu (onNewRun available) jump straight there; from the main menu, clear the flag
  // and tell the player to start a New Run.
  const replay = () => {
    resetIntro();
    if (onNewRun) onNewRun();
    else setReplayed(true);
  };
  return (
    <>
      <h2 className="scr-title">{t('help.title')}</h2>
      <div className="help-replay">
        <button className="btn exchange sm" onClick={replay}>
          {t('help.replayIntro')}
        </button>
        {replayed && <span className="help-replay-note">{t('help.replayIntroDone')}</span>}
      </div>
      <div className="help-groups">
        {groups.map((g) => {
          const items = ENCOUNTERS.filter((e) => e.group === g);
          if (items.length === 0) return null;
          return (
            <div key={g} className="panel help-group">
              <div className="label">{t(`help.group.${g}`)}</div>
              {items.map((e) => {
                const seen = hasSeen(e.id);
                return (
                  <div key={e.id} className={['help-entry', seen ? '' : 'locked'].filter(Boolean).join(' ')}>
                    <div className="help-entry-head">
                      <span className="tut-icon">{e.icon}</span>
                      <span className="help-entry-title">
                        {seen ? t(`tutorial.${e.id}.title`) : t('help.undiscovered')}
                      </span>
                    </div>
                    {seen && <p className="help-entry-body">{richText(t(`tutorial.${e.id}.body`))}</p>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

// ---------- Credits ----------
function CreditsView() {
  const { t } = useI18n();
  return (
    <>
      <h2 className="scr-title">{t('options.credits')}</h2>
      <div className="panel credits">
        {/* Same bang treatment as the main-menu logotype (.lt-bang). */}
        <p className="cr-title">
          Play the Wor<span className="lt-bang">!</span>d
        </p>
        <p>{t('credits.tagline')}</p>
        <p className="cr-dim">{t('credits.inspired')}</p>
      </div>
    </>
  );
}
