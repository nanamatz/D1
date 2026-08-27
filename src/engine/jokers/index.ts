/**
 * Joker registry (GDD §11). One joker per file, grouped by rarity here.
 * Active public roster: Common 34 + Uncommon 57 + Rare 54 + Legendary 5.
 * Developer-only Primordial tiles stay outside ALL_JOKERS and the Collection.
 */

import {
  JokerBus,
  pruneEchoNamespaces,
  type DestroyedJokerSnapshot,
  type JokerDef,
  type JokerGrowthTrigger,
} from '../events';
import { BALANCE } from '../balance';
// Common (§11.2)
import { ceramicArtisan } from './ceramicArtisan';
import { longWordFan } from './longWordFan';
import { shortAndSharp } from './shortAndSharp';
import { alphabeticalOrder } from './alphabeticalOrder';
import { miser } from './miser';
import { alphabetSoup } from './alphabetSoup';
import { redPencil } from './redPencil';
import { pocketDictionary } from './pocketDictionary';
import { tongueTwister } from './tongueTwister';
import { stenographer } from './stenographer';
import { fillInTheBlank } from './fillInTheBlank';
import { leftMargin } from './leftMargin';
import { rightMargin } from './rightMargin';
import { pageNumber } from './pageNumber';
import { bookmark } from './bookmark';
import { tipJar } from './tipJar';
import { wastebasket } from './wastebasket';
import { pouchTag } from './pouchTag';
import { bookworm } from './bookworm';
import { alliterationSticker } from './alliterationSticker';
import { assonance } from './assonance';
import { porcelainCat } from './porcelainCat';
import { woodpecker } from './woodpecker';
import { dullingPencil } from './dullingPencil';
import { proofEraser } from './proofEraser';
import { spareDrawer } from './spareDrawer';
import { threeLeafClover } from './threeLeafClover';
import { megalith } from './megalith';
import { scarletLetter } from './scarletLetter';
import { peddler } from './peddler';
import { storyteller } from './storyteller';
import { recycling } from './recycling';
import { beehiveTile } from './beehiveTile';
import { cubism } from './cubism';
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
import { everydayHero } from './everydayHero';
import { formalInvitation } from './formalInvitation';
import { slangDictionary } from './slangDictionary';
import { oneVoice } from './oneVoice';
import { civilTongue } from './civilTongue';
import { uncensored } from './uncensored';
import { sometimesY } from './sometimesY';
import { syllableScale } from './syllableScale';
import { glassInsurance } from './glassInsurance';
import { growthRings } from './growthRings';
import { materialSampler } from './materialSampler';
import { monomaterial } from './monomaterial';
import { scrapDealer } from './scrapDealer';
import { lightTouch } from './lightTouch';
import { heavyPress } from './heavyPress';
import { hollowPromise } from './hollowPromise';
import { doubleImpression } from './doubleImpression';
import { houseStyle } from './houseStyle';
import { discardedDraft } from './discardedDraft';
import { rewrite } from './rewrite';
import { cleanCopy } from './cleanCopy';
import { fullDesk } from './fullDesk';
import { clearDesk } from './clearDesk';
import { lastSort } from './lastSort';
import { bagCounter } from './bagCounter';
import { royaltyContract } from './royaltyContract';
import { bestsellerBand } from './bestsellerBand';
import { badReview } from './badReview';
import { sentenceOpener } from './sentenceOpener';
import { verbEngine } from './verbEngine';
import { modifierStack } from './modifierStack';
import { correctionMark } from './correctionMark';
import { serial } from './serial';
import { dryingInk } from './dryingInk';
import { foldingManuscript } from './foldingManuscript';
import { noiseCancelling } from './noiseCancelling';
import { host } from './host';
import { gematria } from './gematria';
import { cadmusTeeth } from './cadmusTeeth';
import { strawberryJam } from './strawberryJam';
import { bald } from './bald';
import { shuriken } from './shuriken';
import { earthquake } from './earthquake';
import { dogFood } from './dogFood';
import { delisting } from './delisting';
import { greatDepression } from './greatDepression';
import { leak } from './leak';
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
import { acrosticPoet } from './acrosticPoet';
import { alphabetPress } from './alphabetPress';
import { vowelChoir } from './vowelChoir';
import { consonantChoir } from './consonantChoir';
import { blackletterEngine } from './blackletterEngine';
import { echoChamber } from './echoChamber';
import { stoneTongue } from './stoneTongue';
import { glassCannon } from './glassCannon';
import { loadedLeadDice } from './loadedLeadDice';
import { woodblockPress } from './woodblockPress';
import { materialPrism } from './materialPrism';
import { typeOrchestra } from './typeOrchestra';
import { longFormSerial } from './longFormSerial';
import { handScholar } from './handScholar';
import { wordHunter } from './wordHunter';
import { plagiarist } from './plagiarist';
import { hotOffThePress } from './hotOffThePress';
import { nightOwl } from './nightOwl';
import { livingType } from './livingType';
import { typesettingMachine } from './typesettingMachine';
import { royalWe } from './royalWe';
import { brokenSentence } from './brokenSentence';
import { holePunch } from './holePunch';
import { copyEditor } from './copyEditor';
import { goldenType } from './goldenType';
import { deadlineAuction } from './deadlineAuction';
import { termInsurance } from './termInsurance';
import { exactingCritic } from './exactingCritic';
import { counterfeit } from './counterfeit';
import { twentyFifthBlessing } from './twentyFifthBlessing';
import { bloodTypeA } from './bloodTypeA';
import { dummyData } from './dummyData';
import { blacksmith } from './blacksmith';
import { golem } from './golem';
import { temurah } from './temurah';
import { alphabetPoet } from './alphabetPoet';
import { iotaStroke } from './iotaStroke';
import { zombie } from './zombie';
import { biochemistry } from './biochemistry';
import { ambidextrous } from './ambidextrous';
import { thirdParty } from './thirdParty';
import { mirrorImage } from './mirrorImage';
import { gathering } from './gathering';
import { straightTalk } from './straightTalk';
import { developerGrace } from './developerGrace';
export { DEVELOPER_GRACE_ID } from './developerGrace';
// Legendary (§11.5)
import { bookOfMargins } from './bookOfMargins';
import { tyrant } from './tyrant';
import { typeFoundry } from './typeFoundry';
import { towerOfBabel } from './towerOfBabel';
import { misbound } from './misbound';
import type { BlindState, ChanceResult, JokerEdition, OwnedJoker, RunState } from '../types';
import type { Rng } from '../rng';
import { clearBossJokerDebuffs } from '../bosses';

