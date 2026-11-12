import { INK } from '../core/constants';
import type { Expression } from '../game/characters';

/**
 * Per-hero drawing hooks. Head hooks get the origin at the head centre and are
 * already mirrored so +x is the direction the hero faces. Body hooks get the
 * origin at the feet (also mirrored).
 */
export interface HeadDraw {
  ctx: CanvasRenderingContext2D;
  R: number;
  t: number;
  expr: Expression;
}

export interface BodyDraw {
  ctx: CanvasRenderingContext2D;
  t: number;
}

export interface HeroArt {
  /** behind the head circle */
  back?: (h: HeadDraw) => void;
  /** on the head, clipped to the head circle, under the face */
  skin?: (h: HeadDraw) => void;
  /** over the face */
  front?: (h: HeadDraw) => void;
  /** behind the torso */
  bodyBack?: (b: BodyDraw) => void;
  /** on the torso */
  bodyFront?: (b: BodyDraw) => void;
}

const outline = (ctx: CanvasRenderingContext2D, w = 4): void => {
  ctx.lineWidth = w;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
};

// ------------------------------------------------------------------ Бобо (barber)

const bobo: HeroArt = {
  back: ({ ctx, R }) => {
    // scissors stuck in the hair
    ctx.save();
    ctx.translate(-R * 0.62, -R * 0.88);
    ctx.rotate(-0.7);
    ctx.fillStyle = '#dfe6ef';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(s * R * 0.08, -R * 0.62);
      ctx.lineTo(s * R * 0.16, 0);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 2.5);
    }
    ctx.fillStyle = '#e63946';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * R * 0.13, R * 0.14, R * 0.11, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 2.5);
    }
    ctx.restore();
  },
  skin: ({ ctx, R }) => {
    // full beard
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.moveTo(-R * 0.75, -R * 0.25);
    ctx.lineTo(-R * 0.45, -R * 0.25);
    ctx.quadraticCurveTo(-R * 0.35, R * 0.35, R * 0.1, R * 0.3);
    ctx.quadraticCurveTo(R * 0.6, R * 0.2, R * 1.05, R * 0.15);
    ctx.lineTo(R * 1.1, R * 1.1);
    ctx.lineTo(-R * 1.1, R * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.ellipse(R * 0.2, R * 0.75, R * 0.35, R * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  front: ({ ctx, R }) => {
    // pompadour
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.moveTo(-R * 0.98, -R * 0.05);
    ctx.quadraticCurveTo(-R * 1.05, -R * 0.95, -R * 0.2, -R * 1.12);
    ctx.quadraticCurveTo(R * 0.55, -R * 1.35, R * 1.0, -R * 0.95);
    ctx.quadraticCurveTo(R * 1.1, -R * 0.6, R * 0.7, -R * 0.62);
    ctx.quadraticCurveTo(R * 0.1, -R * 0.75, -R * 0.45, -R * 0.42);
    ctx.lineTo(-R * 0.6, -R * 0.1);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-R * 0.3, -R * 1.0);
    ctx.quadraticCurveTo(R * 0.3, -R * 1.18, R * 0.75, -R * 0.95);
    ctx.stroke();
    // handlebar moustache
    ctx.fillStyle = '#2b1d14';
    ctx.beginPath();
    ctx.moveTo(R * 0.38, R * 0.3);
    ctx.quadraticCurveTo(R * 0.05, R * 0.18, R * 0.0, R * 0.42);
    ctx.quadraticCurveTo(R * 0.12, R * 0.3, R * 0.38, R * 0.4);
    ctx.quadraticCurveTo(R * 0.66, R * 0.3, R * 0.78, R * 0.42);
    ctx.quadraticCurveTo(R * 0.72, R * 0.18, R * 0.38, R * 0.3);
    ctx.fill();
  },
  bodyFront: ({ ctx }) => {
    // barber-pole stripes on the shirt
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-17, -60, 34, 30, 10);
    ctx.clip();
    for (let i = -2; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#e63946' : '#457bff';
      ctx.beginPath();
      ctx.moveTo(-20 + i * 12, -30);
      ctx.lineTo(-14 + i * 12, -30);
      ctx.lineTo(6 + i * 12, -60);
      ctx.lineTo(0 + i * 12, -60);
      ctx.closePath();
      ctx.globalAlpha = 0.55;
      ctx.fill();
    }
    ctx.restore();
  },
};

// ------------------------------------------------------------------ Пенка (cat)

