import { BALL_R, GROUND_Y, W } from '../core/constants';
import { rand } from '../core/math';
import { tr } from '../i18n/i18n';
import type { Match } from './match';
import type { Player } from './player';

export type PowerType = 'bigBall' | 'smallBall' | 'highJump' | 'fireBall' | 'freeze' | 'bigHead' | 'smallGoal' | 'reverse';

export interface PowerInfo {
  name: { bg: string; en: string };
  color: string;
  /** seconds the effect lasts */
  duration: number;
  /** who is affected: the collector, the opponent, or everybody (the ball) */
  target: 'self' | 'opponent' | 'ball';
}

export const POWER_INFO: Record<PowerType, PowerInfo> = {
  bigBall: { name: { bg: 'Голяма топка', en: 'Big ball' }, color: '#ff9f1c', duration: 8, target: 'ball' },
  smallBall: { name: { bg: 'Малка топка', en: 'Small ball' }, color: '#4fd1ff', duration: 8, target: 'ball' },
  highJump: { name: { bg: 'Висок скок', en: 'High jump' }, color: '#7cff6b', duration: 9, target: 'self' },
  fireBall: { name: { bg: 'Огнена топка', en: 'Fire ball' }, color: '#ff4d2d', duration: 9, target: 'self' },
  freeze: { name: { bg: 'Замразяване', en: 'Freeze' }, color: '#9be7ff', duration: 3, target: 'opponent' },
  bigHead: { name: { bg: 'Голяма глава', en: 'Big head' }, color: '#ffd23f', duration: 9, target: 'self' },
  smallGoal: { name: { bg: 'Малка врата', en: 'Small goal' }, color: '#c77dff', duration: 9, target: 'self' },
  reverse: { name: { bg: 'Обърнато управление', en: 'Reversed controls' }, color: '#ff5ea8', duration: 5, target: 'opponent' },
};

const TYPES = Object.keys(POWER_INFO) as PowerType[];

export interface PowerItem {
  type: PowerType;
  x: number;
  y: number;
  px: number;
  py: number;
  vy: number;
  /** seconds left on the pitch */
  life: number;
  landed: boolean;
  t: number;
}

export interface ActiveEffect {
  type: PowerType;
  /** affected player (-1 for ball effects) */
  player: number;
  left: number;
  dur: number;
}

export const ITEM_R = 24;
const ITEM_LIFE = 7;
const HOVER_Y = GROUND_Y - 120;

export class PowerUps {
  items: PowerItem[] = [];
  active: ActiveEffect[] = [];
  private spawnT = rand(5, 8);

  constructor(public enabled: boolean) {}

  clearItems(): void {
    this.items = [];
  }

  update(m: Match, dt: number): void {
    // effects tick even after the whistle so they always expire
    for (const e of this.active) {
      e.left -= dt;
      if (e.left <= 0) this.end(m, e);
    }
    this.active = this.active.filter((e) => e.left > 0);

    if (!this.enabled) return;
    if (m.phase === 'playing') {
      this.spawnT -= dt;
      if (this.spawnT <= 0 && this.items.length === 0) {
        this.spawn(m);
        this.spawnT = rand(9, 15);
      }
    }

    const b = m.ball;
    for (const it of this.items) {
      it.px = it.x;
      it.py = it.y;
      it.t += dt;
      if (!it.landed) {
        it.y += it.vy * dt;
        it.x += Math.sin(it.t * 2) * 20 * dt; // drifting under the parachute
        if (it.y >= HOVER_Y) {
          it.y = HOVER_Y;
          it.landed = true;
        }
      } else {
        it.y = HOVER_Y + Math.sin(it.t * 3) * 6;
        it.life -= dt;
      }
      if (m.phase !== 'playing') continue;
      // picked up by the ball (goes to whoever touched it last) …
      const dbx = b.x - it.x;
      const dby = b.y - it.y;
      const rr = b.r + ITEM_R;
      if (dbx * dbx + dby * dby < rr * rr && b.lastTouch >= 0 && !m.superShot?.hidden) {
        this.collect(m, m.players[b.lastTouch], it);
        continue;
      }
      // … or by a player touching it
      for (const p of m.players) {
        const dx = p.headX - it.x;
        const dy = p.headY - it.y;
        const r2 = p.headR + ITEM_R;
        if (dx * dx + dy * dy < r2 * r2 || (Math.abs(p.x - it.x) < ITEM_R + 16 && it.y > p.y - 70 && it.y < p.y)) {
          this.collect(m, p, it);
          break;
        }
      }
    }
    this.items = this.items.filter((it) => it.life > 0);
  }

