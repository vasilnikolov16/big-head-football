import { INK, W, SCREEN } from '../core/constants';
import { clamp, easeOutBack, easeOutCubic } from '../core/math';
import type { CharacterDef } from '../game/characters';
import { Player } from '../game/player';
import { SUPER_INFO } from '../game/supers';
import { drawHead } from './playerDraw';

/** Real seconds the cinematic lasts after the ball is struck. */
const RELEASE = 0.6;
/** Safety: never longer than this in total. */
const MAX_T = 3;

interface Shot {
  /** seconds since the wind-up began */
  t: number;
  /** seconds since the ball was struck, or -1 during the wind-up */
  rel: number;
  side: 0 | 1;
  color: string;
  portrait: Player;
}

/**
 * Fighting-game style super shot moment: the game slows down, the camera
 * zooms on the hero, the stadium goes dark around a spotlight, speed lines
 * burst out and a cut-in strip with the hero's face
 * sweeps across the screen.
 */
export class SuperCinematic {
  private shot: Shot | null = null;

  start(side: 0 | 1, def: CharacterDef): void {
    const info = SUPER_INFO[def.super];
    const portrait = new Player(side, def);
    portrait.placeAt(0, 0);
    portrait.setExpression('angry', 99);
    portrait.lookX = side === 0 ? 1 : -1;
    this.shot = { t: 0, rel: -1, side, color: info.color, portrait };
  }

  /** the ball was struck: short slow motion, then back to normal */
  release(): void {
    if (this.shot && this.shot.rel < 0) this.shot.rel = 0;
  }

  /** index of the shooting player */
  get side(): number {
    return this.shot?.side ?? 0;
  }

  get active(): boolean {
    return this.shot !== null;
  }

  update(dt: number): void {
    const s = this.shot;
    if (!s) return;
    s.t += dt;
    if (s.rel >= 0) s.rel += dt;
    if (s.rel >= RELEASE || s.t >= MAX_T) this.shot = null;
  }

  /** Multiplier for the simulation speed: a beat of slow motion right after the strike. */
  timeFactor(): number {
    const s = this.shot;
    if (!s || s.rel < 0) return 1;
    if (s.rel < 0.22) return 0.3;
    return clamp(0.3 + ((s.rel - 0.22) / 0.25) * 0.7, 0.3, 1);
  }

  /** Camera zoom towards the shooter: 1 = none. */
  zoom(): number {
    const s = this.shot;
    if (!s) return 1;
    const inK = easeOutCubic(clamp(s.t / 0.4, 0, 1));
    const outK = s.rel < 0 ? 1 : 1 - easeOutCubic(clamp(s.rel / RELEASE, 0, 1));
    return 1 + 0.24 * inK * outK;
  }

  /** 0..1 how strong the darkening/overlays are */
  private strength(): number {
    const s = this.shot;
    if (!s) return 0;
    return clamp(s.t / 0.15, 0, 1) * (s.rel < 0 ? 1 : clamp((RELEASE - s.rel) / 0.35, 0, 1));
  }

  /** Darkness + spotlight + speed lines, in world coordinates around the shooter. */
  drawWorld(ctx: CanvasRenderingContext2D, fx: number, fy: number, time: number): void {
    const s = this.shot;
    if (!s) return;
    const fade = this.strength();
    const charging = s.rel < 0;
    ctx.save();
    // spotlight: everything outside dims
    const g = ctx.createRadialGradient(fx, fy, 60, fx, fy, 520);
    g.addColorStop(0, 'rgba(5,4,20,0)');
    g.addColorStop(0.35, `rgba(5,4,20,${0.35 * fade})`);
    g.addColorStop(1, `rgba(5,4,20,${0.78 * fade})`);
    ctx.fillStyle = g;
    ctx.fillRect(SCREEN.x - 100, SCREEN.y - 100, SCREEN.w + 200, SCREEN.h + 200);
    // radial speed lines in the hero's colour
    ctx.globalCompositeOperation = 'lighter';
    const n = 34;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.sin(i * 7.3) * 0.08;
      const phase = (time * 3 + i * 0.37) % 1;
      // charging: lines rush in towards the hero; after the strike they burst out
      const r0 = charging ? 370 - phase * 260 : 110 + phase * 260;
      const r1 = r0 + 120 + (i % 3) * 40;
      ctx.strokeStyle = i % 2 ? s.color : '#ffffff';
      ctx.globalAlpha = 0.5 * fade * (1 - phase);
      ctx.lineWidth = 2 + (i % 4);
      ctx.beginPath();
      ctx.moveTo(fx + Math.cos(a) * r0, fy + Math.sin(a) * r0);
      ctx.lineTo(fx + Math.cos(a) * r1, fy + Math.sin(a) * r1);
      ctx.stroke();
    }
    // expanding shockwave rings
    ctx.globalAlpha = 1;
    for (let k = 0; k < 3; k++) {
      if (charging) break;
      const rt = clamp((s.rel - k * 0.09) / 0.5, 0, 1);
      if (rt <= 0 || rt >= 1) continue;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = (1 - rt) * 0.9;
      ctx.lineWidth = 10 * (1 - rt) + 2;
      ctx.beginPath();
      ctx.arc(fx, fy, 30 + easeOutCubic(rt) * 300, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Flash at the strike + a cut-in strip with the hero's face during the wind-up. */
  drawScreen(ctx: CanvasRenderingContext2D, time: number): void {
    const s = this.shot;
    if (!s) return;
    // white flash when the ball is struck
    if (s.rel >= 0 && s.rel < 0.16) {
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - s.rel / 0.16)})`;
      ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    }
    const dir = s.side === 0 ? 1 : -1;
    // the strip slides in from the hero's side, holds during the wind-up, leaves at the strike
    let off: number;
    if (s.rel < 0) off = 1 - easeOutBack(clamp((s.t - 0.05) / 0.3, 0, 1));
    else off = -easeOutCubic(clamp(s.rel / 0.22, 0, 1));
    if (off <= -1) return;
    const shift = -dir * off * (W + 200);
    const cy = 168;
    const bandH = 112;
    ctx.save();
    ctx.translate(W / 2 + shift, cy);
    ctx.rotate(-0.05 * dir);
    const grad = ctx.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, '#120f2e');
    grad.addColorStop(0.5, s.color);
    grad.addColorStop(1, '#120f2e');
    ctx.fillStyle = INK;
    ctx.fillRect(-W, -bandH / 2 - 7, W * 2, bandH + 14);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.globalAlpha = 1;
    // moving stripes inside the strip
    ctx.save();
    ctx.beginPath();
    ctx.rect(-W, -bandH / 2, W * 2, bandH);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    for (let x = -W; x < W; x += 60) {
      const sx = x + ((time * 900 * dir) % 60);
      ctx.beginPath();
      ctx.moveTo(sx, -bandH / 2);
      ctx.lineTo(sx + 22, -bandH / 2);
      ctx.lineTo(sx - 34, bandH / 2);
      ctx.lineTo(sx - 56, bandH / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // the hero's face, shaking with effort
    ctx.save();
    ctx.translate(Math.sin(time * 60) * 2, 4 + Math.cos(time * 53) * 2);
    drawHead(ctx, s.portrait, 58, s.side === 0 ? 1 : -1, time);
    ctx.restore();
    ctx.restore();
  }
}
