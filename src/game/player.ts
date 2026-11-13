import { GROUND_Y, PLAYER_GRAVITY, W } from '../core/constants';
import type { Emitter, GameEvents } from '../core/events';
import { approach, clamp, easeOutCubic, lerp, rand } from '../core/math';
import type { PlayerIntent } from '../input/controls';
import type { Arena } from '../physics/arena';
import type { CharacterDef, Expression } from './characters';
import type { Equip } from './cosmetics';

/** Kick timings (seconds) */
export const KICK_FWD = 0.13;
export const KICK_BACK = 0.12;
const KICK_COOLDOWN = 0.06;
const KICK_REST_ANGLE = 0.12;
const KICK_START_ANGLE = -0.4;
const KICK_END_ANGLE = 1.95;

const LEG_LEN = 19;
const HIP_UP = 25;
const BODY_UP = 40;
const NECK_UP = 56;

/** dash: burst duration, cooldown, speed multiplier */
export const DASH_TIME = 0.2;
export const DASH_COOLDOWN = 0.85;
const DASH_SPEED = 2.15;
const DASH_SPEED_AIR = 1.6;

const COYOTE = 0.09;
const JUMP_BUFFER = 0.13;

export interface PlayerMatchStats {
  kicks: number;
  shots: number;
  headers: number;
  touches: number;
  jumps: number;
  dashes: number;
}

export class Player {
  readonly index: 0 | 1;
  readonly facing: 1 | -1;
  char: CharacterDef;

  // physical state (x,y = bottom centre of the feet)
  x = 0;
  y = GROUND_Y;
  vx = 0;
  vy = 0;
  px = 0;
  py = GROUND_Y;
  grounded = true;
  private coyote = 0;
  private jumpBuffer = 0;

  // derived stats
  maxSpeed = 380;
  jumpV = 900;
  power = 1;
  baseHeadR = 44;
  headScale = 1;

  // kick
  kickT = -1;
  kickHit = false;
  /** this swing already caught the other player */
  kickHitPlayer = false;
  /** seconds a kicked player can't be kicked again (no stun-locking) */
  kickImmuneT = 0;
  private kickCooldown = 0;
  footAngle = KICK_REST_ANGLE;
  footX = 0;
  footY = 0;
  footVX = 0;
  footVY = 0;
  readonly footR = 11;

  // super shot
  /** 0..1, fills when touching the ball */
  energy = 0;
  /** super is armed (claimed): the next touch of the ball fires it. Stays armed across goals. */
  charged = false;
  /** seconds since the super was armed (arming animation) */
  chargeT = 0;
  /** set by the match: no charging or arming outside open play (e.g. after a goal) */
  superLocked = false;

  // dash
  /** seconds left of the current dash (0 = not dashing) */
  dashT = 0;
  dashDir = 0;
  dashCd = 0;

  // status effects
  stunT = 0;
  frozenT = 0;
  reversedT = 0;
  jumpBoostT = 0;
  /** what the player wears (shop cosmetics); null = the hero as drawn */
  cos: Equip | null = null;
  /** super-shot effects when blocking a super: slowed, can't jump, shrunken head, on fire */
  slowT = 0;
  noJumpT = 0;
  shrinkT = 0;
  burnT = 0;
  /** fire-ball power-up: this player's shots set the ball on fire */
  fireT = 0;

  // animation / presentation
  squash = 0;
  expr: Expression = 'idle';
  exprT = 0;
  blinkT = rand(1.5, 4);
  blink = 0;
  lookX = 0;
  lookY = 0;
  runPhase = 0;
  touchCooldown = 0;

  stats: PlayerMatchStats = { kicks: 0, shots: 0, headers: 0, touches: 0, jumps: 0, dashes: 0 };

  constructor(index: 0 | 1, char: CharacterDef) {
    this.index = index;
    this.facing = index === 0 ? 1 : -1;
    this.char = char;
    this.applyCharacter(char);
    this.updateFoot(0);
  }

  applyCharacter(char: CharacterDef): void {
    this.char = char;
    const s = char.stats;
    this.maxSpeed = 300 + s.speed * 32;
    this.jumpV = 770 + s.jump * 48;
    this.power = 0.84 + s.power * 0.065;
    this.baseHeadR = 37 + s.head * 3.2;
  }

