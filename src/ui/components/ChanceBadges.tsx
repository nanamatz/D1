import type { ChanceResult } from '../../engine/types';
import { useI18n } from '../i18n';

export const chanceFraction = (chance: number): string => {
  for (let denominator = 2; denominator <= 100; denominator++) {
    const numerator = Math.round(chance * denominator);
    if (numerator > 0 && Math.abs(numerator / denominator - chance) < 1e-9) {
      return `${numerator}/${denominator}`;
    }
  }
  return `${Math.round(chance * 100)}%`;
};

export function ChanceBadges({ results }: { results: readonly ChanceResult[] }) {
  const { t } = useI18n();
  if (results.length === 0) return null;
  return (
    <span className="chance-results">
      {results.map((result, index) => (
        <span
          key={`${result.label ?? 'effect'}-${index}`}
          className={`chance-result chance-${result.outcome}`}
        >
          {result.label && <small>{t(`chance.label.${result.label}`)}</small>}
          <b>{chanceFraction(result.chance)}</b>
          {t(`chance.outcome.${result.outcome}`)}
        </span>
      ))}
    </span>
  );
}
