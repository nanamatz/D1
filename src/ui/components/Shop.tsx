import { useEffect, useState, type ReactNode } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { BALANCE } from '../../engine/balance';
import { rerollCost } from '../../engine/economy';
import { canAddJoker, discountedPrice, rerollDiscount } from '../../engine/vouchers';
import type { ConsumableId, JokerRarity, ShopItem } from '../../engine/types';
import { consumableDescKey, jokerDescKey, voucherDescKey } from '../descriptions';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import { tileTooltip } from '../game';
import type { UseGame } from '../useGame';
import { Tooltip, type TooltipClassification } from './Tooltip';
import { JokerShelf } from './JokerShelf';
import { PackOpening } from './PackOpening';
import { MoneyValue } from './MoneyValue';
import { ShopMascot } from './ShopMascot';
import { VoucherCard } from './VoucherCard';
import { packArt } from '../packArt';
import { packTooltip } from '../packTooltip';
import { voucherArt } from '../voucherArt';
import { isFableId, type FableId } from '../../engine/fables';
import { isConstellationId } from '../../engine/constellations';
import { constellationArt } from '../constellationArt';
import { FableCardArt } from './FableCardArt';
import { FamilyCardArt } from './FamilyCardArt';
import { TiltCard } from './TiltCard';
import { consumableClassification } from '../cardClassification';
import { TileView } from './Tile';

interface ShopOfferProps {
  label: string;
  price: number;
  selected: boolean;
  actionLabel: string;
  actionClassName: string;
  disabled: boolean;
  onSelect: () => void;
  onAction: () => void;
  children: ReactNode;
}