  private spawn(m: Match): void {
    const type = TYPES[Math.floor(Math.random() * TYPES.length)];
    const x = rand(230, W - 230);
    this.items.push({ type, x, y: -40, px: x, py: -40, vy: 120, life: ITEM_LIFE, landed: false, t: 0 });
    m.events.emit('powerSpawn', { type, x });
  }

  private collect(m: Match, p: Player, it: PowerItem): void {
    it.life = 0;
    const info = POWER_INFO[it.type];
    const opp = m.players[1 - p.index];
    const target = info.target === 'opponent' ? opp : p;
    // replace a running effect of the same family
    const family = (t: PowerType): string => (t === 'bigBall' || t === 'smallBall' ? 'ball' : t);
    for (const e of this.active) {
      if (family(e.type) === family(it.type) && (info.target === 'ball' || e.player === target.index)) this.end(m, e);
    }
    this.active = this.active.filter((e) => e.left > 0);

    const eff: ActiveEffect = {
      type: it.type,
      player: info.target === 'ball' ? -1 : target.index,
      left: info.duration,
      dur: info.duration,
    };
    this.active.push(eff);
    switch (it.type) {
      case 'bigBall':
        m.ball.r = BALL_R * 1.55;
        break;
      case 'smallBall':
        m.ball.r = BALL_R * 0.65;
        break;
      case 'highJump':
        target.jumpBoostT = info.duration;
        break;
      case 'fireBall':
        target.fireT = info.duration;
        break;
      case 'freeze':
        target.frozenT = info.duration;
        target.charged = false;
        target.setExpression('shock', info.duration);
        break;
      case 'bigHead':
        target.headScale = 1.45;
        break;
      case 'smallGoal':
        m.arena.setGoalTop(target.index as 0 | 1, GROUND_Y - 140);
        break;
      case 'reverse':
        target.reversedT = info.duration;
        target.setExpression('shock', 1);
        break;
    }
    p.setExpression('happy', 0.8);
    m.events.emit('powerPick', {
      player: p.index,
      type: it.type,
      x: it.x,
      y: it.y,
      color: info.color,
      good: true,
    });
    m.callout = { text: tr(info.name).toUpperCase() + '!', color: info.color, player: p.index, t: 0 };
  }

  private end(m: Match, e: ActiveEffect): void {
    e.left = 0;
    const p = e.player >= 0 ? m.players[e.player] : null;
    switch (e.type) {
      case 'bigBall':
      case 'smallBall':
        m.ball.r = BALL_R;
        break;
      case 'highJump':
        if (p) p.jumpBoostT = 0;
        break;
      case 'fireBall':
        if (p) p.fireT = 0;
        break;
      case 'freeze':
        if (p) p.frozenT = 0;
        break;
      case 'bigHead':
        if (p) p.headScale = 1;
        break;
      case 'smallGoal':
        if (p) m.arena.setGoalTop(p.index as 0 | 1, m.arena.defaultGoalTop);
        break;
      case 'reverse':
        if (p) p.reversedT = 0;
        break;
    }
    m.events.emit('powerEnd', { player: e.player, type: e.type });
  }

  /** Remove every effect (end of match). */
  endAll(m: Match): void {
    for (const e of this.active) this.end(m, e);
    this.active = [];
    this.items = [];
  }
}
