/// <reference types="node" />

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BALANCE } from '../engine/balance';
import { isImmediateSkipReward, isNextShopSkipReward, SKIP_REWARD_IDS, skipCurrentBlind } from '../engine/skipRewards';
import { makeRng } from '../engine/rng';
import { newRun } from '../engine/run';
import type { SkipRewardId, SkipRewardOffer } from '../engine/types';
import { assertFiniteTree } from './board-verification';
import { freshCohort, simulateRun, type SimulationResult, WordSolver } from './full-run-balance';
import { loadStubLexicon } from './stub-lexicon';

export type SkipVerificationProfile = 'smoke' | 'baseline' | 'full';
export type SkipTimingBucket = 'immediate' | 'nextBlind' | 'nextShop' | 'nextClear' | 'nextDeadline';

const PROFILE_SEEDS: Record<SkipVerificationProfile, number> = {
  smoke: 1,
  baseline: 8,
  full: 2_000,
};

export interface SkipVerificationConfig {
  profile: SkipVerificationProfile;
  seeds: number;
  seedStart: number;
  seedPrefix: string;
  factorSnapshot?: 'current' | 'pre-tune';
}

interface SkipTagRow {
  id: SkipRewardId;
  timing: SkipTimingBucket;
  offered: number;
  selected: number;
  resolved: number;
  pending: number;
  unresolved: number;
  meanWinDelta: number | null;
  meanFurthestBlindDelta: number | null;
  meanTerminalScoreTargetDelta: number | null;
  meanGoldDelta: number | null;
}

interface ForcedTagRow {
  id: SkipRewardId;
  timing: SkipTimingBucket;
  resolved: boolean;
  pending: boolean;
  unresolved: boolean;
  freePackOpened: boolean;
}

export interface SkipVerificationReport {
  schema: 1;
  config: SkipVerificationConfig;
  emojiFactorSnapshot: {
    mode: 'current' | 'pre-tune';
    wordHunterFactorPerNewWord: number;
    biochemistryFactorPerChain: number;
  };
  correction?: {
    previousArtifactSha256: string;
    reason: string;
  };
  policy: {
    name: 'neutral-single-decision-counterfactual';
    order: ['chapter8Win', 'furthestBlind', 'terminalScoreTarget', 'gold'];
    ties: 'play';
    proxyOnly: true;
    humanSkipTarget: [0.2, 0.35];
  };
  decisionsReached: number;
  selected: number;
  skipRate: number | null;
  timingBuckets: Record<SkipTimingBucket, number>;
  rows: SkipTagRow[];
  forcedCoverage: ForcedTagRow[];
  invariants: {
    exactRoster: boolean;
    deadlineRejected: boolean;
    noOfferRepeat: boolean;
    consecutiveSelected: SkipRewardId[];
    consecutiveResolved: SkipRewardId[];
    endlessComplete: boolean;
    peakChapter: number;
    noChapter39: boolean;
    finite: boolean;
  };
}

export function skipTimingBucket(id: SkipRewardId): SkipTimingBucket {
  if (isImmediateSkipReward(id)) return 'immediate';
  if (isNextShopSkipReward(id)) return 'nextShop';
  if (id === 'publicity') return 'nextClear';
  if (id === 'investmentTag') return 'nextDeadline';
  return 'nextBlind';
}

const forcedOffer = (id: SkipRewardId): SkipRewardOffer => {
  if (id === 'houseStyle') return { id, pattern: 'simple' };
  if (id === 'lipogramTag' || id === 'scarletTag') return { id, letter: 'A' };
  return { id };
};

const terminalRatio = (result: SimulationResult): number => result.terminalScoreTarget ?? -1;

/** Positive means the single-skip branch wins the fixed neutral outcome ordering. */
export function compareSkipOutcome(skip: SimulationResult, play: SimulationResult): number {
  const axes: [number, number][] = [
    [Number(skip.won), Number(play.won)],
    [skip.furthestBlind, play.furthestBlind],
    [terminalRatio(skip), terminalRatio(play)],
    [skip.finalGold, play.finalGold],
  ];
  for (const [left, right] of axes) {
    if (left !== right) return left > right ? 1 : -1;
  }
  return 0;
}

const mean = (values: readonly number[]): number | null => values.length === 0
  ? null
  : values.reduce((sum, value) => sum + value, 0) / values.length;

