import { judgeSentence } from '../engine/patterns';
import { stagePreview } from './game';
import { useGame } from './useGame';
import { useI18n } from './i18n';
import { Sidebar } from './components/Sidebar';
import { JokerShelf } from './components/JokerShelf';
import { SentenceTray } from './components/SentenceTray';
import { StagePanel } from './components/StagePanel';

export function App() {
  const g = useGame();
  const { t } = useI18n();
  const { blind, run, selected } = g.state;

  const preview = stagePreview(blind, g.lexicon, selected);
  const judgment = judgeSentence(blind.sequence, g.lexicon);
  const breakdown = judgment.match
    ? t(`pattern.${judgment.match.pattern}`) +
      (judgment.unison ? ` · ${t('tray.unison', { suit: t(`suit.${judgment.unison.suit}`) })}` : '')
    : judgment.unison
      ? t('sidebar.unisonOnly')
      : t('sidebar.noBonus');

  return (
    <div className="frame">
      <Sidebar
        run={run}
        blind={blind}
        preview={preview}
        projectedBreakdown={breakdown}
        events={g.state.lastEvents}
        settleId={g.state.settleId}
      />
      <main className="main">
        <JokerShelf run={run} />
        <SentenceTray blind={blind} judgment={judgment} lexicon={g.lexicon} />
        <StagePanel g={g} preview={preview} />
      </main>
    </div>
  );
}
