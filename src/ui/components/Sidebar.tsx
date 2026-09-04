import { useEffect, useRef, useState } from 'react';
import type { BlindState, LetterHandId, PatternId, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { effectiveClearReward } from '../../engine/economy';
import { sentenceTotal } from '../../engine/patterns';
import type { StagePreview } from '../game';
import { useSettleView } from '../settle';
import { useCountUp } from '../useAnim';
import { motionOff } from '../motion';
import { BONUS_LAND_MS, type SentenceBonusDisplay } from '../useGame';
import { useI18n } from '../i18n';
import { formatScore } from '../formatScore';
import { MoneyValue } from './MoneyValue';
import { blindEmblem } from '../bossArt';
import { PatternIcon } from './UiIcon';
import { RecordCard } from './ObjectCards';
import { Tooltip } from './Tooltip';
import { richText } from '../richtext';
import { isLetterHandDiscovered } from '../lifetime';
import { scoreTypewriterLiveTotal } from '../scoreTypewriter';
import { ScoreTypewriter } from './ScoreTypewriter';
import { bossDescription } from '../descriptions';

interface Props {
  run: RunState;
  blind: BlindState;
  /** committed score before the in-flight settle — lets the round number climb (A-1) */
  committedBefore: number;
  /** false while a submission's settle is animating; flips true when it lands. Gates
   *  the round-number roll so it holds at committedBefore until the settle completes. */
  settleComplete: boolean;
  settleId: number;
  /** blind-end final score — non-null while the sentence bonus lands (06 #1) */
  finalScore: number | null;
  /** finalized sentence-bonus breakdown from BUILD through Fee Settlement */
  sentenceBonus: SentenceBonusDisplay | null;
  /** highest valid pattern in the already-submitted sequence */
  currentPattern: PatternId | null;
  /** the staged-word preview — its status shows above the 0×0 box (E-9) */
  preview: StagePreview | null;
  discoveredLetterHands: ReadonlySet<LetterHandId>;
  onOpenInfo: () => void;
  onOpenOptions: () => void;
  screenshake: number;
  reducedMotion: boolean;
  resolutionActive?: boolean;
  mode?: 'blind' | 'shop' | 'blindselect';
}

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));
const fmtSigned = (value: number): string =>
  `${value >= 0 ? '+' : ''}${Number.isInteger(value) ? value : value.toFixed(2)}`;
const fmtScoreSigned = (value: number): string =>
  `${value >= 0 ? '+' : ''}${formatScore(value)}`;
const scoreValueClass = (text: string): 'normal' | 'compact' | 'dense' =>
  text.length <= 7 ? 'normal' : text.length <= 9 ? 'compact' : 'dense';

/** Selected-tile status text, in Balatro's hand-name position (E-9). */
function StatusLine({
  preview,
  discoveredLetterHands,
}: {
  preview: StagePreview | null;
  discoveredLetterHands: ReadonlySet<LetterHandId>;
}) {
  const { t } = useI18n();
  if (!preview) return <div className="sb-status">&nbsp;</div>;
  if (preview.blocked) return <div className="sb-status blocked">{t('boss.blockedWord')}</div>;
  if (preview.isGibberish) {
    const lh = preview.letterHand
      ? ` · ${isLetterHandDiscovered(preview.letterHand.id, discoveredLetterHands)
          ? `Lv.${preview.letterHand.level} ${t(`letterhand.${preview.letterHand.id}`)}`
          : '???'}`
      : '';
    return (
      <div className="sb-status warn">
        {t('stage.notWord')}
        {lh}
      </div>
    );
  }
  const suit = preview.suit ?? 'standard';
  const label = preview.letterHand
    ? isLetterHandDiscovered(preview.letterHand.id, discoveredLetterHands)
      ? `Lv.${preview.letterHand.level} ${t(`letterhand.${preview.letterHand.id}`)}`
      : '???'
    : t(`suit.${suit}`);
  return (
    <div className={['sb-status', suit !== 'standard' ? `loud ${suit}` : ''].filter(Boolean).join(' ')}>
      {label}
    </div>
  );
}

export function sentenceBonusSupplementRowCount(sentenceBonus: SentenceBonusDisplay): number {
  const hasEffects = Math.abs(sentenceBonus.effectChips) > 0.001 ||
    Math.abs(sentenceBonus.effectMult - 1) > 0.001 ||
    (sentenceBonus.effectScore ?? 0) !== 0;
  return Number(sentenceBonus.modifierChips !== 0) +
    Number(hasEffects) +
    Number(sentenceBonus.pouchId != null);
}

