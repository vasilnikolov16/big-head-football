import { GROUND_Y, W } from '../core/constants';
import { rand } from '../core/math';

const enum Kind {
  Blade,
  Dust,
  Spark,
  Confetti,
  Star,
  Emoji,
  Bolt,
}

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
  g: number;
}

const MAX = 900;
const CONFETTI = ['#ff4d4d', '#ffd23f', '#4fd1ff', '#7cff6b', '#ff8fc7', '#c77dff', '#ffffff'];
const GRASS = ['#3fae45', '#2f8f3a', '#6ccf5a', '#8be06f'];

/** Lightweight particle system (pooled objects, no allocations while playing). */
export class Particles {
  private list: Particle[] = [];
  private pool: Particle[] = [];

  private spawn(kind: Kind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, g: number): void {
    if (this.list.length >= MAX) return;
    const p = this.pool.pop() ?? ({} as Particle);
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.max = life;
    p.size = size;
    p.color = color;
    p.rot = rand(0, Math.PI * 2);
    p.vr = rand(-12, 12);
    p.g = g;
    this.list.push(p);
  }

  clear(): void {
    this.pool.push(...this.list);
    this.list.length = 0;
  }

  /** grass blades + a little dust kicked up from the pitch */
  grass(x: number, power: number): void {
    const n = Math.round(4 + power * 12);
    for (let i = 0; i < n; i++) {
      this.spawn(Kind.Blade, x + rand(-18, 18), GROUND_Y - 2, rand(-160, 160) * (0.5 + power), rand(-520, -180) * (0.5 + power * 0.7), rand(0.45, 0.8), rand(4, 7), GRASS[i % GRASS.length], 1500);
    }
    this.dust(x, power * 0.8);
  }

  dust(x: number, power: number): void {
    const n = Math.round(2 + power * 4);
    for (let i = 0; i < n; i++) {
      this.spawn(Kind.Dust, x + rand(-14, 14), GROUND_Y - 4, rand(-70, 70), rand(-60, -20), rand(0.35, 0.6), rand(6, 11) * (0.6 + power), 'rgba(225,235,200,', -40);
    }
  }

  /** a burst of dust behind a dashing player */
  dashPuff(x: number, dir: number): void {
    for (let i = 0; i < 7; i++) {
      this.spawn(Kind.Dust, x - dir * rand(4, 22), GROUND_Y - rand(2, 12), -dir * rand(90, 260), rand(-70, -10), rand(0.3, 0.55), rand(7, 12), 'rgba(225,235,200,', -40);
    }
  }

