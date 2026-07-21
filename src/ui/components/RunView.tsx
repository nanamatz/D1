import { useEffect, useState } from 'react';
import { judgeSentence } from '../../engine/patterns';
import { stagePreview } from '../game';
import type { UseGame } from '../useGame';
import { useSettings } from '../settings';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { tutorialBus, hasSeenIntro, TUTORIAL_WORD } from '../tutorial';
import { readTips } from '../settings';
import { SettleProvider } from '../settle';
import { Sidebar } from './Sidebar';
import { JokerShelf } from './JokerShelf';
import { SentenceTray } from './SentenceTray';
import { StagePanel } from './StagePanel';
import { Shop } from './Shop';
import { CashOut } from './CashOut';
import { BlindSelect } from './BlindSelect';
import { GameOver } from './GameOver';
import { BagWidget } from './BagView';
import { RunInfo } from './RunInfo';
import { Options } from './Options';
import { ScreenTransition } from './ScreenTransition';
import { GuidedIntro } from './GuidedIntro';

interface Props {
  g: UseGame;
  /** back to the main menu (Game Over / quit) */
  onExit: () => void;
  /** start-a-new-run flow (Game Over → New Run) */
  onNewRun: () => void;
}

/** An active run: routes the in-run phases (spec §2.3–2.7). */
export function RunView({ g, onExit, onNewRun }: Props) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const { blind, run, selected, phase } = g.state;
  const [showInfo, setShowInfo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pouchOpen, setPouchOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

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

  // Guided first-run lesson: opens once, on entry into the playing board — but ONLY for a run
  // that bootstrapped as the tutorial (showIntro), so its hand is rigged for the YELLOW lock.
  // `!hasSeenIntro()` is the once-guard (finishing the intro marks it seen). Replaying (Help)
  // clears the seen-flag, but a rigged hand only comes from a fresh run, so replay = New Run.
  useEffect(() => {
    if (phase === 'playing' && g.state.showIntro && !hasSeenIntro() && readTips()) setIntroOpen(true);
  }, [phase, g.state.showIntro]);

  // Mascot beat on shop enter + blind-resolution stings (B-1 settle-set:
  // clearFanfare / failSting), keyed purely on phase transitions.
  useEffect(() => {
    if (phase === 'shop') {
      audio.play('catMeow');
      tutorialBus.fire('shopFirstVisit');
    }
    else if (phase === 'cashout') audio.play('clearFanfare');
    else if (phase === 'gameover') audio.play('failSting');
  }, [phase]);

  // First-encounter tutorials for jokers/consumables/boss blinds: fire once per
  // blind entry (phase transitions to 'playing'), not mid-blind when jokers or
  // consumables change. The bus no-ops on already-seen/tips-off, so a repeat
  // fire on re-entry is harmless.
  useEffect(() => {
    if (phase !== 'playing') return;
    // fire once per blind entry; run/blind read intentionally without being deps
    if (run.jokers.length > 0) tutorialBus.fire('firstJoker');
    if (run.consumables.length > 0) tutorialBus.fire('firstConsumable');
    if (blind.kind === 'boss') tutorialBus.fire('firstBoss');
  }, [phase]);

  // A-2 first-encounter tutorials driven by LIVE board state (material/font tiles
  // in hand, a pattern or Unison lighting up in the tray, owning the Magnifier).
  // The bus no-ops on already-seen/tips-off, so re-firing when a condition stays
  // true is harmless; we fire the moment each condition first becomes true.
  const judgment = judgeSentence(blind.sequence, g.lexicon);
  const hasMaterialTile = blind.hand.some((t) => t.material !== 'ceramic');
  const hasFontTile = blind.hand.some((t) => t.font !== 'medium');
  const hasPattern = judgment.match !== null;
  const hasUnison = judgment.unison !== null;
  const hasMagnifier = run.consumables.includes('magnifier');
  useEffect(() => {
    if (phase !== 'playing') return;
    if (hasMaterialTile) tutorialBus.fire('firstMaterial');
    if (hasFontTile) tutorialBus.fire('firstFont');
    if (hasPattern) tutorialBus.fire('firstPattern');
    if (hasUnison) tutorialBus.fire('firstUnison');
    if (hasMagnifier) tutorialBus.fire('magnifier');
  }, [phase, hasMaterialTile, hasFontTile, hasPattern, hasUnison, hasMagnifier]);

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
      // item 7: the pack-opening modal is rendered inside Shop, over the sale region
      // only, so the joker/consumable shelf stays visible and sellable.
      return (
        <div className="frame shop-frame">
          <Shop g={g} />
        </div>
      );
    }
    const preview = stagePreview(blind, run, g.lexicon, selected, t);
    // `judgment` is computed once in the component body (drives the A-2 fires too)
    // `ending` reddens the board — that is the DEFEAT visual, so it is Game Over
    // ONLY. Clearing a blind must never turn the board red; Fee Settlement darkens
    // it on its own via .overlay.cashout-overlay, keeping the board visible (A-2).
    return (
    <div
      key={boardKey}
      className={[
        'frame',
        // D-6: per-stage backdrop (초고 Draft / 퇴고 Revision / 마감 Deadline).
        `stage-${blind.kind === 'small' ? 'draft' : blind.kind === 'big' ? 'revision' : 'deadline'}`,
        ending && 'ending',
        pouchOpen && 'pouch-open',
      ]
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
          settleComplete={g.state.settleComplete}
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
            onSellJoker={g.sell}
            onReorderJoker={g.reorderJokers}
          />
          <SentenceTray blind={blind} judgment={judgment} lexicon={g.lexicon} />
          {/* Lesson lock: while the guided intro is open (first tutorial blind) the board is
              hard-locked to spelling YELLOW. Skipping the intro releases it. */}
          <StagePanel g={g} preview={preview} {...(introOpen ? { lockWord: TUTORIAL_WORD } : {})} />
        </main>
      </SettleProvider>
      {/* item 4: the intermediate "Cleared! + Settle" screen is gone — the blind
          auto-resolves to the Fee Settlement modal after the score lands (useGame). */}
      {!ending && !settling && (
        <BagWidget run={run} blind={blind} onOpenChange={setPouchOpen} />
      )}
      {!ending && !settling && introOpen && (
        <GuidedIntro g={g} onClose={() => setIntroOpen(false)} />
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
