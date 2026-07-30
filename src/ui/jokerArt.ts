import alphabeticalOrder from './assets/jokers/alphabetical-order.png';
import anonymous from './assets/jokers/anonymous.png';
import bookOfMargins from './assets/jokers/book-of-margins.png';
import carteBlanche from './assets/jokers/carte-blanche.png';
import censorsBane from './assets/jokers/censors-bane.png';
import ceramicArtisan from './assets/jokers/ceramic-artisan.png';
import classicist from './assets/jokers/classicist.png';
import comboArtist from './assets/jokers/combo-artist.png';
import dadaist from './assets/jokers/dadaist.png';
import equilibrist from './assets/jokers/equilibrist.png';
import fableHoard from './assets/jokers/fable-hoard.png';
import glasswork from './assets/jokers/glasswork.png';
import hypocrite from './assets/jokers/hypocrite.png';
import interestGlutton from './assets/jokers/interest-glutton.png';
import literaryJudge from './assets/jokers/literary-judge.png';
import longWordFan from './assets/jokers/long-word-fan.png';
import misbound from './assets/jokers/misbound.png';
import miser from './assets/jokers/miser.png';
import outOfPrint from './assets/jokers/out-of-print.png';
import rareEarth from './assets/jokers/rare-earth.png';
import rhymeChain from './assets/jokers/rhyme-chain.png';
import rotaryPress from './assets/jokers/rotary-press.png';
import shortAndSharp from './assets/jokers/short-and-sharp.png';
import stargazer from './assets/jokers/stargazer.png';
import streetCred from './assets/jokers/street-cred.png';
import towerOfBabel from './assets/jokers/tower-of-babel.png';
import typeFoundry from './assets/jokers/type-foundry.png';
import tyrant from './assets/jokers/tyrant.png';
import voraciousReader from './assets/jokers/voracious-reader.png';
import vowelMagnet from './assets/jokers/vowel-magnet.png';

const ART: Readonly<Record<string, string>> = {
  alphabeticalOrder,
  anonymous,
  bookOfMargins,
  carteBlanche,
  censorsBane,
  ceramicArtisan,
  classicist,
  comboArtist,
  dadaist,
  equilibrist,
  fableHoard,
  glasswork,
  hypocrite,
  interestGlutton,
  literaryJudge,
  longWordFan,
  misbound,
  miser,
  outOfPrint,
  rareEarth,
  rhymeChain,
  rotaryPress,
  shortAndSharp,
  stargazer,
  streetCred,
  towerOfBabel,
  typeFoundry,
  tyrant,
  voraciousReader,
  vowelMagnet,
};

/** One 84×112 pixel master scaled into the shared 124×165 runtime frame. */
export const jokerArt = (id: string): string | undefined => ART[id];
