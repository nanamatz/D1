import { blindTarget, clearReward } from '../../engine/economy';
import { kindForIndex } from '../../engine/progression';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { bossDescKey } from '../descriptions';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';

type Status = 'defeated' | 'current' | 'upcoming';

/**
 * Blind Select (spec §2.3): the three blinds of the current ante with targets
 * and reward previews; the current one is playable. Skip/tags are deferred by
 * design (GDD §8.2) — no skip button.
 */
export function BlindSelect({ g }: { g: UseGame }) {
  const { t, lang } = useI18n();
  const { run, blind } = g.state;

  return (
    <div className="screen blindselect">
      <div className="bs-head">
        <span className="label">{t('blindselect.title')}</span>
        <span className="ante">{t('sidebar.ante', { n: run.ante })}</span>
      </div>

      <div className="bs-cards">
        {([0, 1, 2] as const).map((i) => {
          const kind = kindForIndex(i);
          const status: Status =
            i < run.blindIndex ? 'defeated' : i === run.blindIndex ? 'current' : 'upcoming';
          const target = blindTarget(run.ante, kind);
          const reward = clearReward(kind);
          // D-6: the chapter's Deadline boss is drawn up front, so its effect is
          // ALWAYS shown — no hiding — even before you reach it.
          const bossId = kind === 'boss' ? (blind.bossId ?? run.chapterBossId) : null;
          const boss = bossId ? BOSS_REGISTRY.get(bossId) : undefined;

          return (
            <div key={i} className={['bs-card', kind, status].join(' ')}>
              <div className="bs-kind">{t(`blind.${kind}`)}</div>
              {kind === 'boss' && boss && (
                <div className="bs-boss">
                  <span className="e">{boss.emoji}</span>
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
                <span className="r">
                  🪙 <b>${reward}</b>
                </span>
              </div>
              {status === 'current' ? (
                <button className="btn play bs-select" onClick={g.selectBlind} autoFocus>
                  {t('blindselect.select')}
                </button>
              ) : (
                <div className={['bs-status', status].join(' ')}>
                  {t(`blindselect.${status}`)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
