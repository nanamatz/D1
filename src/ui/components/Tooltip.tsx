import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { JokerRarity, PackSize } from '../../engine/types';
import {
  referencedEditionTips,
  referencedFontTips,
  referencedMaterialTips,
  referencedTermTips,
} from '../descriptions';
import { useI18n } from '../i18n';
import { richText } from '../richtext';

interface Props {
  title: string;
  body: string;
  /** live scaling value line ("currently ×1.5"), when applicable */
  extra?: string | null;
  /** joker rarity — renders the rarity badge under the description */
  rarity?: JokerRarity | undefined;
  /** pack grade (기본/클래식/프리미엄) — renders the grade badge under the
   *  description, and centres the body the way pack copy reads best. Kept
   *  separate from `rarity`: different domains, and merging them would churn
   *  four working joker call sites for no gain. */
  grade?: PackSize | undefined;
  /** Card family/type badge beneath the description. Hidden cards omit this. */
  classification?: TooltipClassification | undefined;
  /** Enhancement badges stacked beneath the main description/badges. */
  tags?: readonly TooltipTag[] | undefined;
  /** open the card downward instead of upward (shelf tooltips, E-7) */
  down?: boolean;
  /** Additional definitions; one stays left, while 2+ fold the highest priority inline. */
  sub?: TooltipDetail | readonly TooltipDetail[] | undefined;
  /** Compact letter-tile shape. */
  compact?: boolean;
  /** Gameplay state stamped into the tooltip as well as the object itself. */
  status?: 'disabled' | 'debuffed' | undefined;
  /** Use an existing DOM node without adding a layout wrapper. */
  anchorRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  /** Touch pointer-up toggles a pinned tooltip without consuming the control click. */
  touchPin?: boolean;
  /** Optional rich content rendered below the ordinary description. */
  content?: ReactNode;
  /** Keep this tooltip vertically inside the physical viewport. */
  viewportContain?: boolean;
  children?: ReactNode;
}

interface SupplementProps {
  body: string;
  sub?: TooltipDetail | readonly TooltipDetail[] | undefined;
}

export type TooltipClassification = 'voucher' | 'fable' | 'constellation' | 'gambler';
export type TooltipDetailKind = 'material' | 'font' | 'edition' | 'other';
export interface TooltipDetail {
  title: string;
  body: string;
  kind?: TooltipDetailKind;
}
export interface TooltipTag {
  label: string;
  tone: 'material' | 'font' | 'gray' | 'violet' | 'rainbow' | 'white';
}

const TOOLTIP_DETAIL_PRIORITY: Record<TooltipDetailKind, number> = {
  material: 0,
  font: 1,
  edition: 2,
  other: 3,
};

type TooltipMode = 'hover' | 'focus' | 'touch';
const TOOLTIP_MODE_PRIORITY: Record<TooltipMode, number> = { hover: 0, focus: 1, touch: 1 };
const PORTAL_HOVER_BRIDGE_MS = 120;
let activeTooltip: { id: string; mode: TooltipMode; close: () => void } | null = null;

const claimTooltip = (id: string, mode: TooltipMode, close: () => void): boolean => {
  if (activeTooltip?.id === id) {
    if (mode !== 'hover' || activeTooltip.mode === 'hover') activeTooltip.mode = mode;
    return true;
  }
  if (activeTooltip
    && TOOLTIP_MODE_PRIORITY[activeTooltip.mode] > TOOLTIP_MODE_PRIORITY[mode]) return false;
  const previous = activeTooltip;
  activeTooltip = { id, mode, close };
  previous?.close();
  return true;
};

const releaseTooltip = (id: string, mode?: TooltipMode) => {
  if (activeTooltip?.id === id && (!mode || activeTooltip.mode === mode)) activeTooltip = null;
};

const leaveFocusedTooltip = (id: string) => {
  if (activeTooltip?.id === id && activeTooltip.mode === 'focus') activeTooltip.mode = 'hover';
};

export function consumeTooltipEscape(
  event: Pick<KeyboardEvent, 'key' | 'preventDefault' | 'stopPropagation'>,
  active: boolean,
  close: () => void,
  defer = false,
): boolean {
  if (event.key !== 'Escape' || !active || defer) return false;
  event.preventDefault();
  event.stopPropagation();
  close();
  return true;
}

