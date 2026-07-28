import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/ui/components/PackOpening.tsx', 'utf8');
const css = readFileSync('src/ui/styles/play.css', 'utf8');

describe('pack-opening transition choreography', () => {
  it('does not attach the burst-end timer to the started-state effect', () => {
    expect(source).toContain('setOpening(true);\n  }, [entering, started]);');
    expect(source).toMatch(
      /useEffect\(\(\) => \{\s*if \(!opening\) return;\s*const id = setTimeout\(\(\) => setOpening\(false\), BURST_MS\);[\s\S]*?\}, \[opening\]\);/,
    );
  });

  it('uses a widened image-first footprint for every pack choice', () => {
    expect(source).toContain("'pack-option-card'");
    expect(source).toContain('className="pack-option-visual"');
    expect(source).not.toContain('<span className="n">{name}</span>');
    expect(css).toMatch(/\.pack-fan-card\s*\{[^}]*width:\s*168px/s);
    expect(css).toMatch(/\.pack-option-card\s*\{[^}]*height:\s*238px/s);
  });
});
