import { SIM_HZ } from '../core/constants';
import { lerp } from '../core/math';
import { Arena } from '../physics/arena';
import { Ball } from '../physics/ball';
import type { Expression } from './characters';
import type { Match, MatchConfig, MatchPhase } from './match';
import { Player } from './player';
import type { ActiveEffect, PowerItem } from './powerups';
import { SUPER_INFO } from './supers';

/** Everything needed to redraw one player in one frame. */
interface PlayerSnap {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  footX: number;
  footY: number;
  footAngle: number;
  kickT: number;
  expr: Expression;
  squash: number;
  lookX: number;
  lookY: number;
  headScale: number;
  frozenT: number;
  stunT: number;
  fireT: number;
  charged: boolean;
  runPhase: number;
  blink: number;
  dashT: number;
  dashDir: number;
  slowT: number;
  noJumpT: number;
  shrinkT: number;
  burnT: number;
}

interface Snap {
  bx: number;
  by: number;
  angle: number;
  r: number;
  hidden: boolean;
  fireT: number;
  superColor: string | null;
  p: [PlayerSnap, PlayerSnap];
  goalTop: [number, number];
  items: PowerItem[];
}

const SECONDS = 3.2;
const SIZE = Math.ceil(SECONDS * SIM_HZ);

const snapPlayer = (p: Player, out?: PlayerSnap): PlayerSnap => {
  const s = out ?? ({} as PlayerSnap);
  s.x = p.x;
  s.y = p.y;
  s.vx = p.vx;
  s.vy = p.vy;
  s.grounded = p.grounded;
  s.footX = p.footX;
  s.footY = p.footY;
  s.footAngle = p.footAngle;
  s.kickT = p.kickT;
  s.expr = p.expr;
  s.squash = p.squash;
  s.lookX = p.lookX;
  s.lookY = p.lookY;
  s.headScale = p.headScale;
  s.frozenT = p.frozenT;
  s.stunT = p.stunT;
  s.fireT = p.fireT;
  s.charged = p.charged;
  s.runPhase = p.runPhase;
  s.blink = p.blink;
  s.dashT = p.dashT;
  s.dashDir = p.dashDir;
  s.slowT = p.slowT;
  s.noJumpT = p.noJumpT;
  s.shrinkT = p.shrinkT;
  s.burnT = p.burnT;
  return s;
};

/** Ring buffer of the last few seconds, filled every simulation step. */
export class Recorder {
  private buf: Snap[] = [];
  private head = 0;
  private count = 0;

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  record(m: Match): void {
    let s = this.buf[this.head];
    if (!s) {
      s = {
        bx: 0,
        by: 0,
        angle: 0,
        r: 0,
        hidden: false,
        fireT: 0,
        superColor: null,
        p: [snapPlayer(m.players[0]), snapPlayer(m.players[1])],
        goalTop: [0, 0],
        items: [],
      };
      this.buf[this.head] = s;
    }
    const b = m.ball;
    s.bx = b.x;
    s.by = b.y;
    s.angle = b.angle;
    s.r = b.r;
    s.hidden = m.superShot?.hidden ?? false;
    s.fireT = b.fireT;
    s.superColor = m.superShot && !m.superShot.done ? SUPER_INFO[m.superShot.id].color : null;
    snapPlayer(m.players[0], s.p[0]);
    snapPlayer(m.players[1], s.p[1]);
    s.goalTop[0] = m.arena.goalTop[0];
    s.goalTop[1] = m.arena.goalTop[1];
    s.items = m.powerups.items.map((it) => ({ ...it }));
    this.head = (this.head + 1) % SIZE;
    this.count = Math.min(SIZE, this.count + 1);
  }

  /** Deep copy of the recorded frames, oldest first. */
  take(): Snap[] {
    const out: Snap[] = [];
    for (let i = 0; i < this.count; i++) {
      const s = this.buf[(this.head - this.count + i + SIZE) % SIZE];
      out.push({ ...s, p: [{ ...s.p[0] }, { ...s.p[1] }], goalTop: [s.goalTop[0], s.goalTop[1]], items: s.items });
    }
    return out;
  }
}

/** A read-only stand-in for Match that the renderer can draw. */
export interface ReplayView {
  arena: Arena;
  ball: Ball;
  players: [Player, Player];
  superShot: null;
  decoys: [];
  shockwave: null;
  callout: null;
  banner: null;
  config: MatchConfig;
  score: [number, number];
  timeLeft: number;
  golden: boolean;
  phase: MatchPhase;
  powerups: { items: PowerItem[]; active: ActiveEffect[] };
  /** colour of the super shot glow in this frame */
  superColor: string | null;
  ballFire: number;
}

