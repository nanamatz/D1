import type { BlindState, SentenceJudgment } from '../../engine/types';
import type { Lexicon } from '../../engine/lexicon';
import { posLabel, suitClass } from '../game';
import { useI18n } from '../i18n';
import { useSettleView } from '../settle';
import { TileView } from './Tile';
import { PatternIcon } from './UiIcon';

function PatternChip({ judgment }: { judgment: SentenceJudgment }) {
  const { t } = useI18n();
  const m = judgment.match;
  const uniSuit = judgment.unison ? t(`suit.${judgment.unison.suit}`) : null;
  const p = m ? t('tray.pattern', { name: t(`pattern.${m.pattern}`) }) : t('tray.patternNone');
  const s = m
    ? uniSuit
      ? t('tray.unisonPlus', { suit: uniSuit })
      : t('tray.bonusLive')
    : uniSuit
      ? t('tray.unison', { suit: uniSuit })
      : t('tray.noPattern');
  return (
    <div className={['pattern-chip', m ? 'hit' : ''].filter(Boolean).join(' ')}>
      <div className="p">
        {m && <PatternIcon pattern={m.pattern} />}
        {p}
      </div>
      <div className="s">{s}</div>
    </div>
  );
}

interface Props {
  blind: BlindState;
  judgment: SentenceJudgment;
  lexicon: Lexicon;
}

/** The letter-hand / suit / word-length stamp that lands on the just-scored word (B step 4). */
function WordStamp() {
  const { t } = useI18n();
  const settle = useSettleView();
  if (!settle.active || !settle.stamp) return null;
  const label =
    settle.stamp.kind === 'letterHand'
      ? t(`letterhand.${settle.stamp.label}`)
      : settle.stamp.kind === 'wordLength'
        ? t(settle.stamp.label === '1' ? 'settle.wordLength.one' : 'settle.wordLength', { n: settle.stamp.label })
        : settle.stamp.kind === 'pouch'
          ? t(`pouch.${settle.stamp.label}.name`)
          : t(`suit.${settle.stamp.label}`);
  return <span className={['word-stamp', settle.stamp.kind].join(' ')}>{label}</span>;
}

/** The signature element: played words accumulating as a sentence (UI_DESIGN §2). */
export function SentenceTray({ blind, judgment, lexicon }: Props) {
  const { t } = useI18n();
  const settle = useSettleView();
  const last = blind.sequence.length - 1;
  return (
    <div className="tray">
      <div className="label">{t('tray.title')}</div>
      {blind.sequence.length === 0 && <span className="empty">{t('tray.empty')}</span>}
      {blind.sequence.map((sub, i) => {
        const settling = settle.active && i === last;
        return sub.isGibberish ? (
          <div key={i} className="hole">
            {`✷ ${t('tray.gibberish')}`}
            <span className="pos">{t('tray.hole')}</span>
            {settling && <WordStamp />}
          </div>
        ) : (
          <div
            key={i}
            className={['word', suitClass(sub.suit), sub.debuffed ? 'boss-debuffed' : '']
              .filter(Boolean)
              .join(' ')}
          >
            <span className="suit-tag">{sub.suit ? t(`suittag.${sub.suit}`) : ''}</span>
            {sub.tiles.map((tile) => <TileView key={tile.id} tile={tile} mini />)}
            <span className="pos">{posLabel(sub, lexicon, t)}</span>
            {sub.debuffed && <span className="word-not-allowed">{t('boss.notAllowed')}</span>}
            {settling && <WordStamp />}
          </div>
        );
      })}
      {blind.sequence.length > 0 && <PatternChip judgment={judgment} />}
    </div>
  );
}