const catEar = (ctx: CanvasRenderingContext2D, R: number, x: number, tipX: number, tipY: number, w: number): void => {
  ctx.fillStyle = '#9b6a43';
  ctx.beginPath();
  ctx.moveTo(x - w * R, -R * 0.55);
  ctx.lineTo(tipX * R, tipY * R);
  ctx.lineTo(x + w * R, -R * 0.75);
  ctx.closePath();
  ctx.fill();
  outline(ctx);
  ctx.fillStyle = '#ffb3c6';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5 * R, -R * 0.68);
  ctx.lineTo(tipX * R * 0.95 + x * 0.05, tipY * R * 0.88);
  ctx.lineTo(x + w * 0.5 * R, -R * 0.8);
  ctx.closePath();
  ctx.fill();
};

const penka: HeroArt = {
  back: ({ ctx, R }) => {
    catEar(ctx, R, -R * 0.5, -0.72, -1.38, 0.3);
    catEar(ctx, R, R * 0.32, 0.42, -1.42, 0.28);
  },
  skin: ({ ctx, R }) => {
    // tabby stripes
    ctx.strokeStyle = '#5a3820';
    ctx.lineCap = 'round';
    ctx.lineWidth = R * 0.1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.2 + i * R * 0.22, -R * 1.0);
      ctx.quadraticCurveTo(-R * 0.15 + i * R * 0.24, -R * 0.75, -R * 0.1 + i * R * 0.22, -R * 0.55);
      ctx.stroke();
    }
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-R * 1.0, -R * 0.2 + i * R * 0.3);
      ctx.quadraticCurveTo(-R * 0.75, -R * 0.15 + i * R * 0.3, -R * 0.55, -R * 0.05 + i * R * 0.3);
      ctx.stroke();
    }
    // white blaze down the nose + white muzzle
    ctx.fillStyle = '#fffaf2';
    ctx.beginPath();
    ctx.moveTo(R * 0.28, -R * 1.0);
    ctx.quadraticCurveTo(R * 0.42, -R * 0.4, R * 0.62, R * 0.05);
    ctx.lineTo(R * 0.9, R * 0.08);
    ctx.quadraticCurveTo(R * 0.62, -R * 0.4, R * 0.42, -R * 1.0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(R * 0.62, R * 0.38, R * 0.45, R * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
  },
  front: ({ ctx, R }) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.6;
    for (const a of [-0.18, 0.02, 0.22]) {
      ctx.beginPath();
      ctx.moveTo(R * 0.82, R * 0.3);
      ctx.lineTo(R * 1.32, R * (0.3 + a));
      ctx.stroke();
    }
  },
  bodyBack: ({ ctx, t }) => {
    // striped tail
    const sway = Math.sin(t * 2.2) * 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 11;
    ctx.beginPath();
    ctx.moveTo(-12, -30);
    ctx.quadraticCurveTo(-40, -36, -38 + sway, -70);
    ctx.stroke();
    ctx.strokeStyle = '#8d939e';
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.strokeStyle = '#5d636e';
    ctx.setLineDash([5, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
  },
  bodyFront: ({ ctx }) => {
    // white collar with a little bell
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, -58, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 2.5);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(6, -52, 4, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 2);
  },
};

// ------------------------------------------------------------------ Бип-0 (robot)

