import { useId } from 'react';

interface Props {
  src: string;
  className?: string;
  title?: string;
}

/**
 * Shared 500×700 (5:7) SVG surface for Fable, Constellation, and Gambler cards.
 *
 * Every source illustration is normalized to this same canvas before import, so
 * the shared frame can use one geometry everywhere the card appears.
 */
export function FamilyCardArt({ src, className, title }: Props) {
  const clipId = `family-card-clip-${useId().replace(/:/g, '')}`;
  return (
    <svg
      className={['family-card-svg-art', className].filter(Boolean).join(' ')}
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
          href={src}
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
