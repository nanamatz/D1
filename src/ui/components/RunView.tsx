import { useState } from 'react';
import { judgeSentence } from '../../engine/patterns';
import { stagePreview } from '../game';
import type { UseGame } from '../useGame';
import { useI18n } from '../i18n';
import { useSettings } from '../settings';
import { SettleProvider } from '../settle';
import { Sidebar } from './Sidebar';
import { JokerShelf } from './JokerShelf';
import { SentenceTray } from './SentenceTray';
import { StagePanel } from './StagePanel';
import { Shop } from './Shop';
import { PackOpening } from './PackOpening';
import { CashOut } from './CashOut';
import { BlindSelect } from './BlindSelect';
import { GameOver } from './GameOver';
import { BagWidget } from './BagView';
import { RunInfo } from './RunInfo';
import { Options } from './Options';

interface Props {
  g: UseGame;
  /** back to the main menu (Game Over / quit) */
  onExit: () => void;
  /** start-a-new-run flow (Game Over → New Run) */
  onNewRun: () => void;
}

/** An active run: routes the in-run phases (spec §2.3–2.7). */
export function RunView({ g, onExit, onNewRun }: Props) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const { blind, run, selected, phase } = g.state;
  const [showInfo, setShowInfo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pouchOpen, setPouchOpen] = useState(false);

  if (phase === 'blindselect') return <BlindSelect g={g} />;
  if (phase === 'shop') {
    return (
      <div className="frame shop-frame wipe-in">
        {g.state.pack ? <PackOpening g={g} /> : <Shop g={g} />}
      </div>
    );
  }

  // 'playing', 'gameover' and 'cashout' share the board — Game Over and Fee
  // Settlement overlay the still-visible (darkened) board, no full-screen swap
  // (A-2, A-4). The run stays frozen on the cleared blind during cash-out.
  const ending = phase === 'gameover';
  const settling = phase === 'cashout';
  const preview = stagePreview(blind, g.lexicon, selected);
  const judgment = judgeSentence(blind.sequence, g.lexicon);
  // Remount the board each blind (key on the blind's identity) so no score/settle
  // remnants carry over, and the fresh mount plays the transition animation (D-3).
  const boardKey = `${run.ante}-${run.blindIndex}`;

  return (
    <div
      key={boardKey}
      className={['frame', 'wipe-in', (ending || settling) && 'ending', pouchOpen && 'pouch-open']
        .filter(Boolean)
        .join(' ')}
    >
      <SettleProvider events={g.state.lastEvents} settleId={g.state.settleId} speed={settings.gameSpeed}>
        <Sidebar
          run={run}
          blind={blind}
          committedBefore={g.state.committedBefore}
          preview={preview}
          onOpenInfo={() => setShowInfo(true)}
          onOpenOptions={() => setPaused(true)}
        />
        <main className="main">
          <JokerShelf
            run={run}
            onUseConsumable={() => g.useMagnifier()}
            onSellConsumable={g.sellConsumable}
          />
          <SentenceTray blind={blind} judgment={judgment} lexicon={g.lexicon} />
          <StagePanel g={g} preview={preview} />
        </main>
      </SettleProvider>
      {g.state.pendingEnd && !ending && (
        <div className="verdict">
          <div className="verdict-score">
            ❄ {Math.round(blind.projectedScore)} / {blind.target}
          </div>
          {blind.projectedScore >= blind.target && (
            <div className="verdict-cleared">
              {t('verdict.cleared')}
              {judgment.match ? ` · ${t(`pattern.${judgment.match.pattern}`)}` : ''}
            </div>
          )}
        </div>
      )}
      {!ending && !settling && (
        <BagWidget run={run} blind={blind} onOpenChange={setPouchOpen} />
      )}
      {!ending && !settling && showInfo && (
        <RunInfo run={run} blind={blind} onClose={() => setShowInfo(false)} />
      )}
      {!ending && !settling && paused && (
        <div className="pause-screen">
          <Options lexicon={g.lexicon} onBack={() => setPaused(false)} />
        </div>
      )}
      {settling && <CashOut g={g} />}
      {ending && <GameOver g={g} onNewRun={onNewRun} onMainMenu={onExit} />}
    </div>
  );
}