/** Finalized headline reuses the round panel's already-reserved live-pattern line. */
export function FinalizedSentenceHeadline({
  sentenceBonus,
}: {
  sentenceBonus: SentenceBonusDisplay;
}) {
  const { t } = useI18n();
  const hasUnison = sentenceBonus.unisonSuit !== null &&
    (sentenceBonus.unisonChips !== 0 || sentenceBonus.unisonMult !== 1);
  const hasRegisterSynergy = !hasUnison &&
    sentenceBonus.registerSynergyId !== null &&
    sentenceBonus.registerSynergyChipsFactor !== 1;
  const unisonText = hasUnison
    ? `${t(`suit.${sentenceBonus.unisonSuit}`)} ${sentenceBonus.unisonChips !== 0
        ? t('sidebar.bonusUnisonChips', { chips: fmtSigned(sentenceBonus.unisonChips) })
        : t('sidebar.bonusUnisonMult', { mult: fmtMult(sentenceBonus.unisonMult) })}`
    : null;
  const registerText = hasRegisterSynergy
    ? t('sidebar.bonusRegisterSynergy', {
        name: t(`registerSynergy.${sentenceBonus.registerSynergyId}`),
        factor: fmtMult(sentenceBonus.registerSynergyChipsFactor),
      })
    : null;
  const styleText = unisonText ?? registerText;
  const patternText = sentenceBonus.pattern
    ? `${t('sidebar.patternLevel', { n: sentenceBonus.level ?? 1 })} · ${t(`pattern.${sentenceBonus.pattern}`)}`
    : null;
  const label = [patternText, styleText].filter(Boolean).join(' · ');
  if (!label) return null;

  return (
    <div
      className={[
        'round-pattern',
        'finalized-pattern',
        hasUnison && 'unison',
        hasUnison && sentenceBonus.unisonSuit,
        hasRegisterSynergy && 'register-synergy',
      ].filter(Boolean).join(' ')}
      role="group"
      aria-label={label}
    >
      {sentenceBonus.pattern && (
        <span className="finalized-pattern-core">
          <span className="finalized-pattern-level">
            {t('sidebar.patternLevel', { n: sentenceBonus.level ?? 1 })}
          </span>
          <span aria-hidden>·</span>
          <PatternIcon pattern={sentenceBonus.pattern} />
          <span className="finalized-pattern-name">{t(`pattern.${sentenceBonus.pattern}`)}</span>
        </span>
      )}
      {sentenceBonus.pattern && styleText && <span aria-hidden>·</span>}
      {styleText && <span className="finalized-style">{styleText}</span>}
    </div>
  );
}

/** Finalized supplemental sources: one full-width row per source family. */
export function SentenceBonusParts({ sentenceBonus }: { sentenceBonus: SentenceBonusDisplay }) {
  const { t } = useI18n();
  const hasEffectChips = Math.abs(sentenceBonus.effectChips) > 0.001;
  const hasEffectMult = Math.abs(sentenceBonus.effectMult - 1) > 0.001;
  const hasEffectScore = (sentenceBonus.effectScore ?? 0) !== 0;
  if (sentenceBonusSupplementRowCount(sentenceBonus) === 0) return null;
  return (
    <div className="bonus-parts" aria-label={t('sidebar.bonusBreakdown')}>
      {sentenceBonus.modifierChips !== 0 && (
        <span className="bonus-part modifier">
          {t('sidebar.bonusModifier', {
            count: sentenceBonus.modifierCount,
            chips: fmtSigned(sentenceBonus.modifierChips),
          })}
        </span>
      )}
      {(hasEffectChips || hasEffectMult || hasEffectScore) && (
        <span className="bonus-part effect">
          <span>{t('sidebar.bonusEffects')}</span>
          {hasEffectChips && (
            <span className="effect-axis chips">
              {fmtSigned(sentenceBonus.effectChips)} {t('patternLevel.chips')}
            </span>
          )}
          {hasEffectMult && (
            <span className="effect-axis mult">
              ×{fmtMult(sentenceBonus.effectMult)} {t('patternLevel.mult')}
            </span>
          )}
          {hasEffectScore && (
            <span className="effect-axis score">
              {fmtScoreSigned(sentenceBonus.effectScore ?? 0)} {t('sidebar.score')}
            </span>
          )}
        </span>
      )}
      {sentenceBonus.pouchId && (
        <span className="bonus-part pouch">
          {t('sidebar.bonusPouch', {
            name: t(`pouch.${sentenceBonus.pouchId}.name`),
            chips: fmtSigned(sentenceBonus.pouchChipsDelta),
            mult: fmtSigned(sentenceBonus.pouchMultDelta),
          })}
        </span>
      )}
    </div>
  );
}

