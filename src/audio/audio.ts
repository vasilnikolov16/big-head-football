/**
 * All sound is synthesized with the Web Audio API: no audio files.
 * The AudioContext is created lazily on the first user gesture (browser rule).
 */
export type Sfx =
  | 'kick'
  | 'kickPerfect'
  | 'header'
  | 'bounce'
  | 'wall'
  | 'post'
  | 'jump'
  | 'land'
  | 'dash'
  | 'bump'
  | 'whistleStart'
  | 'whistleEnd'
  | 'whistleGolden'
  | 'goal'
  | 'powerSpawn'
  | 'powerPick'
  | 'powerBad'
  | 'freeze'
  | 'superArmed'
  | 'superHit'
  | 'uiMove'
  | 'uiSelect'
  | 'uiBack'
  | 'countdown';

export type SuperSfx = 'razor' | 'pounce' | 'laser' | 'sonic' | 'yarn' | 'warp' | 'thunder' | 'shadow';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private crowdGain!: GainNode;
  private crowdFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private distCurve!: Float32Array<ArrayBuffer>;
  private sfxVol = 0.8;
  private musicVol = 0.5;
  private crowdLevel = 0.15;
  private lastPlay = new Map<string, number>();
  /** called once the context exists (music starts here) */
  onReady: (() => void) | null = null;

  constructor() {
    // iPhone: Web Audio is silenced by the ring/silent switch unless the page
    // asks for the "playback" audio session (Safari 16.4+).
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    try {
      if (nav.audioSession) nav.audioSession.type = 'playback';
    } catch {
      /* not supported */
    }
    // Browsers only allow sound after a user gesture. iOS counts touchend /
    // click (not touchstart), so listen to all of them; after the app was in the
    // background iOS leaves the context "interrupted", so resume every time.
    const unlock = (): void => {
      this.ensure();
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state !== 'running') void ctx.resume().catch(() => {});
      if (!this.primed) {
        // a silent sample started inside the gesture fully unlocks iOS
        this.primed = true;
        const src = ctx.createBufferSource();
        src.buffer = ctx.createBuffer(1, 1, 22050);
        src.connect(ctx.destination);
        src.start(0);
      }
    };
    for (const ev of ['keydown', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click']) {
      window.addEventListener(ev, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.ctx?.suspend().catch(() => {});
      else if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume().catch(() => {});
    });
  }

  private primed = false;

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  get musicOut(): GainNode | null {
    return this.ctx ? this.musicBus : null;
  }

  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // gentle limiter so stacked sounds never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.applyVolumes();

    // white noise buffer shared by all noise-based sounds
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // soft distortion curve (guitar)
    const n = 1024;
    this.distCurve = new Float32Array(new ArrayBuffer(n * 4));
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      this.distCurve[i] = Math.tanh(x * 4);
    }

    this.startCrowd();
    this.onReady?.();
  }

  setVolumes(sfx: number, music: number): void {
    this.sfxVol = sfx;
    this.musicVol = music;
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.4, t, 0.05);
  }

  // ------------------------------------------------------------------ building blocks

  private env(g: GainNode, t: number, a: number, peak: number, dec: number): void {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    t: number,
    dur: number,
    vol: number,
    out: AudioNode = this.sfxBus,
    attack = 0.005,
  ): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, vol, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  private noiseHit(
    t: number,
    dur: number,
    vol: number,
    filter: BiquadFilterType,
    f0: number,
    f1 = f0,
    q = 1,
    out: AudioNode = this.sfxBus,
    attack = 0.002,
  ): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    this.env(g, t, attack, vol, dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  /** Public helpers for the music sequencer. */
  synth(type: OscillatorType, freq: number, t: number, dur: number, vol: number, out: AudioNode, cutoff = 0): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, t, 0.01, vol, dur);
    if (cutoff > 0) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = cutoff;
      o.connect(f).connect(g).connect(out);
    } else o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drum(kind: 'kick' | 'snare' | 'hat', t: number, vol: number, out: AudioNode): void {
    if (!this.ctx) return;
    if (kind === 'kick') {
      this.tone('sine', 140, 45, t, 0.18, vol, out, 0.002);
    } else if (kind === 'snare') {
      this.noiseHit(t, 0.12, vol * 0.7, 'bandpass', 1800, 1200, 0.8, out);
      this.tone('triangle', 220, 160, t, 0.08, vol * 0.4, out, 0.002);
    } else {
      this.noiseHit(t, 0.035, vol * 0.5, 'highpass', 7000, 7000, 0.7, out);
    }
  }

  // ------------------------------------------------------------------ crowd ambience

  private startCrowd(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 700;
    this.crowdFilter.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.35;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(this.crowdFilter.frequency);
    lfo.start();
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0;
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.sfxBus);
    src.start();
  }

  /** 0..1 — how loud the crowd murmur is (follows the stadium excitement). */
  setCrowd(level: number): void {
    if (!this.ctx) return;
    if (Math.abs(level - this.crowdLevel) < 0.01) return;
    this.crowdLevel = level;
    const t = this.ctx.currentTime;
    this.crowdGain.gain.setTargetAtTime(level <= 0 ? 0 : 0.025 + level * 0.22, t, 0.25);
    this.crowdFilter.Q.setTargetAtTime(0.6 + level * 0.6, t, 0.3);
  }

  // ------------------------------------------------------------------ sound effects

  /** intensity 0..1 scales loudness; sounds of the same kind are rate-limited */
  play(name: Sfx, intensity = 1): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (t - last < 0.035) return;
    this.lastPlay.set(name, t);
    const k = Math.max(0.15, Math.min(1, intensity));
    switch (name) {
      case 'kick':
        // a full leather "thwack": low thump + slap of the boot + tiny click
        this.tone('sine', 125, 52, t, 0.13, 0.85 * k, this.sfxBus, 0.001);
        this.tone('triangle', 260, 150, t, 0.06, 0.22 * k, this.sfxBus, 0.001);
        this.noiseHit(t, 0.05, 0.5 * k, 'bandpass', 1900, 900, 1.3);
        this.noiseHit(t, 0.014, 0.22 * k, 'highpass', 5200);
        break;
      case 'kickPerfect':
        this.tone('sine', 140, 48, t, 0.2, 1, this.sfxBus, 0.001);
        this.tone('triangle', 300, 140, t, 0.08, 0.3, this.sfxBus, 0.001);
        this.noiseHit(t, 0.07, 0.75, 'bandpass', 2300, 1000, 1.2);
        this.noiseHit(t, 0.02, 0.4, 'highpass', 4500);
        // the ball rips through the air
        this.noiseHit(t + 0.02, 0.32, 0.16, 'bandpass', 900, 3200, 1.6, this.sfxBus, 0.05);
        break;
      case 'header':
        // a round "bonk" off the big head
        this.tone('sine', 250, 145, t, 0.13, 0.55 * k, this.sfxBus, 0.002);
        this.tone('sine', 500, 300, t, 0.05, 0.12 * k, this.sfxBus, 0.002);
        this.noiseHit(t, 0.04, 0.22 * k, 'bandpass', 1100, 700, 1);
        break;
      case 'bounce':
        // soft thud on the grass
        this.tone('sine', 88, 46, t, 0.11, 0.5 * k, this.sfxBus, 0.002);
        this.noiseHit(t, 0.05, 0.2 * k, 'lowpass', 650, 400);
        break;
      case 'wall':
        // thump against the glass wall
        this.tone('sine', 115, 70, t, 0.12, 0.42 * k, this.sfxBus, 0.002);
        this.noiseHit(t, 0.07, 0.25 * k, 'bandpass', 520, 320, 0.8);
        this.tone('sine', 1850, 1820, t, 0.18, 0.035 * k);
        break;
      case 'post': {
        // the crossbar rings like a metal tube (inharmonic partials) after a sharp hit
        const f0 = 410;
        for (const [r, d, v] of [
          [1, 1.3, 0.3],
          [2.756, 0.85, 0.17],
          [5.404, 0.5, 0.1],
          [8.933, 0.3, 0.06],
        ])
          this.tone('sine', f0 * r * (1 + Math.random() * 0.004), f0 * r * 0.997, t, d, v * k, this.sfxBus, 0.001);
        this.noiseHit(t, 0.025, 0.45 * k, 'highpass', 3800);
        this.tone('sine', 170, 90, t, 0.1, 0.3 * k, this.sfxBus, 0.001);
        break;
      }
      case 'jump':
        this.noiseHit(t, 0.1, 0.07, 'bandpass', 450, 1300, 1.4);
        break;
      case 'dash':
        this.noiseHit(t, 0.16, 0.22 * k, 'bandpass', 900, 2600, 1.2);
        break;
      case 'bump':
        this.tone('sine', 120, 55, t, 0.14, 0.7 * k);
        this.noiseHit(t, 0.07, 0.3 * k, 'lowpass', 700);
        this.tone('triangle', 660, 330, t + 0.02, 0.1, 0.12 * k);
        break;
      case 'land':
        this.tone('sine', 90, 50, t, 0.08, 0.3 * k);
        this.noiseHit(t, 0.06, 0.12 * k, 'lowpass', 500);
        break;
      case 'whistleStart':
        this.whistle(t, 0.38);
        break;
      case 'whistleGolden':
        this.whistle(t, 0.18);
        this.whistle(t + 0.26, 0.18);
        break;
      case 'whistleEnd':
        this.whistle(t, 0.2);
        this.whistle(t + 0.28, 0.2);
        this.whistle(t + 0.56, 0.75);
        break;
      case 'goal':
        // boom + crowd roar + stadium horn
        this.tone('sine', 90, 35, t, 0.6, 0.9);
        this.noiseHit(t, 2.6, 0.75, 'bandpass', 600, 900, 0.5, this.sfxBus, 0.25);
        this.noiseHit(t + 0.1, 2.2, 0.35, 'bandpass', 1400, 1700, 0.8, this.sfxBus, 0.3);
        for (const f of [196, 247, 294, 392]) this.horn(f, t + 0.05, 1.3, 0.12);
        break;
      case 'powerSpawn':
        [1047, 1319, 1568, 2093].forEach((f, i) => this.tone('sine', f, f, t + i * 0.05, 0.18, 0.18));
        break;
      case 'powerPick':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('square', f, f, t + i * 0.045, 0.12, 0.12));
        this.tone('sine', 1568, 2093, t + 0.2, 0.25, 0.15);
        break;
      case 'powerBad':
        [659, 523, 415, 330].forEach((f, i) => this.tone('square', f, f * 0.97, t + i * 0.07, 0.14, 0.1));
        break;
      case 'freeze':
        for (const f of [2637, 3136, 3951, 4699]) this.tone('sine', f, f * 1.02, t + Math.random() * 0.08, 0.6, 0.06);
        this.noiseHit(t, 0.5, 0.15, 'highpass', 6000);
        break;
      case 'superArmed':
        this.tone('sawtooth', 180, 900, t, 0.45, 0.12);
        this.noiseHit(t, 0.4, 0.15, 'bandpass', 400, 3000, 2);
        break;
      case 'superHit':
        this.tone('square', 600, 200, t, 0.15, 0.2);
        // little birdies
        [2400, 2900, 2600].forEach((f, i) => this.tone('sine', f, f * 1.25, t + 0.12 + i * 0.09, 0.07, 0.1));
        break;
      case 'uiMove':
        // a soft glassy tick
        this.tone('sine', 1480, 1440, t, 0.045, 0.03, this.sfxBus, 0.002);
        this.tone('sine', 2960, 2900, t, 0.025, 0.008, this.sfxBus, 0.002);
        break;
      case 'uiSelect':
        // a gentle two-note chime
        this.tone('sine', 988, 988, t, 0.16, 0.05, this.sfxBus, 0.003);
        this.tone('sine', 1480, 1480, t + 0.055, 0.24, 0.045, this.sfxBus, 0.003);
        this.tone('sine', 2960, 2960, t + 0.055, 0.1, 0.008, this.sfxBus, 0.003);
        break;
      case 'uiBack':
        this.tone('sine', 880, 660, t, 0.12, 0.04, this.sfxBus, 0.003);
        break;
      case 'countdown':
        this.tone('square', 880, 880, t, 0.1, 0.1);
        break;
    }
  }

  private whistle(t: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = 2900;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 32;
    const lg = ctx.createGain();
    lg.gain.value = 140;
    lfo.connect(lg).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.22, t + dur - 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
    this.noiseHit(t, dur, 0.05, 'bandpass', 2900, 2900, 3);
  }

  private horn(f: number, t: number, dur: number, vol: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(400, t);
    flt.frequency.linearRampToValueAtTime(2200, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.06);
    g.gain.setValueAtTime(vol, t + dur - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(flt).connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Distorted guitar chord (rocker): frequencies, start, length, volume, swell = slow attack. */
  private guitar(freqs: number[], t: number, dur: number, vol: number, swell = false): void {
    const ctx = this.ctx!;
    const shaper = ctx.createWaveShaper();
    shaper.curve = this.distCurve;
    const g = ctx.createGain();
    if (swell) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else this.env(g, t, 0.01, vol, dur);
    shaper.connect(g).connect(this.sfxBus);
    for (const fr of freqs) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = fr;
      o.connect(shaper);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  /** The hero's signature when the super is armed (button pressed with a full bar). */
  playArm(id: SuperSfx): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.noiseHit(t, 0.35, 0.1, 'bandpass', 500, 3000, 2);
    switch (id) {
      case 'razor': // snip-snip of the barber's scissors
        for (const d of [0, 0.13]) {
          this.noiseHit(t + d, 0.05, 0.45, 'highpass', 6000, 6000, 3);
          this.tone('triangle', 3200, 2400, t + d, 0.05, 0.12);
        }
        break;
      case 'pounce': // a short "mrrp"
        this.tone('triangle', 420, 760, t, 0.12, 0.24);
        this.tone('triangle', 760, 520, t + 0.12, 0.16, 0.2);
        break;
      case 'laser': // robot beeps
        [880, 1320, 1760].forEach((fr, i) => this.tone('square', fr, fr, t + i * 0.07, 0.05, 0.09));
        break;
      case 'sonic': // a power-chord stab
        this.guitar([110, 165, 220], t, 0.4, 0.22);
        break;
      case 'yarn': // music-box plinks
        [1047, 1319, 1568].forEach((fr, i) => this.tone('sine', fr, fr, t + i * 0.08, 0.35, 0.16, this.sfxBus, 0.002));
        break;
      case 'warp': // alien warble
        this.tone('sine', 500, 1300, t, 0.12, 0.2);
        this.tone('sine', 1300, 420, t + 0.12, 0.16, 0.2);
        this.tone('sine', 420, 1100, t + 0.28, 0.12, 0.16);
        break;
      case 'thunder': // viking horn call
        this.horn(147, t, 0.55, 0.16);
        break;
      case 'shadow': // a blade drawn from its sheath
        this.noiseHit(t, 0.3, 0.3, 'bandpass', 3000, 8000, 6);
        this.tone('triangle', 2600, 3300, t, 0.3, 0.07);
        break;
    }
  }

  /** The wind-up before the super shot (~1 s): a shared riser plus the hero's own colour. */
  playCharge(id: SuperSfx): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    const D = 1.0;
    this.noiseHit(t, D, 0.16, 'bandpass', 300, 3200, 1.5, this.sfxBus, D * 0.85);
    this.tone('sine', 110, 440, t, D, 0.16, this.sfxBus, D * 0.8);
    switch (id) {
      case 'razor': // scissors snipping faster and faster
        [0, 0.3, 0.52, 0.68, 0.8, 0.9].forEach((d) => this.noiseHit(t + d, 0.04, 0.35, 'highpass', 6000, 6000, 3));
        break;
      case 'pounce': // purring, then a hiss
        for (let i = 0; i < 12; i++) this.tone('sawtooth', 60, 50, t + i * 0.06, 0.05, 0.05);
        this.noiseHit(t + 0.72, 0.28, 0.25, 'highpass', 3500, 5000, 1);
        break;
      case 'laser': // charging whine + fast beeps
        this.tone('sawtooth', 200, 2600, t, D * 0.95, 0.07, this.sfxBus, 0.3);
        for (let i = 0; i < 6; i++) this.tone('square', 1200 + i * 160, 1200 + i * 160, t + i * 0.15, 0.04, 0.06);
        break;
      case 'sonic': // a chord swelling with feedback
        this.guitar([82, 123, 165], t, D, 0.2, true);
        break;
      case 'yarn': // a rising music-box tune
        [523, 659, 784, 1047, 1319, 1568].forEach((fr, i) => this.tone('sine', fr, fr, t + i * 0.15, 0.3, 0.14, this.sfxBus, 0.002));
        break;
      case 'warp': // wobbling space sound
        for (let i = 0; i < 8; i++) this.tone('sine', 300 + i * 90, 600 + i * 150, t + i * 0.12, 0.12, 0.1);
        break;
      case 'thunder': // rumble and a long horn
        this.noiseHit(t, D, 0.4, 'lowpass', 180, 260, 1, this.sfxBus, 0.3);
        this.horn(110, t + 0.1, 0.85, 0.14);
        break;
      case 'shadow': // wind and taiko drums
        this.noiseHit(t, D, 0.18, 'bandpass', 700, 2200, 2, this.sfxBus, 0.4);
        for (const d of [0, 0.4, 0.7, 0.88]) this.drum('kick', t + d, 0.7, this.sfxBus);
        break;
    }
  }

  /** Signature sound of each hero's super shot. */
  playSuper(id: SuperSfx): void {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    // shared impact
    this.tone('sine', 200, 40, t, 0.35, 0.9);
    this.noiseHit(t, 0.35, 0.4, 'bandpass', 800, 3000, 1);
    switch (id) {
      case 'razor':
        this.noiseHit(t, 0.4, 0.3, 'highpass', 5000, 9000, 4);
        this.tone('sawtooth', 2400, 3600, t, 0.25, 0.08);
        break;
      case 'pounce':
        // "meow"
        this.tone('triangle', 520, 900, t + 0.05, 0.18, 0.22);
        this.tone('triangle', 900, 420, t + 0.23, 0.3, 0.2);
        break;
      case 'laser':
        this.tone('sawtooth', 1800, 140, t, 0.5, 0.2);
        this.tone('square', 2400, 300, t, 0.35, 0.08);
        break;
      case 'sonic': {
        // distorted power chord
        const ctx = this.ctx!;
        const shaper = ctx.createWaveShaper();
        shaper.curve = this.distCurve;
        const g = ctx.createGain();
        this.env(g, t, 0.01, 0.25, 1.2);
        shaper.connect(g).connect(this.sfxBus);
        for (const f of [110, 165, 220]) {
          const o = ctx.createOscillator();
          o.type = 'sawtooth';
          o.frequency.value = f;
          o.connect(shaper);
          o.start(t);
          o.stop(t + 1.3);
        }
        break;
      }
      case 'yarn':
        this.tone('sine', 300, 700, t, 0.3, 0.25);
        this.tone('sine', 700, 350, t + 0.3, 0.3, 0.2);
        break;
      case 'warp':
        this.tone('sine', 200, 1600, t, 0.35, 0.22);
        this.tone('sine', 1600, 300, t + 0.45, 0.35, 0.22);
        break;
      case 'thunder':
        this.noiseHit(t, 0.08, 0.8, 'highpass', 2000);
        this.noiseHit(t + 0.05, 1.4, 0.7, 'lowpass', 400, 80, 0.7);
        break;
      case 'shadow':
        [0, 0.08, 0.16].forEach((d) => this.noiseHit(t + d, 0.25, 0.3, 'bandpass', 600, 2400, 2));
        break;
    }
  }
}
