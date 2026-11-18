/**
 * Tiny sound effects made in code (no audio files to download). Off by
 * default; the player turns them on with the speaker button. No fart sounds:
 * the game stays cheeky, not gross.
 */
const KEY = 'wf_sound';

let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    // Not saved; it still works for this visit.
  }
}

function audio(): AudioContext | null {
  if (!soundOn()) {
    return null;
  }
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

type Note = {
  freq: number;
  at: number;
  length: number;
  type?: OscillatorType;
  slideTo?: number;
  volume?: number;
};

function play(notes: readonly Note[]): void {
  const ac = audio();
  if (!ac) {
    return;
  }
  const start = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = n.type ?? 'square';
    osc.frequency.setValueAtTime(n.freq, start + n.at);
    if (n.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        n.slideTo,
        start + n.at + n.length
      );
    }
    const peak = n.volume ?? 0.07;
    gain.gain.setValueAtTime(0.0001, start + n.at);
    gain.gain.exponentialRampToValueAtTime(peak, start + n.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + n.at + n.length);
    osc.connect(gain).connect(ac.destination);
    osc.start(start + n.at);
    osc.stop(start + n.at + n.length + 0.02);
  }
}

export const sfx = {
  /** Tapping a suspect. */
  tap: () => play([{ freq: 660, at: 0, length: 0.05, type: 'triangle' }]),
  /** The red X stamp when someone is marked innocent. */
  stamp: () =>
    play([
      {
        freq: 180,
        at: 0,
        length: 0.12,
        type: 'square',
        slideTo: 70,
        volume: 0.09,
      },
      { freq: 520, at: 0.05, length: 0.06, type: 'triangle' },
    ]),
  /** "Prove it!": a cartoon boing. */
  boing: () =>
    play([
      {
        freq: 220,
        at: 0,
        length: 0.22,
        type: 'triangle',
        slideTo: 520,
        volume: 0.08,
      },
    ]),
  /** Right guess: a happy little fanfare. */
  win: () =>
    play([
      { freq: 523, at: 0, length: 0.12 },
      { freq: 659, at: 0.11, length: 0.12 },
      { freq: 784, at: 0.22, length: 0.12 },
      { freq: 1047, at: 0.34, length: 0.32, type: 'triangle', volume: 0.09 },
    ]),
  /** Wrong guess: a sad trombone "wah wah". */
  lose: () =>
    play([
      {
        freq: 392,
        at: 0,
        length: 0.28,
        type: 'sawtooth',
        slideTo: 370,
        volume: 0.05,
      },
      {
        freq: 349,
        at: 0.3,
        length: 0.28,
        type: 'sawtooth',
        slideTo: 330,
        volume: 0.05,
      },
      {
        freq: 311,
        at: 0.6,
        length: 0.6,
        type: 'sawtooth',
        slideTo: 262,
        volume: 0.05,
      },
    ]),
};
