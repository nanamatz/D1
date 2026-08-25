/// <reference types="node" />

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BALANCE } from '../engine/balance';
import { ALL_JOKERS } from '../engine/jokers';
import { assertFiniteTree } from './board-verification';
import { freshCohort, simulateRun, WordSolver } from './full-run-balance';
import { loadStubLexicon } from './stub-lexicon';

const AXES = ['winDelta', 'scoreTargetDelta', 'goldDelta'] as const;
type Axis = (typeof AXES)[number];

export interface FlagRerunConfig {
  ids: string[];
  authoredGoldIds: string[];
  seeds: number;
  seedStart: number;
  seedPrefix: string;
  source: {
    path: string;
    sha256: string;
  };
}

export interface ArtifactProvenance {
  path: string;
  sha256: string;
}

interface Interval {
  mean: number;
  lower95: number;
  upper95: number;
}

interface BlockResult {
  block: 1 | 2 | 3 | 4;
  seeds: number;
  axes: Record<Axis, number>;
}

export interface FlagRerunRow {
  id: string;
  selectionReason: 'semantic-outlier' | 'direct-authored-gold-extreme';
  pairs: number;
  outcomes: Record<Axis, Interval>;
  blocks: BlockResult[];
  consistentAxes: Axis[];
  strongStableAxes: Axis[];
  activation: {
    triggers: number;
    ownedWordOpportunityProxy: number;
    triggerRatePerOwnedWord: number | null;
  };
}

export interface FlagRerunReport {
  schema: 1;
  config: FlagRerunConfig;
  opportunityNote: string;
  rows: FlagRerunRow[];
}

type TuningId = 'biochemistry' | 'wordHunter';

export interface TuningPostReport {
  schema: 1;
  kind: 'post-tune-paired';
  config: FlagRerunConfig;
  before: ArtifactProvenance;
  values: Record<TuningId, { old: number; current: number }>;
  rows: {
    id: TuningId;
    pairs: number;
    oldVsControl: Record<Axis, Interval>;
    newVsControl: Record<Axis, Interval>;
    newMinusOld: Record<Axis, Interval>;
    blocks: { block: 1 | 2 | 3 | 4; seeds: number; scoreTargetMean: number }[];
    scoreTargetEffectReduction: number | null;
    acceptance: {
      pairedMeanBelowZero: boolean;
      everyBlockBelowZero: boolean;
      pairedUpper95BelowZero: boolean;
      reductionAtMost15Percent: boolean;
      newVsControlWinLower95AboveZero: boolean;
      newVsControlScoreLower95AboveZero: boolean;
    };
  }[];
}

const PRE_TUNING_VALUES: Record<TuningId, number> = {
  biochemistry: 0.5,
  wordHunter: 0.1,
};

export const meanInterval = (values: readonly number[]): Interval => {
  if (values.length === 0) return { mean: 0, lower95: 0, upper95: 0 };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (values.length === 1) return { mean, lower95: mean, upper95: mean };
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    / (values.length - 1);
  const margin = 1.96 * Math.sqrt(variance / values.length);
  return { mean, lower95: mean - margin, upper95: mean + margin };
};

const ratio = (result: ReturnType<typeof simulateRun>): number => {
  if (result.chapter8Score === null || result.chapter8Target === null) {
    throw new Error(`${result.seed}: paired rerun did not reach Chapter 8`);
  }
  return result.chapter8Score / result.chapter8Target;
};

const axisValues = (
  focal: readonly ReturnType<typeof simulateRun>[],
  control: readonly ReturnType<typeof simulateRun>[],
): Record<Axis, number[]> => ({
  winDelta: focal.map((result, index) => Number(result.won) - Number(control[index]!.won)),
  scoreTargetDelta: focal.map((result, index) => ratio(result) - ratio(control[index]!)),
  goldDelta: focal.map((result, index) => result.finalGold - control[index]!.finalGold),
});

const sign = (value: number): number => value > 0 ? 1 : value < 0 ? -1 : 0;

