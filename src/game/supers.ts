import { BALL_GRAVITY, GOAL_DEPTH, GROUND_Y, W } from '../core/constants';
import type { ImpactLog } from '../physics/ball';
import type { SuperId } from './characters';
import type { Match } from './match';
import type { Player } from './player';

export interface SuperInfo {
  name: { bg: string; en: string };
  desc: { bg: string; en: string };
  color: string;
}

export const SUPER_INFO: Record<SuperId, SuperInfo> = {
  razor: { name: { bg: 'Бръсначен удар', en: 'Razor Shot' }, desc: { bg: 'Ниска свистяща топка, минава през противника и го отхвърля.', en: 'A low whistling ball that cuts through the opponent and knocks them back.' }, color: '#ff4d6d' },
  pounce: { name: { bg: 'Котешки скок', en: 'Cat Pounce' }, desc: { bg: 'Топката задрямва във въздуха… и изведнъж се хвърля към вратата.', en: 'The ball dozes off mid-air… then suddenly pounces at the goal.' }, color: '#ffb347' },
  laser: { name: { bg: 'Лазер', en: 'Laser' }, desc: { bg: 'Абсолютно права линия с огромна скорост.', en: 'A perfectly straight line at insane speed.' }, color: '#4fd1ff' },
  sonic: { name: { bg: 'Соло на китара', en: 'Guitar Solo' }, desc: { bg: 'Звукова вълна по синусоида, зашеметява противника.', en: 'A sine-wave sound blast that stuns the opponent.' }, color: '#ff3df2' },
  yarn: { name: { bg: 'Кълбо прежда', en: 'Yarn Ball' }, desc: { bg: 'Самонасочващо се кълбо, което оплита противника.', en: 'A homing ball of yarn that ties up the opponent.' }, color: '#ff8fc7' },
  warp: { name: { bg: 'Телепорт', en: 'Teleport' }, desc: { bg: 'Топката изчезва и се появява точно пред чуждата врата.', en: 'The ball vanishes and reappears right in front of the goal.' }, color: '#9dff5c' },
  thunder: { name: { bg: 'Гръм', en: 'Thunder' }, desc: { bg: 'Топката излита до небето и се забива като мълния.', en: 'The ball flies to the sky and strikes down like lightning.' }, color: '#ffe14d' },
  shadow: { name: { bg: 'Сенки', en: 'Shadow Clones' }, desc: { bg: 'Три еднакви топки — само една е истинска.', en: 'Three identical balls — only one is real.' }, color: '#b8a9ff' },
  pan: { name: { bg: 'Горещ тиган', en: 'Hot Pan' }, desc: { bg: 'Палачинката полита, обръща се във въздуха и се забива във вратата.', en: 'The pancake flies up, flips in the air and slams into the goal.' }, color: '#ff9f1c' },
  bats: { name: { bg: 'Ято прилепи', en: 'Bat Swarm' }, desc: { bg: 'Топката лети на зигзаг като прилеп.', en: 'The ball zigzags like a bat.' }, color: '#9d4edd' },
  hose: { name: { bg: 'Воден маркуч', en: 'Fire Hose' }, desc: { bg: 'Ниска водна струя право към долния ъгъл.', en: 'A low water jet straight to the bottom corner.' }, color: '#4cc9f0' },
  avalanche: { name: { bg: 'Лавина', en: 'Avalanche' }, desc: { bg: 'Снежна топка, която расте, докато се търкаля.', en: 'A snowball that grows as it rolls.' }, color: '#cfe8ff' },
  cannon: { name: { bg: 'Гюле', en: 'Cannonball' }, desc: { bg: 'Висока дъга и експлозия при падането.', en: 'A high arc and a blast where it lands.' }, color: '#8d99ae' },
  hook: { name: { bg: 'Кроше', en: 'Hook Shot' }, desc: { bg: 'Излита нагоре и завива рязко към вратата.', en: 'Flies up, then curls sharply into the goal.' }, color: '#ff4d4d' },
  magic: { name: { bg: 'Звездна магия', en: 'Star Magic' }, desc: { bg: 'Топката скача през пространството на три пъти.', en: 'The ball blinks through space three times.' }, color: '#ffd60a' },
  roar: { name: { bg: 'Рев', en: 'Roar' }, desc: { bg: 'Ударна вълна по земята изхвърля противника, а топката минава отдолу.', en: 'A ground shockwave throws the opponent up while the ball skims below.' }, color: '#80ed99' },
};

