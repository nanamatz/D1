import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/components/PackOpening.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');

describe('pack-opening transition choreography', () => {
  it('does not attach the opening-end timer to the started-state effect', () => {
    expect(source).toContain('setOpening(true);\n  }, [entering, started]);');
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*if \(!opening\) return;\s*const id = setTimeout\(\(\) => setOpening\(false\), BURST_MS\);[\s\S]*?\}, \[opening\]\);/,
    );
  });

  it('tears off the pack top and pours pixel cards into the revealed fan', () => {
    expect(source).toContain('className="pack-open-piece pack-open-body"');
    expect(source).toContain('className="pack-open-piece pack-open-top"');
    expect(source).toContain('className="pack-open-tear-line"');
    expect(source).toContain('className="pack-open-spill-card"');
    expect(source).toContain('Array.from({ length: 7 })');
    expect(css).toContain('@keyframes packTopTear');
    expect(css).toContain('@keyframes packCardSpill');
    expect(css).toContain('@keyframes packChoiceSettle');
    expect(css).not.toContain('@keyframes packShakeBurst');
    expect(css).toMatch(/\.pack-open-body\s*\{[^}]*animation:\s*packBodyEmpty \.82s \.28s/s);
    expect(css).toMatch(/\.pack-open-top\s*\{[^}]*animation:\s*packTopTear \.82s \.28s/s);
    expect(css).toMatch(/\.pack-open-tear-line\s*\{[^}]*animation:\s*packTearLine \.98s \.12s/s);
    expect(css).toMatch(/@keyframes packTearLine\s*\{[\s\S]*?to\s*\{\s*opacity:\s*0/);
  });

  it('uses a widened image-first footprint for every pack choice', () => {
    expect(source).toContain("'pack-option-card'");
    expect(source).toContain('className="pack-option-visual"');
    expect(source).not.toContain('<span className="n">{name}</span>');
    expect(css).toMatch(/\.pack-fan\s*\{[^}]*grid-template-columns:\s*repeat\(var\(--pack-count,\s*5\),\s*minmax\(0,\s*168px\)\)/s);
    expect(css).toMatch(/\.pack-option-card\s*\{[^}]*aspect-ratio:\s*5\s*\/\s*7/s);
  });
});
