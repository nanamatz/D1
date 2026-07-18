import { useState } from 'react';
import { BOSS_REGISTRY } from '../../engine/bosses';
import type { PatternId } from '../../engine/types';
import { useI18n } from '../i18n';
import type { UseGame } from '../useGame';
import { WooDakMascot } from './WooDakMascot';

/** The most-frequent finalized sentence pattern this run, with its count. */
function topPattern(counts: Partial<Record<PatternId, number>>): { id: PatternId; n: number } | null {
  let best: { id: PatternId; n: number } | null = null;
  for (const [id, n] of Object.entries(counts) as [PatternId, number][]) {
    if (!best || n > best.n) best = { id, n };
  }
  return best;
}

interface Props {
  g: UseGame;
  /** New Run flow (returns to the New Run screen). Defaults to an instant restart. */
  onNewRun?: () => void;
  /** Back to the main menu. Hidden when no shell is present. */
  onMainMenu?: () => void;
}

/** Game Over — run summary + stats (spec §2.7). */
export function GameOver({ g, onNewRun, onMainMenu }: Props) {
  const { t, lang } = useI18n();
  const { gameover, stats, seed } = g.state;
  const [copied, setCopied] = useState(false);
  if (!gameover) return null;

  const boss = gameover.bossId ? BOSS_REGISTRY.get(gameover.bossId) : undefined;
  const top = topPattern(stats.patternCounts);
  const bestWord = stats.bestWord;
  const won = gameover.won;

  const copySeed = () => {
    navigator.clipboard?.writeText(seed).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => setCopied(false),
    );
  };

  return (
    <div className="overlay gameover-overlay">
      <WooDakMascot stats={stats} won={won} />
      <div className={['overlay-card', 'gameover', won ? 'go-won' : ''].filter(Boolean).join(' ')} role="dialog" aria-modal>
      <div className="go-title">{t(won ? 'gameover.wonTitle' : 'gameover.title')}</div>

      <div className="panel go-defeat">
        <span className="label">{t(won ? 'gameover.wonBy' : 'gameover.defeatedBy')}</span>
        <div className="go-defeat-row">
          {boss ? (
            <span className="go-boss">
              {boss.emoji} {lang === 'ko' ? boss.nameKo : boss.nameEn}
            </span>
          ) : (
            <span className="go-boss">{t(`blind.${gameover.blindKind}`)}</span>
          )}
          <span className="go-reach">
            {won
              ? t('gameover.wonReached', { ante: gameover.ante })
              : t('gameover.reached', { ante: gameover.ante, blind: t(`blind.${gameover.blindKind}`) })}
          </span>
        </div>
        <div className="go-score">
          {t('gameover.score', { score: gameover.finalScore, target: gameover.target })}
        </div>
      </div>

      <div className="panel go-stats">
        <div className="go-stat wide">
          <span className="k">{t('gameover.bestWord')}</span>
          <span className="v">
            {bestWord ? (
              <>
                <b>{bestWord.text.toUpperCase()}</b> · {bestWord.score}
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className="go-stat wide">
          <span className="k">{t('gameover.topPattern')}</span>
          <span className="v">
            {top ? `${t(`pattern.${top.id}`)} (${top.n})` : '—'}
          </span>
        </div>
        <div className="go-stat">
          <span className="k">{t('gameover.wordsPlayed')}</span>
          <span className="v">{stats.wordsPlayed}</span>
        </div>
        <div className="go-stat">
          <span className="k">{t('gameover.tilesDiscarded')}</span>
          <span className="v">{stats.tilesDiscarded}</span>
        </div>
        <div className="go-stat">
          <span className="k">{t('gameover.itemsBought')}</span>
          <span className="v">{stats.itemsBought}</span>
        </div>
        <div className="go-stat">
          <span className="k">{t('gameover.rerollsUsed')}</span>
          <span className="v">{stats.rerollsUsed}</span>
        </div>
        <div className="go-stat wide discovery">
          <span className="k">{t('gameover.discoveries')}</span>
          <span className="v">{stats.discoveries}</span>
        </div>
      </div>

      <div className="panel go-seed">
        <span className="label">{t('gameover.seed')}</span>
        <code className="seed-code">{seed}</code>
        <button className="btn exchange sm" onClick={copySeed}>
          {copied ? t('gameover.copied') : t('gameover.copy')}
        </button>
      </div>

      <div className="go-actions">
        <button className="btn play" onClick={onNewRun ?? g.newGame} autoFocus>
          {t('gameover.newRun')}
        </button>
        {onMainMenu && (
          <button className="btn exchange" onClick={onMainMenu}>
            {t('gameover.mainMenu')}
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
