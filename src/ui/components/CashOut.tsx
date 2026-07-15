import type { BlindEarnings } from '../../engine/progression';
import { useCountUp, useReveal } from '../useAnim';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';

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
        <span key={i}>🪙</span>
      ))}
    </span>
  );
}

/** Cash Out — blind-end settlement, revealed line by line (spec §2.5, GDD §9.1). */
export function CashOut({ g }: { g: UseGame }) {
  const { t } = useI18n();
  const e: BlindEarnings | null = g.state.cashout;
  if (!e) return null;

  const lines: Line[] = [
    { key: 'cashout.reward', amount: e.reward },
    { key: 'cashout.phases', params: { n: e.phases }, amount: e.phases },
    { key: 'cashout.interest', amount: e.interest },
  ];
  if (e.thrift > 0) lines.push({ key: 'cashout.thrift', amount: e.thrift });

  const shown = useReveal(lines.length);
  const total = useCountUp(shown >= lines.length ? e.total : 0, 500);

  // A-2: overlay the darkened, still-visible board (like Game Over) — no swap.
  return (
    <div className="overlay cashout-overlay">
      <div className="overlay-card cashout" role="dialog" aria-modal>
        <div className="cashout-banner">
          <span className="label">{t('cashout.title')}</span>
          <span className="cashout-total">${Math.round(total)}</span>
        </div>

        <div className="cashout-lines">
          {lines.map((line, i) => (
            <div key={line.key} className={['cashout-line', i < shown && 'in'].filter(Boolean).join(' ')}>
              <span className="desc">{t(line.key, line.params)}</span>
              <span className="amt">
                <Coins n={line.amount} />
                <b>${line.amount}</b>
              </span>
            </div>
          ))}
        </div>

        <button className="btn cash big" onClick={g.confirmCashout} autoFocus>
          {t('cashout.confirm')}
        </button>
      </div>
    </div>
  );
}
