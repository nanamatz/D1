import { useEffect, useState } from 'react';
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
import { ScreenTransition } from './ScreenTransition';

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

  // ESC in-round: close the Run Info window if it's open, otherwise toggle the
  // options/pause menu (playtest-06 #1, #2). Run Info takes priority so ESC peels
  // one layer at a time rather than jumping straight to pause.
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Never steal ESC from a text field (e.g. the collection's search box).
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) {
        return;
      }
      if (showInfo) setShowInfo(false);
      else setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, showInfo]);

  // 'playing', 'gameover' and 'cashout' share the board — Game Over and Fee
  // Settlement overlay the still-visible (darkened) board, no full-screen swap
  // (A-2, A-4). The run stays frozen on the cleared blind during cash-out.
  const ending = phase === 'gameover';
  const settling = phase === 'cashout';
  // Remount the board each blind (key on the blind's identity) so no score/settle
  // remnants carry over (B-1).
  const boardKey = `${run.ante}-${run.blindIndex}`;
  // B (playtest-05): one shared transition drives every in-run screen swap
  // (blindselect → board → shop → next blind). 'cashout'/'gameover' keep the
  // BOARD's key on purpose — they overlay the still-visible board rather than
  // swapping screens (A-2/A-4), so no slide plays for them.
  const screenKey =
    phase === 'blindselect'
      ? `blindselect-${boardKey}`
      : phase === 'shop'
        ? `shop-${boardKey}`
        : `board-${boardKey}`;

  const content = () => {
    if (phase === 'blindselect') return <BlindSelect g={g} />;
    if (phase === 'shop') {
      return (
        <div className="frame shop-frame">
          {g.state.pack ? <PackOpening g={g} /> : <Shop g={g} />}
        </div>
      );
    }
    const preview = stagePreview(blind, g.lexicon, selected);
    const judgment = judgeSentence(blind.sequence, g.lexicon);
    // `ending` reddens the board — that is the DEFEAT visual, so it is Game Over
    // ONLY. Clearing a blind must never turn the board red; Fee Settlement darkens
    // it on its own via .overlay.cashout-overlay, keeping the board visible (A-2).
    return (
    <div
      key={boardKey}
      className={['frame', ending && 'ending', pouchOpen && 'pouch-open']
        .filter(Boolean)
        .join(' ')}
    >
      <SettleProvider
        events={g.state.lastEvents}
        settleId={g.state.settleId}
        speed={settings.gameSpeed}
        onComplete={g.markSettleComplete}
      >
        <Sidebar
          run={run}
          blind={blind}
          committedBefore={g.state.committedBefore}
          finalScore={g.state.finalScore}
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
      {g.state.pendingEnd && g.state.settleComplete && !ending && (
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
        // A modal over the board, not a screen swap — the board stays visible
        // behind it, like Fee Settlement and Game Over (playtest-06 #1).
        <div className="overlay pause-overlay">
          <div className="overlay-card pause-modal">
            {/* Main Menu keeps the run in memory (useGame lives in App, so
                leaving the run view doesn't discard it). */}
            <Options
              lexicon={g.lexicon}
              onBack={() => setPaused(false)}
              onNewRun={onNewRun}
              onMainMenu={onExit}
            />
          </div>
        </div>
      )}
      {settling && <CashOut g={g} />}
      {ending && <GameOver g={g} onNewRun={onNewRun} onMainMenu={onExit} />}
    </div>
    );
  };

  return <ScreenTransition screenKey={screenKey}>{content()}</ScreenTransition>;
}