export const COMMON_JOKERS: readonly JokerDef[] = [
  ceramicArtisan,
  longWordFan,
  shortAndSharp,
  alphabeticalOrder,
  miser,
  alphabetSoup,
  redPencil,
  pocketDictionary,
  tongueTwister,
  stenographer,
  fillInTheBlank,
  leftMargin,
  rightMargin,
  pageNumber,
  bookmark,
  tipJar,
  wastebasket,
  pouchTag,
  bookworm,
  alliterationSticker,
  assonance,
  porcelainCat,
  woodpecker,
  dullingPencil,
  proofEraser,
  spareDrawer,
  threeLeafClover,
  megalith,
  scarletLetter,
  peddler,
  storyteller,
  recycling,
  beehiveTile,
  cubism,
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
  everydayHero,
  formalInvitation,
  slangDictionary,
  oneVoice,
  civilTongue,
  uncensored,
  sometimesY,
  syllableScale,
  glassInsurance,
  growthRings,
  materialSampler,
  monomaterial,
  scrapDealer,
  lightTouch,
  heavyPress,
  hollowPromise,
  doubleImpression,
  houseStyle,
  discardedDraft,
  rewrite,
  cleanCopy,
  fullDesk,
  clearDesk,
  lastSort,
  bagCounter,
  royaltyContract,
  bestsellerBand,
  badReview,
  sentenceOpener,
  verbEngine,
  modifierStack,
  correctionMark,
  serial,
  dryingInk,
  foldingManuscript,
  noiseCancelling,
  stargazer,
  host,
  gematria,
  cadmusTeeth,
  strawberryJam,
  bald,
  shuriken,
  earthquake,
  dogFood,
  delisting,
  greatDepression,
  leak,
];
export const RARE_JOKERS: readonly JokerDef[] = [
  carteBlanche,
  hypocrite,
  rhymeChain,
  outOfPrint,
  fableHoard,
  anonymous,
  censorsBane,
  dadaist,
  interestGlutton,
  rotaryPress,
  acrosticPoet,
  alphabetPress,
  vowelChoir,
  consonantChoir,
  blackletterEngine,
  echoChamber,
  stoneTongue,
  glassCannon,
  loadedLeadDice,
  woodblockPress,
  materialPrism,
  typeOrchestra,
  longFormSerial,
  handScholar,
  wordHunter,
  plagiarist,
  hotOffThePress,
  nightOwl,
  livingType,
  typesettingMachine,
  royalWe,
  brokenSentence,
  holePunch,
  copyEditor,
  goldenType,
  deadlineAuction,
  termInsurance,
  exactingCritic,
  counterfeit,
  twentyFifthBlessing,
  bloodTypeA,
  dummyData,
  blacksmith,
  golem,
  temurah,
  alphabetPoet,
  iotaStroke,
  zombie,
  biochemistry,
  ambidextrous,
  thirdParty,
  mirrorImage,
  gathering,
  straightTalk,
];
export const LEGENDARY_JOKERS: readonly JokerDef[] = [
  bookOfMargins,
  tyrant,
  typeFoundry,
  towerOfBabel,
  misbound,
];

