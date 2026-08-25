/// <reference types="node" />
/** Deterministic, measurement-only verification for the 150 public Emoji Tiles. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BALANCE } from '../engine/balance';
import { CHALLENGE_DEFS } from '../engine/challenges';
import { ALL_JOKERS, DEVELOPER_JOKERS } from '../engine/jokers';
import { POUCH_IDS } from '../engine/pouches';
import { RECORD_IDS } from '../engine/records';
import type { JokerRarity, PouchId, RecordId } from '../engine/types';
import {
  freshCohort,
  simulateRun,
  WordSolver,
  type Cohort,
  type JokerStats,
  type SimulationResult,
} from './full-run-balance';
import { loadStubLexicon } from './stub-lexicon';

export type VerificationProfile = 'smoke' | 'baseline' | 'full';
type PublicRarity = Exclude<JokerRarity, 'primordial'>;

export interface VerificationBudget {
  global: number;
  focal: number;
  focalChapters: number;
  endlessMarket: number;
  endlessFocal: number;
  pouchRecord: number;
}

export const PROFILE_BUDGETS: Readonly<Record<VerificationProfile, VerificationBudget>> = {
  smoke: { global: 1, focal: 1, focalChapters: 1, endlessMarket: 1, endlessFocal: 0, pouchRecord: 0 },
  baseline: { global: 32, focal: 2, focalChapters: 8, endlessMarket: 8, endlessFocal: 0, pouchRecord: 1 },
  full: { global: 2_000, focal: 128, focalChapters: 8, endlessMarket: 512, endlessFocal: 16, pouchRecord: 64 },
};

export interface VerificationConfig {
  profile: VerificationProfile;
  seedPrefix: string;
  seedStart: number;
  budget: VerificationBudget;
  focalIds?: readonly string[];
}

interface OutcomeAggregate {
  runs: number;
  chapter8Reached: number;
  chapter8Wins: number;
  winRate: number | null;
  meanScoreTarget: number | null;
  meanGold: number | null;
  blindFailures: number;
  blindFailureContexts: SimulationResult['blindFailureContexts'];
  endlessComplete: number;
  peakChapter: number;
}

export interface VerificationRow extends JokerStats {
  focalRuns: number;
  chapter8Reached: number;
  chapter8Wins: number;
  meanScoreTargetDelta: number | null;
  meanGoldDelta: number | null;
  endlessPeakChapter: number;
  endlessComplete: number;
  endlessCheckpoints: Record<string, { runs: number; meanScoreTarget: number | null }>;
  insufficient: boolean;
  unexercised: boolean;
  dead: boolean;
  outlier: boolean;
  outlierMetrics: string[];
}

interface MatrixRow {
  pouchId: PouchId;
  recordId: RecordId;
  challengeIds: string[];
  outcome: OutcomeAggregate;
}

export interface BoardVerificationReport {
  schema: 1;
  config: VerificationConfig;
  roster: {
    total: number;
    rarity: Record<PublicRarity, number>;
    layers: Record<'1' | '2' | '3', number>;
    developerExcluded: string[];
    fingerprint: string;
  };
  coverage: {
    schema: number;
    focal: number;
    naturallyOffered: number;
    naturallyAcquired: number;
    triggered: number;
    stateChanged: number;
  };
  cohorts: {
    controlNatural: OutcomeAggregate;
    marketNatural: OutcomeAggregate;
    marketForced: OutcomeAggregate;
    endlessMarket: OutcomeAggregate;
  };
  rows: VerificationRow[];
  pouchRecord: MatrixRow[];
  flags: {
    insufficient: string[];
    unexercised: string[];
    dead: string[];
    outlier: string[];
  };
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);
export const rate = (numerator: number, denominator: number): number | null => (
  denominator === 0 ? null : numerator / denominator
);
const mean = (values: readonly number[]): number | null => rate(sum(values), values.length);
const ratio = (result: SimulationResult): number | null => (
  result.chapter8Score === null || result.chapter8Target === null
    ? null
    : result.chapter8Score / result.chapter8Target
);

function aggregate(results: readonly SimulationResult[]): OutcomeAggregate {
  const ratios = results.map(ratio).filter((value): value is number => value !== null);
  const wins = results.filter((result) => result.won).length;
  const blindFailureContexts = results.flatMap((result) => result.blindFailureContexts);
  return {
    runs: results.length,
    chapter8Reached: ratios.length,
    chapter8Wins: wins,
    winRate: rate(wins, results.length),
    meanScoreTarget: mean(ratios),
    meanGold: mean(results.map((result) => result.finalGold)),
    blindFailures: blindFailureContexts.length,
    blindFailureContexts,
    endlessComplete: results.filter((result) => result.endlessComplete).length,
    peakChapter: Math.max(0, ...results.map((result) => result.reachedChapter)),
  };
}

export function assertFiniteTree(value: unknown, context = 'report'): void {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error(`${context}: non-finite number ${String(value)}`);
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteTree(entry, `${context}[${index}]`));
  } else if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) assertFiniteTree(entry, `${context}.${key}`);
  }
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

/** Robust z; when MAD is zero, stable extreme rank supplies the fallback signal. */
export function robustZ(values: readonly number[], value: number): number {
  if (values.length < 2) return 0;
  const center = median(values);
  const mad = median(values.map((candidate) => Math.abs(candidate - center)));
  if (mad > 0) return 0.6745 * (value - center) / mad;
  if (value === center) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = value < center ? sorted.indexOf(value) : sorted.lastIndexOf(value);
  return ((rank / (sorted.length - 1)) - 0.5) * 6.1;
}

