import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { UseGame } from '../useGame';
import { useI18n } from '../i18n';
import { usePrefersReducedMotion } from '../motion';
import { useSettings } from '../settings';
import { hasSeenIntro } from '../tutorial';
import {
  activeUnlocks,
  PRESENTATION_CHANGED_EVENT,
  REQUIRED_PALETTE_UNLOCKS,
  type UnlockDef,
} from '../unlocks';

const HOLD_MS = 6000;
const ENTER_MS = 240;
const EXIT_MS = 180;
const MODAL_SELECTOR = '.overlay, [role="dialog"], .boss-intro';

export interface PaletteGuideSessionState {
  observationId: string;
  ante: number;
  visit: number;
  handledVisits: Set<number>;
}

const paletteGuideSeen = new Set<string>();
let currentPaletteGuideSession: PaletteGuideSessionState | null = null;

/** Keep only the current run's visit tracker while preserving app-session hint rotation. */
export function paletteGuideSessionFor(
  current: PaletteGuideSessionState | null,
  observationId: string,
  ante: number,
): PaletteGuideSessionState {
  if (!current || current.observationId !== observationId) {
    return { observationId, ante, visit: 0, handledVisits: new Set<number>() };
  }
  syncPaletteGuideVisit(current, ante);
  return current;
}

/** Increment only when the displayed Chapter number changes, including a later revisit. */
export function syncPaletteGuideVisit(
  session: PaletteGuideSessionState,
  ante: number,
): number {
  if (session.ante !== ante) {
    session.ante = ante;
    session.visit += 1;
  }
  return session.visit;
}

export function paletteGuideSettleDecision(input: {
  alreadyHandled: boolean;
  phase: string;
  pendingEnd: boolean;
  unlockedRequired: boolean;
}): 'ignore' | 'skip' | 'queue' {
  if (input.alreadyHandled) return 'ignore';
  return input.phase !== 'playing' || input.pendingEnd || input.unlockedRequired
    ? 'skip'
    : 'queue';
}

export function canShowPaletteGuide(input: {
  sameVisit: boolean;
  tips: boolean;
  introSeen: boolean;
  phase: string;
  settleComplete: boolean;
  pendingEnd: boolean;
  blindEntryEffects: boolean;
  blocked: boolean;
}): boolean {
  return input.sameVisit && input.tips && input.introSeen && input.phase === 'playing' &&
    input.settleComplete && !input.pendingEnd && !input.blindEntryEffects && !input.blocked;
}

export function nextPaletteGuide(
  active: ReadonlySet<string>,
  seen: Set<string>,
): UnlockDef | null {
  const locked = REQUIRED_PALETTE_UNLOCKS.filter((def) => !active.has(def.id));
  if (locked.length === 0) return null;
  let next = locked.find((def) => !seen.has(def.id));
  if (!next) {
    seen.clear();
    next = locked[0]!;
  }
  seen.add(next.id);
  return next;
}

