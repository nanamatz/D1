import { effectiveBlindTarget, effectiveClearReward } from '../../engine/economy';
import { kindForIndex } from '../../engine/progression';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART, blindEmblem } from '../bossArt';
import { bossDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { bossRerollLimit, bossRerollPrice } from '../../engine/vouchers';
import { useState } from 'react';
import { formatScore } from '../formatScore';
import { richText } from '../richtext';
import { SKIP_REWARD_ART } from '../skipRewardArt';
import { skipRewardParams } from '../skipRewardTooltip';
import { Tooltip } from './Tooltip';
import { TiltCard } from './TiltCard';

type Status = 'defeated' | 'skipped' | 'current' | 'upcoming';

/**
 * Blind Select (spec §2.3): the three blinds of the current ante with targets
 * and reward previews. Draft and Revision may instead be skipped for their
 * pre-rolled, fully disclosed Editorial Perk (GDD §8.2).
 */
export function BlindSelect({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, blind } = g.state;
  const [leaving, setLeaving] = useState(false);

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

          return (
            <div key={i} className={['bs-card', kind, status].join(' ')}>
              {status === 'current' ? (
                <TiltCard className="bs-control-tilt bs-select-tilt" tilt={!leaving}>
                  <button
                    className="btn gold bs-select"
                    onClick={() => {
                      if (leaving) return;
                      setLeaving(true);
                      window.setTimeout(g.selectBlind, 360);
                    }}
                    disabled={leaving}
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
                  {BOSS_ART[boss.id] ? (
                    <img className="bs-boss-art" src={BOSS_ART[boss.id]} alt="" />
                  ) : (
                    <span className="e">{boss.emoji}</span>
                  )}
                  <span className="bn">{lang === 'ko' ? boss.nameKo : boss.nameEn}</span>
                  <span className="be">{richText(t(bossDescKey(boss.id)))}</span>
                </div>
              )}
              {status === 'skipped' && (
                <span className="bs-skipped-stamp" aria-hidden>{t('blindselect.skipped')}</span>
              )}
              <div className="bs-target">
                <span className="label">{t('sidebar.target')}</span>
                <span className="n">{formatScore(target)}</span>
              </div>
              <div className="bs-reward">
                <span className="label">{t('blindselect.reward')}</span>
                <span className="r">
                  🪙 <b>${reward}</b>
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
                    >
                      <TiltCard
                        idle
                        className="bs-tag-icon"
                        tabIndex={0}
                        role="img"
                        aria-label={`${t('blindselect.editorialPerk')}: ${t(`skipReward.${skipOffer.id}.name`)}`}
                      >
                        <img src={SKIP_REWARD_ART[skipOffer.id]} alt="" />
                      </TiltCard>
                    </Tooltip>
                    <TiltCard
                      className="bs-control-tilt bs-skip-tilt"
                      tilt={status === 'current' && !leaving}
                    >
                      <button
                        className="btn red bs-skip"
                        disabled={status !== 'current' || leaving}
                        onClick={() => {
                          if (leaving) return;
                          setLeaving(true);
                          window.setTimeout(g.skipBlind, 360);
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
    </div>
  );
}
