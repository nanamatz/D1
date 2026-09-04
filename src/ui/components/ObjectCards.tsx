import type { ComponentProps, ReactNode } from 'react';
import type { PouchId, RecordId } from '../../engine/types';
import { jokerArt } from '../jokerArt';
import { pouchArt } from '../pouchArt';
import { recordArt } from '../recordArt';
import { TiltCard } from './TiltCard';

type ObjectCardProps = ComponentProps<'div'> & {
  src: string | undefined;
  imageClassName?: string;
  motion?: boolean;
  children?: ReactNode;
};

function ObjectCard({
  src,
  imageClassName,
  motion = true,
  children,
  ...props
}: ObjectCardProps) {
  const content = (
    <>
      {src && <img className={imageClassName} src={src} alt="" />}
      {children}
    </>
  );
  return motion
    ? <TiltCard idle {...props}>{content}</TiltCard>
    : <div {...props}>{content}</div>;
}

export function EmojiTileCard({
  id,
  artSrc,
  ...props
}: Omit<ObjectCardProps, 'src'> & { id: string; artSrc?: string | null }) {
  return <ObjectCard src={artSrc === undefined ? jokerArt(id) : artSrc ?? undefined} {...props} />;
}

export function PouchCard({ id, ...props }: Omit<ObjectCardProps, 'src'> & { id: PouchId }) {
  return <ObjectCard src={pouchArt(id)} {...props} />;
}

export function RecordCard({ id, ...props }: Omit<ObjectCardProps, 'src'> & { id: RecordId }) {
  return <ObjectCard src={recordArt(id)} {...props} />;
}