/** Image-first sale slot. Selecting the art reveals its contextual action below. */
function ShopOffer({
  label,
  price,
  selected,
  actionLabel,
  actionClassName,
  disabled,
  onSelect,
  onAction,
  children,
}: ShopOfferProps) {
  return (
    <div className={['shop-offer', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
      <TiltCard
        idle
        className="shop-offer-card"
        role="button"
        tabIndex={0}
        aria-label={`${label} · $${price}`}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <div className="shop-offer-visual">
          <div className="shop-offer-art">{children}</div>
          <span className="shop-offer-price" aria-label={`$${price}`}>${price}</span>
          <div className="shop-offer-action" aria-hidden={!selected}>
            <button
              className={['btn', actionClassName, 'sm'].join(' ')}
              disabled={disabled}
              tabIndex={selected ? 0 : -1}
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
            >
              {actionLabel}
            </button>
          </div>
        </div>
      </TiltCard>
    </div>
  );
}

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

/** The shop screen between blinds (GDD §9.2). Buy/sell/reroll, then Next blind. */
export function Shop({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, shop } = g.state;
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  useEffect(() => setSelectedOffer(null), [shop]);
  if (!shop) return null;

  const toggleOffer = (key: string) => {
    setSelectedOffer((current) => current === key ? null : key);
  };

  const itemMeta = (
    item: ShopItem,
  ): {
    emoji: string;
    name: string;
    desc: string;
    art?: string | undefined;
    fableId?: FableId | undefined;
    accent?: string | undefined;
    rarity?: JokerRarity | undefined;
    classification?: TooltipClassification | undefined;
  } => {
    if (item.kind === 'joker') {
      const def = JOKER_REGISTRY.get(item.id);
      return {
        emoji: def?.emoji ?? '🃏',
        name: def ? (lang === 'ko' ? def.nameKo : def.nameEn) : item.id,
        desc: t(jokerDescKey(item.id)),
        accent: def && def.rarity !== 'common' ? def.rarity : undefined,
        rarity: def?.rarity,
      };
    }
    if (item.kind === 'tile') {
      // The shared 3-axis tile tooltip (feature-04 B) — material/font/edition each
      // with its effect, so a shop tile reads the same as one in hand.
      const tip = tileTooltip(item.tile, t);
      return { emoji: item.tile.letter ?? '◆', name: tip.title, desc: tip.body };
    }
    return {
      emoji: CONSUMABLE_EMOJI[item.id] ?? '📄',
      name: t(`consumable.${item.id}`),
      desc: t(consumableDescKey(item.id)),
      fableId: isFableId(item.id) ? item.id : undefined,
      art: isConstellationId(item.id) ? constellationArt(item.id) : undefined,
      classification: consumableClassification(item.id),
    };
  };

  const affordable = (item: ShopItem): boolean => {
    if (run.gold < item.price) return false;
    return item.kind === 'joker'
      ? canAddJoker(run, item.edition ?? 'base')
      : item.kind === 'tile' || run.consumables.length < run.consumableSlots;
  };

  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  const voucher = shop.voucher ? VOUCHER_REGISTRY.get(shop.voucher) : undefined;

  return (
    <div className="shop2">
      <aside className="shop-rail">
        <button
          className="btn play next-blind"
          onClick={() => { audio.play('buttonPress'); g.leaveShop(); }}
        >
          {t('shop.next')}
        </button>
        <button className="btn green reroll-btn" disabled={run.gold < cost} onClick={g.reroll}>
          {t('shop.reroll', { cost })}
        </button>
        <div className="shop-gold">
          <span className="label">{t('shop.title')}</span>
          <MoneyValue value={run.gold} />
        </div>
        <ShopMascot />
      </aside>

      <div className="shop-main">
        {/* D-1/D-2: owned jokers + consumables persist at the top, same shelf as
            the play screen; then items for sale; then vouchers & packs. */}
        <div className="shop-shelf">
          <JokerShelf run={run} onSellConsumable={g.sellConsumable} onSellJoker={g.sell} onReorderJoker={g.reorderJokers} />
        </div>

        {/* item 7: the pack-opening modal covers ONLY this sale region (for-sale,
            vouchers, packs). The shelf above stays visible and interactive so jokers
            and consumables can still be sold while a pack is open. */}
        <div className="shop-sale-region">
        <div className="panel">
          <div className="label">{t('shop.forSale')}</div>
          <div className="shop-row">
            {shop.items.map((item, i) => {
              if (!item) {
                return (
                  <div key={i} className="shop-offer empty" aria-label={t('shop.sold')}>
                    <div className="shop-offer-card shopitem empty" aria-hidden />
                  </div>
                );
              }
              const m = itemMeta(item);
              const edition =
                item.kind === 'joker' ? (item.edition ?? 'base')
                  : item.kind === 'tile' ? (item.tile.edition ?? 'base')
                    : 'base';
              const offerKey = `item-${i}`;
              return (
                <Tooltip
                  key={i}
                  title={m.name}
                  body={m.desc}
                  rarity={m.rarity}
                  classification={m.classification}
                >
                  <ShopOffer
                    label={m.name}
                    price={item.price}
                    selected={selectedOffer === offerKey}
                    actionLabel={t('shop.buy')}
                    actionClassName="exchange"
                    disabled={!affordable(item)}
                    onSelect={() => toggleOffer(offerKey)}
                    onAction={() => g.buy(i)}
                  >
                    {item.kind === 'tile' ? (
                      <div className="shop-tile-art">
                        <TileView tile={item.tile} tilt={false} />
                      </div>
                    ) : (
                      <div
                        className={[
                          'shopitem',
                          'shopitem-image-only',
                          m.accent,
                          `edition-${edition}`,
                        ].filter(Boolean).join(' ')}
                      >
                        {m.fableId ? (
                          <FableCardArt
                            id={m.fableId}
                            className="shop-consumable-art"
                            title={m.name}
                          />
                        ) : m.art ? (
                          <FamilyCardArt
                            src={m.art}
                            className="shop-consumable-art"
                            title={m.name}
                          />
                        ) : (
                          <span className="e">{m.emoji}</span>
                        )}
                      </div>
                    )}
                  </ShopOffer>
                </Tooltip>
              );
            })}
          </div>
        </div>

        <div className="shop-two">
          <div className="panel">
            <div className="label">{t('shop.vouchers')}</div>
            <div className="shop-row">
              {voucher ? (
                <Tooltip
                  title={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                  body={t(voucherDescKey(voucher.id))}
                  classification="voucher"
                >
                  <ShopOffer
                    label={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                    price={voucher.price}
                    selected={selectedOffer === 'voucher'}
                    actionLabel={t('shop.redeem')}
                    actionClassName="exchange"
                    disabled={run.gold < voucher.price}
                    onSelect={() => toggleOffer('voucher')}
                    onAction={g.buyVoucher}
                  >
                    <VoucherCard
                      emoji={voucher.emoji}
                      name={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                      artSrc={voucherArt(voucher.id)}
                      motion={false}
                    />
                  </ShopOffer>
                </Tooltip>
              ) : (
                <div className="shop-offer empty" aria-label={t('shop.sold')}>
                  <div className="shop-offer-card shopitem empty" aria-hidden />
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="label">{t('shop.packs')}</div>
            <div className="shop-row">
              {shop.packs.map((p, i) => {
                if (!p) {
                  return (
                    <div key={i} className="shop-offer empty" aria-label={t('shop.sold')}>
                      <div className="shop-offer-card shopitem empty" aria-hidden />
                    </div>
                  );
                }
                const tip = packTooltip(p.type, p.size, t);
                const price = discountedPrice(run, BALANCE.pack.size[p.size].price);
                const offerKey = `pack-${i}`;
                const art = packArt(p.type, p.size, p.artVariant);
                return (
                  <Tooltip key={i} title={tip.title} body={tip.body} grade={tip.grade}>
                    <ShopOffer
                      label={tip.title}
                      price={price}
                      selected={selectedOffer === offerKey}
                      actionLabel={t('pack.open')}
                      actionClassName="green"
                      disabled={run.gold < price}
                      onSelect={() => toggleOffer(offerKey)}
                      onAction={() => g.buyPack(i)}
                    >
                      <div
                        className={['shopitem', 'shopitem-image-only', `pack-${p.size}`].join(' ')}
                      >
                        {art ? (
                          <img className="pack-img" src={art} alt="" />
                        ) : (
                          <span className="e">📦</span>
                        )}
                      </div>
                    </ShopOffer>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </div>

        {g.state.pack && (
          <div className="pack-overlay-region">
            <div className="overlay-card pack-modal">
              <PackOpening g={g} />
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
