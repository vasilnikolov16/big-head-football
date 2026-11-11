import { BALL_GRAVITY, GOAL_DEPTH, GROUND_Y, W } from '../core/constants';
import type { ImpactLog } from '../physics/ball';
import type { SuperId } from './characters';
import type { Match } from './match';
import type { Player } from './player';

export interface SuperInfo {
  name: string;
  desc: string;
  color: string;
}

export const SUPER_INFO: Record<SuperId, SuperInfo> = {
  razor: { name: 'Бръсначен удар', desc: 'Ниска свистяща топка, минава през противника и го отхвърля.', color: '#ff4d6d' },
  pounce: { name: 'Котешки скок', desc: 'Топката задрямва във въздуха… и изведнъж се хвърля към вратата.', color: '#ffb347' },
  laser: { name: 'Лазер', desc: 'Абсолютно права линия с огромна скорост.', color: '#4fd1ff' },
  sonic: { name: 'Соло на китара', desc: 'Звукова вълна по синусоида, зашеметява противника.', color: '#ff3df2' },
  yarn: { name: 'Кълбо прежда', desc: 'Самонасочващо се кълбо, което оплита противника.', color: '#ff8fc7' },
  warp: { name: 'Телепорт', desc: 'Топката изчезва и се появява точно пред чуждата врата.', color: '#9dff5c' },
  thunder: { name: 'Гръм', desc: 'Топката излита до небето и се забива като мълния.', color: '#ffe14d' },
  shadow: { name: 'Сенки', desc: 'Три еднакви топки — само една е истинска.', color: '#b8a9ff' },
};

/** Height the laser and shadow shots rise to before firing (above any head). */
const LIFT_Y = GROUND_Y - 270;

/** A fake ball for the ninja super: flies, looks real, touches nothing. */
export interface Decoy {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  angle: number;
  pangle: number;
  t: number;
  alive: boolean;
}

export class SuperShot {
  t = 0;
  phase = 0;
  done = false;
  /** the opponent cannot block it (it passes through) */
  passThrough = false;
  /** the opponent has already been hit by the effect */
  hitOpponent = false;
  /** ball is invisible and intangible (teleport) */
  hidden = false;
  readonly dir: 1 | -1;
  readonly tx: number;
  ty: number;
  private y0 = 0;
  private x0 = 0;

  constructor(
    readonly id: SuperId,
    readonly owner: 0 | 1,
    m: Match,
  ) {
    this.dir = owner === 0 ? 1 : -1;
    const side = owner === 0 ? 1 : 0; // goal being attacked
    this.tx = side === 1 ? W - GOAL_DEPTH * 0.45 : GOAL_DEPTH * 0.45;
    this.ty = (m.arena.goalTop[side] + GROUND_Y) / 2 + 10;
  }

  get info(): SuperInfo {
    return SUPER_INFO[this.id];
  }

  // -------------------------------------------------------------- lifecycle

  start(m: Match): void {
    const b = m.ball;
    this.x0 = b.x;
    this.y0 = b.y;
    b.spin = this.dir * 30;
    switch (this.id) {
      case 'razor':
        this.passThrough = true;
        b.gravityScale = 0;
        this.aim(m, 1750);
        break;
      case 'pounce':
        b.gravityScale = 0;
        b.vx = this.dir * 160;
        b.vy = -720;
        break;
      case 'laser':
        // pop up first, then fire the beam over the defender
        b.gravityScale = 0;
        b.spin = 0;
        b.vx = this.dir * 150;
        b.vy = -1700;
        break;
      case 'sonic':
        b.gravityScale = 0;
        b.vx = this.dir * 1050;
        this.y0 = Math.min(b.y, GROUND_Y - 130);
        this.ty = this.bestAimY(m);
        break;
      case 'yarn':
        this.passThrough = true;
        b.gravityScale = 0.25;
        b.vx = this.dir * 600;
        b.vy = -680;
        break;
      case 'warp':
        b.gravityScale = 0;
        b.vx *= 0.3;
        b.vy = -200;
        break;
      case 'thunder':
        b.gravityScale = 0;
        b.vx = this.dir * 90;
        b.vy = -1500;
        break;
      case 'shadow':
        b.gravityScale = 0;
        b.vx = this.dir * 150;
        b.vy = -1600;
        break;
    }
  }

  /** Ninja: the ball splits into three identical balls. */
  private splitShadows(m: Match): void {
    const b = m.ball;
    b.gravityScale = 0.45;
    this.aim(m, 1400, 0.45);
    {
      for (const a of [-0.2, 0.2]) {
          const c = Math.cos(a);
          const s = Math.sin(a);
          m.decoys.push({
            x: b.x,
            y: b.y,
            px: b.x,
            py: b.y,
            vx: b.vx * c - b.vy * s,
            vy: b.vx * s + b.vy * c,
            angle: b.angle,
            pangle: b.angle,
            t: 0,
            alive: true,
          });
        }
    }
  }

