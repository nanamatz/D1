import { useEffect, useMemo, useState } from 'react';
import { ALL_JOKERS, JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY, ALL_VOUCHER_IDS } from '../../engine/vouchers';
import { BOSS_REGISTRY, CORE_BOSS_IDS } from '../../engine/bosses';
import { BOSS_ART, BLIND_ART } from '../bossArt';
import { blindTarget } from '../../engine/economy';
import { BALANCE } from '../../engine/balance';
import type { Lexicon } from '../../engine/lexicon';
import type { Suit, TileFont, TileMaterial, Tile } from '../../engine/types';
import { loadCollection, collectionSize, markCollectionSeen, unseenCount } from '../collection';
import { UNLOCKS, loadPlayed, playedCount, activeUnlocks } from '../unlocks';
import { mascotCollectionRows } from '../mascots';
import { bossDescKey, fontDescKey, jokerDescKey, voucherDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import { packArt, packGalleryPages } from '../packArt';
import pouchUrl from '../assets/pouch.png';
import { Tooltip } from './Tooltip';
import { TileView } from './Tile';

type Category =
  | 'words'
  | 'jokers'
  | 'materials'
  | 'fonts'
  | 'vouchers'
  | 'bosses'
  | 'packs'
  | 'palette'
  | 'mascots'
  | 'bags';

export const MATERIALS: TileMaterial[] = [
  'ceramic', 'porcelain', 'polished', 'glass', 'stone', 'leadPlate', 'ivory', 'brass',
];
const FONTS: TileFont[] = ['medium', 'lightItalic', 'bold', 'inline', 'black'];
const PACK_TYPES = ['pattern', 'joker', 'consumable', 'tile'] as const;
const PAGE = 60;

const sampleTile = (over: Partial<Tile>): Tile => {
  const material = over.material ?? 'ceramic';
  // material === 'stone' ⟺ letter === null (packs.ts:55) — a lettered Stone
  // sample tile would violate that invariant even though it's display-only here.
  return {
    id: `s-${material}-${over.font ?? 'medium'}`,
    letter: material === 'stone' ? null : 'A',
    case: 'upper',
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
      vouchers: { have: ALL_VOUCHER_IDS.length, total: ALL_VOUCHER_IDS.length },
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

  const CATS: Category[] = ['words', 'jokers', 'materials', 'fonts', 'vouchers', 'bosses', 'packs', 'palette', 'mascots', 'bags'];

  if (cat === null) {
    return (
      <div className="screen collection">
        <h2 className="scr-title">{t('collection.title')}</h2>
        <div className="cat-menu">
          {CATS.map((c) => {
            const n = counts[c];
            return (
              <button key={c} className="cat-btn" onClick={() => setCat(c)}>
                <span className="cat-name">{t(`collection.cat.${c}`)}</span>
                <span className="cat-count">
                  {n.have}/{n.total}
                </span>
                {c === 'words' && unseenCount() > 0 && <span className="badge">!</span>}
              </button>
            );
          })}
        </div>
        <button className="btn back-bar" onClick={onBack}>
          {t('common.back')}
        </button>
      </div>
    );
  }

  return (
    <div className="screen collection">
      <div className="coll-head">
        <button className="btn exchange sm" onClick={() => setCat(null)}>
          ‹ {t('collection.categories')}
        </button>
        <h2 className="scr-title">{t(`collection.cat.${cat}`)}</h2>
      </div>

      <div className="coll-detail">
        {cat === 'words' && <WordsView lexicon={lexicon} />}
        {cat === 'jokers' && <JokersView />}
        {cat === 'materials' && <MaterialsView />}
        {cat === 'fonts' && <FontsView />}
        {cat === 'vouchers' && <VouchersView />}
        {cat === 'bosses' && <BossesView />}
        {cat === 'packs' && <PacksView />}
        {cat === 'palette' && <PaletteView />}
        {cat === 'mascots' && <MascotsView />}
        {cat === 'bags' && <BagsView />}
      </div>

      <button className="btn back-bar" onClick={onBack}>
        {t('common.back')}
      </button>
    </div>
  );
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
  return (
    <div className="card-grid">
      {ALL_JOKERS.map((def) => {
        const accent = def.rarity !== 'common' ? def.rarity : undefined;
        return (
          <Tooltip
            key={def.id}
            title={lang === 'ko' ? def.nameKo : def.nameEn}
            body={t(jokerDescKey(def.id))}
            rarity={def.rarity}
            down
          >
            <div className={['coll-card', accent].filter(Boolean).join(' ')}>
              <span className="cc-emoji">{def.emoji}</span>
              <span className="cc-name">{lang === 'ko' ? def.nameKo : def.nameEn}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
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
  return (
    <div className="card-grid">
      {ALL_VOUCHER_IDS.map((id) => {
        const v = VOUCHER_REGISTRY.get(id)!;
        return (
          <Tooltip key={id} title={lang === 'ko' ? v.nameKo : v.nameEn} body={t(voucherDescKey(id))} down>
            <div className="coll-card">
              <span className="cc-emoji">{v.emoji}</span>
              <span className="cc-name">{lang === 'ko' ? v.nameKo : v.nameEn}</span>
            </div>
          </Tooltip>
        );
      })}
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
                <div className="coll-card boss-card">
                  {BOSS_ART[id] ? (
                    <img className="boss-card-art" src={BOSS_ART[id]} alt="" />
                  ) : (
                    <span className="cc-emoji">{b.emoji}</span>
                  )}
                  <span className="cc-name">{lang === 'ko' ? b.nameKo : b.nameEn}</span>
                </div>
              </Tooltip>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------- Packs / Bags ----------
/**
 * Paged pack gallery (Reference.png): one page per pack type. Art-backed types
 * (Tile / Charm / Ink) show every variant; a type without art yet (Consumable)
 * shows a "coming soon" silhouette. Each pack idles (CSS), staggered.
 */
function PacksView() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const pages = packGalleryPages();
  const clamped = Math.min(page, pages.length - 1);
  const entries = pages[clamped]!;

  return (
    <>
      <div className="pack-gallery">
        {entries.map((e, i) =>
          e.kind === 'art' ? (
            <Tooltip
              key={`a${i}`}
              title={`${t(`pack.type.${e.type}`)} · ${t(`pack.size.${e.size}`)}`}
              body={t(`packdesc.${e.type}`)}
              down
            >
              <div className="pack-gallery-card">
                <img className="pack-gallery-art" src={e.src} alt="" />
                <span className="cc-name">
                  {t(`pack.type.${e.type}`)} · {t(`pack.size.${e.size}`)}
                </span>
              </div>
            </Tooltip>
          ) : (
            <Tooltip key={`c${i}`} title={t(`pack.type.${e.type}`)} body={t('collection.comingSoon')} down>
              <div className="pack-gallery-card coming-soon">
                {/* No art yet — a darkened pack shape stands in as a silhouette. */}
                <img className="pack-gallery-art silhouette" src={packArt('tile', 'normal', 0)!} alt="" />
                <span className="cc-name">{t(`pack.type.${e.type}`)}</span>
                <span className="coming-soon-tag">{t('collection.comingSoon')}</span>
              </div>
            </Tooltip>
          ),
        )}
      </div>
      <Pager page={clamped} pages={pages.length} onPage={setPage} />
    </>
  );
}

// ---------- Palette (chromatic unlocks, feature-02 C-5) ----------
function PaletteView() {
  const { t } = useI18n();
  const played = loadPlayed();
  return (
    <div className="card-grid">
      {UNLOCKS.map((u) => {
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
      })}
    </div>
  );
}
// ---------- Mascots (item 5.1) ----------
function MascotsView() {
  const { t } = useI18n();
  // Display only — the unlockAll override reveals but never "discovers" (matches Palette).
  const rows = mascotCollectionRows(activeUnlocks(false));
  return (
    <div className="card-grid">
      {rows.map((r) => {
        const reveal = r.unlocked && !!r.art; // full portrait + name
        const silhouette = !r.unlocked && !!r.art; // teased shape, hidden name
        return (
          <div
            key={r.id}
            className={['coll-card', 'mascot-card', r.unlocked ? '' : 'locked'].filter(Boolean).join(' ')}
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
          </div>
        );
      })}
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
