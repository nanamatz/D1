import { describe, expect, it } from 'vitest';
import { findViolations } from '../scripts/check-offline.mjs';

describe('findViolations', () => {
  it('flags a Google Fonts stylesheet link', () => {
    const html = '<link href="https://fonts.googleapis.com/css2?family=Jost" rel="stylesheet" />';
    const found = findViolations('index.html', html);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('external-url');
    expect(found[0].snippet).toContain('fonts.googleapis.com');
  });

  it('flags an external URL hidden inside a JS bundle', () => {
    const js = 'const u="https://cdn.example.com/sprite.png";';
    expect(findViolations('assets/index-abc.js', js)).toHaveLength(1);
  });

  it('ignores the SVG XML namespace, which is not a network fetch', () => {
    const js = 'const s=\'<svg xmlns="http://www.w3.org/2000/svg" width="10"></svg>\';';
    expect(findViolations('assets/index-abc.js', js)).toEqual([]);
  });

  it("ignores React's error-decoder link, which is printed, not fetched", () => {
    const js = 'throw Error("...https://reactjs.org/docs/error-decoder.html?invariant="+e);';
    expect(findViolations('assets/index-abc.js', js)).toEqual([]);
  });

  it('allows only the exact inert URLs reproduced in bundled legal notices', () => {
    expect(findViolations('assets/credits.js', 'https://creativecommons.org/licenses/by-sa/4.0/')).toEqual([]);
    expect(findViolations('assets/credits.js', 'https://creativecommons.org/licenses/by-sa/4.0/script.js')).toHaveLength(1);
  });

  it('still flags a CDN host that merely looks documentation-ish', () => {
    const js = 'const u="https://cdn.reactjs.org.evil.com/x.js";';
    expect(findViolations('assets/index-abc.js', js)).toHaveLength(1);
  });

  it('flags an absolute asset path in HTML', () => {
    const html = '<script type="module" src="/assets/index-abc.js"></script>';
    const found = findViolations('index.html', html);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('absolute-path');
  });

  it('flags an absolute url() in CSS', () => {
    const css = '@font-face{src:url(/files/jost-300.woff2) format("woff2");}';
    const found = findViolations('assets/index-abc.css', css);
    expect(found).toHaveLength(1);
    expect(found[0].kind).toBe('absolute-path');
  });

  it('passes clean relative output', () => {
    const html = '<script type="module" src="./assets/index-abc.js"></script>';
    const css = '@font-face{src:url(./files/jost-300.woff2) format("woff2");}';
    expect(findViolations('index.html', html)).toEqual([]);
    expect(findViolations('assets/index-abc.css', css)).toEqual([]);
  });

  it('does not apply the absolute-path rule to JS bundles', () => {
    // Game strings and regexes legitimately contain "/..." — only markup is checked.
    const js = 'const path="/usr/share";';
    expect(findViolations('assets/index-abc.js', js)).toEqual([]);
  });
});
