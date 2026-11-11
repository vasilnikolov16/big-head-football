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

export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, angle: number): void {
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
