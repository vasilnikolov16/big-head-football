import { AIController, type Difficulty } from '../ai/aiController';
import { AudioEngine } from '../audio/audio';
import { GameAudio } from '../audio/gameAudio';
import { Music } from '../audio/music';
import { DT } from '../core/constants';
import { loadSettings, saveSettings, type Settings } from '../core/storage';
import { setLang, t, tr, onLangChange } from '../i18n/i18n';
import { KeyboardController, menuKeys, type Controller } from '../input/controls';
import { Keyboard } from '../input/keyboard';
import { MultiController, TouchControls } from '../input/touch';
import { touchLayoutScreen } from '../ui/touchLayoutUi';
import { OnlineSession } from '../net/online';
import { Renderer } from '../render/renderer';
import { heroSelect } from '../ui/heroSelect';
import { cpuSetup, howToPlay, mainMenu, pauseScreen, postMatch, type AppActions, type MatchMode } from '../ui/screens';
import { settingsScreen } from '../ui/settingsUi';
import { statsScreen } from '../ui/statsUi';
import { Toaster } from '../ui/toast';
import { tournamentScreen, trophyScreen } from '../ui/tournamentUi';
import { UI } from '../ui/ui';
import { Career, TOURNAMENT_DIFFICULTY, type CareerResult } from './career';
import { CHARACTERS, getCharacter, type CharacterDef } from './characters';
import { Match } from './match';
import { Recorder, ReplayPlayer } from './replay';
import { MatchTracker } from './tracker';

