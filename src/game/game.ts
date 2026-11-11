import { AIController, type Difficulty } from '../ai/aiController';
import { DT } from '../core/constants';
import { loadSettings, saveSettings, type Settings } from '../core/storage';
import { KeyboardController, menuKeys } from '../input/controls';
import { Keyboard } from '../input/keyboard';
import { Renderer } from '../render/renderer';
import {
  controlsScreen,
  cpuSetup,
  howToPlay,
  mainMenu,
  pauseScreen,
  postMatch,
  settingsScreen,
  type AppActions,
  type MatchMode,
} from '../ui/screens';
import { heroSelect } from '../ui/heroSelect';
import { UI } from '../ui/ui';
import { CHARACTERS, type CharacterDef } from './characters';
import { Match } from './match';

const MAX_FRAME = 0.1; // never simulate more than 100 ms per frame (tab switches etc.)
const POST_MATCH_DELAY = 1.6;

const DIFF_LABEL: Record<Difficulty, string> = { easy: 'CPU · лесно', medium: 'CPU · средно', hard: 'CPU · трудно' };

export interface MatchSetup {
  mode: MatchMode;
  chars: [CharacterDef, CharacterDef];
  difficulty: Difficulty;
  /** for vs-CPU: which keys the human uses */
  humanScheme: 'wasd' | 'arrows';
  duration: number;
}

/** Owns the main loop (fixed 120 Hz simulation + interpolated rendering) and the app flow. */
export class Game implements AppActions {
  readonly kb = new Keyboard();
  readonly renderer: Renderer;
  readonly ui: UI;
  settings: Settings = loadSettings();
  match!: Match;
  setup!: MatchSetup;
  paused = false;
  /** global time multiplier (slow-mo / hit-stop later) */
  timeScale = 1;
  private acc = 0;
  private last = 0;
  private t = 0;
  private postShown = false;

  constructor(canvas: HTMLCanvasElement, uiHost: HTMLElement) {
    this.renderer = new Renderer(canvas, uiHost);
    this.ui = new UI(uiHost);
    this.kb.onPress((code) => this.onKey(code));
    this.onSettingsChanged();
    this.startDemo();
    this.showMain();
  }

  // ------------------------------------------------------------------ matches

  private startMatch(setup: MatchSetup): void {
    this.setup = setup;
    const names: [string, string] = [setup.chars[0].name, setup.chars[1].name];
    let tags: [string, string];
    if (setup.mode === 'cpu') tags = ['ТИ', DIFF_LABEL[setup.difficulty]];
    else if (setup.mode === 'pvp') tags = ['P1', 'P2'];
    else tags = ['CPU', 'CPU'];
    const m = new Match({ chars: setup.chars, names, tags, duration: setup.duration });
    if (setup.mode === 'pvp') {
      m.controllers[0] = new KeyboardController(this.kb, this.settings.controls.p1);
      m.controllers[1] = new KeyboardController(this.kb, this.settings.controls.p2);
    } else if (setup.mode === 'cpu') {
      const c = this.settings.controls;
      m.controllers[0] = new KeyboardController(this.kb, setup.humanScheme === 'wasd' ? c.p1 : c.p2);
      m.controllers[1] = new AIController(m, 1, setup.difficulty);
    } else {
      m.controllers[0] = new AIController(m, 0, Math.random() < 0.5 ? 'medium' : 'hard');
      m.controllers[1] = new AIController(m, 1, Math.random() < 0.5 ? 'medium' : 'hard');
    }
    this.match = m;
    this.renderer.fx.attach(m);
    this.acc = 0;
    this.paused = false;
    this.postShown = false;
    this.kb.flushPresses();
  }

  private startDemo(): void {
    const a = Math.floor(Math.random() * CHARACTERS.length);
    const b = (a + 1) % CHARACTERS.length;
    this.startMatch({
      mode: 'demo',
      chars: [CHARACTERS[a], CHARACTERS[b]],
      difficulty: 'hard',
      humanScheme: 'wasd',
      duration: 90,
    });
  }


