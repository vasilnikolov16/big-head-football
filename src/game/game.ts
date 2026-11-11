import { DT } from '../core/constants';
import { Keyboard } from '../input/keyboard';
import { KeyboardController, SCHEME_ARROWS, SCHEME_WASD } from '../input/controls';
import { Renderer, type OverlayInfo } from '../render/renderer';
import { CHARACTERS } from './characters';
import { Match, type MatchConfig } from './match';

const MAX_FRAME = 0.1; // never simulate more than 100 ms per frame (tab switches etc.)

/** Owns the main loop: fixed-step simulation (120 Hz) + interpolated rendering. */
export class Game {
  readonly kb = new Keyboard();
  readonly renderer: Renderer;
  match: Match;
  paused = false;
  /** global time multiplier (slow-mo / hit-stop later) */
  timeScale = 1;
  private acc = 0;
  private last = 0;
  private t = 0;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.renderer = new Renderer(canvas, ui);
    this.match = this.createMatch();
    this.kb.onPress((code) => this.onKey(code));
  }

  private defaultConfig(): MatchConfig {
    return {
      chars: [CHARACTERS[0], CHARACTERS[1]],
      names: [CHARACTERS[0].name, CHARACTERS[1].name],
      duration: 60,
    };
  }

  createMatch(config: MatchConfig = this.defaultConfig()): Match {
    const m = new Match(config);
    m.controllers[0] = new KeyboardController(this.kb, SCHEME_WASD);
    m.controllers[1] = new KeyboardController(this.kb, SCHEME_ARROWS);
    this.renderer.fx.attach(m);
    this.match = m;
    this.acc = 0;
    return m;
  }

  private onKey(code: string): void {
    if (code === 'Escape' || code === 'KeyP') {
      if (this.match.phase !== 'ended') this.setPaused(!this.paused);
    } else if (code === 'F3' || code === 'Backquote') {
      this.renderer.showFps = !this.renderer.showFps;
    } else if (this.match.phase === 'ended' && this.match.phaseT > 0.8 && (code === 'KeyR' || code === 'Enter' || code === 'Space')) {
      this.createMatch(this.match.config);
    }
  }

  setPaused(p: boolean): void {
    this.paused = p;
    this.kb.flushPresses();
  }

  start(): void {
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    // rAF timestamps can be slightly older than performance.now() -> clamp at 0
    const dtReal = Math.max(0, Math.min(MAX_FRAME, (now - this.last) / 1000));
    this.last = now;
    if (!this.paused) {
      this.t += dtReal;
      this.acc += dtReal * this.timeScale;
      while (this.acc >= DT) {
        this.match.step(DT);
        this.acc -= DT;
      }
      this.renderer.update(dtReal);
    }
    this.renderer.render(this.match, this.acc / DT, this.t, this.overlay());
    requestAnimationFrame(this.frame);
  };

  private overlay(): OverlayInfo | null {
    const m = this.match;
    if (this.paused) return { title: 'ПАУЗА', lines: ['Esc / P — продължи'] };
    if (m.phase === 'ended' && m.phaseT > 0.6) {
      const title = m.winner < 0 ? 'РАВЕНСТВО' : `ПОБЕДА: ${m.config.names[m.winner].toUpperCase()}`;
      return {
        title,
        color: m.winner < 0 ? '#ffffff' : '#ffd23f',
        lines: [`${m.score[0]} : ${m.score[1]}`, 'R / Enter — реванш'],
      };
    }
    return null;
  }
}
