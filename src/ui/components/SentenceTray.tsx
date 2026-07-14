import type { BlindState, SentenceJudgment } from '../../engine/types';
import type { Lexicon } from '../../engine/lexicon';
import { patternLabel, posLabel, SUIT_TAG, suitClass } from '../game';
import { TileView } from './Tile';

function PatternChip({ judgment }: { judgment: SentenceJudgment }) {
  const m = judgment.match;
  const uni = judgment.unison ? `Unison (${judgment.unison.suit})` : null;
  const p = m ? `Pattern: ${patternLabel(m.pattern)}` : 'Pattern: —';
  const s = m ? (uni ? `+ ${uni}` : 'sentence bonus live') : (uni ?? 'no pattern yet');
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
  return (
    <div className="panel tray">
      <div className="label">Sentence</div>
      {blind.sequence.length === 0 && (
        <span className="empty">No words yet — play a word to begin the sentence.</span>
      )}
      {blind.sequence.map((sub, i) =>
        sub.isGibberish ? (
          <div key={i} className="hole">
            ✷ gibberish
            <span className="pos">hole · voids patterns</span>
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
