import type { BlindState, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { clearReward } from '../../engine/economy';
import type { StagePreview } from '../game';
import { useSettleView } from '../settle';
import { useCountUp } from '../useAnim';
import { BONUS_LAND_MS } from '../useGame';
import { useI18n } from '../i18n';
import { MoneyValue } from './MoneyValue';
import { blindEmblem } from '../bossArt';

interface Props {
  run: RunState;
  blind: BlindState;
  /** committed score before the in-flight settle — lets the round number climb (A-1) */
  committedBefore: number;
  /** false while a submission's settle is animating; flips true when it lands. Gates
   *  the round-number roll so it holds at committedBefore until the settle completes. */
  settleComplete: boolean;
  /** blind-end final score — non-null while the sentence bonus lands (06 #1) */
  finalScore: number | null;
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
export function Sidebar({
  run,
  blind,
  committedBefore,
  settleComplete,
  finalScore,
  preview,
  onOpenInfo,
  onOpenOptions,
}: Props) {
  const { t, lang } = useI18n();
  const phasesLeft = blind.phasesTotal - blind.phasesUsed;
  const settle = useSettleView();
  const reward = clearReward(blind.kind);
  // A (playtest-04) + item 7: the ROUND score is committed ONLY and never decreases,
  // and it ALWAYS rolls up with the same eased count-up the sentence bonus uses — no
  // more per-beat stepping. While a word's settle animates the scorebox, the round
  // holds at the pre-word committed (committedBefore); when the settle lands it eases
  // up to the new committed, and at blind end it eases on to the finalized score
  // (committed + sentence bonus, 06 #1). The forecast stays separate and is never
  // folded into this number (that's the 04-A "score drops" bug).
  //
  // The hold is gated on `settleComplete`, NOT settle.active: both settleComplete and
  // the new committedScore are set in the SAME submit state update, so there is never
  // a frame where committedScore is new but the hold is off. settle.active flips a
  // frame later (a layout effect), which briefly targeted the new committed and made
  // the number jump up, drop to committedBefore, then roll again (the item-5 bug).
  const roundTarget = finalScore ?? (settleComplete ? blind.committedScore : committedBefore);
  const round = useCountUp(roundTarget, BONUS_LAND_MS);
  // The sentence bonus as a forecast — "if the sentence ends like this: +N".
  const forecast = blind.projectedScore - blind.committedScore;
  // Idle is 0 × 0; the box fills only during settle, then resets (UI_DESIGN §4.1, B).
  const chips = settle.active ? settle.chips : 0;
  const mult = settle.active ? settle.mult : 0;
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;

  return (
    <aside className="sidebar">
      {/* Centered row: the kind emblem on the left, the target/reward stats panel
          on the right. `.bb-eff` between the heading and the row is a slot of
          fixed height that is ALWAYS present — empty on a normal blind, holding
          the Deadline's effect text on a boss. That keeps the badge (and so the
          whole rail) exactly as tall either way; before, the boss-only block grew
          it. The heading doubles as the boss's name on a boss blind — the kind
          label still reads off the emblem below (04 D-6: the effect always shows). */}
      <div className={['blind-badge', blind.kind].join(' ')}>
        <div className="kind">{boss ? (lang === 'ko' ? boss.nameKo : boss.nameEn) : t(`blind.${blind.kind}`)}</div>
        <div className="bb-eff">{boss && <span className="bosseff">{t(`bossdesc.${boss.id}`)}</span>}</div>
        <div className="bb-row">
          {/* Pixel-art emblem: the boss art on a boss blind, else the Draft/Revision
              kind art (bossArt.ts). Falls back to the kind emoji if art is missing.
              The kind name still reads off the badge heading above. */}
          <div className="bb-emblem">
            {blindEmblem(blind.kind, blind.bossId) ? (
              <img className="bb-art" src={blindEmblem(blind.kind, blind.bossId)} alt="" />
            ) : (
              boss && <span className="bb-emoji">{boss.emoji}</span>
            )}
          </div>
          <div className="bb-stats">
            <div className="bs-target">
              <span className="tlabel">{t('sidebar.target')}:</span>
              <span className="bs-target-row">
                {/* D-5: pixel tomato replaces the poker-chip icon beside score
                    numbers; the "Chips" term/box stay unchanged. Art (grey/red/green/
                    full) is composited by .tomato-icon from the unlock classes. */}
                <span className="tomato-icon" aria-hidden />
                <span className="target">{blind.target}</span>
              </span>
            </div>
            <div className="bs-reward">
              <span className="tlabel">{t('sidebar.reward')}:</span>
              <span className="reward">{'$'.repeat(Math.min(reward, 6))}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="panel round-panel">
        <div className="round-row">
          <span className="label">{t('sidebar.round')}</span>
          <span className="round-num"><span className="tomato-icon" aria-hidden /> {Math.round(round)}</span>
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
          <span className="box c">
            {Math.round(chips)}
            {settle.scorePop && settle.scorePop.chips !== 0 && (
              <span key={`c${settle.scorePop.id}`} className="box-pop chip">
                <span className="chip-diamond" aria-hidden />+{Math.round(settle.scorePop.chips)}
              </span>
            )}
          </span>
          <span className="x">×</span>
          <span className="box m">
            {fmtMult(mult)}
            {settle.scorePop && settle.scorePop.mult !== 0 && (
              <span key={`m${settle.scorePop.id}`} className="box-pop">
                {settle.scorePop.multOp === 'mul' ? '×' : '+'}
                {fmtMult(settle.scorePop.mult)}
              </span>
            )}
          </span>
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
        {/* Blue = play/phase, red = discard — the same pairing as the Play and
            Discard buttons (playtest-02 C-5); these two were inverted. */}
        <div className="sb-cell">
          <span className="label">{t('sidebar.phases')}</span>
          <span className="cnum blue">{phasesLeft}</span>
        </div>
        <div className="sb-cell">
          <span className="label">{t('sidebar.discards')}</span>
          <span className="cnum red">{blind.discardsLeft}</span>
        </div>
        <div className="sb-cell money-cell">
          <MoneyValue value={run.gold} />
        </div>
        <div className="sb-cell">
          <span className="label">{t('sidebar.chapter')}</span>
          <span className="cnum gold">
            {run.ante}
            <span className="of">/8</span>
          </span>
        </div>
        <div className="sb-cell">
          <span className="label">{t('sidebar.roundNum')}</span>
          <span className="cnum gold">{run.blindIndex + 1}</span>
        </div>
      </div>
    </aside>
  );
}
