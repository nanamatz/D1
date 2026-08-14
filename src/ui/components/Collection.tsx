import { useEffect, useMemo, useRef, useState } from 'react';
import { ALL_JOKERS } from '../../engine/jokers';
import { VOUCHER_REGISTRY, ALL_VOUCHER_IDS, BASE_VOUCHER_IDS } from '../../engine/vouchers';
import { ALL_BOSS_IDS, BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART, BLIND_ART } from '../bossArt';
import { blindTarget } from '../../engine/economy';
import { BALANCE } from '../../engine/balance';
import { formatScore } from '../formatScore';
import { POUCH_IDS, isPouchUnlocked } from '../../engine/pouches';
import type { Lexicon } from '../../engine/lexicon';
import type {
  JokerEdition,
  Suit,
  TileFont,
  TileMaterial,
  Tile,
  VoucherId,
} from '../../engine/types';
import {
  collectionHighlights,
  loadCollection,
  markCollectionSeen,
  unseenCount,
} from '../collection';
import { UNLOCKS, loadPlayed, playedCount, activeUnlocks } from '../unlocks';
import type { UnlockDef, UnlockEffect } from '../unlocks';
import { mascotCollectionRows } from '../mascots';
import {
  bossDescKey,
  consumableAxisTip,
  consumableDescKey,
  consumableTooltipBody,
  fontDescKey,
  grownValue,
  jokerDescKey,
} from '../descriptions';
import { useI18n } from '../i18n';
import { packGalleryPages } from '../packArt';
import { packTooltip } from '../packTooltip';
import { pouchArt } from '../pouchArt';
import { loadLifetime } from '../lifetime';
import { recordArt } from '../recordArt';
import {
  isWordCollectionComplete,
  pouchUnlockWordCount,
  profileCollectionSize,
} from '../profile';
import { Tooltip } from './Tooltip';
import { TileView } from './Tile';
import { VoucherCard } from './VoucherCard';
import { voucherArt } from '../voucherArt';
import { loadVoucherProgress } from '../voucherProgress';
import { FABLE_DEFS } from '../../engine/fables';
import { CONSTELLATION_DEFS } from '../../engine/constellations';
import { voucherCollectionCopy } from '../voucherCollection';
import { GAMBLER_CARDS } from '../gamblerArt';
import { CardArt, type CardFamily } from './CardArt';
import { TiltCard } from './TiltCard';
import { useSettings } from '../settings';
import { UiIcon } from './UiIcon';
import { jokerArt } from '../jokerArt';
import { audio } from '../audio';
import { richText } from '../richtext';
import { SKIP_REWARD_IDS } from '../../engine/skipRewards';
import { SKIP_REWARD_ART } from '../skipRewardArt';
import { skipRewardCollectionDescKey, skipRewardParams } from '../skipRewardTooltip';
import {
  isEmojiUnlocked,
  loadEmojiUnlockProgress,
  unlockedEmojiSet,
} from '../emojiUnlocks';

type Category =
  | 'words'
  | 'jokers'
  | 'enhancedTiles'
  | 'editions'
  | 'vouchers'
  | 'tags'
  | 'fableCards'
  | 'constellationCards'
  | 'inkCards'
  | 'bosses'
  | 'packs'
  | 'palette'
  | 'mascots'
  | 'pouches';

type CategoryMenuBlock = {
  items: Category[];
  family?: 'cards';
};

export const CATEGORY_COLUMNS: CategoryMenuBlock[][] = [
  [
    { items: ['jokers'] },
    { items: ['pouches'] },
    { items: ['vouchers', 'tags'] },
    {
      family: 'cards',
      items: ['fableCards', 'constellationCards', 'inkCards'],
    },
  ],
  [
    { items: ['enhancedTiles'] },
    { items: ['editions'] },
    { items: ['packs'] },
    { items: ['palette'] },
    { items: ['mascots'] },
    { items: ['words'] },
    { items: ['bosses'] },
  ],
];

