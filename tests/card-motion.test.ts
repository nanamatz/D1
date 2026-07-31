import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TiltCard } from '../src/ui/components/TiltCard';
import { VoucherCard } from '../src/ui/components/VoucherCard';

describe('shared card motion', () => {
  it('adds idle motion and cursor sheen without dropping caller classes', () => {
    const markup = renderToStaticMarkup(createElement(
      TiltCard,
      { idle: true, className: 'fable-card' },
      'card',
    ));

    expect(markup).toContain('fable-card motion-card');
    expect(markup).toContain('class="tilt-sheen"');
  });

  it('makes every voucher use the shared motion wrapper', () => {
    const markup = renderToStaticMarkup(createElement(VoucherCard, {
      emoji: 'V',
      name: 'Voucher',
    }));

    expect(markup).toContain('voucher-card motion-card');
    expect(markup).toContain('class="tilt-sheen"');
  });

  it('renders the vertical shred layer only while a voucher is redeeming', () => {
    const resting = renderToStaticMarkup(createElement(VoucherCard, {
      emoji: 'V',
      name: 'Voucher',
      motion: false,
    }));
    const redeeming = renderToStaticMarkup(createElement(VoucherCard, {
      emoji: 'V',
      name: 'Voucher',
      motion: false,
      redeeming: true,
    }));

    expect(resting).not.toContain('voucher-card__shred');
    expect(redeeming).toContain('voucher-card redeeming');
    expect(redeeming).toContain('voucher-card__shred');
  });

  it('defines idle, pointer tilt, sheen, and reduced-motion fallbacks', () => {
    const screens = readFileSync(
      fileURLToPath(new URL('../src/ui/styles/screens.css', import.meta.url)),
      'utf8',
    );
    const play = readFileSync(
      fileURLToPath(new URL('../src/ui/styles/play.css', import.meta.url)),
      'utf8',
    );

    expect(screens).toContain('@keyframes cardIdleFloat');
    expect(screens).toContain('@keyframes voucher-shred-head');
    expect(screens).toContain('translateY(calc(var(--voucher-h) + 12px))');
    expect(screens).toContain('@keyframes voucher-shred-release');
    expect(screens).toContain('.motion-card.tilting');
    expect(screens).toContain('@media (prefers-reduced-motion: reduce)');
    expect(play).toContain('.motion-card.tilting');
    expect(play).toContain('.tilting > .tilt-sheen');
  });
});
