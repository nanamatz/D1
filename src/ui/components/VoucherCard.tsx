import { TiltCard } from './TiltCard';
import { UiIcon } from './UiIcon';

interface VoucherCardProps {
  /** Legacy data prop accepted for callers; rendering always uses bundled art. */
  emoji?: string;
  name: string;
  artSrc?: string;
  muted?: boolean;
  /** Shop-only top-to-bottom shred beat before the purchased voucher leaves. */
  redeeming?: boolean;
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
  name,
  artSrc,
  muted = false,
  redeeming = false,
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
        <UiIcon name={muted ? 'unknown' : 'document'} className="voucher-card__icon" />
      )}
      <span className="voucher-card__side voucher-card__side--right" aria-hidden="true">
        VOUCHER
      </span>
      <span className="voucher-card__name">{name}</span>
      {redeeming && <span className="voucher-card__shred" aria-hidden />}
    </>
  );
  const className = [
    'voucher-card',
    muted && 'muted',
    redeeming && 'redeeming',
  ].filter(Boolean).join(' ');
  return motion
    ? <TiltCard idle className={className}>{content}</TiltCard>
    : <div className={className}>{content}</div>;
}
