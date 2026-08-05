import { useRef } from 'react';
import {
  submissionSuits,
  type BlindState,
  type PatternId,
  type SentenceJudgment,
  type WordSubmission,
} from '../../engine/types';
import type { Lexicon } from '../../engine/lexicon';
import { posLabel, suitClass, tileTooltip } from '../game';
import { useI18n } from '../i18n';
import { useSettleView } from '../settle';
import { TileView } from './Tile';
import { PatternIcon } from './UiIcon';
import { patternLevelClass } from '../patternLevel';
import { Tooltip } from './Tooltip';

function PatternChip({
  judgment,
  patternLevels,
}: {
  judgment: SentenceJudgment;
  patternLevels: Record<PatternId, number>;
}) {
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
    <div className={[
      'pattern-chip',
      m ? 'hit' : '',
      m ? patternLevelClass(patternLevels[m.pattern]) : '',
    ].filter(Boolean).join(' ')}>
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
  patternLevels: Record<PatternId, number>;
}

/** The Word-Hand / suit / word-length stamp that lands on the just-scored word (B step 4). */
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

function SubmittedWord({
  sub,
  settling,
  lexicon,
}: {
  sub: WordSubmission;
  settling: boolean;
  lexicon: Lexicon;
}) {
  const { t } = useI18n();
  const settle = useSettleView();
  const ref = useRef<HTMLDivElement>(null);
  const suits = submissionSuits(sub);
  const suitTags = suits.length > 0 && (
    <span className="suit-tags">
      {suits.map((suit) => (
        <span key={suit} className={`suit-tag ${suit}`}>{t(`suittag.${suit}`)}</span>
      ))}
    </span>
  );
  const tiles = (
    <span className="submitted-tiles">
      {sub.tiles.map((tile) => {
        const wasDestroyed = sub.destroyedTileIds?.includes(tile.id) ?? false;
        const destructionHasLanded = !settling || settle.destroyedTileIds.includes(tile.id);
        return (
          <TileView
            key={tile.id}
            tile={tile}
            mini
            inspectable
            destroyed={wasDestroyed && destructionHasLanded}
            tooltip={tileTooltip(tile, t)}
          />
        );
      })}
    </span>
  );
  const content = sub.isGibberish ? (
    <div ref={ref} className={['hole', sub.debuffed ? 'boss-debuffed' : ''].filter(Boolean).join(' ')}>
      {suitTags}
      {tiles}
      <span className="gibberish-tag">{t('tray.gibberish')}</span>
      <span className="pos">{t('tray.hole')}</span>
      {sub.debuffed && <span className="word-not-allowed">{t('boss.notAllowed')}</span>}
      {settling && <WordStamp />}
    </div>
  ) : (
    <div
      ref={ref}
      className={['word', suitClass(sub.suit), sub.debuffed ? 'boss-debuffed' : '']
        .filter(Boolean)
        .join(' ')}
    >
      {suitTags}
      {tiles}
      <span className="pos">{posLabel(sub, lexicon, t)}</span>
      {sub.debuffed && <span className="word-not-allowed">{t('boss.notAllowed')}</span>}
      {settling && <WordStamp />}
    </div>
  );
  return (
    <>
      {content}
      {sub.debuffed && (
        <Tooltip
          anchorRef={ref}
          title={sub.text.toUpperCase() || t('tray.gibberish')}
          body={t('tooltip.debuffedWord')}
          status="debuffed"
          compact
        />
      )}
    </>
  );
}

/** The signature element: played words accumulating as a sentence (UI_DESIGN §2). */
export function SentenceTray({ blind, judgment, lexicon, patternLevels }: Props) {
  const { t } = useI18n();
  const settle = useSettleView();
  const last = blind.sequence.length - 1;
  return (
    <div className="tray">
      <div className="label">{t('tray.title')}</div>
      {blind.sequence.length === 0 && <span className="empty">{t('tray.empty')}</span>}
      {blind.sequence.map((sub, i) => (
        <SubmittedWord
          key={`${sub.text}-${i}`}
          sub={sub}
          settling={settle.active && i === last}
          lexicon={lexicon}
        />
      ))}
      {blind.sequence.length > 0 && (
        <PatternChip judgment={judgment} patternLevels={patternLevels} />
      )}
    </div>
  );
}
