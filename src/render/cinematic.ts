import { FONT_DISPLAY, H, INK, W, SCREEN } from '../core/constants';
import { clamp, easeOutBack, easeOutCubic } from '../core/math';
import type { CharacterDef } from '../game/characters';
import { Player } from '../game/player';
import { SUPER_INFO } from '../game/supers';
import { t as tx, tr } from '../i18n/i18n';
import { drawHead } from './playerDraw';

/** Total length of the super-shot "moment" in real seconds. */
const DUR = 1.25;
/** Real seconds the game runs in slow motion at the start. */
const SLOW = 0.8;

interface Shot {
  t: number;
  side: 0 | 1;
  color: string;
  name: string;
  portrait: Player;
}

/**
 * Fighting-game style super shot moment: the game slows down, the camera
 * zooms on the hero, the stadium goes dark around a spotlight, speed lines
 * burst out and a cut-in banner with the hero's face and the shot's name
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
    this.shot = { t: 0, side, color: info.color, name: tr(info.name).toUpperCase(), portrait };
  }

  /** index of the shooting player */
  get side(): number {
    return this.shot?.side ?? 0;
  }

  get active(): boolean {
    return this.shot !== null;
  }

  update(dt: number): void {
    if (!this.shot) return;
    this.shot.t += dt;
    if (this.shot.t >= DUR) this.shot = null;
  }

  /** Multiplier for the simulation speed (slow motion at the start). */
  timeFactor(): number {
    if (!this.shot) return 1;
    const t = this.shot.t;
    if (t < SLOW) return 0.18;
    return clamp(0.18 + ((t - SLOW) / 0.25) * 0.82, 0.18, 1);
  }

  /** Camera zoom towards the shooter: 1 = none. */
  zoom(): number {
    if (!this.shot) return 1;
    const k = clamp(this.shot.t / (DUR * 0.85), 0, 1);
    return 1 + 0.2 * Math.sin(Math.PI * k);
  }

  /** Darkness + spotlight + speed lines, in world coordinates around the shooter. */
  drawWorld(ctx: CanvasRenderingContext2D, fx: number, fy: number, time: number): void {
    const s = this.shot;
    if (!s) return;
    const t = s.t;
    const fade = clamp(t / 0.12, 0, 1) * clamp((DUR - t) / 0.3, 0, 1);
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
      const r0 = 110 + phase * 260;
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
    for (let k = 0; k < 2; k++) {
      const rt = clamp((t - k * 0.12) / 0.6, 0, 1);
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

  /** Flash + cut-in banner, in screen coordinates. */
  drawScreen(ctx: CanvasRenderingContext2D, time: number): void {
    const s = this.shot;
    if (!s) return;
    const t = s.t;
    // white flash
    if (t < 0.14) {
      ctx.fillStyle = `rgba(255,255,255,${0.75 * (1 - t / 0.14)})`;
      ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    }
    const dir = s.side === 0 ? 1 : -1;
    // banner slides in from the shooter's side, holds, slides out the other way
    let off: number;
    if (t < 0.32) off = 1 - easeOutBack(clamp((t - 0.04) / 0.28, 0, 1));
    else if (t < 0.92) off = 0;
    else off = -easeOutCubic(clamp((t - 0.92) / 0.28, 0, 1));
    const shift = -dir * off * (W + 200);
    const cy = H * 0.5;
    const bandH = 170;
    ctx.save();
    ctx.translate(W / 2 + shift, cy);
    ctx.rotate(-0.08 * dir);
    // band
    const grad = ctx.createLinearGradient(-W, 0, W, 0);
    grad.addColorStop(0, '#120f2e');
    grad.addColorStop(0.5, s.color);
    grad.addColorStop(1, '#120f2e');
    ctx.fillStyle = INK;
    ctx.fillRect(-W, -bandH / 2 - 8, W * 2, bandH + 16);
    ctx.fillStyle = grad;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(-W, -bandH / 2, W * 2, bandH);
    ctx.globalAlpha = 1;
    // moving stripes inside the band
    ctx.save();
    ctx.beginPath();
    ctx.rect(-W, -bandH / 2, W * 2, bandH);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = -W; x < W; x += 70) {
      const sx = x + ((time * 900 * dir) % 70);
      ctx.beginPath();
      ctx.moveTo(sx, -bandH / 2);
      ctx.lineTo(sx + 26, -bandH / 2);
      ctx.lineTo(sx - 40, bandH / 2);
      ctx.lineTo(sx - 66, bandH / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // hero face
    ctx.save();
    const px = -dir * 330;
    ctx.translate(px, 6);
    ctx.scale(1 + Math.sin(time * 30) * 0.01, 1);
    drawHead(ctx, s.portrait, 82, s.side === 0 ? 1 : -1, time);
    ctx.restore();
    // texts
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.font = `22px ${FONT_DISPLAY}`;
    ctx.lineWidth = 7;
    ctx.strokeStyle = INK;
    ctx.fillStyle = '#ffffff';
    const tx0 = dir * 110;
    ctx.strokeText(tx('sel.super'), tx0, -46);
    ctx.fillText(tx('sel.super'), tx0, -46);
    const size = s.name.length > 12 ? 64 : 80;
    ctx.font = `${size}px ${FONT_DISPLAY}`;
    ctx.lineWidth = 14;
    ctx.strokeText(s.name, tx0, 18);
    const tg = ctx.createLinearGradient(0, -20, 0, 50);
    tg.addColorStop(0, '#ffffff');
    tg.addColorStop(0.55, '#fff3a0');
    tg.addColorStop(1, '#ffd23f');
    ctx.fillStyle = tg;
    ctx.fillText(s.name, tx0, 18);
    ctx.restore();
  }
}
