import type { Emitter, GameEvents } from '../core/events';
import { clamp, lerp } from '../core/math';
import { resolveBallContact, type Ball } from '../physics/ball';
import { circleCircle, makeContact } from '../physics/collide';
import type { Player } from './player';

const c = makeContact();

const HEADER_MIN_POP = 330;
const HEADER_FORWARD = 140;
const HEADER_MAX = 430;
const KICK_REACH_BONUS = 13;
const KICK_ACTIVE_FROM = 0.18;
// super energy gained per action (1 = full bar)
const ENERGY_TOUCH = 0.018;
const ENERGY_KICK = 0.04;
const ENERGY_HEADER = 0.015;
const KICK_SWEET = 0.42;

export interface KickResult {
  hit: boolean;
  sweet: number;
  speed: number;
}

function registerTouch(ball: Ball, p: Player, events: Emitter<GameEvents>): void {
  // a burning ball scorches the opponent who touches it
  if (ball.fireT > 0 && ball.fireOwner !== p.index) {
    ball.fireT = 0;
    p.stunT = Math.max(p.stunT, 0.55);
    p.vx += (ball.vx > 0 ? 1 : -1) * 320;
    p.setExpression('shock', 0.6);
    events.emit('superHit', { player: p.index, x: p.headX, y: p.headY });
  }
  if (p.fireT > 0) {
    ball.fireT = 1.6;
    ball.fireOwner = p.index;
  }
  ball.lastTouch = p.index;
  ball.sinceTouch = 0;
  if (p.touchCooldown <= 0) {
    p.touchCooldown = 0.18;
    p.stats.touches++;
    p.addEnergy(ENERGY_TOUCH);
    events.emit('touch', { player: p.index });
  }
}

/**
 * Kick: the outcome is designed rather than simulated so it feels reliable.
 * Hitting the ball early in the swing gives a low drive, late gives a lob,
 * and the middle of the swing ("sweet spot") gives the most power.
 */
function tryKick(ball: Ball, p: Player, events: Emitter<GameEvents>): boolean {
  const phase = p.kickPhase;
  // The first part of the swing is the wind-up: the foot can't strike yet.
  if (phase < KICK_ACTIVE_FROM || p.kickHit) return false;
  const reach = ball.r + p.footR + KICK_REACH_BONUS;
  const dx = ball.x - p.footX;
  const dy = ball.y - p.footY;
  if (dx * dx + dy * dy > reach * reach) return false;
  // Can't kick a ball that's behind you.
  if ((ball.x - p.x) * p.facing < -6) return false;

  // Sweet spot: the ball meets the foot mid-swing (press kick just before it arrives).
  const sweet = 1 - clamp(Math.abs(phase - KICK_SWEET) / 0.45, 0, 1);
  const power = 0.5 + 0.5 * sweet;
  let elev = lerp(0.5, 1.1, clamp((phase - KICK_ACTIVE_FROM) / (1 - KICK_ACTIVE_FROM), 0, 1)); // ~29°..63°
  if (ball.y < p.hipY - 14) elev *= 0.55; // volleys fly flatter
  const speed = (760 + 650 * power) * p.power * (p.fireT > 0 ? 1.22 : 1);
  ball.vx = p.facing * Math.cos(elev) * speed + p.vx * 0.35;
  ball.vy = -Math.sin(elev) * speed + Math.min(p.vy, 0) * 0.25;
  ball.spin = -p.facing * (8 + 22 * phase); // backspin -> the ball floats
  // Push it clear of the foot so it can't be double-hit.
  const d = Math.hypot(dx, dy) || 1;
  const need = ball.r + p.footR + 2 - d;
  if (need > 0) {
    ball.x += (dx / d) * need;
    ball.y += (dy / d) * need;
  }
  p.kickHit = true;
  p.stats.shots++;
  p.addEnergy(ENERGY_KICK * (0.5 + sweet));
  p.setExpression('effort', 0.35);
  registerTouch(ball, p, events);
  events.emit('kick', { player: p.index, x: ball.x, y: ball.y, speed, sweet });
  return true;
}