/** What happens to a player who blocks (or is caught by) each super shot. */
export const SUPER_HIT: Record<SuperId, { bg: string; en: string }> = {
  razor: { bg: 'Който го спре, отхвърча назад.', en: 'Whoever blocks it is knocked back.' },
  pounce: { bg: 'Който го спре, е издраскан и замаян.', en: 'Whoever blocks it gets scratched and dazed.' },
  laser: { bg: 'Който го спре, получава ток и замръзва на място.', en: 'Whoever blocks it is shocked stiff.' },
  sonic: { bg: 'Който го чуе отблизо, оглушава и бърка посоките.', en: 'Hearing it up close deafens you: controls reversed.' },
  yarn: { bg: 'Който го спре, се оплита и едва се движи.', en: 'Whoever blocks it gets tangled up and slowed.' },
  warp: { bg: 'Който го спре, бива отвлечен нагоре.', en: 'Whoever blocks it gets beamed up.' },
  thunder: { bg: 'Мълнията и ударната вълна зашеметяват.', en: 'The lightning and the shockwave stun.' },
  shadow: { bg: 'Който го спре, се забавя в облак дим.', en: 'Whoever blocks it is slowed in a cloud of smoke.' },
  pan: { bg: 'Който го спре, се опарва.', en: 'Whoever blocks it gets burned.' },
  bats: { bg: 'Който го спре, губи сила и супер енергия.', en: 'Whoever blocks it is drained of strength and super energy.' },
  hose: { bg: 'Който го спре, бива отнесен от струята.', en: 'Whoever blocks it is washed away.' },
  avalanche: { bg: 'Който го спре, замръзва.', en: 'Whoever blocks it freezes.' },
  cannon: { bg: 'Взривът смачква главата на противника.', en: 'The blast squashes the opponent’s head.' },
  hook: { bg: 'Който го спре, е в нокдаун: посоките се объркват.', en: 'Whoever blocks it is knocked silly: controls reversed.' },
  magic: { bg: 'Който го спре, става на жаба и не може да скача.', en: 'Whoever blocks it turns into a frog and can’t jump.' },
  roar: { bg: 'Ударната вълна изхвърля противника във въздуха.', en: 'The shockwave throws the opponent into the air.' },
};