/** Deduplicate and enforce material > font > edition before choosing the inline detail. */
export function splitTooltipDetails(details: readonly TooltipDetail[]): {
  inline: TooltipDetail | null;
  left: readonly TooltipDetail[];
} {
  const ordered = details
    .filter((detail, index, all) => all.findIndex((candidate) =>
      candidate.title === detail.title && candidate.body === detail.body) === index)
    .map((detail, index) => ({ detail, index }))
    .sort((a, b) =>
      TOOLTIP_DETAIL_PRIORITY[a.detail.kind ?? 'other']
      - TOOLTIP_DETAIL_PRIORITY[b.detail.kind ?? 'other']
      || a.index - b.index)
    .map(({ detail }) => detail);
  if (ordered.length < 2) return { inline: null, left: ordered };
  if (ordered.filter((detail) => detail.kind === 'edition').length === 3) {
    const inline = ordered.find((detail) => detail.kind !== 'edition') ?? null;
    return { inline, left: inline ? ordered.filter((detail) => detail !== inline) : ordered };
  }
  return { inline: ordered[0]!, left: ordered.slice(1) };
}

export const stripTooltipPeriods = (text: string): string =>
  text
    .replace(/(?:\.(?!\d)|。)[ \t]*/g, (match, offset: number, source: string) =>
      source.slice(offset + match.length).trim().length > 0 ? '\n' : '')
    .replace(/\n{2,}/g, '\n');

/** Size supplemental cards from visible copy, not rich-text control markup. */
export function supplementalTooltipWidth(detail: TooltipDetail): number {
  const visibleCopy = `${detail.title} ${stripTooltipPeriods(detail.body)}`
    .replace(/\[[^:\]]+:([^\]]+)\]/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return 120 + Array.from(visibleCopy).length * 2;
}

/** Secondary definitions shared by card and letter-tile tooltips. */
export function TooltipSupplement({ body, sub }: SupplementProps) {
  const { t } = useI18n();
  const details = sub ? (Array.isArray(sub) ? sub : [sub]) : [];
  const copy = [body, ...details.map((detail) => detail.body)];
  const materialTips = referencedMaterialTips(copy.join('\n'), t);
  const fontTips = referencedFontTips(copy.join('\n'), t);
  const editionTips = referencedEditionTips(copy.join('\n'), t);
  const termTips = referencedTermTips(copy.join('\n'), t);
  const explainsGibberish = copy
    .some((copy) => copy.includes('[g:'));
  if (
    details.length === 0 &&
    materialTips.length === 0 &&
    fontTips.length === 0 &&
    editionTips.length === 0 &&
    termTips.length === 0 &&
    !explainsGibberish
  ) return null;
  const supplements = [...details, ...materialTips, ...fontTips, ...editionTips, ...termTips];
  if (explainsGibberish) {
    supplements.push({
        title: t('tooltip.gibberish.title'),
        body: t('tooltip.gibberish.body'),
        kind: 'other',
      });
  }
  const { inline, left } = splitTooltipDetails(supplements);

  return (
    <>
      {inline && (
        <span className="tt-inline-detail">
          <span className="tt-inline-title">{inline.title}</span>
          <span className="tt-body">{richText(stripTooltipPeriods(inline.body))}</span>
        </span>
      )}
      {left.length > 0 && (
        <span className="tt-sub-stack">
          {left.map((detail, index) => (
            <span
              className="tt-sub-card"
              key={`${detail.title}-${index}`}
              style={{
                '--tt-sub-w': `${supplementalTooltipWidth(detail)}px`,
              } as CSSProperties}
            >
              <span className="tt-sub-title">{detail.title}</span>
              <span className="tt-body">{richText(stripTooltipPeriods(detail.body))}</span>
            </span>
          ))}
        </span>
      )}
    </>
  );
}

/**
 * Shared anchored card tooltip (spec §0): wraps any card and portals its panel to
 * <body> on hover. Viewport tracking keeps it attached through card motion while
 * escaping every panel's overflow and stacking context.
 *
 * One shape for every tooltip: dark card, white title, white rounded description
 * plate, and — for jokers only — a rarity badge beneath it. Body copy carries
 * highlight markup (see richtext.tsx).
 */
