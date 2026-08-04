import { useEffect, useRef, useState, type ReactNode } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { BALANCE } from '../../engine/balance';
import { rerollCost } from '../../engine/economy';
import { canBuyVoucher } from '../../engine/shop';
import { canAddJoker, discountedPrice, rerollDiscount } from '../../engine/vouchers';
import { motionOff } from '../motion';
import type { ConsumableId, JokerRarity, ShopItem } from '../../engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
  grownValue,
  jokerTooltip,
  voucherDescKey,
} from '../descriptions';
import { useI18n } from '../i18n';
import { tileTooltip } from '../game';
import type { UseGame } from '../useGame';
import {
  Tooltip,
  type TooltipClassification,
  type TooltipDetail,
  type TooltipTag,
} from './Tooltip';
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
} from '../../engine/fables';
import { TiltCard } from './TiltCard';
import { consumableClassification } from '../cardClassification';
import { TileView } from './Tile';
import { jokerArt } from '../jokerArt';
import { CardArt } from './CardArt';
import { UiIcon } from './UiIcon';
import type { UiIconId } from '../uiIcons';
import { audio } from '../audio';

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
  artClassName?: string | undefined;
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
  artClassName,
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
          <div className={['shop-offer-art', artClassName].filter(Boolean).join(' ')}>
            {children}
          </div>
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

const CONSUMABLE_ICON: Partial<Record<ConsumableId, UiIconId>> = { magnifier: 'magnifier' };
const VOUCHER_REDEEM_MS = 720;