export function applyFlags(rows: VerificationRow[]): void {
  const groups = new Map<string, VerificationRow[]>();
  for (const row of rows) {
    const key = `${row.rarity}:${row.layer}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  for (const row of rows) {
    const activation = row.triggers + row.stateChanges;
    const deltaAxes = [
      row.chipsDelta,
      row.multDelta,
      row.chipsFactor,
      row.multFactor,
      row.scoreDelta,
      row.goldDelta,
      row.growthDelta,
      row.meanScoreTargetDelta ?? 0,
      row.meanGoldDelta ?? 0,
    ];
    row.insufficient = row.ownedWords < 32;
    row.unexercised = activation === 0 && deltaAxes.every((value) => value === 0);
    // Targeted per-effect condition opportunities are not implemented in v1.
    // Owned-word exposure is insufficient evidence for a dead-effect claim.
    row.dead = false;
    const peers = groups.get(`${row.rarity}:${row.layer}`)!;
    const metrics: [string, (candidate: VerificationRow) => number][] = [
      ['triggerRate', (candidate) => rate(candidate.triggers, candidate.ownedWords) ?? 0],
      ['stateChangeRate', (candidate) => rate(candidate.stateChanges, candidate.ownedWords) ?? 0],
      ['chipsDeltaRate', (candidate) => rate(candidate.chipsDelta, candidate.ownedWords) ?? 0],
      ['multDeltaRate', (candidate) => rate(candidate.multDelta, candidate.ownedWords) ?? 0],
      ['chipsFactorRate', (candidate) => rate(candidate.chipsFactor, candidate.ownedWords) ?? 0],
      ['multFactorRate', (candidate) => rate(candidate.multFactor, candidate.ownedWords) ?? 0],
      ['scoreDeltaRate', (candidate) => rate(candidate.scoreDelta, candidate.ownedWords) ?? 0],
      ['goldDeltaRate', (candidate) => rate(candidate.goldDelta, candidate.ownedWords) ?? 0],
      ['growthDeltaRate', (candidate) => rate(candidate.growthDelta, candidate.ownedWords) ?? 0],
      ['scoreTargetDelta', (candidate) => candidate.meanScoreTargetDelta ?? 0],
      ['goldDelta', (candidate) => candidate.meanGoldDelta ?? 0],
    ];
    row.outlierMetrics = metrics
      .filter(([, select]) => Math.abs(robustZ(peers.map(select), select(row))) >= 3)
      .map(([name]) => name);
    const semanticAxes: Record<string, string> = {
      triggerRate: 'activation',
      stateChangeRate: 'state',
      chipsDeltaRate: 'chips',
      chipsFactorRate: 'chips',
      multDeltaRate: 'mult',
      multFactorRate: 'mult',
      scoreDeltaRate: 'score',
      scoreTargetDelta: 'score',
      goldDeltaRate: 'gold',
      goldDelta: 'gold',
      growthDeltaRate: 'growth',
    };
    row.outlier = new Set(row.outlierMetrics.map((metric) => semanticAxes[metric])).size >= 2;
  }
}

function combineStats(id: string, ...cohorts: readonly Cohort[]): JokerStats {
  const def = ALL_JOKERS.find((candidate) => candidate.id === id)!;
  const stats = cohorts.map((cohort) => cohort.jokers[id]!);
  return {
    id,
    rarity: def.rarity,
    layer: def.layer,
    offers: sum(stats.map((entry) => entry.offers)),
    acquisitions: sum(stats.map((entry) => entry.acquisitions)),
    ownedBlinds: sum(stats.map((entry) => entry.ownedBlinds)),
    ownedWords: sum(stats.map((entry) => entry.ownedWords)),
    triggers: sum(stats.map((entry) => entry.triggers)),
    chipsDelta: sum(stats.map((entry) => entry.chipsDelta)),
    multDelta: sum(stats.map((entry) => entry.multDelta)),
    chipsFactor: sum(stats.map((entry) => entry.chipsFactor)),
    multFactor: sum(stats.map((entry) => entry.multFactor)),
    scoreDelta: sum(stats.map((entry) => entry.scoreDelta)),
    goldDelta: sum(stats.map((entry) => entry.goldDelta)),
    growthDelta: sum(stats.map((entry) => entry.growthDelta)),
    stateChanges: sum(stats.map((entry) => entry.stateChanges)),
  };
}

function validateRoster(): void {
  const expected = { common: 34, uncommon: 57, rare: 54, legendary: 5 };
  for (const [key, count] of Object.entries(expected)) {
    if (ALL_JOKERS.filter((def) => def.rarity === key).length !== count) {
      throw new Error(`roster ${key} != ${count}`);
    }
  }
  if (ALL_JOKERS.length !== 150 || new Set(ALL_JOKERS.map((def) => def.id)).size !== 150) {
    throw new Error('public Emoji Tile roster must contain 150 unique ids');
  }
  const developer = new Set(DEVELOPER_JOKERS.map((def) => def.id));
  if (ALL_JOKERS.some((def) => developer.has(def.id))) throw new Error('developer Emoji Tile entered public roster');
}

const seedAt = (config: VerificationConfig, cohort: string, index: number): string => (
  `${config.seedPrefix}:${cohort}:${config.seedStart + index}`
);

export function runBoardVerification(config: VerificationConfig): BoardVerificationReport {
  validateRoster();
  const lexicon = loadStubLexicon();
  const solver = new WordSolver(lexicon);
  const ids = [...(config.focalIds ?? ALL_JOKERS.map((def) => def.id))].sort();
  for (const id of ids) if (!ALL_JOKERS.some((def) => def.id === id)) throw new Error(`unknown focal id: ${id}`);

  const controlNatural = freshCohort(config.budget.global, false, BALANCE.runAntes);
  const marketNatural = freshCohort(config.budget.global, false, BALANCE.runAntes);
  const marketForced = freshCohort(config.budget.global, true, BALANCE.runAntes);
  const controlResults: SimulationResult[] = [];
  const marketNaturalResults: SimulationResult[] = [];
  const marketForcedResults: SimulationResult[] = [];
  for (let index = 0; index < config.budget.global; index += 1) {
    const seed = seedAt(config, 'global', index);
    controlResults.push(simulateRun(seed, lexicon, solver, controlNatural, { disableJokerAcquisition: true }));
    marketNaturalResults.push(simulateRun(seed, lexicon, solver, marketNatural));
    marketForcedResults.push(simulateRun(seed, lexicon, solver, marketForced));
  }

  const focalCohort = freshCohort(ids.length * config.budget.focal, true, config.budget.focalChapters);
  const focalControl = freshCohort(config.budget.focal, true, config.budget.focalChapters);
  const focalControls: SimulationResult[] = [];
  for (let index = 0; index < config.budget.focal; index += 1) {
    focalControls.push(simulateRun(
      seedAt(config, 'focal', index),
      lexicon,
      solver,
      focalControl,
      { disableJokerAcquisition: true },
    ));
  }
  const focalResults = new Map<string, SimulationResult[]>();
  for (const id of ids) {
    const results: SimulationResult[] = [];
    for (let index = 0; index < config.budget.focal; index += 1) {
      results.push(simulateRun(seedAt(config, 'focal', index), lexicon, solver, focalCohort, {
        focalJokerId: id,
        disableJokerAcquisition: true,
      }));
    }
    focalResults.set(id, results);
  }

  const endlessMarket = freshCohort(config.budget.endlessMarket, true, BALANCE.endless.maxAnte);
  const endlessResults: SimulationResult[] = [];
  for (let index = 0; index < config.budget.endlessMarket; index += 1) {
    endlessResults.push(simulateRun(
      seedAt(config, 'endless-market', index),
      lexicon,
      solver,
      endlessMarket,
    ));
  }

  const endlessFocal = freshCohort(
    ids.length * config.budget.endlessFocal,
    true,
    BALANCE.endless.maxAnte,
  );
  const endlessById = new Map<string, SimulationResult[]>();
  for (const id of ids) {
    const results: SimulationResult[] = [];
    for (let index = 0; index < config.budget.endlessFocal; index += 1) {
      results.push(simulateRun(seedAt(config, 'endless-focal', index), lexicon, solver, endlessFocal, {
        focalJokerId: id,
        disableJokerAcquisition: true,
      }));
    }
    endlessById.set(id, results);
  }

  const matrix: MatrixRow[] = [];
  for (const pouchId of POUCH_IDS) {
    for (const recordId of RECORD_IDS) {
      const cohort = freshCohort(config.budget.pouchRecord, true, BALANCE.runAntes);
      const results: SimulationResult[] = [];
      for (let index = 0; index < config.budget.pouchRecord; index += 1) {
        results.push(simulateRun(
          seedAt(config, `matrix:${pouchId}:${recordId}`, index),
          lexicon,
          solver,
          cohort,
          { pouchId, recordId },
        ));
      }
      matrix.push({
        pouchId,
        recordId,
        challengeIds: CHALLENGE_DEFS
          .filter((challenge) => challenge.pouchId === pouchId && challenge.recordId === recordId)
          .map((challenge) => challenge.id),
        outcome: aggregate(results),
      });
    }
  }

  const rows = ALL_JOKERS
    .map((def): VerificationRow => {
      const focal = focalResults.get(def.id) ?? [];
      const endless = endlessById.get(def.id) ?? [];
      const scoreDeltas = focal.flatMap((result, index) => {
        const focalRatio = ratio(result);
        const controlRatio = ratio(focalControls[index]!);
        return focalRatio === null || controlRatio === null ? [] : [focalRatio - controlRatio];
      });
      const goldDeltas = focal.map((result, index) => result.finalGold - focalControls[index]!.finalGold);
      const stats = combineStats(def.id, marketNatural, marketForced, endlessMarket, focalCohort, endlessFocal);
      stats.offers = marketNatural.jokers[def.id]!.offers
        + marketForced.jokers[def.id]!.offers
        + endlessMarket.jokers[def.id]!.offers;
      stats.acquisitions = marketNatural.jokers[def.id]!.acquisitions
        + marketForced.jokers[def.id]!.acquisitions
        + endlessMarket.jokers[def.id]!.acquisitions;
      return {
        ...stats,
        focalRuns: focal.length,
        chapter8Reached: focal.filter((result) => result.chapter8Score !== null).length,
        chapter8Wins: focal.filter((result) => result.won).length,
        meanScoreTargetDelta: mean(scoreDeltas),
        meanGoldDelta: mean(goldDeltas),
        endlessPeakChapter: Math.max(0, ...endless.map((result) => result.reachedChapter)),
        endlessComplete: endless.filter((result) => result.endlessComplete).length,
        endlessCheckpoints: Object.fromEntries([9, 12, 16, 24, 32, 38].map((chapter) => {
          const ratios = endless.flatMap((result) => result.checkpoints
            .filter((checkpoint) => checkpoint.chapter === chapter)
            .map((checkpoint) => checkpoint.score / checkpoint.target));
          return [String(chapter), { runs: ratios.length, meanScoreTarget: mean(ratios) }];
        })),
        insufficient: false,
        unexercised: false,
        dead: false,
        outlier: false,
        outlierMetrics: [],
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
  applyFlags(rows);

  const rosterText = rows.map(({ id, rarity, layer }) => `${id}:${rarity}:${layer}`).join('\n');
  const report: BoardVerificationReport = {
    schema: 1,
    config: { ...config, focalIds: ids },
    roster: {
      total: ALL_JOKERS.length,
      rarity: {
        common: ALL_JOKERS.filter((def) => def.rarity === 'common').length,
        uncommon: ALL_JOKERS.filter((def) => def.rarity === 'uncommon').length,
        rare: ALL_JOKERS.filter((def) => def.rarity === 'rare').length,
        legendary: ALL_JOKERS.filter((def) => def.rarity === 'legendary').length,
      },
      layers: {
        1: ALL_JOKERS.filter((def) => def.layer === 1).length,
        2: ALL_JOKERS.filter((def) => def.layer === 2).length,
        3: ALL_JOKERS.filter((def) => def.layer === 3).length,
      },
      developerExcluded: DEVELOPER_JOKERS.map((def) => def.id).sort(),
      fingerprint: createHash('sha256').update(rosterText).digest('hex'),
    },
    coverage: {
      schema: rows.length,
      focal: rows.filter((row) => row.focalRuns > 0).length,
      naturallyOffered: rows.filter((row) => marketNatural.jokers[row.id]!.offers > 0).length,
      naturallyAcquired: rows.filter((row) => marketNatural.jokers[row.id]!.acquisitions > 0).length,
      triggered: rows.filter((row) => row.triggers > 0).length,
      stateChanged: rows.filter((row) => row.stateChanges > 0).length,
    },
    cohorts: {
      controlNatural: aggregate(controlResults),
      marketNatural: aggregate(marketNaturalResults),
      marketForced: aggregate(marketForcedResults),
      endlessMarket: aggregate(endlessResults),
    },
    rows,
    pouchRecord: matrix,
    flags: {
      insufficient: rows.filter((row) => row.insufficient).map((row) => row.id),
      unexercised: rows.filter((row) => row.unexercised).map((row) => row.id),
      dead: rows.filter((row) => row.dead).map((row) => row.id),
      outlier: rows.filter((row) => row.outlier).map((row) => row.id),
    },
  };
  assertFiniteTree(report, `profile=${config.profile}`);
  if (report.cohorts.endlessMarket.peakChapter > BALANCE.endless.maxAnte) {
    throw new Error(`constructed Chapter ${report.cohorts.endlessMarket.peakChapter}`);
  }
  return report;
}

export const reportJson = (report: BoardVerificationReport): string => `${JSON.stringify(report, null, 2)}\n`;

export function reportMarkdown(
  report: BoardVerificationReport,
  command: string,
  runtimeSeconds: number,
  source: { node: string; revision: string; worktree: string },
): string {
  const lines = [
    '# Emoji Tile board verification',
    '',
    `Profile: **${report.config.profile}**`,
    '',
    `Command: \`${command}\``,
    '',
    `Measured runtime: ${runtimeSeconds.toFixed(1)}s (runtime is intentionally excluded from JSON).`,
    '',
    `Source: Node ${source.node}; revision \`${source.revision}\`; ${source.worktree}.`,
    '',
    `Roster: ${report.roster.total} public Emoji Tiles; Common ${report.roster.rarity.common} / Uncommon ${report.roster.rarity.uncommon} / Rare ${report.roster.rarity.rare} / Legendary ${report.roster.rarity.legendary}. Developer ids excluded: ${report.roster.developerExcluded.join(', ')}.`,
    '',
    `Schema coverage: ${report.coverage.schema}/150; focal coverage: ${report.coverage.focal}/150; naturally offered/acquired: ${report.coverage.naturallyOffered}/${report.coverage.naturallyAcquired}; triggered/state-changed: ${report.coverage.triggered}/${report.coverage.stateChanged}.`,
    '',
    `Flags: insufficient ${report.flags.insufficient.length}, unexercised ${report.flags.unexercised.length}, dead ${report.flags.dead.length}, outlier ${report.flags.outlier.length}. Flags are review inputs and never auto-retune values.`,
    '',
    'Flag provenance: derived deterministically from the stored row metrics; reflagging changes no simulation values.',
    '',
    '## Cohort summary',
    '',
    '| cohort | runs | Ch8 reached | Ch8 natural wins | mean score/target | blind failures | Endless complete | peak Chapter |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...Object.entries(report.cohorts).map(([name, outcome]) => (
      `| ${name} | ${outcome.runs} | ${outcome.chapter8Reached} | ${outcome.chapter8Wins} | ${outcome.meanScoreTarget?.toFixed(4) ?? 'n/a'} | ${outcome.blindFailures} | ${outcome.endlessComplete} | ${outcome.peakChapter} |`
    )),
    '',
    '## Deterministic review flags',
    '',
    ...Object.entries(report.flags).flatMap(([name, ids]) => [
      `- **${name} (${ids.length}):** ${ids.length ? ids.join(', ') : 'none'}`,
      '',
    ]),
    '## Interpretation limits',
    '',
    '- Smoke proves deterministic schema, legal engine traversal, finite values, and one focal run per public id; it is not a tuning sample.',
    '- Baseline is a bounded directional screen; only the full profile uses the designer-recommended statistical budgets.',
    '- The bot chooses high base-score words, chases 3+ letters, buys Emoji Tiles and Charm/Tile Packs, and does not use Fables, rerolls, skips, or semantic condition planning.',
    '- Forced cohorts measure exposure and late scaling, never a natural win rate.',
    '- `unexercised` means no captured activation, state change, or per-axis delta; it does not mean weak.',
    '- `dead` is intentionally disabled in v1. A future full sweep must add targeted per-effect condition opportunities before making any dead-effect claim.',
    '',
    '## Profile budgets',
    '',
    '| profile | global | focal/id | focal Chapters | Endless market | Endless focal/id | Pouch×Record/cell |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...(['smoke', 'baseline', 'full'] as const).map((profile) => {
      const budget = PROFILE_BUDGETS[profile];
      return `| ${profile} | ${budget.global} | ${budget.focal} | ${budget.focalChapters} | ${budget.endlessMarket} | ${budget.endlessFocal} | ${budget.pouchRecord} |`;
    }),
    '',
    ...(report.config.profile === 'full'
      ? ['## Full-profile sweep', '', 'Completed with the full profile command shown above.', '']
      : [
          `## Full-profile command (not run by this ${report.config.profile})`,
          '',
          '`npm run sim:board-full`',
          '',
        ]),
  ];
  return `${lines.join('\n')}\n`;
}

