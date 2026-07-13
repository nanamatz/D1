import { describe, it, expect } from 'vitest';
import { loadStubLexicon } from '../src/sim/stub-lexicon';

describe('slice1 stub data — real dictionary.txt + lexicon.json load correctly', () => {
  const lex = loadStubLexicon();

  it('loads a non-trivial number of words', () => {
    expect(lex.size).toBeGreaterThan(200);
  });

  it('does not leak the `_comment` JSON key into the word set', () => {
    expect(lex.isWord('_comment')).toBe(false);
  });

  it('recognizes common words and rejects gibberish', () => {
    expect(lex.isWord('pizza')).toBe(true);
    expect(lex.isWord('run')).toBe(true);
    expect(lex.isWord('good')).toBe(true);
    expect(lex.isWord('xqzptv')).toBe(false);
  });

  it('carries the hand-tagged suits (GDD §3.1 registers)', () => {
    expect(lex.lookup('purchase')!.suit).toBe('formal');
    expect(lex.lookup('buddy')!.suit).toBe('slang');
    expect(lex.lookup('damn')!.suit).toBe('vulgar');
    expect(lex.lookup('pizza')!.suit).toBe('standard');
  });

  it('carries multi-POS words used in pattern examples (GDD §5.1)', () => {
    // PIZZA TASTES GOOD → descriptive needs a linking verb + adjective
    expect(lex.lookup('tastes')!.pos).toContain('verbLinking');
    expect(lex.lookup('good')!.pos).toContain('adjective');
    // RUN is verb + noun (chant example)
    expect(lex.lookup('run')!.pos).toContain('verbIntransitive');
  });
});
