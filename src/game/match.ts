import { GOAL_DEPTH, START_X, W } from '../core/constants';
import { Emitter, type GameEvents, type Surface } from '../core/events';
import { rand } from '../core/math';
import { emptyIntent, type Controller, type PlayerIntent } from '../input/controls';
import { Arena } from '../physics/arena';
import { Ball, makeImpactLog, stepBall, collideBallWorld } from '../physics/ball';
import type { CharacterDef } from './characters';
import { ballVsPlayer, playerVsPlayer, separatePlayerFromBall } from './interactions';
import { Player } from './player';
import { SUPER_INFO, SuperShot, updateDecoys, type Decoy } from './supers';

export type MatchPhase = 'kickoff' | 'playing' | 'goal' | 'ended';

export interface MatchConfig {
  chars: [CharacterDef, CharacterDef];
  names: [string, string];
  /** short labels under the names, e.g. "P1", "CPU" */
  tags: [string, string];
  duration: number; // seconds
}

/** Short text that pops up above a player (super shot names). */
export interface Callout {
  text: string;
  color: string;
  player: number;
  t: number;
}

export interface Banner {
  text: string;
  sub?: string;
  color: string;
  t: number; // time since shown
  dur: number;
}

const KICKOFF_TIME = 1.1;
const GOAL_TIME = 2.6;
const BALL_DROP_Y = 170;
const KICKOFF_SHIFT = 90;

export class Match {
  readonly events = new Emitter<GameEvents>();
  readonly arena = new Arena();
  readonly ball = new Ball();
  readonly players: [Player, Player];
  readonly controllers: [Controller | null, Controller | null] = [null, null];
  private intents: [PlayerIntent, PlayerIntent] = [emptyIntent(), emptyIntent()];
  private idle = emptyIntent();
  private impacts = makeImpactLog();

  config: MatchConfig;
  score: [number, number] = [0, 0];
  timeLeft: number;
  golden = false;
  phase: MatchPhase = 'kickoff';
  phaseT = 0;
  time = 0;
  lastScorer = -1;
  winner = -1;
  banner: Banner | null = null;
  /** seconds of possession per player */
  possession: [number, number] = [0, 0];
  /** active super shot, if any */
  superShot: SuperShot | null = null;
  /** ninja decoy balls */
  decoys: Decoy[] = [];
  callout: Callout | null = null;
  /** ground shockwave (thunder super) */
  shockwave: { x: number; t: number } | null = null;
  /** number of super shots fired per player */
  supersUsed: [number, number] = [0, 0];

  constructor(config: MatchConfig) {
    this.config = config;
    this.timeLeft = config.duration;
    this.players = [new Player(0, config.chars[0]), new Player(1, config.chars[1])];
    this.setupKickoff();
    this.showBanner('ГОТОВИ?', '#ffffff', 1.0);
  }

  showBanner(text: string, color: string, dur: number, sub?: string): void {
    this.banner = { text, color, dur, t: 0, sub };
  }

  private setupKickoff(): void {
    this.phase = 'kickoff';
    this.phaseT = 0;
    this.players[0].resetPosition(START_X[0]);
    this.players[1].resetPosition(START_X[1]);
    // After a goal the ball drops slightly towards the side that conceded (no kickoff goal loops).
    const shift = this.lastScorer < 0 ? 0 : this.lastScorer === 0 ? KICKOFF_SHIFT : -KICKOFF_SHIFT;
    this.ball.reset(W / 2 + shift, BALL_DROP_Y);
    this.endSuper();
    this.decoys = [];
  }

  private endSuper(): void {
    if (this.superShot) this.superShot.finish(this);
    this.superShot = null;
    this.ball.gravityScale = 1;
  }

  private fireSuper(p: Player): void {
    this.endSuper();
    p.charged = false;
    p.energy = 0;
    const s = new SuperShot(p.char.super, p.index, this);
    this.superShot = s;
    s.start(this);
    this.supersUsed[p.index]++;
    p.setExpression('angry', 0.8);
    this.players[1 - p.index].setExpression('shock', 0.9);
    this.callout = { text: SUPER_INFO[s.id].name.toUpperCase() + '!', color: SUPER_INFO[s.id].color, player: p.index, t: 0 };
    this.events.emit('superShot', { player: p.index, id: s.id, x: this.ball.x, y: this.ball.y });
  }

  private releaseBall(): void {
    this.phase = 'playing';
    this.phaseT = 0;
    this.ball.vx = rand(-30, 30);
    this.ball.vy = 0;
    this.events.emit('whistle', { kind: 'start' });
  }

