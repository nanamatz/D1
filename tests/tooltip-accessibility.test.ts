import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { consumeTooltipEscape } from '../src/ui/components/Tooltip';

const source = (path: string) => readFileSync(path, 'utf8');

describe('shared tooltip accessibility', () => {
  it('opens from focus-visible and links the focused object to the portal', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("matches(':focus-visible')");
    expect(tooltip).toContain('setFocusedTarget(focusTarget)');
    expect(tooltip).toContain('document.activeElement instanceof HTMLElement');
    expect(tooltip).toContain('anchor()?.contains(document.activeElement)');
    expect(tooltip).toContain('const node = focusedTarget ?? activeTarget');
    expect(tooltip).not.toContain('focusedTarget ?? target()');
    expect(tooltip).toContain("'aria-describedby'");
    expect(tooltip).toContain("createPortal(card, document.body)");
  });

  it('routes letter tiles through the shared compact tooltip', () => {
    const tile = source('src/ui/components/Tile.tsx');
    expect(tile).toContain('anchorRef={rootRef}');
    expect(tile).toContain('compact');
    expect(tile).not.toContain('createPortal');
    expect(tile).not.toContain('tile-tt-portal');
  });

  it('makes the pouch dock a keyboard-reachable dialog control', () => {
    const pouch = source('src/ui/components/BagView.tsx');
    expect(pouch).toContain('<button');
    expect(pouch).toContain('aria-haspopup="dialog"');
    expect(pouch).toContain('aria-controls="pouch-contents-dialog"');
    expect(pouch).toContain('<Tooltip');
  });

  it('wraps every tooltip and pouch description at word boundaries', () => {
    const css = source('src/ui/styles/screens.css');
    expect(css).toMatch(
      /\.tt-card\.tt-portal,\s*\.select-desc,\s*\.pouch-selected-info p\s*\{[^}]*word-break:\s*keep-all;[^}]*overflow-wrap:\s*normal;/s,
    );
  });

  it('clears stale hover and focus when a tooltip is disabled', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toMatch(/if \(!disabled\) return;\s+close\(\);/);
    expect(tooltip).toMatch(/const close = \(\) => \{[\s\S]*setFocusedTarget\(null\);[\s\S]*releaseTooltip\(tooltipId\);/);
  });

  it('allows only one hover, focus, or touch tooltip to own the portal', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("type TooltipMode = 'hover' | 'focus' | 'touch'");
    expect(tooltip).toContain('TOOLTIP_MODE_PRIORITY[activeTooltip.mode] > TOOLTIP_MODE_PRIORITY[mode]');
    expect(tooltip).toContain('previous?.close()');
    expect(tooltip.match(/claimTooltip\(tooltipId, '(?:hover|focus|touch)', close\)/g)).toHaveLength(3);
    expect(tooltip).toContain('releaseTooltip(tooltipId)');
  });

  it('keeps focus and touch owners above incidental hover and releases on listener cleanup', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("{ hover: 0, focus: 1, touch: 1 }");
    expect(tooltip).toContain("if (!claimTooltip(tooltipId, 'hover', close)) return");
    expect(tooltip).toContain('leaveFocusedTooltip(tooltipId)');
    const listenerCleanup = tooltip.slice(
      tooltip.indexOf("node.removeEventListener('pointerenter'"),
      tooltip.indexOf('}, [disabled, down, externalAnchorRef, touchPin])'),
    );
    expect(listenerCleanup).toContain('releaseTooltip(tooltipId)');
  });

  it('keeps the actual focused control through repeated touch pins', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    const press = tooltip.slice(tooltip.indexOf('const press ='), tooltip.indexOf('const release ='));
    expect(press).not.toContain('setFocusedTarget(null)');
    expect(tooltip).toMatch(/const hideFocus[\s\S]*setFocusedTarget\(null\);/);
    expect(tooltip).toContain('const node = focusedTarget ?? activeTarget');
  });

  it('pins on non-mouse pointer-up and closes on outside tap or Escape', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("event.pointerType === 'mouse'");
    expect(tooltip).toContain('setTouchPinned((pinned) => !pinned)');
    expect(tooltip).toContain("document.addEventListener('pointerdown', closeOutside)");
    const pointerHandlers = tooltip.slice(
      tooltip.indexOf('const press ='),
      tooltip.indexOf("node.addEventListener('pointerenter'"),
    );
    expect(pointerHandlers).not.toContain('preventDefault()');
    expect(pointerHandlers).not.toContain('stopPropagation()');
  });

  it('consumes only the first active-tooltip Escape before global Back/Pause', () => {
    let active = true;
    const close = vi.fn(() => { active = false; });
    const downstream = vi.fn();
    const unrelated = {
      key: 'Enter',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    expect(consumeTooltipEscape(unrelated, active, close)).toBe(false);
    expect(unrelated.preventDefault).not.toHaveBeenCalled();
    expect(unrelated.stopPropagation).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    const dispatch = () => {
      const event = {
        key: 'Escape',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };
      if (!consumeTooltipEscape(event, active, close)) downstream();
      return event;
    };

    const first = dispatch();
    expect(first.preventDefault).toHaveBeenCalledOnce();
    expect(first.stopPropagation).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(downstream).not.toHaveBeenCalled();

    const second = dispatch();
    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(second.stopPropagation).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
    expect(downstream).toHaveBeenCalledOnce();
  });

  it('defers Escape to an expanded object menu without closing the tooltip', () => {
    const close = vi.fn();
    const downstream = vi.fn();
    const event = {
      key: 'Escape',
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    if (!consumeTooltipEscape(event, true, close, true)) downstream();

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(downstream).toHaveBeenCalledOnce();
  });

  it('registers active-tooltip Escape before document capture and window bubble handlers', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    expect(tooltip).toContain("!!anchor()?.querySelector('[aria-expanded=\"true\"]')");
    expect(tooltip).toContain("window.addEventListener('keydown', closeOnEscape, true)");
    expect(tooltip).toContain("window.removeEventListener('keydown', closeOnEscape, true)");
    expect(tooltip).not.toContain("document.addEventListener('keydown', closeOnEscape)");
  });

  it('stacks enhancement tags and folds only the highest-priority multi-detail inline', () => {
    const tooltip = source('src/ui/components/Tooltip.tsx');
    const css = source('src/ui/styles/screens.css');
    const tokens = source('src/ui/styles/tokens.css');
    expect(tooltip).toContain('tt-enhancement-tag');
    expect(tooltip).toContain("hasSupplement ? 'has-sub' : ''");
    expect(tooltip).toContain('className="tt-inline-detail"');
    expect(tooltip).toContain('<span className="tt-sub-stack">');
    expect(tooltip).toContain('className="tt-sub-card"');
    expect(tooltip).toContain("'--tt-sub-w': `${supplementalTooltipWidth(detail)}px`");
    expect(tooltip).toContain("TOOLTIP_DETAIL_PRIORITY[a.detail.kind ?? 'other']");
    expect(tooltip).toContain("classList.toggle(");
    expect(tooltip).toContain("'sub-right'");
    expect(css).not.toContain('.tt-card.tt-portal.has-sub');
    expect(css).toMatch(/\.tt-sub-stack\s*\{[^}]*right:\s*calc\(100% \+ var\(--tt-sub-gap\)\)/s);
    expect(css).toMatch(/\.tt-card\.tt-portal\.sub-right \.tt-sub-stack\s*\{[^}]*left:\s*calc\(100% \+ var\(--tt-sub-gap\)\)/s);
    expect(css).toMatch(/\.tt-sub-stack\s*\{[^}]*width:\s*max-content[^}]*max-width:\s*calc\(100vw - 16px\)/s);
    expect(css).toMatch(/\.tt-sub-card\s*\{[^}]*width:\s*min\([^}]*clamp\(var\(--tt-min-w\), var\(--tt-sub-w\), var\(--tt-w\)\)[^}]*padding:\s*7px 3px 6px/s);
    expect(css).not.toMatch(/\.tt-sub-card\s*\{[^}]*aspect-ratio/s);
    expect(css).toMatch(/\.tt-card\.tile-tt\s*\{[^}]*width:\s*132px[^}]*min-width:\s*132px[^}]*max-width:\s*132px/s);
    expect(css).toMatch(/\.tile-tt \.tt-title\s*\{[^}]*font-size:\s*var\(--fs-xl\)/s);
    expect(css).toMatch(/\.tile-tt \.tt-body\s*\{[^}]*font-size:\s*var\(--fs-lg\)/s);
    expect(css).toMatch(/\.tt-enhancement-tag[\s\S]*width:\s*var\(--tt-tag-w\)/);
    expect(tokens).toContain('--tt-min-w: 150px');
    expect(tokens).toContain('--tt-w: 280px');
    expect(tokens).not.toContain('--tt-sub-w');
    expect(tokens).toContain('--tt-tag-w: 72%');
    expect(tokens).toContain("--tt-copy-font: 'Jost', 'Noto Sans KR', sans-serif");
    expect(css).toMatch(/\.tt-body\s*\{[^}]*font-family:\s*var\(--tt-copy-font\)[^}]*font-weight:\s*700/s);
    expect(css).not.toContain('.tt-card.down .tt-sub-card');
  });
});
