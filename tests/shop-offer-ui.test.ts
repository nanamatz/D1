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
  const screens = source('../src/ui/styles/screens.css');
  const tokens = source('../src/ui/styles/tokens.css');

  it('keeps one selected offer and exposes keyboard selection state', () => {
    expect(shop).toContain('const [selectedOffer, setSelectedOffer]');
    expect(shop).toContain('aria-pressed={selected}');
    expect(shop).toContain('className="shop-offer-select"');
    expect(shop).toContain('type="button"');
    expect(css).toMatch(/\.shop-offer-select\s*\{[^}]*inset:\s*0 0 -12px/s);
  });

  it('uses contextual actions for stock, vouchers, and packs', () => {
    expect(shop).toContain("actionLabel={t('shop.buy')}");
    expect(shop).toContain("actionLabel={t('shop.redeem')}");
    expect(shop).toContain("actionLabel={t('pack.open')}");
    expect(en['shop.redeem']).toBe('Redeem');
    expect(ko['shop.redeem']).toBe('교환');
  });

  it('keeps Buy below and places Use now outside the card on the right', () => {
    expect(css).toMatch(/\.shop-offer-action\s*\{[^}]*top:\s*calc\(100% \+ 8px\)/s);
    expect(css).toMatch(
      /\.shop-offer-action-secondary\s*\{[^}]*top:\s*50%[^}]*left:\s*calc\(100% \+ 12px\)/s,
    );
  });

  it('attaches price to the shared art card and reveals the action only on selection', () => {
    expect(shop.indexOf('shop-offer-card')).toBeLessThan(shop.indexOf('shop-offer-art'));
    expect(shop.indexOf('shop-offer-art')).toBeLessThan(shop.indexOf('shop-offer-price'));
    expect(shop.indexOf('shop-offer-price')).toBeLessThan(shop.indexOf('shop-offer-action'));
    expect(css).toContain('height: var(--shop-card-h)');
    expect(tokens).toContain('--shop-card-w: 124px');
    expect(tokens).toContain('--shop-card-h: 165px');
    expect(tokens).toContain('--voucher-w: var(--shop-card-w)');
    expect(tokens).toContain('--voucher-h: var(--shop-card-h)');
    expect(tokens).toContain('--shop-lower-panel-h: 273px');
    expect(css).toContain('min-height: var(--shop-lower-panel-h)');
    expect(css).toContain('.shop-offer-visual');
    expect(css).toContain('.shop-offer-art');
    expect(css).toContain('top: -23px');
    expect(css).toMatch(
      /\.shop-offer-visual:has\(> \.shop-offer-art \.pack-img\)\s*\{[^}]*width:\s*131px;[^}]*height:\s*229px;/s,
    );
    expect(css).toMatch(
      /\.shop-row:has\(\.pack-img\) > \.tt-anchor\s*\{[^}]*flex:\s*0 0 131px;[^}]*width:\s*131px;/s,
    );
    expect(css).toMatch(
      /\.shop-two > \.panel:has\(\.pack-img\)\s*\{[^}]*padding-bottom:\s*84px;/s,
    );
    expect(css).toMatch(
      /\.shopitem \.pack-img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*max-width:\s*none;[^}]*border-radius:\s*0;/s,
    );
    expect(css).toMatch(
      /\.shopitem-image-only:has\(\.pack-img\)\s*\{[^}]*border-radius:\s*0;[^}]*overflow:\s*visible;/s,
    );
    expect(css).toMatch(/\.shop-joker-art,[\s\S]*?border-radius:\s*var\(--r-md\)/);
    expect(screens).toMatch(
      /\.pack-gallery-card\s*\{[^}]*width:\s*81px;[^}]*height:\s*132px;[^}]*border-radius:\s*0;/s,
    );
    expect(css).toContain('top: calc(100% + 8px)');
    expect(css).toContain('overflow: visible');
    expect(css).toContain('background: transparent');
    expect(css).toContain('.shop-offer.selected .shop-offer-action');
    expect(css).toMatch(
      /\.shop-offer\.selected\s*\{[^}]*translate:\s*0 calc\(-15px - var\(--shop-action-h\)\);/s,
    );
    expect(tokens).toContain('--shop-action-h: 44px');
  });

  it('does not render persistent product names or pack-grade text in sale slots', () => {
    expect(shop).not.toContain('<span className="n">');
    expect(shop).not.toContain('<span className="pack-size">');
  });

  it('renders every consumable card family through the shared card art', () => {
    for (const family of ['fable', 'constellation', 'gambler']) {
      expect(shop).toContain(`m.classification === '${family}'`);
    }
    expect(shop).toContain('family={m.classification}');
  });
});
