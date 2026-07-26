import type { ConsumableId, PatternId } from './types';

export type ConstellationId =
  | 'libra'
  | 'leo'
  | 'aquarius'
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'virgo'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'pisces';

export interface ConstellationDef {
  id: ConstellationId;
  pattern: PatternId;
}

export const CONSTELLATION_DEFS: readonly ConstellationDef[] = [
  { id: 'libra', pattern: 'outcry' },
  { id: 'leo', pattern: 'imperative' },
  { id: 'aquarius', pattern: 'chant' },
  { id: 'aries', pattern: 'simple' },
  { id: 'taurus', pattern: 'descriptive' },
  { id: 'gemini', pattern: 'transitive' },
  { id: 'cancer', pattern: 'ditransitive' },
  { id: 'virgo', pattern: 'compound' },
  { id: 'scorpio', pattern: 'objectComplement' },
  { id: 'sagittarius', pattern: 'interrogative' },
  { id: 'capricorn', pattern: 'negative' },
  { id: 'pisces', pattern: 'complex' },
];

export const CONSTELLATION_IDS: readonly ConstellationId[] =
  CONSTELLATION_DEFS.map((def) => def.id);

export const PATTERN_CONSTELLATION: Record<PatternId, ConstellationId> =
  Object.fromEntries(CONSTELLATION_DEFS.map((def) => [def.pattern, def.id])) as
    Record<PatternId, ConstellationId>;

export const CONSTELLATION_PATTERN: Partial<Record<ConsumableId, PatternId>> =
  Object.fromEntries(CONSTELLATION_DEFS.map((def) => [def.id, def.pattern]));

export const isConstellationId = (id: ConsumableId): id is ConstellationId =>
  (CONSTELLATION_IDS as readonly ConsumableId[]).includes(id);
