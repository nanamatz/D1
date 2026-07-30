import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { ALL_JOKERS } from '../../engine/jokers';
import { VOUCHER_REGISTRY, ALL_VOUCHER_IDS, BASE_VOUCHER_IDS } from '../../engine/vouchers';
import { BOSS_REGISTRY, CORE_BOSS_IDS } from '../../engine/bosses';
import { BOSS_ART, BLIND_ART } from '../bossArt';
import { blindTarget } from '../../engine/economy';
import { BALANCE } from '../../engine/balance';
import type { Lexicon } from '../../engine/lexicon';
import type { Suit, TileFont, TileMaterial, Tile, VoucherId } from '../../engine/types';
import { loadCollection, collectionSize, markCollectionSeen, unseenCount } from '../collection';
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
import pouchUrl from '../assets/pouch.png';
import { Tooltip } from './Tooltip';
import { TileView } from './Tile';
import { VoucherCard } from './VoucherCard';
import { voucherArt } from '../voucherArt';
import { loadVoucherProgress } from '../voucherProgress';
import { FABLE_DEFS } from '../../engine/fables';
import { CONSTELLATION_DEFS } from '../../engine/constellations';
import { voucherCollectionCopy } from '../voucherCollection';
import { GAMBLER_CARDS } from '../gamblerArt';
import { GAMBLER_IDS } from '../../engine/gamblers';
import { CardArt, type CardFamily } from './CardArt';
import { TiltCard } from './TiltCard';
import { useSettings } from '../settings';
import { audio } from '../audio';
import { jokerArt } from '../jokerArt';

type Category =
  | 'words'
  | 'jokers'
  | 'materials'
  | 'fonts'
  | 'vouchers'
  | 'fableCards'
  | 'constellationCards'
  | 'inkCards'
  | 'bosses'
  | 'packs'
  | 'palette'
  | 'mascots'
  | 'bags';

type CategoryMenuItem = {
  id: Category;
  scale: number;
};

type CategoryMenuBlock = {
  /** Relative detail-row footprint. Both columns intentionally total 8.6. */
  scale: number;
  items: CategoryMenuItem[];
  family?: 'cards';
};

const CATEGORY_COLUMNS: CategoryMenuBlock[][] = [
  [
    { scale: 2.2, items: [{ id: 'words', scale: 1 }] },
    { scale: 1.8, items: [{ id: 'jokers', scale: 1 }] },
    { scale: 1.6, items: [{ id: 'vouchers', scale: 1 }] },
    {
      scale: 3,
      family: 'cards',
      items: [
        { id: 'fableCards', scale: 1 },
        { id: 'constellationCards', scale: 1 },
        { id: 'inkCards', scale: 1 },
      ],
    },
  ],
  [
    { scale: 1.9, items: [{ id: 'bosses', scale: 1 }] },
    { scale: 1.5, items: [{ id: 'packs', scale: 1 }] },
    { scale: 1, items: [{ id: 'materials', scale: 1 }] },
    { scale: 1, items: [{ id: 'fonts', scale: 1 }] },
    { scale: 1.2, items: [{ id: 'palette', scale: 1 }] },
    { scale: 1.1, items: [{ id: 'mascots', scale: 1 }] },
    { scale: 0.9, items: [{ id: 'bags', scale: 1 }] },
  ],
];

