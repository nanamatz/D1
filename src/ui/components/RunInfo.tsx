import { useState } from 'react';
import type { BlindKind, BlindState, LetterHandId, PatternId, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART, blindEmblem } from '../bossArt';
import { effectiveBlindTarget, effectiveClearReward } from '../../engine/economy';
import { formatScore } from '../formatScore';
import { kindForIndex } from '../../engine/progression';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { patternChipsMult } from '../../engine/patterns';
import {
  LETTER_HAND_REGISTRY,
  letterHandChipsMult,
  letterHandLevel,
  letterHandStampCost,
} from '../../engine/letterHands';
import { bossDescKey, voucherDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import { patternLevelClass } from '../patternLevel';
import { richText } from '../richtext';
import { Tooltip } from './Tooltip';
import { VoucherCard } from './VoucherCard';
import { voucherArt } from '../voucherArt';
import { PatternIcon, UiIcon } from './UiIcon';
import { isLetterHandDiscovered } from '../lifetime';

interface Props {
  run: RunState;
  blind: BlindState;
  discoveredLetterHands: ReadonlySet<LetterHandId>;
  onClose: () => void;
}

type Tab = 'patterns' | 'hands' | 'blind' | 'vouchers';

const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'patterns', label: 'runinfo.tabPatterns' },
  { id: 'hands', label: 'runinfo.tabHands' },
  { id: 'blind', label: 'runinfo.tabBlind' },
  { id: 'vouchers', label: 'runinfo.tabVouchers' },
];

const PATTERN_ORDER: PatternId[] = [
  'outcry',
  'simple',
  'imperative',
  'transitive',
  'negative',
  'interrogative',
  'descriptive',
  'chant',
  'objectComplement',
  'ditransitive',
  'compound',
  'complex',
];

