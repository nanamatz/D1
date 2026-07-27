import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sidebar = readFileSync('src/ui/components/Sidebar.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');

describe('tomato motion anchoring', () => {
  it('separates the fixed panel anchor from the animated motion layer', () => {
    expect(sidebar).toContain('className="tomato-anchor"');
    expect(sidebar).toContain("!settle.active && !bonusActive && 'idle'");
    expect(sidebar).toContain("hop && !settle.active && !bonusActive && 'hop'");
    expect(css).toContain('.tomato-motion.idle');
    expect(css).toContain('.tomato-motion.hop');
    expect(css).toMatch(/\.round-panel \.tomato-anchor\s*\{[^}]*position:\s*absolute/s);
    expect(css).toMatch(/\.round-panel \.tomato-icon\s*\{[^}]*position:\s*static/s);
  });

  it('keeps both bounce paths compact', () => {
    const tomatoKeyframes = css.slice(
      css.indexOf('@keyframes tomato-pop'),
      css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('@keyframes tomato-pop')),
    );
    expect(tomatoKeyframes).not.toContain('translateY(-9px)');
    expect(tomatoKeyframes.match(/translateY\(-4px\)/g)).toHaveLength(2);
  });

  it('keeps a subtle pixel idle loop until a scoring reaction takes over', () => {
    const idleKeyframes = css.slice(
      css.indexOf('@keyframes tomato-idle'),
      css.indexOf('@media (prefers-reduced-motion: reduce)', css.indexOf('@keyframes tomato-idle')),
    );
    expect(css).toContain('@keyframes tomato-idle');
    expect(css).toContain('animation: tomato-idle 2.8s steps(8, end) infinite');
    expect(idleKeyframes).toContain('translateY(0)');
    expect(idleKeyframes).not.toMatch(/translateY\(-[5-9]px\)/);
    expect(css).toContain('.force-reduced-motion .tomato-motion');
  });
});