/** Left rail (playtest-03 E-9): stage badge · target+reward · round score · 0×0 · controls. */
export function Sidebar({
  run,
  blind,
  committedBefore,
  settleComplete,
  settleId,
  finalScore,
  sentenceBonus,
  currentPattern,
  preview,
  discoveredLetterHands,
  onOpenInfo,
  onOpenOptions,
  screenshake,
  reducedMotion,
  resolutionActive = false,
  mode = 'blind',
}: Props) {
  const { t, lang } = useI18n();
  const showBlindResources = mode !== 'shop';
  const phasesLeft = showBlindResources ? blind.phasesTotal - blind.phasesUsed : 0;
  const settle = useSettleView();
  const reward = effectiveClearReward(run, blind.kind) + (blind.clearRewardBonus ?? 0);
  // A (playtest-04) + item 7: the ROUND score is committed ONLY and never decreases,
  // and it ALWAYS rolls up with the same eased count-up the sentence bonus uses — no
  // more per-beat stepping. While a word's settle animates the scorebox, the round
  // holds at the pre-word committed (committedBefore); when the settle lands it eases
  // up to the new committed, and at blind end it eases on to the finalized score
  // ((committed + sentence Chips) × sentence Mult, 06 #1). The forecast stays separate and is never
  // folded into this number (that's the 04-A "score drops" bug).
  //
  // The hold is gated on `settleComplete`, NOT settle.active: both settleComplete and
  // the new committedScore are set in the SAME submit state update, so there is never
  // a frame where committedScore is new but the hold is off. settle.active flips a
  // frame later (a layout effect), which briefly targeted the new committed and made
  // the number jump up, drop to committedBefore, then roll again (the item-5 bug).
  const roundTarget =
    mode === 'blind'
      ? finalScore ?? (settleComplete ? blind.committedScore : committedBefore)
      : 0;
  // Outside a blind the score readout is a fresh zero-state, not the tail of the
  // previous blind. Snap the reset so entering the shop cannot replay the final
  // score as a count-down/count-up animation.
  const round = useCountUp(roundTarget, BONUS_LAND_MS, mode !== 'blind');
  // The sentence result as a forecast — "if the sentence ends like this: +N".
  // At blind end, the scorebox shows the committed score plus sentence Chips on
  // the Chips axis and the sentence Mult factor on the Mult axis.
  const bonusActive = mode === 'blind' && sentenceBonus !== null;
  const provenanceRows = bonusActive ? sentenceBonusSupplementRowCount(sentenceBonus) : 0;
  // The bonus is LANDING (round is rolling) once finalScore is published — the box
  // is full and its product flies onto the round total. During BUILD (finalScore
  // still null) the box is filling and the round holds.
  const landing = bonusActive && finalScore !== null;
  const bonusTotal = bonusActive
    ? Math.round(
        sentenceTotal(blind.committedScore, sentenceBonus!.chips, sentenceBonus!.mult)
          - blind.committedScore,
      )
    : 0;
  const bonusChips = useCountUp(
    bonusActive ? blind.committedScore + sentenceBonus!.chips : 0,
    BONUS_LAND_MS,
  );
  const bonusMult = useCountUp(bonusActive ? sentenceBonus!.mult : 0, BONUS_LAND_MS);
  // Idle is 0 × 0; the box fills only during settle (or the bonus beat), then resets
  // (UI_DESIGN §4.1, B).
  const chips = mode === 'blind' ? (bonusActive ? bonusChips : settle.active ? settle.chips : 0) : 0;
  const mult = mode === 'blind' ? (bonusActive ? bonusMult : settle.active ? settle.mult : 0) : 0;
  const chipsText = formatScore(chips);
  const multText = formatScore(mult);
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;
  const bossEmblemRef = useRef<HTMLDivElement>(null);
  const bossName = boss ? (lang === 'ko' ? boss.nameKo : boss.nameEn) : '';
  const bossEffect = boss
    ? bossDescription(boss.id, t, run, blind.deadLetter ?? '—')
    : '';

  // Live score is presentation-only: it drives the keyboard's separate one-shot
  // Enter target strike, never its strength tier or the committed round number.
  const liveTotal = bonusActive
    ? round
    : scoreTypewriterLiveTotal(
      settleComplete,
      settle.active,
      committedBefore,
      settle.chips,
      settle.mult,
      settle.flatScore,
      blind.committedScore,
    );
  const typewriterTier = settle.typewriterBeat?.tier ?? 0;
  const typewriterBeatId = `score-${settle.typewriterBeat?.id ?? 0}`;

  // D-1 · tomato idle hop (UI_DESIGN §4.6): a few times per blind, on a long random
  // timer, never rhythmic. Positioning lives on a separate anchor so neither this
  // hop nor the per-beat bounce can replace the icon's panel-relative transform.
  const [hop, setHop] = useState(false);
  useEffect(() => {
    if (motionOff()) return;
    let live = true;
    let clear: ReturnType<typeof setTimeout>;
    const schedule = (): ReturnType<typeof setTimeout> =>
      setTimeout(() => {
        if (!live) return;
        setHop(true);
        clear = setTimeout(() => setHop(false), 480);
        timer = schedule();
      }, 8000 + Math.random() * 12000);
    let timer = schedule();
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(clear);
    };
  }, []);

  return (
    <aside className={['sidebar', `sidebar-${mode}`].join(' ')}>
      <ScoreTypewriter
        active={mode === 'blind' && typewriterTier > 0}
        tier={typewriterTier}
        beatId={typewriterBeatId}
        primaryKeyId={settle.typewriterBeat?.primaryKeyId ?? 'Enter'}
        liveTotal={mode === 'blind' ? liveTotal : 0}
        target={mode === 'blind' ? blind.target : 0}
        targetCueEnabled={mode === 'blind' && blind.projectedScore >= blind.target}
        blindKey={`${run.ante}-${run.blindIndex}`}
        settleId={settleId}
        resolutionActive={resolutionActive}
        holdActive={resolutionActive && settleComplete}
        gameSpeed={settle.typewriterBeat?.speed ?? settle.settleSpeed}
        screenshake={screenshake}
        reducedMotion={reducedMotion || settle.settleReduced}
      />
      {/* Centered row: the kind emblem on the left, the target/reward stats panel
          on the right. `.bb-eff` between the heading and the row is a slot of
          fixed height that is ALWAYS present — empty on a normal blind, holding
          the Deadline's effect text on a boss. That keeps the badge (and so the
          whole rail) exactly as tall either way; before, the boss-only block grew
          it. The heading doubles as the boss's name on a boss blind — the kind
          label still reads off the emblem below (04 D-6: the effect always shows). */}
      <div className={['blind-badge', mode === 'blind' ? blind.kind : mode].join(' ')}>
        <div className="kind">
          {mode === 'blind'
            ? boss
              ? bossName
              : t(`blind.${blind.kind}`)
            : mode === 'shop'
              ? <span className="shop-sign-word">SHOP</span>
              : (
                <span className="blindselect-prompt">
                  {t('blindselect.prompt')}
                </span>
              )}
        </div>
        <div className="bb-eff">
          {mode === 'blind' && boss && (
            <span className="bosseff">{richText(bossEffect)}</span>
          )}
        </div>
        {mode !== 'blind' ? (
          <div className="sidebar-mode-emblem" aria-hidden>
            {mode === 'shop' ? (
              <span className="shop-sign-lights">
                {Array.from({ length: 9 }, (_, i) => <i key={i} />)}
              </span>
            ) : (
              <span className="blindselect-caret">▼</span>
            )}
          </div>
        ) : (
        <div className="bb-row">
          {/* Pixel-art emblem: the boss art on a boss blind, else the Draft/Revision
              kind art (bossArt.ts). Falls back to the kind emoji if art is missing.
              The kind name still reads off the badge heading above. */}
          <div
            ref={bossEmblemRef}
            className="bb-emblem"
            role={boss ? 'img' : undefined}
            tabIndex={boss ? 0 : undefined}
            aria-label={boss ? bossName : undefined}
          >
            {blindEmblem(blind.kind, blind.bossId) && (
              <img className="bb-art" src={blindEmblem(blind.kind, blind.bossId)} alt="" />
            )}
          </div>
          {boss && (
            <Tooltip
              anchorRef={bossEmblemRef}
              title={bossName}
              body={bossEffect}
            />
          )}
          <div className="bb-stats">
            <div className="bs-target">
              <span className="tlabel">{t('sidebar.target')}:</span>
              <span className="bs-target-row">
                <Tooltip
                  title={t(`record.${run.recordId}.name`)}
                  body={[
                    t(`record.${run.recordId}.desc`),
                    run.recordId !== 'whiteLp' && t('newrun.cumulative'),
                  ].filter(Boolean).join('\n')}
                >
                  <RecordCard
                    id={run.recordId}
                    imageClassName="target-record"
                    className="target-record-card"
                    role="img"
                    aria-label={t(`record.${run.recordId}.name`)}
                    tabIndex={0}
                  />
                </Tooltip>
                <span className="target">{formatScore(blind.target)}</span>
              </span>
            </div>
            <div className="bs-reward">
              <span className="tlabel">{t('sidebar.reward')}:</span>
              <span className="reward">{'$'.repeat(Math.min(reward, 6))}</span>
            </div>
          </div>
        </div>
        )}
      </div>

      <div className="panel round-panel">
        <div className="round-row">
          <span className="label">{t('sidebar.round')}</span>
            <span className="round-num">
            {/* The anchor owns layout; only its child moves. Keeping those layers
                separate prevents a score beat from making the tomato jump to a new
                containing-block origin when animation transforms begin. */}
            <span className="tomato-anchor">
              <span
                className={[
                  'tomato-motion',
                  !settle.active && !bonusActive && 'idle',
                  hop && !settle.active && !bonusActive && 'hop',
                ].filter(Boolean).join(' ')}
              >
                <span className="tomato-icon" key={settle.scorePop?.id ?? 'idle'} aria-hidden />
              </span>
            </span>
            <span className="round-score-value">{formatScore(round)}</span>
          </span>
        </div>
        {bonusActive ? (
          <FinalizedSentenceHeadline sentenceBonus={sentenceBonus} />
        ) : mode === 'blind' && !blind.previewHidden && currentPattern && (
          <div className="round-pattern">
            <PatternIcon pattern={currentPattern} />
            {t('sidebar.currentPattern', {
              pattern: t(`pattern.${currentPattern}`),
              score: formatScore(Math.max(0, blind.projectedScore - blind.committedScore)),
            })}
          </div>
        )}
      </div>

      <div className={[
        'panel',
        'score-panel',
        provenanceRows >= 2 && `provenance-rows-${provenanceRows}`,
      ].filter(Boolean).join(' ')}>
        {!bonusActive && (
          <StatusLine
            preview={mode === 'blind' ? preview : null}
            discoveredLetterHands={discoveredLetterHands}
          />
        )}
        <div
          className={['scorebox', (settle.active || bonusActive) && 'settling', landing && 'landing']
            .filter(Boolean)
            .join(' ')}
          role="group"
          aria-label={`${t('patternLevel.chips')} × ${t('patternLevel.mult')}`}
        >
          <span className="box c" role="img" aria-label={`${t('patternLevel.chips')}: ${chipsText}`}>
            <span className={`scorebox-value ${scoreValueClass(chipsText)}`} aria-hidden>
              {chipsText}
            </span>
            {settle.scorePop && settle.scorePop.chips !== 0 && (
              <span key={`c${settle.scorePop.id}`} className="box-pop chip">
                <span className="chip-diamond" aria-hidden />
                {settle.scorePop.chipsOp === 'mul' ? '×' : '+'}
                {settle.scorePop.chipsOp === 'mul'
                  ? fmtMult(settle.scorePop.chips)
                  : Math.round(settle.scorePop.chips)}
              </span>
            )}
          </span>
          <span className="x">×</span>
          <span className="box m" role="img" aria-label={`${t('patternLevel.mult')}: ${multText}`}>
            <span className={`scorebox-value ${scoreValueClass(multText)}`} aria-hidden>
              {multText}
            </span>
            {settle.scorePop && settle.scorePop.mult !== 0 && (
              <span key={`m${settle.scorePop.id}`} className="box-pop">
                {settle.scorePop.multOp === 'mul' ? '×' : '+'}
                {fmtMult(settle.scorePop.mult)}
              </span>
            )}
          </span>
          {landing && bonusTotal > 0 && (
            <span key="bonus-fly" className="bonus-fly">
              +{bonusTotal}
            </span>
          )}
        </div>
        {bonusActive && <SentenceBonusParts sentenceBonus={sentenceBonus!} />}
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
          <span className="cnum red">{showBlindResources ? blind.discardsLeft : 0}</span>
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