/** Never offered or rendered in the Collection; UI dev builds inject it explicitly. */
export const DEVELOPER_JOKERS: readonly JokerDef[] = [developerGrace];

export const ALL_JOKERS: readonly JokerDef[] = [
  ...COMMON_JOKERS,
  ...UNCOMMON_JOKERS,
  ...RARE_JOKERS,
  ...LEGENDARY_JOKERS,
];

export const JOKER_REGISTRY: ReadonlyMap<string, JokerDef> = new Map(
  [...ALL_JOKERS, ...DEVELOPER_JOKERS].map((j) => [j.id, j]),
);

/** Construct one newly acquired Emoji Tile. Run-history scalers seed their
 * current value here; explicit copy effects keep cloning the complete owner. */
export function createOwnedJoker(
  run: RunState,
  defId: string,
  edition: JokerEdition = 'base',
): OwnedJoker {
  const def = JOKER_REGISTRY.get(defId);
  const instanceId = nextOwnedJokerInstanceId(run);
  return { defId, instanceId, edition, state: def?.initialState?.(run) ?? {} };
}

export function nextOwnedJokerInstanceId(run: RunState): number {
  const shelfNext = Math.max(0, ...run.jokers.map((joker) => joker.instanceId ?? 0)) + 1;
  return Math.max(1, run.nextJokerInstanceId ?? 1, shelfNext);
}

/** Add a newly acquired physical Emoji Tile and advance its persistent identity. */
export function addOwnedJoker(
  run: RunState,
  defId: string,
  edition: JokerEdition = 'base',
): RunState {
  const joker = createOwnedJoker(run, defId, edition);
  return {
    ...run,
    jokers: [...run.jokers, joker],
    nextJokerInstanceId: (joker.instanceId ?? nextOwnedJokerInstanceId(run)) + 1,
  };
}

/** Deterministically repair legacy/malformed identities without a save bump. */
export function normalizeOwnedJokerInstanceIds(run: RunState): RunState {
  const used = new Set<number>();
  let next = Math.max(1, run.nextJokerInstanceId ?? 1);
  const migrateRevisionState = (
    defId: string,
    state: Record<string, number>,
    prefix = '',
  ): void => {
    const marker = `${prefix}revision20260826`;
    if (state[marker] === 1) return;
    const value = (key: string, fallback: number) => state[`${prefix}${key}`] ?? fallback;
    if (defId === 'misbound') {
      const procs = Math.max(0, Math.round((value('factor', 1) - 1) / 0.8));
      state[`${prefix}factor`] = 1 + procs * BALANCE.jokers.misbound.factorPerSurvival;
    } else if (defId === 'biochemistry') {
      const procs = Math.max(0, Math.round((value('factor', 1) - 1) / 0.45));
      state[`${prefix}factor`] = BALANCE.jokers.biochemistry.baseFactor +
        procs * BALANCE.jokers.biochemistry.factorPerHand;
      delete state[`${prefix}lastHand`];
    } else if (defId === 'serial') {
      const procs = Math.max(0, Math.round(value('chips', 0) / 13));
      state[`${prefix}chips`] = procs * BALANCE.jokers.serial.chipsPerMatch;
    } else if (defId === 'termInsurance') {
      delete state[`${prefix}preventions`];
      delete state[`${prefix}uses`];
      state[`${prefix}factor`] = Math.max(1, value('factor', 1));
    }
    state[marker] = 1;
  };
  const revisionDefs = ['misbound', 'biochemistry', 'serial', 'termInsurance'] as const;
  const jokers = run.jokers.map((joker) => {
    let instanceId = joker.instanceId;
    if (!Number.isInteger(instanceId) || (instanceId ?? 0) <= 0 || used.has(instanceId!)) {
      while (used.has(next)) next += 1;
      instanceId = next;
    }
    const resolvedId = instanceId!;
    used.add(resolvedId);
    next = Math.max(next, resolvedId + 1);
    const state = { ...joker.state };
    if (revisionDefs.includes(joker.defId as (typeof revisionDefs)[number])) {
      migrateRevisionState(joker.defId, state);
    }
    for (const defId of revisionDefs) {
      const token = `:${defId}:`;
      const prefixes = new Set<string>();
      for (const key of Object.keys(state)) {
        const tokenIndex = key.indexOf(token);
        if (!key.startsWith('echo:') || tokenIndex < 0) continue;
        prefixes.add(key.slice(0, tokenIndex + token.length));
      }
      for (const prefix of prefixes) migrateRevisionState(defId, state, prefix);
    }
    return { ...joker, instanceId: resolvedId, state };
  });
  return { ...run, jokers, nextJokerInstanceId: next };
}

