import type { PatternId, POS } from '../../engine/types';
import { useI18n } from '../i18n';

interface PatternExampleToken {
  word: string;
  pos?: POS;
}

interface PatternExample {
  tokens: readonly PatternExampleToken[];
}

export const PATTERN_EXAMPLES = {
  outcry: { tokens: [{ word: 'SHH', pos: 'interjection' }] },
  simple: { tokens: [
    { word: 'BIRDS', pos: 'noun' },
    { word: 'FLY', pos: 'verbIntransitive' },
  ] },
  imperative: { tokens: [
    { word: 'EAT', pos: 'verbTransitive' },
    { word: 'FISH', pos: 'noun' },
  ] },
  transitive: { tokens: [
    { word: 'CAT', pos: 'noun' },
    { word: 'EATS', pos: 'verbTransitive' },
    { word: 'FISH', pos: 'noun' },
  ] },
  negative: { tokens: [
    { word: 'SHE', pos: 'noun' },
    { word: 'ISNT' },
    { word: 'HERE', pos: 'adverb' },
  ] },
  interrogative: { tokens: [
    { word: 'ARE', pos: 'verbLinking' },
    { word: 'YOU', pos: 'noun' },
    { word: 'READY', pos: 'adjective' },
  ] },
  descriptive: { tokens: [
    { word: 'PIZZA', pos: 'noun' },
    { word: 'SEEMS', pos: 'verbLinking' },
    { word: 'TASTY', pos: 'adjective' },
  ] },
  chant: { tokens: [
    { word: 'EAT', pos: 'verbTransitive' },
    { word: 'EAT', pos: 'verbTransitive' },
  ] },
  objectComplement: { tokens: [
    { word: 'I', pos: 'noun' },
    { word: 'MADE', pos: 'verbTransitive' },
    { word: 'HIM', pos: 'noun' },
    { word: 'HAPPY', pos: 'adjective' },
  ] },
  ditransitive: { tokens: [
    { word: 'I', pos: 'noun' },
    { word: 'GIVE', pos: 'verbTransitive' },
    { word: 'HIM', pos: 'noun' },
    { word: 'FISH', pos: 'noun' },
  ] },
  compound: { tokens: [
    { word: 'CATS', pos: 'noun' },
    { word: 'RUN', pos: 'verbIntransitive' },
    { word: 'AND', pos: 'conjunction' },
    { word: 'DOGS', pos: 'noun' },
    { word: 'SLEEP', pos: 'verbIntransitive' },
  ] },
  complex: { tokens: [
    { word: 'BECAUSE', pos: 'conjunction' },
    { word: 'IT', pos: 'noun' },
    { word: 'RAINED', pos: 'verbIntransitive' },
    { word: 'I', pos: 'noun' },
    { word: 'STAYED', pos: 'verbIntransitive' },
    { word: 'HOME', pos: 'adverb' },
  ] },
} as const satisfies Record<PatternId, PatternExample>;

export function PatternExampleTray({ pattern }: { pattern: PatternId }) {
  const { t } = useI18n();
  const example: PatternExample = PATTERN_EXAMPLES[pattern];
  const words = example.tokens.map(({ word }) => word).join(' ');
  return (
    <span className="pattern-example">
      <span
        className="pattern-example-visual"
        role="group"
        aria-label={t('runinfo.patternExampleA11y', { words })}
        tabIndex={0}
      >
        {example.tokens.map((token, tokenIndex) => (
          <span
            className={[
              'pattern-example-token',
              token.pos ? `pos-${token.pos}` : 'grammar-marker',
            ].join(' ')}
            key={`${token.word}-${tokenIndex}`}
            aria-hidden
          >
            <b>{token.word}</b>
          </span>
        ))}
      </span>
    </span>
  );
}
