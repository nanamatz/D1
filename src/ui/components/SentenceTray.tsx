import type { BlindState, SentenceJudgment } from '../../engine/types';
import type { Lexicon } from '../../engine/lexicon';
import { posLabel, SUIT_TAG, suitClass } from '../game';
import { useI18n } from '../i18n';
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

/** The signature element: played words accumulating as a sentence (UI_DESIGN §2). */
export function SentenceTray({ blind, judgment, lexicon }: Props) {
  const { t } = useI18n();
  return (
    <div className="panel tray">
      <div className="label">{t('tray.title')}</div>
      {blind.sequence.length === 0 && <span className="empty">{t('tray.empty')}</span>}
      {blind.sequence.map((sub, i) =>
        sub.isGibberish ? (
          <div key={i} className="hole">
            {`✷ ${t('tray.gibberish')}`}
            <span className="pos">{t('tray.hole')}</span>
          </div>
        ) : (
          <div key={i} className={['word', suitClass(sub.suit)].join(' ')}>
            <span className="suit-tag">{sub.suit ? SUIT_TAG[sub.suit] : ''}</span>
            {sub.tiles.map((t) => (
              <TileView key={t.id} tile={t} mini />
            ))}
            <span className="pos">{posLabel(sub, lexicon)}</span>
          </div>
        ),
      )}
      {blind.sequence.length > 0 && <PatternChip judgment={judgment} />}
    </div>
  );
}
