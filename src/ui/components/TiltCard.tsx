import { useRef, type ComponentProps } from 'react';
import { usePointerTilt } from '../hooks';

/** A <div> that tilts toward the cursor (Balatro UX, A6). Forwards every div prop, so
 *  it drops in where an inline card <div> was. Used for cards rendered in a .map (where
 *  a per-card hook can't be called directly). */
export function TiltCard({ children, ...rest }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  usePointerTilt(ref);
  return (
    <div ref={ref} {...rest}>
      {children}
    </div>
  );
}
