interface VoucherCardProps {
  emoji: string;
  name: string;
  artSrc?: string;
  muted?: boolean;
}

/**
 * Shared CSS-rendered voucher ticket.
 *
 * Keep the ticket itself free of shop-only controls so every voucher appearance
 * uses the same silhouette, aspect ratio, and internal layout.
 */
export function VoucherCard({ emoji, name, artSrc, muted = false }: VoucherCardProps) {
  return (
    <div className={`voucher-card${muted ? ' muted' : ''}`}>
      <span className="voucher-card__side voucher-card__side--left" aria-hidden="true">
        VOUCHER
      </span>
      {artSrc ? (
        <img className="voucher-card__art" src={artSrc} alt="" />
      ) : (
        <span className="voucher-card__icon" aria-hidden="true">{emoji}</span>
      )}
      <span className="voucher-card__side voucher-card__side--right" aria-hidden="true">
        VOUCHER
      </span>
      <span className="voucher-card__name">{name}</span>
    </div>
  );
}
