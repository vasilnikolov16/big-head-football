import type { Emitter, GameEvents } from '../core/events';
import { clamp, lerp } from '../core/math';
import { resolveBallContact, type Ball } from '../physics/ball';
import { circleCircle, makeContact } from '../physics/collide';
import type { Player } from './player';

const c = makeContact();

const HEADER_MIN_POP = 470;
const HEADER_FORWARD = 130;
const HEADER_MAX = 520;
/** absolute speed cap of a header: standing, plus what a jump / dash adds */
const HEADER_ABS = 700;
const KICK_REACH_BONUS = 24;
/** how far in front of the body a kick reaches */
const KICK_ZONE = 44;
const KICK_ACTIVE_FROM = 0.18;
// super energy gained per action (1 = full bar)
const ENERGY_TOUCH = 0.004;
const ENERGY_KICK = 0.015;
const ENERGY_HEADER = 0.003;
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
/** In front of the player, from the ground up to head height: the swing reaches it. */
export function inKickZone(ball: { x: number; y: number; r: number }, p: Player): boolean {
  const rel = (ball.x - p.x) * p.facing;
  return rel > p.halfW * 0.2 && rel < p.halfW + ball.r + KICK_ZONE && ball.y < p.y && ball.y > p.headY - p.headR * 0.2;
}

/** The other player stands right in front of the ball: a normal kick would hit them. */
function blockedBy(ball: Ball, p: Player, opp: Player | undefined): boolean {
  if (!opp) return false;
  const ahead = (opp.x - p.x) * p.facing;
  return ahead > 0 && ahead < p.halfW + opp.halfW + ball.r * 2 + 46 && ball.y > p.hipY - 40 && opp.y > ball.y - 30;
}