  get headR(): number {
    return this.baseHeadR * this.headScale * (this.shrinkT > 0 ? 0.62 : 1);
  }
  get headX(): number {
    return this.x + this.facing * 2;
  }
  get headY(): number {
    return this.y - NECK_UP - this.headR * 0.78;
  }
  get bodyX(): number {
    return this.x;
  }
  get bodyY(): number {
    return this.y - BODY_UP;
  }
  get bodyR(): number {
    return 18;
  }
  get hipX(): number {
    return this.x + this.facing * 2;
  }
  get hipY(): number {
    return this.y - HIP_UP;
  }
  get halfW(): number {
    return this.headR * 0.72;
  }
  get height(): number {
    return NECK_UP + this.headR * 1.78;
  }
  get kicking(): boolean {
    return this.kickT >= 0;
  }
  /** 0..1 progress of the forward swing, or -1 when not in the forward swing */
  get kickPhase(): number {
    return this.kickT >= 0 && this.kickT < KICK_FWD ? this.kickT / KICK_FWD : -1;
  }

  resetPosition(x: number): void {
    this.x = this.px = x;
    this.y = this.py = GROUND_Y;
    this.vx = this.vy = 0;
    this.grounded = true;
    this.kickT = -1;
    this.jumpBuffer = 0;
    this.squash = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.updateFoot(0);
  }

  savePrev(): void {
    this.px = this.x;
    this.py = this.y;
  }

  setExpression(e: Expression, duration: number): void {
    this.expr = e;
    this.exprT = duration;
  }

  addEnergy(v: number): void {
    if (this.charged || this.superLocked) return;
    const before = this.energy;
    this.energy = Math.min(1, this.energy + v);
    if (before < 1 && this.energy >= 1) this.energyFullT = 0;
  }

  /** time since the energy bar became full (for HUD flashing) */
  energyFullT = 0;

  /** Place the player for menus/previews without physics. */
  placeAt(x: number, y: number): void {
    this.x = this.px = x;
    this.y = this.py = y;
    this.updateFoot(0);
  }

  update(dt: number, intent: PlayerIntent, arena: Arena, events: Emitter<GameEvents>): void {
    const frozen = this.frozenT > 0 || this.stunT > 0;

    // --- arm the super shot ---
    if (!frozen && !this.superLocked && intent.superPressed && this.energy >= 1 && !this.charged) {
      this.charged = true;
      this.chargeT = 0;
      this.setExpression('effort', 0.6);
      events.emit('superArmed', { player: this.index });
    }
    if (this.charged) this.chargeT += dt;
    this.energyFullT += dt;
    let move = frozen ? 0 : intent.move;
    if (this.reversedT > 0) move = -move;

    // --- dash: double tap a direction for a short burst of speed ---
    this.dashCd -= dt;
    if (!frozen && intent.dash !== 0 && this.dashCd <= 0) {
      const dir = this.reversedT > 0 ? -intent.dash : intent.dash;
      this.dashDir = dir < 0 ? -1 : 1;
      this.dashT = DASH_TIME;
      this.dashCd = DASH_COOLDOWN;
      this.vx = this.dashDir * this.maxSpeed * (this.grounded ? DASH_SPEED : DASH_SPEED_AIR);
      this.stats.dashes++;
      this.setExpression('effort', 0.3);
      events.emit('dash', { player: this.index, x: this.x, y: this.y, dir: this.dashDir });
    }
    if (frozen) this.dashT = 0;

    // --- horizontal movement: snappy acceleration, quick turn-around ---
    if (this.dashT > 0) {
      this.dashT = Math.max(0, this.dashT - dt);
    } else {
      const env = arena.env;
      const target = move * this.maxSpeed * env.runMul * (this.slowT > 0 ? 0.5 : 1);
      let accel: number;
      // slippery ground (rain) = less grip, both to speed up and to stop
      if (this.grounded) accel = (move !== 0 ? 4300 : 3800) * env.grip;
      else accel = move !== 0 ? 2700 : 700;
      if (move !== 0 && Math.sign(this.vx) === -move) accel *= 1.7;
      // coming out of a dash: bleed the extra speed off quickly but not instantly
      if (Math.abs(this.vx) > this.maxSpeed * 1.05) accel = Math.max(accel, 5200);
      this.vx = approach(this.vx, target, accel * dt);
    }

    // --- jumping (with coyote time + input buffer + variable height) ---
    if (!frozen && intent.jumpPressed && this.noJumpT <= 0) this.jumpBuffer = JUMP_BUFFER;
    this.coyote = this.grounded ? COYOTE : this.coyote - dt;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      const boost = this.jumpBoostT > 0 ? 1.28 : 1;
      this.vy = -this.jumpV * boost * arena.env.jumpMul;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.squash = -0.22;
      this.stats.jumps++;
      events.emit('jump', { player: this.index, x: this.x, y: this.y });
    }
    this.jumpBuffer -= dt;

    let g = PLAYER_GRAVITY * arena.env.playerGravity;
    if (this.vy < 0 && !intent.jumpHeld) g *= 2.1; // short hop when jump released
    else if (this.vy > 0) g *= 1.18; // fall a bit faster than rise
    this.vy = Math.min(this.vy + g * dt, 1700);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.collideWorld(arena, events);

