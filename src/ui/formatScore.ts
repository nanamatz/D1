/** Compact, deterministic score text once Endless values stop fitting the UI. */
export function formatScore(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  if (abs < 1_000_000_000) return rounded.toLocaleString('en-US');
  const exponent = Math.floor(Math.log10(abs));
  const mantissa = Math.floor((abs / Math.pow(10, exponent)) * 10) / 10;
  return `${rounded < 0 ? '-' : ''}${mantissa}e${exponent}`;
}