export const MATERIALS: TileMaterial[] = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass', 'wood',
];
const FONTS: TileFont[] = ['medium', 'lightItalic', 'bold', 'inline', 'black'];
// The five pack families the Collection shows (feedback): the three consumable packs
// Fable / Ink / Constellation, plus Charm and Tile. `ink` is presentation-only until
// its Gambler registry lands, but it still counts as a family in the gallery.
const PACK_TYPES = ['pattern', 'joker', 'consumable', 'tile', 'ink'] as const;
const PAGE = 60;
const JOKERS_PER_PAGE = 15;
const CARDS_PER_PAGE = 10;
const VOUCHER_PAIRS_PER_PAGE = 4;

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

  // Viewing the collection clears the "new discoveries" badge (spec §0).
  useEffect(() => {
    markCollectionSeen();
  }, []);

  const counts = useMemo(
    () => ({
      words: { have: collectionSize(), total: lexicon.size },
      jokers: { have: ALL_JOKERS.length, total: ALL_JOKERS.length },
      materials: { have: MATERIALS.length, total: MATERIALS.length },
      fonts: { have: FONTS.length, total: FONTS.length },
      vouchers: {
        have: BASE_VOUCHER_IDS.length + loadVoucherProgress().unlocked.length,
        total: ALL_VOUCHER_IDS.length,
      },
      fableCards: { have: FABLE_DEFS.length, total: FABLE_DEFS.length },
      constellationCards: {
        have: CONSTELLATION_DEFS.length,
        total: CONSTELLATION_DEFS.length,
      },
      inkCards: { have: GAMBLER_CARDS.length, total: GAMBLER_CARDS.length },
      bosses: { have: CORE_BOSS_IDS.length, total: CORE_BOSS_IDS.length },
      packs: { have: PACK_TYPES.length, total: PACK_TYPES.length },
      palette: { have: playedCount(), total: UNLOCKS.length },
      mascots: {
        have: mascotCollectionRows(activeUnlocks(false)).filter((r) => r.unlocked && r.art).length,
        total: mascotCollectionRows(activeUnlocks(false)).length,
      },
      bags: { have: 1, total: 1 },
    }),
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
                    key={block.items.map(({ id }) => id).join('-')}
                    className={`cat-block${block.family ? ` cat-family-block ${block.family}` : ''}`}
                    style={{ '--category-scale': block.scale } as CSSProperties}
                  >
                    {block.items.map(({ id, scale }) => {
                      const n = counts[id];
                      return (
                        <button
                          key={id}
                          className={`cat-btn cat-${id}`}
                          style={{ '--category-scale': scale } as CSSProperties}
                          onClick={() => setCat(id)}
                        >
                          <span className="cat-name">{t(`collection.cat.${id}`)}</span>
                          <span className="cat-count">
                            {n.have}/{n.total}
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
          {cat === 'materials' && <MaterialsView />}
          {cat === 'fonts' && <FontsView />}
          {cat === 'vouchers' && <VouchersView />}
          {cat === 'fableCards' && <FablesView />}
          {cat === 'constellationCards' && <ConstellationsView />}
          {cat === 'inkCards' && <GamblerCardsView />}
          {cat === 'bosses' && <BossesView />}
          {cat === 'packs' && <PacksView />}
          {cat === 'palette' && <PaletteView />}
          {cat === 'mascots' && <MascotsView />}
          {cat === 'bags' && <BagsView />}
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
  const [suit, setSuit] = useState<Suit | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  // Item 1: list the WHOLE dictionary, not just what's been played — words never
  // played render `locked` (dimmed) so the collection reads as something to fill in.
  // Built once per lexicon (~30k entries): plain `<` beats localeCompare at this
  // size, and the collection is read once rather than per word.
  const all = useMemo(() => {
    const collected = loadCollection();
    return [...lexicon.words()]
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map((w) => ({
        w,
        suit: lexicon.lookup(w)?.suit ?? 'standard',
        found: collected[w] !== undefined,
      }));
  }, [lexicon]);

  // Search + suit filter. With the whole dictionary listed, search is the only
  // practical way to reach a specific word (~500 pages otherwise).
  const words = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && suit === 'all') return all;
    return all.filter((e) => (suit === 'all' || e.suit === suit) && (!q || e.w.includes(q)));
  }, [all, suit, query]);

  const pages = Math.max(1, Math.ceil(words.length / PAGE));
  const clamped = Math.min(page, pages - 1);
  const slice = words.slice(clamped * PAGE, clamped * PAGE + PAGE);
  const suits: (Suit | 'all')[] = ['all', 'standard', 'formal', 'slang', 'vulgar'];

  return (
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
        <span className="coll-search-count">{t('collection.found', { n: words.length })}</span>
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
      <Pager page={clamped} pages={pages} onPage={setPage} />
    </>
  );
}

// ---------- Jokers ----------
function JokersView() {
  const { t, lang } = useI18n();
  const { page, pages, visible, setPage } = usePaged(ALL_JOKERS, JOKERS_PER_PAGE);

  return (
    <>
      <div className="card-grid joker-collection-grid">
        {visible.map((def) => {
          const art = jokerArt(def.id);
          return (
            <Tooltip
              key={def.id}
              title={lang === 'ko' ? def.nameKo : def.nameEn}
              body={t(jokerDescKey(def.id))}
              extra={grownValue(def, undefined, t)}
              rarity={def.rarity}
              down
            >
              <TiltCard idle className="emoji-tile-collection" tabIndex={0}>
                {art && <img className="cc-joker-art" src={art} alt="" />}
              </TiltCard>
            </Tooltip>
          );
        })}
      </div>
      <Pager page={page} pages={pages} onPage={setPage} />
    </>
  );
}

// ---------- Materials / Fonts (tile swatches) ----------
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
          emoji={locked ? '?' : v.emoji}
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

// ---------- Blinds & Bosses ----------
function BossesView() {
  const { t, lang } = useI18n();
  const antes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  return (
    <div className="bosses-split">
      <div className="panel target-table">
        <div className="label">{t('collection.targetCurve')}</div>
        {/* Non-boss blind emblems: Draft (small) / Revision (big). Deadlines are
            the 12 bosses shown to the right. */}
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
                <td>{blindTarget(a, 'small')}</td>
                <td>{blindTarget(a, 'big')}</td>
                <td>{blindTarget(a, 'boss')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="boss-chips">
        <div className="label">{t('collection.bosses')}</div>
        <div className="card-grid">
          {CORE_BOSS_IDS.map((id) => {
            const b = BOSS_REGISTRY.get(id)!;
            return (
              <Tooltip key={id} title={lang === 'ko' ? b.nameKo : b.nameEn} body={t(bossDescKey(id))} down>
                <TiltCard idle className="coll-card boss-card">
                  {BOSS_ART[id] ? (
                    <img className="boss-card-art" src={BOSS_ART[id]} alt="" />
                  ) : (
                    <span className="cc-emoji">{b.emoji}</span>
                  )}
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

// ---------- Packs / Bags ----------
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
// Split by effect kind into four sections — 색상 / 음향 / 캐릭터 / 언어. The
// section is derived from `effect.kind`; adding a future unlock kind = adding a
// row here, never a hard-coded word check (CLAUDE.md palette guardrail).
const PALETTE_SECTIONS: { key: string; kind: UnlockEffect['kind'] }[] = [
  { key: 'color', kind: 'color' },
  { key: 'audio', kind: 'audio' },
  { key: 'mascot', kind: 'mascot' },
  { key: 'locale', kind: 'locale' },
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
      : u.effect.kind === 'locale' ? 'unlock.body.korean'
      : 'unlock.body.mascot';
    return (
      <Tooltip
        key={u.id}
        title={found ? u.word : t('collection.palette.locked')}
        body={found ? t(descKey) : t('collection.palette.hint')}
        down
      >
        <div className={['coll-card', 'palette-card', found ? `chroma-${group ?? 'audio'}` : 'locked'].join(' ')}>
          <span className="cc-emoji">🎨</span>
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
  // The override makes skins selectable but does not change discovery counts.
  const rows = mascotCollectionRows(activeUnlocks(settings.unlockAll));
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
          audio.play('buttonPress');
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
              <span className="cc-emoji">❔</span>
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
function BagsView() {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      <div className="swatch bag-detail">
        <img className="bag-art big" src={pouchUrl} alt="" />
        <span className="sw-name">{t('bag.standard.name')}</span>
        <p className="select-desc">{t('bag.standard.desc')}</p>
      </div>
    </div>
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
      // Rainman and Sake Cup have art but no engine definition — their effects
      // stay pending in GDD §10.3, so they keep the placeholder line.
      body={(card) =>
        (GAMBLER_IDS as readonly string[]).includes(card.id)
          ? t(consumableDescKey(card.id))
          : t('collection.gambler.effectPending')
      }
    />
  );
}

// ---------- shared pager ----------
function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const { t } = useI18n();
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="car-arrow" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        ‹
      </button>
      <span className="pager-label">{t('collection.page', { n: page + 1, m: pages })}</span>
      <button className="car-arrow" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        ›
      </button>
    </div>
  );
}