const noRepeat = (offers: readonly SkipRewardId[]): boolean => {
  const chapters = Array.from({ length: Math.floor(offers.length / 2) }, (_, index) => (
    offers.slice(index * 2, index * 2 + 2)
  ));
  return chapters.every((pair, index) => (
    pair.length === 2
    && pair[0] !== pair[1]
    && (index === 0 || pair.every((id) => !chapters[index - 1]!.includes(id)))
  ));
};

function runSkipVerificationAtSnapshot(config: SkipVerificationConfig): SkipVerificationReport {
  const lexicon = loadStubLexicon();
  const solver = new WordSolver(lexicon);
  const rows = new Map(SKIP_REWARD_IDS.map((id) => [id, {
    id,
    timing: skipTimingBucket(id),
    offered: 0,
    selected: 0,
    resolved: 0,
    pending: 0,
    unresolved: 0,
    winDeltas: [] as number[],
    furthestDeltas: [] as number[],
    terminalDeltas: [] as number[],
    goldDeltas: [] as number[],
  }]));
  let decisionsReached = 0;
  let selected = 0;
  for (let offset = 0; offset < config.seeds; offset += 1) {
    const seed = `${config.seedPrefix}:proxy:${config.seedStart + offset}`;
    const control = simulateRun(
      seed,
      lexicon,
      solver,
      freshCohort(1, false, 8),
      { collectSkipTelemetry: true },
    );
    decisionsReached += control.skip.decisionsReached;
    for (const id of control.skip.offered) rows.get(id)!.offered += 1;
    for (let decision = 0; decision < control.skip.decisionsReached; decision += 1) {
      const branch = simulateRun(seed, lexicon, solver, freshCohort(1, false, 8), {
        skipDecisionIndices: [decision],
      });
      if (compareSkipOutcome(branch, control) <= 0) continue;
      const id = branch.skip.selected[0];
      if (!id) throw new Error(`${seed}: selected skip ${decision} did not produce telemetry`);
      const row = rows.get(id)!;
      row.selected += 1;
      row.resolved += branch.skip.resolved.filter((candidate) => candidate === id).length;
      row.pending += branch.skip.pending.filter((candidate) => candidate === id).length;
      row.unresolved += branch.skip.unresolved.filter((candidate) => candidate === id).length;
      row.winDeltas.push(Number(branch.won) - Number(control.won));
      row.furthestDeltas.push(branch.furthestBlind - control.furthestBlind);
      row.terminalDeltas.push(terminalRatio(branch) - terminalRatio(control));
      row.goldDeltas.push(branch.finalGold - control.finalGold);
      selected += 1;
    }
  }

  const forcedCoverage = SKIP_REWARD_IDS.map((id): ForcedTagRow => {
    const result = simulateRun(
      `${config.seedPrefix}:forced:${id}`,
      lexicon,
      solver,
      freshCohort(1, true, 8),
      { skipDecisionIndices: [0], forcedSkipRewards: { 0: forcedOffer(id) } },
    );
    return {
      id,
      timing: skipTimingBucket(id),
      resolved: result.skip.resolved.includes(id),
      pending: result.skip.pending.includes(id),
      unresolved: result.skip.unresolved.includes(id),
      freePackOpened: result.skip.freePacksOpened > 0,
    };
  });

  const consecutive = simulateRun(
    `${config.seedPrefix}:consecutive`,
    lexicon,
    solver,
    freshCohort(1, true, 8),
    {
      skipDecisionIndices: [0, 1],
      forcedSkipRewards: { 0: { id: 'extraPages' }, 1: { id: 'copyPass' } },
    },
  );
  const offerProbe = simulateRun(
    `${config.seedPrefix}:offers`,
    lexicon,
    solver,
    freshCohort(1, true, 8),
    { collectSkipTelemetry: true },
  );
  const endless = simulateRun(
    `${config.seedPrefix}:endless`,
    lexicon,
    solver,
    freshCohort(1, true, 38),
    { skipDecisionIndices: [0], forcedSkipRewards: { 0: { id: 'advancePayment' } } },
  );
  const deadline = newRun(`${config.seedPrefix}:deadline`);
  deadline.blindIndex = 2;
  let deadlineRejected = false;
  try {
    skipCurrentBlind(deadline, makeRng(`${config.seedPrefix}:deadline-skip`));
  } catch (error) {
    deadlineRejected = error instanceof Error && error.message === 'Deadline cannot be skipped';
  }

  const report: SkipVerificationReport = {
    schema: 1,
    config: { ...config },
    emojiFactorSnapshot: {
      mode: config.factorSnapshot ?? 'current',
      wordHunterFactorPerNewWord: BALANCE.jokers.wordHunter.factorPerNewWord,
      biochemistryFactorPerChain: BALANCE.jokers.biochemistry.factorPerChain,
    },
    ...(config.profile === 'full' ? {
      correction: {
        previousArtifactSha256: '60164c39d56f47a2fe0681e3c86d7d15e41867b3094707fc637ae0291638052e',
        reason: config.factorSnapshot === 'pre-tune'
          ? 'Correct Coupon pricing and immediate Fable/Constellation/Ink Pack resolution at the original Emoji-factor snapshot.'
          : 'Authoritative corrected sweep after the approved Emoji-factor tuning.',
      },
    } : {}),
    policy: {
      name: 'neutral-single-decision-counterfactual',
      order: ['chapter8Win', 'furthestBlind', 'terminalScoreTarget', 'gold'],
      ties: 'play',
      proxyOnly: true,
      humanSkipTarget: [0.2, 0.35],
    },
    decisionsReached,
    selected,
    skipRate: decisionsReached > 0 ? selected / decisionsReached : null,
    timingBuckets: {
      immediate: SKIP_REWARD_IDS.filter((id) => skipTimingBucket(id) === 'immediate').length,
      nextBlind: SKIP_REWARD_IDS.filter((id) => skipTimingBucket(id) === 'nextBlind').length,
      nextShop: SKIP_REWARD_IDS.filter((id) => skipTimingBucket(id) === 'nextShop').length,
      nextClear: SKIP_REWARD_IDS.filter((id) => skipTimingBucket(id) === 'nextClear').length,
      nextDeadline: SKIP_REWARD_IDS.filter((id) => skipTimingBucket(id) === 'nextDeadline').length,
    },
    rows: [...rows.values()].map((row) => ({
      id: row.id,
      timing: row.timing,
      offered: row.offered,
      selected: row.selected,
      resolved: row.resolved,
      pending: row.pending,
      unresolved: row.unresolved,
      meanWinDelta: mean(row.winDeltas),
      meanFurthestBlindDelta: mean(row.furthestDeltas),
      meanTerminalScoreTargetDelta: mean(row.terminalDeltas),
      meanGoldDelta: mean(row.goldDeltas),
    })),
    forcedCoverage,
    invariants: {
      exactRoster: SKIP_REWARD_IDS.length === 30 && new Set(SKIP_REWARD_IDS).size === 30,
      deadlineRejected,
      noOfferRepeat: noRepeat(offerProbe.skip.offered),
      consecutiveSelected: consecutive.skip.selected,
      consecutiveResolved: consecutive.skip.resolved,
      endlessComplete: endless.endlessComplete,
      peakChapter: endless.reachedChapter,
      noChapter39: endless.furthestBlind <= 38 * 3,
      finite: true,
    },
  };
  assertFiniteTree(report, `skip profile=${config.profile}`);
  return report;
}

