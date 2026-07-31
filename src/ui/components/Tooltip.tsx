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
  /** open the card downward instead of upward (shelf tooltips, E-7) */
  down?: boolean;
  /** feedback #5: a second, boxed tooltip beneath the main one — used when a consumable
   *  references a material/font, to explain that axis inline. */
  sub?: { title: string; body: string } | undefined;
  /** Compact letter-tile shape. */
  compact?: boolean;
  /** Use an existing DOM node without adding a layout wrapper. */
  anchorRef?: RefObject<HTMLElement | null>;
  disabled?: boolean;
  children?: ReactNode;
}

interface SupplementProps {
  body: string;
  sub?: { title: string; body: string } | undefined;
}

export type TooltipClassification = 'voucher' | 'fable' | 'constellation' | 'gambler';

/** Secondary definitions shared by card and letter-tile tooltips. */
export function TooltipSupplement({ body, sub }: SupplementProps) {
  const { t } = useI18n();
  const explainsGibberish = body.includes('[g:') || sub?.body.includes('[g:');
  if (!sub && !explainsGibberish) return null;

  return (
    <span className="tt-sub-card">
      {sub && (
        <span className="tt-sub-section">
          <span className="tt-sub-title">{sub.title}</span>
          <span className="tt-body">{richText(sub.body)}</span>
        </span>
      )}
      {explainsGibberish && (
        <span className="tt-sub-section">
          <span className="tt-sub-title">{t('tooltip.gibberish.title')}</span>
          <span className="tt-body">{richText(t('tooltip.gibberish.body'))}</span>
        </span>
      )}
    </span>
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
  down,
  sub,
  compact,
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
    const track = () => {
      const next = locate();
      const card = cardRef.current;
      if (next && card) {
        card.style.setProperty('--tt-x', `${next.x}px`);
        card.style.setProperty('--tt-y', `${next.y}px`);
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
      ].filter(Boolean).join(' ')}
      role="tooltip"
      style={{
        '--tt-x': `${position.x}px`,
        '--tt-y': `${position.y}px`,
      } as CSSProperties}
    >
      <span className="tt-title">{title}</span>
      <span className="tt-desc">
        <span className="tt-body">{richText(body)}</span>
        {extra && <span className="tt-extra">{richText(extra)}</span>}
      </span>
      {rarity && <span className={['tt-rarity', rarity].join(' ')}>{t(`rarity.${rarity}`)}</span>}
      {grade && <span className={['tt-grade', grade].join(' ')}>{t(`pack.size.${grade}`)}</span>}
      {classification && (
        <span className={['tt-classification', classification].join(' ')}>
          {t(`tooltip.classification.${classification}`)}
        </span>
      )}
      <TooltipSupplement body={body} sub={sub} />
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
