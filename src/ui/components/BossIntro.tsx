import { useEffect, useState } from 'react';
import type { BlindState, RunState } from '../../engine/types';
import { BOSS_REGISTRY } from '../../engine/bosses';
import { BOSS_ART } from '../bossArt';
import { useI18n } from '../i18n';
import { richText } from '../richtext';
import { bossDescription } from '../descriptions';
import { useEntering } from './ScreenTransition';

const BOSS_ENTER_MS = 520;
const BOSS_HOLD_MS = 1000;
const BOSS_EXIT_MS = 420;

/** Brief, non-blocking Deadline reveal. Starts after the screen transition lands. */
export function BossIntro({ blind, run }: { blind: BlindState; run: RunState }) {
  const { t, lang } = useI18n();
  const entering = useEntering();
  const [state, setState] = useState<'waiting' | 'visible' | 'exiting' | 'done'>('waiting');
  const boss = blind.bossId ? BOSS_REGISTRY.get(blind.bossId) : undefined;

  useEffect(() => {
    if (!boss || entering || state !== 'waiting') return;
    setState('visible');
    // Entrance lands, the completed card holds for 1s, then fades. `state`
    // deliberately stays out of this effect's dependencies: including it made
    // the visible-state rerender clear both timers and strand the modal onscreen.
    const exitAt = BOSS_ENTER_MS + BOSS_HOLD_MS;
    const exit = window.setTimeout(() => setState('exiting'), exitAt);
    const remove = window.setTimeout(() => setState('done'), exitAt + BOSS_EXIT_MS);
    return () => {
      window.clearTimeout(exit);
      window.clearTimeout(remove);
    };
  }, [boss, entering]);

  if (!boss || state === 'waiting' || state === 'done') return null;
  return (
    <div className={['boss-intro', state].join(' ')} aria-live="polite">
      <div className="boss-intro-card">
        <img className="boss-intro-art" src={BOSS_ART[boss.id]} alt="" />
        <div className="boss-intro-copy">
          <div className="boss-intro-kicker">{t('blind.boss')}</div>
          <div className="boss-intro-name">{lang === 'ko' ? boss.nameKo : boss.nameEn}</div>
          <div className="boss-intro-effect">{richText(bossDescription(
            boss.id,
            t,
            run,
            blind.deadLetter ?? '—',
          ))}</div>
        </div>
      </div>
    </div>
  );
}
