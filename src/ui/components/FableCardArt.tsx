import { useId } from 'react';
import type { FableId } from '../../engine/fables';
import { fableArt } from '../fableArt';

interface Props {
  id: FableId;
  className?: string;
  title?: string;
}

/**
 * One normalized SVG surface for all supplied Fable illustrations.
 *
 * Each illustration is a path-only, pixel-art SVG normalized to a 5:7 canvas.
 * This outer surface owns the shared safe inset, rounded clipping, and frame.
 * The normalized assets already share the exact same visible image bounds.
 */
export function FableCardArt({ id, className, title }: Props) {
  const clipId = `fable-clip-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={['fable-svg-art', className].filter(Boolean).join(' ')}
      viewBox="0 0 500 700"
      preserveAspectRatio="xMidYMid meet"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="14" y="14" width="472" height="672" rx="24" />
        </clipPath>
      </defs>
      <rect x="4" y="4" width="492" height="692" rx="30" fill="#17130d" />
      <rect x="10" y="10" width="480" height="680" rx="26" fill="#f4e8ca" />
      <g clipPath={`url(#${clipId})`}>
        <rect x="14" y="14" width="472" height="672" fill="#efe0bd" />
        <image
          href={fableArt(id)}
          x="14"
          y="14"
          width="472"
          height="672"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>
      <rect
        x="10"
        y="10"
        width="480"
        height="680"
        rx="26"
        fill="none"
        stroke="#120f0a"
        strokeWidth="10"
      />
      <rect
        x="20"
        y="20"
        width="460"
        height="660"
        rx="18"
        fill="none"
        stroke="#d3ad65"
        strokeWidth="4"
      />
    </svg>
  );
}
