import speechBurst from './assets/icons/ui/speech-burst.png';
import letterHand from './assets/icons/ui/letter-hand.png';
import manuscript from './assets/icons/ui/manuscript.png';
import musicNote from './assets/icons/ui/music-note.png';
import brick from './assets/icons/ui/brick.png';
import letterA from './assets/icons/ui/letter-a.png';
import jester from './assets/icons/ui/jester.png';
import pencil from './assets/icons/ui/pencil.png';
import ticket from './assets/icons/ui/ticket.png';
import storefront from './assets/icons/ui/storefront.png';
import pouch from './assets/icons/ui/pouch.png';
import crown from './assets/icons/ui/crown.png';
import coin from './assets/icons/ui/coin.png';
import magnifier from './assets/icons/ui/magnifier.png';
import document from './assets/icons/ui/document.png';
import packageIcon from './assets/icons/ui/package.png';
import mutedSpeaker from './assets/icons/ui/muted-speaker.png';
import speaker from './assets/icons/ui/speaker.png';
import music from './assets/icons/ui/music.png';
import palette from './assets/icons/ui/palette.png';
import unknown from './assets/icons/ui/unknown.png';
import star from './assets/icons/ui/star.png';
import close from './assets/icons/ui/close.png';

export const UI_ICONS = {
  speechBurst,
  letterHand,
  manuscript,
  musicNote,
  brick,
  letterA,
  jester,
  pencil,
  ticket,
  storefront,
  pouch,
  crown,
  coin,
  magnifier,
  document,
  package: packageIcon,
  mutedSpeaker,
  speaker,
  music,
  palette,
  unknown,
  star,
  close,
} as const;

export type UiIconId = keyof typeof UI_ICONS;

export function uiIcon(name: UiIconId): string {
  return UI_ICONS[name];
}
