import { useEffect, useState, type ReactNode } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { BALANCE } from '../../engine/balance';
import { rerollCost } from '../../engine/economy';
import { canAddJoker, discountedPrice, rerollDiscount } from '../../engine/vouchers';
import type { ConsumableId, JokerRarity, ShopItem } from '../../engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
  jokerDescKey,
  voucherDescKey,
} from '../descriptions';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import { tileTooltip } from '../game';
import type { UseGame } from '../useGame';
import { Tooltip, type TooltipClassification } from './Tooltip';
import { MoneyValue } from './MoneyValue';
import { ShopMascot } from './ShopMascot';
import { VoucherCard } from './VoucherCard';
import { packArt } from '../packArt';
import { packTooltip } from '../packTooltip';
import { voucherArt } from '../voucherArt';
import {
  canUseUnheldFable,
  fableTargetsTiles,
  isBlindOnlyConsumable,
  isFableId,
  type FableId,
} from '../../engine/fables';
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
  /** feedback #3: an optional second action (e.g. shop "Use") shown beside the first. */
  action2Label?: string | undefined;
  action2ClassName?: string | undefined;
  action2Disabled?: boolean | undefined;
  onAction2?: (() => void) | undefined;
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
  action2Label,
  action2ClassName,
  action2Disabled,
  onAction2,
  children,
}: ShopOfferProps) {
  return (
    <div className={['shop-offer', selected ? 'selected' : ''].filter(Boolean).join(' ')}>
      <TiltCard
        idle
        className="shop-offer-card"
      >
        <div className="shop-offer-visual">
          <button
            type="button"
            className="shop-offer-select"
            aria-label={`${label} · $${price}`}
            aria-pressed={selected}
            onClick={onSelect}
          />
          <div className="shop-offer-art">{children}</div>
          <span className="shop-offer-price" aria-label={`$${price}`}>${price}</span>
          <div className="shop-offer-action" aria-hidden={!selected}>
            <button
              type="button"
              className={['btn', actionClassName, 'sm'].join(' ')}
              disabled={disabled}
              tabIndex={selected ? 0 : -1}
              onClick={onAction}
            >
              {actionLabel}
            </button>
          </div>
          {action2Label && onAction2 && (
            <div className="shop-offer-action-secondary" aria-hidden={!selected}>
              <button
                type="button"
                className={['btn', action2ClassName ?? 'green', 'sm'].join(' ')}
                disabled={action2Disabled}
                tabIndex={selected ? 0 : -1}
                onClick={onAction2}
              >
                {action2Label}
              </button>
            </div>
          )}
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
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setSelectedOffer(null), [shop]);
  if (!shop) return null;

  const toggleOffer = (key: string) => {
    setSelectedOffer((current) => current === key ? null : key);
  };
  const leavePanel = (action: () => void) => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(action, 360);
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
    sub?: { title: string; body: string } | undefined;
    extra?: string | undefined;
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
      desc: consumableTooltipBody(item.id, t),
      fableId: isFableId(item.id) ? item.id : undefined,
      art: isConstellationId(item.id) ? constellationArt(item.id) : undefined,
      classification: consumableClassification(item.id),
      sub: consumableAxisTip(item.id, t) ?? undefined,
      extra: consumableTooltipExtra(item.id, run, t) ?? undefined,
    };
  };

  const affordable = (item: ShopItem): boolean => {
    if (run.gold < item.price) return false;
    return item.kind === 'joker'
      ? canAddJoker(run, item.id, item.edition ?? 'base')
      : item.kind === 'tile' || run.consumables.length < run.consumableSlots;
  };

  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  const voucher = shop.voucher ? VOUCHER_REGISTRY.get(shop.voucher) : undefined;

  return (
    <div className={['shop2', leaving && 'phase-panel-leaving'].filter(Boolean).join(' ')}>
      <aside className="shop-rail">
        <button
          className="btn play next-blind"
          onClick={() => {
            audio.play('buttonPress');
            leavePanel(g.leaveShop);
          }}
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
        <div className="shop-sale-region">
        <div className="panel">
          <div className="label">{t('shop.forSale')}</div>
          <div className="shop-row">
            {shop.items
              .map((item, i) => ({ item, i }))
              .filter((entry): entry is { item: NonNullable<typeof entry.item>; i: number } =>
                entry.item !== null)
              .map(({ item, i }) => {
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
                  sub={m.sub}
                  {...(m.extra ? { extra: m.extra } : {})}
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
                    {...((item.kind === 'consumable' || item.kind === 'punctuation') &&
                    !isBlindOnlyConsumable(item.id) &&
                    !fableTargetsTiles(item.id)
                      ? {
                          action2Label: t('shop.instantUse'),
                          action2ClassName: 'green',
                          action2Disabled: run.gold < item.price ||
                            (isFableId(item.id) && !canUseUnheldFable(item.id, run, g.state.blind)),
                          onAction2: () => g.buyAndUse(i),
                        }
                      : {})}
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
              ) : null}
            </div>
          </div>

          <div className="panel">
            <div className="label">{t('shop.packs')}</div>
            <div className="shop-row">
              {shop.packs
                .map((p, i) => ({ p, i }))
                .filter((entry): entry is { p: NonNullable<typeof entry.p>; i: number } =>
                  entry.p !== null)
                .map(({ p, i }) => {
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
                      onAction={() => leavePanel(() => g.buyPack(i))}
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

        </div>
      </div>
    </div>
  );
}
