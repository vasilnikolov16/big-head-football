import { GROUND_Y, INK } from '../core/constants';
import { clamp } from '../core/math';

const PANEL = '#1d2a5c';
const ACCENT = '#ff6b2c';

function pentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = rot + (i / 5) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function drawBallShadow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const h = Math.max(0, GROUND_Y - (y + r));
  const k = clamp(1 - h / 420, 0.2, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.4 * k})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 2, r * 1.05 * k + 3, 6 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number, skin = 'classic'): void {
  if (skin !== 'classic' && SKINS[skin]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    ctx.rotate(angle);
    SKINS[skin](ctx, r);
    ctx.restore();
    shade(ctx, r);
    ctx.restore();
    if (skin === 'planet') drawRing(ctx, x, y, r);
    return;
  }
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // rotating panels
  ctx.save();
  ctx.clip();
  ctx.rotate(angle);
  ctx.fillStyle = PANEL;
  pentagon(ctx, 0, 0, r * 0.36, 0);
  ctx.fill();
  ctx.strokeStyle = 'rgba(29,42,92,0.55)';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const ix = Math.cos(a) * r * 0.36;
    const iy = Math.sin(a) * r * 0.36;
    const ox = Math.cos(a) * r * 0.7;
    const oy = Math.sin(a) * r * 0.7;
    ctx.beginPath();
    ctx.moveTo(ix, iy);
    ctx.lineTo(ox, oy);
    ctx.stroke();
    const pa = a + Math.PI / 5;
    ctx.fillStyle = i % 2 === 0 ? PANEL : ACCENT;
    pentagon(ctx, Math.cos(pa) * r * 1.02, Math.sin(pa) * r * 1.02, r * 0.38, pa + Math.PI / 2);
    ctx.fill();
  }
  ctx.restore();

  // shading (fixed light direction, does not rotate)
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r * 1.02);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(10,10,50,0.42)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** soft light + outline shared by every skin */
function shade(ctx: CanvasRenderingContext2D, r: number): void {
  const g = ctx.createRadialGradient(-r * 0.4, -r * 0.45, r * 0.05, 0, 0, r * 1.02);
  g.addColorStop(0, 'rgba(255,255,255,0.7)');
  g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(10,10,50,0.42)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 1.75, r * 0.42, 0, Math.PI * 1.02, Math.PI * 1.98, true);
  ctx.stroke();
  ctx.strokeStyle = '#ffd38a';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

/** ball skins from the shop, drawn rotated and clipped to the ball */
const SKINS: Record<string, (ctx: CanvasRenderingContext2D, r: number) => void> = {
  gold: (ctx, r) => {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#fff3a8');
    g.addColorStop(0.5, '#ffcc33');
    g.addColorStop(1, '#b8860b');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(140,90,0,0.55)';
    pentagon(ctx, 0, 0, r * 0.36, 0);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const pa = (i / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
      pentagon(ctx, Math.cos(pa) * r * 1.02, Math.sin(pa) * r * 1.02, r * 0.38, pa + Math.PI / 2);
      ctx.fill();
    }
  },
  beach: (ctx, r) => {
    const cols = ['#ff4d4d', '#ffffff', '#ffd23f', '#ffffff', '#2f8cff', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r * 1.1, (i / 6) * Math.PI * 2, ((i + 1) / 6) * Math.PI * 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  },
  retro: (ctx, r) => {
    ctx.fillStyle = '#9c5a2b';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeStyle = '#5a3015';
    ctx.lineWidth = 2;
    for (const k of [-0.45, 0.45]) {
      ctx.beginPath();
      ctx.ellipse(r * k * 1.6, 0, r * 0.9, r * 1.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    // laces
    ctx.strokeStyle = '#f4e3c3';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-r * 0.18, i * r * 0.16);
      ctx.lineTo(r * 0.18, i * r * 0.16);
      ctx.stroke();
    }
  },
  basket: (ctx, r) => {
    ctx.fillStyle = '#f27d1d';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.strokeStyle = '#2b1606';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.moveTo(0, -r);
    ctx.lineTo(0, r);
    ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * r * 1.15, 0, r * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
  melon: (ctx, r) => {
    ctx.fillStyle = '#3fae45';
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = '#1f6b27';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      for (let y = -r; y <= r; y += 3) ctx.lineTo(i * r * 0.32 + Math.sin(y * 0.35) * r * 0.06, y);
      for (let y = r; y >= -r; y -= 3) ctx.lineTo(i * r * 0.32 + r * 0.12 + Math.sin(y * 0.35) * r * 0.06, y);
      ctx.closePath();
      ctx.fill();
    }
  },
  planet: (ctx, r) => {
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#c77dff');
    g.addColorStop(0.5, '#7b2cbf');
    g.addColorStop(1, '#3c096c');
    ctx.fillStyle = g;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (const [y, h] of [
      [-0.5, 0.15],
      [0.1, 0.1],
      [0.5, 0.18],
    ]) ctx.fillRect(-r, y * r, r * 2, h * r);
  },
  disco: (ctx, r) => {
    const n = 7;
    const s = (r * 2) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = 150 + ((i * 37 + j * 91) % 90);
        ctx.fillStyle = `rgb(${v},${v + 10},${v + 30})`;
        ctx.fillRect(-r + i * s, -r + j * s, s - 1, s - 1);
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y] of [
      [-0.3, -0.4],
      [0.4, 0.1],
      [-0.1, 0.5],
    ]) {
      ctx.fillRect(x * r - 1, y * r - 4, 2, 8);
      ctx.fillRect(x * r - 4, y * r - 1, 8, 2);
    }
  },
};