const bip: HeroArt = {
  back: ({ ctx, R, t }) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 0.95);
    ctx.lineTo(-R * 0.22, -R * 1.42);
    ctx.stroke();
    ctx.strokeStyle = '#9aa8bd';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    const on = Math.sin(t * 6) > 0;
    ctx.fillStyle = on ? '#ff4d6d' : '#4fd1ff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(-R * 0.22, -R * 1.46, R * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    outline(ctx, 2.5);
    // ear bolt
    ctx.fillStyle = '#7d8ba3';
    ctx.beginPath();
    ctx.arc(-R * 0.92, R * 0.05, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 3);
  },
  skin: ({ ctx, R }) => {
    ctx.strokeStyle = 'rgba(30,40,70,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R, -R * 0.5);
    ctx.lineTo(R, -R * 0.5);
    ctx.moveTo(-R * 0.35, -R * 0.5);
    ctx.lineTo(-R * 0.35, R);
    ctx.stroke();
    ctx.fillStyle = 'rgba(30,40,70,0.4)';
    for (const [x, y] of [
      [-0.75, -0.62],
      [-0.5, -0.62],
      [-0.25, -0.62],
      [-0.55, 0.55],
      [-0.55, 0.25],
    ]) {
      ctx.beginPath();
      ctx.arc(R * x, R * y, R * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(-R * 0.75, -R * 0.95, R * 0.12, R * 0.3);
  },
  bodyFront: ({ ctx, t }) => {
    ctx.fillStyle = '#1a202c';
    ctx.beginPath();
    ctx.roundRect(-7, -54, 14, 12, 3);
    ctx.fill();
    ctx.fillStyle = `rgba(79,209,255,${0.6 + Math.sin(t * 4) * 0.3})`;
    ctx.fillRect(-4, -51, 8, 6);
  },
};

// ------------------------------------------------------------------ Роко (rocker)

const roko: HeroArt = {
  back: ({ ctx, R, t }) => {
    const sway = Math.sin(t * 2.4) * R * 0.05;
    ctx.fillStyle = '#16161d';
    ctx.beginPath();
    ctx.moveTo(-R * 0.1, -R * 1.02);
    ctx.quadraticCurveTo(-R * 1.25, -R * 0.9, -R * 1.2 + sway, R * 0.3);
    ctx.quadraticCurveTo(-R * 1.25 + sway, R * 1.0, -R * 0.95 + sway, R * 1.25);
    ctx.lineTo(-R * 0.75 + sway, R * 1.02);
    ctx.lineTo(-R * 0.55, R * 1.2);
    ctx.quadraticCurveTo(-R * 0.4, R * 0.6, -R * 0.2, R * 0.2);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
  },
  front: ({ ctx, R }) => {
    // hair on top
    ctx.fillStyle = '#16161d';
    ctx.beginPath();
    ctx.moveTo(-R * 0.98, -R * 0.1);
    ctx.quadraticCurveTo(-R * 0.95, -R * 1.05, R * 0.15, -R * 1.05);
    ctx.quadraticCurveTo(R * 0.85, -R * 0.95, R * 0.95, -R * 0.42);
    ctx.quadraticCurveTo(R * 0.55, -R * 0.62, R * 0.2, -R * 0.5);
    ctx.quadraticCurveTo(-R * 0.3, -R * 0.55, -R * 0.55, -R * 0.1);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    // bandana
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = R * 0.16;
    ctx.beginPath();
    ctx.arc(0, R * 0.25, R * 0.93, Math.PI * 1.13, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.2 + i * 0.18);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.93, R * 0.25 + Math.sin(a) * R * 0.93, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // goatee
    ctx.fillStyle = '#16161d';
    ctx.beginPath();
    ctx.moveTo(R * 0.25, R * 0.72);
    ctx.quadraticCurveTo(R * 0.4, R * 1.12, R * 0.55, R * 0.72);
    ctx.closePath();
    ctx.fill();
  },
  bodyBack: ({ ctx }) => {
    // electric guitar slung on the back
    ctx.save();
    ctx.translate(-14, -36);
    ctx.rotate(-0.65);
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(-3, -64, 6, 58);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-3, -64, 6, 58);
    ctx.fillStyle = '#d62828';
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(-16, 18);
    ctx.lineTo(-4, 12);
    ctx.lineTo(0, 22);
    ctx.lineTo(4, 12);
    ctx.lineTo(16, 18);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = '#1f1f2b';
    ctx.fillRect(-5, -72, 10, 10);
    ctx.restore();
  },
  bodyFront: ({ ctx }) => {
    ctx.fillStyle = '#c0c6d6';
    for (const [x, y] of [
      [-10, -55],
      [10, -55],
      [-12, -38],
      [12, -38],
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

// ------------------------------------------------------------------ Баба Гица (granny)

const gica: HeroArt = {
  back: ({ ctx, R }) => {
    // bun
    ctx.fillStyle = '#e4e4ea';
    ctx.beginPath();
    ctx.arc(-R * 0.35, -R * 1.08, R * 0.34, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = '#c8c8d2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-R * 0.35, -R * 1.08, R * 0.18, 0.5, 4.5);
    ctx.stroke();
    // knitting needle through the bun
    ctx.strokeStyle = '#ff8fc7';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-R * 0.85, -R * 1.25);
    ctx.lineTo(R * 0.1, -R * 0.85);
    ctx.stroke();
  },
  front: ({ ctx, R }) => {
    // curly grey hair
    ctx.fillStyle = '#e4e4ea';
    const curls = 7;
    for (let i = 0; i < curls; i++) {
      const a = Math.PI * (0.98 + (i / (curls - 1)) * 0.72);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * 0.24, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 3);
    }
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.9, Math.PI * 1.0, Math.PI * 1.7);
    ctx.lineTo(0, -R * 0.55);
    ctx.closePath();
    ctx.fill();
    // big round glasses over the eyes
    const ey = -R * 0.06;
    ctx.lineWidth = 3.5;
    for (const x of [R * 0.12, R * 0.54]) {
      ctx.fillStyle = 'rgba(200,230,255,0.18)';
      ctx.beginPath();
      ctx.arc(x, ey, R * 0.27, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8c2f39';
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, ey, R * 0.19, Math.PI * 1.1, Math.PI * 1.45);
      ctx.stroke();
      ctx.lineWidth = 3.5;
    }
    ctx.strokeStyle = '#8c2f39';
    ctx.beginPath();
    ctx.moveTo(R * 0.39, ey);
    ctx.lineTo(R * 0.27, ey);
    ctx.moveTo(-R * 0.15, ey);
    ctx.lineTo(-R * 0.7, ey + R * 0.05);
    ctx.stroke();
    // pearl earring
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-R * 0.86, R * 0.38, R * 0.07, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 1.5);
  },
  bodyFront: ({ ctx }) => {
    ctx.fillStyle = '#ffd6e8';
    for (const y of [-52, -44, -36]) {
      ctx.beginPath();
      ctx.arc(4, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#ffd6e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(0, -31);
    ctx.stroke();
  },
};

// ------------------------------------------------------------------ Зиг (alien)

const zig: HeroArt = {
  back: ({ ctx, R, t }) => {
    for (const [x0, x1, ph] of [
      [-0.2, -0.5, 0],
      [0.3, 0.55, 1.6],
    ]) {
      const bob = Math.sin(t * 3 + ph) * R * 0.05;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(R * x0, -R * 0.9);
      ctx.quadraticCurveTo(R * (x0 + x1) * 0.5, -R * 1.3, R * x1, -R * 1.5 + bob);
      ctx.stroke();
      ctx.strokeStyle = '#7ddc5a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#c77dff';
      ctx.shadowColor = '#c77dff';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(R * x1, -R * 1.5 + bob, R * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      outline(ctx, 2.5);
    }
  },
  skin: ({ ctx, R }) => {
    ctx.fillStyle = 'rgba(40,110,40,0.35)';
    for (const [x, y, r] of [
      [-0.6, -0.5, 0.12],
      [-0.75, 0.1, 0.09],
      [-0.4, -0.75, 0.07],
      [-0.55, 0.5, 0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(R * x, R * y, R * r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  bodyFront: ({ ctx }) => {
    ctx.fillStyle = '#c77dff';
    ctx.beginPath();
    ctx.arc(0, -47, 6, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 2);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-1.5, -48.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ------------------------------------------------------------------ Улф (viking)

const BEARD = '#e0782e';

const ulf: HeroArt = {
  skin: ({ ctx, R }) => {
    ctx.fillStyle = BEARD;
    ctx.beginPath();
    ctx.moveTo(-R * 0.7, -R * 0.2);
    ctx.lineTo(-R * 0.45, -R * 0.2);
    ctx.quadraticCurveTo(-R * 0.3, R * 0.3, R * 0.15, R * 0.28);
    ctx.quadraticCurveTo(R * 0.65, R * 0.22, R * 1.05, R * 0.15);
    ctx.lineTo(R * 1.1, R * 1.1);
    ctx.lineTo(-R * 1.1, R * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,50,10,0.45)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-R * 0.2 + i * R * 0.22, R * 0.55);
      ctx.lineTo(-R * 0.25 + i * R * 0.22, R * 0.9);
      ctx.stroke();
    }
  },
  front: ({ ctx, R }) => {
    // braids hanging below the chin
    for (const x of [0.15, 0.55]) {
      ctx.fillStyle = BEARD;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(R * x, R * (0.98 + i * 0.16), R * 0.09, R * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
        outline(ctx, 2.5);
      }
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(R * x - R * 0.08, R * 1.38, R * 0.16, R * 0.07);
    }
    // moustache
    ctx.fillStyle = BEARD;
    ctx.beginPath();
    ctx.ellipse(R * 0.22, R * 0.34, R * 0.24, R * 0.09, 0.3, 0, Math.PI * 2);
    ctx.ellipse(R * 0.6, R * 0.34, R * 0.24, R * 0.09, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // horns
    for (const [x0, y0, cx, cy, x1, y1] of [
      [-0.8, -0.55, -1.35, -0.7, -1.3, -1.35],
      [0.7, -0.62, 1.25, -0.8, 1.1, -1.42],
    ]) {
      ctx.fillStyle = '#f4ead5';
      ctx.beginPath();
      ctx.moveTo(R * x0, R * (y0 - 0.12));
      ctx.quadraticCurveTo(R * cx, R * cy, R * x1, R * y1);
      ctx.quadraticCurveTo(R * (cx * 0.8), R * (cy + 0.25), R * x0, R * (y0 + 0.12));
      ctx.closePath();
      ctx.fill();
      outline(ctx, 3);
    }
    // helmet
    const g = ctx.createLinearGradient(0, -R, 0, -R * 0.3);
    g.addColorStop(0, '#d8dee9');
    g.addColorStop(1, '#8f9bb3');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -R * 0.22, R * 0.98, Math.PI * 1.04, Math.PI * 1.96);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#c9a227';
    ctx.beginPath();
    ctx.roundRect(-R * 0.97, -R * 0.36, R * 1.94, R * 0.16, 4);
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = INK;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * R * 0.26, -R * 0.28, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  bodyFront: ({ ctx }) => {
    // fur collar
    ctx.fillStyle = '#d9c6a5';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.arc(i * 7, -58, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(-15, -36, 30, 4);
  },
};

// ------------------------------------------------------------------ Сенко (ninja)

const senko: HeroArt = {
  back: ({ ctx, R, t }) => {
    // headband tails fluttering behind
    ctx.fillStyle = '#e63946';
    for (const k of [0, 1]) {
      const w = Math.sin(t * 9 + k) * R * 0.12;
      ctx.beginPath();
      ctx.moveTo(-R * 0.85, -R * 0.45);
      ctx.quadraticCurveTo(-R * 1.25, -R * (0.5 - k * 0.15) + w, -R * (1.7 - k * 0.15), -R * (0.3 - k * 0.3) + w * 1.5);
      ctx.lineTo(-R * (1.65 - k * 0.15), -R * (0.15 - k * 0.3) + w * 1.5);
      ctx.quadraticCurveTo(-R * 1.2, -R * (0.35 - k * 0.15) + w, -R * 0.85, -R * 0.3);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 2.5);
    }
  },
  skin: ({ ctx, R }) => {
    ctx.fillStyle = '#22223b';
    ctx.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
    // eye slit shows skin
    ctx.fillStyle = '#e9b993';
    ctx.beginPath();
    ctx.roundRect(-R * 0.2, -R * 0.46, R * 1.4, R * 0.6, R * 0.22);
    ctx.fill();
    // mask folds
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R * 0.2, R * 0.45);
    ctx.quadraticCurveTo(R * 0.6, R * 0.55, R * 0.95, R * 0.4);
    ctx.stroke();
  },
  front: ({ ctx, R }) => {
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = R * 0.17;
    ctx.beginPath();
    ctx.arc(0, R * 0.2, R * 0.9, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.fillStyle = '#c0c6d6';
    ctx.beginPath();
    ctx.roundRect(R * 0.2, -R * 0.78, R * 0.42, R * 0.22, 3);
    ctx.fill();
    outline(ctx, 2.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(R * 0.41, -R * 0.67, R * 0.06, 0, Math.PI * 1.5);
    ctx.stroke();
  },
};

// ------------------------------------------------------------------ Пипер (chef)

const chef: HeroArt = {
  front: ({ ctx, R }) => {
    // curled moustache
    ctx.fillStyle = '#4a2c17';
    for (const [x, rot] of [
      [0.24, 0.35],
      [0.66, -0.35],
    ]) {
      ctx.beginPath();
      ctx.ellipse(R * x, R * 0.33, R * 0.2, R * 0.08, rot, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4a2c17';
    ctx.lineWidth = R * 0.07;
    ctx.beginPath();
    ctx.arc(R * 0.02, R * 0.22, R * 0.09, Math.PI * 0.2, Math.PI * 1.3);
    ctx.arc(R * 0.9, R * 0.22, R * 0.09, Math.PI * 1.7, Math.PI * 0.8, true);
    ctx.stroke();
    // tall chef's hat
    ctx.fillStyle = '#ffffff';
    for (const [x, y, r] of [
      [-0.45, -1.3, 0.42],
      [0.42, -1.3, 0.42],
      [0, -1.52, 0.48],
    ]) {
      ctx.beginPath();
      ctx.arc(R * x, R * y, R * r, 0, Math.PI * 2);
      ctx.fill();
      outline(ctx, 3);
    }
    ctx.beginPath();
    ctx.roundRect(-R * 0.82, -R * 1.25, R * 1.64, R * 0.42, R * 0.08);
    ctx.fill();
    outline(ctx, 3);
    ctx.strokeStyle = 'rgba(22,18,43,0.25)';
    ctx.lineWidth = 2;
    for (const x of [-0.4, 0, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(R * x, -R * 1.2);
      ctx.lineTo(R * x, -R * 0.9);
      ctx.stroke();
    }
  },
  bodyFront: ({ ctx }) => {
    // red neckerchief
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(-9, -60);
    ctx.lineTo(9, -60);
    ctx.lineTo(0, -48);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  },
};

// ------------------------------------------------------------------ Влад (vampire)

const vlad: HeroArt = {
  back: ({ ctx, R }) => {
    // high cape collar
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#1b1b2f';
      ctx.beginPath();
      ctx.moveTo(s * R * 0.45, R * 0.75);
      ctx.lineTo(s * R * 1.35, -R * 0.25);
      ctx.lineTo(s * R * 1.0, R * 0.95);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 3);
      ctx.fillStyle = '#c1121f';
      ctx.beginPath();
      ctx.moveTo(s * R * 0.6, R * 0.75);
      ctx.lineTo(s * R * 1.2, -R * 0.05);
      ctx.lineTo(s * R * 0.95, R * 0.85);
      ctx.closePath();
      ctx.fill();
    }
  },
  skin: ({ ctx, R }) => {
    // slicked-back hair with a widow's peak
    ctx.fillStyle = '#14121f';
    ctx.beginPath();
    ctx.moveTo(-R * 1.2, -R * 1.2);
    ctx.lineTo(R * 1.2, -R * 1.2);
    ctx.lineTo(R * 1.2, -R * 0.55);
    ctx.lineTo(R * 0.78, -R * 0.62);
    ctx.lineTo(R * 0.42, -R * 0.3);
    ctx.lineTo(R * 0.12, -R * 0.62);
    ctx.lineTo(-R * 0.55, -R * 0.52);
    ctx.lineTo(-R * 1.2, -R * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-R * 0.6, -R * 0.85);
    ctx.quadraticCurveTo(0, -R * 1.0, R * 0.6, -R * 0.82);
    ctx.stroke();
  },
  front: ({ ctx, R }) => {
    // fangs
    ctx.fillStyle = '#ffffff';
    for (const x of [0.4, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(R * (x - 0.06), R * 0.4);
      ctx.lineTo(R * (x + 0.06), R * 0.4);
      ctx.lineTo(R * x, R * 0.56);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 1.5);
    }
  },
};

// ------------------------------------------------------------------ Огнян (firefighter)

const ogi: HeroArt = {
  skin: ({ ctx, R }) => {
    // soot on the cheek
    ctx.fillStyle = 'rgba(40,40,50,0.28)';
    ctx.beginPath();
    ctx.ellipse(R * 0.1, R * 0.38, R * 0.2, R * 0.1, -0.3, 0, Math.PI * 2);
    ctx.fill();
  },
  front: ({ ctx, R }) => {
    // long back brim
    ctx.fillStyle = '#b71c1c';
    ctx.beginPath();
    ctx.ellipse(-R * 0.55, -R * 0.3, R * 0.8, R * 0.14, 0.12, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 3);
    // helmet dome
    const g = ctx.createLinearGradient(0, -R * 1.2, 0, -R * 0.3);
    g.addColorStop(0, '#ff5a5a');
    g.addColorStop(1, '#c62828');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -R * 0.25, R * 0.98, Math.PI * 1.03, Math.PI * 1.97);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    // ridge
    ctx.strokeStyle = '#8e1414';
    ctx.lineWidth = R * 0.1;
    ctx.beginPath();
    ctx.arc(0, -R * 0.25, R * 0.62, Math.PI * 1.25, Math.PI * 1.75);
    ctx.stroke();
    // badge
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.roundRect(R * 0.25, -R * 1.02, R * 0.42, R * 0.5, R * 0.1);
    ctx.fill();
    outline(ctx, 2.5);
    ctx.fillStyle = '#c62828';
    ctx.font = `bold ${Math.round(R * 0.3)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', R * 0.46, -R * 0.76);
  },
  bodyFront: ({ ctx }) => {
    // reflective stripes
    ctx.fillStyle = '#ffd60a';
    ctx.fillRect(-15, -44, 30, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(-15, -43, 30, 1.5);
  },
};

// ------------------------------------------------------------------ Снежко (snowman)

const sneg: HeroArt = {
  skin: ({ ctx, R }) => {
    // a few snow sparkles
    ctx.fillStyle = 'rgba(160,190,230,0.35)';
    for (const [x, y] of [
      [-0.6, 0.3],
      [-0.3, 0.6],
      [-0.75, -0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(R * x, R * y, R * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  front: ({ ctx, R }) => {
    // carrot nose
    ctx.fillStyle = '#ff8c1a';
    ctx.beginPath();
    ctx.moveTo(R * 0.58, R * 0.02);
    ctx.lineTo(R * 1.38, R * 0.16);
    ctx.lineTo(R * 0.6, R * 0.26);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 2.5);
    ctx.strokeStyle = 'rgba(150,70,0,0.5)';
    ctx.lineWidth = 1.5;
    for (const x of [0.8, 1.0]) {
      ctx.beginPath();
      ctx.moveTo(R * x, R * 0.08);
      ctx.lineTo(R * (x + 0.03), R * 0.2);
      ctx.stroke();
    }
    // knitted beanie with a pompom
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(0, -R * 0.35, R * 0.92, Math.PI * 1.06, Math.PI * 1.94);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-R * 0.95, -R * 0.52, R * 1.9, R * 0.24, R * 0.1);
    ctx.fill();
    outline(ctx, 3);
    ctx.beginPath();
    ctx.arc(-R * 0.1, -R * 1.32, R * 0.2, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 3);
  },
  bodyFront: ({ ctx, t }) => {
    // coal buttons and a scarf
    ctx.fillStyle = '#1d1d2e';
    for (const y of [-48, -40]) {
      ctx.beginPath();
      ctx.arc(4, y, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-15, -61, 30, 6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(-15, -61, 30, 6);
    const w = Math.sin(t * 6) * 2;
    ctx.beginPath();
    ctx.moveTo(-12, -57);
    ctx.lineTo(-19 + w, -42);
    ctx.lineTo(-13 + w, -41);
    ctx.lineTo(-7, -56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  },
};

// ------------------------------------------------------------------ Капитан Рум (pirate)

const rum: HeroArt = {
  skin: ({ ctx, R }) => {
    // black beard
    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.moveTo(-R * 0.8, R * 0.2);
    ctx.lineTo(-R * 0.55, R * 0.22);
    ctx.quadraticCurveTo(-R * 0.3, R * 0.62, R * 0.2, R * 0.58);
    ctx.quadraticCurveTo(R * 0.7, R * 0.55, R * 1.05, R * 0.42);
    ctx.lineTo(R * 1.1, R * 1.1);
    ctx.lineTo(-R * 1.1, R * 1.1);
    ctx.closePath();
    ctx.fill();
  },
  front: ({ ctx, R }) => {
    // eye patch
    ctx.strokeStyle = '#1f1a17';
    ctx.lineWidth = R * 0.06;
    ctx.beginPath();
    ctx.moveTo(-R * 0.9, -R * 0.5);
    ctx.lineTo(R * 0.98, R * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.ellipse(R * 0.54, -R * 0.06, R * 0.2, R * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    // gold earring
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-R * 0.55, R * 0.3, R * 0.09, 0, Math.PI * 2);
    ctx.stroke();
    // tricorn hat with a skull
    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.moveTo(-R * 1.3, -R * 0.5);
    ctx.quadraticCurveTo(0, -R * 0.82, R * 1.3, -R * 0.5);
    ctx.lineTo(R * 0.85, -R * 0.98);
    ctx.quadraticCurveTo(0, -R * 1.62, -R * 0.85, -R * 0.98);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-R * 1.22, -R * 0.55);
    ctx.quadraticCurveTo(0, -R * 0.86, R * 1.22, -R * 0.55);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -R * 1.08, R * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-R * 0.08, -R * 1.0, R * 0.16, R * 0.08);
    ctx.fillStyle = '#1f1a17';
    ctx.beginPath();
    ctx.arc(-R * 0.05, -R * 1.1, R * 0.035, 0, Math.PI * 2);
    ctx.arc(R * 0.05, -R * 1.1, R * 0.035, 0, Math.PI * 2);
    ctx.fill();
  },
};

// ------------------------------------------------------------------ Бойко (boxer)

const boyko: HeroArt = {
  skin: ({ ctx, R }) => {
    // buzz cut
    ctx.fillStyle = '#2b1d12';
    ctx.beginPath();
    ctx.arc(0, -R * 0.1, R * 1.05, Math.PI * 1.02, Math.PI * 1.98);
    ctx.closePath();
    ctx.fill();
  },
  front: ({ ctx, R }) => {
    // padded headguard
    ctx.strokeStyle = '#d00000';
    ctx.lineWidth = R * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, R * 0.02, R * 0.93, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, R * 0.02, R * 1.07, Math.PI * 1.06, Math.PI * 1.94);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, R * 0.02, R * 0.79, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
    ctx.fillStyle = '#ffd60a';
    ctx.font = `bold ${Math.round(R * 0.26)}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 0, -R * 0.92);
    // plaster on the nose
    ctx.fillStyle = '#f1d3b3';
    ctx.save();
    ctx.translate(R * 0.82, R * 0.08);
    ctx.rotate(0.6);
    ctx.fillRect(-R * 0.16, -R * 0.05, R * 0.32, R * 0.1);
    ctx.rotate(-1.2);
    ctx.fillRect(-R * 0.16, -R * 0.05, R * 0.32, R * 0.1);
    ctx.restore();
  },
};

// ------------------------------------------------------------------ Звездан (wizard)

const starPath = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
};

const zvezdan: HeroArt = {
  front: ({ ctx, R, t }) => {
    // long white beard
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.moveTo(-R * 0.35, R * 0.15);
    ctx.quadraticCurveTo(-R * 0.2, R * 1.1, R * 0.35, R * 1.55);
    ctx.quadraticCurveTo(R * 0.6, R * 1.0, R * 1.0, R * 0.2);
    ctx.quadraticCurveTo(R * 0.55, R * 0.42, R * 0.3, R * 0.3);
    ctx.quadraticCurveTo(0, R * 0.38, -R * 0.35, R * 0.15);
    ctx.closePath();
    ctx.fill();
    outline(ctx, 3);
    // pointy hat leaning back
    ctx.fillStyle = '#3a0ca3';
    ctx.beginPath();
    ctx.moveTo(-R * 0.95, -R * 0.42);
    ctx.lineTo(R * 0.95, -R * 0.42);
    ctx.quadraticCurveTo(R * 0.2, -R * 1.2, -R * 0.55, -R * 2.05);
    ctx.quadraticCurveTo(-R * 0.55, -R * 1.2, -R * 0.95, -R * 0.42);
    ctx.closePath();
    ctx.fill();
    outline(ctx);
    ctx.fillStyle = '#2a0880';
    ctx.beginPath();
    ctx.ellipse(0, -R * 0.42, R * 1.18, R * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 3);
    ctx.fillStyle = '#ffd60a';
    for (const [x, y, r] of [
      [-0.1, -0.85, 0.13],
      [-0.4, -1.35, 0.09],
      [0.25, -0.62, 0.07],
    ]) {
      starPath(ctx, R * x, R * y, R * r * (1 + Math.sin(t * 4 + x * 9) * 0.15));
      ctx.fill();
    }
  },
};

// ------------------------------------------------------------------ Рекс (dino)

const rex: HeroArt = {
  back: ({ ctx, R }) => {
    // plates along the back of the head
    ctx.fillStyle = '#f9a03f';
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * (1.12 + i * 0.13);
      const x = Math.cos(a) * R * 0.95;
      const y = Math.sin(a) * R * 0.95;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-R * 0.15, 0);
      ctx.lineTo(0, -R * 0.36);
      ctx.lineTo(R * 0.15, 0);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 2.5);
      ctx.restore();
    }
  },
  skin: ({ ctx, R }) => {
    // lighter snout and spots
    ctx.fillStyle = 'rgba(200,240,170,0.45)';
    ctx.beginPath();
    ctx.ellipse(R * 0.62, R * 0.32, R * 0.5, R * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,80,20,0.35)';
    for (const [x, y, r] of [
      [-0.5, -0.5, 0.12],
      [-0.2, -0.75, 0.08],
      [-0.7, 0.05, 0.1],
    ]) {
      ctx.beginPath();
      ctx.arc(R * x, R * y, R * r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  front: ({ ctx, R }) => {
    // nostrils and teeth
    ctx.fillStyle = '#1f3d14';
    for (const x of [0.88, 0.98]) {
      ctx.beginPath();
      ctx.ellipse(R * x, R * 0.12, R * 0.035, R * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const x = R * (0.3 + i * 0.16);
      ctx.beginPath();
      ctx.moveTo(x - R * 0.05, R * 0.38);
      ctx.lineTo(x + R * 0.05, R * 0.38);
      ctx.lineTo(x, R * 0.5);
      ctx.closePath();
      ctx.fill();
      outline(ctx, 1.2);
    }
  },
};

export const HERO_ART: Record<string, HeroArt> = { bobo, penka, bip, roko, gica, zig, ulf, senko, chef, vlad, ogi, sneg, rum, boyko, zvezdan, rex };
