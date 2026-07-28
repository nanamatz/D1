import type { ReactNode } from 'react';
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
 * Shared anchored card tooltip (spec §0): wraps any card and reveals an anchored
 * panel on hover/focus. CSS-driven (see screens.css) so it needs no JS state.
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
  return (
    <span className="tt-anchor">
      {children}
      <span
        className={['tt-card', down ? 'down' : '', grade ? 'pack' : ''].filter(Boolean).join(' ')}
        role="tooltip"
      >
        <span className="tt-title">{title}</span>
        <span className="tt-desc">
          <span className="tt-body">{richText(body)}</span>
          {extra && <span className="tt-extra">{extra}</span>}
        </span>
        {rarity && <span className={['tt-rarity', rarity].join(' ')}>{t(`rarity.${rarity}`)}</span>}
        {grade && <span className={['tt-grade', grade].join(' ')}>{t(`pack.size.${grade}`)}</span>}
        {classification && (
          <span className={['tt-classification', classification].join(' ')}>
            {t(`tooltip.classification.${classification}`)}
          </span>
        )}
        {/* feedback: the referenced material/font as a SEPARATE tooltip card, 3px below. */}
        {sub && (
          <span className="tt-sub-card">
            <span className="tt-sub-title">{sub.title}</span>
            <span className="tt-body">{richText(sub.body)}</span>
          </span>
        )}
      </span>
    </span>
  );
}
