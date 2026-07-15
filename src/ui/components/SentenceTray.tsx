import type { BlindState, SentenceJudgment } from '../../engine/types';
import type { Lexicon } from '../../engine/lexicon';
import { posLabel, SUIT_TAG, suitClass } from '../game';
import { useI18n } from '../i18n';
import { useSettleView } from '../settle';
import { TileView } from './Tile';

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
      <div className="p">{p}</div>
      <div className="s">{s}</div>
    </div>
  );
}

interface Props {
  blind: BlindState;
  judgment: SentenceJudgment;
  lexicon: Lexicon;
}

/** The letter-hand / suit stamp that lands on the just-scored word (B step 4). */
function WordStamp() {
  const { t } = useI18n();
  const settle = useSettleView();
  if (!settle.active || !settle.stamp) return null;
  const label =
    settle.stamp.kind === 'letterHand'
      ? t(`letterhand.${settle.stamp.label}`)
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
          <div key={i} className={['word', suitClass(sub.suit)].join(' ')}>
            <span className="suit-tag">{sub.suit ? SUIT_TAG[sub.suit] : ''}</span>
            {sub.tiles.map((tile) => {
              const pop = settling ? settle.tilePops[tile.id] : undefined;
              return (
                <span key={tile.id} className="tile-pop-wrap">
                  <TileView tile={tile} mini />
                  {pop !== undefined && (
                    <span
                      className={['tile-pop', settle.activeTileId === tile.id ? 'live' : ''].filter(Boolean).join(' ')}
                    >
                      +{pop}
                    </span>
                  )}
                </span>
              );
            })}
            <span className="pos">{posLabel(sub, lexicon)}</span>
            {settling && <WordStamp />}
          </div>
        );
      })}
      {blind.sequence.length > 0 && <PatternChip judgment={judgment} />}
    </div>
  );
}
