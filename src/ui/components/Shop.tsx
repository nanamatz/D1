import { JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { BALANCE } from '../../engine/balance';
import { rerollCost, sellValue } from '../../engine/economy';
import { rerollDiscount } from '../../engine/vouchers';
import type { ConsumableId, ShopItem } from '../../engine/types';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };

/** The shop screen between blinds (GDD §9). Buy/sell/reroll, then Next blind. */
export function Shop({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, shop } = g.state;
  if (!shop) return null;

  const itemMeta = (item: ShopItem): { emoji: string; name: string } => {
    if (item.kind === 'joker') {
      const def = JOKER_REGISTRY.get(item.id);
      return { emoji: def?.emoji ?? '🃏', name: def ? (lang === 'ko' ? def.nameKo : def.nameEn) : item.id };
    }
    return { emoji: CONSUMABLE_EMOJI[item.id] ?? '📄', name: t(`consumable.${item.id}`) };
  };

  const affordable = (item: ShopItem): boolean => {
    if (run.gold < item.price) return false;
    return item.kind === 'joker'
      ? run.jokers.length < BALANCE.jokerSlots
      : run.consumables.length < run.consumableSlots;
  };

  const cost = rerollCost(shop.rerolls, rerollDiscount(run));
  const voucher = shop.voucher ? VOUCHER_REGISTRY.get(shop.voucher) : undefined;

  return (
    <div className="shop">
      <div className="shop-head panel">
        <div className="kind">{t('shop.title')}</div>
        <div className="money">{t('shop.gold', { n: run.gold })}</div>
        <button className="btn cash" onClick={g.leaveShop}>
          {t('shop.next')}
        </button>
      </div>

      <div className="panel">
        <div className="label">{t('shop.forSale')}</div>
        <div className="shop-row">
          {shop.items.map((item, i) =>
            item ? (
              <div key={i} className="shopitem">
                <span className="e">{itemMeta(item).emoji}</span>
                <span className="n">{itemMeta(item).name}</span>
                <span className="price">${item.price}</span>
                <button className="btn exchange sm" disabled={!affordable(item)} onClick={() => g.buy(i)}>
                  {t('shop.buy')}
                </button>
              </div>
            ) : (
              <div key={i} className="shopitem empty">
                {t('shop.sold')}
              </div>
            ),
          )}
          <button className="btn play sm reroll" disabled={run.gold < cost} onClick={g.reroll}>
            {t('shop.reroll', { cost })}
          </button>
        </div>
      </div>

      <div className="shop-two">
        {voucher && (
          <div className="panel">
            <div className="label">{t('shop.vouchers')}</div>
            <div className="shop-row">
              <div className="shopitem">
                <span className="e">{voucher.emoji}</span>
                <span className="n">{lang === 'ko' ? voucher.nameKo : voucher.nameEn}</span>
                <span className="price">${voucher.price}</span>
                <button
                  className="btn exchange sm"
                  disabled={run.gold < voucher.price}
                  onClick={g.buyVoucher}
                >
                  {t('shop.buy')}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="label">{t('shop.packs')}</div>
          <div className="shop-row">
            {shop.packs.map((p, i) =>
              p ? (
                <div key={i} className="shopitem">
                  <span className="e">📦</span>
                  <span className="n">{t(`pack.${p}`)}</span>
                  <span className="price">${BALANCE.packPrice[p]}</span>
                  <button
                    className="btn play sm"
                    disabled={run.gold < (BALANCE.packPrice[p] ?? 0)}
                    onClick={() => g.buyPack(i)}
                  >
                    {t('pack.open')}
                  </button>
                </div>
              ) : (
                <div key={i} className="shopitem empty">
                  {t('shop.sold')}
                </div>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="label">{t('shop.yourJokers')}</div>
        <div className="shop-row">
          {run.jokers.length === 0 && <span className="empty">{t('shop.noJokers')}</span>}
          {run.jokers.map((owned, i) => {
            const def = JOKER_REGISTRY.get(owned.defId);
            if (!def) return null;
            const name = lang === 'ko' ? def.nameKo : def.nameEn;
            const value = sellValue(BALANCE.jokerPrice[def.rarity]);
            return (
              <div key={i} className={['shopitem', def.rarity !== 'common' ? def.rarity : ''].filter(Boolean).join(' ')}>
                <span className="e">{def.emoji}</span>
                <span className="n">{name}</span>
                <button className="btn exchange sm" onClick={() => g.sell(i)}>
                  {t('shop.sell', { value })}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
