import { useEffect, useMemo, useState } from 'react';
import { ALL_JOKERS, JOKER_REGISTRY } from '../../engine/jokers';
import { VOUCHER_REGISTRY, ALL_VOUCHER_IDS } from '../../engine/vouchers';
import { BOSS_REGISTRY, CORE_BOSS_IDS } from '../../engine/bosses';
import { blindTarget } from '../../engine/economy';
import { BALANCE } from '../../engine/balance';
import type { Lexicon } from '../../engine/lexicon';
import type { Suit, TileFont, TileMaterial, Tile } from '../../engine/types';
import { loadCollection, collectionSize, markCollectionSeen, unseenCount } from '../collection';
import { bossDescKey, jokerDescKey, voucherDescKey } from '../descriptions';
import { useI18n } from '../i18n';
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
  | 'bags';

const MATERIALS: TileMaterial[] = ['ceramic', 'porcelain', 'polished', 'glass', 'stone'];
const FONTS: TileFont[] = ['medium', 'lightItalic', 'bold', 'inline', 'black'];
const PACK_KINDS = ['letter', 'emoji', 'consumable'] as const;
const PAGE = 60;

const sampleTile = (over: Partial<Tile>): Tile => ({
  id: `s-${over.material ?? 'ceramic'}-${over.font ?? 'medium'}`,
  letter: 'A',
  case: 'upper',
  material: 'ceramic',
  font: 'medium',
  ...over,
});

interface Props {
  lexicon: Lexicon;
  onBack: () => void;
}

/** Collection / 도감 (spec §2.9): category menu → shared grid detail views. */
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
      packs: { have: PACK_KINDS.length, total: PACK_KINDS.length },
      bags: { have: 1, total: 1 },
    }),
    [lexicon],
  );

  const CATS: Category[] = ['words', 'jokers', 'materials', 'fonts', 'vouchers', 'bosses', 'packs', 'bags'];

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
            accent={accent}
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
        <div key={m} className="swatch">
          <TileView tile={sampleTile({ material: m })} />
          <span className="sw-name">{t(`material.${m}`)}</span>
        </div>
      ))}
    </div>
  );
}
function FontsView() {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      {FONTS.map((f) => (
        <div key={f} className="swatch">
          <TileView tile={sampleTile({ font: f })} />
          <span className="sw-name">{t(`font.${f}`)}</span>
        </div>
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
          <Tooltip key={id} title={lang === 'ko' ? v.nameKo : v.nameEn} body={t(voucherDescKey(id))}>
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
        <div className="chip-wrap">
          {CORE_BOSS_IDS.map((id) => {
            const b = BOSS_REGISTRY.get(id)!;
            return (
              <Tooltip key={id} title={lang === 'ko' ? b.nameKo : b.nameEn} body={t(bossDescKey(id))}>
                <div className="boss-chip">{b.emoji}</div>
              </Tooltip>
            );
          })}
          {/* Ante-8 finishers are deferred (GDD §8.3) — shown as unknown. */}
          <div className="boss-chip unknown">?</div>
          <div className="boss-chip unknown">?</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Packs / Bags ----------
function PacksView() {
  const { t } = useI18n();
  return (
    <div className="card-grid">
      {PACK_KINDS.map((p) => (
        <Tooltip key={p} title={t(`pack.${p}`)} body={t(`packdesc.${p}`)}>
          <div className="coll-card">
            <span className="cc-emoji">📦</span>
            <span className="cc-name">{t(`pack.${p}`)}</span>
          </div>
        </Tooltip>
      ))}
    </div>
  );
}
function BagsView() {
  const { t } = useI18n();
  return (
    <div className="swatch-grid">
      <div className="swatch bag-detail">
        <div className="bag-art big">🎒</div>
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
