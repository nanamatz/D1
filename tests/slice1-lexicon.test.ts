import { describe, it, expect } from 'vitest';
import { makeLexicon, parseDictionary, parseLexiconTable } from '../src/engine/lexicon';

describe('slice1 lexicon — validity + baked lookup (GDD §3.2, §4.2)', () => {
  const lex = makeLexicon(['cat', 'run', 'pizza'], {
    run: { suit: 'slang', pos: ['verbIntransitive', 'noun'] },
    pizza: { suit: 'standard', pos: ['noun'] },
  });

  it('recognizes a listed word (case-insensitive)', () => {
    expect(lex.isWord('cat')).toBe(true);
    expect(lex.isWord('CAT')).toBe(true);
    expect(lex.isWord('Run')).toBe(true);
  });

  it('rejects an unlisted string as not a word (→ gibberish path)', () => {
    expect(lex.isWord('xqzptv')).toBe(false);
  });

  it('returns the hand-tagged suit and POS for a tagged word', () => {
    const e = lex.lookup('run');
    expect(e).not.toBeNull();
    expect(e!.suit).toBe('slang');
    expect(e!.pos).toEqual(['verbIntransitive', 'noun']);
  });

  it('defaults an untagged-but-valid word to standard suit with no POS', () => {
    const e = lex.lookup('cat');
    expect(e).not.toBeNull();
    expect(e!.suit).toBe('standard');
    expect(e!.pos).toEqual([]);
  });

  it('returns null when looking up a non-word', () => {
    expect(lex.lookup('zzzzz')).toBeNull();
  });
});

describe('slice1 lexicon — parsers', () => {
  it('parseDictionary lowercases, trims, and drops blanks/comments', () => {
    const words = parseDictionary('Cat\n\n  RUN  \n# a comment\npizza\n');
    expect(words).toEqual(['cat', 'run', 'pizza']);
  });

  it('parseLexiconTable reads the baked {word:{suit,pos}} JSON', () => {
    const table = parseLexiconTable('{"run":{"suit":"slang","pos":["verbIntransitive"]}}');
    expect(table.run).toEqual({ suit: 'slang', pos: ['verbIntransitive'] });
  });
});