/**
 * Plays recorded frames back in slow motion: normal-ish speed during the
 * build-up, very slow around the moment the ball crosses the line.
 */
export class ReplayPlayer {
  readonly view: ReplayView;
  private pos = 0;
  t = 0;
  done = false;
  private goalIndex: number;

  constructor(
    private frames: Snap[],
    m: Match,
    /** how many frames after the goal moment are included */
    afterGoal: number,
  ) {
    this.goalIndex = Math.max(0, frames.length - 1 - afterGoal);
    // start ~1.8 s before the goal
    this.pos = Math.max(0, this.goalIndex - Math.round(1.8 * SIM_HZ));
    const ghosts: [Player, Player] = [new Player(0, m.players[0].char), new Player(1, m.players[1].char)];
    const arena = new Arena();
    this.view = {
      arena,
      ball: new Ball(),
      players: ghosts,
      superShot: null,
      decoys: [],
      shockwave: null,
      callout: null,
      banner: null,
      config: m.config,
      score: [m.score[0], m.score[1]],
      timeLeft: m.timeLeft,
      golden: m.golden,
      phase: 'goal',
      powerups: { items: [], active: [] },
      superColor: null,
      ballFire: 0,
    };
    this.apply(0);
  }

  /** Current playback speed (fraction of real time). */
  private speed(): number {
    const d = (this.goalIndex - this.pos) / SIM_HZ; // seconds before the goal
    if (d > 0.7) return 0.75;
    if (d > -0.25) return 0.32;
    return 0.6;
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    this.pos += dt * SIM_HZ * this.speed();
    if (this.pos >= this.frames.length - 1) {
      this.pos = this.frames.length - 1;
      this.done = true;
    }
    this.apply(this.pos);
  }

  private apply(pos: number): void {
    const i = Math.min(this.frames.length - 1, Math.floor(pos));
    const j = Math.min(this.frames.length - 1, i + 1);
    const a = this.frames[i];
    const b = this.frames[j];
    const k = pos - i;
    const v = this.view;
    const ball = v.ball;
    ball.px = ball.x = lerp(a.bx, b.bx, k);
    ball.py = ball.y = lerp(a.by, b.by, k);
    ball.pangle = ball.angle = lerp(a.angle, b.angle, k);
    ball.r = b.r;
    ball.fireT = b.fireT;
    v.superColor = b.superColor;
    v.ballFire = b.fireT;
    (ball as Ball & { hiddenInReplay?: boolean }).hiddenInReplay = b.hidden;
    for (let n = 0; n < 2; n++) {
      const g = v.players[n];
      const sa = a.p[n];
      const sb = b.p[n];
      g.px = g.x = lerp(sa.x, sb.x, k);
      g.py = g.y = lerp(sa.y, sb.y, k);
      g.vx = sb.vx;
      g.vy = sb.vy;
      g.grounded = sb.grounded;
      g.footX = lerp(sa.footX, sb.footX, k);
      g.footY = lerp(sa.footY, sb.footY, k);
      g.footAngle = lerp(sa.footAngle, sb.footAngle, k);
      g.kickT = sb.kickT;
      g.expr = sb.expr;
      g.squash = lerp(sa.squash, sb.squash, k);
      g.lookX = sb.lookX;
      g.lookY = sb.lookY;
      g.headScale = sb.headScale;
      g.frozenT = sb.frozenT;
      g.stunT = sb.stunT;
      g.fireT = sb.fireT;
      g.charged = sb.charged;
      g.runPhase = lerp(sa.runPhase, sb.runPhase, k);
      g.blink = sb.blink;
      g.dashT = sb.dashT;
      g.dashDir = sb.dashDir;
      g.slowT = sb.slowT;
      g.noJumpT = sb.noJumpT;
      g.shrinkT = sb.shrinkT;
      g.burnT = sb.burnT;
    }
    if (v.arena.goalTop[0] !== b.goalTop[0]) v.arena.setGoalTop(0, b.goalTop[0]);
    if (v.arena.goalTop[1] !== b.goalTop[1]) v.arena.setGoalTop(1, b.goalTop[1]);
    v.powerups.items = b.items;
  }
}