export const MATERIALS: TileMaterial[] = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass', 'wood',
];
const FONTS: TileFont[] = ['medium', 'lightItalic', 'bold', 'inline', 'black'];
export const EDITIONS: JokerEdition[] = ['base', 'gray', 'white', 'rainbow', 'violet'];
// The five pack families the Collection shows (feedback): the three consumable packs
// Fable / Ink / Constellation, plus Charm and Tile. `ink` is presentation-only until
// its Gambler registry lands, but it still counts as a family in the gallery.
const PACK_TYPES = ['pattern', 'joker', 'consumable', 'tile', 'ink'] as const;
const PAGE = 60;
const JOKERS_PER_PAGE = 15;
const CARDS_PER_PAGE = 10;
const VOUCHER_PAIRS_PER_PAGE = 4;
const TAGS_PER_PAGE = 15;

function runUnlockProgress() {
  const lifetime = loadLifetime();
  return {
    discoveredWords: pouchUnlockWordCount(),
    pouchWins: new Set(lifetime.pouchWins),
    recordWins: new Set(lifetime.recordWins),
  };
}

const sampleTile = (over: Partial<Tile>): Tile => {
  const material = over.material ?? 'ceramic';
  // material === 'stone' ⟺ letter === null (packs.ts:55) — a lettered Stone
  // sample tile would violate that invariant even though it's display-only here.
  return {
    id: `s-${material}-${over.font ?? 'medium'}`,
    letter: material === 'stone' ? null : 'A',
    material,
    font: 'medium',
    ...over,
  };
};

interface Props {
  lexicon: Lexicon;
  onBack: () => void;
}

/**
 * Collection / 도감 (spec §2.9): category menu → shared grid detail views.
 *
 * Every tooltip in here opens `down`: the screen is top-aligned, so its grids sit
 * within ~100px of the viewport top and an upward card loses its title off-screen.
 */