/** The engine-wide bus over the full registry. Emits are no-ops when a run owns no jokers. */
export const defaultJokerBus = new JokerBus(JOKER_REGISTRY);

const mutableRun = (run: RunState): RunState => ({
  ...run,
  jokers: run.jokers.map((joker) => ({ ...joker, state: { ...joker.state } })),
});

const LIFECYCLE_GROWTH_LOG_LIMIT = 128;

export const recordLifecycleGrowth = (
  run: RunState,
  triggers: readonly JokerGrowthTrigger[],
): RunState => {
  if (triggers.length === 0) return run;
  let sequence = run.jokerGrowthSequence ?? 0;
  const added = triggers.map((trigger) => ({ ...trigger, sequence: ++sequence }));
  return {
    ...run,
    jokerGrowthSequence: sequence,
    lifecycleGrowthEvents: [...(run.lifecycleGrowthEvents ?? []), ...added]
      .slice(-LIFECYCLE_GROWTH_LOG_LIMIT),
  };
};

export function onConstellationUsed(run: RunState): RunState {
  const next = mutableRun(run);
  defaultJokerBus.emit('constellationUsed', { run: next }, next.jokers);
  return next;
}

export function onFableUsed(run: RunState): RunState {
  const next = mutableRun(run);
  defaultJokerBus.emit('fableUsed', { run: next }, next.jokers);
  return next;
}

export function onTilesDestroyed(run: RunState, count: number): RunState {
  if (count <= 0) return run;
  const next = mutableRun(run);
  const triggers: JokerGrowthTrigger[] = [];
  for (let index = 0; index < count; index += 1) {
    triggers.push(...defaultJokerBus.emit('tilesDestroyed', { run: next, count: 1 }, next.jokers));
  }
  return recordLifecycleGrowth(next, triggers);
}

export function onTilesCreated(run: RunState, count: number): RunState {
  if (count <= 0) return run;
  const next = mutableRun(run);
  const triggers: JokerGrowthTrigger[] = [];
  for (let index = 0; index < count; index += 1) {
    triggers.push(...defaultJokerBus.emit('tilesCreated', { run: next, count: 1 }, next.jokers));
  }
  return recordLifecycleGrowth(next, triggers);
}

export function onTilesEnhanced(run: RunState, count: number): RunState {
  if (count <= 0) return run;
  const next = mutableRun(run);
  const triggers: JokerGrowthTrigger[] = [];
  for (let index = 0; index < count; index += 1) {
    triggers.push(...defaultJokerBus.emit('tilesEnhanced', { run: next, count: 1 }, next.jokers));
  }
  return recordLifecycleGrowth(next, triggers);
}

export interface BlindEndJokerResult {
  run: RunState;
  destroyedJokers: DestroyedJokerSnapshot[];
}

function resolveBlindEndJokers(
  run: RunState,
  blind: BlindState,
  rng: Rng,
  chanceResults: ChanceResult[] = [],
): BlindEndJokerResult {
  const next = mutableRun(run);
  const triggers = defaultJokerBus.emit('blindEnd', {
    run: next,
    blind,
    early: blind.phasesUsed < blind.phasesTotal,
    phasesLeft: blind.phasesTotal - blind.phasesUsed,
    rng,
    chanceResults,
  }, next.jokers);
  const cleared = clearBossJokerDebuffs(next);
  defaultJokerBus.emit('blindCleanup', { run: cleared, blind }, cleared.jokers);
  const destroyedJokers = cleared.jokers.flatMap(
    (joker, index) => joker.state.destroyed === 1 ? [{ joker, index }] : [],
  );
  return {
    run: recordLifecycleGrowth(
      pruneEchoNamespaces({
        ...cleared,
        jokers: cleared.jokers.filter((joker) => joker.state.destroyed !== 1),
      }),
      triggers.filter((trigger) => cleared.jokers.some((joker) =>
        trigger.jokerInstanceId !== undefined
          ? joker.instanceId === trigger.jokerInstanceId
          : joker.defId === trigger.jokerId,
      )),
    ),
    destroyedJokers,
  };
}

export function onBlindEndedWithDestroyedJokers(
  run: RunState,
  blind: BlindState,
  rng: Rng,
  chanceResults: ChanceResult[] = [],
): BlindEndJokerResult {
  return resolveBlindEndJokers(run, blind, rng, chanceResults);
}

export function onBlindEnded(
  run: RunState,
  blind: BlindState,
  rng: Rng,
  chanceResults: ChanceResult[] = [],
): RunState {
  return resolveBlindEndJokers(run, blind, rng, chanceResults).run;
}