/** The corrected full artifact remains paired to the pre-tune sweep's two factor values. */
export function runSkipVerification(config: SkipVerificationConfig): SkipVerificationReport {
  if (config.factorSnapshot !== 'pre-tune') return runSkipVerificationAtSnapshot(config);
  const tuning = BALANCE.jokers as unknown as {
    wordHunter: { factorPerNewWord: number };
    biochemistry: { factorPerChain: number };
  };
  const currentWordHunter = tuning.wordHunter.factorPerNewWord;
  const currentBiochemistry = tuning.biochemistry.factorPerChain;
  tuning.wordHunter.factorPerNewWord = 0.1;
  tuning.biochemistry.factorPerChain = 0.5;
  try {
    return runSkipVerificationAtSnapshot(config);
  } finally {
    tuning.wordHunter.factorPerNewWord = currentWordHunter;
    tuning.biochemistry.factorPerChain = currentBiochemistry;
  }
}

export const skipReportJson = (report: SkipVerificationReport): string => `${JSON.stringify(report, null, 2)}\n`;

export function skipReportMarkdown(
  report: SkipVerificationReport,
  command: string,
  runtimeSeconds: number,
): string {
  return `# Skip reward verification

Profile: **${report.config.profile}**

Command: \`${command}\`

Measured runtime: ${runtimeSeconds.toFixed(1)}s (excluded from deterministic JSON).

Emoji factor snapshot: **${report.emojiFactorSnapshot.mode}** (Word Hunter +${report.emojiFactorSnapshot.wordHunterFactorPerNewWord}; Biochemistry +${report.emojiFactorSnapshot.biochemistryFactorPerChain}).

${report.correction ? `Correction provenance: previous JSON SHA-256 \`${report.correction.previousArtifactSha256}\` (${report.correction.reason})\n` : ''}

