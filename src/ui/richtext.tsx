/**
 * Inline highlight markup for tooltip copy.
 *
 * Description strings in locales/*.json tag the parts that must stand out:
 *
 *   [m:…]  a Mult value       → number-only red; a leading ×factor gets a box
 *   [c:…]  a Chips value      → number-only blue; a leading ×factor gets a box
 *   [b:…]  the word "Blind"   → sky-blue text
 *   [n:…]  a count ("5")      → orange text   (pack copy: "up to 5 … choose 2")
 *   [k:…]  a card-kind noun   → red text      (pack copy: "Punctuation", "Charm")
 *   [C/U/R/L:…] an Emoji Tile rarity → matching rarity-badge colour
 *   [G/v/r/w:…] Gray/Violet/Rainbow/White edition → matching edition colour
 *
 * `$` marks money in gold, `p` marks passive/property copy in green, and `g`
 * marks the Gibberish term in red with an underline.
 * n/k recolour inline text rather than drawing a filled chip: a pack description is
 * prose about how many cards of what kind, not a Chips/Mult value readout.
 *
 * The tags live in the copy rather than being sniffed out of it with regexes,
 * because what counts as a Mult value is a fact about the sentence, not about
 * the characters: "Mult" and "배수" invert word order between our two locales,
 * and "×2 the sentence bonus" is a Mult while "2+ suits" is not. The translator
 * marks the span; this only renders it. `[e:...]` marks a defined game term in
 * yellow without changing the term's accessible plain-text form.
 */
import type { ReactNode } from 'react';

const TAG = /\[([mcbnkage$pCURLGvrw]):([^\]]*)\]/g;
const SCORE_VALUE = /^(\s*(?:×\s*)?(?:[+-]?\{[^}]+\}|[+-]?\d+(?:\.\d+)?))(.*)$/;

const CLASS: Record<string, string> = {
  m: 'hl-mult',
  c: 'hl-chips',
  b: 'hl-blind',
  n: 'hl-count',
  k: 'hl-kind',
  a: 'hl-axis',
  e: 'hl-term',
  g: 'hl-gibberish',
  $: 'hl-money',
  p: 'hl-property',
  C: 'hl-rarity-common',
  U: 'hl-rarity-uncommon',
  R: 'hl-rarity-rare',
  L: 'hl-rarity-legendary',
  P: 'hl-rarity-primordial',
  G: 'hl-edition-gray',
  v: 'hl-edition-violet',
  r: 'hl-edition-rainbow',
  w: 'hl-edition-white',
};

/** Plain equivalent for accessible labels that reuse marked-up display copy. */
export const stripRichText = (text: string): string => text.replace(TAG, '$2');

/**
 * Parse highlight markup into renderable nodes. Untagged text passes through
 * unchanged, so an un-marked-up string (or one in a locale that hasn't been
 * tagged yet) still renders as plain prose.
 */
export function richText(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  // `matchAll` over a /g regex — no lastIndex state to reset between calls.
  for (const m of text.matchAll(TAG)) {
    const at = m.index;
    if (at > last) out.push(text.slice(last, at));
    const value = m[2]!;
    const score = (m[1] === 'm' || m[1] === 'c') ? value.match(SCORE_VALUE) : null;
    const factor = score?.[1]?.trimStart().startsWith('×') ?? false;
    out.push(
      <span key={key++} className={CLASS[m[1]!]}>
        {score
          ? [
              <span key="value" className={factor ? 'hl-factor' : 'hl-value'}>{score[1]}</span>,
              score[2],
            ]
          : value}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
