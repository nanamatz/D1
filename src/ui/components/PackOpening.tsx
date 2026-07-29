import { useEffect, useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import type { ConsumableId, JokerRarity, Tile } from '../../engine/types';
import type { PackOption } from '../../engine/packs';
import { NO_LETTER } from '../../engine/scoring';
import { consumableDescKey, jokerDescKey, consumableAxisTip } from '../descriptions';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { packArt } from '../packArt';
import type { UseGame } from '../useGame';
import { TileView } from './Tile';
import { tileTooltip } from '../game';
import { Tooltip, type TooltipClassification } from './Tooltip';
import { canAddJoker } from '../../engine/vouchers';
import {
  canUseFableFromPack,
  FABLE_REGISTRY,
  fablePickCount,
  fableTargetsTiles,
  isBlindOnlyConsumable,
  isFableId,
  previewFableTile,
} from '../../engine/fables';
import { isConstellationId } from '../../engine/constellations';
import { FableCardArt } from './FableCardArt';
import { ConstellationCardArt } from './ConstellationCardArt';
import { TiltCard } from './TiltCard';
import { consumableClassification } from '../cardClassification';
import { useEntering } from './ScreenTransition';
import { packFableFxBus } from '../packFableFx';

const CONSUMABLE_EMOJI: Partial<Record<ConsumableId, string>> = { magnifier: '🔍' };
const PUNCTUATION_EMOJI: Partial<Record<ConsumableId, string>> = {
  ellipsis: '…', exclamation: '❗', doubleExclamation: '‼️', period: '。',
  colon: '：', semicolon: '；', dash: '—', comma: '，',
};

/** Emoji/glyph for a non-tile option. */
function optionEmoji(option: PackOption): string {
  if (option.kind === 'joker') return JOKER_REGISTRY.get(option.id)?.emoji ?? '🃏';
  if (option.kind === 'punctuation') return PUNCTUATION_EMOJI[option.id] ?? '✒️';
  if (option.kind === 'consumable') return CONSUMABLE_EMOJI[option.id] ?? '📄';
  return '📄'; // tile carries its own face; never reached here
}

interface Tip {
  title: string;
  body: string;
  rarity?: JokerRarity | undefined;
  classification?: TooltipClassification | undefined;
  sub?: { title: string; body: string } | undefined;
}

function OptionCard({
  option,
  label,
  name,
  blockKey,
  tip,
  selected,
  actionVisible,
  actionDisabled,
  picked,
  effecting,
  hoverOnlyAction,
  onSelect,
  onAction,
}: {
  option: PackOption;
  label: string;
  name: string;
  /** i18n key for why this pick is non-selectable (slots full), or undefined */
  blockKey?: string | undefined;
  /** hover tooltip (item 4) — shown on joker/consumable options regardless of blocked */
  tip?: Tip | undefined;
  selected?: boolean;
  actionVisible?: boolean;
  actionDisabled?: boolean;
  /** feature-04 C: this card is the one just chosen — lifts, pulses, gains an outline */
  picked?: boolean;
  /** Fable is casting onto its selected pouch tiles. */
  effecting?: boolean;
  /** Tile/Charm pack actions appear only while the stable shell is hovered. */
  hoverOnlyAction?: boolean;
  onSelect?: (() => void) | undefined;
  onAction: () => void;
}) {
  const { t } = useI18n();
  const edition =
    option.kind === 'joker' ? option.edition
      : option.kind === 'tile' ? (option.tile.edition ?? 'base')
        : 'base';
  const cardFace = (
    <TiltCard
      idle
      className={[
        'shopitem',
        'pack-option-card',
        option.kind === 'tile' && 'tile-pack-option',
        `edition-${edition}`,
        blockKey && 'blocked',
        selected && 'selected',
        picked && 'picked',
        effecting && 'fable-effecting',
      ]
        .filter(Boolean)
        .join(' ')}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? selected : undefined}
      onClick={onSelect}
      onKeyDown={onSelect ? (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      } : undefined}
    >
      <div className="pack-option-visual">
        {option.kind === 'tile' ? (
          <TileView tile={option.tile} />
        ) : option.kind === 'punctuation' && isConstellationId(option.id) ? (
          <ConstellationCardArt
            id={option.id}
            className="shop-consumable-art"
            title={name}
          />
        ) : option.kind === 'consumable' && isFableId(option.id) ? (
          <FableCardArt
            id={option.id}
            className="shop-consumable-art"
            title={name}
          />
        ) : (
          <span className="e">{optionEmoji(option)}</span>
        )}
      </div>
      {edition !== 'base' && <span className="edition-badge">{edition}</span>}
    </TiltCard>
  );
  // The tooltip wraps the whole card, so it shows on hover even when the pick is
  // blocked (item 4) — hover is CSS-driven and independent of the block state.
  const card = tip ? (
    <Tooltip
      title={tip.title}
      body={tip.body}
      rarity={tip.rarity}
      classification={tip.classification}
      sub={tip.sub}
    >
      {cardFace}
    </Tooltip>
  ) : cardFace;
  return (
    <div className={['pack-option-shell', hoverOnlyAction && 'hover-action'].filter(Boolean).join(' ')}>
      {card}
      {actionVisible && (
        blockKey ? (
          <span className="pack-option-action pack-block">{t(blockKey)}</span>
        ) : (
          <button
            className="btn exchange sm pack-option-action"
            disabled={actionDisabled}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onAction();
            }}
          >
            {label}
          </button>
        )
      )}
    </div>
  );
}