    // --- kick ---
    this.kickCooldown -= dt;
    if (!frozen && intent.kickPressed && this.kickT < 0 && this.kickCooldown <= 0) {
      this.kickT = 0;
      this.kickHit = false;
      this.kickHitPlayer = false;
      this.stats.kicks++;
    }
    if (this.kickT >= 0) {
      this.kickT += dt;
      if (this.kickT >= KICK_FWD + KICK_BACK) {
        this.kickT = -1;
        this.kickCooldown = KICK_COOLDOWN;
      }
    }
    this.updateFoot(dt);

    // --- timers & animation ---
    this.stunT = Math.max(0, this.stunT - dt);
    this.kickImmuneT = Math.max(0, this.kickImmuneT - dt);
    this.frozenT = Math.max(0, this.frozenT - dt);
    this.reversedT = Math.max(0, this.reversedT - dt);
    this.jumpBoostT = Math.max(0, this.jumpBoostT - dt);
    this.slowT = Math.max(0, this.slowT - dt);
    this.noJumpT = Math.max(0, this.noJumpT - dt);
    this.shrinkT = Math.max(0, this.shrinkT - dt);
    this.burnT = Math.max(0, this.burnT - dt);
    this.fireT = Math.max(0, this.fireT - dt);
    this.touchCooldown = Math.max(0, this.touchCooldown - dt);
    this.squash = approach(this.squash, 0, dt * 1.6);
    this.tickAnimation(dt);
    if (this.grounded && Math.abs(this.vx) > 30) this.runPhase += dt * (Math.abs(this.vx) / 22);
  }

  /** Blinking and expression timers (also used by the hero-select previews). */
  tickAnimation(dt: number): void {
    if (this.exprT > 0) {
      this.exprT -= dt;
      if (this.exprT <= 0) this.expr = 'idle';
    }
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blink = 0.14;
      this.blinkT = rand(2, 5);
    }
    this.blink = Math.max(0, this.blink - dt);
  }

  private collideWorld(arena: Arena, events: Emitter<GameEvents>): void {
    const wasGrounded = this.grounded;
    const fallSpeed = this.vy;
    this.grounded = false;

    if (this.y >= GROUND_Y) {
      this.y = GROUND_Y;
      if (this.vy > 0) this.vy = 0;
      this.grounded = true;
    }
    const hw = this.halfW;
    if (this.x - hw < 0) {
      this.x = hw;
      if (this.vx < 0) this.vx = 0;
      this.dashT = 0;
    } else if (this.x + hw > W) {
      this.x = W - hw;
      if (this.vx > 0) this.vx = 0;
      this.dashT = 0;
    }

    // Crossbars: players can stand on them and bonk their head underneath.
    const h = this.height;
    for (const bar of arena.bars) {
      const left = this.x - hw;
      const right = this.x + hw;
      const top = this.y - h;
      if (right <= bar.x || left >= bar.x + bar.w || this.y <= bar.y || top >= bar.y + bar.h) continue;
      const prevBottom = this.py;
      const prevTop = this.py - h;
      if (prevBottom <= bar.y + 3 && this.vy >= 0) {
        this.y = bar.y;
        this.vy = 0;
        this.grounded = true;
      } else if (prevTop >= bar.y + bar.h - 3 && this.vy < 0) {
        this.y = bar.y + bar.h + h;
        this.vy = 60;
      } else {
        this.x = this.x < bar.x + bar.w / 2 ? bar.x - hw : bar.x + bar.w + hw;
        this.vx = 0;
      }
    }

    if (this.grounded && !wasGrounded && fallSpeed > 250) {
      this.squash = clamp(fallSpeed / 3400, 0.08, 0.3);
      events.emit('land', { player: this.index, x: this.x, y: this.y, force: fallSpeed });
    }
  }

  updateFoot(dt: number): void {
    let a = KICK_REST_ANGLE;
    if (this.kickT >= 0) {
      if (this.kickT < KICK_FWD) {
        a = lerp(KICK_START_ANGLE, KICK_END_ANGLE, easeOutCubic(this.kickT / KICK_FWD));
      } else {
        const t = (this.kickT - KICK_FWD) / KICK_BACK;
        a = lerp(KICK_END_ANGLE, KICK_REST_ANGLE, t);
      }
    } else if (!this.grounded) {
      a = 0.5; // tuck the foot forward a little mid-air
    }
    this.footAngle = a;
    const fx = this.hipX + this.facing * Math.sin(a) * LEG_LEN;
    const fy = this.hipY + Math.cos(a) * LEG_LEN + 6;
    if (dt > 0) {
      this.footVX = (fx - this.footX) / dt;
      this.footVY = (fy - this.footY) / dt;
    } else {
      this.footVX = this.footVY = 0;
    }
    this.footX = fx;
    this.footY = fy;
  }
}