Proxy decisions: ${report.selected}/${report.decisionsReached} (${report.skipRate === null ? 'n/a' : `${(report.skipRate * 100).toFixed(1)}%`}). The 20–35% human target is context only; this neutral single-decision counterfactual is not human behavior and does not tune rewards.

Telemetry: pending means a selected reward remained stored at simulation end; unresolved is the pending subset whose named resolution opportunity occurred but failed and left it stored.

Ordering: Chapter 8 win → furthest blind → terminal score/target → gold; ties choose Play.

Forced coverage: ${report.forcedCoverage.length}/30 IDs. Timing buckets: immediate ${report.timingBuckets.immediate}, next blind ${report.timingBuckets.nextBlind}, next shop ${report.timingBuckets.nextShop}, next clear ${report.timingBuckets.nextClear}, next Deadline ${report.timingBuckets.nextDeadline}.

Deadline guard: ${report.invariants.deadlineRejected ? 'pass' : 'FAIL'}; offer no-repeat: ${report.invariants.noOfferRepeat ? 'pass' : 'FAIL'}; Chapter 38/no 39: ${report.invariants.endlessComplete && report.invariants.noChapter39 ? 'pass' : 'FAIL'}.

No balance values were changed and no tuning claim is made.
`;
}

const allowedArgs = new Set([
  'profile', 'seeds', 'seed-start', 'seed-prefix', 'factor-snapshot', 'json', 'markdown',
]);

export function parseSkipVerificationArgs(argv: readonly string[]): {
  config: SkipVerificationConfig;
  jsonPath?: string;
  markdownPath?: string;
} {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !allowedArgs.has(match[1]!)) throw new Error(`invalid argument: ${arg}`);
    if (values.has(match[1]!)) throw new Error(`duplicate argument: --${match[1]}`);
    values.set(match[1]!, match[2]!);
  }
  const profile = values.get('profile') ?? 'smoke';
  if (!['smoke', 'baseline', 'full'].includes(profile)) throw new Error(`invalid profile: ${profile}`);
  const integer = (name: string, fallback: number): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`invalid --${name}: ${raw}`);
    return parsed;
  };
  const seedPrefix = values.get('seed-prefix') ?? 'skip-v1';
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(seedPrefix)) throw new Error(`invalid --seed-prefix: ${seedPrefix}`);
  const factorSnapshot = values.get('factor-snapshot');
  if (factorSnapshot !== undefined && factorSnapshot !== 'pre-tune') {
    throw new Error(`invalid --factor-snapshot: ${factorSnapshot}`);
  }
  if (factorSnapshot && profile !== 'full') {
    throw new Error('--factor-snapshot is only valid for the full profile');
  }
  return {
    config: {
      profile: profile as SkipVerificationProfile,
      seeds: integer('seeds', PROFILE_SEEDS[profile as SkipVerificationProfile]),
      seedStart: integer('seed-start', 0),
      seedPrefix,
      ...(factorSnapshot ? { factorSnapshot } : {}),
    },
    ...(values.has('json') ? { jsonPath: values.get('json')! } : {}),
    ...(values.has('markdown') ? { markdownPath: values.get('markdown')! } : {}),
  };
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isMain) {
  try {
    const parsed = parseSkipVerificationArgs(process.argv.slice(2));
    const started = performance.now();
    const report = runSkipVerification(parsed.config);
    const runtimeSeconds = (performance.now() - started) / 1_000;
    const command = `tsx src/sim/skip-verification.ts ${process.argv.slice(2).join(' ')}`.trim();
    const json = skipReportJson(report);
    if (parsed.jsonPath) {
      mkdirSync(dirname(parsed.jsonPath), { recursive: true });
      writeFileSync(parsed.jsonPath, json);
    } else process.stdout.write(json);
    if (parsed.markdownPath) {
      mkdirSync(dirname(parsed.markdownPath), { recursive: true });
      writeFileSync(parsed.markdownPath, skipReportMarkdown(report, command, runtimeSeconds));
    }
    console.error(`skip verification ${report.config.profile}: ${runtimeSeconds.toFixed(1)}s`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
