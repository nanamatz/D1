import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { skipRewardCollectionDescKey } from '../src/ui/skipRewardTooltip';

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('Blind Select skip presentation', () => {
  it('renders image tags through the shared tooltip and skips only non-boss cards', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    expect(view).toContain('<Tooltip');
    expect(view).toContain('<TiltCard');
    expect(view).toContain('SKIP_REWARD_ART[skipOffer.id]');
    expect(view).toContain("kind === 'boss' ? null");
    expect(view).toContain('window.setTimeout(g.skipBlind, 360)');
    expect(view).toContain("t('blindselect.editorialPerk')");
  });

  it('keeps Select above blind content and the tag immediately before bottom-anchored Skip', () => {
    const view = source('src/ui/components/BlindSelect.tsx');
    expect(view.indexOf('bs-select-tilt')).toBeLessThan(view.indexOf('className="bs-kind"'));
    expect(view.indexOf('className="bs-tag-icon"')).toBeLessThan(view.indexOf('className="btn red bs-skip"'));
    expect(view).toContain("tilt={status === 'current' && !leaving}");

    const tiltCard = source('src/ui/components/TiltCard.tsx');
    expect(tiltCard).toContain('usePointerTilt(ref, tilt)');

    const css = source('src/ui/styles/screens.css');
    expect(css).toMatch(/\.bs-skip-zone\s*\{[^}]*margin-top:\s*auto/s);
    expect(css).toMatch(/\.bs-control-tilt > \.btn\s*\{[^}]*min-height:\s*44px/s);
    expect(css).toContain('.bs-control-tilt.tilting');
  });

  it('ships one transparent PNG asset for every Editorial Perk', () => {
    const files = readdirSync(new URL('../src/ui/assets/skip-rewards/', import.meta.url));
    const pngs = files.filter((name) => name.endsWith('.png'));
    expect(pngs).toHaveLength(27);
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

  it('renders Voucher Tag as an extra choice and Coupon packs at zero price', () => {
    const shop = source('src/ui/components/Shop.tsx');
    expect(shop).toContain("['bonus', shop.bonusVoucher]");
    expect(shop).toContain('g.buyVoucher(slot)');
    expect(shop).toMatch(/const price = p\.free\s*\? 0/s);
  });
});
