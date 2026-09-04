const SCORE_UNITS = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
] as const;

/** Compact, deterministic score and money text. */
export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value) || 0;
  const abs = Math.abs(rounded);
  if (abs >= 1e21) {
    const exponent = Math.floor(Math.log10(abs));
    const mantissa = Math.trunc((abs / Math.pow(10, exponent)) * 10) / 10;
    return `${rounded < 0 ? '-' : ''}${mantissa}e${exponent}`;
  }
  for (const [threshold, suffix] of SCORE_UNITS) {
    if (abs >= threshold) {
      const scaled = Math.trunc((abs / threshold) * 10) / 10;
      return `${rounded < 0 ? '-' : ''}${scaled}${suffix}`;
    }
  }
  return rounded.toLocaleString('en-US');
}
