import { useEffect, type RefObject } from 'react';

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

interface ModalEntry {
  root: HTMLElement;
}

const modalStack: ModalEntry[] = [];
let sessionPrevious: HTMLElement | null = null;
let sessionAppRoot: HTMLElement | null = null;
let sessionAppRootWasInert = false;

const focusableIn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
  .filter((element) => !element.hidden);

const topModal = () => modalStack.at(-1)?.root ?? null;

const focusTopModal = () => {
  const root = topModal();
  if (!root) return;
  (focusableIn(root)[0] ?? root).focus();
};

const isTooltipPortal = (target: EventTarget | null) => (
  target instanceof Element && target.closest('.tt-portal') !== null
);

const markTopModal = () => {
  modalStack.forEach(({ root }, index) => {
    if (index === modalStack.length - 1) root.dataset.modalFocusTop = 'true';
    else delete root.dataset.modalFocusTop;
  });
};

const trapKeydown = (event: KeyboardEvent) => {
  const root = topModal();
  if (!root) return;
  event.stopImmediatePropagation();
  if (event.key === 'Escape') {
    event.preventDefault();
    return;
  }
  if (event.key !== 'Tab') return;
  event.preventDefault();
  const elements = focusableIn(root);
  if (elements.length === 0) {
    root.focus();
    return;
  }
  const current = elements.indexOf(document.activeElement as HTMLElement);
  const next = event.shiftKey
    ? (current <= 0 ? elements.length - 1 : current - 1)
    : (current < 0 || current === elements.length - 1 ? 0 : current + 1);
  elements[next]!.focus();
};

const trapPointer = (event: PointerEvent) => {
  const root = topModal();
  if (!root || (event.target instanceof Node && root.contains(event.target)) || isTooltipPortal(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
};

const trapFocus = (event: FocusEvent) => {
  const root = topModal();
  if (!root || (event.target instanceof Node && root.contains(event.target)) || isTooltipPortal(event.target)) return;
  event.stopImmediatePropagation();
  focusTopModal();
};

const beginModalSession = () => {
  sessionPrevious = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  sessionAppRoot = document.getElementById('root');
  sessionAppRootWasInert = sessionAppRoot?.inert ?? false;
  if (sessionAppRoot) sessionAppRoot.inert = true;
  window.addEventListener('keydown', trapKeydown, true);
  window.addEventListener('pointerdown', trapPointer, true);
  document.addEventListener('focusin', trapFocus, true);
};

const endModalSession = () => {
  window.removeEventListener('keydown', trapKeydown, true);
  window.removeEventListener('pointerdown', trapPointer, true);
  document.removeEventListener('focusin', trapFocus, true);
  if (sessionAppRoot) sessionAppRoot.inert = sessionAppRootWasInert;
  if (sessionPrevious?.isConnected) sessionPrevious.focus();
  sessionPrevious = null;
  sessionAppRoot = null;
  sessionAppRootWasInert = false;
};

/** Keep transient global presentations keyboard-modal without using the top layer. */
export function useModalFocus(rootRef: RefObject<HTMLElement | null>, activeKey: unknown) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || activeKey === null) return;
    if (modalStack.length === 0) beginModalSession();
    const entry = { root };
    modalStack.push(entry);
    markTopModal();
    focusTopModal();

    return () => {
      const index = modalStack.indexOf(entry);
      if (index >= 0) modalStack.splice(index, 1);
      delete root.dataset.modalFocusTop;
      markTopModal();
      if (modalStack.length === 0) endModalSession();
      else focusTopModal();
    };
  }, [activeKey, rootRef]);
}