/** Run Info overlay (spec §2.4): Pattern levels · Word Hands · Blinds · Vouchers. */
export function RunInfo({ run, blind, discoveredLetterHands, onClose }: Props) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>('patterns');

  return (
    <div className="overlay" role="dialog" aria-modal onClick={onClose}>
      <div className="overlay-card runinfo" onClick={(e) => e.stopPropagation()}>
        <div className="ov-head">
          <h3>{t('runinfo.title')}</h3>
          <button className="ov-close" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>
        {run.challengeId && (
          <div className="ri-challenge">
            {t('challenge.current', { name: t(`challenge.${run.challengeId}.name`) })}
          </div>
        )}

        <div className="ri-tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={['ri-tab', tab === id ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(id)}
            >
              {t(label)}
            </button>
          ))}
        </div>

        <div className="ri-body">
          {tab === 'patterns' && (
            <div className="ri-patterns">
              {PATTERN_ORDER.map((p) => {
                // feature-02 A-3: the Balatro-style hand list — live [Chips × Mult]
                // at the pattern's current level, updating as Constellation cards level it.
                const cm = patternChipsMult(p, run.patternLevels[p]);
                return (
                  <Tooltip key={p} title={t(`pattern.${p}`)} body={t(`patterndesc.${p}`)} down>
                    <div className={['ri-pat', patternLevelClass(run.patternLevels[p])].join(' ')}>
                      <span className="pl">Lv {run.patternLevels[p]}</span>
                      <PatternIcon pattern={p} />
                      <span className="pn">{t(`pattern.${p}`)}</span>
                      <span className="pcm">
                        <b className="chips">+{cm.chips}</b>
                        <span className="times">×</span>
                        <b className="mult">{cm.mult}</b>
                      </span>
                      <span className="ri-use-count">
                        {t('runinfo.timesUsed', { n: run.patternPlayCounts?.[p] ?? 0 })}
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {tab === 'hands' && (
            <div className="ri-hands">
              {LETTER_HAND_REGISTRY.map((hand) => {
                const level = letterHandLevel(run.letterHandLevels, hand.id);
                const bonus = letterHandChipsMult(hand.id, level);
                const stamps = run.letterHandStamps?.[hand.id] ?? 0;
                const discovered = isLetterHandDiscovered(hand.id, discoveredLetterHands);
                return (
                  <Tooltip
                    key={hand.id}
                    title={discovered ? t(`letterhand.${hand.id}`) : '???'}
                    body={discovered ? t(`letterhand.${hand.id}.desc`) : '???'}
                    down
                  >
                    <div className={['ri-hand', patternLevelClass(level)].join(' ')}>
                      <span className="ri-hand-rank">{hand.rank}</span>
                      <span className="ri-hand-copy">
                        <strong>{discovered ? t(`letterhand.${hand.id}`) : '???'}</strong>
                      </span>
                      <span className="ri-hand-score pcm">
                        <b className="chips">+{bonus.chips}</b>
                        {bonus.mult > 0 && (
                          <>
                            <span className="times">×</span>
                            <b className="mult">{bonus.mult}</b>
                          </>
                        )}
                      </span>
                      <span className="ri-hand-level">
                        <b>Lv {level}</b>
                        <small>{t('runinfo.wordHandStamps', { n: stamps, cost: letterHandStampCost(level) })}</small>
                      </span>
                      <span className="ri-use-count">
                        {t('runinfo.timesUsed', { n: run.letterHandPlayCounts?.[hand.id] ?? 0 })}
                      </span>
                    </div>
                  </Tooltip>
                );
              })}
            </div>
          )}

          {tab === 'blind' && (
            <div className="bs-cards ri-blinds">
              {([0, 1, 2] as const).map((i) => {
                const kind: BlindKind = kindForIndex(i);
                const status = i < run.blindIndex
                  ? run.skippedThisChapter.includes(i as 0 | 1) ? 'skipped' : 'defeated'
                  : i === run.blindIndex ? 'current' : 'upcoming';
                const bossId = kind === 'boss' ? (blind.bossId ?? run.chapterBossId) : null;
                const boss = bossId ? BOSS_REGISTRY.get(bossId) : undefined;
                const target = effectiveBlindTarget(run, kind, boss?.targetMult ?? 1);
                const reward = effectiveClearReward(run, kind, bossId, status === 'current');
                return (
                  <div key={i} className={['bs-card', kind, status].join(' ')}>
                    <div className="bs-kind">{t(`blind.${kind}`)}</div>
                    {kind !== 'boss' && blindEmblem(kind, null) && (
                      <img className="bs-kind-art" src={blindEmblem(kind, null)!} alt="" />
                    )}
                    {kind === 'boss' && boss && (
                      <div className="bs-boss">
                        <img className="bs-boss-art" src={BOSS_ART[boss.id]} alt="" />
                        <span className="bn">{lang === 'ko' ? boss.nameKo : boss.nameEn}</span>
                        <span className="be">{richText(t(bossDescKey(boss.id)))}</span>
                      </div>
                    )}
                    {status === 'skipped' && (
                      <span className="bs-skipped-stamp" aria-hidden>
                        {t('blindselect.skipped')}
                      </span>
                    )}
                    <div className="bs-target">
                      <span className="label">{t('sidebar.target')}</span>
                      <span className="n">{formatScore(target)}</span>
                    </div>
                    <div className="bs-reward">
                      <span className="label">{t('blindselect.reward')}</span>
                      <span className="r"><UiIcon name="coin" className="inline-ui-icon" /> <b>${reward}</b></span>
                    </div>
                    <div className={['bs-status', status].join(' ')}>{t(`blindselect.${status}`)}</div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'vouchers' &&
            (run.vouchers.length === 0 ? (
              <p className="coll-empty">{t('runinfo.noVouchers')}</p>
            ) : (
              <div className="ri-vouchers">
                {run.vouchers.map((id) => {
                  const v = VOUCHER_REGISTRY.get(id);
                  if (!v) return null;
                  const name = lang === 'ko' ? v.nameKo : v.nameEn;
                  return (
                    <Tooltip key={id} title={name} body={t(voucherDescKey(id))} classification="voucher" down>
                      <VoucherCard name={name} artSrc={voucherArt(v.id)} />
                    </Tooltip>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
