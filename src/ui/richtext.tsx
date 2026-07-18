/**
 * Inline highlight markup for tooltip copy.
 *
 * Description strings in locales/*.json tag the parts that must stand out:
 *
 *   [m:…]  a Mult value      → red chip, white text
 *   [c:…]  a Chips value     → blue chip, white text
 *   [b:…]  the word "Blind"  → sky-blue text
 *
 * The tags live in the copy rather than being sniffed out of it with regexes,
 * because what counts as a Mult value is a fact about the sentence, not about
 * the characters: "Mult" and "배수" invert word order between our two locales,
 * and "×2 the sentence bonus" is a Mult while "2+ suits" is not. The translator
 * marks the span; this only renders it.
 */
import type { ReactNode } from 'react';

const TAG = /\[([mcb]):([^\]]*)\]/g;

const CLASS: Record<string, string> = {
  m: 'hl-mult',
  c: 'hl-chips',
  b: 'hl-blind',
};

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
    out.push(
      <span key={key++} className={CLASS[m[1]!]}>
        {m[2]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
