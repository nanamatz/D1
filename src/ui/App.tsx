import { useState } from 'react';
import { useGame } from './useGame';
import { MainMenu } from './components/MainMenu';
import { NewRun } from './components/NewRun';
import { RunView } from './components/RunView';
import { Collection } from './components/Collection';
import { Options } from './components/Options';

type Screen = 'menu' | 'newrun' | 'run' | 'collection' | 'options';

export function App() {
  const g = useGame();
  const [screen, setScreen] = useState<Screen>('menu');

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

  // E-1: a wipe plays whenever the top-level screen changes (the key remounts
  // this wrapper). In-run phase transitions get their own wipe inside RunView.
  return (
    <div key={screen} className="wipe-in route-wrap">
      {view()}
    </div>
  );
}
