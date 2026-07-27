import { useRef, type ComponentProps } from 'react';
import { usePointerTilt } from '../hooks';

type Props = ComponentProps<'div'> & {
  /** Adds the shared slow float/sway loop underneath pointer tilt. */
  idle?: boolean;
};

/** A <div> that tilts toward the cursor (Balatro UX, A6). Forwards every div prop, so
 *  it drops in where an inline card <div> was. Used for cards rendered in a .map (where
 *  a per-card hook can't be called directly). */
export function TiltCard({ children, className, idle = false, ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  usePointerTilt(ref);
  return (
    <div
      ref={ref}
      className={[className, idle && 'motion-card'].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
      <span className="tilt-sheen" aria-hidden />
    </div>
  );
}
