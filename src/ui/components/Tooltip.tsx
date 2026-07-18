import type { ReactNode } from 'react';
import type { JokerRarity } from '../../engine/types';
import { useI18n } from '../i18n';
import { richText } from '../richtext';

interface Props {
  title: string;
  body: string;
  /** live scaling value line ("currently ×1.5"), when applicable */
  extra?: string | null;
  /** joker rarity — renders the rarity badge under the description */
  rarity?: JokerRarity | undefined;
  /** open the card downward instead of upward (shelf tooltips, E-7) */
  down?: boolean;
  children: ReactNode;
}

/**
 * Shared anchored card tooltip (spec §0): wraps any card and reveals an anchored
 * panel on hover/focus. CSS-driven (see screens.css) so it needs no JS state.
 *
 * One shape for every tooltip: dark card, white title, white rounded description
 * plate, and — for jokers only — a rarity badge beneath it. Body copy carries
 * highlight markup (see richtext.tsx).
 */
export function Tooltip({ title, body, extra, rarity, down, children }: Props) {
  const { t } = useI18n();
  return (
    <span className="tt-anchor">
      {children}
      <span className={['tt-card', down ? 'down' : ''].filter(Boolean).join(' ')} role="tooltip">
        <span className="tt-title">{title}</span>
        <span className="tt-desc">
          <span className="tt-body">{richText(body)}</span>
          {extra && <span className="tt-extra">{extra}</span>}
        </span>
        {rarity && <span className={['tt-rarity', rarity].join(' ')}>{t(`rarity.${rarity}`)}</span>}
      </span>
    </span>
  );
}
