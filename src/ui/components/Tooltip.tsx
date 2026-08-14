import {
  useEffect,
  useId,
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
  children,
}: Props) {
  const { t } = useI18n();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const open = !disabled && (hovered || focused) && position !== null;
  const subDetails = sub ? (Array.isArray(sub) ? sub : [sub]) : [];
  const supplementCopy = [body, ...subDetails.map((detail) => detail.body)].join('\n');
  const hasSupplement = subDetails.length > 0
    || body.includes('[g:')
    || subDetails.some((detail) => detail.body.includes('[g:'))
    || referencedMaterialTips(supplementCopy, t).length > 0
    || referencedFontTips(supplementCopy, t).length > 0
    || referencedEditionTips(supplementCopy, t).length > 0
    || referencedTermTips(supplementCopy, t).length > 0;

  useEffect(() => {
    if (!disabled) return;
    setHovered(false);
    setFocused(false);
    setPosition(null);
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
      setPosition(locate());
      setHovered(true);
    };
    const hideHover = () => setHovered(false);
    const showFocus = (event: FocusEvent) => {
      const focusTarget = event.target;
      if (!(focusTarget instanceof Element) || !focusTarget.matches(':focus-visible')) return;
      setPosition(locate());
      setFocused(true);
    };
    const hideFocus = (event: FocusEvent) => {
      if (!node.contains(event.relatedTarget as Node | null)) setFocused(false);
    };
    const press = () => {
      setHovered(false);
      setFocused(false);
    };
    node.addEventListener('pointerenter', showHover);
    node.addEventListener('pointerleave', hideHover);
    node.addEventListener('pointerdown', press);
    node.addEventListener('focusin', showFocus);
    node.addEventListener('focusout', hideFocus);
    return () => {
      node.removeEventListener('pointerenter', showHover);
      node.removeEventListener('pointerleave', hideHover);
      node.removeEventListener('pointerdown', press);
      node.removeEventListener('focusin', showFocus);
      node.removeEventListener('focusout', hideFocus);
    };
  }, [disabled, down, externalAnchorRef]);

  useEffect(() => {
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
  }, [down, open]);

  useEffect(() => {
    if (!open) return;
    const node = target();
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
  }, [externalAnchorRef, open, tooltipId]);

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
      ].filter(Boolean).join(' ')}
      role="tooltip"
      style={{
        '--tt-x': `${position.x}px`,
        '--tt-y': `${position.y}px`,
      } as CSSProperties}
    >
      <span className="tt-title">{title}</span>
      <span className="tt-desc">
        <span className="tt-body">{richText(stripTooltipPeriods(body))}</span>
        {extra && <span className="tt-extra">{richText(stripTooltipPeriods(extra))}</span>}
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
