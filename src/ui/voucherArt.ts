import type { VoucherId } from '../engine/types';

import storyBook from '../../docs/Arts/Voucher/StoryBook.png';
import novel from '../../docs/Arts/Voucher/Novel.png';
import bible from '../../docs/Arts/Voucher/Bible.png';
import theLaw from '../../docs/Arts/Voucher/TheLaw.png';
import fashionBook from '../../docs/Arts/Voucher/FashionBook.png';
import fashionMagazine from '../../docs/Arts/Voucher/FashionMagazine.png';
import flyer from '../../docs/Arts/Voucher/Flyer.png';
import wantedPoster from '../../docs/Arts/Voucher/WantedPoster.png';
import newspaper from '../../docs/Arts/Voucher/NewsPaper.png';
import papyrus from '../../docs/Arts/Voucher/Papyrus.png';
import memo from '../../docs/Arts/Voucher/Memo.png';
import notebook from '../../docs/Arts/Voucher/Notebook.png';
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
import catalog from '../../docs/Arts/Voucher/Catalog.png';
import couponBook from '../../docs/Arts/Voucher/CouponBook.png';
import historyBook from '../../docs/Arts/Voucher/HistoryBook.png';
import oldBook from '../../docs/Arts/Voucher/OldBook.png';
import blankPaper from '../../docs/Arts/Voucher/BlankPaper.png';
import kungfuManual from '../../docs/Arts/Voucher/KungfuManual.png';
import bwPhoto from '../../docs/Arts/Voucher/BWPhoto.png';
import yearBook from '../../docs/Arts/Voucher/YearBook.png';
import zeroScore from '../../docs/Arts/Voucher/ZeroScore.png';
import comicBook from '../../docs/Arts/Voucher/ComicBook.png';

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
