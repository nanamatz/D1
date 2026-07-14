import { judgeSentence } from '../engine/patterns';
import { patternLabel, stagePreview } from './game';
import { useGame } from './useGame';
import { Sidebar } from './components/Sidebar';
import { JokerShelf } from './components/JokerShelf';
import { SentenceTray } from './components/SentenceTray';
import { StagePanel } from './components/StagePanel';

export function App() {
  const g = useGame();
  const { blind, run, selected } = g.state;

  const preview = stagePreview(blind, g.lexicon, selected);
  const judgment = judgeSentence(blind.sequence, g.lexicon);
  const breakdown = judgment.match
    ? `${patternLabel(judgment.match.pattern)}${judgment.unison ? ' + unison' : ''}`
    : judgment.unison
      ? 'unison only'
      : 'no bonus yet';

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
