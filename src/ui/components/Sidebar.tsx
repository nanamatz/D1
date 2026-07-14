import type { BlindState, RunState, ScoreEvent } from '../../engine/types';
import type { StagePreview } from '../game';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { useCountUp, useSettle } from '../useAnim';
import { useI18n } from '../i18n';

interface Props {
  run: RunState;
  blind: BlindState;
  preview: StagePreview | null;
  projectedBreakdown: string;
  events: ScoreEvent[];
  settleId: number;
}

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

function Dots({ total, filled, blue = false }: { total: number; filled: number; blue?: boolean }) {
  return (
    <div className="dots">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={['dot', blue && 'blue', i < filled && 'on'].filter(Boolean).join(' ')} />
      ))}
    </div>
  );
}

/** Left rail: blind badge, round score, projected, resource dots, gold/ante. */
export function Sidebar({ run, blind, preview, projectedBreakdown, events, settleId }: Props) {
  const { t, lang, setLang } = useI18n();
  const beaten = blind.projectedScore >= blind.target;
  const phasesLeft = blind.phasesTotal - blind.phasesUsed;
  const settle = useSettle(events, settleId);
  const committed = useCountUp(blind.committedScore);
  const projected = useCountUp(blind.projectedScore);
  // While settling, the box replays the just-played word's chips × mult;
  // otherwise it previews the staged word (UI_DESIGN §4.1).
  const chips = settle.active ? settle.chips : preview ? preview.chips : 0;
  const mult = settle.active ? settle.mult : preview ? preview.suitMult : 1;

  return (
    <aside className="sidebar">
      <div className="langbar">
        <button className="langbtn" onClick={() => setLang(lang === 'en' ? 'ko' : 'en')}>
          {t('lang.toggle')}
        </button>
      </div>
      <div className="blind-badge">
        <div className="kind">{t(`blind.${blind.kind}`)}</div>
        {blind.bossId &&
          (() => {
            const boss = BOSS_REGISTRY.get(blind.bossId!);
            if (!boss) return null;
            return (
              <>
                <div className="boss">
                  {boss.emoji} {lang === 'ko' ? boss.nameKo : boss.nameEn}
                </div>
                <div className="bosseff">{t(`bossdesc.${boss.id}`)}</div>
              </>
            );
          })()}
        <div className="tlabel">{t('sidebar.target')}</div>
        <div className="target">{blind.target}</div>
      </div>

      <div className="panel">
        <div className="label">{settle.active ? t('sidebar.scoring') : t('sidebar.staged')}</div>
        <div className={['scorebox', settle.active && 'settling'].filter(Boolean).join(' ')}>
          <span className="box c">{Math.round(chips)}</span>
          <span className="x">×</span>
          <span className="box m">{fmtMult(mult)}</span>
        </div>
        <div className="label" style={{ marginTop: 10 }}>
          {t('sidebar.committed')}
        </div>
        <div className="committed">{Math.round(committed)}</div>

        <div className={['projected', beaten && !blind.previewHidden && 'beaten'].filter(Boolean).join(' ')}>
          <div className="label">{t('sidebar.projected')}</div>
          <div className="num">{blind.previewHidden ? '???' : Math.round(projected)}</div>
          {beaten && !blind.previewHidden && <span className="beat">{t('sidebar.beaten')}</span>}
          {!blind.previewHidden && <div className="breakdown">{projectedBreakdown}</div>}
        </div>
      </div>

      <div className="panel">
        <div className="label">{t('sidebar.phases')}</div>
        <Dots total={blind.phasesTotal} filled={phasesLeft} />
        <div className="label" style={{ marginTop: 10 }}>
          {t('sidebar.exchanges')}
        </div>
        <Dots total={run.baseExchanges} filled={blind.exchangesLeft} blue />
        <div className="row">
          <span className="money">${run.gold}</span>
          <span className="ante">{t('sidebar.ante', { n: run.ante })}</span>
        </div>
      </div>
    </aside>
  );
}
