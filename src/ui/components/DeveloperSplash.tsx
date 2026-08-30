import { useEffect, useRef, useState } from 'react';
import { motionOff } from '../motion';
import { playStartupIdentAudio } from '../startupAudio';
import { useI18n } from '../i18n';
import logoUrl from '../assets/branding/sweet-turtles.png';

const SPLASH_MS = 3850;
const REDUCED_SPLASH_MS = 2240;
const FALLBACK_SPLASH_MS = 700;
const PREPARE_TIMEOUT_MS = 2000;
type LogoState = 'preparing' | 'ready' | 'fallback';

export function DeveloperSplash({
  onDone,
  reducedMotion,
}: {
  onDone: () => void;
  reducedMotion: boolean;
}) {
  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  const [logoState, setLogoState] = useState<LogoState>('preparing');
  const { t } = useI18n();
  onDoneRef.current = onDone;

  const reduce = reducedMotion || motionOff();
  const finish = () => {
    if (logoState === 'preparing' || doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  useEffect(() => {
    let live = true;
    let settled = false;
    let prepareTimer = 0;
    const image = new Image();
    const settle = (state: Exclude<LogoState, 'preparing'>) => {
      if (!live || settled) return;
      settled = true;
      window.clearTimeout(prepareTimer);
      image.onload = null;
      image.onerror = null;
      setLogoState(state);
    };

    image.onload = () => {
      if (typeof image.decode !== 'function') {
        settle('ready');
        return;
      }
      void image.decode().then(
        () => settle('ready'),
        () => settle('fallback'),
      );
    };
    image.onerror = () => settle('fallback');
    prepareTimer = window.setTimeout(() => settle('fallback'), PREPARE_TIMEOUT_MS);
    image.src = logoUrl;

    return () => {
      live = false;
      window.clearTimeout(prepareTimer);
      image.onload = null;
      image.onerror = null;
    };
  }, []);

  useEffect(() => {
    if (logoState === 'preparing') return;
    let live = true;
    const duration = logoState === 'fallback'
      ? FALLBACK_SPLASH_MS
      : reduce ? REDUCED_SPLASH_MS : SPLASH_MS;
    const timer = window.setTimeout(() => {
      if (live) finish();
    }, duration);

    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [logoState, reduce]);

  useEffect(() => {
    if (logoState !== 'ready') return;
    let stopAudio: (() => void) | undefined;
    // Deferring one task lets React StrictMode discard its probe effect before
    // an AudioContext is created, so the cue is still scheduled exactly once.
    const timer = window.setTimeout(() => {
      stopAudio = playStartupIdentAudio(reduce);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      stopAudio?.();
    };
  }, [logoState, reduce]);

  return (
    <div
      className={[
        'developer-splash',
        reduce && 'developer-splash--reduced',
        logoState === 'fallback' && 'developer-splash--fallback',
      ].filter(Boolean).join(' ')}
      role="button"
      tabIndex={0}
      autoFocus
      aria-label={t('startup.identContinue')}
      aria-disabled={logoState === 'preparing'}
      aria-busy={logoState === 'preparing'}
      onKeyDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (
          event.repeat || event.nativeEvent.isComposing || event.key === 'Tab' ||
          ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key) ||
          event.ctrlKey || event.altKey || event.metaKey
        ) return;
        finish();
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (!event.isPrimary || event.button !== 0) return;
        event.preventDefault();
        finish();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }}
    >
      {logoState !== 'preparing' && (
        <div className="developer-splash__content">
          {logoState === 'ready' && (
            <div className="developer-splash__coin-stage" aria-hidden="true">
              <div className="developer-splash__coin-shadow" />
              <div className="developer-splash__coin">
                <div className="developer-splash__coin-face developer-splash__coin-back">
                  <span>ST</span>
                </div>
                <div className="developer-splash__coin-face developer-splash__coin-front">
                  <img
                    className="developer-splash__logo"
                    src={logoUrl}
                    width={600}
                    height={600}
                    alt=""
                  />
                </div>
              </div>
              <div className="developer-splash__ring-shine" />
            </div>
          )}
          <p className="developer-splash__name" aria-hidden="true">Sweet Turtles</p>
        </div>
      )}
    </div>
  );
}