/** True when motion should be suppressed (OS setting or the app's reduced-motion toggle). */
function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.body.classList.contains('force-reduced-motion')
  );
}

const BURST_MS = 900;

/** Pack selection screen (GDD §9.3): pick up to `pick` of the shown options. */
export function PackOpening({
  g,
  selectedCandidates,
  onSelectedCandidatesChange,
}: {
  g: UseGame;
  selectedCandidates: string[];
  onSelectedCandidatesChange: (ids: string[]) => void;
}) {
  const { t, lang } = useI18n();
  const pack = g.state.pack;
  const entering = useEntering();
  // Shared open sequence (shake → burst → cards fly in). Plays once per pack — this
  // component mounts fresh each time a pack is opened. Shop delays the state
  // change until its lower panel has exited, so this starts after that exit beat.
  const [opening, setOpening] = useState(false);
  const [started, setStarted] = useState(false);
  // feature-04 C: the card just chosen (a stable option key), held for a short beat
  // so its lift + pulse + outline is SEEN before the pick applies and the fan re-arcs
  // (or the overlay closes on the last pick) — selecting used to do nothing visible.
  const [picking, setPicking] = useState<string | null>(null);
  const [selectedFable, setSelectedFable] = useState<string | null>(null);
  const [fableFx, setFableFx] = useState<{
    key: string;
    kind: 'material' | 'rankUp' | 'destroy' | 'other';
    tileIds: string[];
    preview: Map<string, Tile>;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  // Transition completion only STARTS the sequence. Keep its end timer in a
  // separate effect: when this effect sets `started`, React reruns it, and a
  // cleanup returned from here would cancel the timer immediately.
  useEffect(() => {
    if (entering || started) return;
    setStarted(true);
    if (motionOff()) return;
    setOpening(true);
  }, [entering, started]);

  useEffect(() => {
    if (!opening) return;
    const id = setTimeout(() => setOpening(false), BURST_MS);
    return () => clearTimeout(id);
  }, [opening]);

  useEffect(() => {
    if (!pack || pack.offer.type !== 'consumable') return;
    let timer: number | undefined;
    const off = packFableFxBus.on((event) => {
      const effectKind = FABLE_REGISTRY.get(event.id)?.effect.kind;
      const kind =
        effectKind === 'material' || effectKind === 'rankUp' || effectKind === 'destroy'
          ? effectKind
          : 'other';
      const effectMs = motionOff() ? 120 : 900;
      const key = `held:${event.id}`;
      audio.play('packPick');
      setPicking(key);
      setFableFx({
        key,
        kind,
        tileIds: event.tileIds,
        preview: new Map(
          (pack.candidateTiles ?? [])
            .filter((tile) => event.tileIds.includes(tile.id))
            .map((tile) => [tile.id, previewFableTile(event.id, tile)]),
        ),
      });
      timer = window.setTimeout(() => {
        event.resolve();
        setFableFx(null);
        setPicking(null);
        onSelectedCandidatesChange([]);
      }, effectMs);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [pack, onSelectedCandidatesChange]);

  if (!pack) return null;

  const PICK_BEAT = motionOff() ? 0 : 320;
  const doPick = (key: string, resolvePick: () => void) => {
    if (picking) return; // one selection resolving at a time
    audio.play('packPick'); // confirm SFX on selection (A-4 / C)
    setPicking(key);
    window.setTimeout(() => {
      if (pack.picksLeft <= 1) {
        setClosing(true);
        window.setTimeout(resolvePick, 360);
      } else {
        resolvePick();
      }
      setPicking(null);
      setSelectedFable(null);
      onSelectedCandidatesChange([]);
    }, PICK_BEAT);
  };
  const doFableUse = (
    key: string,
    fableId: Extract<ConsumableId, `fable${number}`>,
    tileIds: string[],
    resolvePick: () => void,
  ) => {
    if (picking) return;
    const effectKind = FABLE_REGISTRY.get(fableId)?.effect.kind;
    const kind =
      effectKind === 'material' || effectKind === 'rankUp' || effectKind === 'destroy'
        ? effectKind
        : 'other';
    const effectMs = motionOff() ? 120 : 900;
    audio.play('packPick');
    setPicking(key);
    setFableFx({
      key,
      kind,
      tileIds,
      preview: new Map(
        (pack.candidateTiles ?? [])
          .filter((tile) => tileIds.includes(tile.id))
          .map((tile) => [tile.id, previewFableTile(fableId, tile)]),
      ),
    });
    window.setTimeout(() => {
      // Hold the completed result for half a second before the pack begins closing.
      window.setTimeout(() => {
        if (pack.picksLeft <= 1) {
          setClosing(true);
          window.setTimeout(resolvePick, 360);
        } else {
          resolvePick();
          // The committed candidate state replaces the preview in this render.
          setFableFx(null);
        }
        setPicking(null);
        setSelectedFable(null);
        onSelectedCandidatesChange([]);
      }, 500);
    }, effectMs);
  };
  const close = () => {
    if (closing || picking) return;
    setClosing(true);
    window.setTimeout(g.closePack, 360);
  };

  const optionName = (o: PackOption): string => {
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return def ? (lang === 'ko' ? def.nameKo : def.nameEn) : o.id;
    }
    if (o.kind === 'tile') return o.tile.letter ?? NO_LETTER;
    return t(`consumable.${o.id}`); // consumable / punctuation
  };

  // Hover tooltip for every revealed option (feature-04 B — opened-pack contents were
  // the known gap). Tiles get the shared 3-axis tooltip too, so a Foil Lead-plate tile
  // in a pack reads the same as one in hand.
  const optionTip = (o: PackOption): Tip | undefined => {
    if (o.kind === 'tile') return tileTooltip(o.tile, t);
    if (o.kind === 'joker') {
      const def = JOKER_REGISTRY.get(o.id);
      return { title: optionName(o), body: t(jokerDescKey(o.id)), rarity: def?.rarity };
    }
    if (o.kind === 'punctuation') {
      // Explain it levels the mapped pattern immediately (feature-02 B).
      return {
        title: optionName(o),
        body: t('pack.constellationLevels', { pattern: t(`pattern.${o.pattern}`) }),
        classification: 'constellation',
      };
    }
    if (o.kind === 'consumable') {
      return {
        title: optionName(o),
        body: t(consumableDescKey(o.id)),
        classification: consumableClassification(o.id),
        sub: consumableAxisTip(o.id, t) ?? undefined,
      };
    }
    return undefined;
  };

  const artSrc = packArt(pack.offer.type, pack.offer.size, pack.offer.artVariant);
  // Old resting saves may contain a pre-candidate pack snapshot. Treat it as an
  // empty candidate field instead of crashing during resume.
  const candidateTiles = pack.candidateTiles ?? [];
  const optionKey = (option: PackOption, index: number): string =>
    option.kind === 'tile' ? `t:${option.tile.id}` : `${option.kind}:${option.id}:${index}`;
  const selectedFableIndex = pack.offer.options.findIndex(
    (option, index) => optionKey(option, index) === selectedFable,
  );
  const selectedFableOption =
    selectedFableIndex >= 0 ? pack.offer.options[selectedFableIndex] : undefined;
  const selectedTargetId =
    selectedFableOption?.kind === 'consumable' &&
    isFableId(selectedFableOption.id) &&
    fableTargetsTiles(selectedFableOption.id)
      ? selectedFableOption.id
      : null;
  const candidatesActive = pack.offer.type === 'consumable';
  const candidateMax = selectedTargetId
    ? fablePickCount(selectedTargetId).max
    : candidateTiles.length;
  const toggleCandidate = (tileId: string) => {
    if (!candidatesActive || picking) return;
    if (selectedCandidates.includes(tileId)) {
      onSelectedCandidatesChange(selectedCandidates.filter((id) => id !== tileId));
    } else if (selectedCandidates.length < candidateMax) {
      onSelectedCandidatesChange([...selectedCandidates, tileId]);
    }
  };

  return (
    <div
      className={[
        'shop',
        'pack-opening',
        closing ? 'phase-panel-leaving' :
        entering || !started ? 'preparing' : opening ? 'opening' : 'revealed',
      ].join(' ')}
    >
      {/* Open sequence overlay: the pack shakes, flashes, and bursts; then the option
          cards fly in beneath (they mount immediately but are hidden until reveal). */}
      {opening && (
        <div className="pack-open-fx" aria-hidden>
          <div className="pack-open-flash" />
          {artSrc ? (
            <img className="pack-open-burst" src={artSrc} alt="" />
          ) : (
            <div className="pack-open-burst generic">📦</div>
          )}
          <div className="pack-open-particles">
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} className="pack-particle" style={{ ['--a' as string]: `${i * 36}deg` }} />
            ))}
          </div>
        </div>
      )}
      <div className="panel">
        {candidateTiles.length > 0 && (
          <div className="pack-candidates">
            <div className="label">{t('pack.effectCandidates')}</div>
            <div className="pack-candidate-row">
              {candidateTiles.map((tile, i) => {
                const preview = fableFx?.preview.get(tile.id) ?? tile;
                const changes = [
                  preview.material !== tile.material ? t(`material.${preview.material}`) : null,
                  preview.font !== tile.font ? t(`font.${preview.font}`) : null,
                  (preview.edition ?? 'base') !== (tile.edition ?? 'base')
                    ? t(`edition.${preview.edition ?? 'base'}`)
                    : null,
                  preview.letter !== tile.letter ? `${tile.letter ?? '?'} → ${preview.letter ?? '?'}` : null,
                ].filter((value): value is string => value !== null);
                return (
                  <div
                    key={tile.id}
                    className={[
                      'pack-candidate-tile',
                      fableFx?.tileIds.includes(tile.id) && 'fable-effect-target',
                      fableFx?.tileIds.includes(tile.id) && `fx-${fableFx.kind}`,
                    ].filter(Boolean).join(' ')}
                    style={{ ['--candidate-i' as string]: i }}
                  >
                    <TileView
                      tile={preview}
                      selected={selectedCandidates.includes(tile.id)}
                      disabled={!candidatesActive}
                      {...(candidatesActive ? { onSelect: toggleCandidate } : {})}
                      tooltip={tileTooltip(preview, t)}
                    />
                    {fableFx?.tileIds.includes(tile.id) && (
                      <>
                        <span className="fable-target-fx" aria-hidden />
                        {changes.length > 0 && (
                          <span className="fable-axis-change" aria-hidden>{changes.join(' · ')}</span>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {/* Balatro fan: cards arc across the centre at full size (§2.6.1). Each card's
            rotation + arc-drop comes from its position; the middle sits highest. */}
        <div
          className="pack-fan"
          style={{ ['--pack-count' as string]: pack.offer.options.length }}
        >
          {pack.offer.options.map((o, i) => {
            // Only Emoji Tiles remain slot-blocked inside a pack. Fables own their
            // confirm flow, and Constellations use immediately without a held slot.
            const fableId = o.kind === 'consumable' && isFableId(o.id) ? o.id : null;
            const fable = fableId !== null;
            const constellation = o.kind === 'punctuation' && isConstellationId(o.id);
            const needsConfirmation = fable || constellation;
            const blindOnlyFable = fableId !== null && isBlindOnlyConsumable(fableId);
            const blockKey =
              o.kind === 'joker' && !canAddJoker(g.state.run, o.edition)
                ? 'pack.jokersFull'
                : undefined;
            const N = pack.offer.options.length;
            const mid = (N - 1) / 2;
            const key = optionKey(o, i);
            const selected = needsConfirmation && selectedFable === key;
            const actionVisible = !needsConfirmation || selected;
            const actionDisabled =
              fable &&
              !canUseFableFromPack(fableId, g.state.run, g.state.blind, selectedCandidates);
            const fanStyle = {
              ['--fan-rot' as string]: `${(i - mid) * 7}deg`,
              ['--fan-y' as string]: `${Math.abs(i - mid) ** 1.4 * 7}px`,
            };
            return (
              <div key={key} className="pack-fan-card" style={fanStyle}>
                <OptionCard
                  option={o}
                  name={optionName(o)}
                  label={
                    fable
                      ? t(blindOnlyFable ? 'pack.select' : 'consumable.useAction')
                      : constellation
                        ? t('consumable.useAction')
                      : t('pack.pick')
                  }
                  blockKey={blockKey}
                  tip={optionTip(o)}
                  selected={selected}
                  actionVisible={actionVisible}
                  actionDisabled={actionDisabled}
                  picked={picking === key}
                  effecting={fableFx?.key === key}
                  hoverOnlyAction={o.kind === 'tile' || o.kind === 'joker'}
                  onSelect={needsConfirmation ? () => {
                    if (picking) return;
                    setSelectedFable(selected ? null : key);
                    audio.play('buttonPress');
                  } : undefined}
                  onAction={() => {
                    if (fable && fableId && !blindOnlyFable) {
                      doFableUse(
                        key,
                        fableId,
                        selectedCandidates,
                        () => g.usePackFable(i, selectedCandidates),
                      );
                      return;
                    }
                    doPick(
                      key,
                      fable
                        ? () => g.usePackFable(i, selectedCandidates)
                        : constellation
                          ? () => g.usePackConstellation(i)
                          : () => g.pickPackOption(i),
                    );
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="shop-head panel pack-footer">
        {artSrc && <img className="pack-open-art" src={artSrc} alt="" />}
        <div className="kind">
          {t(`pack.type.${pack.offer.type}`)} · {t(`pack.size.${pack.offer.size}`)}
        </div>
        <div className="money">
          {t('pack.pickOf', { n: pack.picksLeft, m: pack.offer.options.length })}
        </div>
        <button className="btn cash" onClick={close} disabled={closing || !!picking}>
          {t('pack.skip')}
        </button>
      </div>
    </div>
  );
}
