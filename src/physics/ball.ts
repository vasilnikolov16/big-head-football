import {
  BALL_GRAVITY,
  BALL_R,
  GROUND_Y,
  MAX_BALL_SPEED,
  W,
} from '../core/constants';
import type { Surface } from '../core/events';
import { approach, clamp } from '../core/math';
import type { Arena } from './arena';
import { circleRect, makeContact, type Contact } from './collide';

/** Moment of inertia factor for a hollow sphere: I = k·m·r² */
const INERTIA_K = 2 / 3;
const MAGNUS = 0.0032;
const AIR_DRAG_LINEAR = 0.2; // 1/s
const AIR_DRAG_QUAD = 0.00014; // 1/px
const ROLL_RESIST = 1.3; // 1/s, damping while rolling on the ground
const ROLL_DECEL = 150; // px/s², constant rolling friction on grass

export class Ball {
  x = W / 2;
  y = 180;
  vx = 0;
  vy = 0;
  px = this.x;
  py = this.y;
  angle = 0;
  pangle = 0;
  /** angular velocity, rad/s; positive = clockwise on screen */
  spin = 0;
  r = BALL_R;
  grounded = false;
  /** index of the last player that touched the ball, -1 = nobody */
  lastTouch = -1;
  /** seconds since the ball was last touched by a player */
  sinceTouch = 99;
  /** extra multipliers set by power-ups */
  gravityScale = 1;
  /** seconds the ball keeps burning (fire-ball power-up) */
  fireT = 0;
  fireOwner = -1;

  reset(x: number, y: number): void {
    this.x = this.px = x;
    this.y = this.py = y;
    this.vx = this.vy = 0;
    this.spin = 0;
    this.lastTouch = -1;
    this.sinceTouch = 99;
    this.fireT = 0;
    this.fireOwner = -1;
  }

  savePrev(): void {
    this.px = this.x;
    this.py = this.y;
    this.pangle = this.angle;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }
}

/**
 * Resolve a contact between the ball and a (possibly moving) surface.
 * Handles restitution plus friction that couples linear and angular velocity,
 * so the ball picks up spin when it scrapes a surface and rolls naturally.
 * Returns the approach speed (0 if the bodies were already separating).
 */
export function resolveBallContact(
  b: Ball,
  c: Contact,
  restitution: number,
  friction: number,
  svx = 0,
  svy = 0,
): number {
  b.x += c.nx * c.pen;
  b.y += c.ny * c.pen;
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const vn = rvx * c.nx + rvy * c.ny;
  if (vn >= 0) return 0;
  // Kill micro-bounces so the ball can come to rest.
  const e = -vn < 45 ? 0 : restitution;
  const jn = -(1 + e) * vn;
  b.vx += jn * c.nx;
  b.vy += jn * c.ny;

  // Tangential friction impulse.
  const tx = -c.ny;
  const ty = c.nx;
  const slip = (b.vx - svx) * tx + (b.vy - svy) * ty - b.spin * b.r;
  const ideal = -slip * (INERTIA_K / (1 + INERTIA_K));
  const maxJ = friction * jn;
  const jt = clamp(ideal, -maxJ, maxJ);
  b.vx += jt * tx;
  b.vy += jt * ty;
  b.spin -= jt / (INERTIA_K * b.r);
  return -vn;
}

export type ImpactLog = Record<Surface, number>;

export const makeImpactLog = (): ImpactLog => ({ ground: 0, wall: 0, bar: 0, ceiling: 0 });

const tmp = makeContact();

/** Collide the ball with the static arena. Records the strongest impact per surface. */
export function collideBallWorld(b: Ball, arena: Arena, impacts: ImpactLog, h: number): void {
  const r = b.r;
  b.grounded = false;

  // Floor
  if (b.y + r > GROUND_Y) {
    tmp.nx = 0;
    tmp.ny = -1;
    tmp.pen = b.y + r - GROUND_Y;
    const s = resolveBallContact(b, tmp, 0.48, 0.55);
    impacts.ground = Math.max(impacts.ground, s);
    b.grounded = true;
  }
  // Ceiling
  if (b.y - r < 0) {
    tmp.nx = 0;
    tmp.ny = 1;
    tmp.pen = r - b.y;
    impacts.ceiling = Math.max(impacts.ceiling, resolveBallContact(b, tmp, 0.5, 0.3));
  }
  // Side walls (also the back of each goal)
  if (b.x - r < 0) {
    tmp.nx = 1;
    tmp.ny = 0;
    tmp.pen = r - b.x;
    impacts.wall = Math.max(impacts.wall, resolveBallContact(b, tmp, 0.56, 0.3));
  } else if (b.x + r > W) {
    tmp.nx = -1;
    tmp.ny = 0;
    tmp.pen = b.x + r - W;
    impacts.wall = Math.max(impacts.wall, resolveBallContact(b, tmp, 0.56, 0.3));
  }
  // Crossbars
  for (let i = 0; i < 2; i++) {
    const bar = arena.bars[i];
    if (!circleRect(b.x, b.y, r, bar, tmp)) continue;
    impacts.bar = Math.max(impacts.bar, resolveBallContact(b, tmp, 0.6, 0.35));
    // A ball resting on top of the crossbar slides back into play.
    if (tmp.ny < -0.7) {
      const towardField = i === 0 ? 1 : -1;
      b.vx += towardField * 700 * h;
      b.grounded = true;
    }
  }
}

/** Integrate the ball one step (with sub-steps so it never tunnels). */
export function stepBall(b: Ball, arena: Arena, dt: number, impacts: ImpactLog): void {
  const speed = b.speed;
  const n = Math.max(1, Math.ceil((speed * dt) / (b.r * 0.35)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const v = Math.hypot(b.vx, b.vy);
    // Gravity + Magnus lift (spin bends the flight)
    let ax = -MAGNUS * b.spin * b.vy;
    let ay = BALL_GRAVITY * b.gravityScale + MAGNUS * b.spin * b.vx;
    // Air drag (linear + quadratic)
    const drag = AIR_DRAG_LINEAR + AIR_DRAG_QUAD * v;
    ax -= b.vx * drag;
    ay -= b.vy * drag;
    b.vx += ax * h;
    b.vy += ay * h;
    b.x += b.vx * h;
    b.y += b.vy * h;
    b.angle += b.spin * h;
    collideBallWorld(b, arena, impacts, h);
    if (b.grounded) {
      const k = Math.exp(-ROLL_RESIST * h);
      b.vx = approach(b.vx * k, 0, ROLL_DECEL * h);
      b.spin *= k;
      if (Math.abs(b.vx) < 2) b.vx = 0;
    } else {
      b.spin *= Math.exp(-0.25 * h);
    }
  }
  const s = b.speed;
  if (s > MAX_BALL_SPEED) {
    const k = MAX_BALL_SPEED / s;
    b.vx *= k;
    b.vy *= k;
  }
  b.spin = clamp(b.spin, -60, 60);
  b.sinceTouch += dt;
  b.fireT = Math.max(0, b.fireT - dt);
}