export function Collection({ lexicon, onBack }: Props) {
  const { t } = useI18n();
  const [cat, setCat] = useState<Category | null>(null);
  const previousCategory = useRef<Category | null>(cat);

  useEffect(() => {
    if (previousCategory.current !== cat) audio.play('transitionWhoosh');
    previousCategory.current = cat;
  }, [cat]);

  // Viewing the collection clears the "new discoveries" badge (spec §0).
  useEffect(() => {
    markCollectionSeen();
  }, []);

  const wordCollectionComplete = useMemo(() => isWordCollectionComplete(lexicon), [lexicon]);
  const counts = useMemo(
    () => {
      const progress = runUnlockProgress();
      return {
      words: { have: Math.min(profileCollectionSize(lexicon.size), lexicon.size), total: lexicon.size },
      jokers: { have: unlockedEmojiSet().size, total: ALL_JOKERS.length },
      enhancedTiles: {
        have: MATERIALS.length + FONTS.length,
        total: MATERIALS.length + FONTS.length,
      },
      editions: { have: EDITIONS.length, total: EDITIONS.length },
      vouchers: {
        have: BASE_VOUCHER_IDS.length + loadVoucherProgress().unlocked.length,
        total: ALL_VOUCHER_IDS.length,
      },
      tags: { have: SKIP_REWARD_IDS.length, total: SKIP_REWARD_IDS.length },
      fableCards: { have: FABLE_DEFS.length, total: FABLE_DEFS.length },
      constellationCards: {
        have: CONSTELLATION_DEFS.length,
        total: CONSTELLATION_DEFS.length,
      },
      inkCards: { have: GAMBLER_CARDS.length, total: GAMBLER_CARDS.length },
      bosses: { have: ALL_BOSS_IDS.length, total: ALL_BOSS_IDS.length },
      packs: { have: PACK_TYPES.length, total: PACK_TYPES.length },
      palette: { have: playedCount(), total: UNLOCKS.length },
      mascots: {
        have: mascotCollectionRows(activeUnlocks()).filter((r) => r.unlocked && r.art).length,
        total: mascotCollectionRows(activeUnlocks()).length,
      },
      pouches: {
        have: POUCH_IDS.filter((id) => isPouchUnlocked(id, progress)).length,
        total: POUCH_IDS.length,
      },
    };
    },
    [lexicon],
  );

  if (cat === null) {
    return (
      <div className="screen collection">
        <section className="collection-modal collection-menu-modal">
          <h2 className="scr-title">{t('collection.title')}</h2>
          <div className="cat-menu">
            {CATEGORY_COLUMNS.map((column, columnIndex) => (
              <div className="cat-column" key={columnIndex}>
                {column.map((block) => (
                  <div
                    key={block.items.join('-')}
                    className={`cat-block${block.family ? ` cat-family-block ${block.family}` : ''}`}
                  >
                    {block.items.map((id) => {
                      const n = counts[id];
                      return (
                        <button
                          key={id}
                          className={`cat-btn cat-${id}`}
                          onClick={() => setCat(id)}
                        >
                          <span className="cat-name">{t(`collection.cat.${id}`)}</span>
                          <span className="cat-count">
                            {n.have}/{id === 'words' && !wordCollectionComplete ? '???' : n.total}
                          </span>
                          {id === 'words' && unseenCount() > 0 && <span className="badge">!</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button className="btn back-bar" onClick={onBack}>
            {t('common.back')}
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="screen collection">
      <section className={`collection-modal collection-detail-modal detail-${cat}`}>
        <div className="coll-head">
          <h2 className="scr-title">{t(`collection.cat.${cat}`)}</h2>
        </div>

        <div className="coll-detail">
          {cat === 'words' && <WordsView lexicon={lexicon} />}
          {cat === 'jokers' && <JokersView />}
          {cat === 'enhancedTiles' && <EnhancedTilesView />}
          {cat === 'editions' && <EditionsView />}
          {cat === 'vouchers' && <VouchersView />}
          {cat === 'tags' && <TagsView />}
          {cat === 'fableCards' && <FablesView />}
          {cat === 'constellationCards' && <ConstellationsView />}
          {cat === 'inkCards' && <GamblerCardsView />}
          {cat === 'bosses' && <BossesView />}
          {cat === 'packs' && <PacksView />}
          {cat === 'palette' && <PaletteView />}
          {cat === 'mascots' && <MascotsView />}
          {cat === 'pouches' && <PouchesView />}
        </div>

        {/* 뒤로 = the previous screen: from a detail view that's the category
            list; the category list's own 뒤로 exits the collection (back-stack). */}
        <button className="btn back-bar" onClick={() => setCat(null)}>
          {t('common.back')}
        </button>
      </section>
    </div>
  );
}

// ---------- Tags ----------
function TagsView() {
  const { t } = useI18n();
  const { page, pages, visible, setPage } = usePaged(SKIP_REWARD_IDS, TAGS_PER_PAGE);

  return (
    <>
      <div className="tag-collection-grid">
        {visible.map((id) => {
          const name = t(`skipReward.${id}.name`);
          return (
            <div key={id} className="tag-collection-entry">
              <Tooltip
                title={name}
                body={t(skipRewardCollectionDescKey(id), skipRewardParams({ id }))}
                down
              >
                <TiltCard
                  idle
                  className="tag-collection-icon"
                  tabIndex={0}
                  role="img"
                  aria-label={name}
                >
                  <img src={SKIP_REWARD_ART[id]} alt="" />
                </TiltCard>
              </Tooltip>
              <span className="tag-collection-name">{name}</span>
            </div>
          );
        })}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

/**
 * Paging state for a Collection grid. Owns the clamp so a filter that shrinks
 * the list can never leave the view on a page that no longer exists.
 */
function usePaged<T>(items: readonly T[], perPage: number) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  const clamped = Math.min(page, pages - 1);
  return {
    page: clamped,
    pages,
    visible: items.slice(clamped * perPage, (clamped + 1) * perPage),
    setPage,
  };
}

// ---------- Words ----------
function WordsView({ lexicon }: { lexicon: Lexicon }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<'words' | 'registers'>('words');
  const [suit, setSuit] = useState<Suit | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const collected = useMemo(() => loadCollection(), []);
  const allWordsUnlocked = loadLifetime().unlockAllApplied;
  const allWordsComplete = isWordCollectionComplete(lexicon);
  const records = useMemo(() => collectionHighlights(collected), [collected]);

  // Item 1: list the WHOLE dictionary, not just what's been played — words never
  // played render `locked` (dimmed) so the collection reads as something to fill in.
  // Built once per lexicon (~173k entries): plain `<` beats localeCompare at this
  // size, and the collection is read once rather than per word.
  const all = useMemo(() => {
    return [...lexicon.words()]
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map((w) => ({
        w,
        suit: lexicon.lookup(w)?.suit ?? 'standard',
        found: allWordsUnlocked || collected[w] !== undefined,
      }));
  }, [lexicon, collected, allWordsUnlocked]);

  // Search + suit filter. With the whole dictionary listed, search is the only
  // practical way to reach a specific word (800+ pages otherwise).
  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && suit === 'all') return all;
    return all.filter((e) => (suit === 'all' || e.suit === suit) && (!q || e.w.includes(q)));
  }, [all, suit, query]);

  const pages = Math.max(1, Math.ceil(words.length / PAGE));
  const clamped = Math.min(page, pages - 1);
  const slice = words.slice(clamped * PAGE, clamped * PAGE + PAGE);
  const suits: (Suit | 'all')[] = ['all', 'standard', 'formal', 'slang', 'vulgar'];
  const registerSuits: Suit[] = ['standard', 'formal', 'slang', 'vulgar'];
  const foundBySuit = useMemo(() => Object.fromEntries(
    registerSuits.map((id) => [id, all.filter((word) => word.found && word.suit === id).length]),
  ) as Record<Suit, number>, [all]);
  const recordName = (record: { word: string } | null) =>
    record ? record.word.toUpperCase() : t('collection.record.none');

  return (
    <>
      <div className="word-records" aria-label={t('collection.records.title')}>
        <div className="word-record">
          <span>{t('collection.record.highestScore')}</span>
          <strong>{recordName(records.highestScore)}</strong>
          <small>
            {records.highestScore
              ? t('collection.record.score', { n: records.highestScore.value })
              : t('collection.record.start')}
          </small>
        </div>
        <div className="word-record">
          <span>{t('collection.record.longest')}</span>
          <strong>{recordName(records.longest)}</strong>
          <small>
            {records.longest
              ? t('collection.record.letters', { n: records.longest.value })
              : t('collection.record.start')}
          </small>
        </div>
        <div className="word-record">
          <span>{t('collection.record.mostPlayed')}</span>
          <strong>{recordName(records.mostPlayed)}</strong>
          <small>
            {records.mostPlayed
              ? t('collection.record.plays', { n: records.mostPlayed.value })
              : t('collection.record.start')}
          </small>
        </div>
        <div className="word-record">
          <span>{t('collection.record.discovered')}</span>
          <strong>{profileCollectionSize(lexicon.size)}</strong>
          <small>{t('collection.record.keepGoing')}</small>
        </div>
      </div>
      <div className="word-tabs" role="tablist">
        {(['words', 'registers'] as const).map((id) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={['word-tab', tab === id ? 'on' : ''].filter(Boolean).join(' ')}
            onClick={() => setTab(id)}
          >
            {t(`collection.words.tab.${id}`)}
          </button>
        ))}
      </div>
      <div className="word-tab-panel">
      {tab === 'registers' ? (
        <div className="register-score-view">
          <p>{t('collection.register.intro')}</p>
          <div className="register-score-grid">
            {registerSuits.map((id) => (
              <div key={id} className={['register-score-card', id].join(' ')}>
                <span className="register-name">{t(`suit.${id}`)}</span>
                <strong>×{BALANCE.suitMult[id]}</strong>
                <span>{t(`collection.register.body.${id}`)}</span>
                <small>{t('collection.register.found', { n: foundBySuit[id] })}</small>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="coll-search">
            <input
              type="search"
              className="coll-search-input"
              placeholder={t('collection.search')}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
            <span className="coll-search-count">
              {t('collection.found', {
                n: allWordsComplete || query.trim() || suit !== 'all' ? words.length : '???',
              })}
            </span>
          </div>
          <div className="coll-filters">
            {suits.map((s) => (
              <button
                key={s}
                className={['filter-pill', s !== 'all' ? s : '', s === suit ? 'on' : ''].filter(Boolean).join(' ')}
                onClick={() => {
                  setSuit(s);
                  setPage(0);
                }}
              >
                {s === 'all' ? t('collection.all') : t(`suit.${s}`)}
              </button>
            ))}
          </div>
          {words.length === 0 ? (
            <p className="coll-empty">
              {query.trim() ? t('collection.noMatch', { q: query.trim() }) : t('collection.noWords')}
            </p>
          ) : (
            <div className="word-grid">
              {slice.map((e) => (
                <span
                  key={e.w}
                  className={['word-chip', e.suit, !e.found && 'locked'].filter(Boolean).join(' ')}
                >
                  {e.w}
                </span>
              ))}
            </div>
          )}
          <Pager
            page={clamped}
            pages={pages}
            onPage={setPage}
            hideTotal={!allWordsComplete && !query.trim() && suit === 'all'}
          />
        </>
      )}
      </div>
    </>
  );
}

// ---------- Jokers ----------
function JokersView() {
  const { t, lang } = useI18n();
  const { page, pages, visible, setPage } = usePaged(ALL_JOKERS, JOKERS_PER_PAGE);
  const progress = loadEmojiUnlockProgress();
  const stickers = loadLifetime().jokerRecordStickers;

  return (
    <>
      <div className="card-grid joker-collection-grid">
        {visible.map((def) => {
          const art = jokerArt(def.id);
          const unlocked = isEmojiUnlocked(def.id, progress);
          const sticker = stickers[def.id];
          return (
            <Tooltip
              key={def.id}
              title={unlocked
                ? (lang === 'ko' ? def.nameKo : def.nameEn)
                : t('collection.joker.undiscovered')}
              body={unlocked
                ? t(jokerDescKey(def.id))
                : t('collection.joker.undiscoveredHint')}
              extra={unlocked ? grownValue(def, undefined, t) : null}
              sub={unlocked && sticker ? {
                title: t('collection.joker.recordSticker'),
                body: t('collection.joker.recordStickerDesc', {
                  record: t(`record.${sticker}.name`),
                }),
                kind: 'other',
              } : undefined}
              {...(unlocked ? { rarity: def.rarity } : {})}
              down
            >
              <TiltCard
                idle
                className={`emoji-tile-collection${unlocked ? '' : ' locked'}`}
                tabIndex={0}
              >
                {art && <img className="cc-joker-art" src={art} alt="" />}
                {unlocked && sticker && (
                  <img
                    className="joker-record-sticker"
                    src={recordArt(sticker)}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                {!unlocked && <span className="emoji-tile-lock" aria-hidden="true" />}
              </TiltCard>
            </Tooltip>
          );
        })}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

// ---------- Enhanced tiles (Materials / Fonts) ----------
function EnhancedTilesView() {
  const [page, setPage] = useState(0);
  return (
    <>
      {page === 0 ? <MaterialsView /> : <FontsView />}
      <Pager page={page} pages={2} onPage={setPage} />
    </>
  );
}

function MaterialsView() {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      {MATERIALS.map((m) => (
        <Tooltip key={m} title={t(`material.${m}`)} body={t(`materialdesc.${m}`)} down>
          <div className="swatch">
            <TileView tile={sampleTile({ material: m })} />
            <span className="sw-name">{t(`material.${m}`)}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
function FontsView() {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      {FONTS.map((f) => (
        <Tooltip key={f} title={t(`font.${f}`)} body={t(fontDescKey(f))} down>
          <div className="swatch">
            <TileView tile={sampleTile({ font: f })} />
            <span className="sw-name">{t(`font.${f}`)}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}

function EditionsView() {
  const { t } = useI18n();
  const art = jokerArt('bookworm');
  return (
    <div className="edition-collection-scroll">
      <div className="edition-collection-grid">
        {EDITIONS.map((edition) => (
          <Tooltip
            key={edition}
            title={t(`edition.${edition}`)}
            body={t(`editiondesc.${edition}`)}
            down
          >
            <div className="swatch">
              <TiltCard
                idle
                className={`emoji-tile-collection emoji-tile-image-only edition-${edition}`}
                tabIndex={0}
                aria-label={t(`edition.${edition}`)}
              >
                {art && <img className="cc-joker-art" src={art} alt="" />}
              </TiltCard>
              <span className="sw-name">{t(`edition.${edition}`)}</span>
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}

// ---------- Vouchers ----------
function VouchersView() {
  const { t, lang } = useI18n();
  const progress = loadVoucherProgress();
  const unlocked = new Set(progress.unlocked);
  const pairs = BASE_VOUCHER_IDS.map((baseId) => {
    const upgrade = ALL_VOUCHER_IDS
      .map((id) => VOUCHER_REGISTRY.get(id)!)
      .find((v) => v.baseId === baseId);
    return { baseId, upgradeId: upgrade?.id ?? null };
  });
  const { page: clamped, pages, visible, setPage } = usePaged(pairs, VOUCHER_PAIRS_PER_PAGE);

  const ticket = (id: VoucherId, locked: boolean, down: boolean) => {
    const v = VOUCHER_REGISTRY.get(id)!;
    const { name, body } = voucherCollectionCopy(id, locked, lang, t);
    return (
      <Tooltip
        key={id}
        title={name}
        body={body}
        classification={locked ? undefined : 'voucher'}
        down={down}
      >
        <VoucherCard
          name={name}
          muted={locked}
          {...(!locked ? { artSrc: voucherArt(v.id) } : {})}
        />
      </Tooltip>
    );
  };

  return (
    <div className="voucher-collection">
      <div className="voucher-reference-grid">
        {visible.map(({ baseId, upgradeId }, index) => (
          <div className="voucher-pair" key={baseId}>
            {ticket(baseId, false, index < 2)}
            {upgradeId && ticket(upgradeId, !unlocked.has(upgradeId), index < 2)}
          </div>
        ))}
      </div>
      <Pager page={clamped} pages={pages} onPage={setPage} />
    </div>
  );
}

// ---------- Blinds ----------
function BossesView() {
  const { t, lang } = useI18n();
  const antes = Array.from({ length: 16 }, (_, index) => index + 1);
  return (
    <div className="bosses-split">
      <div className="panel target-table">
        <div className="label">{t('collection.targetCurve')}</div>
        {/* Non-boss blind emblems: Draft (small) / Revision (big). Deadlines are
            the 18 bosses shown to the right. */}
        <div className="blind-emblems">
          {(['small', 'big'] as const).map(
            (k) =>
              BLIND_ART[k] && (
                <div key={k} className="blind-emblem">
                  <img className="blind-emblem-art" src={BLIND_ART[k]} alt="" />
                  <span className="cc-name">{t(`blind.${k}`)}</span>
                </div>
              ),
          )}
        </div>
        <table>
          <thead>
            <tr>
              <th>{t('collection.ante')}</th>
              <th>{t('blind.small')}</th>
              <th>{t('blind.big')}</th>
              <th>{t('blind.boss')}</th>
            </tr>
          </thead>
          <tbody>
            {antes.map((a) => (
              <tr key={a} className={a > BALANCE.anteBaseTargets.length ? 'endless' : ''}>
                <td>{a}</td>
                <td>{formatScore(blindTarget(a, 'small'))}</td>
                <td>{formatScore(blindTarget(a, 'big'))}</td>
                <td>{formatScore(blindTarget(a, 'boss'))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="boss-chips">
        <div className="label">{t('collection.bosses')}</div>
        <div className="card-grid">
          {ALL_BOSS_IDS.map((id) => {
            const b = BOSS_REGISTRY.get(id)!;
            return (
              <Tooltip key={id} title={lang === 'ko' ? b.nameKo : b.nameEn} body={t(bossDescKey(id))} down>
                <TiltCard idle className="coll-card boss-card">
                  <img className="boss-card-art" src={BOSS_ART[id]} alt="" />
                  <span className="cc-name">{lang === 'ko' ? b.nameKo : b.nameEn}</span>
                </TiltCard>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Packs / Pouches ----------
/** Image-only paged gallery for all supplied Tile, Charm, Constellation, and Ink art. */
function PacksView() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const pages = packGalleryPages();
  const clamped = Math.min(page, pages.length - 1);
  const entries = pages[clamped]!;

  return (
    <>
      <div className="pack-gallery">
        {entries.map((e, i) => {
          const tip = packTooltip(e.family, e.size, t);
          return (
            <Tooltip
              key={`${e.family}-${e.size}-${i}`}
              title={tip.title}
              body={tip.body}
              grade={tip.grade}
              down
            >
              <TiltCard
                idle
                className="pack-gallery-card"
                role="img"
                aria-label={`${tip.title} · ${t(`pack.size.${e.size}`)}`}
              >
                <img className="pack-gallery-art" src={e.src} alt="" />
              </TiltCard>
            </Tooltip>
          );
        })}
      </div>
      <Pager page={clamped} pages={pages.length} onPage={setPage} />
    </>
  );
}

// ---------- Palette (chromatic unlocks, feature-02 C-5) ----------
// Split by effect kind into three sections — 색상 / 음향 / 캐릭터. The
// section is derived from `effect.kind`; adding a future unlock kind = adding a
// row here, never a hard-coded word check (CLAUDE.md palette guardrail).
const PALETTE_SECTIONS: { key: string; kind: UnlockEffect['kind'] }[] = [
  { key: 'color', kind: 'color' },
  { key: 'audio', kind: 'audio' },
  { key: 'mascot', kind: 'mascot' },
];

function PaletteView() {
  const { t } = useI18n();
  const played = loadPlayed();
  const paletteCard = (u: UnlockDef) => {
    const found = played.has(u.id);
    // Locked = silhouette with a letter-count hint ("R _ _"); unlocked = the word.
    const hint = u.word[0] + ' _'.repeat(u.word.length - 1);
    const group = u.effect.kind === 'color' ? u.effect.group : null;
    const descKey =
      u.effect.kind === 'color' ? `unlock.body.${u.effect.group}`
      : u.effect.kind === 'audio' ? (u.effect.bus === 'music' ? 'unlock.body.music' : 'unlock.body.sound')
      : 'unlock.body.mascot';
    return (
      <Tooltip
        key={u.id}
        title={found ? u.word : t('collection.palette.locked')}
        body={found ? t(descKey) : t('collection.palette.hint')}
        down
      >
        <div className={['coll-card', 'palette-card', found ? `chroma-${group ?? 'audio'}` : 'locked'].join(' ')}>
          <UiIcon name="palette" className="cc-icon" />
          <span className="cc-name">{found ? u.word : hint}</span>
        </div>
      </Tooltip>
    );
  };
  return (
    <div className="palette-sections">
      {PALETTE_SECTIONS.map((sec) => {
        const items = UNLOCKS.filter((u) => u.effect.kind === sec.kind);
        if (items.length === 0) return null;
        return (
          <div className="palette-section" key={sec.key}>
            <div className="palette-section-title">{t(`collection.palette.section.${sec.key}`)}</div>
            <div className="card-grid">{items.map(paletteCard)}</div>
          </div>
        );
      })}
    </div>
  );
}
// ---------- Mascots (item 5.1) ----------
function MascotsView() {
  const { t } = useI18n();
  const { settings, set } = useSettings();
  const rows = mascotCollectionRows(activeUnlocks());
  const selectedMascot = settings.mascot ?? 'woodak';
  return (
    <div className="mascot-collection">
      <p className="mascot-collection-help">{t('collection.mascot.choose')}</p>
      <div className="card-grid mascot-card-row">
      {rows.map((r) => {
        const reveal = r.unlocked && !!r.art; // full portrait + name
        const silhouette = !r.unlocked && !!r.art; // teased shape, hidden name
        const selected = reveal && r.id === selectedMascot;
        const choose = () => {
          if (!reveal) return;
          set('mascot', r.id);
        };
        const card = (
          <TiltCard
            key={r.id}
            idle
            className={[
              'coll-card',
              'mascot-card',
              r.unlocked ? '' : 'locked',
              selected ? 'selected' : '',
            ].filter(Boolean).join(' ')}
            role={reveal ? 'button' : undefined}
            tabIndex={reveal ? 0 : undefined}
            aria-pressed={reveal ? selected : undefined}
            onClick={reveal ? choose : undefined}
            onKeyDown={reveal ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                choose();
              }
            } : undefined}
          >
            {r.art ? (
              <img
                className={['mascot-card-art', silhouette ? 'silhouette' : ''].filter(Boolean).join(' ')}
                src={r.art}
                alt=""
              />
            ) : (
              <UiIcon name="unknown" className="cc-icon" />
            )}
            <span className="cc-name">{reveal ? t(r.nameKey) : '???'}</span>
            {reveal && (
              <span className={['mascot-equip', selected ? 'on' : ''].filter(Boolean).join(' ')}>
                {t(selected ? 'collection.mascot.selected' : 'collection.mascot.select')}
              </span>
            )}
          </TiltCard>
        );
        return reveal ? (
          <Tooltip
            key={r.id}
            title={t(r.nameKey)}
            body={t('collection.mascot.tooltip')}
            down
          >
            {card}
          </Tooltip>
        ) : card;
      })}
      </div>
    </div>
  );
}
function PouchesView() {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const progress = runUnlockProgress();
  const id = POUCH_IDS[index]!;
  const unlocked = isPouchUnlocked(id, progress);
  const name = t(`pouch.${id}.name`);
  const body = t(`pouch.${id}.desc`);
  const unlock = !unlocked
    ? t('newrun.unlock', { requirement: t(`pouch.${id}.unlock`) })
    : '';
  const move = (delta: number) =>
    setIndex((current) => (current + delta + POUCH_IDS.length) % POUCH_IDS.length);

  return (
    <section
      className="collection-pouch-carousel"
      aria-label={`${t('collection.cat.pouches')}: ${name}, ${index + 1}/${POUCH_IDS.length}`}
    >
      <button
        type="button"
        className="car-arrow"
        onClick={() => move(-1)}
        aria-label={t('collection.pouchPrevious')}
      >
        ‹
      </button>
      <div className="collection-pouch-stage">
        <div
          key={id}
          className={['select-preview', 'collection-pouch-preview', !unlocked && 'locked'].filter(Boolean).join(' ')}
        >
          <Tooltip
            title={name}
            body={[body, unlock].filter(Boolean).join('\n')}
            down
          >
            <div
              className="run-choice-art collection-pouch-art"
              role="img"
              tabIndex={0}
              aria-label={unlocked ? name : t('newrun.locked')}
            >
              <img src={pouchArt(id)} alt="" />
              {!unlocked && <span className="run-choice-lock" aria-hidden />}
            </div>
          </Tooltip>
          <div className="run-choice-copy">
            <h3 className="run-choice-title" aria-live="polite">
              {unlocked ? name : t('newrun.locked')}
            </h3>
            <div className="run-choice-effect">
              <p className="select-desc">{richText(unlocked ? body : unlock)}</p>
            </div>
          </div>
        </div>
        <div className="carousel-dots" aria-hidden="true">
          {POUCH_IDS.map((pouchId, dot) => (
            <span
              key={pouchId}
              className={[
                'carousel-dot',
                dot === index && 'current',
                dot < index && 'past',
              ].filter(Boolean).join(' ')}
            />
          ))}
        </div>
      </div>
      <button
        type="button"
        className="car-arrow"
        onClick={() => move(1)}
        aria-label={t('collection.pouchNext')}
      >
        ›
      </button>
    </section>
  );
}

// ---------- Card families ----------
/**
 * The three consumable-card pages are one grid. A family only supplies its rows
 * and its tooltip copy; paging, the card frame, and the art surface live here.
 */
function CardFamilyView<T extends { id: string }>({
  family,
  items,
  name,
  body,
  sub,
}: {
  family: CardFamily;
  items: readonly T[];
  name: (item: T) => string;
  body: (item: T) => string;
  sub?: (item: T) => { title: string; body: string } | undefined;
}) {
  const { page, pages, visible, setPage } = usePaged(items, CARDS_PER_PAGE);
  return (
    <div className={`${family}-collection`}>
      <div className={`${family}-card-grid`}>
        {visible.map((item) => (
          <Tooltip
            key={item.id}
            title={name(item)}
            body={body(item)}
            classification={family}
            sub={sub?.(item)}
            down
          >
            <TiltCard idle className={`${family}-card`}>
              <CardArt family={family} id={item.id} title={name(item)} />
            </TiltCard>
          </Tooltip>
        ))}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}

function FablesView() {
  const { t } = useI18n();
  return (
    <CardFamilyView
      family="fable"
      items={FABLE_DEFS}
      name={(def) => t(`consumable.${def.id}`)}
      body={(def) => consumableTooltipBody(def.id, t)}
      sub={(def) => consumableAxisTip(def.id, t) ?? undefined}
    />
  );
}

function ConstellationsView() {
  const { t } = useI18n();
  return (
    <CardFamilyView
      family="constellation"
      items={CONSTELLATION_DEFS}
      name={(def) => t(`consumable.${def.id}`)}
      body={(def) => consumableTooltipBody(def.id, t)}
    />
  );
}

function GamblerCardsView() {
  const { t, lang } = useI18n();
  return (
    <CardFamilyView
      family="gambler"
      items={GAMBLER_CARDS}
      name={(card) => (lang === 'ko' ? card.nameKo : card.nameEn)}
      body={(card) => t(consumableDescKey(card.id))}
    />
  );
}

// ---------- shared pager ----------
function Pager({
  page,
  pages,
  onPage,
  hideTotal = false,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
  hideTotal?: boolean;
}) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  const move = (delta: number) => onPage((page + delta + pages) % pages);
  return (
    <div className="pager">
      <button className="car-arrow" onClick={() => move(-1)}>
        ‹
      </button>
      <span className="pager-label">
        {hideTotal
          ? t('collection.pageUnknown', { n: page + 1 })
          : t('collection.page', { n: page + 1, m: pages })}
      </span>
      <button className="car-arrow" onClick={() => move(1)}>
        ›
      </button>
    </div>
  );
}
