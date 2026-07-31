import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { GuidedIntro } from './GuidedIntro';
import { DeskObjects } from './DeskObjects';
import { PackOpening } from './PackOpening';
import { BossIntro } from './BossIntro';
import { canUseFableOnPouch, fableTargetsTiles, isFableId } from '../../engine/fables';

interface Props {
  g: UseGame;
  /** back to the main menu (Game Over / quit) */
  onExit: () => void;
  /** start-a-new-run flow (Game Over → New Run) */
  onNewRun: () => void;
}

const NOT_ALLOWED_NOTICE_MS = 1700;

/** An active run: routes the in-run phases (spec §2.3–2.7). */
export function RunView({ g, onExit, onNewRun }: Props) {
  const lexicon = g.getLexicon();
  const { settings } = useSettings();
  const { t } = useI18n();
  const { blind, run, selected, phase } = g.state;
  const [showInfo, setShowInfo] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pouchOpen, setPouchOpen] = useState(false);
  const [packCandidateIds, setPackCandidateIds] = useState<string[]>([]);
  const [introOpen, setIntroOpen] = useState(false);
  const noticeSequence = useRef(0);
  const [notAllowedNotice, setNotAllowedNotice] = useState<number | null>(null);
  const fablePackOpen = phase === 'shop' && g.state.pack?.offer.type === 'consumable';

  useEffect(() => {
    if (!g.state.pack) setPackCandidateIds([]);
  }, [g.state.pack]);

  // A boss-debuffed submission is allowed, but its warning is a transient
  // workspace announcement rather than persistent game-state copy. The message
  // object is recreated for every submission, so consecutive invalid plays
  // restart both the animation and dismissal timer.
  useEffect(() => {
    if (g.state.message?.key !== 'boss.notAllowed') {
      setNotAllowedNotice(null);
      return;
    }
    noticeSequence.current += 1;
    setNotAllowedNotice(noticeSequence.current);
    const timer = window.setTimeout(() => setNotAllowedNotice(null), NOT_ALLOWED_NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [g.state.message]);

  // ESC in-round: close the Run Info window if it's open, otherwise toggle the
  // options/pause menu (playtest-06 #1, #2). Run Info takes priority so ESC peels
  // one layer at a time rather than jumping straight to pause. Enabled on the
  // board AND on the Shop / Blind Select screens so the player can reach the
  // options menu (→ Main Menu) from there; cashout/gameover have their own UI.
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'shop' && phase !== 'blindselect') return;
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

  // feature-04 A-1 · money is never silent. One central watcher on run.gold plays a
  // rising coin on gain, a falling one on loss — so EVERY gold change sounds, wherever
  // it happens (purchase, sell, reroll, pack buy, Fee Settlement, interest, the goldPlay
  // font, Ivory/Brass/Lead-plate payouts, Bond drains) without bolting a call onto each
  // site. The explicit button dings (purchase/sell/reroll) still fire as confirmations.
  const prevGold = useRef(run.gold);
  useEffect(() => {
    if (run.gold !== prevGold.current) {
      audio.money(run.gold - prevGold.current);
      prevGold.current = run.gold;
    }
  }, [run.gold]);

  // Screen/panel navigation always has an audible transition, then the destination
  // may layer its own semantic sting (shop mascot, clear, or game over).
  const previousPhase = useRef(phase);
  useEffect(() => {
    if (previousPhase.current !== phase) audio.play('transitionWhoosh');
    previousPhase.current = phase;
  }, [phase]);

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
  const judgment = judgeSentence(blind.sequence, lexicon);
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

  // Balatro-style persistent table: the sidebar, owned shelves and pouch never
  // swap screens. Only the work surface below them changes phase.
  const ending = phase === 'gameover';
  const settling = phase === 'cashout';
  const boardKey = `${run.ante}-${run.blindIndex}`;
  const preview =
    phase === 'playing' ? stagePreview(blind, run, lexicon, selected, t) : null;
  const sidebarMode =
    phase === 'shop' ? 'shop' : phase === 'blindselect' ? 'blindselect' : 'blind';
  const boardVisible = phase === 'playing' || settling || ending;

  return (
    <>
      <div
        key={boardKey}
        className={[
          'frame',
          'persistent-run',
          `phase-${phase}`,
          `stage-${blind.kind === 'small' ? 'draft' : blind.kind === 'big' ? 'revision' : 'deadline'}`,
          ending && 'ending',
          pouchOpen && 'pouch-open',
        ].filter(Boolean).join(' ')}
      >
      <SettleProvider
        events={g.state.lastEvents}
        settleId={g.state.settleId}
        speed={settings.gameSpeed}
        screenShake={settings.screenshake}
        onComplete={g.markSettleComplete}
      >
        <Sidebar
          run={run}
          blind={blind}
          committedBefore={g.state.committedBefore}
          settleComplete={g.state.settleComplete}
          finalScore={g.state.finalScore}
          sentenceBonus={g.state.sentenceBonus}
          preview={preview}
          onOpenInfo={() => setShowInfo(true)}
          onOpenOptions={() => setPaused(true)}
          mode={sidebarMode}
        />
        <main className="main">
          <JokerShelf
            run={run}
            onUseConsumable={(id) => {
              if (fablePackOpen && isFableId(id) && fableTargetsTiles(id)) {
                g.useHeldPackFable(id, packCandidateIds);
              } else {
                g.useConsumable(id);
              }
            }}
            canUseConsumable={(id) =>
              fablePackOpen && isFableId(id) && fableTargetsTiles(id)
                ? canUseFableOnPouch(id, run, packCandidateIds)
                : g.canUseConsumable(id)}
            deferTargetFableUse={fablePackOpen}
            onSellConsumable={g.sellConsumable}
            onSellJoker={g.sell}
            onReorderJoker={g.reorderJokers}
            jokersFaceDown={!!blind.jokersFaceDown}
          />
          <section className="phase-workspace">
            {notAllowedNotice !== null && (
              <div
                key={notAllowedNotice}
                className="workspace-not-allowed"
                role="status"
                aria-live="assertive"
              >
                {t('boss.notAllowed')}
              </div>
            )}
            {boardVisible && (
              <div className="blind-workspace">
                <SentenceTray blind={blind} judgment={judgment} lexicon={lexicon} />
                <StagePanel
                  g={g}
                  preview={preview}
                  {...(introOpen ? { lockWord: TUTORIAL_WORD } : {})}
                />
              </div>
            )}
            {phase === 'shop' && (
              g.state.pack
                ? (
                    <div className="phase-panel pack-phase-panel">
                      <PackOpening
                        g={g}
                        selectedCandidates={packCandidateIds}
                        onSelectedCandidatesChange={setPackCandidateIds}
                      />
                    </div>
                  )
                : <div className="phase-panel shop-phase-panel"><Shop g={g} /></div>
            )}
            {phase === 'blindselect' && (
              <div className="phase-panel blindselect-phase-panel"><BlindSelect g={g} /></div>
            )}
            {/* Deadline reveal is centred on the work surface, not the full frame:
                the persistent sidebar is excluded from its positioning box. */}
            {!ending && !settling && !introOpen && phase === 'playing' && blind.kind === 'boss' && (
              <BossIntro blind={blind} />
            )}
          </section>
        </main>
      </SettleProvider>
      {!ending && (
        <BagWidget run={run} blind={blind} onOpenChange={setPouchOpen} />
      )}
      {!ending && !settling && introOpen && (
        <GuidedIntro g={g} onClose={() => setIntroOpen(false)} />
      )}
      {!ending && !settling && showInfo && (
        <RunInfo run={run} blind={blind} onClose={() => setShowInfo(false)} />
      )}
      {ending && <GameOver g={g} onNewRun={onNewRun} onMainMenu={onExit} />}
      </div>
      {/* Viewport-centred overlays live outside `.frame`: the persistent board
          owns a left rail and may carry a filter/zoom containing block, neither
          of which should offset a modal from the physical screen centre. */}
      {settling && <CashOut g={g} />}
      {/* D-3 · ambient desk objects in the viewport margins — cosmetic, only while
          actively playing (not during the guided intro or a pause menu). */}
      <DeskObjects active={phase === 'playing' && !introOpen && !paused} />
      {(phase === 'playing' || phase === 'shop' || phase === 'blindselect') && paused && createPortal((
        <div className="overlay pause-overlay">
          <div className="overlay-card pause-modal">
            <Options
              lexicon={lexicon}
              onBack={() => setPaused(false)}
              onNewRun={onNewRun}
              onMainMenu={onExit}
            />
          </div>
        </div>
      ), document.body)}
    </>
  );
}
