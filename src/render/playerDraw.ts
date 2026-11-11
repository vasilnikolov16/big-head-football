import { GROUND_Y, INK } from '../core/constants';
import { clamp, lerp } from '../core/math';
import type { Expression, HeadDraw } from '../game/characters';
import type { Player } from '../game/player';

export function drawPlayerShadow(ctx: CanvasRenderingContext2D, p: Player, alpha: number): void {
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);
  const h = Math.max(0, GROUND_Y - y);
  const k = clamp(1 - h / 380, 0.25, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.38 * k})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 2, p.headR * 0.95 * k + 6, 8 * k, 0, 0, Math.PI * 2);
  ctx.fill();
}

function limb(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, w: number): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 4;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function shoe(ctx: CanvasRenderingContext2D, x: number, y: number, rot: number, f: number, upper: string, sole: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(f, 1);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.fillStyle = upper;
  ctx.beginPath();
  ctx.moveTo(-9, 4);
  ctx.lineTo(-9, -5);
  ctx.quadraticCurveTo(-2, -9, 6, -5);
  ctx.quadraticCurveTo(15, -3, 15, 3);
  ctx.lineTo(15, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = sole;
  ctx.fillRect(-9, 3, 24, 3.5);
  ctx.strokeRect(-9, 3, 24, 3.5);
  ctx.restore();
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, alpha: number, t: number): void {
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);
  const f = p.facing;
  const L = p.char.look;
  const s = p.squash;
  const running = p.grounded && Math.abs(p.vx) > 40;
  const swing = running ? Math.sin(p.runPhase) : 0;

  ctx.save();
  ctx.translate(x, y);
  // squash & stretch around the feet
  ctx.scale(1 + s * 0.45, 1 - s * 0.45);

  // frozen tint (power-up later)
  if (p.frozenT > 0) ctx.filter = 'hue-rotate(160deg) saturate(1.4) brightness(1.15)';

  // --- back leg
  const hipY = -25;
  const backFootX = -f * 5 - swing * 7 * f;
  const backFootY = -6 - (running ? Math.max(0, -swing) * 5 : 0);
  limb(ctx, -f * 3, hipY, backFootX, backFootY, L.sock, 7);
  shoe(ctx, backFootX + f * 1, backFootY + 1, 0, f, shade(L.shoe), L.shoeSole);

  // --- back arm
  const armSwing = running ? swing * 5 : Math.sin(t * 2.4 + p.index) * 1.2;
  limb(ctx, -f * 12, -48, -f * 16 - armSwing * f, -34, L.skin, 6);

  // --- shorts
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.fillStyle = L.shorts;
  ctx.beginPath();
  ctx.roundRect(-15, -34, 30, 13, 4);
  ctx.fill();
  ctx.stroke();
  // --- shirt
  ctx.fillStyle = L.shirt;
  ctx.beginPath();
  ctx.roundRect(-17, -60, 34, 30, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = L.shirtTrim;
  ctx.fillRect(-15.5, -44, 31, 4);

  // --- front leg & shoe (follows the kick)
  const fx = p.footX - p.x;
  const fy = p.footY - p.y;
  let footX = fx;
  let footY = fy;
  if (!p.kicking && running) {
    footX += swing * 7 * f;
    footY -= Math.max(0, swing) * 5;
  }
  limb(ctx, f * 3, hipY, footX - f * 1, footY - 3, L.sock, 7);
  const kickRot = p.kicking ? -(p.footAngle - 0.12) * 0.55 * f : 0;
  shoe(ctx, footX, footY, kickRot, f, L.shoe, L.shoeSole);

  // --- front arm
  limb(ctx, f * 12, -48, f * 17 + armSwing * f, -35, L.skin, 6);

  // --- head
  const hx = p.headX - p.x;
  const hy = p.headY - p.y;
  ctx.translate(hx, hy);
  const idle = p.grounded && Math.abs(p.vx) < 30;
  const breathe = idle ? Math.sin(t * 2.6 + p.index * 1.7) * 0.018 : 0;
  ctx.scale(1 - s * 0.25 - breathe * 0.5, 1 + s * 0.2 + breathe);
  drawHead(ctx, p, p.headR, f, t);
  ctx.restore();
}

function shade(hex: string): string {
  // darken a #rrggbb colour by ~25 %
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * 0.75);
  const g = Math.floor(((n >> 8) & 255) * 0.75);
  const b = Math.floor((n & 255) * 0.75);
  return `rgb(${r},${g},${b})`;
}