function tryKick(ball: Ball, p: Player, events: Emitter<GameEvents>, opp?: Player): boolean {
  const phase = p.kickPhase;
  // The first part of the swing is the wind-up: the foot can't strike yet.
  if (phase < KICK_ACTIVE_FROM || p.kickHit) return false;
  const reach = ball.r + p.footR + KICK_REACH_BONUS;
  const dx = ball.x - p.footX;
  const dy = ball.y - p.footY;
  // the foot itself, or anything in front of the player up to head height (volleys)
  if (dx * dx + dy * dy > reach * reach && !inKickZone(ball, p)) return false;
  // Can't kick a ball that's behind you.
  if ((ball.x - p.x) * p.facing < -6) return false;

  // Sweet spot: the ball meets the foot mid-swing (press kick just before it arrives).
  const sweet = 1 - clamp(Math.abs(phase - KICK_SWEET) / 0.34, 0, 1);
  const power = 0.5 + 0.5 * sweet;
  let elev = lerp(0.72, 1.2, clamp((phase - KICK_ACTIVE_FROM) / (1 - KICK_ACTIVE_FROM), 0, 1)); // ~41°..69°
  if (ball.y < p.hipY - 14) elev *= 0.55; // volleys fly flatter
  let speed = (600 + 520 * power) * p.power * (p.fireT > 0 ? 1.22 : 1);
  if (blockedBy(ball, p, opp)) {
    // chip it over the player in the way instead of into them
    elev = 1.3;
    speed = Math.max(speed * 0.9, 900);
    ball.ghostT = 0.12;
  }
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
export function ballVsPlayer(ball: Ball, p: Player, events: Emitter<GameEvents>, opp?: Player, noKicks = false): void {
  if (!noKicks && tryKick(ball, p, events, opp)) return;
  if (ball.ghostT > 0) return; // squirting out of a scramble

  // Head: lively bounce, adds the head's own motion, nudges the ball forward.
  if (circleCircle(ball.x, ball.y, ball.r, p.headX, p.headY, p.headR, c)) {
    const impact = resolveBallContact(ball, c, 0.88, 0.5, p.vx, p.vy);
    if (impact > 0) {
      const rel = (ball.vx - p.vx) * c.nx + (ball.vy - p.vy) * c.ny;
      if (rel < HEADER_MIN_POP) {
        const add = HEADER_MIN_POP - rel;
        ball.vx += c.nx * add;
        ball.vy += c.ny * add;
      }
      // A standing header is a soft cushion; jumping into the ball adds real power.
      const maxOut = HEADER_MAX + Math.max(0, -p.vy) * 0.2;
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
      // The ball is heavy: a header can't send it across the whole pitch.
      const abs = HEADER_ABS + Math.max(0, -p.vy) * 0.3 + Math.abs(p.vx) * 0.25;
      const sp = Math.hypot(ball.vx, ball.vy);
      if (sp > abs) {
        ball.vx *= abs / sp;
        ball.vy *= abs / sp;
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
    if (resolveBallContact(ball, c, 0.5, 0.4, p.vx, p.vy) > 0) registerTouch(ball, p, events);
  }

  // Shoe at rest: lets you dribble and stop the ball.
  if (circleCircle(ball.x, ball.y, ball.r, p.footX, p.footY, p.footR, c)) {
    if (resolveBallContact(ball, c, 0.45, 0.6, p.footVX, p.footVY) > 0) registerTouch(ball, p, events);
  }
}

/**
 * After the ball was clamped back by the world (floor/walls), it may still overlap a
 * player. In that case the *player* yields – this is how you can stand on the ball and
 * why the ball can't be squeezed through a body.
 */
export function separatePlayerFromBall(ball: Ball, p: Player): void {
  if (ball.ghostT > 0) return;
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
export function playerVsPlayer(a: Player, b: Player, events?: Emitter<GameEvents>): void {
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
        // a dash into the other player knocks them back (a shoulder charge)
        const hitter = a.dashT > 0 && a.dashDir * (b.x - a.x) > 0 ? a : b.dashT > 0 && b.dashDir * (a.x - b.x) > 0 ? b : null;
        if (hitter && events) {
          const victim = hitter === a ? b : a;
          const force = Math.abs(hitter.vx);
          victim.vx = hitter.dashDir * Math.min(560, 240 + force * 0.35);
          if (victim.grounded) victim.vy = -260;
          victim.grounded = false;
          victim.stunT = Math.max(victim.stunT, 0.32);
          victim.setExpression('shock', 0.6);
          victim.kickT = -1;
          hitter.vx *= 0.25;
          hitter.dashT = 0;
          events.emit('bump', { player: victim.index, x: (a.x + b.x) / 2, y: Math.min(ay, by), force });
        }
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

/**
 * A swinging foot catches the other player's legs or body: they are knocked
 * back and dazed for a moment. A kicked player can't be kicked again right away.
 */
export function kickVsPlayer(p: Player, opp: Player, events: Emitter<GameEvents>, balls: Ball[]): boolean {
  // (a swing that already struck the ball doesn't also hit the player)
  if (p.kickPhase < KICK_ACTIVE_FROM || p.kickHit || p.kickHitPlayer || opp.kickImmuneT > 0) return false;
  // the swing was for the ball, not for the player: a ball at the foot, or one
  // in the space between the two of them (a scramble for it)
  const oppAhead = (opp.x - p.x) * p.facing;
  for (const b of balls) {
    const dx = b.x - p.footX;
    const dy = b.y - p.footY;
    if (dx * dx + dy * dy < (b.r + 70) ** 2) return false;
    const ballAhead = (b.x - p.x) * p.facing;
    if (ballAhead > -b.r && ballAhead < oppAhead + b.r + 10 && b.y > p.headY - p.headR - 110) return false;
  }
  // only right in front of the kicker: the big heads keep the bodies apart, so
  // "within reach" is heads (almost) touching, with the foot at the height of
  // the other player's legs or body
  if (oppAhead <= 0 || oppAhead > p.headR + opp.headR + 26) return false;
  if (p.footY < opp.bodyY - opp.bodyR || p.footY > opp.y + 14) return false;
  p.kickHitPlayer = true;
  opp.kickImmuneT = 1.5;
  opp.vx = p.facing * 430 * p.power;
  if (opp.grounded) opp.vy = -300;
  opp.grounded = false;
  opp.stunT = Math.max(opp.stunT, 0.42);
  opp.kickT = -1;
  opp.dashT = 0;
  opp.setExpression('shock', 0.7);
  p.setExpression('effort', 0.35);
  events.emit('bump', { player: opp.index, x: (p.footX + opp.x) / 2, y: p.footY - 6, force: 650 });
  return true;
}
