/** Profile-scoped Emoji Tile achievements. The headless engine receives the
 * resulting eligible-id set; it never reads browser or desktop storage. */
import { BALANCE } from '../engine/balance';
import { ALL_JOKERS } from '../engine/jokers';
import { jokerSlotLimit } from '../engine/vouchers';
import {
  isConsonant,
  isVowel,
  submissionSuits,
  type BlindState,
  type Letter,
  type LetterHandId,
  type RunState,
  type SentenceJudgment,
  type Tile,
  type WordSubmission,
} from '../engine/types';
import { collectionSize, loadCollection } from './collection';
import { loadLifetime } from './lifetime';
import {
  activeProfile,
  readProfileValue,
  writeProfileValue,
  writeValue,
  type ProfileSlot,
} from './storage';
import { loadVoucherProgress } from './voucherProgress';

const KEY = 'wj.emojiUnlocks';
const VERSION = 1;
const TARGETS = BALANCE.emoji.unlockTargets;
const LOCKED_IDS = new Set(Object.keys(TARGETS));
const target = (id: string): number => TARGETS[id] ?? Number.POSITIVE_INFINITY;

export interface EmojiUnlockRule {
  id: string;
  conditionKey: string;
  target: number;
}

export const EMOJI_UNLOCK_RULES: readonly EmojiUnlockRule[] = ALL_JOKERS
  .filter((def) => LOCKED_IDS.has(def.id))
  .map((def) => ({
    id: def.id,
    conditionKey: `jokerunlock.${def.id}`,
    target: target(def.id),
  }));

interface RunTracker {
  seed: string;
  initialLetters: Letter[];
  rareLetters: Letter[];
  noVulgar: boolean;
  shopVisit: number;
  blindKey: string;
  discardActions: number;
  discardedTiles: number;
}

export interface EmojiUnlockProgress {
  version: typeof VERSION;
  unlocked: string[];
  /** Current achievement value. Cumulative values persist; run/blind values reset. */
  values: Record<string, number>;
  run: RunTracker | null;
}

const CUMULATIVE_IDS = new Set([
  'fillInTheBlank', 'bookworm', 'alliterationSticker', 'porcelainCat', 'woodpecker',
  'letterLadderBadge', 'proofEraser', 'threeLeafClover', 'megalith', 'glasswork',
  'everydayHero', 'slangDictionary', 'oneVoice', 'sometimesY', 'syllableScale',
  'glassInsurance', 'scrapDealer', 'lightTouch', 'heavyPress', 'hollowPromise',
  'doubleImpression', 'bestsellerBand', 'badReview', 'stargazer', 'fableHoard',
  'censorsBane', 'rotaryPress', 'stoneTongue', 'twinPeaks', 'wordHunter',
  'livingType', 'royalWe', 'bloodTypeA',
  'palindromist',
]);

const safeValue = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;

const emptyProgress = (): EmojiUnlockProgress => ({
  version: VERSION,
  unlocked: [],
  values: {},
  run: null,
});

function normalizeRun(value: unknown): RunTracker | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<RunTracker>;
  if (typeof run.seed !== 'string') return null;
  const letters = (input: unknown): Letter[] => Array.isArray(input)
    ? input.filter((letter): letter is Letter =>
        typeof letter === 'string' && /^[A-Z]$/.test(letter))
    : [];
  return {
    seed: run.seed,
    initialLetters: letters(run.initialLetters),
    rareLetters: letters(run.rareLetters),
    noVulgar: run.noVulgar !== false,
    shopVisit: safeValue(run.shopVisit),
    blindKey: typeof run.blindKey === 'string' ? run.blindKey : '',
    discardActions: safeValue(run.discardActions),
    discardedTiles: safeValue(run.discardedTiles),
  };
}