export function Tooltip({
  title,
  body,
  extra,
  rarity,
  grade,
  classification,
  tags,
  down,
  sub,
  compact,
  status,
  anchorRef: externalAnchorRef,
  disabled = false,
  touchPin = false,
  content,
  viewportContain = false,
  children,
}: Props) {
  const { t } = useI18n();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const hoverHideTimerRef = useRef<number | null>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touchPinned, setTouchPinned] = useState(false);
  const [focusedTarget, setFocusedTarget] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const open = !disabled && (hovered || focused || touchPinned) && position !== null;
  const subDetails = sub ? (Array.isArray(sub) ? sub : [sub]) : [];
  const supplementCopy = [body, ...subDetails.map((detail) => detail.body)].join('\n');
  const hasSupplement = subDetails.length > 0
    || body.includes('[g:')
    || subDetails.some((detail) => detail.body.includes('[g:'))
    || referencedMaterialTips(supplementCopy, t).length > 0
    || referencedFontTips(supplementCopy, t).length > 0
    || referencedEditionTips(supplementCopy, t).length > 0
    || referencedTermTips(supplementCopy, t).length > 0;

  const clearHoverHide = () => {
    if (hoverHideTimerRef.current === null) return;
    window.clearTimeout(hoverHideTimerRef.current);
    hoverHideTimerRef.current = null;
  };
  const hideHover = () => {
    clearHoverHide();
    setHovered(false);
    releaseTooltip(tooltipId, 'hover');
  };
  const scheduleHoverHide = () => {
    if (!viewportContain) {
      hideHover();
      return;
    }
    clearHoverHide();
    hoverHideTimerRef.current = window.setTimeout(hideHover, PORTAL_HOVER_BRIDGE_MS);
  };

  const close = () => {
    clearHoverHide();
    setHovered(false);
    setFocused(false);
    setTouchPinned(false);
    setFocusedTarget(null);
    setPosition(null);
    releaseTooltip(tooltipId);
  };

  useEffect(() => {
    if (!disabled) return;
    close();
  }, [disabled]);

  const anchor = () => externalAnchorRef?.current ?? anchorRef.current;
  const target = () => {
    const node = anchor();
    return externalAnchorRef ? node : node?.firstElementChild ?? node;
  };
  const locate = () => {
    const rect = target()?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: rect.left + rect.width / 2,
      y: down ? rect.bottom : rect.top,
    };
  };

  useEffect(() => {
    const node = anchor();
    if (!node || disabled) return;
    const showHover = () => {
      if (!claimTooltip(tooltipId, 'hover', close)) return;
      clearHoverHide();
      setPosition(locate());
      setHovered(true);
    };
    const showFocus = (event: FocusEvent) => {
      const focusTarget = event.target;
      if (!(focusTarget instanceof HTMLElement)) return;
      setFocusedTarget(focusTarget);
      if (!focusTarget.matches(':focus-visible')) return;
      claimTooltip(tooltipId, 'focus', close);
      setPosition(locate());
      setFocused(true);
    };
    const hideFocus = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null)) {
        setFocused(false);
        setFocusedTarget(null);
        leaveFocusedTooltip(tooltipId);
      }
    };
    const press = () => {
      setHovered(false);
      setFocused(false);
    };
    const release = (event: PointerEvent) => {
      if (!touchPin || event.pointerType === 'mouse') return;
      claimTooltip(tooltipId, 'touch', close);
      setPosition(locate());
      setTouchPinned((pinned) => !pinned);
    };
    node.addEventListener('pointerenter', showHover);
    node.addEventListener('pointerleave', scheduleHoverHide);
    node.addEventListener('pointerdown', press);
    node.addEventListener('pointerup', release);
    node.addEventListener('focusin', showFocus);
    node.addEventListener('focusout', hideFocus);
    return () => {
      node.removeEventListener('pointerenter', showHover);
      node.removeEventListener('pointerleave', scheduleHoverHide);
      node.removeEventListener('pointerdown', press);
      node.removeEventListener('pointerup', release);
      node.removeEventListener('focusin', showFocus);
      node.removeEventListener('focusout', hideFocus);
      clearHoverHide();
      releaseTooltip(tooltipId);
    };
  }, [disabled, down, externalAnchorRef, touchPin]);

  useEffect(() => {
    if (!open) {
      releaseTooltip(tooltipId);
      return;
    }
    return () => releaseTooltip(tooltipId);
  }, [open, tooltipId]);

  useEffect(() => {
    if (!touchPinned) return;
    const node = anchor();
    const closeOutside = (event: PointerEvent) => {
      const eventTarget = event.target as Node | null;
      if (!node?.contains(eventTarget) && !cardRef.current?.contains(eventTarget)) close();
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [touchPinned]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      consumeTooltipEscape(
        event,
        activeTooltip?.id === tooltipId,
        close,
        !!anchor()?.querySelector('[aria-expanded="true"]'),
      );
    };
    window.addEventListener('keydown', closeOnEscape, true);
    return () => window.removeEventListener('keydown', closeOnEscape, true);
  }, [open, tooltipId]);

  useLayoutEffect(() => {
    if (!open) return;
    let frame = 0;
    const card = cardRef.current;
    const supplement = card?.querySelector<HTMLElement>('.tt-sub-stack');
    const supplementGap = card
      ? Number.parseFloat(getComputedStyle(card).getPropertyValue('--tt-sub-gap'))
      : 0;
    const track = () => {
      const next = locate();
      if (next && card) {
        card.style.setProperty('--tt-x', `${next.x}px`);
        card.style.setProperty('--tt-y', `${next.y}px`);
        if (viewportContain) {
          const targetRect = target()?.getBoundingClientRect();
          if (targetRect) {
            const height = card.offsetHeight;
            const below = window.innerHeight - targetRect.bottom - 10;
            const above = targetRect.top - 10;
            const placeBelow = down
              ? below >= height || below >= above
              : above < height && below > above;
            const preferredTop = placeBelow
              ? targetRect.bottom + 10
              : targetRect.top - height - 10;
            const top = Math.max(8, Math.min(preferredTop, window.innerHeight - height - 8));
            card.style.setProperty('--tt-contained-y', `${top}px`);
          }
        }
        if (supplement) {
          const rect = card.getBoundingClientRect();
          const leftSpace = rect.left - supplementGap - 8;
          const rightSpace = window.innerWidth - rect.right - supplementGap - 8;
          card.classList.toggle(
            'sub-right',
            leftSpace < supplement.offsetWidth && rightSpace > leftSpace,
          );
        }
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [down, open, viewportContain]);

  useEffect(() => {
    if (!open) return;
    const activeTarget = document.activeElement instanceof HTMLElement
      && anchor()?.contains(document.activeElement)
      ? document.activeElement
      : null;
    const node = focusedTarget ?? activeTarget;
    if (!node) return;
    const previous = node.getAttribute('aria-describedby');
    node.setAttribute(
      'aria-describedby',
      [previous, tooltipId].filter(Boolean).join(' '),
    );
    return () => {
      if (previous === null) node.removeAttribute('aria-describedby');
      else node.setAttribute('aria-describedby', previous);
    };
  }, [externalAnchorRef, focusedTarget, open, tooltipId]);

  const card = position && (
    <span
      ref={cardRef}
      id={tooltipId}
      className={[
        'tt-card',
        'tt-portal',
        down ? 'down' : '',
        grade ? 'pack' : '',
        compact ? 'tile-tt' : '',
        hasSupplement ? 'has-sub' : '',
        viewportContain ? 'viewport-contained' : '',
      ].filter(Boolean).join(' ')}
      role="tooltip"
      onPointerEnter={viewportContain ? clearHoverHide : undefined}
      onPointerLeave={viewportContain ? scheduleHoverHide : undefined}
      style={{
        '--tt-x': `${position.x}px`,
        '--tt-y': `${position.y}px`,
      } as CSSProperties}
    >
      <span className="tt-title">{title}</span>
      <span className="tt-desc">
        <span className="tt-body">{richText(stripTooltipPeriods(body))}</span>
        {extra && <span className="tt-extra">{richText(stripTooltipPeriods(extra))}</span>}
        {content}
        <TooltipSupplement body={body} sub={sub} />
      </span>
      {rarity && <span className={['tt-rarity', rarity].join(' ')}>{t(`rarity.${rarity}`)}</span>}
      {grade && <span className={['tt-grade', grade].join(' ')}>{t(`pack.size.${grade}`)}</span>}
      {classification && (
        <span className={['tt-classification', classification].join(' ')}>
          {t(`tooltip.classification.${classification}`)}
        </span>
      )}
      {status && (
        <span className={['tt-status', status].join(' ')}>{t(`tooltip.status.${status}`)}</span>
      )}
      {tags?.map((tag, index) => (
        <span
          className={['tt-enhancement-tag', tag.tone].join(' ')}
          key={`${tag.tone}-${tag.label}-${index}`}
        >
          {tag.label}
        </span>
      ))}
    </span>
  );

  const portal = open && card && typeof document !== 'undefined'
    ? createPortal(card, document.body)
    : null;

  if (externalAnchorRef) return portal;

  return (
    <span
      ref={anchorRef}
      className="tt-anchor"
    >
      {children}
      {portal}
    </span>
  );
}
