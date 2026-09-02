import { useEffect, useRef, useState } from 'react';
import { JOKER_REGISTRY } from '../../engine/jokers';
import { BALANCE } from '../../engine/balance';
import { consumableSellValue, emojiTileSellValue } from '../../engine/economy';
import type { ConsumableId, RunState, ScoreEvent, SentenceJokerTrigger } from '../../engine/types';
import {
  consumableAxisTip,
  consumableTooltipBody,
  consumableTooltipExtra,
  grownValue,
  jokerTooltip,
} from '../descriptions';
import { useI18n } from '../i18n';
import { audio } from '../audio';
import { motionOff } from '../motion';
import { formatScore } from '../formatScore';
import { useSettleView } from '../settle';
import { Tooltip } from './Tooltip';
import { TiltCard } from './TiltCard';
import { jokerSlotLimit } from '../../engine/vouchers';
import { fableTargetsTiles, isFableId } from '../../engine/fables';
import { isConstellationId } from '../../engine/constellations';
import { isGamblerId } from '../../engine/gamblers';
import { consumableClassification } from '../cardClassification';
import { useShelfDrag } from '../drag';
import { jokerArt } from '../jokerArt';
import { CardArt } from './CardArt';
import { mascotSrc } from '../mascots';
import { UiIcon } from './UiIcon';
import type { UiIconId } from '../uiIcons';
import { GROWTH_POP_MS } from '../timing';
import { createGrowthPopQueue, type GrowthPopQueue } from '../growthPopQueue';

const CONSUMABLE_ICON: Partial<Record<ConsumableId, UiIconId>> = { magnifier: 'magnifier' };
const NO_GROWTH_EVENTS: readonly ScoreEvent[] = [];

const fmtMult = (m: number): string => (Number.isInteger(m) ? String(m) : m.toFixed(2));

/** The firing joker's contribution popup during settle (B step 3). */
export function JokerPop({
  chips,
  chipsFactor,
  mult,
  multFactor,
  score = 0,
  gold = 0,
  stat = 0,
  applied,
}: {
  chips: number;
  chipsFactor?: number | undefined;
  mult: number;
  multFactor?: number | undefined;
  score?: number;
  gold?: number;
  stat?: number;
  applied: string;
}) {
  const signed = (value: number) => `${value > 0 ? '+' : ''}${fmtMult(value)}`;
  const money = gold > 0 ? `+$${gold}` : `-$${Math.abs(gold)}`;
  const hasValue = chips !== 0 || chipsFactor !== undefined || mult !== 0 || multFactor !== undefined || score !== 0 || gold !== 0 || stat !== 0;
  return (
    <span className="trigger-pop joker-pop" aria-hidden>
      {(chips !== 0 || chipsFactor !== undefined) && (
        <span className="chip">
          <span className="chip-diamond" />
          {chipsFactor !== undefined ? `×${fmtMult(chipsFactor)}` : signed(chips)}
        </span>
      )}
      {(mult !== 0 || multFactor !== undefined) && (
        <span className="mult">
          {multFactor !== undefined ? `×${fmtMult(multFactor)}` : signed(mult)}
        </span>
      )}
      {score !== 0 && (
        <span className="score"><span className="tomato-icon" />{signed(score)}</span>
      )}
      {gold !== 0 && <span className="gold">{money}</span>}
      {stat !== 0 && <span className="stat">{signed(stat)}</span>}
      {!hasValue && <span className="applied">{applied}</span>}
    </span>
  );
}

interface Props {
  run: RunState;
  /** Stable identity for the current run; only a hard run change resets queued pops. */
  runObservationId: string;
  pouchRemaining: number;
  onUseConsumable?: (id: ConsumableId) => void;
  canUseConsumable?: (id: ConsumableId) => boolean;
  onSellConsumable?: (index: number) => void;
  /** when set (shop), clicking an owned joker opens a Sell menu (D-1) */
  onSellJoker?: (index: number) => void;
  /** when set, the joker shelf supports drag-reorder (feature-02 D-1) */
  onReorderJoker?: (from: number, to: number) => void;
  /** An open Fable/Ink pack supplies pouch targets, so targeted Fables wait for its FX. */
  deferTargetFableUse?: boolean;
  /** Blueprint: hide every Emoji Tile behind the selected WooDak skin. */
  jokersFaceDown?: boolean;
  /** Growth already choreographed by the current scoring timeline. */
  animatedGrowthEvents?: readonly ScoreEvent[];
  /** Blind-end sentence effects currently landing in the score box. */
  bonusJokerTriggers?: readonly SentenceJokerTrigger[];
  /** Ultrasound rotation is revealed only after the scoring timeline completes. */
  settleComplete?: boolean;
}