  // ------------------------------------------------------------------ AppActions

  saveSettings(): void {
    saveSettings(this.settings);
  }

  showMain(): void {
    if (this.setup?.mode !== 'demo') this.startDemo();
    this.ui.show(mainMenu(this));
  }

  showCpuSetup(): void {
    this.ui.show(cpuSetup(this));
  }

  showHowTo(back: () => void): void {
    this.ui.show(howToPlay(this, back));
  }

  showControls(back: () => void): void {
    this.ui.show(controlsScreen(this, back));
  }

  showPause(): void {
    this.ui.show(pauseScreen(this));
  }

  /** Settings that need to be pushed to running systems (audio, input). */
  onSettingsChanged(): void {
    const c = this.settings.controls;
    this.kb.setGameKeys([...Object.values(c.p1).flat(), ...Object.values(c.p2).flat()]);
  }

  showSettings(back: () => void): void {
    this.ui.show(settingsScreen(this, back));
  }

  showHeroSelect(mode: 'cpu' | 'pvp'): void {
    const hs = this.settings.heroes;
    this.ui.show(
      heroSelect({
        mode,
        initial: mode === 'cpu' ? [hs.p1, hs.cpu] : [hs.p1, hs.p2],
        isLocked: () => false, // unlocking arrives with the tournament (stage 5)
        rightLabel: DIFF_LABEL[this.settings.difficulty],
        keys: [
          menuKeys(this.settings.controls.p1, 'Space', 'KeyQ'),
          menuKeys(this.settings.controls.p2, 'Enter', 'Backspace'),
        ],
        sound: (snd) => this.ui.onSound(snd),
        onBack: () => (mode === 'cpu' ? this.showCpuSetup() : this.showMain()),
        onDone: (a, b) => {
          hs.p1 = a.id;
          if (mode === 'cpu') hs.cpu = b.id;
          else hs.p2 = b.id;
          this.saveSettings();
          this.ui.hide();
          this.startMatch({
            mode,
            chars: [a, b],
            difficulty: this.settings.difficulty,
            humanScheme: mode === 'cpu' ? this.settings.humanScheme : 'wasd',
            duration: this.settings.duration,
          });
        },
      }),
    );
  }

  startPvp(): void {
    this.showHeroSelect('pvp');
  }

  rematch(): void {
    this.ui.hide();
    this.startMatch({ ...this.setup });
  }

  changeHeroes(): void {
    const mode = this.setup.mode === 'cpu' ? 'cpu' : 'pvp';
    this.startDemo();
    this.showHeroSelect(mode);
  }

  resume(): void {
    this.ui.hide();
    this.paused = false;
    this.kb.flushPresses();
  }

  restart(): void {
    this.rematch();
  }

  quitToMenu(): void {
    this.paused = false;
    this.startDemo();
    this.showMain();
  }

  // ------------------------------------------------------------------ input

  private onKey(code: string): void {
    if (code === 'F3' || code === 'Backquote') {
      this.renderer.showFps = !this.renderer.showFps;
      return;
    }
    if (this.ui.active) {
      this.ui.handleKey(code);
      return;
    }
    if (this.setup.mode !== 'demo' && this.match.phase !== 'ended' && (code === 'Escape' || code === 'KeyP')) {
      this.paused = true;
      this.ui.show(pauseScreen(this));
    }
  }

  // ------------------------------------------------------------------ loop

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
      this.checkMatchOver();
    }
    this.renderer.render(this.match, this.acc / DT, this.t, { hud: this.setup.mode !== 'demo' });
    requestAnimationFrame(this.frame);
  };

  private checkMatchOver(): void {
    const m = this.match;
    if (m.phase !== 'ended' || m.phaseT < POST_MATCH_DELAY) return;
    if (this.setup.mode === 'demo') {
      this.startDemo();
      return;
    }
    if (!this.postShown) {
      this.postShown = true;
      this.ui.show(postMatch(this, m, this.setup.mode));
    }
  }
}
