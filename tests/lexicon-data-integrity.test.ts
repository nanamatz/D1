import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('baked lexicon integrity', () => {
  it('passes the same validation used by the production build', () => {
    expect(() => execFileSync(
      process.execPath,
      ['scripts/validate-data.mjs'],
      { stdio: 'pipe' },
    )).not.toThrow();
  });
});
