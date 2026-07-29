import { TiltCard } from './TiltCard';

interface VoucherCardProps {
  emoji: string;
  name: string;
  artSrc?: string;
  muted?: boolean;
  /** ShopOffer owns motion for its whole image/price/action foreground layer. */
  motion?: boolean;
}

/**
 * Shared CSS-rendered portrait voucher card.
 *
 * Keep the card free of shop-only controls so every voucher appearance uses the
 * same silhouette, size, and internal layout.
 */
export function VoucherCard({
  emoji,
  name,
  artSrc,
  muted = false,
  motion = true,
}: VoucherCardProps) {
  const content = (
    <>
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
    </>
  );
  const className = `voucher-card${muted ? ' muted' : ''}`;
  return motion
    ? <TiltCard idle className={className}>{content}</TiltCard>
    : <div className={className}>{content}</div>;
}
