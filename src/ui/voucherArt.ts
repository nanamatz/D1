import type { VoucherId } from '../engine/types';

import storyBook from '../../docs/Arts/Voucher/StoryBook.png';
import novel from './assets/vouchers/Novel.png';
import bible from '../../docs/Arts/Voucher/Bible.png';
import theLaw from '../../docs/Arts/Voucher/TheLaw.png';
import fashionBook from './assets/vouchers/FashionBook.png';
import fashionMagazine from './assets/vouchers/FashionMagazine.png';
import flyer from './assets/vouchers/Flyer.png';
import wantedPoster from './assets/vouchers/WantedPoster.png';
import newspaper from './assets/vouchers/NewsPaper.png';
import papyrus from '../../docs/Arts/Voucher/Papyrus.png';
import memo from './assets/vouchers/Memo.png';
import notebook from './assets/vouchers/Notebook.png';
import poetryBook from '../../docs/Arts/Voucher/PoetryBook.png';
import sheetMusic from '../../docs/Arts/Voucher/SheetMusic.png';
import fourCutPhoto from '../../docs/Arts/Voucher/fourcutphoto.png';
import pictureDiary from '../../docs/Arts/Voucher/PictureDiary.png';
import enKoDictionary from '../../docs/Arts/Voucher/EnKoDictionary.png';
import encyclopedia from '../../docs/Arts/Voucher/Encyclopedia.png';
import receipt from '../../docs/Arts/Voucher/Recipt.png';
import householdLedger from '../../docs/Arts/Voucher/HouseHoldLedger.png';
import sketchBook from '../../docs/Arts/Voucher/SketchBook.png';
import portrait from '../../docs/Arts/Voucher/portrait.png';
import catalog from './assets/vouchers/Catalog.png';
import couponBook from '../../docs/Arts/Voucher/CouponBook.png';
import historyBook from './assets/vouchers/HistoryBook.png';
import oldBook from './assets/vouchers/OldBook.png';
import blankPaper from './assets/vouchers/BlankPaper.png';
import kungfuManual from './assets/vouchers/KungfuManual.png';
import bwPhoto from './assets/vouchers/BWPhoto.png';
import yearBook from './assets/vouchers/YearBook.png';
import zeroScore from './assets/vouchers/ZeroScore.png';
import comicBook from './assets/vouchers/ComicBook.png';

export const VOUCHER_ART: Readonly<Record<VoucherId, string>> = {
  storyBook,
  novel,
  bible,
  theLaw,
  fashionBook,
  fashionMagazine,
  flyer,
  wantedPoster,
  newspaper,
  papyrus,
  memo,
  notebook,
  poetryBook,
  sheetMusic,
  fourCutPhoto,
  pictureDiary,
  enKoDictionary,
  encyclopedia,
  receipt,
  householdLedger,
  sketchBook,
  portrait,
  catalog,
  couponBook,
  historyBook,
  oldBook,
  blankPaper,
  kungfuManual,
  bwPhoto,
  yearBook,
  zeroScore,
  comicBook,
};

export const voucherArt = (id: VoucherId): string => VOUCHER_ART[id];
