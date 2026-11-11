import { FONT_DISPLAY, GROUND_Y, INK } from '../core/constants';
import { clamp, easeOutBack, lerp } from '../core/math';
import type { Match } from '../game/match';
import { SUPER_INFO, type SuperShot } from '../game/supers';
import { drawBall } from './ballDraw';

interface TrailPt {
  x: number;
  y: number;
}

/** Visuals for super shots: trails, beams, rings, portals, decoys, callouts. */
export class SuperFx {
  private trail: TrailPt[] = [];
  private rings: Array<{ x: number; y: number; t: number }> = [];
  private ringT = 0;
  private shot: SuperShot | null = null;
  private startX = 0;
  private startY = 0;
  private warpFrom: TrailPt | null = null;
  private warpTo: TrailPt | null = null;
  private warpT = 0;

  update(m: Match, dt: number, bx: number, by: number): void {
    const s = m.superShot;
    if (s !== this.shot) {
      this.shot = s;
      this.trail = [];
      if (s) {
        this.startX = bx;
        this.startY = by;
        this.warpFrom = null;
        this.warpTo = null;
      }
    }
    // the laser beam starts where it is fired (after the lift)
    if (s?.id === 'laser' && s.phase < 2) {
      this.startX = bx;
      this.startY = by;
    }
    if (s && !s.hidden) {
      this.trail.push({ x: bx, y: by });
      if (this.trail.length > 26) this.trail.shift();
    } else if (!s && this.trail.length) this.trail.shift();

    if (s?.id === 'sonic') {
      this.ringT -= dt;
      if (this.ringT <= 0) {
        this.ringT = 0.07;
        this.rings.push({ x: bx, y: by, t: 0 });
      }
    }
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.5);

