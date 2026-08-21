import type { POS } from '../../engine/types';
import { useI18n } from '../i18n';

export function PosTags({
  candidates,
  active = null,
  className = '',
}: {
  candidates: readonly POS[];
  /** null means no winning pattern has resolved these candidates yet. */
  active?: readonly POS[] | null;
  className?: string;
}) {
  const { t } = useI18n();
  if (candidates.length === 0) return null;
  const activeSet = active === null ? null : new Set(active);
  return (
    <span
      className={['pos-tags', activeSet ? 'resolved' : 'unresolved', className]
        .filter(Boolean)
        .join(' ')}
      role="list"
    >
      {candidates.map((pos) => {
        const isActive = activeSet?.has(pos) ?? false;
        return (
          <span
            key={pos}
            className={[
              'pos-tag',
              `pos-${pos}`,
              activeSet ? (isActive ? 'active' : 'alternative') : '',
            ].filter(Boolean).join(' ')}
            role="listitem"
            aria-label={activeSet
              ? t(isActive ? 'pos.stateCompatible' : 'pos.stateAlternative', {
                  pos: t(`pos.${pos}`),
                })
              : undefined}
          >
            <span>{t(`pos.${pos}`)}</span>
          </span>
        );
      })}
    </span>
  );
}