  step(dt: number): void {
    this.time += dt;
    this.phaseT += dt;
    if (this.banner) {
      this.banner.t += dt;
      if (this.banner.t > this.banner.dur) this.banner = null;
    }
    if (this.callout) {
      this.callout.t += dt;
      if (this.callout.t > 1.4) this.callout = null;
    }
    if (this.shockwave) {
      this.shockwave.t += dt;
      if (this.shockwave.t > 0.6) this.shockwave = null;
    }
    if (this.decoys.length) {
      updateDecoys(this.decoys, dt);
      this.decoys = this.decoys.filter((d) => d.alive);
    }

    const controllable = this.phase === 'playing' || this.phase === 'goal';
    for (let i = 0; i < 2; i++) {
      const p = this.players[i];
      p.savePrev();
      const intent = this.intents[i];
      const ctrl = this.controllers[i];
      if (ctrl) ctrl.read(intent);
      p.update(dt, controllable && ctrl ? intent : this.idle, this.arena, this.events);
    }
    playerVsPlayer(this.players[0], this.players[1]);

    // eyes follow the ball
    for (const p of this.players) {
      const dx = this.ball.x - p.headX;
      const dy = this.ball.y - p.headY;
      const d = Math.hypot(dx, dy) || 1;
      p.lookX += (dx / d - p.lookX) * Math.min(1, dt * 14);
      p.lookY += (dy / d - p.lookY) * Math.min(1, dt * 14);
    }

    this.ball.savePrev();
    if (this.phase === 'kickoff') {
      // the ball hovers at the top, waiting for the whistle
      this.ball.y = BALL_DROP_Y + Math.sin(this.phaseT * 6) * 4;
      this.ball.angle += dt * 2;
      if (this.phaseT >= KICKOFF_TIME) this.releaseBall();
    } else {
      this.stepBallAndContacts(dt);
    }

    if (this.phase === 'playing') {
      this.updatePossession(dt);
      this.checkGoal();
      if (this.phase === 'playing' && !this.golden) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.onTimeUp();
        }
      }
    } else if (this.phase === 'goal' && this.phaseT >= GOAL_TIME) {
      if (this.golden || this.timeLeft <= 0) this.endMatch();
      else this.setupKickoff();
    }
  }

  private stepBallAndContacts(dt: number): void {
    const b = this.ball;
    const imp = this.impacts;
    imp.ground = imp.wall = imp.bar = imp.ceiling = 0;
    const sup = this.superShot;
    if (sup) sup.update(this, dt);
    if (sup?.hidden) {
      // teleporting: the ball is nowhere
      b.savePrev();
      if (sup.done) this.superShot = null;
      return;
    }
    stepBall(b, this.arena, dt, imp);
    if (sup) sup.afterStep(this, imp);

    for (const p of this.players) {
      if (sup && !sup.done) {
        const dx = b.x - p.headX;
        const dy = b.y - p.headY;
        const near = dx * dx + dy * dy < (b.r + p.headR + 6) ** 2 || Math.abs(b.x - p.x) < b.r + p.halfW && b.y > p.headY && b.y < p.y;
        if (sup.ignores(this, p, near)) continue;
      }
      const touchedBefore = b.lastTouch === p.index && b.sinceTouch === 0;
      ballVsPlayer(b, p, this.events);
      const touched = b.lastTouch === p.index && b.sinceTouch === 0 && !touchedBefore;
      if (touched) {
        if (p.charged) this.fireSuper(p);
        else if (sup && !sup.done) sup.finish(this); // blocked or touched again
      }
    }
    collideBallWorld(b, this.arena, imp, dt);
    for (const p of this.players) {
      if (this.superShot && !this.superShot.done && this.superShot.ignores(this, p, false)) continue;
      separatePlayerFromBall(b, p);
    }
    if (this.superShot?.done) {
      this.superShot = null;
      b.gravityScale = 1;
    }

    for (const s of ['ground', 'wall', 'bar', 'ceiling'] as Surface[]) {
      if (imp[s] > 70) this.events.emit('bounce', { surface: s, x: b.x, y: b.y, speed: imp[s] });
    }
  }

  private updatePossession(dt: number): void {
    const t = this.ball.lastTouch;
    if (t >= 0 && this.ball.sinceTouch < 4) this.possession[t] += dt;
  }

  private checkGoal(): void {
    const b = this.ball;
    if (this.superShot?.hidden) return;
    // The whole ball must cross the goal line, under the crossbar.
    if (b.x + b.r < GOAL_DEPTH && b.y > this.arena.goalTop[0]) this.onGoal(1);
    else if (b.x - b.r > W - GOAL_DEPTH && b.y > this.arena.goalTop[1]) this.onGoal(0);
  }

  private onGoal(scorer: 0 | 1): void {
    this.score[scorer]++;
    this.lastScorer = scorer;
    this.phase = 'goal';
    this.phaseT = 0;
    this.players[scorer].setExpression('happy', GOAL_TIME + 1);
    this.players[1 - scorer].setExpression(Math.random() < 0.5 ? 'sad' : 'angry', GOAL_TIME + 1);
    this.endSuper();
    const golden = this.golden;
    this.showBanner(golden ? 'ЗЛАТЕН ГОЛ!' : 'ГОЛ!', golden ? '#ffd23f' : '#ffffff', GOAL_TIME - 0.3, this.config.names[scorer]);
    this.events.emit('goal', { scorer, x: this.ball.x, y: this.ball.y, golden });
  }

  private onTimeUp(): void {
    if (this.score[0] === this.score[1]) {
      this.golden = true;
      this.events.emit('whistle', { kind: 'golden' });
      this.setupKickoff();
      this.phaseT = -0.8; // a bit longer pause before the golden-goal kickoff
      this.showBanner('ЗЛАТЕН ГОЛ', '#ffd23f', 1.9, 'Следващият гол печели!');
    } else {
      this.endMatch();
    }
  }

  private endMatch(): void {
    this.phase = 'ended';
    this.phaseT = 0;
    this.winner = this.score[0] > this.score[1] ? 0 : this.score[1] > this.score[0] ? 1 : -1;
    if (this.winner >= 0) {
      this.players[this.winner].setExpression('happy', 999);
      this.players[1 - this.winner].setExpression('sad', 999);
    }
    this.events.emit('whistle', { kind: 'end' });
    this.events.emit('matchEnd', { winner: this.winner });
  }
}