    if (s?.id === 'warp') {
      if (s.hidden && !this.warpFrom) this.warpFrom = { x: this.trail.at(-1)?.x ?? bx, y: this.trail.at(-1)?.y ?? by };
      if (s.phase === 2 && !this.warpTo) {
        this.warpTo = { x: bx, y: by };
        this.warpT = 0;
      }
    }
    this.warpT += dt;
  }

  /** Behind the ball. */
  drawBack(ctx: CanvasRenderingContext2D, t: number): void {
    const s = this.shot;
    const tr = this.trail;
    const color = s ? SUPER_INFO[s.id].color : '#ffffff';

    // rings (sonic) live a little after the shot
    for (const r of this.rings) {
      const k = r.t / 0.5;
      ctx.strokeStyle = `rgba(255,61,242,${0.7 * (1 - k)})`;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 20 + k * 70, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (this.warpFrom && s?.id === 'warp') this.portal(ctx, this.warpFrom.x, this.warpFrom.y, t, clamp(1.4 - s.t * 1.5, 0, 1));
    if (this.warpTo && s?.id === 'warp') this.portal(ctx, this.warpTo.x, this.warpTo.y, t, clamp(1 - this.warpT * 1.6, 0, 1));

    if (!s || tr.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (s.id) {
      case 'laser': {
        if (s.phase < 2) {
          this.streak(ctx, tr, color, 1);
          break;
        }
        const last = tr[tr.length - 1];
        ctx.globalCompositeOperation = 'lighter';
        for (const [w, a] of [
          [26, 0.15],
          [14, 0.35],
          [5, 1],
        ]) {
          ctx.strokeStyle = w === 5 ? `rgba(230,255,255,${a})` : `rgba(79,209,255,${a})`;
          ctx.lineWidth = w;
          ctx.beginPath();
          ctx.moveTo(this.startX, this.startY);
          ctx.lineTo(last.x, last.y);
          ctx.stroke();
        }
        break;
      }
      case 'thunder': {
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = 'rgba(255,240,120,0.9)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#ffe14d';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        tr.forEach((p, i) => {
          const j = i % 2 ? 9 : -9;
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x + j * Math.sin(t * 40 + i), p.y + j * Math.cos(t * 37 + i));
        });
        ctx.stroke();
        break;
      }
      case 'yarn': {
        ctx.strokeStyle = '#ff8fc7';
        ctx.lineWidth = 3;
        ctx.beginPath();
        tr.forEach((p, i) => {
          const w = Math.sin(i * 0.9 + t * 10) * 5;
          if (i === 0) ctx.moveTo(p.x, p.y + w);
          else ctx.lineTo(p.x, p.y + w);
        });
        ctx.stroke();
        break;
      }
      case 'pounce':
        if (s.phase === 1) {
          ctx.font = `20px ${FONT_DISPLAY}`;
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4;
          const last = tr[tr.length - 1];
          for (let i = 0; i < 3; i++) {
            const k = (t * 1.5 + i / 3) % 1;
            const zx = last.x + 18 + k * 30;
            const zy = last.y - 20 - k * 40;
            ctx.globalAlpha = 1 - k;
            ctx.strokeText('z', zx, zy);
            ctx.fillText('z', zx, zy);
          }
          ctx.globalAlpha = 1;
          break;
        }
        this.streak(ctx, tr, color, 3);
        break;
      case 'razor':
        this.streak(ctx, tr, color, 2);
        break;
      default:
        this.streak(ctx, tr, color, 1);
    }
    ctx.restore();
  }

  private streak(ctx: CanvasRenderingContext2D, tr: TrailPt[], color: string, lines: number): void {
    ctx.globalCompositeOperation = 'lighter';
    const n = tr.length;
    for (let l = 0; l < lines; l++) {
      const off = (l - (lines - 1) / 2) * 12;
      for (let i = 1; i < n; i++) {
        const a = tr[i - 1];
        const b = tr[i];
        const k = i / n;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = (-dy / d) * off;
        const ny = (dx / d) * off;
        ctx.strokeStyle = color;
        ctx.globalAlpha = k * 0.8;
        ctx.lineWidth = (lines > 1 ? 5 : 16) * k + 1;
        ctx.beginPath();
        ctx.moveTo(a.x + nx, a.y + ny);
        ctx.lineTo(b.x + nx, b.y + ny);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  private portal(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, a: number): void {
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = a;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i % 2 ? '#c77dff' : '#9dff5c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34 - i * 9, 46 - i * 12, t * (2 + i), 0, Math.PI * 1.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Scale of the real ball (shrinks into the teleport). */
  ballScale(m: Match): number {
    const s = m.superShot;
    if (s?.id === 'warp' && s.phase === 0) return clamp(1 - s.t / 0.22, 0.05, 1);
    if (s?.id === 'warp' && s.phase === 2) return clamp((s.t - 0.55) / 0.15, 0.1, 1);
    return 1;
  }

  /** On top of the ball. */
  drawFront(ctx: CanvasRenderingContext2D, m: Match, bx: number, by: number, r: number, t: number): void {
    const s = m.superShot;
    if (s && !s.hidden) {
      const color = SUPER_INFO[s.id].color;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(bx, by, r * 0.5, bx, by, r * 2.4);
      g.addColorStop(0, color + 'aa');
      g.addColorStop(1, color + '00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, r * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (s.id === 'razor') {
        // spinning blades
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(t * 25);
        ctx.fillStyle = '#e8eef7';
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          ctx.rotate(Math.PI);
          ctx.beginPath();
          ctx.moveTo(r * 0.6, -3);
          ctx.lineTo(r * 1.9, 0);
          ctx.lineTo(r * 0.6, 3);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        ctx.restore();
      } else if (s.id === 'yarn') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = '#ff8fc7';
        ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        ctx.strokeStyle = '#c94f8a';
        ctx.lineWidth = 2;
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.ellipse(bx, by, r * 1.1, r * 0.3, t * 3 + i * 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // thunder shockwave on the ground
    if (m.shockwave) {
      const k = m.shockwave.t / 0.6;
      ctx.save();
      ctx.strokeStyle = `rgba(255,225,77,${1 - k})`;
      ctx.lineWidth = 6 * (1 - k) + 2;
      ctx.beginPath();
      ctx.ellipse(m.shockwave.x, GROUND_Y, 40 + k * 260, 10 + k * 30, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawDecoys(ctx: CanvasRenderingContext2D, m: Match, alpha: number): void {
    for (const d of m.decoys) {
      const x = lerp(d.px, d.x, alpha);
      const y = lerp(d.py, d.y, alpha);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 10, x, y, 50);
      g.addColorStop(0, '#b8a9ffaa');
      g.addColorStop(1, '#b8a9ff00');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      drawBall(ctx, x, y, m.ball.r, lerp(d.pangle, d.angle, alpha));
    }
  }

  drawCallout(ctx: CanvasRenderingContext2D, m: Match): void {
    const c = m.callout;
    if (!c) return;
    const p = m.players[c.player];
    const inT = clamp(c.t / 0.25, 0, 1);
    const out = clamp((1.4 - c.t) / 0.3, 0, 1);
    ctx.save();
    ctx.translate(clamp(p.x, 160, 1120), p.headY - p.headR - 46 - c.t * 20);
    ctx.scale(easeOutBack(inT), easeOutBack(inT));
    ctx.globalAlpha = out;
    ctx.font = `34px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = INK;
    ctx.strokeText(c.text, 0, 0);
    ctx.fillStyle = c.color;
    ctx.fillText(c.text, 0, 0);
    ctx.restore();
  }
}