function normalizedProgress(
  stored: Partial<EmojiUnlockProgress> | null,
  slot: ProfileSlot,
): EmojiUnlockProgress {
  const progress = emptyProgress();
  if (stored?.values && typeof stored.values === 'object') {
    for (const [id, value] of Object.entries(stored.values)) {
      if (LOCKED_IDS.has(id)) progress.values[id] = safeValue(value);
    }
  }
  const known = new Set(ALL_JOKERS.map((def) => def.id));
  progress.unlocked = Array.isArray(stored?.unlocked)
    ? stored.unlocked.filter((id): id is string => typeof id === 'string' && known.has(id))
    : [];
  progress.run = normalizeRun(stored?.run);

  // Existing profiles keep every reliable achievement that was already recorded
  // elsewhere; conditions with no historic evidence begin at zero.
  const vouchers = loadVoucherProgress(slot);
  const lifetime = loadLifetime(slot);
  progress.values.spareDrawer = Math.max(progress.values.spareDrawer ?? 0, lifetime.highestAnte);
  progress.values.stargazer = Math.max(progress.values.stargazer ?? 0, vouchers.constellationUsed);
  progress.values.fableHoard = Math.max(progress.values.fableHoard ?? 0, vouchers.fableUsed);
  progress.values.wordHunter = Math.max(progress.values.wordHunter ?? 0, collectionSize(slot));
  const validWordPlays = Object.values(loadCollection(slot))
    .reduce((sum, entry) => sum + entry.plays, 0);
  progress.values.bookworm = Math.max(progress.values.bookworm ?? 0, validWordPlays);

  for (const rule of EMOJI_UNLOCK_RULES) {
    if ((progress.values[rule.id] ?? 0) >= rule.target && !progress.unlocked.includes(rule.id)) {
      progress.unlocked.push(rule.id);
    }
  }
  return progress;
}

export function loadEmojiUnlockProgress(
  slot: ProfileSlot = activeProfile(),
): EmojiUnlockProgress {
  return normalizedProgress(readProfileValue<Partial<EmojiUnlockProgress>>(KEY, slot), slot);
}

export function writeEmojiUnlockProgress(
  progress: EmojiUnlockProgress,
  slot: ProfileSlot = activeProfile(),
): void {
  writeProfileValue(KEY, slot, progress);
}

export function revealAllEmojiTiles(slot: ProfileSlot): void {
  const progress = loadEmojiUnlockProgress(slot);
  writeEmojiUnlockProgress({
    ...progress,
    unlocked: EMOJI_UNLOCK_RULES.map((rule) => rule.id),
  }, slot);
}

export function unlockedEmojiSet(slot: ProfileSlot = activeProfile()): Set<string> {
  const earned = new Set(loadEmojiUnlockProgress(slot).unlocked);
  return new Set(ALL_JOKERS
    .filter((def) => def.rarity === 'legendary' || !LOCKED_IDS.has(def.id) || earned.has(def.id))
    .map((def) => def.id));
}

export const isEmojiUnlocked = (
  id: string,
  progress: EmojiUnlockProgress = loadEmojiUnlockProgress(),
): boolean => !LOCKED_IDS.has(id) || progress.unlocked.includes(id);

export function emojiUnlockValue(
  id: string,
  progress: EmojiUnlockProgress = loadEmojiUnlockProgress(),
): { current: number; target: number } | null {
  const target = TARGETS[id];
  return target === undefined ? null : { current: progress.values[id] ?? 0, target };
}

const blindKey = (run: RunState): string => `${run.ante}:${run.blindIndex}`;

function uniqueLetters(tiles: readonly Tile[]): Letter[] {
  return [...new Set(tiles.flatMap((tile) => tile.letter ? [tile.letter] : []))];
}

function ensureRun(progress: EmojiUnlockProgress, run: RunState): RunTracker {
  if (progress.run?.seed === run.seed) return progress.run;
  progress.run = {
    seed: run.seed,
    initialLetters: uniqueLetters(run.bag),
    rareLetters: [],
    noVulgar: true,
    shopVisit: run.shopsVisited ?? 0,
    blindKey: blindKey(run),
    discardActions: 0,
    discardedTiles: 0,
  };
  return progress.run;
}

