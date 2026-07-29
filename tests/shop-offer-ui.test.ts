import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import ko from '../locales/ko.json';

const source = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('image-first shop offers', () => {
  const shop = source('../src/ui/components/Shop.tsx');
  const css = source('../src/ui/styles/play.css');
  const tokens = source('../src/ui/styles/tokens.css');

  it('keeps one selected offer and exposes keyboard selection state', () => {
    expect(shop).toContain('const [selectedOffer, setSelectedOffer]');
    expect(shop).toContain('aria-pressed={selected}');
    expect(shop).toContain("e.key === 'Enter' || e.key === ' '");
  });

  it('uses contextual actions for stock, vouchers, and packs', () => {
    expect(shop).toContain("actionLabel={t('shop.buy')}");
    expect(shop).toContain("actionLabel={t('shop.redeem')}");
    expect(shop).toContain("actionLabel={t('pack.open')}");
    expect(en['shop.redeem']).toBe('Redeem');
    expect(ko['shop.redeem']).toBe('교환');
  });

  it('attaches price to the shared art card and reveals the action only on selection', () => {
    expect(shop.indexOf('shop-offer-card')).toBeLessThan(shop.indexOf('shop-offer-art'));
    expect(shop.indexOf('shop-offer-art')).toBeLessThan(shop.indexOf('shop-offer-price'));
    expect(shop.indexOf('shop-offer-price')).toBeLessThan(shop.indexOf('shop-offer-action'));
    expect(css).toContain('height: var(--shop-card-h)');
    expect(tokens).toContain('--shop-card-w: 144px');
    expect(tokens).toContain('--shop-card-h: 185px');
    expect(tokens).toContain('--shop-lower-panel-h: 273px');
    expect(css).toContain('min-height: var(--shop-lower-panel-h)');
    expect(css).toContain('.shop-offer-visual');
    expect(css).toContain('.shop-offer-art');
    expect(css).toContain('top: -23px');
    expect(css).toContain('top: var(--shop-pack-y)');
    expect(css).toContain('height: 88%');
    expect(css).toContain('top: calc(100% + 8px)');
    expect(css).toContain('overflow: visible');
    expect(css).toContain('background: transparent');
    expect(css).toContain('.shop-offer.selected .shop-offer-action');
    expect(css).toContain('.shop-offer.selected .shop-offer-visual');
  });

  it('does not render persistent product names or pack-grade text in sale slots', () => {
    expect(shop).not.toContain('<span className="n">');
    expect(shop).not.toContain('<span className="pack-size">');
  });
});
