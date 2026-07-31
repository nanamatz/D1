/// <reference types="node" />
/** Tiny headless smoke scenario for GDD §8.2–§8.4 Endless Mode. */
import { BALANCE } from '../engine/balance';
import { bossPoolForAnte } from '../engine/bosses';
import { blindTarget } from '../engine/economy';

console.log('Chapter\tDraft\tRevision\tDeadline\tBoss pool');
for (let ante = 8; ante <= 16; ante++) {
  console.log([
    ante,
    blindTarget(ante, 'small'),
    blindTarget(ante, 'big'),
    blindTarget(ante, 'boss'),
    bossPoolForAnte(ante),
  ].join('\t'));
}
console.log(`Finite endpoint: Chapter ${BALANCE.endless.maxAnte}`);