function startRun(progress: EmojiUnlockProgress, run: RunState): void {
  for (const id of LOCKED_IDS) {
    if (!CUMULATIVE_IDS.has(id) && !progress.unlocked.includes(id)) progress.values[id] = 0;
  }
  progress.run = null;
  ensureRun(progress, run);
}

function ensureBlind(progress: EmojiUnlockProgress, run: RunState): RunTracker {
  const tracker = ensureRun(progress, run);
  const key = blindKey(run);
  if (tracker.blindKey !== key) {
    tracker.blindKey = key;
    tracker.discardActions = 0;
    tracker.discardedTiles = 0;
    progress.values.discardedDraft = 0;
    progress.values.rewrite = 0;
  }
  return tracker;
}

const add = (progress: EmojiUnlockProgress, id: string, amount = 1): void => {
  progress.values[id] = (progress.values[id] ?? 0) + amount;
};

const raise = (progress: EmojiUnlockProgress, id: string, value: number): void => {
  progress.values[id] = Math.max(progress.values[id] ?? 0, value);
};

const set = (progress: EmojiUnlockProgress, id: string, value: number): void => {
  progress.values[id] = value;
};

function snapshot(progress: EmojiUnlockProgress, run: RunState): void {
  const tracker = ensureRun(progress, run);
  raise(progress, 'miser', run.gold);
  raise(progress, 'goldenType', run.gold);
  raise(progress, 'spareDrawer', run.ante);
  if (tracker.noVulgar) raise(progress, 'civilTongue', run.ante);
  set(progress, 'noiseCancelling', run.skippedBlinds);
  raise(
    progress,
    'exactingCritic',
    run.jokers.filter((owned) =>
      ALL_JOKERS.find((def) => def.id === owned.defId)?.rarity === 'uncommon').length,
  );
  if (run.ante >= target('anonymous') && run.jokers.length >= jokerSlotLimit(run)) {
    set(progress, 'anonymous', run.ante);
  }
  const woodChips = run.bag.reduce((highest, tile) => tile.material === 'wood'
    ? Math.max(highest, tile.woodBonusChips ?? BALANCE.materials.wood.baseChips)
    : highest, 0);
  raise(progress, 'growthRings', woodChips);
  raise(progress, 'woodblockPress', woodChips);
  const currentLetters = new Set(uniqueLetters(run.bag));
  if (tracker.initialLetters.some((letter) => !currentLetters.has(letter))) {
    set(progress, 'outOfPrint', 1);
  }
}