const allowedArgs = new Set([
  'profile', 'seed-prefix', 'seed-start', 'global', 'focal', 'focal-chapters',
  'endless-market', 'endless-focal', 'pouch-record', 'json', 'markdown',
]);

export function parseVerificationArgs(argv: readonly string[]): {
  config: VerificationConfig;
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
  const base = PROFILE_BUDGETS[profile as VerificationProfile];
  const integer = (name: string, fallback: number, minimum = 0): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`invalid --${name}: ${raw}`);
    return parsed;
  };
  const seedPrefix = values.get('seed-prefix') ?? 'board-v1';
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(seedPrefix)) throw new Error(`invalid --seed-prefix: ${seedPrefix}`);
  const budget: VerificationBudget = {
    global: integer('global', base.global),
    focal: integer('focal', base.focal, 1),
    focalChapters: integer('focal-chapters', base.focalChapters, 1),
    endlessMarket: integer('endless-market', base.endlessMarket),
    endlessFocal: integer('endless-focal', base.endlessFocal),
    pouchRecord: integer('pouch-record', base.pouchRecord),
  };
  if (budget.focalChapters > BALANCE.endless.maxAnte) throw new Error('focal Chapters exceed Chapter 38');
  return {
    config: {
      profile: profile as VerificationProfile,
      seedPrefix,
      seedStart: integer('seed-start', 0),
      budget,
    },
    ...(values.has('json') ? { jsonPath: values.get('json')! } : {}),
    ...(values.has('markdown') ? { markdownPath: values.get('markdown')! } : {}),
  };
}

