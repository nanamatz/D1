import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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
  children: ReactNode;
}

export type TooltipClassification = 'voucher' | 'fable' | 'constellation' | 'gambler';

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
  children,
}: Props) {
  const { t } = useI18n();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const track = () => {
      const anchor = anchorRef.current;
      const target = anchor?.firstElementChild ?? anchor;
      const rect = target?.getBoundingClientRect();
      if (rect) {
        const next = {
          x: rect.left + rect.width / 2,
          y: down ? rect.bottom : rect.top,
        };
        setPosition((current) =>
          current?.x === next.x && current.y === next.y ? current : next);
      }
      frame = requestAnimationFrame(track);
    };
    track();
    return () => cancelAnimationFrame(frame);
  }, [down, open]);

  const card = position && (
    <span
      className={[
        'tt-card',
        'tt-portal',
        down ? 'down' : '',
        grade ? 'pack' : '',
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
      {sub && (
        <span className="tt-sub-card">
          <span className="tt-sub-title">{sub.title}</span>
          <span className="tt-body">{richText(sub.body)}</span>
        </span>
      )}
    </span>
  );

  return (
    <span
      ref={anchorRef}
      className="tt-anchor"
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => {
        setOpen(false);
        setPosition(null);
      }}
    >
      {children}
      {open && card && typeof document !== 'undefined' && createPortal(card, document.body)}
    </span>
  );
}
