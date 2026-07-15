import type { BlindState, PatternId, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { VOUCHER_REGISTRY } from '../../engine/vouchers';
import { bossDescKey } from '../descriptions';
import { useI18n } from '../i18n';

interface Props {
  run: RunState;
  blind: BlindState;
  onClose: () => void;
}

const PATTERN_ORDER: PatternId[] = [
  'outcry',
  'imperative',
  'chant',
  'simple',
  'descriptive',
  'transitive',
  'ditransitive',
  'compound',
];

/** Run Info overlay (spec §2.4): blind/ante, boss, pattern levels, vouchers. */
export function RunInfo({ run, blind, onClose }: Props) {
  const { t, lang } = useI18n();
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;

  return (
    <div className="overlay" role="dialog" aria-modal onClick={onClose}>
      <div className="overlay-card runinfo" onClick={(e) => e.stopPropagation()}>
        <div className="ov-head">
          <h3>{t('runinfo.title')}</h3>
          <button className="ov-close" onClick={onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </div>

        <div className="ri-body">
          <div className="ri-row">
            <span className="k">{t('runinfo.blind')}</span>
            <span className="v">
              {t(`blind.${blind.kind}`)} · {t('sidebar.ante', { n: run.ante })}
            </span>
          </div>
          {boss && (
            <div className="ri-row">
              <span className="k">{t('runinfo.boss')}</span>
              <span className="v">
                {boss.emoji} {lang === 'ko' ? boss.nameKo : boss.nameEn} — {t(bossDescKey(boss.id))}
              </span>
            </div>
          )}

          <div className="label ri-sub">{t('runinfo.patterns')}</div>
          <div className="ri-patterns">
            {PATTERN_ORDER.map((p) => (
              <div key={p} className="ri-pat">
                <span className="pn">{t(`pattern.${p}`)}</span>
                <span className="pl">Lv {run.patternLevels[p]}</span>
              </div>
            ))}
          </div>

          <div className="label ri-sub">{t('runinfo.vouchers')}</div>
          {run.vouchers.length === 0 ? (
            <p className="coll-empty">{t('runinfo.noVouchers')}</p>
          ) : (
            <div className="ri-vouchers">
              {run.vouchers.map((id) => {
                const v = VOUCHER_REGISTRY.get(id);
                if (!v) return null;
                return (
                  <span key={id} className="ri-voucher" title={lang === 'ko' ? v.nameKo : v.nameEn}>
                    {v.emoji} {lang === 'ko' ? v.nameKo : v.nameEn}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
