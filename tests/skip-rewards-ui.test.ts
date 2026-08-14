import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { skipRewardCollectionDescKey } from '../src/ui/skipRewardTooltip';
import { pendingSkippedTagIndices } from '../src/ui/components/BlindSelect';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Blind Select skip presentation', () => {
  it('renders image tags through the shared tooltip and skips only non-boss cards', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    expect(view).toContain('<Tooltip');
    expect(view).toContain('<TiltCard');
    expect(view).toContain('SKIP_REWARD_ART[skipOffer.id]');
    expect(view).toContain("kind === 'boss' ? null");
    expect(view).toContain('window.setTimeout(action, 360)');
    expect(view).toContain('leave(g.skipBlind)');
    expect(view).toContain("t('blindselect.editorialPerk')");
  });

  it('keeps Select above blind content and the tag immediately before bottom-anchored Skip', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    expect(view.indexOf('bs-select-tilt')).toBeLessThan(view.indexOf('className="bs-kind"'));
    expect(view.indexOf('className="bs-tag-icon"')).toBeLessThan(view.indexOf('className="btn red bs-skip"'));
    expect(view).toContain("tilt={status === 'current' && !busy}");

    const tiltCard = source('src/ui/components/TiltCard.tsx');
    expect(tiltCard).toContain('usePointerTilt(ref, tilt)');

    const css = source('src/ui/styles/screens.css');
    expect(css).toMatch(/\.bs-skip-zone\s*\{[^}]*margin-top:\s*auto/s);
    expect(css).toMatch(/\.bs-control-tilt > \.btn\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toContain('.bs-control-tilt.tilting');
  });

  it('keeps only the pending skip chain, then redeems it on blind entry', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    const runView = source('src/ui/components/RunView.tsx');
    const runInfo = source('src/ui/components/RunInfo.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(pendingSkippedTagIndices(1, [0])).toEqual([0]);
    expect(pendingSkippedTagIndices(2, [0, 1])).toEqual([0, 1]);
    expect(pendingSkippedTagIndices(2, [0])).toEqual([]);
    expect(view).toContain("const redeemingNextBlind = phase === 'playing'");
    expect(view).toContain("!isNextShopSkipReward(offer.id)");
    expect(view).toContain('blindselect.tagApplied');
    expect(view).toContain('disabled={tagDisabled}');
    expect(view).toContain('tilt={!tagDisabled}');
    expect(view).toContain('tabIndex={tagDisabled ? -1 : 0}');
    expect(runView).toContain('<SkippedTagStack g={g} />');
    expect(runInfo).toContain('className="bs-skipped-stamp"');
    expect(css).toMatch(/\.run-tag-stack\s*\{[^}]*bottom:[^;}]+;[^}]*flex-direction:\s*column-reverse/s);
    expect(css).toContain('.run-tag-icon.tag-redeeming');
    expect(css).toContain('@keyframes run-tag-redeem');
    expect(css).toContain('.bs-card.skipped::after');
    expect(css).toContain('@keyframes bs-skipped-stamp-in');
    expect(css).toContain('.bs-card.skipped .bs-tag-icon');
  });

  it('auto-redeems immediate Tags before running their existing effect path', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(view).toContain('isImmediateSkipReward(skipOffer.id)');
    expect(view).toContain('setAutoRedeeming(skipOffer)');
    expect(view).toContain("event.animationName !== 'skip-tag-auto-redeem'");
    expect(view.indexOf('setAutoRedeeming(null)')).toBeLessThan(view.lastIndexOf('leave(g.skipBlind)'));
    expect(view).toContain('SKIP_REWARD_ART[autoRedeeming.id]');
    expect(view).toContain("t('blindselect.tagAutoActivated')");
    expect(css).toContain('@keyframes skip-tag-auto-redeem');
  });

  it('keeps next-shop Tags until stock consumes them on the Shop screen', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    const game = source('src/ui/useGame.ts');
    const shop = source('src/engine/shop.ts');

    expect(view).toContain('run.pendingShopTags.map');
    expect(view).toContain("const redeemingShop = phase === 'shop' && pack === null");
    expect(view).toContain("t(redeemingShop ? 'blindselect.shopTagApplied'");
    expect(view).toContain('g.clearShopTagRedemptions()');
    expect(game).toContain('shopTagRedemptions: preparedShop.appliedTags');
    expect(game).toContain('shopTagRedemptions: res.appliedTags ?? []');
    expect(shop).toContain('appliedTags: tags.filter((_, index) => consumed.has(index))');
  });

  it('keeps Investment Tag pending until the Deadline Fee Settlement', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    const css = source('src/ui/styles/screens.css');

    expect(view).toContain("offer.id !== 'investmentTag'");
    expect(view).toContain('run.pendingBossReward > 0');
    expect(view).toContain("phase === 'cashout' && blind.kind === 'boss'");
    expect(view).toContain('...investmentTags');
    expect(view).toContain("redeeming && 'redeeming'");
    expect(css).toMatch(/\.run-tag-stack\.redeeming\s*\{[^}]*z-index:\s*54/s);
  });

  it('ships one transparent PNG asset for every Editorial Perk', () => {
    const files = readdirSync(new URL('../src/ui/assets/skip-rewards/', import.meta.url));
    const pngs = files.filter((name) => name.endsWith('.png'));
    expect(pngs).toHaveLength(30);
    expect(pngs).not.toContain('lead-story.png');
    for (const name of pngs) {
      const png = readFileSync(new URL(`../src/ui/assets/skip-rewards/${name}`, import.meta.url));
      expect(png.readUInt32BE(16), name).toBe(160);
      expect(png.readUInt32BE(20), name).toBe(160);
      expect(png[25], `${name} must use RGBA colour type`).toBe(6);
    }
  });

  it('uses generic Collection copy for rewards that require a live offer or run', () => {
    expect(skipRewardCollectionDescKey('houseStyle')).toBe('skipReward.houseStyle.collectionDesc');
    expect(skipRewardCollectionDescKey('handyTag')).toBe('skipReward.handyTag.collectionDesc');
    expect(skipRewardCollectionDescKey('garbageTag')).toBe('skipReward.garbageTag.collectionDesc');
    expect(skipRewardCollectionDescKey('advancePayment')).toBe('skipReward.advancePayment.desc');
  });

  it('opens a free Tag pack before drawing the next blind', () => {
    const game = source('src/ui/useGame.ts');
    expect(game).toContain('pendingBlindAfterPack: pack !== null');
    expect(game).toContain("phase: pack ? 'shop' : 'blindselect'");
    expect(game).toContain('completePendingPackTransition({ ...prev, pack: null })');
    expect(game).toContain('const blind = startBlind(state.run, rng');
    expect(game).not.toContain('if (!state.pendingBlindAfterPack || state.pack) return;');
  });

  it('renders Voucher Tag as a shared-gated extra purchase and Coupon packs at zero price', () => {
    const shop = source('src/ui/components/Shop.tsx');
    expect(shop).toContain("['bonus', shop.bonusVoucher]");
    expect(shop).toContain('g.buyVoucher(slot)');
    expect(shop).toContain('canBuyVoucher(run, shop, slot)');
    expect(shop).toMatch(/const price = p\.free\s*\? 0/s);
  });
});