  sparks(x: number, y: number, n: number, color: string, speed = 520): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(0.35, 1) * speed;
      this.spawn(Kind.Spark, x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.18, 0.4), rand(2, 3.5), color, 400);
    }
  }

  stars(x: number, y: number, n: number, color: string): void {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(80, 260);
      this.spawn(Kind.Star, x, y, Math.cos(a) * s, Math.sin(a) * s - 80, rand(0.5, 0.9), rand(5, 9), color, 300);
    }
  }

  /** goal celebration bought in the shop ('none' = the classic confetti) */
  celebrate(kind: string, side: number, x: number, y: number): void {
    switch (kind) {
      case 'emoji':
      case 'money': {
        const set = kind === 'money' ? ['💰', '💵', '🪙'] : ['😎', '🔥', '🤩', '⚽', '💪'];
        for (let i = 0; i < 46; i++) {
          this.spawn(Kind.Emoji, rand(0, W), rand(-160, -10), rand(-40, 40), rand(120, 260), rand(2.2, 3.2), rand(26, 40), set[i % set.length], 120);
        }
        break;
      }
      case 'stars':
        for (let i = 0; i < 70; i++) {
          this.spawn(Kind.Star, rand(0, W), rand(-120, 0), rand(-30, 30), rand(160, 320), rand(2, 3), rand(6, 13), ['#ffe14d', '#ffffff', '#ffd23f', '#9be7ff'][i % 4], 60);
        }
        break;
      case 'lightning':
        for (let i = 0; i < 6; i++) this.spawn(Kind.Bolt, rand(80, W - 80), 0, 0, 0, rand(0.25, 0.6) + i * 0.08, rand(0, 1000), '#fff59d', 0);
        this.sparks(x, y, 30, '#fff59d', 900);
        break;
      case 'fireworks':
        for (let b = 0; b < 5; b++) {
          const cx = rand(160, W - 160);
          const cy = rand(80, 300);
          const col = CONFETTI[b % CONFETTI.length];
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            const sp = rand(220, 380);
            this.spawn(Kind.Spark, cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.8, 1.3) + b * 0.15, 3, col, 220);
          }
        }
        break;
      default:
        this.confetti(side);
        return;
    }
    // a little confetti from the goal in every style
    const gx = side === 0 ? 60 : W - 60;
    for (let i = 0; i < 30; i++) {
      this.spawn(Kind.Confetti, gx, GROUND_Y - 120, rand(-1, 1) * 420 + (side === 0 ? 260 : -260), rand(-900, -350), rand(1.6, 2.6), rand(5, 9), CONFETTI[i % CONFETTI.length], 900);
    }
  }

  confetti(side: number): void {
    // a burst from the goal + rain over the whole pitch
    const gx = side === 0 ? 60 : W - 60;
    for (let i = 0; i < 70; i++) {
      this.spawn(Kind.Confetti, gx, GROUND_Y - 120, rand(-1, 1) * 420 + (side === 0 ? 260 : -260), rand(-900, -350), rand(1.6, 2.6), rand(5, 9), CONFETTI[i % CONFETTI.length], 900);
    }
    for (let i = 0; i < 110; i++) {
      this.spawn(Kind.Confetti, rand(0, W), rand(-60, 0), rand(-60, 60), rand(40, 160), rand(2.2, 3.4), rand(5, 9), CONFETTI[i % CONFETTI.length], 60);
    }
  }

  update(dt: number): void {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) {
        list[i] = list[list.length - 1];
        list.pop();
        this.pool.push(p);
        continue;
      }
      p.vy += p.g * dt;
      if (p.kind === Kind.Confetti) {
        p.vx *= 1 - dt * 1.5;
        if (p.vy > 140) p.vy = 140;
      } else if (p.kind === Kind.Dust) {
        p.vx *= 1 - dt * 3;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === Kind.Blade && p.y > GROUND_Y + 4) p.life = 0;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.list) {
      const k = p.life / p.max;
      switch (p.kind) {
        case Kind.Blade:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, k * 2);
          ctx.fillStyle = p.color;
          ctx.fillRect(-1.2, -p.size / 2, 2.4, p.size);
          ctx.restore();
          break;
        case Kind.Dust:
          ctx.fillStyle = `${p.color}${(0.35 * k).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.6 - k * 0.6), 0, Math.PI * 2);
          ctx.fill();
          break;
        case Kind.Spark:
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = k;
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
          ctx.restore();
          break;
        case Kind.Confetti:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(Math.cos(p.rot * 1.7), 1);
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.66);
          ctx.restore();
          break;
        case Kind.Emoji:
          ctx.save();
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.font = `${Math.round(p.size)}px ${EMOJI_FONT}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.color, p.x, p.y);
          ctx.restore();
          break;
        case Kind.Bolt: {
          // a jagged lightning bolt from the sky, flickering
          if (Math.floor(p.life * 30) % 3 === 0) break;
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 4;
          ctx.shadowColor = '#fff59d';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          let x = p.x;
          ctx.moveTo(x, 0);
          for (let y = 40; y <= GROUND_Y; y += 40) {
            x += Math.sin(p.size + y * 0.37) * 28;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.restore();
          break;
        }
        case Kind.Star:
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const r = i % 2 ? p.size * 0.35 : p.size;
            ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          }
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