export function runFlagRerun(config: FlagRerunConfig): FlagRerunReport {
  const lexicon = loadStubLexicon();
  const solver = new WordSolver(lexicon);
  const seeds = Array.from(
    { length: config.seeds },
    (_, index) => `${config.seedPrefix}:${config.seedStart + index}`,
  );
  const controls = seeds.map((seed) => simulateRun(
    seed,
    lexicon,
    solver,
    freshCohort(1, true, 8),
    { disableJokerAcquisition: true },
  ));
  const authoredGold = new Set(config.authoredGoldIds);
  const rows = config.ids.map((id): FlagRerunRow => {
    const cohort = freshCohort(config.seeds, true, 8);
    const focal = seeds.map((seed) => simulateRun(seed, lexicon, solver, cohort, {
      focalJokerId: id,
      disableJokerAcquisition: true,
    }));
    const values = axisValues(focal, controls);
    const outcomes = Object.fromEntries(
      AXES.map((axis) => [axis, meanInterval(values[axis])]),
    ) as Record<Axis, Interval>;
    const blocks = Array.from({ length: 4 }, (_, block): BlockResult => {
      const start = Math.floor(block * config.seeds / 4);
      const end = Math.floor((block + 1) * config.seeds / 4);
      return {
        block: (block + 1) as BlockResult['block'],
        seeds: end - start,
        axes: Object.fromEntries(AXES.map((axis) => [
          axis,
          meanInterval(values[axis].slice(start, end)).mean,
        ])) as Record<Axis, number>,
      };
    });
    const consistentAxes = AXES.filter((axis) => {
      const signs = blocks.map((block) => sign(block.axes[axis]));
      return signs.every((value) => value !== 0 && value === signs[0]);
    });
    const strongStableAxes = consistentAxes.filter((axis) => (
      outcomes[axis].lower95 > 0 || outcomes[axis].upper95 < 0
    ));
    const stats = cohort.jokers[id]!;
    return {
      id,
      selectionReason: authoredGold.has(id) ? 'direct-authored-gold-extreme' : 'semantic-outlier',
      pairs: config.seeds,
      outcomes,
      blocks,
      consistentAxes,
      strongStableAxes,
      activation: {
        triggers: stats.triggers,
        ownedWordOpportunityProxy: stats.ownedWords,
        triggerRatePerOwnedWord: stats.ownedWords > 0 ? stats.triggers / stats.ownedWords : null,
      },
    };
  });
  return {
    schema: 1,
    config: {
      ...config,
      ids: [...config.ids],
      authoredGoldIds: [...config.authoredGoldIds],
      source: { ...config.source },
    },
    opportunityNote: 'Owned words are an exposure proxy, not per-effect condition opportunities.',
    rows,
  };
}

const currentTuningValue = (id: TuningId): number => id === 'wordHunter'
  ? BALANCE.jokers.wordHunter.factorPerNewWord
  : BALANCE.jokers.biochemistry.factorPerChain;

const HISTORICAL_FLAG_ARTIFACTS = [
  'docs/balance/2026-08-22-emoji-flag-rerun.json',
  'docs/balance/2026-08-22-emoji-flag-rerun-1024.json',
] as const;

/** Fail before simulation when tuned values would overwrite a pre-tune artifact. */
export function assertFlagRerunOutputSafe(jsonPath?: string): void {
  if (!jsonPath) return;
  const historical = HISTORICAL_FLAG_ARTIFACTS.some((path) => resolve(path) === resolve(jsonPath));
  const tuned = (Object.keys(PRE_TUNING_VALUES) as TuningId[])
    .some((id) => currentTuningValue(id) !== PRE_TUNING_VALUES[id]);
  if (historical && tuned) {
    throw new Error(`refusing to overwrite pre-tune artifact: ${jsonPath}`);
  }
}

const withTuningValue = <T>(id: TuningId, value: number, run: () => T): T => {
  const tuning = BALANCE.jokers as unknown as {
    wordHunter: { factorPerNewWord: number };
    biochemistry: { factorPerChain: number };
  };
  const previous = currentTuningValue(id);
  if (id === 'wordHunter') tuning.wordHunter.factorPerNewWord = value;
  else tuning.biochemistry.factorPerChain = value;
  try {
    return run();
  } finally {
    if (id === 'wordHunter') tuning.wordHunter.factorPerNewWord = previous;
    else tuning.biochemistry.factorPerChain = previous;
  }
};

