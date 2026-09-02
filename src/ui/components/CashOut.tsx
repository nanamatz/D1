import { useEffect, useRef } from 'react';
import type { BlindEarnings } from '../../engine/progression';
import type { LetterHandId } from '../../engine/types';
import { pouchDisablesInterest } from '../../engine/pouches';
import { recordDisablesInterest } from '../../engine/records';
import { useCountUp, useReveal } from '../useAnim';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import { isLetterHandDiscovered } from '../lifetime';
import type { UseGame } from '../useGame';
import proofStampArt from '../assets/icons/ui/proof-stamp.png';
import { UiIcon } from './UiIcon';
import { formatScore } from '../formatScore';

interface Line {
  key: string;
  params?: Record<string, string | number>;
  amount: number;
}

/** A row of coin glyphs for a gold amount, capped so big payouts stay tidy. */
function Coins({ n }: { n: number }) {
  if (n <= 0) return null;
  const count = Math.min(n, 8);
  return (
    <span className="coins" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <UiIcon key={i} name="coin" className="coin-icon" />
      ))}
    </span>
  );
}

/** Cash Out — blind-end settlement, revealed line by line (spec §2.5, GDD §9.1). */
export function CashOut({
  g,
  discoveredLetterHands,
}: {
  g: UseGame;
  discoveredLetterHands: ReadonlySet<LetterHandId>;
}) {
  const { t } = useI18n();
  const e: BlindEarnings | null = g.state.cashout;
  if (!e) return null;

  const noInterest =
    pouchDisablesInterest(g.state.run) || recordDisablesInterest(g.state.run);
  const lines: Line[] = [
    { key: 'cashout.reward', amount: e.reward - e.tagReward },
    ...(e.tagReward > 0 ? [{ key: 'cashout.tagReward', amount: e.tagReward }] : []),
    { key: 'cashout.phases', params: { n: e.phaseCount }, amount: e.phases },
    ...(g.state.run.pouchId === 'purple'
      ? [{ key: 'cashout.discards', params: { n: e.discardCount }, amount: e.discards }]
      : []),
    { key: noInterest ? 'cashout.noInterest' : 'cashout.interest', amount: e.interest },
  ];
  const mastery = e.letterHandReward;

  const shown = useReveal(lines.length + (mastery ? 1 : 0));
  const total = useCountUp(shown >= lines.length ? e.total : 0, 500);
  const masteryShown = !!mastery && shown > lines.length;
  const leveledUp = !!mastery && mastery.toLevel > mastery.fromLevel;

  // Each payout line lands with the rising coin voice used by real gold gains,
  // so the Fee Settlement presentation is audibly monetary too.
  const lastShown = useRef(0);
  useEffect(() => {
    if (shown > lastShown.current && shown <= lines.length) {
      audio.play('coinGain', { step: (shown - 1) * 3 });
      lastShown.current = shown;
    }
  }, [shown, lines.length]);

  const stamped = useRef(false);
  useEffect(() => {
    if (!masteryShown) {
      stamped.current = false;
      return;
    }
    if (stamped.current) return;
    stamped.current = true;
    audio.play('stamp');
    if (!leveledUp) return;
    const timer = window.setTimeout(() => audio.play('multFill'), 360);
    return () => window.clearTimeout(timer);
  }, [masteryShown, leveledUp]);

  // A-2: overlay the darkened, still-visible board (like Game Over) — no swap.
  return (
    <div className="overlay cashout-overlay">
      <div className="overlay-card cashout" role="dialog" aria-modal>
        <div className="cashout-banner">
          <span className="label">{t('cashout.title')}</span>
          <span className="cashout-total">${formatScore(total)}</span>
        </div>

        <div className="cashout-lines">
          {lines.map((line, i) => (
            <div key={line.key} className={['cashout-line', i < shown && 'in'].filter(Boolean).join(' ')}>
              <span className="desc">{t(line.key, line.params)}</span>
              <span className="amt">
                <Coins n={line.amount} />
                <b>${formatScore(line.amount)}</b>
              </span>
            </div>
          ))}
          {mastery && (
            <div
              className={[
                'cashout-mastery',
                masteryShown && 'in',
              ].filter(Boolean).join(' ')}
              aria-label={t('cashout.proofStamp', {
                hand: isLetterHandDiscovered(mastery.hand, discoveredLetterHands)
                  ? t(`letterhand.${mastery.hand}`)
                  : '???',
              })}
            >
              <div className="cashout-proof-stage">
                <span className="cashout-proof-mark">
                  {isLetterHandDiscovered(mastery.hand, discoveredLetterHands)
                    ? t(`letterhand.${mastery.hand}`)
                    : '???'}
                  <span className="cashout-proof-pips" aria-hidden>
                    {Array.from({ length: Math.min(mastery.stamps, 8) }, (_, i) => (
                      <i key={i} />
                    ))}
                  </span>
                </span>
                <img className="cashout-proof-stamp" src={proofStampArt} alt="" aria-hidden />
              </div>
              {leveledUp && <div className="cashout-level-up">{t('cashout.levelUp')}</div>}
            </div>
          )}
        </div>

        <button
          className="btn cash big"
          onClick={g.confirmCashout}
          autoFocus
        >
          {t('cashout.confirm')}
        </button>
      </div>
    </div>
  );
}
