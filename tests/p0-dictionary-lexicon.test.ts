import { describe, it, expect } from 'vitest';
import { makeLexicon } from '../src/engine/lexicon';
import { BALANCE } from '../src/engine/balance';
import { loadStubLexicon } from '../src/sim/stub-lexicon';

describe('P0-1 — real validity dictionary', () => {
  const lex = loadStubLexicon();

  it('validates common words AND their inflected forms (Scrabble convention)', () => {
    for (const w of ['pig', 'pigs', 'gem', 'gems', 'ran', 'eating', 'a', 'i']) {
      expect(lex.isWord(w), w).toBe(true);
    }
  });

  it('accepts apostrophe-free negative contractions used by tile grammar', () => {
    for (const w of ['dont', 'isnt', 'arent', 'couldnt', 'wouldnt']) {
      expect(lex.isWord(w), w).toBe(true);
    }
  });

  it('contains the 18-letter ENABLE pool plus tile-grammar exceptions', () => {
    expect(lex.size).toBe(172251);
    expect(Object.values(lex.registerTotals).reduce((sum, count) => sum + count, 0))
      .toBe(lex.size);
    expect([...lex.words()].every((word) => word.length <= BALANCE.wordLength.maxLetters)).toBe(true);
  });

  it('includes UREMIA with its noun POS', () => {
    expect(lex.lookup('uremia')).toMatchObject({ suit: 'standard', pos: ['noun'] });
  });

  it('keeps the documented register boundary examples stable', () => {
    const examples = {
      standard: [
        'sick', 'lit', 'stupid', 'idiot', 'jerk', 'ugly', 'kid', 'guy',
        'cool', 'okay', 'stuff', 'gonna', 'water', 'decide', 'quickly',
        'house', 'think', 'problem', 'onomatopoeia',
      ],
      formal: [
        'notwithstanding', 'henceforth', 'aforementioned', 'pursuant',
        'ascertain', 'commence', 'procure', 'deem', 'whereby', 'heretofore',
      ],
      slang: ['dope', 'salty', 'bogus', 'gnarly', 'bloke', 'bail', 'ghost', 'flex'],
      vulgar: ['fuck', 'shit', 'cunt', 'bitch', 'piss', 'arse', 'prick', 'whore', 'damn', 'hell', 'crap'],
    } as const;

    for (const [suit, words] of Object.entries(examples)) {
      for (const word of words) expect(lex.lookup(word)?.suit, word).toBe(suit);
    }
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

  it('a partial fixture with no tagged lemma stays standard with no POS', () => {
    expect(lex.lookup('table')).toEqual({ word: 'table', suit: 'standard', pos: [] });
  });

  it('includes inherited and fallback words in original-register totals', () => {
    expect(lex.registerTotals).toEqual({ standard: 5, formal: 2, slang: 2, vulgar: 0 });
  });
});
