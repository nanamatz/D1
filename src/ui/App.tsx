import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from './useGame';
import { useSettings } from './settings';
import { audio, type MusicTrack } from './audio';
import { MainMenu } from './components/MainMenu';
import { ScreenTransition } from './components/ScreenTransition';
import { TutorialHost } from './components/TutorialPopup';
import { ChromaticReveal } from './components/ChromaticReveal';
import { CrtOverlay } from './components/CrtOverlay';
import { LoadingScreen } from './components/LoadingScreen';
import { PatternLevelUp } from './components/PatternLevelUp';
import { ConsumableEffect } from './components/ConsumableEffect';
import { JokerChanceEffect } from './components/JokerChanceEffect';
import { SaveHealthNotice } from './components/SaveHealthNotice';
import { POUCH_ART } from './pouchArt';
import { RECORD_ART } from './recordArt';
import { preloadImagesWhenIdle } from './preload';
import type { Lexicon } from '../engine/lexicon';

const NewRun = lazy(() =>
  import('./components/NewRun').then(({ NewRun: component }) => ({ default: component })),
);
const RunView = lazy(() =>
  import('./components/RunView').then(({ RunView: component }) => ({ default: component })),
);
const Collection = lazy(() =>
  import('./components/Collection').then(({ Collection: component }) => ({ default: component })),
);
const Options = lazy(() =>
  import('./components/Options').then(({ Options: component }) => ({ default: component })),
);
const Profile = lazy(() =>
  import('./components/Profile').then(({ Profile: component }) => ({ default: component })),
);
const DeskEncounterLab = import.meta.env.DEV
  ? lazy(() =>
      import('./components/DeskEncounterLab')
        .then(({ DeskEncounterLab: component }) => ({ default: component })),
    )
  : null;

type Screen = 'menu' | 'newrun' | 'run' | 'collection' | 'options' | 'profile' | 'deskLab';
const NEW_RUN_ART = [...Object.values(POUCH_ART), ...Object.values(RECORD_ART)];