export function runTuningPost(
  config: FlagRerunConfig,
  before: ArtifactProvenance,
): TuningPostReport {
  const ids = [...config.ids].sort();
  if (ids.join(',') !== 'biochemistry,wordHunter') {
    throw new Error('post-tune comparison requires exactly biochemistry,wordHunter');
  }
  if (config.seeds % 4 !== 0) throw new Error('post-tune seeds must divide into four equal blocks');
  const lexicon = loadStubLexicon();
  const solver = new WordSolver(lexicon);
  const seeds = Array.from(
    { length: config.seeds },
    (_, index) => `${config.seedPrefix}:${config.seedStart + index}`,
  );
  const controls = seeds.map((seed) => simulateRun(
    seed,
    lexicon,
    solver,
    freshCohort(1, true, 8),
    { disableJokerAcquisition: true },
  ));
  const rows = ids.map((rawId) => {
    const id = rawId as TuningId;
    const simulateFocal = () => {
      const cohort = freshCohort(config.seeds, true, 8);
      return seeds.map((seed) => simulateRun(seed, lexicon, solver, cohort, {
        focalJokerId: id,
        disableJokerAcquisition: true,
      }));
    };
    const oldFocal = withTuningValue(id, PRE_TUNING_VALUES[id], simulateFocal);
    const newFocal = simulateFocal();
    const oldValues = axisValues(oldFocal, controls);
    const newValues = axisValues(newFocal, controls);
    const pairedValues = axisValues(newFocal, oldFocal);
    const oldVsControl = Object.fromEntries(
      AXES.map((axis) => [axis, meanInterval(oldValues[axis])]),
    ) as Record<Axis, Interval>;
    const newVsControl = Object.fromEntries(
      AXES.map((axis) => [axis, meanInterval(newValues[axis])]),
    ) as Record<Axis, Interval>;
    const newMinusOld = Object.fromEntries(
      AXES.map((axis) => [axis, meanInterval(pairedValues[axis])]),
    ) as Record<Axis, Interval>;
    const blocks = Array.from({ length: 4 }, (_, block) => {
      const start = block * config.seeds / 4;
      const end = (block + 1) * config.seeds / 4;
      return {
        block: (block + 1) as 1 | 2 | 3 | 4,
        seeds: end - start,
        scoreTargetMean: meanInterval(pairedValues.scoreTargetDelta.slice(start, end)).mean,
      };
    });
    const oldEffect = oldVsControl.scoreTargetDelta.mean;
    const reduction = oldEffect === 0
      ? null
      : (oldEffect - newVsControl.scoreTargetDelta.mean) / oldEffect;
    return {
      id,
      pairs: config.seeds,
      oldVsControl,
      newVsControl,
      newMinusOld,
      blocks,
      scoreTargetEffectReduction: reduction,
      acceptance: {
        pairedMeanBelowZero: newMinusOld.scoreTargetDelta.mean < 0,
        everyBlockBelowZero: blocks.every(({ scoreTargetMean }) => scoreTargetMean < 0),
        pairedUpper95BelowZero: newMinusOld.scoreTargetDelta.upper95 < 0,
        reductionAtMost15Percent: reduction !== null && reduction >= 0 && reduction <= 0.15,
        newVsControlWinLower95AboveZero: newVsControl.winDelta.lower95 > 0,
        newVsControlScoreLower95AboveZero: newVsControl.scoreTargetDelta.lower95 > 0,
      },
    };
  });
  const report: TuningPostReport = {
    schema: 1,
    kind: 'post-tune-paired',
    config: {
      ...config,
      ids,
      authoredGoldIds: [],
      source: { ...config.source },
    },
    before: { ...before },
    values: {
      biochemistry: {
        old: PRE_TUNING_VALUES.biochemistry,
        current: currentTuningValue('biochemistry'),
      },
      wordHunter: {
        old: PRE_TUNING_VALUES.wordHunter,
        current: currentTuningValue('wordHunter'),
      },
    },
    rows,
  };
  assertFiniteTree(report);
  return report;
}

const allowedArgs = new Set([
  'ids', 'authored-gold', 'seeds', 'seed-start', 'seed-prefix', 'source', 'before', 'json',
]);