function playedWord(
  progress: EmojiUnlockProgress,
  run: RunState,
  blind: BlindState,
  submission: WordSubmission,
  letterHandId: string | null,
  heldTiles: readonly Tile[],
  bossDiscarded: number,
): void {
  const tracker = ensureBlind(progress, run);
  add(progress, 'bookworm');
  add(progress, 'voraciousReader');
  if (submission.isGibberish) {
    add(progress, 'fillInTheBlank');
    add(progress, 'badReview');
  }

  const suits = submissionSuits(submission);
  if (suits.includes('vulgar')) tracker.noVulgar = false;
  if (!submission.isGibberish) {
    if (suits.includes('slang')) add(progress, 'slangDictionary');
    if (suits.includes('standard')) add(progress, 'everydayHero');
    if (submission.tiles.some((tile) => tile.letter === 'A') &&
        submission.tiles.some((tile) => tile.letter === 'O')) add(progress, 'bloodTypeA');
  }

  const previous = blind.sequence.at(-2);
  if (!submission.isGibberish &&
      previous && !previous.isGibberish &&
      previous.tiles[0]?.letter === submission.tiles[0]?.letter) {
    add(progress, 'alliterationSticker');
  }

  for (const tile of submission.tiles) {
    if (tile.material === 'porcelain') add(progress, 'porcelainCat');
    if (tile.material === 'wood') add(progress, 'woodpecker');
    if (tile.material === 'stone') {
      add(progress, 'megalith');
      add(progress, 'stoneTongue');
    }
    if (tile.letter === 'Y') add(progress, 'sometimesY');
    if (tile.font === 'lightItalic') add(progress, 'lightTouch');
    if (tile.font === 'bold') add(progress, 'heavyPress');
    if (tile.font === 'black') add(progress, 'doubleImpression');
    if (tile.letter && ['Q', 'Z', 'X', 'J'].includes(tile.letter) &&
        !tracker.rareLetters.includes(tile.letter)) tracker.rareLetters.push(tile.letter);
  }
  set(progress, 'rareEarth', tracker.rareLetters.length);

  if (letterHandId === 'straight') add(progress, 'letterLadderBadge');
  if (letterHandId === 'twin') add(progress, 'twinPeaks');
  if (letterHandId === 'palindrome' || letterHandId === 'grandPalindrome') {
    add(progress, 'palindromist');
  }
  set(progress, 'handScholar', run.playedLetterHands?.length ?? 0);

  const letters = submission.tiles.flatMap((tile) => tile.letter ? [tile.letter] : []);
  const vowels = letters.filter(isVowel).length;
  const consonants = letters.filter(isConsonant).length;
  if (Math.abs(vowels - consonants) === 1) add(progress, 'syllableScale');

  const materials = new Set(submission.tiles.map((tile) => tile.material));
  if (materials.size >= target('materialSampler')) set(progress, 'materialSampler', materials.size);
  if (materials.size >= target('materialPrism')) set(progress, 'materialPrism', materials.size);
  if (submission.tiles.length >= target('monomaterial') && materials.size === 1) {
    set(progress, 'monomaterial', submission.tiles.length);
  }
  const fonts = new Set(submission.tiles.map((tile) => tile.font));
  if (submission.tiles.length >= target('houseStyle') && fonts.size === 1 &&
      submission.tiles[0]?.font !== 'medium') set(progress, 'houseStyle', submission.tiles.length);

  if (submission.tiles.length >= 7) add(progress, 'bestsellerBand');
  raise(progress, 'longFormSerial', submission.tiles.length);
  let longestAlphabetRun = submission.tiles.length > 0 ? 1 : 0;
  let currentAlphabetRun = longestAlphabetRun;
  for (let index = 1; index < submission.tiles.length; index += 1) {
    const before = submission.tiles[index - 1]?.letter;
    const letter = submission.tiles[index]?.letter;
    currentAlphabetRun = before && letter && letter.charCodeAt(0) === before.charCodeAt(0) + 1
      ? currentAlphabetRun + 1
      : 1;
    longestAlphabetRun = Math.max(longestAlphabetRun, currentAlphabetRun);
  }
  raise(progress, 'alphabetPress', longestAlphabetRun);
  const consonantCounts = new Map<Letter, number>();
  for (const letter of letters.filter(isConsonant)) {
    consonantCounts.set(letter, (consonantCounts.get(letter) ?? 0) + 1);
  }
  raise(progress, 'consonantChoir', Math.max(0, ...consonantCounts.values()));

  const sequence = blind.sequence;
  const lastFour = sequence.slice(-target('serial'));
  if (lastFour.length === target('serial') &&
      new Set(lastFour.map((word) => word.tiles.length)).size === 1) {
    set(progress, 'serial', target('serial'));
  }
  const rhyme = sequence.slice(-target('rhymeChain'));
  if (rhyme.length === target('rhymeChain') && rhyme.every((word) =>
      !word.isGibberish && word.text.length >= 2 &&
      word.text.slice(-2).toLowerCase() === rhyme[0]!.text.slice(-2).toLowerCase())) {
    set(progress, 'rhymeChain', target('rhymeChain'));
  }
  if (!submission.isGibberish && previous && !previous.isGibberish &&
      previous.text.toLowerCase() === submission.text.toLowerCase()) {
    set(progress, 'plagiarist', target('plagiarist'));
  }
  set(progress, 'twentyFifthBlessing', heldTiles.filter((tile) => tile.letter === 'Y').length);

  if (!submission.isGibberish) {
    const collection = loadCollection();
    const unique = Object.keys(collection).length +
      (collection[submission.text.toLowerCase()] ? 0 : 1);
    raise(progress, 'wordHunter', unique);
  }
  if (bossDiscarded > 0) {
    tracker.discardedTiles += bossDiscarded;
    set(progress, 'discardedDraft', tracker.discardedTiles);
  }
  snapshot(progress, run);
}