function write(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function sourceMetadata(): { node: string; revision: string; worktree: string } {
  try {
    const revision = execFileSync('git', [
      '-c',
      'safe.directory=C:/Users/owner/Documents/GitHub/D1',
      'rev-parse',
      '--short=12',
      'HEAD',
    ], { encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', [
      '-c',
      'safe.directory=C:/Users/owner/Documents/GitHub/D1',
      'status',
      '--porcelain',
    ], { encoding: 'utf8' }).trim().length > 0;
    return { node: process.version, revision, worktree: dirty ? 'uncommitted worktree' : 'clean worktree' };
  } catch {
    return { node: process.version, revision: 'unavailable', worktree: 'worktree status unavailable' };
  }
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isMain) {
  try {
    const parsed = parseVerificationArgs(process.argv.slice(2));
    const started = performance.now();
    const report = runBoardVerification(parsed.config);
    const runtimeSeconds = (performance.now() - started) / 1_000;
    const command = `tsx src/sim/board-verification.ts ${process.argv.slice(2).join(' ')}`.trim();
    const json = reportJson(report);
    if (parsed.jsonPath) write(parsed.jsonPath, json);
    else process.stdout.write(json);
    if (parsed.markdownPath) {
      write(parsed.markdownPath, reportMarkdown(report, command, runtimeSeconds, sourceMetadata()));
    }
    console.error(`board verification ${report.config.profile}: ${runtimeSeconds.toFixed(1)}s`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
