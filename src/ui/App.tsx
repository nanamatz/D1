import { useEffect, useState } from 'react';
import { useGame } from './useGame';
import { useSettings } from './settings';
import { audio, type MusicTrack } from './audio';
import { MainMenu } from './components/MainMenu';
import { NewRun } from './components/NewRun';
import { RunView } from './components/RunView';
import { Collection } from './components/Collection';
import { Options } from './components/Options';
import { ScreenTransition } from './components/ScreenTransition';
import { TutorialHost } from './components/TutorialPopup';

type Screen = 'menu' | 'newrun' | 'run' | 'collection' | 'options';

export function App() {
  const g = useGame();
  // `usePersistedState` is a plain per-instance useState with no cross-instance
  // sync, so this App-level instance is frozen at page-load values and its
  // effect fires once at mount — it does NOT stay "live" across screens.
  // The real value of mounting `useSettings` here (not only inside
  // Options/RunView) is that mount-time effect: it applies the persisted
  // volume values (e.g. a saved master:0) to the audio mixer singleton at
  // startup, on the menu screen, before Options or RunView ever mount —
  // closing the gap where saved silence wouldn't apply until Options was
  // opened. `audio.setVolumes` is last-writer-wins with no render loop, so
  // whichever instance (this one, or Options/RunView's own) last called it
  // wins; this one just guarantees an early call happens.
  useSettings();
  const [screen, setScreen] = useState<Screen>('menu');
  // `useGame` lives here, so leaving the run view (Options → Main Menu) keeps the
  // run intact, and it's persisted to localStorage so a reload keeps it too.
  // `runStarted` rides along in the save. A finished run is not resumable.
  const canContinue = g.state.runStarted && g.state.phase !== 'gameover';

  // BGM (work order B-2): one place picks the loop for the current context — menu
  // track off-run, the shop lounge in the Stationery Shop, and the play track
  // (its tenser Deadline variant on a boss blind) on the board. `playMusic`
  // no-ops when the track is unchanged and defers until the audio gesture-unlock.
  const track: MusicTrack =
    screen !== 'run'
      ? 'menu'
      : g.state.phase === 'shop'
        ? 'shop'
        : g.state.phase === 'gameover'
          ? 'menu'
          : g.state.blind.kind === 'boss'
            ? 'boss'
            : 'play';
  useEffect(() => {
    audio.playMusic(track);
  }, [track]);

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
  return (
    <>
      <ScreenTransition screenKey={screen}>{view()}</ScreenTransition>
      <TutorialHost />
    </>
  );
}
