import type { Suit } from '../engine/types';

export const REGISTER_TITLE_SUITS = ['standard', 'formal', 'slang', 'vulgar'] as const;

export const REGISTER_TITLE_DEFS = [
  { id: 'standard.reader', suit: 'standard', tier: 0, localeKey: 'profile.registerTitle.standard.0' },
  { id: 'standard.speller', suit: 'standard', tier: 1, localeKey: 'profile.registerTitle.standard.1' },
  { id: 'standard.wordCollector', suit: 'standard', tier: 2, localeKey: 'profile.registerTitle.standard.2' },
  { id: 'standard.wordsmith', suit: 'standard', tier: 3, localeKey: 'profile.registerTitle.standard.3' },
  { id: 'standard.editor', suit: 'standard', tier: 4, localeKey: 'profile.registerTitle.standard.4' },
  { id: 'standard.lexicographer', suit: 'standard', tier: 5, localeKey: 'profile.registerTitle.standard.5' },
  { id: 'standard.livingDictionary', suit: 'standard', tier: 6, localeKey: 'profile.registerTitle.standard.6' },
  { id: 'standard.master', suit: 'standard', tier: 7, localeKey: 'profile.registerTitle.standard.7' },
  { id: 'formal.scribe', suit: 'formal', tier: 0, localeKey: 'profile.registerTitle.formal.0' },
  { id: 'formal.essayist', suit: 'formal', tier: 1, localeKey: 'profile.registerTitle.formal.1' },
  { id: 'formal.scholar', suit: 'formal', tier: 2, localeKey: 'profile.registerTitle.formal.2' },
  { id: 'formal.rhetorician', suit: 'formal', tier: 3, localeKey: 'profile.registerTitle.formal.3' },
  { id: 'formal.orator', suit: 'formal', tier: 4, localeKey: 'profile.registerTitle.formal.4' },
  { id: 'formal.erudite', suit: 'formal', tier: 5, localeKey: 'profile.registerTitle.formal.5' },
  { id: 'formal.doctor', suit: 'formal', tier: 6, localeKey: 'profile.registerTitle.formal.6' },
  { id: 'formal.professor', suit: 'formal', tier: 7, localeKey: 'profile.registerTitle.formal.7' },
  { id: 'slang.trickster', suit: 'slang', tier: 0, localeKey: 'profile.registerTitle.slang.0' },
  { id: 'slang.freeSpirit', suit: 'slang', tier: 1, localeKey: 'profile.registerTitle.slang.1' },
  { id: 'slang.roughneck', suit: 'slang', tier: 2, localeKey: 'profile.registerTitle.slang.2' },
  { id: 'slang.fromTheStreets', suit: 'slang', tier: 3, localeKey: 'profile.registerTitle.slang.3' },
  { id: 'slang.wildLife', suit: 'slang', tier: 4, localeKey: 'profile.registerTitle.slang.4' },
  { id: 'slang.brainRot', suit: 'slang', tier: 5, localeKey: 'profile.registerTitle.slang.5' },
  { id: 'slang.trendSetter', suit: 'slang', tier: 6, localeKey: 'profile.registerTitle.slang.6' },
  { id: 'slang.influencer', suit: 'slang', tier: 7, localeKey: 'profile.registerTitle.slang.7' },
  { id: 'vulgar.kid', suit: 'vulgar', tier: 0, localeKey: 'profile.registerTitle.vulgar.0' },
  { id: 'vulgar.elementarySchooler', suit: 'vulgar', tier: 1, localeKey: 'profile.registerTitle.vulgar.1' },
  { id: 'vulgar.middleSchooler', suit: 'vulgar', tier: 2, localeKey: 'profile.registerTitle.vulgar.2' },
  { id: 'vulgar.juvenileDelinquent', suit: 'vulgar', tier: 3, localeKey: 'profile.registerTitle.vulgar.3' },
  { id: 'vulgar.crank', suit: 'vulgar', tier: 4, localeKey: 'profile.registerTitle.vulgar.4' },
  { id: 'vulgar.rapper', suit: 'vulgar', tier: 5, localeKey: 'profile.registerTitle.vulgar.5' },
  { id: 'vulgar.gangster', suit: 'vulgar', tier: 6, localeKey: 'profile.registerTitle.vulgar.6' },
  { id: 'vulgar.buddha', suit: 'vulgar', tier: 7, localeKey: 'profile.registerTitle.vulgar.7' },
] as const satisfies readonly {
  id: string;
  suit: Suit;
  tier: number;
  localeKey: string;
}[];

export const GOD_TITLE_DEF = {
  id: 'god',
  suit: null,
  tier: null,
  localeKey: 'profile.registerTitle.god',
} as const;

export type RegisterTitleId = (typeof REGISTER_TITLE_DEFS)[number]['id'];
export type ProfileTitleId = RegisterTitleId | typeof GOD_TITLE_DEF.id;
export type ProfileTitleDef = (typeof REGISTER_TITLE_DEFS)[number] | typeof GOD_TITLE_DEF;

const TITLE_BY_ID = new Map<string, ProfileTitleDef>(
  [...REGISTER_TITLE_DEFS, GOD_TITLE_DEF].map((definition) => [definition.id, definition]),
);

export function profileTitleDef(value: unknown): ProfileTitleDef | null {
  return typeof value === 'string' ? TITLE_BY_ID.get(value) ?? null : null;
}

export function isProfileTitleId(value: unknown): value is ProfileTitleId {
  return profileTitleDef(value) !== null;
}

export function registerTitleDefs(suit: Suit): readonly (typeof REGISTER_TITLE_DEFS)[number][] {
  return REGISTER_TITLE_DEFS.filter((definition) => definition.suit === suit);
}
