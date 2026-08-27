import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/engine/balance';
import { ALL_JOKERS, createOwnedJoker, DEVELOPER_JOKERS } from '../src/engine/jokers';
import { discardTiles, enterJokerBlind, startBlind, submitWord } from '../src/engine/loop';
import { makeRng } from '../src/engine/rng';
import { newRun } from '../src/engine/run';
import type { Tile } from '../src/engine/types';
import {
  applyFlags,
  assertFiniteTree,
  parseVerificationArgs,
  rate,
  reportJson,
  reportMarkdown,
  robustZ,
  runBoardVerification,
  type VerificationConfig,
  type VerificationRow,
} from '../src/sim/board-verification';
import {
  freshCohort,
  legalFallback,
  mergeDiscardResult,
  mergeSubmitResult,
  recordBlindSelectedTelemetry,
  resolveFreePackOptions,
  simulateRun,
  visitShop,
  WordSolver,
} from '../src/sim/full-run-balance';
import {
  assertFlagRerunOutputSafe,
  flagRerunJson,
  meanInterval,
  parseFlagRerunArgs,
  runFlagRerun,
  runTuningPost,
  tuningPostJson,
} from '../src/sim/emoji-flag-rerun';
import {
  compareSkipOutcome,
  parseSkipVerificationArgs,
  runSkipVerification,
  skipReportJson,
  skipTimingBucket,
} from '../src/sim/skip-verification';
import { loadStubLexicon } from '../src/sim/stub-lexicon';

const tinyConfig: VerificationConfig = {
  profile: 'smoke',
  seedPrefix: 'test-board',
  seedStart: 7,
  budget: {
    global: 0,
    focal: 1,
    focalChapters: 1,
    endlessMarket: 0,
    endlessFocal: 0,
    pouchRecord: 0,
  },
  focalIds: ['bald', 'recycling'],
};
const lexicon = loadStubLexicon();
const solver = new WordSolver(lexicon);
const fullBoardSource = 'docs/balance/2026-08-22-board-verification-full.json';

const metricRow = (
  id: string,
  ownedWords: number,
  triggers = 0,
  score = 0,
  gold = 0,
): VerificationRow => ({
  id,
  rarity: 'common',
  layer: 1,
  offers: 0,
  acquisitions: 0,
  ownedBlinds: 0,
  ownedWords,
  triggers,
  chipsDelta: 0,
  multDelta: 0,
  chipsFactor: 0,
  multFactor: 0,
  scoreDelta: score,
  goldDelta: gold,
  growthDelta: 0,
  stateChanges: 0,
  focalRuns: 1,
  chapter8Reached: 0,
  chapter8Wins: 0,
  meanScoreTargetDelta: score,
  meanGoldDelta: gold,
  endlessPeakChapter: 0,
  endlessComplete: 0,
  endlessCheckpoints: {},
  insufficient: false,
  unexercised: false,
  dead: false,
  outlier: false,
  outlierMetrics: [],
});