export function App() {
  const lexiconRef = useRef<Lexicon | null>(null);
  const lexiconPromiseRef = useRef<Promise<Lexicon> | null>(null);
  const [lexiconReady, setLexiconReady] = useState(false);
  const getLexicon = useCallback((): Lexicon => {
    if (!lexiconRef.current) throw new Error('Lexicon requested before loading');
    return lexiconRef.current;
  }, []);
  const ensureLexicon = useCallback((): Promise<Lexicon> => {
    if (lexiconRef.current) return Promise.resolve(lexiconRef.current);
    if (!lexiconPromiseRef.current) {
      lexiconPromiseRef.current = import('./lexicon.browser')
        .then(({ loadBrowserLexicon }) => {
          const lexicon = loadBrowserLexicon();
          lexiconRef.current = lexicon;
          setLexiconReady(true);
          return lexicon;
        })
        .catch((error: unknown) => {
          lexiconPromiseRef.current = null;
          throw error;
        });
    }
    return lexiconPromiseRef.current;
  }, []);
  const g = useGame(getLexicon, lexiconReady);
  // D-4: preload assets behind a loading screen before the Main Menu. Falls through
  // immediately when everything is cached (LoadingScreen reports real progress).
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (loading) return;
    return preloadImagesWhenIdle(NEW_RUN_ART);
  }, [loading]);
  // Mounted here so the persisted volumes (e.g. a saved master:0) reach the audio
  // mixer at startup on the menu screen, before Options or RunView ever mount.
  // `usePersistedState` is now backed by one shared store per key, so this
  // instance stays live with Options' and RunView's rather than freezing at
  // page-load values — which is what used to let it write a stale snapshot back.
  useSettings();
  const [screen, setScreen] = useState<Screen>('menu');
  const openScreen = useCallback(
    (next: Exclude<Screen, 'menu'>) => {
      if (next === 'newrun') {
        setScreen(next);
        return;
      }
      void ensureLexicon()
        .then(() => setScreen(next))
        .catch((error: unknown) => console.error('[lexicon] load failed', error));
    },
    [ensureLexicon],
  );
  // `useGame` lives here, so leaving the run view (Options → Main Menu) keeps the
  // run intact, and it's persisted to localStorage so a reload keeps it too.
  // `runStarted` rides along in the save. A finished run is not resumable.
  const canContinue =
    g.state.runStarted &&
    (g.state.phase !== 'gameover' || !!g.state.gameover?.won);

  // Menu and run each own one loop. Shop/Deadline never swap composition: shop
  // muffles the shared run bus, while a boss keeps the ordinary run music.
  const track: MusicTrack =
    screen !== 'run' || g.state.phase === 'gameover' ? 'menu' : 'play';
  const musicMuffled = screen === 'run' && g.state.phase === 'shop';
  useEffect(() => {
    audio.playMusic(track);
  }, [track]);
  useEffect(() => {
    audio.setMusicMuffled(musicMuffled);
  }, [musicMuffled]);

  // One delegated listener covers every native and ARIA button, including future
  // screens. audio.play() still respects the SOUND palette unlock and SFX slider.
  useEffect(() => {
    const enabledControl = (target: EventTarget | null): Element | null => {
      if (!(target instanceof Element)) return null;
      const control = target.closest(
        'button, [role="button"], input[type="checkbox"], input[type="radio"]',
      );
      return control?.matches(':disabled, [aria-disabled="true"], .desk-object') ? null : control;
    };
    const click = (event: MouseEvent) => {
      if (enabledControl(event.target)) audio.play('buttonPress');
    };
    const key = (event: KeyboardEvent) => {
      if (
        !event.repeat &&
        (event.key === 'Enter' || event.key === ' ') &&
        enabledControl(event.target)?.matches('[role="button"]:not(button)')
      ) {
        audio.play('buttonPress');
      }
    };
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key, true);
    };
  }, []);

  const view = () => {
    switch (screen) {
      case 'newrun':
        return (
          <NewRun
            initialPouchId={g.state.run.pouchId}
            initialRecordId={g.state.run.recordId}
            onStart={(config) => {
              void ensureLexicon()
                .then(() => {
                  g.startRun(config);
                  setScreen('run');
                })
                .catch((error: unknown) => console.error('[lexicon] load failed', error));
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
            onContinue={canContinue ? () => {
              void ensureLexicon()
                .then(() => setScreen('run'))
                .catch((error: unknown) => console.error('[lexicon] load failed', error));
            } : undefined}
          />
        );
      case 'run':
        return <RunView g={g} onExit={() => setScreen('menu')} onNewRun={() => setScreen('newrun')} />;
      case 'collection':
        return <Collection lexicon={g.getLexicon()} onBack={() => setScreen('menu')} />;
      case 'options':
        return <Options lexicon={g.getLexicon()} onBack={() => setScreen('menu')} />;
      case 'profile':
        return <Profile lexicon={g.getLexicon()} onBack={() => setScreen('menu')} />;
      case 'deskLab':
        return DeskEncounterLab
          ? <DeskEncounterLab onBack={() => setScreen('menu')} />
          : null;
      case 'menu':
      default:
        return (
          <MainMenu
            onPlay={() => openScreen('newrun')}
            onCollection={() => openScreen('collection')}
            onOptions={() => openScreen('options')}
            onProfile={() => openScreen('profile')}
            onDeskLab={() => setScreen('deskLab')}
          />
        );
    }
  };

  // B (playtest-05): every top-level screen change plays the one shared
  // transition. In-run phase changes use the same component inside RunView.
  return (
    <>
      {loading ? (
        <LoadingScreen onDone={() => setLoading(false)} />
      ) : (
        <>
          <ScreenTransition screenKey={screen}>
            <Suspense fallback={null}>{view()}</Suspense>
          </ScreenTransition>
          <TutorialHost />
          <ChromaticReveal />
          <PatternLevelUp />
          <ConsumableEffect />
          <JokerChanceEffect />
        </>
      )}
      {/* Emoji Tile art chroma gate — applyPresentation (unlocks.ts) rewrites the
          matrix from the active colour unlocks. Always mounted; a filter needs no
          visible geometry. colorInterpolationFilters MUST be sRGB — the linearRGB
          default would shift the greys away from grayscale(1). */}
      <svg className="unlock-chroma-defs" aria-hidden="true">
        <filter id="unlock-chroma" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"
          />
        </filter>
      </svg>
      <CrtOverlay />
      <SaveHealthNotice />
    </>
  );
}
