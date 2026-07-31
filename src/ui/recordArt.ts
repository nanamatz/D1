import type { RecordId } from '../engine/types';
import whiteLp from './assets/records/white-lp.png';
import redLp from './assets/records/red-lp.png';
import greenLp from './assets/records/green-lp.png';
import blueLp from './assets/records/blue-lp.png';
import yellowLp from './assets/records/yellow-lp.png';
import clearLp from './assets/records/clear-lp.png';
import cd from './assets/records/cd.png';
import dvd from './assets/records/dvd.png';

/** UI-only difficulty art. Engine record definitions stay headless. */
export const RECORD_ART: Record<RecordId, string> = {
  whiteLp,
  redLp,
  greenLp,
  blueLp,
  yellowLp,
  clearLp,
  cd,
  dvd,
};

export function recordArt(id: RecordId): string {
  return RECORD_ART[id];
}
