import type { BlindState, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { clearReward } from '../../engine/economy';
import type { StagePreview } from '../game';
import { useSettleView } from '../settle';
import { useI18n } from '../i18n';

interface Props {
  run: RunState;
  blind: BlindState;
  /** committed score before the in-flight settle — lets the round number climb (A-1) */
  committedBefore: number;
  /** the staged-word preview — its status shows above the 0×0 box (E-9) */
  preview: StagePreview | null;
  onOpenInfo: () => void;
  onOpenOptions: () => void;
}

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** Selected-tile status text, in Balatro's hand-name position (E-9). */
function StatusLine({ preview }: { preview: StagePreview | null }) {
  const { t } = useI18n();
  if (!preview) return <div className="sb-status">&nbsp;</div>;
  if (preview.blocked) return <div className="sb-status warn">{t('boss.blockedWord')}</div>;
  if (preview.isGibberish) {
    const lh = preview.letterHand ? ` · ${t(`letterhand.${preview.letterHand.id}`)}` : '';
    return (
      <div className="sb-status warn">
        {t('stage.notWord')}
        {lh}
      </div>
    );
  }
  const suit = preview.suit ?? 'standard';
  const label = preview.letterHand ? t(`letterhand.${preview.letterHand.id}`) : t(`suit.${suit}`);
  return (
    <div className={['sb-status', suit !== 'standard' ? `loud ${suit}` : ''].filter(Boolean).join(' ')}>
      {label}
    </div>
  );
}

/** Left rail (playtest-03 E-9): stage badge · target+reward · round score · 0×0 · controls. */
export function Sidebar({ run, blind, committedBefore, preview, onOpenInfo, onOpenOptions }: Props) {
  const { t, lang } = useI18n();
  const phasesLeft = blind.phasesTotal - blind.phasesUsed;
  const settle = useSettleView();
  const reward = clearReward(blind.kind);
  // A (playtest-04): the ROUND score is committed ONLY and never decreases. During
  // a settle it climbs per beat from the old committed toward the new one (clamped
  // so a voided word doesn't overshoot); idle it shows the committed total.
  const round = settle.active
    ? Math.min(committedBefore + settle.chips * settle.mult, blind.committedScore)
    : blind.committedScore;
  // The sentence bonus is a separate forecast — "if the sentence ends like this: +N".
  const forecast = blind.projectedScore - blind.committedScore;
  // Idle is 0 × 0; the box fills only during settle, then resets (UI_DESIGN §4.1, B).
  const chips = settle.active ? settle.chips : 0;
  const mult = settle.active ? settle.mult : 0;
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;

  return (
    <aside className="sidebar">
      <div className={['blind-badge', blind.kind].join(' ')}>
        <div className="kind">{t(`blind.${blind.kind}`)}</div>
        {boss && (
          <>
            <div className="boss">
              {boss.emoji} {lang === 'ko' ? boss.nameKo : boss.nameEn}
            </div>
            <div className="bosseff">{t(`bossdesc.${boss.id}`)}</div>
          </>
        )}
        <div className="badge-stats">
          <div className="bs-target">
            <span className="tlabel">{t('sidebar.target')}</span>
            <span className="target">❄ {blind.target}</span>
          </div>
          <div className="bs-reward">
            <span className="tlabel">{t('sidebar.reward')}</span>
            <span className="reward">{'$'.repeat(Math.min(reward, 6))}</span>
          </div>
        </div>
      </div>

      <div className="panel round-panel">
        <div className="round-row">
          <span className="label">{t('sidebar.round')}</span>
          <span className="round-num">❄ {Math.round(round)}</span>
        </div>
        {!blind.previewHidden && forecast > 0 && (
          <div className="round-forecast">
            {t('sidebar.forecast', { n: Math.round(forecast) })}
          </div>
        )}
      </div>

      <div className="panel score-panel">
        <StatusLine preview={preview} />
        <div className={['scorebox', settle.active && 'settling'].filter(Boolean).join(' ')}>
          <span className="box c">{Math.round(chips)}</span>
          <span className="x">×</span>
          <span className="box m">{fmtMult(mult)}</span>
        </div>
      </div>

      <div className="sb-controls">
        <div className="sb-btns">
          <button className="sidenav-btn info" onClick={onOpenInfo}>
            {t('runinfo.title')}
          </button>
          <button className="sidenav-btn options" onClick={onOpenOptions}>
            {t('sidebar.options')}
          </button>
        </div>
        <div className="sb-cell">
          <span className="label">{t('sidebar.phases')}</span>
          <span className="cnum red">{phasesLeft}</span>
        </div>
        <div className="sb-cell">
          <span className="label">{t('sidebar.discards')}</span>
          <span className="cnum blue">{blind.discardsLeft}</span>
        </div>
        <div className="sb-cell money-cell">
          <span className="money">${run.gold}</span>
        </div>
        <div className="sb-cell">
          <span className="ante">{t('sidebar.ante', { n: run.ante })}</span>
        </div>
      </div>
    </aside>
  );
}