/** Owned jokers (top-left) + consumables (top-right), per UI_DESIGN §2. */
export function JokerShelf({
  run,
  runObservationId,
  pouchRemaining,
  onUseConsumable,
  canUseConsumable,
  onSellConsumable,
  onSellJoker,
  onReorderJoker,
  deferTargetFableUse = false,
  jokersFaceDown = false,
  animatedGrowthEvents = NO_GROWTH_EVENTS,
  bonusJokerTriggers = [],
  settleComplete = true,
}: Props) {
  const { t, lang } = useI18n();
  const settle = useSettleView();
  const emojiSlotLimit = jokerSlotLimit(run);
  const [menuIdx, setMenuIdx] = useState<number | null>(null);
  const [hoveredConsumableIdx, setHoveredConsumableIdx] = useState<number | null>(null);
  const [jokerMenuIdx, setJokerMenuIdx] = useState<number | null>(null);
  const disabledIndex = run.jokers.findIndex((owned) => owned.state.bossDisabled === 1);
  const [visibleDisabledIndex, setVisibleDisabledIndex] = useState(disabledIndex);
  const [disabledEnteringIndex, setDisabledEnteringIndex] = useState<number | null>(null);
  const wasSettling = useRef(false);
  useEffect(() => {
    if (!settleComplete) {
      wasSettling.current = true;
      return;
    }
    if (visibleDisabledIndex !== disabledIndex) {
      setVisibleDisabledIndex(disabledIndex);
      if (wasSettling.current && disabledIndex >= 0) setDisabledEnteringIndex(disabledIndex);
    }
    wasSettling.current = false;
  }, [disabledIndex, settleComplete, visibleDisabledIndex]);
  useEffect(() => {
    if (disabledEnteringIndex === null) return;
    const timer = setTimeout(() => setDisabledEnteringIndex(null), 720);
    return () => clearTimeout(timer);
  }, [disabledEnteringIndex]);
  const growthSnapshot = (source: RunState): Map<string, number> => new Map<string, number>(
    source.jokers.flatMap((owned, index) => {
      const display = JOKER_REGISTRY.get(owned.defId)?.growthDisplay;
      const identity = owned.instanceId !== undefined ? `uid:${owned.instanceId}` : `legacy:${index}`;
      return display
        ? [[`${identity}:${owned.defId}:${display.stateKey}`, owned.state[display.stateKey] ?? display.initial] as const]
        : [];
    }),
  );
  const previousGrowth = useRef(growthSnapshot(run));
  const seenLifecycleGrowth = useRef(
    Math.max(0, ...(run.lifecycleGrowthEvents ?? []).map((event) => event.sequence)),
  );
  const queuedLifecycleGrowth = useRef(new Set<number>());
  const growthId = useRef(0);
  type GrowthPop = {
    index: number;
    jokerId: string;
    jokerInstanceId?: number;
    sequence?: number;
    chips: number;
    mult: number;
    gold: number;
    stat: number;
    playSound: boolean;
    id: number;
  };
  const [growthPops, setGrowthPops] = useState<GrowthPop[]>([]);
  const growthQueue = useRef<GrowthPopQueue<GrowthPop> | null>(null);
  if (!growthQueue.current) {
    growthQueue.current = createGrowthPopQueue(
      (pop) => {
        if (pop.sequence !== undefined) {
          queuedLifecycleGrowth.current.delete(pop.sequence);
          seenLifecycleGrowth.current = Math.max(seenLifecycleGrowth.current, pop.sequence);
        }
        setGrowthPops([pop]);
        if (pop.playSound) {
          audio.play(pop.gold !== 0 ? 'coinGain' : pop.mult !== 0
            ? 'jokerMult' : pop.chips !== 0 ? 'jokerChips' : 'jokerEffect');
          audio.chips(Math.abs(pop.chips));
        }
      },
      () => setGrowthPops([]),
      GROWTH_POP_MS,
    );
  }
  useEffect(() => {
    growthQueue.current?.reset();
    queuedLifecycleGrowth.current.clear();
    previousGrowth.current = growthSnapshot(run);
    seenLifecycleGrowth.current = Math.max(
      0, ...(run.lifecycleGrowthEvents ?? []).map((event) => event.sequence),
    );
  }, [runObservationId]);
  useEffect(() => {
    growthQueue.current?.setPaused(!settleComplete);
  }, [settleComplete]);
  useEffect(() => {
    const next = growthSnapshot(run);
    const covered = new Map<string, number>();
    const lifecycle = (run.lifecycleGrowthEvents ?? [])
      .filter((event) => event.sequence > seenLifecycleGrowth.current &&
        !queuedLifecycleGrowth.current.has(event.sequence))
      .sort((left, right) => left.sequence - right.sequence);
    for (const event of animatedGrowthEvents) {
      if (event.kind !== 'joker' || !event.growthKind || !event.growthDelta) continue;
      const identity = event.jokerInstanceId !== undefined
        ? `uid:${event.jokerInstanceId}` : `def:${event.jokerId}`;
      const key = `${identity}:${event.growthKind}`;
      covered.set(key, (covered.get(key) ?? 0) + event.growthDelta);
    }
    for (const event of lifecycle) {
      const identity = event.jokerInstanceId !== undefined
        ? `uid:${event.jokerInstanceId}` : `def:${event.jokerId}`;
      const key = `${identity}:${event.kind}`;
      covered.set(key, (covered.get(key) ?? 0) + event.delta);
    }
    const pops: typeof growthPops = [];
    for (const event of lifecycle) {
      const index = run.jokers.findIndex((owned) =>
        event.jokerInstanceId !== undefined
          ? owned.instanceId === event.jokerInstanceId
          : owned.defId === event.jokerId,
      );
      const owned = run.jokers[index];
      const display = owned ? JOKER_REGISTRY.get(owned.defId)?.growthDisplay : undefined;
      if (index < 0) {
        seenLifecycleGrowth.current = Math.max(seenLifecycleGrowth.current, event.sequence);
        continue;
      }
      queuedLifecycleGrowth.current.add(event.sequence);
      pops.push({
        index,
        jokerId: event.jokerId,
        sequence: event.sequence,
        ...(event.jokerInstanceId !== undefined
          ? { jokerInstanceId: event.jokerInstanceId }
          : {}),
        chips: event.kind === 'chips' ? event.delta : 0,
        mult: event.kind === 'mult' || event.kind === 'multAdd' ? event.delta : 0,
        gold: event.kind === 'gold' ? event.delta : 0,
        stat: event.kind === 'handSize' ? event.delta : 0,
        playSound: display?.playSound !== false,
        id: growthId.current++,
      });
    }
    run.jokers.forEach((owned, index) => {
      const display = JOKER_REGISTRY.get(owned.defId)?.growthDisplay;
      if (!display) return;
      const identity = owned.instanceId !== undefined ? `uid:${owned.instanceId}` : `legacy:${index}`;
      const snapshotKey = `${identity}:${owned.defId}:${display.stateKey}`;
      const before = previousGrowth.current.get(snapshotKey);
      const after = next.get(snapshotKey)!;
      if (before === undefined || after === before) return;
      const change = after - before;
      if (change < 0 && !display.showDecrease) return;
      const coverageKey = `${owned.instanceId !== undefined
        ? `uid:${owned.instanceId}` : `def:${owned.defId}`}:${display.kind}`;
      const coverage = covered.get(coverageKey) ?? 0;
      const hidden = Math.sign(coverage) === Math.sign(change)
        ? Math.sign(change) * Math.min(Math.abs(change), Math.abs(coverage))
        : 0;
      covered.set(coverageKey, coverage - hidden);
      const delta = change - hidden;
      if (Math.abs(delta) <= 1e-9) return;
      pops.push({
        index,
        jokerId: owned.defId,
        ...(owned.instanceId !== undefined ? { jokerInstanceId: owned.instanceId } : {}),
        chips: display.kind === 'chips' ? delta : 0,
        mult: display.kind === 'mult' || display.kind === 'multAdd' ? delta : 0,
        gold: display.kind === 'gold' ? delta : 0,
        stat: display.kind === 'handSize' ? delta : 0,
        playSound: display.playSound !== false,
        id: growthId.current++,
      });
    });
    previousGrowth.current = next;
    growthQueue.current?.enqueue(pops);
  }, [run.jokers, run.lifecycleGrowthEvents, animatedGrowthEvents]);
  useEffect(() => () => growthQueue.current?.dispose(), []);
  useEffect(() => {
    if (bonusJokerTriggers.length > 0) audio.play('jokerEffect');
  }, [bonusJokerTriggers]);
  // A-3: pair every object action with a brief on-object animation before it resolves
  // — pop/dissolve when consumed, slide-away when sold — so it never looks like nothing
  // happened. The state change is delayed one beat so the animation is seen.
  const [leaving, setLeaving] = useState<{ zone: 'consumable' | 'joker'; index: number; mode: 'use' | 'sell' } | null>(null);
  // Objects added while this shelf is mounted pop into their slot once. Initial
  // shelf contents and screen remounts stay quiet; this is acquisition feedback,
  // not a generic entrance animation.
  const previousCounts = useRef({ jokers: run.jokers.length, consumables: run.consumables.length });
  const previousJokerEditions = useRef(
    run.jokers.map((joker) => ({ defId: joker.defId, edition: joker.edition ?? 'base' })),
  );
  const [arriving, setArriving] = useState<{ zone: 'joker' | 'consumable'; from: number } | null>(null);
  useEffect(() => {
    const prev = previousCounts.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (run.jokers.length > prev.jokers) {
      setArriving({ zone: 'joker', from: prev.jokers });
      timer = setTimeout(() => setArriving(null), 520);
    } else if (run.consumables.length > prev.consumables) {
      setArriving({ zone: 'consumable', from: prev.consumables });
      timer = setTimeout(() => setArriving(null), 520);
    }
    previousCounts.current = { jokers: run.jokers.length, consumables: run.consumables.length };
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [run.jokers.length, run.consumables.length]);
  useEffect(() => {
    const transformedToRainbow = run.jokers.some((joker, index) => {
      const previous = previousJokerEditions.current[index];
      return previous?.defId === joker.defId
        && previous.edition !== 'rainbow'
        && (joker.edition ?? 'base') === 'rainbow';
    });
    previousJokerEditions.current = run.jokers.map((joker) => ({
      defId: joker.defId,
      edition: joker.edition ?? 'base',
    }));
    if (transformedToRainbow) audio.play('rainbowShimmer');
  }, [run.jokers]);
  const beginLeave = (
    zone: 'consumable' | 'joker',
    index: number,
    mode: 'use' | 'sell',
    apply: () => void,
  ) => {
    if (motionOff()) { apply(); return; }
    setLeaving({ zone, index, mode });
    window.setTimeout(() => { apply(); setLeaving(null); }, 260);
  };
  // feature-04 D: spring-physics reorder for the Emoji-Tile shelf (same feel as the
  // hand), replacing native DnD. Commits reorderJoker(from, to) once on drop.
  const jokersRef = useRef<HTMLDivElement>(null);
  const consumablesRef = useRef<HTMLDivElement>(null);
  useShelfDrag(jokersRef, !!onReorderJoker, {
    reorder: (from, to) => onReorderJoker?.(from, to),
    playGrab: () => audio.play('tilePick'),
    playDrop: () => audio.play('dragSnap'),
  });
  return (
    <div className="shelf">
      {/* The count sits OUTSIDE the group box, directly beneath it, so the box's
          height is the joker tile's alone (playtest-06 #1–2). */}
      <div className="shelf-col jokers-col">
        <div className="shelf-group jokers-group">
          <div
            className={`jokers${run.jokers.length > 5 ? ' jokers-overlap' : ''}`}
            ref={jokersRef}
          >
          {run.jokers.map((owned, i) => {
            const def = JOKER_REGISTRY.get(owned.defId);
            if (!def) return null;
            const name = lang === 'ko' ? def.nameKo : def.nameEn;
            const art = jokerArt(def.id);
            const tip = jokerTooltip(def.id, owned.edition ?? 'base', t);
            const growthPop = growthPops.find((pop) =>
              pop.jokerId === def.id && (pop.jokerInstanceId !== undefined
                ? pop.jokerInstanceId === owned.instanceId
                : pop.index === i),
            );
            const visibleGrowthPop = settleComplete ? growthPop : undefined;
            const settleFiring = settle.active && settle.activeJokerId === def.id &&
              (settle.activeJokerInstanceId === null ||
                settle.activeJokerInstanceId === owned.instanceId);
            const bonusTrigger = bonusJokerTriggers.find(
              (trigger) => trigger.jokerIndex === i && trigger.jokerId === def.id,
            );
            const bonusPop = bonusTrigger
              ? {
                  id: `sentence-${bonusTrigger.jokerIndex}`,
                  chips: bonusTrigger.chipsDelta,
                  mult: 0,
                  multFactor: bonusTrigger.multFactor,
                  score: 0,
                  gold: 0,
                  stat: 0,
                  retrigger: false,
                }
              : null;
            const visiblePop: {
              id: string | number;
              chips: number;
              mult: number;
              chipsFactor?: number;
              multFactor?: number;
              score?: number;
              gold: number;
              stat: number;
              retrigger?: boolean;
            } | null = settleFiring
              ? settle.jokerPop
              : visibleGrowthPop ?? bonusPop;
            const firing = settleFiring || visibleGrowthPop !== undefined || bonusTrigger !== undefined;
            const enhancedFiring = settleFiring && settle.activeJokerEnhanced;
            const bossDisabled = visibleDisabledIndex === i;
            const className = [
              'joker',
              'emoji-tile-image-only',
              jokersFaceDown ? '' : `edition-${owned.edition ?? 'base'}`,
              jokersFaceDown ? 'face-down' : '',
              bossDisabled ? 'boss-disabled' : '',
              disabledEnteringIndex === i ? 'boss-disabled-entering' : '',
              firing ? 'firing' : '',
              enhancedFiring ? 'enhanced-firing' : '',
            ].filter(Boolean).join(' ');
            const jokerLeaving = leaving?.zone === 'joker' && leaving.index === i;
            return (
              <div
                key={i}
                data-joker-id={owned.defId}
                {...(owned.instanceId !== undefined
                  ? { 'data-joker-instance': owned.instanceId }
                  : {})}
                data-joker-index={i}
                className={[
                  'joker-slot',
                  jokerMenuIdx === i && 'menu-open',
                  jokerLeaving && 'leave-sell',
                  arriving?.zone === 'joker' && i >= arriving.from && 'slot-arriving',
                ].filter(Boolean).join(' ')}
                {...(onReorderJoker ? { 'data-drag-idx': i } : {})}
              >
                <Tooltip
                  title={jokersFaceDown ? t('boss.faceDownJoker') : name}
                  body={jokersFaceDown
                    ? t('boss.faceDownJokerDesc')
                    : tip.body}
                  {...(!jokersFaceDown
                    ? {
                        extra: grownValue(def, owned, t, pouchRemaining, run),
                        rarity: def.rarity,
                        tags: tip.tags,
                        sub: tip.sub,
                      }
                    : {})}
                  down
                  status={bossDisabled ? 'disabled' : undefined}
                >
                  <TiltCard
                    key={visiblePop?.id ?? 'idle'}
                    idle
                    className={className}
                  >
                    {onSellJoker && (
                      <button
                        type="button"
                        className="owned-object-select"
                        aria-label={jokersFaceDown ? t('boss.faceDownJoker') : name}
                        aria-haspopup="menu"
                        aria-expanded={jokerMenuIdx === i}
                        onClick={() => setJokerMenuIdx(jokerMenuIdx === i ? null : i)}
                      />
                    )}
                    {jokersFaceDown ? (
                      <img className="joker-art joker-back-mascot" src={mascotSrc('woodak')} alt="" />
                    ) : (
                      art && <img className="joker-art" src={art} alt="" />
                    )}
                    {onSellJoker && jokerMenuIdx === i && (
                      <div className="consumable-menu bare" role="menu">
                        <button
                          className="sell"
                          role="menuitem"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJokerMenuIdx(null);
                            beginLeave('joker', i, 'sell', () => onSellJoker(i));
                          }}
                        >
                          {t('shop.sell', {
                            value: formatScore(emojiTileSellValue(
                              run,
                              BALANCE.jokerPrice[def.rarity],
                              owned.edition ?? 'base',
                              owned.state.sellBonus ?? 0,
                            )),
                          })}
                        </button>
                      </div>
                    )}
                  </TiltCard>
                </Tooltip>
                {firing && visiblePop && (
                  <JokerPop
                    key={visiblePop.id}
                    chips={visiblePop.chips ?? 0}
                    {...(!visibleGrowthPop && visiblePop.chipsFactor !== undefined
                      ? { chipsFactor: visiblePop.chipsFactor }
                      : {})}
                    mult={visiblePop.mult ?? 0}
                    {...(!visibleGrowthPop && visiblePop.multFactor !== undefined
                      ? { multFactor: visiblePop.multFactor }
                      : {})}
                    score={visibleGrowthPop ? 0 : visiblePop.score ?? 0}
                    gold={visiblePop.gold ?? 0}
                    stat={visiblePop.stat ?? 0}
                    applied={
                      !visibleGrowthPop && visiblePop.retrigger
                        ? t('settle.retrigger')
                        : t('settle.applied')
                    }
                  />
                )}
              </div>
            );
          })}
          </div>
        </div>
        <div className="shelf-count left">
          {run.jokers.length}/{emojiSlotLimit}
        </div>
      </div>
      <div className="shelf-col consumables-col">
        <div className="shelf-group consumables-group">
          <div
            className="consumables"
            ref={consumablesRef}
            onPointerMove={(event) => {
              const rect = consumablesRef.current?.getBoundingClientRect();
              if (!rect || run.consumables.length === 0) return;
              const ratio = Math.max(0, Math.min(0.9999, (event.clientX - rect.left) / rect.width));
              setHoveredConsumableIdx(Math.floor(ratio * run.consumables.length));
            }}
            onPointerLeave={() => setHoveredConsumableIdx(null)}
          >
        {run.consumables.map((c, i) => (
          <div
            key={i}
            className={[
              'consumable-slot',
              menuIdx === i ? 'menu-open' : '',
              hoveredConsumableIdx === i ? 'hover-locked' : '',
              leaving?.zone === 'consumable' && leaving.index === i ? `leave-${leaving.mode}` : '',
              arriving?.zone === 'consumable' && i >= arriving.from ? 'slot-arriving' : '',
            ].filter(Boolean).join(' ')}
          >
            <Tooltip
              title={t(`consumable.${c}`)}
              body={consumableTooltipBody(c, t)}
              extra={consumableTooltipExtra(c, run, t)}
              classification={consumableClassification(c)}
              sub={consumableAxisTip(c, t) ?? undefined}
              down
            >
              <TiltCard
                idle
                className="consumable-object"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    // Stop here — otherwise RunView's window-level ESC handler
                    // also fires and opens the pause menu behind this one.
                    e.stopPropagation();
                    setMenuIdx(null);
                  }
                }}
              >
                <div className="consumable-object-art">
                  {isFableId(c) ? (
                    <CardArt family="fable"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : isConstellationId(c) ? (
                    <CardArt family="constellation"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : isGamblerId(c) ? (
                    <CardArt family="gambler"
                      id={c}
                      className="consumable-art"
                      title={t(`consumable.${c}`)}
                    />
                  ) : (
                    <UiIcon name={CONSUMABLE_ICON[c] ?? 'document'} className="object-ui-icon" />
                  )}
                </div>
                {menuIdx === i && (
                  // Keep actions inside TiltCard so pointer tilt transforms the
                  // card and buttons as one attached interaction object.
                  <div className="consumable-menu bare" role="menu">
                    <button
                      className="sell"
                      role="menuitem"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuIdx(null);
                        beginLeave('consumable', i, 'sell', () => onSellConsumable?.(i));
                      }}
                    >
                      {t('consumable.sellAction', {
                        value: formatScore(consumableSellValue(run, c)),
                      })}
                    </button>
                    {onUseConsumable && (
                      <button
                        className="use"
                        role="menuitem"
                        disabled={canUseConsumable ? !canUseConsumable(c) : false}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuIdx(null);
                          // Targeted Fables used against an open pack stay on the shelf
                          // until the pack-owned transformation animation commits them.
                          if (deferTargetFableUse && (
                            (isFableId(c) && fableTargetsTiles(c)) || isGamblerId(c)
                          )) {
                            onUseConsumable(c);
                          } else {
                            beginLeave('consumable', i, 'use', () => onUseConsumable(c));
                          }
                        }}
                      >
                        {t('consumable.useAction')}
                      </button>
                    )}
                  </div>
                )}
              </TiltCard>
              <button
                type="button"
                className="owned-object-select consumable-select"
                aria-label={t(`consumable.${c}`)}
                aria-haspopup="menu"
                aria-expanded={menuIdx === i}
                onClick={() => setMenuIdx(menuIdx === i ? null : i)}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  e.stopPropagation();
                  setMenuIdx(null);
                }}
              />
            </Tooltip>
          </div>
        ))}
          </div>
        </div>
        <div className="shelf-count right">
          {run.consumables.length}/{run.consumableSlots}
        </div>
      </div>
    </div>
  );
}
