import type { AudioEngine } from './audio';

export type Mood = 'menu' | 'match' | 'off';

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** i–VI–III–VII in A minor (Am F C G) – catchy and loopable. */
const CHORDS: number[][] = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [48, 52, 55], // C
  [55, 59, 62], // G
];

/**
 * Procedural background music: a lookahead scheduler plays bass, drums,
 * chord stabs and an arpeggio on the Web Audio clock.
 */
export class Music {
  private mood: Mood = 'off';
  private step = 0;
  private bar = 0;
  private nextTime = 0;
  private timer = 0;

  constructor(private audio: AudioEngine) {}

  setMood(m: Mood): void {
    if (m === this.mood) return;
    this.mood = m;
    if (m === 'off') {
      window.clearInterval(this.timer);
      this.timer = 0;
      return;
    }
    this.start();
  }

  /** (Re)start the scheduler once audio is available. */
  start(): void {
    if (this.mood === 'off' || this.timer || !this.audio.ready) return;
    this.nextTime = this.audio.now + 0.1;
    this.step = 0;
    this.bar = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  private get stepDur(): number {
    const bpm = this.mood === 'match' ? 124 : 98;
    return 60 / bpm / 4; // 16th notes
  }

  private schedule(): void {
    const a = this.audio;
    const out = a.musicOut;
    if (!out || this.mood === 'off') return;
    // if the tab was in the background, don't try to catch up
    if (this.nextTime < a.now - 0.2) this.nextTime = a.now + 0.05;
    while (this.nextTime < a.now + 0.12) {
      this.playStep(this.step, this.bar, this.nextTime, out);
      this.nextTime += this.stepDur;
      this.step++;
      if (this.step === 16) {
        this.step = 0;
        this.bar = (this.bar + 1) % 8;
      }
    }
  }

  private playStep(s: number, bar: number, t: number, out: AudioNode): void {
    const a = this.audio;
    const chord = CHORDS[bar % 4];
    const root = chord[0] - 12;
    const sd = this.stepDur;
    if (this.mood === 'match') {
      if (s % 4 === 0) a.drum('kick', t, 0.5, out);
      if (s === 4 || s === 12) a.drum('snare', t, 0.35, out);
      if (s % 2 === 0) a.drum('hat', t, s % 4 === 2 ? 0.3 : 0.15, out);
      // bouncy bass in 8ths with octave jumps
      if (s % 2 === 0) {
        const pattern = [0, 0, 12, 0, 0, 12, 7, 12];
        a.synth('square', midi(root - 12 + pattern[s / 2]), t, sd * 1.6, 0.13, out, 700);
      }
      // off-beat chord stabs
      if (s % 4 === 2) for (const n of chord) a.synth('square', midi(n), t, sd * 1.2, 0.035, out, 1800);
      // arpeggio lead in the second half of the 8-bar loop
      if (bar >= 4 && s % 2 === 0) {
        const arp = [chord[0], chord[1], chord[2], chord[1] + 12];
        a.synth('triangle', midi(arp[(s / 2) % 4] + 12), t, sd * 1.4, 0.07, out);
      }
    } else {
      // menu: relaxed groove with a soft pad
      if (s === 0 || s === 10) a.drum('kick', t, 0.35, out);
      if (s === 8) a.drum('snare', t, 0.18, out);
      if (s % 4 === 2) a.drum('hat', t, 0.12, out);
      if (s === 0) for (const n of chord) a.synth('triangle', midi(n), t, sd * 15, 0.045, out, 1200);
      if (s % 4 === 0) a.synth('triangle', midi(root - 12), t, sd * 3, 0.14, out);
      if (s % 2 === 0 && (bar % 2 === 1 || s >= 8)) {
        const arp = [chord[0], chord[2], chord[1] + 12, chord[2]];
        a.synth('sine', midi(arp[(s / 2) % 4] + 12), t, sd * 1.8, 0.05, out);
      }
    }
  }
}
