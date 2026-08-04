import { effectiveBlindTarget, effectiveClearReward } from '../../engine/economy';
import { kindForIndex } from '../../engine/progression';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART, blindEmblem } from '../bossArt';
import { bossDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { bossRerollLimit, bossRerollPrice } from '../../engine/vouchers';
import { useEffect, useState } from 'react';
import { formatScore } from '../formatScore';
import { richText } from '../richtext';
import { SKIP_REWARD_ART } from '../skipRewardArt';
import { skipRewardParams } from '../skipRewardTooltip';
import { Tooltip } from './Tooltip';
import { TiltCard } from './TiltCard';
import { isImmediateSkipReward, isNextShopSkipReward } from '../../engine/skipRewards';
import type { SkipRewardOffer } from '../../engine/types';
import { motionOff } from '../motion';
import { UiIcon } from './UiIcon';
import { audio } from '../audio';

type Status = 'defeated' | 'skipped' | 'current' | 'upcoming';
type DisplaySkipTag = {
  key: string;
  offer: SkipRewardOffer;
  redeeming: boolean;
  shopRedemption: boolean;
};

/**
 * Blind Select (spec §2.3): the three blinds of the current ante with targets
 * and reward previews. Draft and Revision may instead be skipped for their
 * pre-rolled, fully disclosed Editorial Perk (GDD §8.2).
 */
export function BlindSelect({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, blind } = g.state;
  const [leaving, setLeaving] = useState(false);
  const [autoRedeeming, setAutoRedeeming] = useState<SkipRewardOffer | null>(null);
  const busy = leaving || autoRedeeming !== null;
  const leave = (action: () => void) => {
    if (motionOff()) { action(); return; }
    setLeaving(true);
    window.setTimeout(action, 360);
  };

  return (
    <div className={['blindselect', leaving && 'phase-panel-leaving'].filter(Boolean).join(' ')}>
      <div className="bs-head">
        <span className="label">{t('blindselect.title')}</span>
        <span className="ante">{t('sidebar.ante', { n: run.ante })}</span>
      </div>

      <div className="bs-cards">
        {([0, 1, 2] as const).map((i) => {
          const kind = kindForIndex(i);
          const status: Status =
            i < run.blindIndex
              ? run.skippedThisChapter.includes(i as 0 | 1) ? 'skipped' : 'defeated'
              : i === run.blindIndex ? 'current' : 'upcoming';
          // D-6: the chapter's Deadline boss is drawn up front, so its effect is
          // ALWAYS shown — no hiding — even before you reach it.
          const bossId = kind === 'boss' ? (blind.bossId ?? run.chapterBossId) : null;
          const boss = bossId ? BOSS_REGISTRY.get(bossId) : undefined;
          const target = effectiveBlindTarget(run, kind, boss?.targetMult ?? 1);
          const reward = effectiveClearReward(run, kind, bossId, status === 'current');
          const skipOffer = kind === 'boss' ? null : run.skipOffers[i as 0 | 1];
          const patternName = skipOffer?.pattern ? t(`pattern.${skipOffer.pattern}`) : '';
          const params = skipOffer ? skipRewardParams(skipOffer, run, patternName) : {};
          const tagDisabled = status === 'skipped' || busy;
          const claiming = status === 'current' && autoRedeeming !== null;

          return (
            <div key={i} className={['bs-card', kind, status, claiming && 'auto-redeeming'].filter(Boolean).join(' ')}>
              {status === 'current' ? (
                <TiltCard className="bs-control-tilt bs-select-tilt" tilt={!busy}>
                  <button
                    className="btn gold bs-select"
                    onClick={() => {
                      if (busy) return;
                      leave(g.selectBlind);
                    }}
                    disabled={busy}
                    autoFocus
                  >
                    {t('blindselect.select')}
                  </button>
                </TiltCard>
              ) : (
                <div className={['bs-status', status].join(' ')}>
                  {t(`blindselect.${status}`)}
                </div>
              )}
              <div className="bs-kind">{t(`blind.${kind}`)}</div>
              {kind !== 'boss' && blindEmblem(kind, null) && (
                <img className="bs-kind-art" src={blindEmblem(kind, null)} alt="" />
              )}
              {kind === 'boss' && boss && (
                <div className="bs-boss">
                  <img className="bs-boss-art" src={BOSS_ART[boss.id]} alt="" />
                  <span className="bn">{lang === 'ko' ? boss.nameKo : boss.nameEn}</span>
                  <span className="be">{richText(t(bossDescKey(boss.id)))}</span>
                </div>
              )}
              {(status === 'skipped' || claiming) && (
                <span className="bs-skipped-stamp" aria-hidden>{t('blindselect.skipped')}</span>
              )}
              <div className="bs-target">
                <span className="label">{t('sidebar.target')}</span>
                <span className="n">{formatScore(target)}</span>
              </div>
              <div className="bs-reward">
                <span className="label">{t('blindselect.reward')}</span>
                <span className="r">
                  <UiIcon name="coin" className="inline-ui-icon" /> <b>${reward}</b>
                </span>
              </div>
              {skipOffer && (
                <div className="bs-skip-zone">
                  <span className="bs-or">{t('blindselect.or')}</span>
                  <div className="bs-skip-row">
                    <Tooltip
                      down
                      title={t(`skipReward.${skipOffer.id}.name`)}
                      body={t(`skipReward.${skipOffer.id}.desc`, params)}
                      disabled={tagDisabled}
                    >
                      <TiltCard
                        idle={!tagDisabled}
                        tilt={!tagDisabled}
                        className="bs-tag-icon"
                        tabIndex={tagDisabled ? -1 : 0}
                        role="img"
                        aria-disabled={tagDisabled || undefined}
                        aria-label={`${t('blindselect.editorialPerk')}: ${t(`skipReward.${skipOffer.id}.name`)}`}
                      >
                        <img src={SKIP_REWARD_ART[skipOffer.id]} alt="" />
                      </TiltCard>
                    </Tooltip>
                    <TiltCard
                      className="bs-control-tilt bs-skip-tilt"
                      tilt={status === 'current' && !busy}
                    >
                      <button
                        className="btn red bs-skip"
                        disabled={status !== 'current' || busy}
                        onClick={() => {
                          if (busy) return;
                          audio.play('tagSpawn');
                          if (isImmediateSkipReward(skipOffer.id) && !motionOff()) {
                            setAutoRedeeming(skipOffer);
                            return;
                          }
                          leave(g.skipBlind);
                        }}
                      >
                        {t('blindselect.skip')}
                      </button>
                    </TiltCard>
                  </div>
                </div>
              )}
              {kind === 'boss' &&
                status === 'current' &&
                bossRerollLimit(run) > run.bossRerollsUsed && (
                <button
                  className="btn green sm bs-boss-reroll"
                  disabled={run.gold < bossRerollPrice()}
                  onClick={g.rerollBoss}
                >
                  {t('blindselect.rerollBoss', { cost: bossRerollPrice() })}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {autoRedeeming && (
        <div
          className="skip-tag-auto-redeem"
          role="status"
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget || event.animationName !== 'skip-tag-auto-redeem') return;
            setAutoRedeeming(null);
            leave(g.skipBlind);
          }}
        >
          <img src={SKIP_REWARD_ART[autoRedeeming.id]} alt="" />
          <span className="skip-tag-auto-name">{t(`skipReward.${autoRedeeming.id}.name`)}</span>
          <span className="skip-tag-auto-label">{t('blindselect.tagAutoActivated')}</span>
        </div>
      )}
    </div>
  );
}

/** Only the uninterrupted skip chain feeding the current blind is waiting to redeem. */
export function pendingSkippedTagIndices(
  blindIndex: 0 | 1 | 2,
  skipped: readonly (0 | 1)[],
): (0 | 1)[] {
  const pending: (0 | 1)[] = [];
  for (let index = blindIndex - 1; index >= 0; index -= 1) {
    const skippedIndex = index as 0 | 1;
    if (!skipped.includes(skippedIndex)) break;
    pending.unshift(skippedIndex);
  }
  return pending;
}

/** Tags stay visible until their own next-blind or next-shop resolution point. */
export function SkippedTagStack({ g }: { g: UseGame }) {
  const { t } = useI18n();
  const { run, phase, pack, pendingBlindAfterPack, shopTagRedemptions } = g.state;
  const showNextBlindTags = phase === 'blindselect' || phase === 'playing' || pendingBlindAfterPack;
  const redeemingNextBlind = phase === 'playing';
  const redeemingShop = phase === 'shop' && pack === null;
  useEffect(() => {
    if (redeemingShop && shopTagRedemptions.length > 0 && motionOff()) {
      g.clearShopTagRedemptions();
    }
  }, [g, redeemingShop, shopTagRedemptions]);
  const nextBlindTags: DisplaySkipTag[] = showNextBlindTags
    ? pendingSkippedTagIndices(run.blindIndex, run.skippedThisChapter)
      .map((blindIndex) => ({ blindIndex, offer: run.skipOffers[blindIndex] }))
      .filter(({ offer }) => !isImmediateSkipReward(offer.id) && !isNextShopSkipReward(offer.id))
      .map(({ blindIndex, offer }) => ({
        key: `blind-${blindIndex}`,
        offer,
        redeeming: redeemingNextBlind,
        shopRedemption: false,
      }))
    : [];
  const waitingShopTags: DisplaySkipTag[] = run.pendingShopTags.map((id, index) => ({
    key: `shop-waiting-${id}-${index}`,
    offer: { id },
    redeeming: false,
    shopRedemption: false,
  }));
  const appliedShopTags: DisplaySkipTag[] = redeemingShop
    ? shopTagRedemptions.map((id, index) => ({
      key: `shop-redeeming-${id}-${index}`,
      offer: { id },
      redeeming: true,
      shopRedemption: true,
    }))
    : [];
  const tags = [...waitingShopTags, ...nextBlindTags, ...appliedShopTags].slice(-2);
  const lastShopRedemptionKey = [...tags].reverse().find((tag) => tag.shopRedemption)?.key;
  const redeeming = tags.some((tag) => tag.redeeming);
  if (tags.length === 0) return null;

  return (
    <div className="run-tag-stack">
      {tags.map(({ key, offer, redeeming: tagRedeeming, shopRedemption }) => {
        const patternName = offer.pattern ? t(`pattern.${offer.pattern}`) : '';
        return (
          <Tooltip
            key={key}
            title={t(`skipReward.${offer.id}.name`)}
            body={t(`skipReward.${offer.id}.desc`, skipRewardParams(offer, run, patternName))}
            disabled={tagRedeeming}
          >
            <TiltCard
              idle={!tagRedeeming}
              tilt={!tagRedeeming}
              className={['bs-tag-icon', 'run-tag-icon', tagRedeeming && 'tag-redeeming'].filter(Boolean).join(' ')}
              tabIndex={tagRedeeming ? -1 : 0}
              role="img"
              aria-label={`${t('blindselect.editorialPerk')}: ${t(`skipReward.${offer.id}.name`)}`}
              onAnimationEnd={shopRedemption && key === lastShopRedemptionKey
                ? (event) => {
                  if (event.animationName === 'run-tag-redeem') g.clearShopTagRedemptions();
                }
                : undefined}
            >
              <img src={SKIP_REWARD_ART[offer.id]} alt="" />
            </TiltCard>
          </Tooltip>
        );
      })}
      {redeeming && (
        <span className="run-tag-redeem-label" role="status">
          {t(redeemingShop ? 'blindselect.shopTagApplied' : 'blindselect.tagApplied')}
        </span>
      )}
    </div>
  );
}
