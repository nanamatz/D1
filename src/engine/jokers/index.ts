/**
 * Joker registry (GDD §11). One joker per file, grouped by rarity here.
 * Promoted roster: Common 24 + Uncommon 42 + Rare 45 + Legendary 5.
 */

import { JokerBus, type JokerDef } from '../events';
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
import { letterLadderBadge } from './letterLadderBadge';
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
import { palindromist } from './palindromist';
import { straightShooter } from './straightShooter';
import { vowelSymphony } from './vowelSymphony';
import { longFormSerial } from './longFormSerial';
import { twinPeaks } from './twinPeaks';
import { threefoldSeal } from './threefoldSeal';
import { handScholar } from './handScholar';
import { wordHunter } from './wordHunter';
import { plagiarist } from './plagiarist';
import { hotOffThePress } from './hotOffThePress';
import { nightOwl } from './nightOwl';
import { livingType } from './livingType';
import { typesettingMachine } from './typesettingMachine';
import { synesthete } from './synesthete';
import { royalWe } from './royalWe';
import { brokenSentence } from './brokenSentence';
import { holePunch } from './holePunch';
import { copyEditor } from './copyEditor';
import { goldenType } from './goldenType';
import { deadlineAuction } from './deadlineAuction';
import { termInsurance } from './termInsurance';
import { exactingCritic } from './exactingCritic';
// Legendary (§11.5)
import { bookOfMargins } from './bookOfMargins';
import { tyrant } from './tyrant';
import { typeFoundry } from './typeFoundry';
import { towerOfBabel } from './towerOfBabel';
import { misbound } from './misbound';
import type { BlindState, RunState } from '../types';
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
  letterLadderBadge,
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
  palindromist,
  straightShooter,
  vowelSymphony,
  longFormSerial,
  twinPeaks,
  threefoldSeal,
  handScholar,
  wordHunter,
  plagiarist,
  hotOffThePress,
  nightOwl,
  livingType,
  typesettingMachine,
  synesthete,
  royalWe,
  brokenSentence,
  holePunch,
  copyEditor,
  goldenType,
  deadlineAuction,
  termInsurance,
  exactingCritic,
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

export function onTilesCreated(run: RunState, count: number): RunState {
  if (count <= 0) return run;
  const next = mutableRun(run);
  defaultJokerBus.emit('tilesCreated', { run: next, count }, next.jokers);
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
  return clearBossJokerDebuffs({
    ...next,
    jokers: next.jokers.filter((joker) => joker.state.destroyed !== 1),
  });
}
