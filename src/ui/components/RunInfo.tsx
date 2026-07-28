import { useState } from 'react';
import type { BlindKind, BlindState, PatternId, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART, blindEmblem } from '../bossArt';
import { blindTarget, clearReward } from '../../engine/economy';
import { kindForIndex } from '../../engine/progression';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { patternChipsMult } from '../../engine/patterns';
import { bossDescKey, voucherDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import { Tooltip } from './Tooltip';
import { VoucherCard } from './VoucherCard';
import { voucherArt } from '../voucherArt';

interface Props {
  run: RunState;
  blind: BlindState;
  onClose: () => void;
}

type Tab = 'patterns' | 'blind' | 'vouchers';

const PATTERN_ORDER: PatternId[] = [
  'outcry',
  'imperative',
  'chant',
  'simple',
  'descriptive',
  'transitive',
  'ditransitive',
  'compound',
  'objectComplement',
  'interrogative',
  'negative',
  'complex',
];

/** Run Info overlay (spec §2.4) — three tabs (feedback): 1 Pattern levels · 2 Blinds
 *  (blind-select layout) · 3 Vouchers. */
export function RunInfo({ run, blind, onClose }: Props) {
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

        <div className="ri-tabs" role="tablist">
          {(['patterns', 'blind', 'vouchers'] as Tab[]).map((tb) => (
            <button
              key={tb}
              role="tab"
              aria-selected={tab === tb}
              className={['ri-tab', tab === tb ? 'active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(tb)}
            >
              {t(`runinfo.tab${tb === 'patterns' ? 'Patterns' : tb === 'blind' ? 'Blind' : 'Vouchers'}`)}
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
                    <div className="ri-pat">
                      <span className="pn">{t(`pattern.${p}`)}</span>
                      <span className="pl">Lv {run.patternLevels[p]}</span>
                      <span className="pcm">
                        <b className="chips">{cm.chips}</b>
                        <span className="times">×</span>
                        <b className="mult">{cm.mult}</b>
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
                const status = i < run.blindIndex ? 'defeated' : i === run.blindIndex ? 'current' : 'upcoming';
                const target = blindTarget(run.ante, kind);
                const reward = clearReward(kind);
                const bossId = kind === 'boss' ? (blind.bossId ?? run.chapterBossId) : null;
                const boss = bossId ? BOSS_REGISTRY.get(bossId) : undefined;
                return (
                  <div key={i} className={['bs-card', kind, status].join(' ')}>
                    <div className="bs-kind">{t(`blind.${kind}`)}</div>
                    {kind !== 'boss' && blindEmblem(kind, null) && (
                      <img className="bs-kind-art" src={blindEmblem(kind, null)!} alt="" />
                    )}
                    {kind === 'boss' && boss && (
                      <div className="bs-boss">
                        {BOSS_ART[boss.id] ? (
                          <img className="bs-boss-art" src={BOSS_ART[boss.id]} alt="" />
                        ) : (
                          <span className="e">{boss.emoji}</span>
                        )}
                        <span className="bn">{lang === 'ko' ? boss.nameKo : boss.nameEn}</span>
                        <span className="be">{t(bossDescKey(boss.id))}</span>
                      </div>
                    )}
                    <div className="bs-target">
                      <span className="label">{t('sidebar.target')}</span>
                      <span className="n">{target}</span>
                    </div>
                    <div className="bs-reward">
                      <span className="label">{t('blindselect.reward')}</span>
                      <span className="r">🪙 <b>${reward}</b></span>
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
                      <VoucherCard emoji={v.emoji} name={name} artSrc={voucherArt(v.id)} />
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
