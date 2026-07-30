import type { PatternId } from '../engine/types';

/** The zodiac marks engraved at the top of the matching Constellation cards. */
export const PATTERN_SYMBOLS: Record<PatternId, string> = {
  outcry: '♎',
  imperative: '♌',
  chant: '♒',
  simple: '♈',
  descriptive: '♉',
  transitive: '♊',
  ditransitive: '♋',
  compound: '♍',
  objectComplement: '♏',
  interrogative: '♐',
  negative: '♑',
  complex: '♓',
};

export const patternSymbol = (pattern: PatternId): string => PATTERN_SYMBOLS[pattern];
