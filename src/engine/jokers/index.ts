/**
 * Joker registry (GDD §11). One joker per file, grouped by rarity here.
 * The full authored roster: Common 7 + Uncommon 9 + Rare 11 + Legendary 5.
 */

import { JokerBus, type JokerDef } from '../events';
// Common (§11.2)
import { uppercasePremium } from './uppercasePremium';
import { lowercaseLover } from './lowercaseLover';
import { ceramicArtisan } from './ceramicArtisan';
import { longWordFan } from './longWordFan';
import { shortAndSharp } from './shortAndSharp';
import { alphabeticalOrder } from './alphabeticalOrder';
import { miser } from './miser';
// Uncommon (§11.3)
import { literaryJudge } from './literaryJudge';
import { rareEarth } from './rareEarth';
import { glasswork } from './glasswork';
import { voraciousReader } from './voraciousReader';
import { classicist } from './classicist';
import { streetCred } from './streetCred';
import { comboArtist } from './comboArtist';
import { vowelMagnet } from './vowelMagnet';
import { equilibrist } from './equilibrist';
// Rare (§11.4)
import { carteBlanche } from './carteBlanche';
import { hypocrite } from './hypocrite';
import { rhymeChain } from './rhymeChain';
import { outOfPrint } from './outOfPrint';
import { stargazer } from './stargazer';
import { fableHoard } from './fableHoard';
import { anonymous } from './anonymous';
import { censorsBane } from './censorsBane';
import { dadaist } from './dadaist';
import { interestGlutton } from './interestGlutton';
import { rotaryPress } from './rotaryPress';
// Legendary (§11.5)
import { bookOfMargins } from './bookOfMargins';
import { tyrant } from './tyrant';
import { typeFoundry } from './typeFoundry';
import { towerOfBabel } from './towerOfBabel';
import { misbound } from './misbound';
import type { BlindState, RunState } from '../types';
import type { Rng } from '../rng';

export const COMMON_JOKERS: readonly JokerDef[] = [
  uppercasePremium,
  lowercaseLover,
  ceramicArtisan,
  longWordFan,
  shortAndSharp,
  alphabeticalOrder,
  miser,
];
export const UNCOMMON_JOKERS: readonly JokerDef[] = [
  literaryJudge,
  rareEarth,
  glasswork,
  voraciousReader,
  classicist,
  streetCred,
  comboArtist,
  vowelMagnet,
  equilibrist,
];
export const RARE_JOKERS: readonly JokerDef[] = [
  carteBlanche,
  hypocrite,
  rhymeChain,
  outOfPrint,
  stargazer,
  fableHoard,
  anonymous,
  censorsBane,
  dadaist,
  interestGlutton,
  rotaryPress,
];
export const LEGENDARY_JOKERS: readonly JokerDef[] = [
  bookOfMargins,
  tyrant,
  typeFoundry,
  towerOfBabel,
  misbound,
];

export const ALL_JOKERS: readonly JokerDef[] = [
  ...COMMON_JOKERS,
  ...UNCOMMON_JOKERS,
  ...RARE_JOKERS,
  ...LEGENDARY_JOKERS,
];

export const JOKER_REGISTRY: ReadonlyMap<string, JokerDef> = new Map(
  ALL_JOKERS.map((j) => [j.id, j]),
);

/** The engine-wide bus over the full registry. Emits are no-ops when a run owns no jokers. */
export const defaultJokerBus = new JokerBus(JOKER_REGISTRY);

const mutableRun = (run: RunState): RunState => ({
  ...run,
  jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
});

export function onConstellationUsed(run: RunState): RunState {
  const next = mutableRun(run);
  defaultJokerBus.emit('constellationUsed', { run: next }, next.jokers);
  return next;
}

export function onTilesDestroyed(run: RunState, count: number): RunState {
  if (count <= 0) return run;
  const next = mutableRun(run);
  defaultJokerBus.emit('tilesDestroyed', { run: next, count }, next.jokers);
  return next;
}

export function onBlindEnded(run: RunState, blind: BlindState, rng: Rng): RunState {
  const next = mutableRun(run);
  const bagBefore = next.bag.length;
  defaultJokerBus.emit('blindEnd', {
    run: next,
    blind,
    early: blind.phasesUsed < blind.phasesTotal,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    rng,
  }, next.jokers);
  // A blindEnd hook may shrink the permanent pouch (Glasswork U4). Re-announce it
  // generically so destruction-fed tiles (Type Foundry L3) see it like any other.
  const lost = bagBefore - next.bag.length;
  if (lost > 0) defaultJokerBus.emit('tilesDestroyed', { run: next, count: lost }, next.jokers);
  return { ...next, jokers: next.jokers.filter((joker) => joker.state.destroyed !== 1) };
}