export function drawHead(ctx: CanvasRenderingContext2D, p: Player, R: number, f: 1 | -1, t: number): void {
  const L = p.char.look;
  const expr: Expression = p.expr;
  const h: HeadDraw = { ctx, R, facing: f, t, expr };

  p.char.drawBack?.(h);

  // ear on the back side
  ctx.lineWidth = 4;
  ctx.strokeStyle = INK;
  ctx.fillStyle = L.skin;
  ctx.beginPath();
  ctx.ellipse(-f * R * 0.86, R * 0.08, R * 0.2, R * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // head ball
  const grad = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.1, 0, 0, R * 1.05);
  grad.addColorStop(0, lighten(L.skin));
  grad.addColorStop(0.55, L.skin);
  grad.addColorStop(1, L.skinShade);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.stroke();

  // cheek
  ctx.fillStyle = 'rgba(255,90,90,0.22)';
  ctx.beginPath();
  ctx.ellipse(f * R * 0.5, R * 0.32, R * 0.17, R * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();

  drawFace(ctx, p, R, f, expr);
  p.char.drawFront?.(h);
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r},${g},${b})`;
}

function drawFace(ctx: CanvasRenderingContext2D, p: Player, R: number, f: 1 | -1, expr: Expression): void {
  const eyes = [
    { x: f * R * 0.12, s: 0.9 },
    { x: f * R * 0.54, s: 1 },
  ];
  const ey = -R * 0.06;
  const lx = clamp(p.lookX, -1, 1);
  const ly = clamp(p.lookY, -1, 1);
  const closed = p.blink > 0 || expr === 'happy';

  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  for (const e of eyes) {
    const rx = R * 0.18 * e.s;
    const ry = R * 0.23 * e.s;
    if (closed) {
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      if (expr === 'happy') ctx.arc(e.x, ey + ry * 0.3, rx, Math.PI * 1.1, Math.PI * 1.9);
      else {
        ctx.moveTo(e.x - rx, ey);
        ctx.quadraticCurveTo(e.x, ey + ry * 0.45, e.x + rx, ey);
      }
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(e.x, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    // pupil follows the ball
    const pr = R * (expr === 'shock' ? 0.06 : 0.092) * e.s;
    const px = e.x + lx * rx * 0.48;
    const py = ey + ly * ry * 0.45;
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - pr * 0.35, py - pr * 0.4, pr * 0.35, 0, Math.PI * 2);
    ctx.fill();
    // lids for sad/effort/angry
    if (expr === 'sad' || expr === 'effort' || expr === 'angry') {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(e.x, ey, rx + 1, ry + 1, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = p.char.look.skinShade;
      ctx.beginPath();
      const tilt = expr === 'sad' ? -0.35 * f : 0.35 * f;
      ctx.translate(e.x, ey - ry * 0.35);
      ctx.rotate(expr === 'effort' ? 0 : (e === eyes[0] ? -1 : 1) * tilt * -1);
      ctx.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(e.x, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // eyebrows
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  for (const e of eyes) {
    const bx = e.x;
    const by = ey - R * 0.33 * e.s;
    const inner = e === eyes[0] ? 1 : -1; // towards the other eye
    let tilt = 0;
    if (expr === 'angry' || expr === 'effort') tilt = 0.35;
    if (expr === 'sad') tilt = -0.35;
    ctx.beginPath();
    const w = R * 0.16;
    const dy = tilt * w * inner * f;
    ctx.moveTo(bx - w, by - dy);
    ctx.lineTo(bx + w, by + dy);
    ctx.stroke();
  }

  // nose
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(f * R * 0.78, R * 0.14, R * 0.09, -Math.PI / 2, Math.PI / 2, f < 0);
  ctx.stroke();

  // mouth
  const mx = f * R * 0.38;
  const my = R * 0.46;
  const mw = R * 0.24;
  ctx.lineWidth = 3.5;
  ctx.fillStyle = '#5a1020';
  ctx.beginPath();
  switch (expr) {
    case 'happy':
      ctx.moveTo(mx - mw * 1.2, my - R * 0.06);
      ctx.quadraticCurveTo(mx, my + R * 0.42, mx + mw * 1.2, my - R * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff6b81';
      ctx.beginPath();
      ctx.ellipse(mx, my + R * 0.14, mw * 0.55, R * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sad':
      ctx.moveTo(mx - mw, my + R * 0.1);
      ctx.quadraticCurveTo(mx, my - R * 0.12, mx + mw, my + R * 0.1);
      ctx.stroke();
      break;
    case 'angry':
      ctx.fillStyle = '#ffffff';
      ctx.roundRect(mx - mw, my - R * 0.04, mw * 2, R * 0.16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - mw, my + R * 0.04);
      ctx.lineTo(mx + mw, my + R * 0.04);
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    case 'effort':
    case 'shock':
      ctx.ellipse(mx, my + R * 0.04, mw * 0.5, R * 0.12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    default:
      ctx.moveTo(mx - mw, my);
      ctx.quadraticCurveTo(mx, my + R * 0.18, mx + mw, my - R * 0.03);
      ctx.stroke();
  }
}