const MAX_FRAME = 0.1; // never simulate more than 100 ms per frame (tab switches etc.)
const POST_MATCH_DELAY = 1.6;
/** seconds of live celebration before the replay starts */
const REPLAY_DELAY = 1.5;
/** frames recorded after the ball crossed the line */
const REPLAY_AFTER = 50;

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
  readonly career = new Career();
  settings: Settings = loadSettings();
  match!: Match;
  setup!: MatchSetup;
  paused = false;
  /** global time multiplier */
  timeScale = 1;
  private acc = 0;
  private last = 0;
  private t = 0;
  private postShown = false;
  readonly audio = new AudioEngine();
  private music = new Music(this.audio);
  private gameAudio = new GameAudio(this.audio);
  private recorder = new Recorder();
  private replay: ReplayPlayer | null = null;
  /** match time at which the goal replay should start, or -1 */
  private replayAt = -1;
  private tracker: MatchTracker | null = null;
  private touch: TouchControls;
  private toaster: Toaster;
  private sawTouch = false;
  readonly online: OnlineSession = new OnlineSession(this);

  constructor(canvas: HTMLCanvasElement, uiHost: HTMLElement) {
    setLang(this.settings.lang);
    this.renderer = new Renderer(canvas, uiHost);
    this.touch = new TouchControls(uiHost);
    this.touch.onPause = () => this.onKey('Escape');
    this.touch.onFirstTouch = () => this.onFirstTouch();
    this.touch.onEmote = (i) => this.online.emote(i);
    onLangChange(() => this.touch.relabel());
    this.ui = new UI(uiHost);
    this.toaster = new Toaster(uiHost, () => this.audio.play('powerPick', 0.8));
    this.ui.onSound = (snd) => this.audio.play(snd === 'move' ? 'uiMove' : snd === 'select' ? 'uiSelect' : 'uiBack');
    this.audio.onReady = () => this.music.start();
    this.music.setMood('menu');
    this.kb.onPress((code) => this.onKey(code));
    this.onSettingsChanged();
    this.startDemo();
    this.showMain();
    // a shared room link: ?room=K7QX
    const code = new URLSearchParams(location.search).get('room');
    if (code) {
      history.replaceState(null, '', location.pathname);
      this.online.open(code, '', true);
    }
  }

  /** On-screen buttons are used (phone / tablet, or forced in the settings). */
  get touchMode(): boolean {
    const s = this.settings.touch;
    if (s === 'on') return true;
    if (s === 'off') return false;
    return this.sawTouch || window.matchMedia('(pointer: coarse)').matches;
  }

  private onFirstTouch(): void {
    if (this.sawTouch) return;
    this.sawTouch = true;
    // phones: go full screen and lock landscape where the browser allows it
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        void el.requestFullscreen().then(() => {
          const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
          o.lock?.('landscape').catch(() => {});
        }, () => {});
      }
    } catch {
      /* not supported (iOS Safari) */
    }
    if (this.ui.screenId === 'main') this.showMain();
  }

  // ------------------------------------------------------------------ matches

  private startMatch(setup: MatchSetup): void {
    this.setup = setup;
    const names: [string, string] = [tr(setup.chars[0].name), tr(setup.chars[1].name)];
    let tags: [string, string];
    if (setup.mode === 'cpu' || setup.mode === 'tournament') tags = [t('you'), t(`tag.${setup.difficulty}`)];
    else if (setup.mode === 'pvp') tags = ['P1', 'P2'];
    else tags = ['CPU', 'CPU'];
    const m = new Match({
      chars: setup.chars,
      names,
      tags,
      duration: setup.duration,
      powerups: setup.mode === 'demo' ? true : this.settings.powerups,
    });
    const c = this.settings.controls;
    if (setup.mode === 'pvp') {
      m.controllers[0] = new KeyboardController(this.kb, c.p1);
      m.controllers[1] = new KeyboardController(this.kb, c.p2);
    } else if (setup.mode === 'cpu' || setup.mode === 'tournament') {
      const keys: Controller = new KeyboardController(this.kb, setup.humanScheme === 'wasd' ? c.p1 : c.p2);
      m.controllers[0] = new MultiController([keys, this.touch]);
      m.controllers[1] = new AIController(m, 1, setup.difficulty);
    } else {
      m.controllers[0] = new AIController(m, 0, Math.random() < 0.5 ? 'medium' : 'hard');
      m.controllers[1] = new AIController(m, 1, Math.random() < 0.5 ? 'medium' : 'hard');
    }
    this.match = m;
    const demo = setup.mode === 'demo';
    this.renderer.fx.attach(m, !demo && this.settings.cinematic);
    // the menu background match is silent: only the light menu music plays
    if (demo) this.gameAudio.detach();
    else this.gameAudio.attach(m);
    this.tracker = demo ? null : new MatchTracker(m);
    this.recorder.clear();
    this.replay = null;
    this.replayAt = -1;
    m.events.on('goal', () => {
      if (!demo && this.settings.replays) this.replayAt = m.time + REPLAY_DELAY;
    });
    this.music.setMood(demo ? 'menu' : 'match');
    this.touch.clear();
    this.acc = 0;
    this.paused = false;
    this.postShown = false;
    this.kb.flushPresses();
  }

  startDemo(): void {
    const a = Math.floor(Math.random() * CHARACTERS.length);
    const b = (a + 1) % CHARACTERS.length;
    this.startMatch({ mode: 'demo', chars: [CHARACTERS[a], CHARACTERS[b]], difficulty: 'hard', humanScheme: 'wasd', duration: 90 });
  }

  // ------------------------------------------------------------------ online

  showOnline(): void {
    this.online.open();
  }

  /** Controls of the player on this device: both key sets + touch, idle while a menu is open. */
  localController(): Controller {
    const c = this.settings.controls;
    const all = new MultiController([new KeyboardController(this.kb, c.p1), new KeyboardController(this.kb, c.p2), this.touch]);
    return {
      read: (out) => {
        all.read(out);
        if (this.ui.active) {
          out.move = 0;
          out.jumpHeld = out.jumpPressed = out.kickPressed = out.superPressed = false;
          out.dash = 0;
        }
      },
    };
  }

  /** The online session hands over a match (host: the real one, guest: the mirror). */
  beginOnlineMatch(m: Match): void {
    this.setup = { mode: 'online', chars: m.config.chars, difficulty: 'medium', humanScheme: 'wasd', duration: m.config.duration };
    this.match = m;
    this.renderer.fx.attach(m, this.settings.cinematic);
    this.gameAudio.attach(m);
    this.tracker = null;
    this.recorder.clear();
    this.replay = null;
    this.replayAt = -1;
    this.music.setMood('match');
    this.touch.clear();
    this.acc = 0;
    this.paused = false;
    this.postShown = false;
    this.kb.flushPresses();
  }

  /** back to the menu background match */
  endOnlineMatch(): void {
    this.paused = false;
    this.replay = null;
    this.startDemo();
  }

  toast(icon: string, title: string, body: string): void {
    this.toaster.show(icon, title, body);
  }

  // ------------------------------------------------------------------ AppActions

  saveSettings(): void {
    saveSettings(this.settings);
  }

  /** Settings that need to be pushed to running systems (audio, input, HUD). */
  onSettingsChanged(): void {
    const c = this.settings.controls;
    this.kb.setGameKeys([...Object.values(c.p1).flat(), ...Object.values(c.p2).flat()]);
    this.audio.setVolumes(this.settings.sfxVolume, this.settings.musicVolume);
    this.renderer.showFps = this.settings.showFps;
    this.renderer.fx.shakeOn = this.settings.shake;
    this.renderer.setMaxDpr(this.settings.quality === 'high' ? 2 : this.settings.quality === 'normal' ? 1.5 : 1);
    this.touch.applySettings(this.settings);
    if (this.match && this.setup.mode !== 'demo' && this.setup.mode !== 'online') {
      this.match.powerups.enabled = this.settings.powerups;
      if (!this.settings.powerups) this.match.powerups.endAll(this.match);
    }
  }

  resetProgress(): void {
    this.career.reset();
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

  showPause(): void {
    this.ui.show(pauseScreen(this));
  }

  /** Layout editor for the on-screen buttons (from the settings). */
  editTouchLayout(back: () => void): void {
    this.ui.show(
      touchLayoutScreen({
        settings: this.settings,
        touch: this.touch,
        save: () => {
          this.saveSettings();
          this.onSettingsChanged();
        },
        back,
      }),
    );
  }

  showSettings(back: () => void): void {
    this.ui.show(settingsScreen(this, back));
  }

  showStats(): void {
    this.ui.show(statsScreen(this.career, this.ui, () => this.showMain()));
  }

  private heroLabel(): string {
    return t(`tag.${this.settings.difficulty}`);
  }

  showHeroSelect(mode: 'cpu' | 'pvp' | 'tournament'): void {
    const hs = this.settings.heroes;
    this.ui.show(
      heroSelect({
        mode,
        initial: mode === 'pvp' ? [hs.p1, hs.p2] : [hs.p1, hs.cpu],
        isLocked: (c) => !this.career.isUnlocked(c.id),
        rightLabel: this.heroLabel(),
        keys: [menuKeys(this.settings.controls.p1, 'Space', 'KeyQ'), menuKeys(this.settings.controls.p2, 'Enter', 'Backspace')],
        sound: (snd) => this.ui.onSound(snd),
        onBack: () => (mode === 'cpu' ? this.showCpuSetup() : this.showMain()),
        onDone: (a, b) => {
          hs.p1 = a.id;
          if (mode === 'cpu') hs.cpu = b.id;
          else if (mode === 'pvp') hs.p2 = b.id;
          this.saveSettings();
          if (mode === 'tournament') {
            this.career.startTournament(a.id);
            this.showTournament();
            return;
          }
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

  showTournament(): void {
    if (this.setup?.mode !== 'demo') this.startDemo();
    if (!this.career.p.tournament) {
      this.showHeroSelect('tournament');
      return;
    }
    this.ui.show(
      tournamentScreen(this.career, {
        play: () => this.playTournamentRound(),
        restart: () => {
          this.career.abandonTournament();
          this.showHeroSelect('tournament');
        },
        back: () => this.showMain(),
      }),
    );
  }

  private playTournamentRound(): void {
    const run = this.career.p.tournament;
    if (!run) return;
    this.ui.hide();
    this.startMatch({
      mode: 'tournament',
      chars: [getCharacter(run.hero), getCharacter(run.order[run.round])],
      difficulty: TOURNAMENT_DIFFICULTY(run.round),
      humanScheme: this.settings.humanScheme,
      duration: this.settings.duration,
    });
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
    this.touch.clear();
  }

  restart(): void {
    this.rematch();
  }

  quitToMenu(): void {
    if (this.online.active) {
      this.online.leave();
      return;
    }
    this.paused = false;
    this.replay = null;
    this.startDemo();
    this.showMain();
  }

  // ------------------------------------------------------------------ input

  private onKey(code: string): void {
    if (code === 'F3' || code === 'Backquote') {
      this.settings.showFps = !this.settings.showFps;
      this.saveSettings();
      this.onSettingsChanged();
      return;
    }
    if (this.ui.active) {
      this.ui.handleKey(code);
      return;
    }
    if (this.setup.mode === 'online') {
      if (code === 'Escape' || code === 'KeyP') {
        this.online.showMenu();
        return;
      }
      // emotes on 1-4 (unless those keys are bound to the game)
      const d = /^(?:Digit|Numpad)([1-4])$/.exec(code);
      const c = this.settings.controls;
      const bound = [...Object.values(c.p1).flat(), ...Object.values(c.p2).flat()].includes(code);
      if (d && !bound) this.online.emote(Number(d[1]) - 1);
      return;
    }
    // any key skips the slow-motion replay
    if (this.replay && this.replay.t > 0.4) {
      this.replay.done = true;
      return;
    }
    if (this.setup.mode !== 'demo' && this.match.phase !== 'ended' && (code === 'Escape' || code === 'KeyP')) {
      this.paused = true;
      this.showPause();
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
    const fx = this.renderer.fx;
    const demo = this.setup.mode === 'demo';
    const net = this.setup.mode === 'online' ? this.online : null;
    if (!this.paused) {
      this.t += dtReal;
      if (net && !net.simulates) {
        // guest: the host simulates; show its stream (its hit-stops are already in it)
        net.frameBefore(now);
        fx.hitStop = 0;
      } else if (this.replay) {
        this.replay.update(dtReal);
        if (this.replay.done) {
          this.replay = null;
          this.kb.flushPresses();
        }
      } else if (fx.hitStop > 0) {
        // hit-stop: freeze the simulation for a few frames on big impacts
        fx.hitStop = Math.max(0, fx.hitStop - dtReal);
      } else if (net && !net.frameBefore(now)) {
        // host waiting for the guest
        this.acc = 0;
      } else {
        // super-shot cinematic slows the game down for a moment
        this.acc += dtReal * this.timeScale * fx.cinematic.timeFactor();
        while (this.acc >= DT) {
          this.match.step(DT);
          if (net) net.afterStep();
          else this.recorder.record(this.match);
          this.acc -= DT;
          if (this.replayAt >= 0 && this.match.time >= this.replayAt) {
            this.replayAt = -1;
            this.replay = new ReplayPlayer(this.recorder.take(), this.match, REPLAY_AFTER);
            this.acc = 0;
            break;
          }
        }
      }
      if (net) net.frameAfter(now);
      this.renderer.update(dtReal);
      this.audio.setCrowd(demo ? 0 : this.renderer.stadium.excitement * this.settings.crowdVolume);
      if (!this.replay && !net) this.checkMatchOver();
    }
    // on-screen buttons only while a match against the computer is being played
    const playing = !demo && !this.ui.active && !this.replay && this.setup.mode !== 'pvp' && this.match.phase !== 'ended';
    this.touch.setVisible(this.touchMode && playing);
    this.touch.setEmotes(!!net);
    const me = this.match.players[net ? net.side : 0];
    this.touch.setSuperReady(me.energy >= 1, me.charged);

    if (this.replay) {
      const v = this.replay.view;
      this.renderer.render(v, 1, this.t, { hud: true, replayT: this.replay.t, replayGlow: v.superColor });
    } else {
      const alpha = net && !net.simulates ? 1 : this.acc / DT;
      this.renderer.render(this.match, alpha, this.t, { hud: !demo, net: net ? net.netInfo() : undefined });
    }
    requestAnimationFrame(this.frame);
  };

  private checkMatchOver(): void {
    const m = this.match;
    if (m.phase !== 'ended' || m.phaseT < POST_MATCH_DELAY) return;
    if (this.setup.mode === 'demo') {
      this.startDemo();
      return;
    }
    if (this.postShown) return;
    this.postShown = true;
    const mode = this.setup.mode;
    let result: CareerResult | null = null;
    if (this.tracker) {
      result = this.career.record({
        mode,
        humans: mode === 'pvp' ? [0, 1] : [0],
        heroes: [this.setup.chars[0].id, this.setup.chars[1].id],
        difficulty: this.setup.difficulty,
        summary: this.tracker.finish(),
      });
      for (const a of result.achievements) this.toaster.show(a.icon, t('ach.unlocked'), tr(a.name));
      for (const id of result.unlockedHeroes) this.toaster.show('🔓', t('tour.unlocked', { h: tr(getCharacter(id).name) }), '');
    }
    const r = result;
    this.ui.show(
      postMatch(this, m, mode, {
        career: r,
        onContinue: () => {
          if (r?.cupWon) {
            const hero = this.setup.chars[0].id; // read before the demo match replaces the setup
            this.startDemo();
            this.ui.show(trophyScreen(hero, r.flawless, r.unlockedHeroes, () => this.showMain()));
            this.audio.play('goal');
          } else this.showTournament();
        },
      }),
    );
  }
}
