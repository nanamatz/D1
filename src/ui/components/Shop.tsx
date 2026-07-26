import { JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { BALANCE } from '../../engine/balance';
import { rerollCost } from '../../engine/economy';
import { canAddJoker, discountedPrice, rerollDiscount } from '../../engine/vouchers';
import type { ConsumableId, JokerRarity, ShopItem } from '../../engine/types';
import { consumableDescKey, jokerDescKey, voucherDescKey } from '../descriptions';
import { audio } from '../audio';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { Tooltip } from './Tooltip';
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

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

/** The shop screen between blinds (GDD §9.2). Buy/sell/reroll, then Next blind. */
export function Shop({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, shop } = g.state;
  if (!shop) return null;

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
      return {
        emoji: item.tile.letter ?? '◆',
        name: item.tile.letter ?? t('material.stone'),
        desc: t('tile.chips', {
          n: item.tile.letter ? (BALANCE.letterChips[item.tile.letter] ?? 0) : 0,
        }),
      };
    }
    return {
      emoji: CONSUMABLE_EMOJI[item.id] ?? '📄',
      name: t(`consumable.${item.id}`),
      desc: t(consumableDescKey(item.id)),
      fableId: isFableId(item.id) ? item.id : undefined,
      art: isConstellationId(item.id) ? constellationArt(item.id) : undefined,
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
                  <div key={i} className="shopitem empty">
                    {t('shop.sold')}
                  </div>
                );
              }
              const m = itemMeta(item);
              const edition =
                item.kind === 'joker' ? (item.edition ?? 'base')
                  : item.kind === 'tile' ? (item.tile.edition ?? 'base')
                    : 'base';
              return (
                <Tooltip key={i} title={m.name} body={m.desc} rarity={m.rarity}>
                  <div className={['shopitem', m.accent, `edition-${edition}`].filter(Boolean).join(' ')}>
                    {m.fableId ? (
                      <FableCardArt
                        id={m.fableId}
                        className="shop-consumable-art"
                        title={m.name}
                      />
                    ) : m.art ? (
                      <img className="shop-consumable-art" src={m.art} alt="" />
                    ) : (
                      <span className="e">{m.emoji}</span>
                    )}
                    <span className="n">{m.name}</span>
                    {edition !== 'base' && <span className="edition-badge">{edition}</span>}
                    <span className="price">${item.price}</span>
                    <button
                      className="btn exchange sm"
                      disabled={!affordable(item)}
                      onClick={() => g.buy(i)}
                    >
                      {t('shop.buy')}
                    </button>
                  </div>
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
                >
                  <div className="voucher-shop-stack">
                    <VoucherCard
                      emoji={voucher.emoji}
                      name={lang === 'ko' ? voucher.nameKo : voucher.nameEn}
                      artSrc={voucherArt(voucher.id)}
                    />
                    <span className="price">${voucher.price}</span>
                    <button
                      className="btn exchange sm"
                      disabled={run.gold < voucher.price}
                      onClick={g.buyVoucher}
                    >
                      {t('shop.buy')}
                    </button>
                  </div>
                </Tooltip>
              ) : (
                <VoucherCard emoji="—" name={t('shop.sold')} muted />
              )}
            </div>
          </div>

          <div className="panel">
            <div className="label">{t('shop.packs')}</div>
            <div className="shop-row">
              {shop.packs.map((p, i) => {
                if (!p) {
                  return (
                    <div key={i} className="shopitem empty">
                      {t('shop.sold')}
                    </div>
                  );
                }
                const tip = packTooltip(p.type, p.size, t);
                return (
                  <Tooltip key={i} title={tip.title} body={tip.body} grade={tip.grade}>
                    <div className={['shopitem', `pack-${p.size}`].join(' ')}>
                      {/* Tile / Charm / Ink packs have art; Consumable keeps the 📦 glyph. */}
                      {packArt(p.type, p.size, p.artVariant) ? (
                        <img className="pack-img" src={packArt(p.type, p.size, p.artVariant)!} alt="" />
                      ) : (
                        <span className="e">📦</span>
                      )}
                      <span className="n">{t(`pack.type.${p.type}`)}</span>
                      <span className="pack-size">{t(`pack.size.${p.size}`)}</span>
                      <span className="price">${discountedPrice(run, BALANCE.pack.size[p.size].price)}</span>
                      <button
                        className="btn green sm"
                        disabled={run.gold < discountedPrice(run, BALANCE.pack.size[p.size].price)}
                        onClick={() => g.buyPack(i)}
                      >
                        {t('pack.open')}
                      </button>
                    </div>
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