/** The shop screen between blinds (GDD §9.2). Buy/sell/reroll, then Next blind. */
export function Shop({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, shop } = g.state;
  const [selectedOffer, setSelectedOffer] = useState<string | null>(null);
  const [redeemingVoucher, setRedeemingVoucher] = useState<'base' | 'bonus' | null>(null);
  const redeemTimer = useRef<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const rainbowOfferSignature = shop
    ? `${shop.rerolls}:${shop.items.map((item, index) => {
        if (item?.kind === 'joker' && (item.edition ?? 'base') === 'rainbow') {
          return `j:${index}:${item.id}`;
        }
        if (item?.kind === 'tile' && (item.tile.edition ?? 'base') === 'rainbow') {
          return `t:${index}:${item.tile.id}`;
        }
        return '';
      }).filter(Boolean).join('|')}`
    : '';
  useEffect(() => setSelectedOffer(null), [shop]);
  useEffect(() => {
    if (rainbowOfferSignature.split(':').at(-1)) audio.play('rainbowShimmer');
  }, [rainbowOfferSignature]);
  useEffect(() => () => {
    if (redeemTimer.current !== null) window.clearTimeout(redeemTimer.current);
  }, []);
  if (!shop) return null;

  const toggleOffer = (key: string) => {
    if (redeemingVoucher) return;
    setSelectedOffer((current) => current === key ? null : key);
  };
  const leavePanel = (action: () => void) => {
    if (leaving || redeemingVoucher) return;
    setLeaving(true);
    window.setTimeout(action, 360);
  };

  const itemMeta = (
    item: ShopItem,
  ): {
    emoji?: string;
    icon?: UiIconId;
    name: string;
    desc: string;
    jokerArt?: string | undefined;
    rarity?: JokerRarity | undefined;
    classification?: TooltipClassification | undefined;
    tags?: readonly TooltipTag[];
    sub?: TooltipDetail | readonly TooltipDetail[] | undefined;
    extra?: string | undefined;
  } => {
    if (item.kind === 'joker') {
      const def = JOKER_REGISTRY.get(item.id);
      const tip = jokerTooltip(item.id, item.edition ?? 'base', t);
      return {
        name: def ? (lang === 'ko' ? def.nameKo : def.nameEn) : item.id,
        desc: tip.body,
        tags: tip.tags,
        sub: tip.sub,
        extra: def
          ? grownValue(def, undefined, t, g.state.run.bag.length) ?? undefined
          : undefined,
        rarity: def?.rarity,
        jokerArt: jokerArt(item.id),
      };
    }
    if (item.kind === 'tile') {
      // The shared 3-axis tile tooltip (feature-04 B) — material/font/edition each
      // with its effect, so a shop tile reads the same as one in hand.
      const tip = tileTooltip(item.tile, t);
      return {
        emoji: item.tile.letter ?? '◆',
        name: tip.title,
        desc: tip.body,
        tags: tip.tags,
        sub: tip.sub,
      };
    }
    return {
      icon: CONSUMABLE_ICON[item.id] ?? 'document',
      name: t(`consumable.${item.id}`),
      desc: consumableTooltipBody(item.id, t),
      classification: consumableClassification(item.id),
      sub: consumableAxisTip(item.id, t) ?? undefined,
      extra: consumableTooltipExtra(item.id, run, t) ?? undefined,
    };
  };

  const affordable = (item: ShopItem): boolean => {
    if (redeemingVoucher || run.gold < item.price) return false;
    return item.kind === 'joker'
      ? canAddJoker(run, item.id, item.edition ?? 'base')
      : item.kind === 'tile' || run.consumables.length < run.consumableSlots;
  };

  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  const redeemVoucher = (slot: 'base' | 'bonus', price: number) => {
    if (redeemingVoucher || !canBuyVoucher(run, shop, slot) || run.gold < price) return;
    setRedeemingVoucher(slot);
    redeemTimer.current = window.setTimeout(() => {
      g.buyVoucher(slot);
      setRedeemingVoucher(null);
      redeemTimer.current = null;
    }, motionOff() ? 0 : VOUCHER_REDEEM_MS);
  };

  return (
    <div
      className={[
        'shop2',
        leaving && 'phase-panel-leaving',
        redeemingVoucher && 'voucher-redeeming',
      ].filter(Boolean).join(' ')}
      aria-busy={!!redeemingVoucher}
    >
      <aside className="shop-rail">
        <button
          className="btn play next-blind"
          disabled={!!redeemingVoucher}
          onClick={() => leavePanel(g.leaveShop)}
        >
          {t('shop.next')}
        </button>
        <button
          className="btn green reroll-btn"
          disabled={!!redeemingVoucher || run.gold < cost}
          onClick={g.reroll}
        >
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
                  tags={m.tags}
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
                    artClassName={item.kind === 'joker'
                      ? `emoji-tile-image-only edition-${edition}`
                      : undefined}
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
                    ) : item.kind === 'joker' ? (
                      m.jokerArt
                        ? (
                            <img
                              className="shop-joker-art"
                              src={m.jokerArt}
                              alt=""
                            />
                          )
                        : null
                    ) : (
                      <div
                        className={[
                          'shopitem',
                          'shopitem-image-only',
                          `edition-${edition}`,
                        ].filter(Boolean).join(' ')}
                      >
                        {m.classification === 'fable' ||
                        m.classification === 'constellation' ||
                        m.classification === 'gambler' ? (
                          <CardArt
                            family={m.classification}
                            id={item.id}
                            className="shop-consumable-art"
                            title={m.name}
                          />
                        ) : (
                          m.icon
                            ? <UiIcon name={m.icon} className="object-ui-icon" />
                            : <span className="e">{m.emoji}</span>
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
              {([
                ['base', shop.voucher],
                ['bonus', shop.bonusVoucher],
              ] as const).map(([slot, id]) => {
                const voucher = id ? VOUCHER_REGISTRY.get(id) : undefined;
                if (!voucher) return null;
                const offerKey = `voucher-${slot}`;
                return (
                  <Tooltip
                    key={slot}
                    title={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                    body={t(voucherDescKey(voucher.id))}
                    classification="voucher"
                  >
                    <ShopOffer
                      label={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                      price={voucher.price}
                      selected={selectedOffer === offerKey}
                      actionLabel={t('shop.redeem')}
                      actionClassName="exchange"
                      disabled={
                        !!redeemingVoucher
                        || !canBuyVoucher(run, shop, slot)
                        || run.gold < voucher.price
                      }
                      onSelect={() => toggleOffer(offerKey)}
                      onAction={() => redeemVoucher(slot, voucher.price)}
                    >
                      <VoucherCard
                        name={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                        artSrc={voucherArt(voucher.id)}
                        redeeming={redeemingVoucher === slot}
                        motion={false}
                      />
                    </ShopOffer>
                  </Tooltip>
                );
              })}
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
                const price = p.free
                  ? 0
                  : discountedPrice(run, BALANCE.pack.size[p.size].price);
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
                      disabled={!!redeemingVoucher || run.gold < price}
                      onSelect={() => toggleOffer(offerKey)}
                      onAction={() => leavePanel(() => g.buyPack(i))}
                    >
                      <div
                        className={['shopitem', 'shopitem-image-only', `pack-${p.size}`].join(' ')}
                      >
                        {art ? (
                          <img className="pack-img" src={art} alt="" />
                        ) : (
                          <UiIcon name="package" className="object-ui-icon" />
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
