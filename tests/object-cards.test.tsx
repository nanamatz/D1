import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  EmojiTileCard,
  PouchCard,
  RecordCard,
} from '../src/ui/components/ObjectCards';

describe('shared actual-object cards', () => {
  it('owns one motion layer by default and can defer it', () => {
    const props = { className: 'actual-object', role: 'img' as const, 'aria-label': 'Object' };
    const moving = [
      renderToStaticMarkup(createElement(EmojiTileCard, { id: 'bookworm', ...props })),
      renderToStaticMarkup(createElement(PouchCard, { id: 'yellow', ...props })),
      renderToStaticMarkup(createElement(RecordCard, { id: 'whiteLp', ...props })),
    ];
    const flat = [
      renderToStaticMarkup(createElement(EmojiTileCard, { id: 'bookworm', motion: false })),
      renderToStaticMarkup(createElement(PouchCard, { id: 'yellow', motion: false })),
      renderToStaticMarkup(createElement(RecordCard, { id: 'whiteLp', motion: false })),
    ];

    for (const markup of moving) {
      expect(markup.match(/motion-card/g)).toHaveLength(1);
      expect(markup.match(/tilt-sheen/g)).toHaveLength(1);
      expect(markup).toContain('class="actual-object motion-card"');
      expect(markup).toContain('role="img"');
      expect(markup).toContain('aria-label="Object"');
    }
    for (const markup of flat) {
      expect(markup).not.toContain('motion-card');
      expect(markup).not.toContain('tilt-sheen');
    }
  });

  it('routes ordinary object surfaces through the shared renderers', () => {
    const sources = [
      'JokerShelf.tsx',
      'Collection.tsx',
      'NewRun.tsx',
      'BagView.tsx',
      'Sidebar.tsx',
      'Shop.tsx',
      'PackOpening.tsx',
      'UnlockRecap.tsx',
    ].map((file) => readFileSync(`src/ui/components/${file}`, 'utf8')).join('\n');

    expect(sources).toContain('<EmojiTileCard');
    expect(sources).toContain('<PouchCard');
    expect(sources).toContain('<RecordCard');
    expect(readFileSync('src/ui/components/Shop.tsx', 'utf8')).toMatch(
      /<EmojiTileCard[\s\S]*?motion=\{false\}/,
    );
    expect(readFileSync('src/ui/components/PackOpening.tsx', 'utf8')).toMatch(
      /<EmojiTileCard[\s\S]*?motion=\{false\}/,
    );
  });
});
import { readFileSync } from 'node:fs';
