/**
 * Sweet Turtles' pre-game ident cue. This intentionally bypasses the game
 * mixer: no settings, unlock, persistence, or gameplay-audio dependency.
 */
export function playStartupIdentAudio(reducedMotion: boolean): () => void {
  const AudioContextClass = globalThis.AudioContext
    ?? (globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;
  if (!AudioContextClass) return () => undefined;

  let context: AudioContext;
  try {
    context = new AudioContextClass();
  } catch {
    return () => undefined;
  }

  let disposed = false;
  let listening = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  const sources: AudioScheduledSourceNode[] = [];
  const close = () => {
    if (context.state === 'closed') return;
    try { void context.close().catch(() => undefined); } catch { /* unsupported */ }
  };
  const handleStateChange = () => {
    if (!disposed && context.state !== 'running') dispose();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    if (listening) {
      listening = false;
      context.removeEventListener('statechange', handleStateChange);
    }
    if (closeTimer !== undefined) clearTimeout(closeTimer);
    for (const source of sources) {
      try { source.stop(); } catch { /* already ended */ }
      try { source.disconnect(); } catch { /* already disconnected */ }
    }
    close();
  };

  // Never leave a suspended context queued to start on a later user gesture.
  if (context.state !== 'running') {
    try { void context.resume().catch(() => undefined); } catch { /* unsupported */ }
    close();
    return dispose;
  }

  context.addEventListener('statechange', handleStateChange);
  listening = true;

  try {
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.12;
    const output = context.createGain();
    output.gain.value = 0.6;
    compressor.connect(output).connect(context.destination);

    const origin = context.currentTime + 0.02;
    const tone = (
      at: number,
      duration: number,
      fromHz: number,
      toHz: number,
      level: number,
      type: OscillatorType,
    ) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const start = origin + at;
      const end = start + duration;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(fromHz, start);
      oscillator.frequency.exponentialRampToValueAtTime(toHz, end);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.exponentialRampToValueAtTime(level, start + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.0001, end);
      oscillator.connect(envelope).connect(compressor);
      oscillator.start(start);
      oscillator.stop(end + 0.01);
      sources.push(oscillator);
    };

    if (reducedMotion) {
      tone(0.08, 0.32, 1480, 920, 0.3, 'triangle');
      tone(0.11, 0.38, 2240, 1320, 0.16, 'sine');
      closeTimer = setTimeout(dispose, 700);
      return dispose;
    }

    // Inharmonic partials read as struck metal instead of a single electronic beep.
    tone(0, 0.46, 1120, 1040, 0.42, 'sine');
    tone(0, 0.31, 1687, 1510, 0.25, 'sine');
    tone(0, 0.18, 2779, 2380, 0.15, 'triangle');
    [0.10, 0.24, 0.38, 0.52, 0.66, 0.80, 0.94, 1.10, 1.26, 1.41]
      .forEach((at, index) => {
        tone(at, 0.055, 1720 - index * 92, 1040 - index * 45, 0.09, 'triangle');
      });

    // First desk contact: low coin body plus a short metallic edge ring.
    tone(1.00, 0.28, 190, 58, 0.78, 'sine');
    tone(1.00, 0.34, 1320, 720, 0.42, 'triangle');
    tone(1.018, 0.24, 2380, 1180, 0.2, 'sine');

    // Bounce contact and the final front-face snap.
    tone(1.22, 0.22, 1160, 620, 0.24, 'triangle');
    tone(1.60, 0.36, 1560, 980, 0.32, 'triangle');
    tone(1.64, 0.30, 2340, 1480, 0.18, 'sine');
    closeTimer = setTimeout(dispose, 2000);
  } catch {
    dispose();
  }

  return dispose;
}
