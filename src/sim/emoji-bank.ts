import { onBlindEnded, onTilesCreated } from '../engine/jokers';
import { startBlind } from '../engine/loop';
import { makeRng } from '../engine/rng';
import { newRun } from '../engine/run';

let run = newRun('emoji-bank-smoke');
run.jokers = [
  { defId: 'livingType', edition: 'base', state: {} },
  { defId: 'deadlineAuction', edition: 'base', state: {} },
];
run = onTilesCreated(run, 3);
run.gold = 12;
const blind = { ...startBlind(run, makeRng(run.seed)), kind: 'boss' as const };
run = onBlindEnded(run, blind, makeRng(`${run.seed}:end`));

console.log({
  livingTypeChips: run.jokers[0]?.state.chips,
  deadlineAuctionFactor: run.jokers[1]?.state.factor,
  goldAfterDeadline: run.gold,
});