/** A non-blocking, once-per-Chapter-visit reminder after the first ordinary settle. */
export function PaletteGuide({ g, blocked }: { g: UseGame; blocked: boolean }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const osReducedMotion = usePrefersReducedMotion();
  const reducedMotion = settings.reducedMotion || osReducedMotion;
  const [pendingVisit, setPendingVisit] = useState<number | null>(null);
  const [notice, setNotice] = useState<UnlockDef | null>(null);
  const [exiting, setExiting] = useState(false);
  const [, refreshUnlocks] = useState(0);
  const previousSettle = useRef(g.state.settleComplete);
  const knownNatural = useRef(new Set(
    g.state.runUnlocks.filter((id) => REQUIRED_PALETTE_UNLOCKS.some((def) => def.id === id)),
  ));
  const unlockedDuringSettle = useRef(false);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remaining = useRef(HOLD_MS);
  const deadline = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  currentPaletteGuideSession = paletteGuideSessionFor(
    currentPaletteGuideSession,
    g.state.observationId,
    g.state.run.ante,
  );
  const session = currentPaletteGuideSession;
  const visit = session.visit;

  const clearAutoTimer = () => {
    if (autoTimer.current !== null) clearTimeout(autoTimer.current);
    autoTimer.current = null;
  };
  const clearExitTimer = () => {
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    exitTimer.current = null;
  };
  const finishImmediately = () => {
    clearAutoTimer();
    clearExitTimer();
    setNotice(null);
    setExiting(false);
    setPendingVisit(null);
  };
  const dismiss = () => {
    clearAutoTimer();
    if (reducedMotion) {
      finishImmediately();
      return;
    }
    setExiting(true);
    clearExitTimer();
    exitTimer.current = setTimeout(finishImmediately, EXIT_MS);
  };
  const resumeAutoDismiss = () => {
    if (!notice || exiting || hovered.current || focused.current) return;
    clearAutoTimer();
    deadline.current = Date.now() + remaining.current;
    autoTimer.current = setTimeout(dismiss, remaining.current);
  };
  const pauseAutoDismiss = () => {
    if (autoTimer.current === null) return;
    remaining.current = Math.max(0, deadline.current - Date.now());
    clearAutoTimer();
  };

  useEffect(() => {
    const refresh = () => refreshUnlocks((value) => value + 1);
    window.addEventListener(PRESENTATION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(PRESENTATION_CHANGED_EVENT, refresh);
  }, []);

  useEffect(() => {
    const raw = g.state.runUnlocks.filter(
      (id) => REQUIRED_PALETTE_UNLOCKS.some((def) => def.id === id),
    );
    if (!g.state.settleComplete) {
      unlockedDuringSettle.current = raw.some((id) => !knownNatural.current.has(id));
    }
    for (const id of raw) knownNatural.current.add(id);
  }, [g.state.runUnlocks, g.state.settleComplete]);

  useEffect(() => {
    const wasComplete = previousSettle.current;
    previousSettle.current = g.state.settleComplete;
    if (wasComplete || !g.state.settleComplete) return;

    const decision = paletteGuideSettleDecision({
      alreadyHandled: session.handledVisits.has(visit),
      phase: g.state.phase,
      pendingEnd: g.state.pendingEnd,
      unlockedRequired: unlockedDuringSettle.current,
    });
    if (decision === 'ignore') return;
    session.handledVisits.add(visit);
    unlockedDuringSettle.current = false;
    if (decision === 'skip') return;
    setPendingVisit(visit);
  }, [
    g.state.observationId,
    g.state.pendingEnd,
    g.state.phase,
    g.state.settleComplete,
    session,
    visit,
  ]);

  const available = canShowPaletteGuide({
    sameVisit: pendingVisit === visit,
    tips: settings.tips,
    introSeen: hasSeenIntro(),
    phase: g.state.phase,
    settleComplete: g.state.settleComplete,
    pendingEnd: g.state.pendingEnd,
    blindEntryEffects: g.state.blindEntryEffects !== null,
    blocked,
  });

  useEffect(() => {
    if (!available) {
      if (notice) finishImmediately();
      return;
    }
    let observer: MutationObserver | null = null;
    const reconcile = () => {
      if (document.querySelector(MODAL_SELECTOR)) {
        if (notice) finishImmediately();
        return;
      }
      if (notice && activeUnlocks().has(notice.id)) {
        finishImmediately();
        return;
      }
      if (!notice) {
        const next = nextPaletteGuide(activeUnlocks(), paletteGuideSeen);
        if (!next) {
          setPendingVisit(null);
          return;
        }
        observer?.disconnect();
        setNotice(next);
        setExiting(false);
      }
    };
    queueMicrotask(reconcile);
    observer = new MutationObserver(reconcile);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer?.disconnect();
    // Presentation changes trigger a render through refreshUnlocks above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [available, g.state.observationId, notice]);

  useEffect(() => {
    if (!notice) return;
    remaining.current = HOLD_MS + (reducedMotion ? 0 : ENTER_MS);
    resumeAutoDismiss();
    return clearAutoTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice?.id, reducedMotion]);

  useEffect(() => () => {
    clearAutoTimer();
    clearExitTimer();
  }, []);

  if (!notice || typeof document === 'undefined') return null;
  return createPortal(
    <div className="palette-guide-live" role="status" aria-live="polite">
      <button
        type="button"
        className={[
          'palette-guide',
          exiting && 'is-exiting',
          reducedMotion && 'is-reduced',
        ].filter(Boolean).join(' ')}
        aria-label={`${t(`paletteGuide.${notice.id}`)} ${t('paletteGuide.close', { word: notice.word })}`}
        onClick={dismiss}
        onMouseEnter={() => { hovered.current = true; pauseAutoDismiss(); }}
        onMouseLeave={() => { hovered.current = false; resumeAutoDismiss(); }}
        onFocus={() => { focused.current = true; pauseAutoDismiss(); }}
        onBlur={() => { focused.current = false; resumeAutoDismiss(); }}
      >
        {t(`paletteGuide.${notice.id}`)}
      </button>
    </div>,
    document.body,
  );
}
