import { useState } from 'react';
import { useGame } from './useGame';
import { MainMenu } from './components/MainMenu';
import { NewRun } from './components/NewRun';
import { RunView } from './components/RunView';
import { Collection } from './components/Collection';
import { Options } from './components/Options';
import { ScreenTransition } from './components/ScreenTransition';

type Screen = 'menu' | 'newrun' | 'run' | 'collection' | 'options';

export function App() {
  const g = useGame();
  const [screen, setScreen] = useState<Screen>('menu');
  // `useGame` lives here, so leaving the run view (Options → Main Menu) keeps the
  // run intact, and it's persisted to localStorage so a reload keeps it too.
  // `runStarted` rides along in the save. A finished run is not resumable.
  const canContinue = g.state.runStarted && g.state.phase !== 'gameover';

  const view = () => {
    switch (screen) {
      case 'newrun':
        return (
          <NewRun
            onStart={(seed) => {
              g.startRun(seed);
              setScreen('run');
            }}
            onBack={() => setScreen('menu')}
            continueInfo={
              canContinue
                ? {
                    ante: g.state.run.ante,
                    blindKind: g.state.blind.kind,
                    gold: g.state.run.gold,
                    seed: g.state.seed,
                  }
                : undefined
            }
            onContinue={canContinue ? () => setScreen('run') : undefined}
          />
        );
      case 'run':
        return <RunView g={g} onExit={() => setScreen('menu')} onNewRun={() => setScreen('newrun')} />;
      case 'collection':
        return <Collection lexicon={g.lexicon} onBack={() => setScreen('menu')} />;
      case 'options':
        return <Options lexicon={g.lexicon} onBack={() => setScreen('menu')} />;
      case 'menu':
      default:
        return (
          <MainMenu
            onPlay={() => setScreen('newrun')}
            onCollection={() => setScreen('collection')}
            onOptions={() => setScreen('options')}
          />
        );
    }
  };

  // B (playtest-05): every top-level screen change plays the one shared
  // transition. In-run phase changes use the same component inside RunView.
  return <ScreenTransition screenKey={screen}>{view()}</ScreenTransition>;
}