function tileChanges(
  progress: EmojiUnlockProgress,
  run: RunState,
  destroyed: readonly Tile[],
  created: readonly Tile[],
): void {
  if (destroyed.length > 0) {
    add(progress, 'scrapDealer', destroyed.length);
    const glass = destroyed.filter((tile) => tile.material === 'glass').length;
    if (glass > 0) {
      add(progress, 'glasswork', glass);
      add(progress, 'glassInsurance', glass);
    }
  }
  if (created.length > 0) add(progress, 'livingType', created.length);
  snapshot(progress, run);
}

function blindCleared(
  progress: EmojiUnlockProgress,
  run: RunState,
  blind: BlindState,
  judgment: SentenceJudgment,
  interest: number,
  acrostic: boolean,
): void {
  const tracker = ensureBlind(progress, run);
  raise(progress, 'spareDrawer', run.ante);
  if (tracker.noVulgar) raise(progress, 'civilTongue', run.ante);

  const validSentence = blind.sequence.length > 0 &&
    blind.sequence.every((word) => !word.isGibberish);
  const styles = new Set(blind.sequence.flatMap((word) => submissionSuits(word)));
  if (validSentence && styles.size >= target('comboArtist')) set(progress, 'comboArtist', styles.size);
  if (validSentence && judgment.unison) {
    add(progress, 'oneVoice');
    add(progress, 'royalWe');
  }
  if (styles.has('formal') && styles.has('vulgar')) set(progress, 'hypocrite', 1);
  if (blind.kind === 'boss') {
    add(progress, 'censorsBane');
    if (tracker.discardActions === 0) set(progress, 'cleanCopy', 1);
    if (judgment.match === null) set(progress, 'brokenSentence', 1);
  }
  if (tracker.discardActions >= target('rewrite')) set(progress, 'rewrite', tracker.discardActions);
  if (blind.bag.length === 0) {
    set(progress, 'lastSort', 1);
    if (blind.kind === 'boss') set(progress, 'nightOwl', 1);
  }
  if (blind.sequence.length >= target('dadaist') &&
      blind.sequence.every((word) => word.isGibberish)) {
    set(progress, 'dadaist', blind.sequence.length);
  }
  raise(progress, 'interestGlutton', interest);
  if (blind.sequence.length === blind.phasesTotal && validSentence) add(progress, 'rotaryPress');
  if (acrostic) set(progress, 'acrosticPoet', 1);
  if (run.bag.filter((tile) => tile.font !== 'medium').length >= target('typesettingMachine')) {
    set(progress, 'typesettingMachine', run.bag.filter((tile) => tile.font !== 'medium').length);
  }
  snapshot(progress, run);
}

