import type { PatternId } from '../../engine/types';
import { patternSymbol } from '../patternSymbols';
import { uiIcon, type UiIconId } from '../uiIcons';

export function UiIcon({
  name,
  className = '',
}: {
  name: UiIconId;
  className?: string;
}) {
  return <img className={['ui-icon', className].filter(Boolean).join(' ')} src={uiIcon(name)} alt="" aria-hidden />;
}

export function PatternIcon({
  pattern,
  className = '',
}: {
  pattern: PatternId;
  className?: string;
}) {
  return <span className={['pattern-symbol', className].filter(Boolean).join(' ')} aria-hidden>{patternSymbol(pattern)}</span>;
}
