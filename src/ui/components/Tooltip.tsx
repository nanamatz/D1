import type { ReactNode } from 'react';

interface Props {
  title: string;
  body: string;
  /** live scaling value line ("currently ×1.5"), when applicable */
  extra?: string | null;
  /** rarity/suit class for the title accent color */
  accent?: string | undefined;
  /** open the card downward instead of upward (shelf tooltips, E-7) */
  down?: boolean;
  children: ReactNode;
}

/**
 * Shared anchored card tooltip (spec §0): wraps any card and reveals an anchored
 * panel on hover/focus. CSS-driven (see screens.css) so it needs no JS state.
 */
export function Tooltip({ title, body, extra, accent, down, children }: Props) {
  return (
    <span className="tt-anchor">
      {children}
      <span className={['tt-card', down ? 'down' : ''].filter(Boolean).join(' ')} role="tooltip">
        <span className={['tt-title', accent].filter(Boolean).join(' ')}>{title}</span>
        <span className="tt-body">{body}</span>
        {extra && <span className="tt-extra">{extra}</span>}
      </span>
    </span>
  );
}