export function parseFlagRerunArgs(argv: readonly string[]): {
  config: FlagRerunConfig;
  before?: ArtifactProvenance;
  jsonPath?: string;
} {
  const values = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (!match || !allowedArgs.has(match[1]!)) throw new Error(`invalid argument: ${arg}`);
    if (values.has(match[1]!)) throw new Error(`duplicate argument: --${match[1]}`);
    values.set(match[1]!, match[2]!);
  }
  const ids = (values.get('ids') ?? '').split(',').filter(Boolean).sort();
  if (ids.length === 0) throw new Error('--ids requires at least one public Emoji Tile id');
  if (new Set(ids).size !== ids.length) throw new Error('duplicate --ids entry');
  const publicIds = new Set(ALL_JOKERS.map((def) => def.id));
  for (const id of ids) if (!publicIds.has(id)) throw new Error(`unknown Emoji Tile id: ${id}`);
  const authoredGoldIds = (values.get('authored-gold') ?? '').split(',').filter(Boolean).sort();
  if (new Set(authoredGoldIds).size !== authoredGoldIds.length) {
    throw new Error('duplicate --authored-gold entry');
  }
  for (const id of authoredGoldIds) {
    if (!ids.includes(id)) throw new Error(`--authored-gold id is not selected: ${id}`);
  }
  const integer = (name: string, fallback: number, minimum: number): number => {
    const raw = values.get(name);
    if (raw === undefined) return fallback;
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`invalid --${name}: ${raw}`);
    return parsed;
  };
  const seedPrefix = values.get('seed-prefix') ?? 'emoji-flag-v1';
  if (!/^[a-z0-9][a-z0-9._-]*$/i.test(seedPrefix)) throw new Error(`invalid --seed-prefix: ${seedPrefix}`);
  const sourcePath = values.get('source');
  if (!sourcePath) throw new Error('--source requires a full board-verification JSON path');
  let sourceBytes: Buffer;
  try {
    sourceBytes = readFileSync(sourcePath);
  } catch {
    throw new Error(`cannot read --source: ${sourcePath}`);
  }
  let sourceProfile: unknown;
  try {
    sourceProfile = (JSON.parse(sourceBytes.toString('utf8')) as { config?: { profile?: unknown } })
      .config?.profile;
  } catch {
    throw new Error(`invalid --source JSON: ${sourcePath}`);
  }
  if (sourceProfile !== 'full') throw new Error(`--source is not a full board report: ${sourcePath}`);
  const config: FlagRerunConfig = {
    ids,
    authoredGoldIds,
    seeds: integer('seeds', 128, 4),
    seedStart: integer('seed-start', 0, 0),
    seedPrefix,
    source: {
      path: sourcePath,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    },
  };
  let before: ArtifactProvenance | undefined;
  const beforePath = values.get('before');
  if (beforePath) {
    let bytes: Buffer;
    let prior: FlagRerunReport;
    try {
      bytes = readFileSync(beforePath);
      prior = JSON.parse(bytes.toString('utf8')) as FlagRerunReport;
    } catch {
      throw new Error(`cannot read --before artifact: ${beforePath}`);
    }
    if (
      prior.config.seeds !== config.seeds
      || prior.config.seedStart !== config.seedStart
      || prior.config.seedPrefix !== config.seedPrefix
      || config.ids.some((id) => !prior.config.ids.includes(id))
    ) {
      throw new Error('--before seed budget or selected ids do not match this run');
    }
    if (prior.config.source?.sha256 !== config.source.sha256) {
      throw new Error('--before board source does not match --source');
    }
    before = {
      path: beforePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  return {
    config,
    ...(before ? { before } : {}),
    ...(values.has('json') ? { jsonPath: values.get('json')! } : {}),
  };
}

export const flagRerunJson = (report: FlagRerunReport): string => `${JSON.stringify(report, null, 2)}\n`;
export const tuningPostJson = (report: TuningPostReport): string => `${JSON.stringify(report, null, 2)}\n`;

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;
if (isMain) {
  try {
    const parsed = parseFlagRerunArgs(process.argv.slice(2));
    assertFlagRerunOutputSafe(parsed.jsonPath);
    const json = parsed.before
      ? tuningPostJson(runTuningPost(parsed.config, parsed.before))
      : flagRerunJson(runFlagRerun(parsed.config));
    if (parsed.jsonPath) {
      mkdirSync(dirname(parsed.jsonPath), { recursive: true });
      writeFileSync(parsed.jsonPath, json);
    } else {
      process.stdout.write(json);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