export type EmojiUnlockEvent =
  | { kind: 'newRun'; run: RunState }
  | { kind: 'blindStarted'; run: RunState }
  | {
      kind: 'wordPlayed';
      run: RunState;
      blind: BlindState;
      submission: WordSubmission;
      letterHandId: LetterHandId | null;
      heldTiles: readonly Tile[];
      bossDiscarded: number;
    }
  | { kind: 'discardUsed'; run: RunState; tiles: number; slotsBlocked: number }
  | { kind: 'tileChanges'; run: RunState; destroyed: readonly Tile[]; created: readonly Tile[] }
  | { kind: 'jokerSold'; run: RunState }
  | { kind: 'jokerBought'; run: RunState }
  | { kind: 'shopEntered'; run: RunState }
  | { kind: 'packOpened'; run: RunState }
  | { kind: 'consumableUsed'; run: RunState; family: 'fable' | 'constellation' | 'gambler' }
  | { kind: 'blindSkipped'; run: RunState }
  | {
      kind: 'blindCleared';
      run: RunState;
      blind: BlindState;
      judgment: SentenceJudgment;
      interest: number;
      acrostic: boolean;
    }
  | { kind: 'snapshot'; run: RunState };

/** Record one semantic game action and return ids unlocked by that action. */
export function recordEmojiUnlockEvent(event: EmojiUnlockEvent): string[] {
  if (event.run.customSeed) return [];
  const progress = loadEmojiUnlockProgress();
  if (event.kind === 'newRun') startRun(progress, event.run);
  else {
    ensureRun(progress, event.run);
    switch (event.kind) {
      case 'blindStarted':
        ensureBlind(progress, event.run);
        break;
      case 'wordPlayed':
        playedWord(
          progress,
          event.run,
          event.blind,
          event.submission,
          event.letterHandId,
          event.heldTiles,
          event.bossDiscarded,
        );
        break;
      case 'discardUsed': {
        const tracker = ensureBlind(progress, event.run);
        tracker.discardActions += 1;
        tracker.discardedTiles += event.tiles;
        add(progress, 'proofEraser');
        add(progress, 'hollowPromise', event.slotsBlocked);
        set(progress, 'discardedDraft', tracker.discardedTiles);
        // Rewrite requires the blind to be cleared after four uses. Show live
        // progress without granting on the fourth click itself.
        set(progress, 'rewrite', Math.min(tracker.discardActions, target('rewrite') - 1));
        snapshot(progress, event.run);
        break;
      }
      case 'tileChanges':
        tileChanges(progress, event.run, event.destroyed, event.created);
        break;
      case 'jokerSold':
        add(progress, 'threeLeafClover');
        snapshot(progress, event.run);
        break;
      case 'jokerBought': {
        const tracker = ensureRun(progress, event.run);
        if (tracker.shopVisit !== (event.run.shopsVisited ?? 0)) {
          tracker.shopVisit = event.run.shopsVisited ?? 0;
          set(progress, 'carteBlanche', 0);
        }
        add(progress, 'carteBlanche');
        snapshot(progress, event.run);
        break;
      }
      case 'shopEntered': {
        const tracker = ensureRun(progress, event.run);
        tracker.shopVisit = event.run.shopsVisited ?? 0;
        set(progress, 'carteBlanche', 0);
        snapshot(progress, event.run);
        break;
      }
      case 'packOpened':
        add(progress, 'copyEditor');
        snapshot(progress, event.run);
        break;
      case 'consumableUsed':
        if (event.family === 'fable') add(progress, 'fableHoard');
        if (event.family === 'constellation') add(progress, 'stargazer');
        snapshot(progress, event.run);
        break;
      case 'blindSkipped':
      case 'snapshot':
        snapshot(progress, event.run);
        break;
      case 'blindCleared':
        blindCleared(
          progress,
          event.run,
          event.blind,
          event.judgment,
          event.interest,
          event.acrostic,
        );
        break;
    }
  }

  const before = new Set(progress.unlocked);
  for (const rule of EMOJI_UNLOCK_RULES) {
    if ((progress.values[rule.id] ?? 0) >= rule.target && !before.has(rule.id)) {
      progress.unlocked.push(rule.id);
    }
  }
  const unlocked = progress.unlocked.filter((id) => !before.has(id));
  writeValue(KEY, progress);
  return unlocked;
}