  /** Keep full speed along the current line (ignores drag). */
  private keepSpeed(m: Match, speed: number): void {
    const b = m.ball;
    const v = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / v) * speed;
    b.vy = (b.vy / v) * speed;
  }

  /** Lift phase shared by laser and shadow: true while still rising. */
  private lifting(m: Match): boolean {
    const b = m.ball;
    if (this.phase !== 0) return false;
    if (b.y > LIFT_Y && this.t < 0.2) {
      b.vx = this.dir * 150;
      b.vy = -1600;
      return true;
    }
    this.phase = 1;
    return false;
  }

  /**
   * Picks the height in the goal mouth whose straight line from the ball stays
   * farthest from the opponent's head and body (aims for the gap).
   */
  private bestAimY(m: Match): number {
    const b = m.ball;
    const side = this.owner === 0 ? 1 : 0;
    const top = m.arena.goalTop[side] + 26;
    const bottom = GROUND_Y - 26;
    const opp = m.players[1 - this.owner];
    const shapes = [
      { x: opp.headX, y: opp.headY, r: opp.headR },
      { x: opp.bodyX, y: opp.bodyY, r: opp.bodyR + 8 },
    ];
    let best = this.ty;
    let bestScore = -Infinity;
    for (let k = 0; k <= 6; k++) {
      const ty = top + ((bottom - top) * k) / 6;
      let clear = Infinity;
      for (let i = 1; i <= 24; i++) {
        const u = i / 24;
        const x = b.x + (this.tx - b.x) * u;
        const y = b.y + (ty - b.y) * u;
        for (const sh of shapes) clear = Math.min(clear, Math.hypot(x - sh.x, y - sh.y) - sh.r - b.r);
      }
      // prefer a clear line, then the middle of the goal
      const score = Math.min(clear, 60) - Math.abs(ty - (top + bottom) / 2) * 0.05;
      if (score > bestScore) {
        bestScore = score;
        best = ty;
      }
    }
    return best;
  }

  private aim(m: Match, speed: number, gravity = 0): void {
    const b = m.ball;
    this.ty = this.bestAimY(m);
    const dx = this.tx - b.x;
    // lift the aim point to compensate for gravity over the flight time
    const flight = Math.abs(dx) / speed;
    const dy = this.ty - 0.5 * BALL_GRAVITY * gravity * flight * flight - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.vx = (dx / d) * speed;
    b.vy = (dy / d) * speed;
  }

  /** Steering before the physics step. */
  update(m: Match, dt: number): void {
    const b = m.ball;
    this.t += dt;
    const t = this.t;
    switch (this.id) {
      case 'laser':
        if (this.lifting(m)) break;
        if (this.phase === 1) {
          this.phase = 2;
          this.aim(m, 1950);
        }
        this.keepSpeed(m, 1950);
        if (t > 1.4) this.finish(m);
        break;
      case 'razor':
        this.keepSpeed(m, 1750);
        if (t > 1.3) this.finish(m);
        break;
      case 'pounce':
        if (this.phase === 0 && t > 0.38) this.phase = 1;
        if (this.phase === 1) {
          // dozing in mid-air
          b.vx *= 0.88;
          b.vy = Math.sin(t * 9) * 40;
          if (t > 0.9) {
            this.phase = 2;
            this.aim(m, 1650);
          }
        } else if (this.phase === 2 && t > 2.1) this.finish(m);
        break;
      case 'sonic': {
        const total = Math.abs(this.tx - this.x0) / 1050;
        const k = Math.min(1, t / Math.max(0.2, total));
        const want = this.y0 + (this.ty - this.y0) * k + Math.sin(t * 13) * 60 * (1 - k * 0.5);
        b.vx = this.dir * 1050;
        b.vy = Math.max(-1400, Math.min(1400, (want - b.y) / dt));
        // the sound wave stuns the opponent when it passes nearby
        const opp = m.players[1 - this.owner];
        if (!this.hitOpponent && Math.abs(opp.headX - b.x) < 150 && Math.abs(opp.headY - b.y) < 190) {
          this.stun(m, opp, 1.1);
          this.passThrough = true;
        }
        if (t > 1.8) this.finish(m);
        break;
      }
      case 'yarn': {
        if (t > 0.18) {
          const dx = this.tx - b.x;
          const dy = this.ty - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * 3.4);
          b.vx += ((dx / d) * 1150 - b.vx) * k;
          b.vy += ((dy / d) * 1150 - b.vy) * k;
        }
        if (t > 2.4) this.finish(m);
        break;
      }
      case 'warp':
        if (this.phase === 0 && t > 0.22) {
          this.phase = 1;
          this.hidden = true;
          b.vx = b.vy = 0;
        } else if (this.phase === 1) {
          b.vx = b.vy = 0;
          if (t > 0.55) {
            this.phase = 2;
            this.hidden = false;
            const side = this.owner === 0 ? 1 : 0;
            b.x = b.px = this.dir === 1 ? W - GOAL_DEPTH - 190 : GOAL_DEPTH + 190;
            b.y = b.py = m.arena.goalTop[side] - 70;
            b.gravityScale = 0.6;
            this.aim(m, 980, 0.6);
          }
        } else if (this.phase === 2 && t > 1.7) this.finish(m);
        break;
      case 'thunder':
        if (this.phase === 0 && (b.y < 110 || t > 0.36)) {
          this.phase = 1;
          this.phase1At = t;
        }
        if (this.phase === 1) {
          b.vx = b.vy = 0;
          if (t - this.phase1At > 0.16) {
            this.phase = 2;
            this.aim(m, 2000);
          }
        } else if (this.phase === 2) {
          const v = Math.hypot(b.vx, b.vy) || 1;
          b.vx = (b.vx / v) * 2000;
          b.vy = (b.vy / v) * 2000;
          if (t > 1.6) this.finish(m);
        }
        break;
      case 'shadow':
        if (this.lifting(m)) break;
        if (this.phase === 1) {
          this.phase = 2;
          this.splitShadows(m);
        }
        if (t > 1.8) this.finish(m);
        break;
    }
  }

  private phase1At = 0;

  /** Called after the physics step with the world impacts of this step. */
  afterStep(m: Match, imp: ImpactLog): void {
    if (this.done) return;
    const hitWorld = imp.ground > 0 || imp.wall > 0 || imp.bar > 0 || imp.ceiling > 0;
    if (!hitWorld) return;
    // rising/hovering phases may scrape the ceiling or floor without ending the shot
    if (this.id === 'pounce' && this.phase < 2) return;
    if (this.id === 'thunder' && this.phase < 2) return;
    if (this.id === 'warp' && this.phase < 2) return;
    if (this.id === 'yarn' && this.t < 0.2) return;
    if ((this.id === 'laser' || this.id === 'shadow') && this.phase < 2) return;
    if (this.id === 'thunder' && imp.ground > 0) {
      // shockwave on landing
      const opp = m.players[1 - this.owner];
      if (Math.abs(opp.x - m.ball.x) < 260 && opp.grounded) {
        this.stun(m, opp, 1.0);
        opp.vy = -420;
        opp.grounded = false;
      }
      m.shockwave = { x: m.ball.x, t: 0 };
    }
    this.finish(m);
  }

  /** Should the ball ignore this player? Applies on-touch effects to the opponent. */
  ignores(m: Match, p: Player, overlapping: boolean): boolean {
    if (this.hidden) return true;
    if (p.index === this.owner) return this.t < 0.25; // don't instantly re-touch your own shot
    if (!this.passThrough) return false;
    if (overlapping && !this.hitOpponent) {
      if (this.id === 'razor') {
        p.vx = this.dir * 650;
        p.vy = -380;
        p.grounded = false;
        this.stun(m, p, 0.7);
      } else if (this.id === 'yarn') {
        this.stun(m, p, 1.5);
        p.vx *= 0.2;
      }
    }
    return true;
  }

  private stun(m: Match, p: Player, seconds: number): void {
    this.hitOpponent = true;
    p.stunT = Math.max(p.stunT, seconds);
    p.setExpression('shock', seconds);
    p.charged = false;
    m.events.emit('superHit', { player: p.index, x: p.headX, y: p.headY });
  }

  finish(m: Match): void {
    if (this.done) return;
    this.done = true;
    this.hidden = false;
    m.ball.gravityScale = 1;
  }
}

/** Simple ballistic update for the ninja's decoy balls. */
export function updateDecoys(decoys: Decoy[], dt: number, gravityScale = 0.45): void {
  for (const d of decoys) {
    if (!d.alive) continue;
    d.px = d.x;
    d.py = d.y;
    d.pangle = d.angle;
    d.t += dt;
    d.vy += BALL_GRAVITY * gravityScale * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.angle += Math.sign(d.vx) * 30 * dt;
    if (d.t > 1.5 || d.y > GROUND_Y - 21 || d.x < 21 || d.x > W - 21 || d.y < 21) d.alive = false;
  }
}
