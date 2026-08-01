import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { isConstellationId } from '../../engine/constellations';
import { isFableId } from '../../engine/fables';
import { isGamblerId } from '../../engine/gamblers';
import { JOKER_REGISTRY } from '../../engine/jokers';
import type { ConsumableId, OwnedJoker, Tile } from '../../engine/types';
import { consumableEffectBus, type ConsumableEffectEvent } from '../consumableEffect';
import {
  consumableTooltipBody,
  jokerTooltip,
} from '../descriptions';
import { tileTooltip } from '../game';
import { useI18n } from '../i18n';
import { jokerArt } from '../jokerArt';
import { richText } from '../richtext';
import { CardArt, type CardFamily } from './CardArt';
import { TileView } from './Tile';
import { Tooltip } from './Tooltip';

const EFFECT_DURATION_MS = 2400;

const familyOf = (id: ConsumableId): CardFamily | null =>
  isFableId(id) ? 'fable'
    : isConstellationId(id) ? 'constellation'
      : isGamblerId(id) ? 'gambler'
        : null;

/** Shared result vignette for consumables without a bespoke sequence. */
export function ConsumableEffect() {
  const { t, lang } = useI18n();
  const [active, setActive] = useState<(ConsumableEffectEvent & { sequence: number }) | null>(null);

  useEffect(() => {
    let sequence = 0;
    return consumableEffectBus.on((event) => setActive({ ...event, sequence: sequence++ }));
  }, []);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), EFFECT_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  if (!active) return null;
  const family = familyOf(active.id);
  const hasResults =
    active.removedTiles.length > 0 ||
    active.addedTiles.length > 0 ||
    active.changedTiles.length > 0 ||
    active.removedJokers.length > 0 ||
    active.addedJokers.length > 0 ||
    active.addedConsumables.length > 0 ||
    active.goldDelta !== 0 ||
    active.handSizeDelta !== 0 ||
    active.patternLevelsGained > 0;

  const tileObject = (tile: Tile, mode: 'destroyed' | 'changed' | 'created') => (
    <div key={`${mode}-${tile.id}`} className={`cfx-object cfx-${mode}`}>
      <TileView tile={tile} mini inspectable tooltip={tileTooltip(tile, t)} />
    </div>
  );

  const jokerObject = (joker: OwnedJoker, mode: 'destroyed' | 'created', index: number) => {
    const def = JOKER_REGISTRY.get(joker.defId);
    const art = jokerArt(joker.defId);
    if (!def || !art) return null;
    const tip = jokerTooltip(joker.defId, joker.edition ?? 'base', t);
    return (
      <Tooltip
        key={`${mode}-${joker.defId}-${index}`}
        title={lang === 'ko' ? def.nameKo : def.nameEn}
        body={tip.body}
        rarity={def.rarity}
        tags={tip.tags}
        sub={tip.sub}
      >
        <div
          className={`cfx-object cfx-joker cfx-${mode} emoji-tile-image-only edition-${joker.edition ?? 'base'}`}
          tabIndex={0}
        >
          <img src={art} alt="" />
        </div>
      </Tooltip>
    );
  };

  const consumableObject = (id: ConsumableId, index: number) => {
    const objectFamily = familyOf(id);
    if (!objectFamily) return null;
    return (
      <Tooltip
        key={`created-consumable-${id}-${index}`}
        title={t(`consumable.${id}`)}
        body={consumableTooltipBody(id, t)}
        classification={objectFamily}
      >
        <div className="cfx-object cfx-card-object cfx-created" tabIndex={0}>
          <CardArt family={objectFamily} id={id} />
        </div>
      </Tooltip>
    );
  };

  return createPortal(
    <div className="consumable-effect" key={active.sequence} aria-live="polite">
      <div className={`cfx-stage${family ? '' : ' cfx-no-source'}`}>
        {family && (
          <Tooltip
            title={t(`consumable.${active.id}`)}
            body={consumableTooltipBody(active.id, t)}
            classification={family}
          >
            <div className="cfx-source" tabIndex={0}>
              <CardArt family={family} id={active.id} />
            </div>
          </Tooltip>
        )}
        <div className="cfx-copy">
          <strong>{t(`consumable.${active.id}`)}</strong>
          <p>{richText(consumableTooltipBody(active.id, t))}</p>
          <div className="cfx-results">
            {active.removedTiles.map((tile) => tileObject(tile, 'destroyed'))}
            {active.removedJokers.map((joker, index) => jokerObject(joker, 'destroyed', index))}
            {active.changedTiles.map((tile) => tileObject(tile, 'changed'))}
            {active.addedTiles.map((tile) => tileObject(tile, 'created'))}
            {active.addedJokers.map((joker, index) => jokerObject(joker, 'created', index))}
            {active.addedConsumables.map(consumableObject)}
          </div>
          <div className="cfx-stats">
            {active.goldDelta !== 0 && <span>{active.goldDelta > 0 ? '+' : ''}${active.goldDelta}</span>}
            {active.handSizeDelta !== 0 && (
              <span>{t('consumableFx.handSize', { n: active.handSizeDelta })}</span>
            )}
            {active.patternLevelsGained > 0 && (
              <span>{t('consumableFx.patternLevels', { n: active.patternLevelsGained })}</span>
            )}
            {!hasResults && <span>{t('settle.applied')}</span>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
