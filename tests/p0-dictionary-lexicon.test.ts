import { describe, it, expect } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { loadStubLexicon } from '../src/sim/stub-lexicon';

describe('P0-1 — real validity dictionary', () => {
  const lex = loadStubLexicon();

  it('validates common words AND their inflected forms (Scrabble convention)', () => {
    for (const w of ['pig', 'pigs', 'gem', 'gems', 'ran', 'eating', 'a', 'i']) {
      expect(lex.isWord(w), w).toBe(true);
    }
  });

  it('is a real curated size, not the ~2k stub', () => {
    expect(lex.size).toBeGreaterThan(20000);
  });

  it('still rejects non-words', () => {
    expect(lex.isWord('xqzptv')).toBe(false);
  });
});

describe('P0-2 — suit/POS inherited by lemma', () => {
  const lex = makeLexicon(['pigs', 'ran', 'eating', 'walked', 'table'], {
    pig: { suit: 'standard', pos: ['noun'] },
    run: { suit: 'slang', pos: ['verbIntransitive'] },
    eat: { suit: 'standard', pos: ['verbTransitive'] },
    walk: { suit: 'formal', pos: ['verbIntransitive', 'noun'] },
  });

  it('regular plural inherits the lemma (PIGS → pig)', () => {
    expect(lex.lookup('pigs')?.pos).toEqual(['noun']);
  });

  it('irregular inflection inherits via exceptions (RAN → run)', () => {
    const e = lex.lookup('ran');
    expect(e?.suit).toBe('slang');
    expect(e?.pos).toContain('verbIntransitive');
  });

  it('-ing form inherits (EATING → eat)', () => {
    expect(lex.lookup('eating')?.pos).toContain('verbTransitive');
  });

  it('-ed form inherits (WALKED → walk)', () => {
    expect(lex.lookup('walked')?.suit).toBe('formal');
  });

  it('a directly-tagged base word is unaffected', () => {
    expect(lex.lookup('run')?.suit).toBe('slang');
  });

  it('a valid word with no tagged lemma stays standard with no POS (GDD §3.2)', () => {
    expect(lex.lookup('table')).toEqual({ word: 'table', suit: 'standard', pos: [] });
  });
});