/** Ball vs one player's head, body and shoe. */
export function ballVsPlayer(ball: Ball, p: Player, events: Emitter<GameEvents>): void {
  if (tryKick(ball, p, events)) return;

  // Head: lively bounce, adds the head's own motion, nudges the ball forward.
  if (circleCircle(ball.x, ball.y, ball.r, p.headX, p.headY, p.headR, c)) {
    const impact = resolveBallContact(ball, c, 0.5, 0.5, p.vx, p.vy);
    if (impact > 0) {
      const rel = (ball.vx - p.vx) * c.nx + (ball.vy - p.vy) * c.ny;
      if (rel < HEADER_MIN_POP) {
        const add = HEADER_MIN_POP - rel;
        ball.vx += c.nx * add;
        ball.vy += c.ny * add;
      }
      // A standing header is a soft cushion; jumping into the ball adds real power.
      const maxOut = HEADER_MAX + Math.max(0, -p.vy) * 0.3;
      const out = Math.hypot(ball.vx - p.vx, ball.vy - p.vy);
      if (out > maxOut) {
        const k = maxOut / out;
        ball.vx = p.vx + (ball.vx - p.vx) * k;
        ball.vy = p.vy + (ball.vy - p.vy) * k;
      }
      // Headers are aimed: hits on the upper half always carry the ball forward.
      if (c.ny < 0.35) {
        if (ball.vx * p.facing < 0) ball.vx *= 0.45;
        ball.vx += p.facing * HEADER_FORWARD;
      }
      registerTouch(ball, p, events);
      if (impact > 160) {
        p.stats.headers++;
        p.addEnergy(ENERGY_HEADER);
        events.emit('header', { player: p.index, x: ball.x, y: ball.y, speed: impact });
      }
    }
  }

  // Body: dead, soft contact (good for trapping the ball).
  if (circleCircle(ball.x, ball.y, ball.r, p.bodyX, p.bodyY, p.bodyR, c)) {
    if (resolveBallContact(ball, c, 0.3, 0.4, p.vx, p.vy) > 0) registerTouch(ball, p, events);
  }

  // Shoe at rest: lets you dribble and stop the ball.
  if (circleCircle(ball.x, ball.y, ball.r, p.footX, p.footY, p.footR, c)) {
    if (resolveBallContact(ball, c, 0.32, 0.6, p.footVX, p.footVY) > 0) registerTouch(ball, p, events);
  }
}

/**
 * After the ball was clamped back by the world (floor/walls), it may still overlap a
 * player. In that case the *player* yields – this is how you can stand on the ball and
 * why the ball can't be squeezed through a body.
 */
export function separatePlayerFromBall(ball: Ball, p: Player): void {
  const shapes: Array<[number, number, number]> = [
    [p.headX, p.headY, p.headR],
    [p.bodyX, p.bodyY, p.bodyR],
  ];
  for (const [sx, sy, sr] of shapes) {
    if (!circleCircle(ball.x, ball.y, ball.r, sx, sy, sr, c)) continue;
    // c.n points from the player shape to the ball: move the player the other way.
    p.x -= c.nx * c.pen;
    p.y -= c.ny * c.pen;
    if (c.ny > 0.45) {
      if (p.vy > 0) p.vy = 0;
      p.grounded = true;
    }
    if (c.nx * p.vx > 0) p.vx *= 0.4;
  }
}

/** Players push each other and can stand on each other's heads. */
export function playerVsPlayer(a: Player, b: Player): void {
  const sa: Array<[number, number, number]> = [
    [a.headX, a.headY, a.headR],
    [a.bodyX, a.bodyY, a.bodyR],
  ];
  const sb: Array<[number, number, number]> = [
    [b.headX, b.headY, b.headR],
    [b.bodyX, b.bodyY, b.bodyR],
  ];
  for (const [ax, ay, ar] of sa) {
    for (const [bx, by, br] of sb) {
      if (!circleCircle(ax, ay, ar, bx, by, br, c)) continue;
      const half = c.pen / 2;
      // c.n points from b to a
      const top = c.ny < -0.55 ? a : c.ny > 0.55 ? b : null;
      if (top) {
        // Vertical stack: only the upper player moves (stands on the other's head).
        const n = top === a ? 1 : -1;
        top.x += c.nx * c.pen * n;
        top.y += c.ny * c.pen * n;
        if (top.vy > 0) top.vy = 0;
        top.grounded = true;
        // slide off slowly so nobody can camp on a head forever
        top.vx += (top === a ? c.nx : -c.nx) * 30;
      } else {
        a.x += c.nx * half;
        b.x -= c.nx * half;
        const rel = (a.vx - b.vx) * c.nx;
        if (rel < 0) {
          a.vx -= rel * c.nx * 0.5;
          b.vx += rel * c.nx * 0.5;
        }
      }
      return; // one resolution per step is enough and avoids jitter
    }
  }
}
