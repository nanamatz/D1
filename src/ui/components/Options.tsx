import { useState } from 'react';
import type { Lexicon } from '../../engine/lexicon';
import { collectionSize } from '../collection';
import { loadLifetime } from '../lifetime';
import { useSettings } from '../settings';
import { useI18n } from '../i18n';

type View = 'root' | 'settings' | 'stats' | 'credits';
type Tab = 'game' | 'video' | 'audio';

interface Props {
  lexicon: Lexicon;
  onBack: () => void;
}

/** Options root → Settings / Statistics / Credits (spec §2.10–2.12). */
export function Options({ lexicon, onBack }: Props) {
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
          <button className="btn exchange" onClick={() => setView('stats')}>
            {t('options.statistics')}
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

      <div className="panel set-panel">
        {tab === 'game' && (
          <>
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
            <div className="set-row">
              <span className="set-label">{t('settings.language')}</span>
              <button className="btn exchange sm" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
                {lang === 'en' ? 'English' : '한국어'}
              </button>
            </div>
          </>
        )}

        {tab === 'video' && (
          <>
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
          </>
        )}

        {tab === 'audio' && (
          <>
            <p className="set-note">{t('settings.audioStub')}</p>
            <Slider label={t('settings.master')} value={settings.master} min={0} max={100} onChange={(v) => set('master', v)} />
            <Slider label={t('settings.music')} value={settings.music} min={0} max={100} onChange={(v) => set('music', v)} />
            <Slider label={t('settings.sfx')} value={settings.sfx} min={0} max={100} onChange={(v) => set('sfx', v)} />
          </>
        )}
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

// ---------- Credits ----------
function CreditsView() {
  const { t } = useI18n();
  return (
    <>
      <h2 className="scr-title">{t('options.credits')}</h2>
      <div className="panel credits">
        <p className="cr-title">Play the Wor!d</p>
        <p>{t('credits.tagline')}</p>
        <p className="cr-dim">{t('credits.inspired')}</p>
      </div>
    </>
  );
}