/** Seconds the game freezes while the hero winds up the super shot. */
export const WINDUP = 1.05;

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
  /** seconds in the current stage (the wind-up, then the flight from 0 again) */
  t = 0;
  /** -1 = wind-up (ball held in front of the hero), 0+ = the shot's own phases */
  phase = -1;
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
  private r0 = 0;
  private waveAt = 0;
  private fromX = 0;
  private fromY = 0;
  private holdX = 0;
  private holdY = 0;

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

  /** the ball is held for the wind-up; the whole match stands still */
  get holding(): boolean {
    return this.phase === -1 && !this.done;
  }

  /** Wind-up: the ball floats to a spot in front of the hero and charges up. */
  begin(m: Match): void {
    const b = m.ball;
    const p = m.players[this.owner];
    this.phase = -1;
    this.t = 0;
    this.fromX = b.x;
    this.fromY = b.y;
    this.holdX = Math.max(b.r + 4, Math.min(W - b.r - 4, p.x + p.facing * (p.halfW + b.r + 16)));
    this.holdY = Math.max(p.headY - p.headR * 0.3, Math.min(p.y - b.r - 22, b.y));
    b.vx = b.vy = 0;
    b.gravityScale = 0;
    b.dragScale = 0; // super shots fly exactly as designed
  }

  private windup(m: Match, dt: number): void {
    const b = m.ball;
    const k = 1 - Math.pow(1 - Math.min(1, this.t / 0.32), 3);
    const shake = Math.min(1, this.t / WINDUP) * 3;
    b.x = this.fromX + (this.holdX - this.fromX) * k + Math.sin(this.t * 71) * shake;
    b.y = this.fromY + (this.holdY - this.fromY) * k + Math.sin(this.t * 6) * 4 + Math.cos(this.t * 83) * shake;
    b.vx = b.vy = 0;
    b.angle += dt * (8 + this.t * 30) * this.dir;
    if (this.t >= WINDUP) {
      b.px = b.x;
      b.py = b.y;
      this.phase = 0;
      this.t = 0;
      this.start(m);
      m.launchSuper(this);
    }
  }

  /** skip the wind-up (party mode "every kick is super") */
  launchNow(m: Match): void {
    this.phase = 0;
    this.t = 0;
    this.start(m);
    m.launchSuper(this);
  }

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
        b.vx = this.dir * 650;
        b.vy = -420;
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
      case 'pan':
        b.gravityScale = 0;
        b.vx = this.dir * 260;
        b.vy = -1250;
        break;
      case 'bats':
        b.gravityScale = 0;
        this.ty = this.bestAimY(m);
        break;
      case 'hose':
        b.gravityScale = 0;
        b.spin = 0;
        this.aim(m, 1900);
        this.ty = GROUND_Y - 40;
        this.aimAt(m, 1900, this.ty);
        break;
      case 'avalanche':
        b.gravityScale = 0;
        this.r0 = b.r;
        b.vx = this.dir * 300;
        b.vy = 1100;
        break;
      case 'cannon': {
        b.gravityScale = 1;
        b.spin = this.dir * 8;
        const T = 1.15;
        const side = this.owner === 0 ? 1 : 0;
        const ty = (m.arena.goalTop[side] + GROUND_Y) / 2;
        b.vx = (this.tx - b.x) / T;
        b.vy = (ty - b.y - 0.5 * BALL_GRAVITY * T * T) / T;
        break;
      }
      case 'hook':
        b.gravityScale = 0;
        b.vx = this.dir * 950;
        b.vy = -1100;
        break;
      case 'magic':
        b.gravityScale = 0;
        b.vx = 0;
        b.vy = -120;
        break;
      case 'roar':
        b.gravityScale = 0;
        b.vx = this.dir * 1250;
        this.waveAt = -1;
        break;
    }
  }

  /** straight line to a given height in the goal mouth */
  private aimAt(m: Match, speed: number, ty: number): void {
    const b = m.ball;
    const dx = this.tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.vx = (dx / d) * speed;
    b.vy = (dy / d) * speed;
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
    const top = m.arena.goalTop[side] + b.r + 16; // clear of the crossbar
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
    if (this.phase === -1) {
      this.windup(m, dt);
      return;
    }
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
        if (!this.hitOpponent && Math.abs(opp.headX - b.x) < 150 && Math.abs(opp.headY - b.y) < 190) this.hitEffect(m, opp);
        if (t > 1.8) this.finish(m);
        break;
      }
      case 'yarn': {
        if (t > 0.18) {
          const dx = this.tx - b.x;
          const dy = this.ty - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * 4.6);
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
      case 'pan':
        if (this.phase === 0 && (t > 0.32 || b.y < 150)) this.phase = 1;
        if (this.phase === 1) {
          // the pancake flips in the air
          b.vx = b.vy = 0;
          if (t > 0.56) {
            this.phase = 2;
            this.aim(m, 1750);
          }
        } else if (this.phase === 2) {
          this.keepSpeed(m, 1750);
          if (t > 2) this.finish(m);
        }
        break;
      case 'bats': {
        // zigzag along the line to the goal
        const total = Math.abs(this.tx - this.x0) / 1150;
        const k = Math.min(1, t / Math.max(0.2, total));
        const wantX = this.x0 + (this.tx - this.x0) * k;
        // the zigzag is widest mid-flight and calms down at both ends (no scraping the floor or the bar)
        const wantY = Math.max(140, Math.min(GROUND_Y - b.r - 12, this.y0 + (this.ty - this.y0) * k + Math.sin(t * 10) * 120 * Math.sin(Math.PI * k)));
        b.vx = Math.max(-2200, Math.min(2200, (wantX - b.x) / dt));
        b.vy = Math.max(-2200, Math.min(2200, (wantY - b.y) / dt));
        if (t > 2) this.finish(m);
        break;
      }
      case 'hose':
        this.keepSpeed(m, 1900);
        if (t > 1.3) this.finish(m);
        break;
      case 'avalanche':
        if (this.phase === 0 && (b.y >= GROUND_Y - b.r - 2 || t > 0.4)) this.phase = 1;
        if (this.phase === 1) {
          b.r = this.r0 * Math.min(1.9, 1 + t * 0.9);
          b.vx = this.dir * 1000;
          b.vy = 0;
          b.y = GROUND_Y - b.r;
          b.spin = this.dir * 40;
        }
        if (t > 2.3) this.finish(m);
        break;
      case 'cannon':
        if (t > 2.4) this.finish(m);
        break;
      case 'hook':
        if (t > 0.3) {
          // curl down in front of the goal first, then straight in under the crossbar
          const before = (b.x - (this.tx - this.dir * 170)) * this.dir < 0;
          const dx = (before ? this.tx - this.dir * 170 : this.tx) - b.x;
          const dy = (before ? GROUND_Y - 110 : GROUND_Y - 80) - b.y;
          const d = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * 12);
          b.vx += ((dx / d) * 2100 - b.vx) * k;
          b.vy += ((dy / d) * 2100 - b.vy) * k;
        }
        if (t > 1.6) this.finish(m);
        break;
      case 'magic': {
        const hop = this.phase;
        if (hop < 3 && t > 0.16 + hop * 0.2) {
          // blink forward towards the goal
          this.phase = hop + 1;
          const nx = b.x + (this.tx - b.x) * 0.3;
          const ny = b.y + (this.ty - b.y) * 0.3 - 40;
          b.x = b.px = nx;
          b.y = b.py = ny;
          b.vx = b.vy = 0;
        } else if (hop < 3) {
          b.vx = b.vy = 0;
        } else if (hop === 3) {
          this.phase = 4;
          this.aim(m, 1700);
        } else this.keepSpeed(m, 1700);
        if (t > 2) this.finish(m);
        break;
      }
      case 'roar': {
        // the ball skims low behind a shockwave running along the ground
        const wantY = GROUND_Y - b.r - 6;
        b.vx = this.dir * 1250;
        b.vy = Math.max(-1200, Math.min(1200, (wantY - b.y) / Math.max(dt, 0.02)));
        const waveX = this.x0 + this.dir * 1450 * t;
        if (t - this.waveAt >= 0.1 || this.waveAt > t) {
          this.waveAt = t;
          m.shockwave = { x: Math.max(20, Math.min(W - 20, waveX)), t: 0 };
        }
        const opp = m.players[1 - this.owner];
        if (!this.hitOpponent && opp.grounded && Math.abs(opp.x - waveX) < 70) {
          this.hitEffect(m, opp);
        }
        if (t > 1.6) this.finish(m);
        break;
      }
    }
  }

  private phase1At = 0;

  /** Called after the physics step with the world impacts of this step. */
  afterStep(m: Match, imp: ImpactLog): void {
    if (this.done || this.phase === -1) return;
    const hitWorld = imp.ground > 0 || imp.wall > 0 || imp.bar > 0 || imp.ceiling > 0;
    if (!hitWorld) return;
    // rising/hovering phases may scrape the ceiling or floor without ending the shot
    if (this.id === 'pounce' && this.phase < 2) return;
    if (this.id === 'thunder' && this.phase < 2) return;
    if (this.id === 'warp' && this.phase < 2) return;
    if (this.id === 'yarn' && this.t < 0.2) return;
    if ((this.id === 'laser' || this.id === 'shadow') && this.phase < 2) return;
    if (this.id === 'pan' && this.phase < 2) return;
    if (this.id === 'avalanche' && imp.ground > 0 && imp.wall === 0 && imp.bar === 0) return;
    if (this.id === 'roar' && imp.ground > 0 && imp.wall === 0 && imp.bar === 0) return;
    if (this.id === 'magic' && this.phase < 4) return;
    if (this.id === 'hook' && this.t < 0.3) return;
    if (this.id === 'bats' && imp.wall === 0 && imp.bar === 0) return;
    if (this.id === 'cannon') {
      // the cannonball explodes where it lands
      const opp = m.players[1 - this.owner];
      if (Math.abs(opp.x - m.ball.x) < 240 && !this.hitOpponent) this.hitEffect(m, opp);
      m.shockwave = { x: m.ball.x, t: 0 };
      m.events.emit('superHit', { player: opp.index, x: m.ball.x, y: m.ball.y });
    }
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
    if (this.hidden || this.phase === -1) return true;
    if (p.index === this.owner) return this.t < 0.25; // don't instantly re-touch your own shot
    void overlapping;
    void m;
    // every super can be blocked by the opponent (who pays for it: see hitEffect)
    return false;
  }

  /** The opponent blocked the shot (or was caught by its wave / blast): the hero's own effect. */
  hitEffect(m: Match, p: Player): void {
    if (this.hitOpponent) return;
    const d = this.dir;
    switch (this.id) {
      case 'razor':
        p.vx = d * 650;
        p.vy = -380;
        p.grounded = false;
        this.stun(m, p, 0.7);
        break;
      case 'pounce':
        this.stun(m, p, 0.85);
        break;
      case 'laser':
        p.vx = 0;
        this.stun(m, p, 1.1);
        break;
      case 'sonic':
        p.reversedT = Math.max(p.reversedT, 2.2);
        this.stun(m, p, 0.35);
        break;
      case 'yarn':
        p.slowT = Math.max(p.slowT, 2.5);
        p.vx *= 0.2;
        this.stun(m, p, 0.6);
        break;
      case 'warp':
        p.vy = -950;
        p.grounded = false;
        this.stun(m, p, 0.7);
        break;
      case 'thunder':
        this.stun(m, p, 1.2);
        break;
      case 'shadow':
        p.slowT = Math.max(p.slowT, 2);
        this.stun(m, p, 0.4);
        break;
      case 'pan':
        p.burnT = Math.max(p.burnT, 2.2);
        p.vy = -320;
        p.grounded = false;
        this.stun(m, p, 0.9);
        break;
      case 'bats':
        p.slowT = Math.max(p.slowT, 2.5);
        p.energy = 0;
        m.players[this.owner].addEnergy(0.3);
        this.stun(m, p, 0.3);
        break;
      case 'hose':
        p.vx = d * 1100;
        p.vy = -260;
        p.grounded = false;
        this.stun(m, p, 0.55);
        break;
      case 'avalanche':
        p.frozenT = Math.max(p.frozenT, 1.6);
        this.stun(m, p, 0.01);
        break;
      case 'cannon':
        p.shrinkT = Math.max(p.shrinkT, 3.5);
        p.vy = -500;
        p.grounded = false;
        this.stun(m, p, 0.5);
        break;
      case 'hook':
        p.reversedT = Math.max(p.reversedT, 2.2);
        p.vx = d * 420;
        this.stun(m, p, 0.45);
        break;
      case 'magic':
        p.noJumpT = Math.max(p.noJumpT, 3.5);
        this.stun(m, p, 0.3);
        break;
      case 'roar':
        p.vy = -720;
        p.grounded = false;
        this.stun(m, p, 0.9);
        break;
    }
  }

  private stun(m: Match, p: Player, seconds: number): void {
    this.hitOpponent = true;
    p.stunT = Math.max(p.stunT, seconds);
    p.setExpression('shock', seconds);
    m.events.emit('superHit', { player: p.index, x: p.headX, y: p.headY });
  }

  finish(m: Match): void {
    if (this.done) return;
    this.done = true;
    this.hidden = false;
    if (this.id === 'avalanche' && this.r0 > 0) m.ball.r = this.r0;
    m.ball.gravityScale = 1;
    m.ball.dragScale = 1;
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