describe('150 Emoji Tile board verification', () => {
  it('keeps the exact public roster and excludes developer entries', () => {
    expect(ALL_JOKERS).toHaveLength(150);
    expect(Object.fromEntries(['common', 'uncommon', 'rare', 'legendary'].map((rarity) => [
      rarity,
      ALL_JOKERS.filter((def) => def.rarity === rarity).length,
    ]))).toEqual({ common: 34, uncommon: 57, rare: 54, legendary: 5 });
    expect(ALL_JOKERS.some((def) => DEVELOPER_JOKERS.some((dev) => dev.id === def.id))).toBe(false);
  });

  it('is deeply deterministic for the same small config', () => {
    const first = runBoardVerification(tinyConfig);
    const second = runBoardVerification(tinyConfig);
    expect(second).toEqual(first);
    expect(reportJson(second)).toBe(reportJson(first));
    expect(first.roster.total).toBe(150);
    expect(first.coverage.schema).toBe(150);
    expect(first.coverage.focal).toBe(2);
    expect(first.rows.find((row) => row.id === 'bald')?.triggers).toBeGreaterThan(0);
    expect(first.pouchRecord).toHaveLength(14 * 8);
    expect(() => assertFiniteTree(first)).not.toThrow();
  });

  it('reaches the Chapter-38 endpoint without constructing Chapter 39', () => {
    const result = simulateRun(
      'board-v1:endless-market:0',
      lexicon,
      solver,
      freshCohort(1, true, 38),
    );
    expect(result).toMatchObject({ reachedChapter: 38, endlessComplete: true });
    expect(result.checkpoints.map(({ chapter }) => chapter)).toEqual([9, 12, 16, 24, 32, 38]);
    expect(Math.max(...result.checkpoints.map(({ chapter }) => chapter))).toBe(38);
    expect(() => assertFiniteTree(result, result.seed)).not.toThrow();
  });

  it('reports a deterministic illegal-blind failure with its boss context', () => {
    const result = simulateRun(
      'board-v1:global:7',
      lexicon,
      solver,
      freshCohort(1, false, 8),
    );
    expect(result).toMatchObject({ reachedChapter: 7, blindFailure: true });
    expect(result.blindFailureContexts).toContainEqual({
      seed: 'board-v1:global:7',
      chapter: 7,
      blindIndex: 2,
      bossId: 'stereotypePlate',
      focalJokerId: null,
    });
  });

  it('keeps omitted skip options byte-for-byte equivalent to explicit Play decisions', () => {
    const omitted = simulateRun(
      'board-v1:global:7', lexicon, solver, freshCohort(1, false, 8),
    );
    const explicitPlay = simulateRun(
      'board-v1:global:7', lexicon, solver, freshCohort(1, false, 8),
      { skipDecisionIndices: [] },
    );

    expect(explicitPlay).toEqual(omitted);
    expect(omitted).toMatchObject({
      reachedChapter: 7,
      won: false,
      endlessComplete: false,
      blindFailure: true,
      finalGold: 83,
      chapter8Score: null,
      chapter8Target: null,
      furthestBlind: 21,
      terminalScoreTarget: 0.6411916666666667,
      playedBlinds: 21,
      shops: 20,
    });
  }, 10_000);

  it.each([
    ['medusa', null],
    ['nokdoScript', 'stone-forced'],
  ] as const)('plays a legal Stone gibberish fallback for %s', (bossId, forcedTileId) => {
    const run = newRun(`stone-${bossId}`);
    const stone: Tile = {
      id: 'stone-forced', letter: null, material: 'stone', font: 'medium', edition: 'base',
    };
    const blind = {
      ...startBlind(run, makeRng(`stone-${bossId}-blind`), { kind: 'boss', bossId }),
      hand: [stone],
      bag: [],
      forcedTileId,
    };
    const ids = legalFallback(run, blind, lexicon);

    expect(ids).toEqual([stone.id]);
    expect(submitWord(blind, run, lexicon, ids!, makeRng(`stone-${bossId}-play`)).submission)
      .toMatchObject({ isGibberish: true });
  });

  it('does not pay for or open Charm Packs when Emoji acquisition is disabled', () => {
    const run = newRun('no-charm-0');
    run.gold = BALANCE.pack.size.normal.price;
    const cohort = freshCohort(1, false, 1);
    const next = visitShop(run, 'no-charm-0', 0, cohort, new Set(), new Set(), false);

    expect(next.gold).toBe(run.gold);
    expect(cohort).toMatchObject({ charmPacks: 0, jokersBought: 0 });
    expect(Object.values(cohort.jokers).every(({ acquisitions }) => acquisitions === 0)).toBe(true);

    const tileRun = newRun('tile-control-0');
    tileRun.gold = 100;
    const tileCohort = freshCohort(1, false, 1);
    const afterTilePack = visitShop(
      tileRun, 'tile-control-0', 0, tileCohort, new Set(), new Set(), false,
    );
    expect(tileCohort).toMatchObject({ charmPacks: 0, tilePacks: 1, jokersBought: 0 });
    expect(afterTilePack.gold).toBeLessThan(tileRun.gold);
  });

  it('opens Coupon-tagged free Charm Packs at zero gold', () => {
    const run = newRun('coupon-qa:0');
    run.gold = 0;
    run.pendingShopTags = ['couponTag'];
    const cohort = freshCohort(1, false, 1);
    const next = visitShop(run, 'coupon-qa:0', 0, cohort, new Set(), new Set());

    expect(next.gold).toBe(0);
    expect(next.pendingShopTags).toEqual([]);
    expect(cohort.charmPacks).toBe(2);

    const paidCohort = freshCohort(1, false, 1);
    visitShop(
      { ...newRun('coupon-qa:0'), gold: 0 },
      'coupon-qa:0',
      0,
      paidCohort,
      new Set(),
      new Set(),
    );
    expect(paidCohort.charmPacks).toBe(0);
  });

  it('resolves Constellations immediately through pattern levels and hooks', () => {
    const run = newRun('free-constellation');
    run.consumableSlots = 0;
    run.jokers = [createOwnedJoker(run, 'stargazer')];
    const blind = startBlind(run, makeRng('free-constellation-blind'));
    const result = resolveFreePackOptions(run, blind, {
      type: 'pattern', size: 'normal', artVariant: 0, pick: 1,
      options: [{ kind: 'punctuation', id: 'aries', pattern: 'simple' }],
    }, [], 'free-constellation');

    expect(result).toMatchObject({ picksUsed: 1, levelledPatterns: ['simple'] });
    expect(result.run.patternLevels.simple).toBe((run.patternLevels.simple ?? 1) + 1);
    expect(result.run.consumables).toEqual([]);
    expect(result.run.lastFableOrConstellation).toBe('aries');
    expect(result.run.jokers[0]!.state.factor).toBeGreaterThan(
      run.jokers[0]!.state.factor ?? 0,
    );
  });

  it('uses immediate and targeted Fables while holding blind-only Fables', () => {
    const run = newRun('free-fables');
    run.gold = 7;
    const blind = startBlind(run, makeRng('free-fables-blind'));
    const candidates = run.bag.slice(0, 10);
    const immediate = resolveFreePackOptions(run, blind, {
      type: 'consumable', size: 'normal', artVariant: 0, pick: 1,
      options: [{ kind: 'consumable', id: 'fable9' }],
    }, candidates, 'free-fable9');
    expect(immediate.run).toMatchObject({ gold: 14, fablesUsed: 1, consumables: [] });
    expect(immediate.usedFables).toEqual(['fable9']);

    const targeted = resolveFreePackOptions(run, blind, {
      type: 'consumable', size: 'normal', artVariant: 0, pick: 1,
      options: [{ kind: 'consumable', id: 'fable4' }],
    }, candidates, 'free-fable4');
    expect(targeted.usedFables).toEqual(['fable4']);
    expect(targeted.run.consumables).toEqual([]);
    expect(targeted.candidateTiles).toHaveLength(10);
    expect(targeted.candidateTiles.filter(({ material }) => material === 'leadPlate')).toHaveLength(2);

    const held = resolveFreePackOptions(run, blind, {
      type: 'consumable', size: 'normal', artVariant: 0, pick: 1,
      options: [{ kind: 'consumable', id: 'fable1' }],
    }, candidates, 'free-fable1');
    expect(held).toMatchObject({ picksUsed: 1, heldFables: ['fable1'], usedFables: [] });
    expect(held.run.consumables).toEqual(['fable1']);
  });

  it('uses Ink cards immediately and only consumes successful Pack picks', () => {
    const run = newRun('free-ink');
    const blind = startBlind(run, makeRng('free-ink-blind'));
    const candidates = run.bag.slice(0, 10);
    const targeted = resolveFreePackOptions(run, blind, {
      type: 'ink', size: 'normal', artVariant: 0, pick: 1,
      options: [{ kind: 'consumable', id: 'barnSwallow' }],
    }, candidates, 'free-ink');
    expect(targeted).toMatchObject({ picksUsed: 1, usedGamblers: ['barnSwallow'] });
    expect(targeted.run.consumables).toEqual([]);
    expect(targeted.candidateTiles.some(({ font }) => font === 'black')).toBe(true);

    const full = { ...run, consumableSlots: 0 };
    const fallback = resolveFreePackOptions(full, blind, {
      type: 'consumable', size: 'normal', artVariant: 0, pick: 1,
      options: [
        { kind: 'consumable', id: 'fable1' },
        { kind: 'consumable', id: 'fable9' },
      ],
    }, candidates, 'free-fallback');
    expect(fallback).toMatchObject({ picksUsed: 1, heldFables: [], usedFables: ['fable9'] });
  });

  it('keeps a one-tile Delisting destruction out of the permanent pouch', () => {
    const run = newRun('sim-delisting');
    run.jokers = [createOwnedJoker(run, 'delisting')];
    const blind = startBlind(run, makeRng('sim-delisting-blind'));
    const tile = blind.hand[0]!;
    const result = discardTiles(blind, run, [tile.id], makeRng('sim-delisting-discard'));
    const merged = mergeDiscardResult(run, result);

    expect(result.destroyedTiles).toEqual([tile]);
    expect(merged.bag).toHaveLength(run.bag.length - 1);
    expect(merged.bag.some(({ id }) => id === tile.id)).toBe(false);
    expect(merged.discardedLetterCounts).toEqual(result.discardedLetterCounts);
  });

  it('accumulates boss-discarded letters from SubmitResult into the run', () => {
    const run = newRun('sim-letter-discard');
    run.discardedLetters = ['A'];
    run.discardedLetterCounts = { A: 2 };
    const blind = startBlind(run, makeRng('sim-letter-discard-blind'), {
      kind: 'boss', bossId: 'letter', target: 100_000,
    });
    const result = submitWord(
      blind,
      run,
      lexicon,
      [blind.hand[0]!.id],
      makeRng('sim-letter-discard-play'),
    );
    const merged = mergeSubmitResult(run, result);

    expect(result.bossDiscardedTiles).toHaveLength(4);
    expect(merged.discardedLetters).toEqual(result.discardedLetters);
    expect(merged.discardedLetterCounts).toEqual(result.discardedLetterCounts);
    expect(Object.values(merged.discardedLetterCounts ?? {}).reduce((sum, count) => sum + count, 0))
      .toBe(6);
  });

  it('records blindSelected triggers and an owner destroyed by Host', () => {
    const run = newRun('host-telemetry');
    run.jokers = [createOwnedJoker(run, 'ceramicArtisan'), createOwnedJoker(run, 'host')];
    const blind = startBlind(run, makeRng('host-telemetry-blind'));
    const before = new Map(run.jokers.map((joker) => [joker.defId, JSON.stringify(joker.state)]));
    const selected = enterJokerBlind(run, blind, makeRng('host-telemetry-select'));
    const cohort = freshCohort(1, true, 1);

    recordBlindSelectedTelemetry(cohort, before, selected);

    expect(selected.run.jokers.map((joker) => joker.defId)).toEqual(['host']);
    expect(cohort.jokers.host).toMatchObject({ triggers: 1, stateChanges: 1 });
    expect(cohort.jokers.ceramicArtisan?.stateChanges).toBe(1);
  });

  it('handles aggregate zero denominators and finite diagnostics', () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(3, 4)).toBe(0.75);
    expect(() => assertFiniteTree({ seed: 'x', chapter: 38, score: Infinity })).toThrow(
      'report.score: non-finite number Infinity',
    );
  });

  it('applies dead and MAD-zero outlier boundaries deterministically', () => {
    const rows = [
      metricRow('under', 31),
      metricRow('dead', 32),
      metricRow('plain-a', 32, 1),
      metricRow('plain-b', 32, 1),
      metricRow('extreme', 32, 1, 100, 100),
    ];
    applyFlags(rows);
    expect(rows[0]).toMatchObject({ insufficient: true, dead: false });
    expect(rows[1]).toMatchObject({ insufficient: false, unexercised: true, dead: false });
    expect(rows[4]).toMatchObject({ outlier: true });
    expect(rows[4]!.outlierMetrics).toEqual(expect.arrayContaining(['scoreTargetDelta', 'goldDelta']));
    expect(Math.abs(robustZ([0, 0, 0, 0, 100], 100))).toBeGreaterThanOrEqual(3);
  });

  it('requires two semantic axes instead of duplicate metrics from one axis', () => {
    const rows = [
      metricRow('plain-a', 32, 1),
      metricRow('plain-b', 32, 1),
      metricRow('plain-c', 32, 1),
      metricRow('plain-d', 32, 1),
      metricRow('gold-only', 32, 1, 0, 100),
    ];
    applyFlags(rows);
    expect(rows[4]!.outlierMetrics).toEqual(expect.arrayContaining(['goldDeltaRate', 'goldDelta']));
    expect(rows[4]!.outlier).toBe(false);
  });

  it('strictly rejects invalid CLI arguments and records explicit overrides', () => {
    expect(() => parseVerificationArgs(['--profile=quick'])).toThrow('invalid profile');
    expect(() => parseVerificationArgs(['--wat=1'])).toThrow('invalid argument');
    expect(() => parseVerificationArgs(['--focal=0'])).toThrow('invalid --focal');
    expect(() => parseVerificationArgs(['--global=nope'])).toThrow('invalid --global');
    expect(parseVerificationArgs([
      '--profile=baseline', '--seed-prefix=abc', '--seed-start=3', '--global=4',
    ]).config).toMatchObject({
      profile: 'baseline',
      seedPrefix: 'abc',
      seedStart: 3,
      budget: { global: 4 },
    });
  });

  it('reports full sweep provenance without claiming it was not run', () => {
    const report = runBoardVerification(tinyConfig);
    const source = { node: 'v1', revision: 'abc', worktree: 'clean worktree' };
    const smoke = reportMarkdown(report, 'smoke', 1, source);
    const full = reportMarkdown(
      { ...report, config: { ...report.config, profile: 'full' } },
      'full',
      2,
      source,
    );

    expect(smoke).toContain('not run by this smoke');
    expect(full).toContain('Completed with the full profile command shown above.');
    expect(full).not.toContain('not run');
  });

  it('runs deterministic paired flagged-Emoji blocks and strict CLI validation', () => {
    const parsed = parseFlagRerunArgs([
      '--ids=houseStyle,bald', '--authored-gold=houseStyle', '--seeds=4',
      '--seed-start=2', '--seed-prefix=flag-test', `--source=${fullBoardSource}`,
    ]);
    expect(parsed.config.ids).toEqual(['bald', 'houseStyle']);
    expect(parsed.config.source).toEqual({
      path: fullBoardSource,
      sha256: createHash('sha256').update(readFileSync(fullBoardSource)).digest('hex'),
    });
    const first = runFlagRerun(parsed.config);
    const second = runFlagRerun(parsed.config);
    expect(second).toEqual(first);
    expect(flagRerunJson(second)).toBe(flagRerunJson(first));
    expect(first.rows).toHaveLength(2);
    expect(first.rows.every((row) => row.blocks.length === 4 && row.pairs === 4)).toBe(true);
    expect(first.rows.every((row) => row.blocks.every((block) => block.seeds === 1))).toBe(true);
    expect(first.opportunityNote).toContain('not per-effect condition opportunities');
    expect(first.rows.find((row) => row.id === 'houseStyle')?.selectionReason)
      .toBe('direct-authored-gold-extreme');
    expect(first.rows.find((row) => row.id === 'bald')?.selectionReason).toBe('semantic-outlier');
    expect(() => parseFlagRerunArgs([
      '--ids=developerGrace', '--seeds=4', `--source=${fullBoardSource}`,
    ]))
      .toThrow('unknown Emoji Tile id');
    expect(() => parseFlagRerunArgs([
      '--ids=bald,bald', '--seeds=4', `--source=${fullBoardSource}`,
    ]))
      .toThrow('duplicate --ids');
    expect(() => parseFlagRerunArgs([
      '--ids=bald', '--seeds=3', `--source=${fullBoardSource}`,
    ]))
      .toThrow('invalid --seeds');
    expect(() => parseFlagRerunArgs([
      '--ids=bald', '--wat=1', `--source=${fullBoardSource}`,
    ]))
      .toThrow('invalid argument');
    expect(() => parseFlagRerunArgs([
      '--ids=bald', '--authored-gold=houseStyle', `--source=${fullBoardSource}`,
    ]))
      .toThrow('not selected');
    expect(() => parseFlagRerunArgs(['--ids=bald', '--seeds=4']))
      .toThrow('--source requires');
    expect(() => parseFlagRerunArgs([
      '--ids=bald', '--seeds=4', '--source=docs/balance/2026-08-22-skip-verification.json',
    ])).toThrow('not a full board report');
  }, 15_000);

  it('computes deterministic normal 95% intervals', () => {
    expect(meanInterval([2])).toEqual({ mean: 2, lower95: 2, upper95: 2 });
    expect(meanInterval([1, 2, 3, 4]).mean).toBe(2.5);
    expect(meanInterval([1, 2, 3, 4]).lower95).toBeLessThan(2.5);
    expect(meanInterval([1, 2, 3, 4]).upper95).toBeGreaterThan(2.5);
  });

  it('compares old and current tuning on identical seeds in four stable blocks', () => {
    const config = {
      ids: ['biochemistry', 'wordHunter'],
      authoredGoldIds: [],
      seeds: 4,
      seedStart: 0,
      seedPrefix: 'tuning-test',
      source: { path: fullBoardSource, sha256: 'source-test' },
    };
    const before = { path: 'before.json', sha256: 'before-test' };
    const first = runTuningPost(config, before);
    const second = runTuningPost(config, before);

    expect(second).toEqual(first);
    expect(tuningPostJson(second)).toBe(tuningPostJson(first));
    expect(first.values).toEqual({
      biochemistry: { old: 0.5, current: 0.5 },
      wordHunter: { old: 0.1, current: 0.1 },
    });
    expect(first.rows.every((row) => row.pairs === 4 && row.blocks.length === 4)).toBe(true);
    expect(first.rows.every((row) => row.newMinusOld.scoreTargetDelta.mean === 0)).toBe(true);
    expect(() => assertFiniteTree(first)).not.toThrow();
  }, 15_000);

  it('strictly validates post-tune artifact seed and source provenance', () => {
    const parsed = parseFlagRerunArgs([
      '--ids=wordHunter,biochemistry', '--seeds=1024', '--seed-start=384',
      '--seed-prefix=selective-v1', `--source=${fullBoardSource}`,
      '--before=docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
    ]);
    expect(parsed.before).toEqual({
      path: 'docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
      sha256: '6c0eb8c5297a29ea2fb921f6ac871f23c1beb1248c60b07ce505052844950d27',
    });
    expect(() => parseFlagRerunArgs([
      '--ids=wordHunter,biochemistry', '--seeds=4', '--seed-start=384',
      '--seed-prefix=selective-v1', `--source=${fullBoardSource}`,
      '--before=docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
    ])).toThrow('--before seed budget or selected ids do not match');
  });

  it('protects historical pre-tune artifacts before simulation starts', () => {
    expect(() => assertFlagRerunOutputSafe(
      'docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
    )).not.toThrow();
    expect(() => assertFlagRerunOutputSafe('tmp/current-flag-rerun.json')).not.toThrow();
    const scripts = (JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    }).scripts;
    expect(scripts['sim:emoji-flag-1024']).not.toContain(
      '--json=docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
    );
  });

  it('reports the historical factor snapshot alongside the restored current balance', () => {
    expect(BALANCE.jokers.wordHunter.factorPerNewWord).toBe(0.1);
    expect(BALANCE.jokers.biochemistry.factorPerChain).toBe(0.5);

    const report = runSkipVerification({
      profile: 'full',
      seeds: 0,
      seedStart: 0,
      seedPrefix: 'factor-restore-test',
      factorSnapshot: 'pre-tune',
    });

    expect(report.emojiFactorSnapshot).toEqual({
      mode: 'pre-tune',
      wordHunterFactorPerNewWord: 0.1,
      biochemistryFactorPerChain: 0.5,
    });
    expect(BALANCE.jokers.wordHunter.factorPerNewWord).toBe(0.1);
    expect(BALANCE.jokers.biochemistry.factorPerChain).toBe(0.5);
  }, 20_000);

  it('verifies all 30 skip rewards, timing, consecutive use, and Endless bounds', () => {
    const config = { profile: 'smoke' as const, seeds: 0, seedStart: 0, seedPrefix: 'skip-test' };
    const first = runSkipVerification(config);
    const second = runSkipVerification(config);
    expect(second).toEqual(first);
    expect(skipReportJson(second)).toBe(skipReportJson(first));
    expect(first.rows).toHaveLength(30);
    expect(first.forcedCoverage).toHaveLength(30);
    expect(first.timingBuckets).toEqual({
      immediate: 12, nextBlind: 7, nextShop: 9, nextClear: 1, nextDeadline: 1,
    });
    expect(first.invariants).toMatchObject({
      exactRoster: true,
      deadlineRejected: true,
      noOfferRepeat: true,
      consecutiveSelected: ['extraPages', 'copyPass'],
      consecutiveResolved: ['extraPages', 'copyPass'],
      endlessComplete: true,
      peakChapter: 38,
      noChapter39: true,
      finite: true,
    });
    for (const id of ['tileTag', 'fableTag', 'constellationTag', 'charmTag', 'inkTag']) {
      expect(first.forcedCoverage.find((row) => row.id === id)?.freePackOpened, id).toBe(true);
    }
    expect(first.forcedCoverage.find((row) => row.id === 'publicity')?.resolved).toBe(true);
    expect(first.forcedCoverage.find((row) => row.id === 'investmentTag')?.resolved).toBe(true);
    expect(skipTimingBucket('extraPages')).toBe('nextBlind');
  }, 20_000);

  it('uses skip engine branches without scoring, Fee Settlement, or a skipped-stage shop', () => {
    const skipped = simulateRun(
      'skip-event-contract',
      lexicon,
      solver,
      freshCohort(1, true, 8),
      { skipDecisionIndices: [0], forcedSkipRewards: { 0: { id: 'advancePayment' } } },
    );
    expect(skipped.skip.events[0]).toMatchObject({
      decision: 0,
      chapter: 1,
      blindIndex: 0,
      scoring: false,
      feeSettlement: false,
      shopVisited: false,
    });
    expect(skipped.skip.freePacksOpened).toBe(0);
  });

  it('distinguishes unattempted pending Tags from failed shop resolution opportunities', () => {
    const failed = simulateRun(
      'skip-fail-23',
      lexicon,
      solver,
      freshCohort(1, true, 1),
      {
        disableJokerAcquisition: true,
        skipDecisionIndices: [0],
        forcedSkipRewards: { 0: { id: 'whiteTag' } },
      },
    );
    expect(failed.skip).toMatchObject({
      pending: ['whiteTag'],
      unresolved: ['whiteTag'],
      shopTagAttempts: [{ before: ['whiteTag'], applied: [], after: ['whiteTag'] }],
    });

    const unattempted = simulateRun(
      'skip-unresolved-15',
      lexicon,
      solver,
      freshCohort(1, true, 8),
      {
        disableJokerAcquisition: true,
        skipDecisionIndices: [15],
        forcedSkipRewards: { 15: { id: 'whiteTag' } },
      },
    );
    expect(unattempted.skip.pending).toEqual(['whiteTag']);
    expect(unattempted.skip.unresolved).toEqual([]);
    expect(unattempted.skip.shopTagAttempts.some(({ before }) => before.includes('whiteTag')))
      .toBe(false);
  });

  it('applies strict skip CLI parsing and lexicographic Play ties', () => {
    expect(parseSkipVerificationArgs([
      '--profile=baseline', '--seeds=3', '--seed-start=4', '--seed-prefix=skip-qa',
    ]).config).toEqual({ profile: 'baseline', seeds: 3, seedStart: 4, seedPrefix: 'skip-qa' });
    expect(parseSkipVerificationArgs(['--profile=full']).config.seeds).toBe(2_000);
    expect(() => parseSkipVerificationArgs(['--profile=quick'])).toThrow('invalid profile');
    expect(() => parseSkipVerificationArgs(['--wat=1'])).toThrow('invalid argument');
    const result = simulateRun('skip-tie', lexicon, solver, freshCohort(1, false, 1));
    expect(compareSkipOutcome(result, result)).toBe(0);
  });
});
