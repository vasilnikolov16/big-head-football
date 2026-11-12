import { GROUND_Y, INK } from '../core/constants';
import { clamp, lerp } from '../core/math';
import type { Expression, FaceStyle } from '../game/characters';
import { DASH_TIME, type Player } from '../game/player';
import { SUPER_INFO } from '../game/supers';
import { HERO_ART, type HeadDraw } from './heroArt';

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

function shade(hex: string, k = 0.75): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.floor(((n >> 16) & 255) * k);
  const g = Math.floor(((n >> 8) & 255) * k);
  const b = Math.floor((n & 255) * k);
  return `rgb(${r},${g},${b})`;
}

function lighten(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 40);
  const g = Math.min(255, ((n >> 8) & 255) + 40);
  const b = Math.min(255, (n & 255) + 40);
  return `rgb(${r},${g},${b})`;
}

/** Speed lines behind a dashing player. */
function drawDashLines(ctx: CanvasRenderingContext2D, p: Player, k: number): void {
  const d = p.dashDir;
  const top = -(p.height - 6);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y = -12 + (top + 12) * (i / 4);
    const len = (40 + ((i * 37) % 30)) * k;
    const x0 = -d * (p.headR * 0.55 + 6 + (i % 2) * 8);
    ctx.strokeStyle = `rgba(255,255,255,${0.55 * k})`;
    ctx.lineWidth = 4 - (i % 2);
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 - d * len, y);
    ctx.stroke();
  }
  ctx.restore();
}

/** Glow around a player whose super shot is armed. */
function drawAura(ctx: CanvasRenderingContext2D, p: Player, t: number): void {
  const color = SUPER_INFO[p.char.super].color;
  const cy = (p.headY - p.y) * 0.75;
  const pulse = 1 + Math.sin(t * 12) * 0.06;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(0, cy, 10, 0, cy, p.headR * 2.1 * pulse);
  g.addColorStop(0, color + '66');
  g.addColorStop(0.6, color + '22');
  g.addColorStop(1, color + '00');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, cy, p.headR * 2.1 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  for (let i = 0; i < 6; i++) {
    const a = t * 3 + (i / 6) * Math.PI * 2;
    const r = p.headR * 1.5;
    const s = 2.5 + Math.sin(t * 8 + i) * 1.2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r, cy + Math.sin(a) * r * 0.9, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i / 10) * Math.PI * 2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}


export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, alpha: number, t: number): void {
  const x = lerp(p.px, p.x, alpha);
  const y = lerp(p.py, p.y, alpha);
  const f = p.facing;
  const L = p.char.look;
  const art = HERO_ART[p.char.id] ?? {};
  const s = p.squash;
  const running = p.grounded && Math.abs(p.vx) > 40;
  const swing = running ? Math.sin(p.runPhase) : 0;
  const arms = L.arms ?? L.skin;

  ctx.save();
  ctx.translate(x, y);
  if (p.charged) drawAura(ctx, p, t);
  const dash = p.dashT > 0 ? p.dashT / DASH_TIME : 0;
  if (dash > 0) drawDashLines(ctx, p, dash);
  // squash & stretch around the feet
  ctx.scale(1 + s * 0.45, 1 - s * 0.45);
  // lean into the dash
  if (dash > 0) ctx.transform(1, 0, p.dashDir * -0.22 * dash, 1, 0, 0);

  if (art.bodyBack) {
    ctx.save();
    ctx.scale(f, 1);
    art.bodyBack({ ctx, t });
    ctx.restore();
  }

  // --- back leg
  const hipY = -25;
  const backFootX = -f * 5 - swing * 7 * f;
  const backFootY = -6 - (running ? Math.max(0, -swing) * 5 : 0);
  limb(ctx, -f * 3, hipY, backFootX, backFootY, L.sock, 7);
  shoe(ctx, backFootX + f * 1, backFootY + 1, 0, f, shade(L.shoe), L.shoeSole);

  // --- back arm
  const armSwing = running ? swing * 5 : Math.sin(t * 2.4 + p.index) * 1.2;
  limb(ctx, -f * 12, -48, -f * 16 - armSwing * f, -34, arms, 6);

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
  if (art.bodyFront) {
    ctx.save();
    ctx.scale(f, 1);
    art.bodyFront({ ctx, t });
    ctx.restore();
  }

  // --- front leg & shoe (follows the kick)
  let footX = p.footX - p.x;
  let footY = p.footY - p.y;
  if (!p.kicking && running) {
    footX += swing * 7 * f;
    footY -= Math.max(0, swing) * 5;
  }
  limb(ctx, f * 3, hipY, footX - f * 1, footY - 3, L.sock, 7);
  const kickRot = p.kicking ? -(p.footAngle - 0.12) * 0.55 * f : 0;
  shoe(ctx, footX, footY, kickRot, f, L.shoe, L.shoeSole);

  // --- front arm
  limb(ctx, f * 12, -48, f * 17 + armSwing * f, -35, arms, 6);

  // --- head
  const hx = p.headX - p.x;
  const hy = p.headY - p.y;
  ctx.translate(hx, hy);
  const idle = p.grounded && Math.abs(p.vx) < 30;
  const breathe = idle ? Math.sin(t * 2.6 + p.index * 1.7) * 0.018 : 0;
  ctx.save();
  ctx.scale(1 - s * 0.25 - breathe * 0.5, 1 + s * 0.2 + breathe);
  drawHead(ctx, p, p.headR, f, t);
  ctx.restore();

  drawStatus(ctx, p, t);

  // dizzy stars when stunned
  if (p.stunT > 0) {
    ctx.fillStyle = '#ffe14d';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const a = t * 5 + (i / 3) * Math.PI * 2;
      star(ctx, Math.cos(a) * p.headR * 0.9, -p.headR * 1.15 + Math.sin(a) * 8, 7, t * 4);
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Power-up states, drawn with the origin at the head centre. */
function drawStatus(ctx: CanvasRenderingContext2D, p: Player, t: number): void {
  const R = p.headR;
  const feet = p.y - p.headY; // distance head centre -> feet
  // effects of a blocked super shot: little badges above the head
  const badges: string[] = [];
  if (p.slowT > 0) badges.push('🐌');
  if (p.noJumpT > 0) badges.push('🐸');
  if (p.burnT > 0) badges.push('🔥');
  if (p.shrinkT > 0) badges.push('💫');
  if (badges.length) {
    ctx.save();
    ctx.font = `${Math.round(Math.max(18, R * 0.5))}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    badges.forEach((b, i) => ctx.fillText(b, (i - (badges.length - 1) / 2) * 28, -R - 34 + Math.sin(t * 5 + i) * 3));
    ctx.restore();
  }
  if (p.burnT > 0) {
    // smoke rising off a burned head
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.2 + i / 3) % 1;
      ctx.fillStyle = `rgba(70,70,80,${0.45 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc((i - 1) * R * 0.4 + Math.sin(t * 3 + i) * 4, -R * 0.8 - k * 40, 6 + k * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (p.frozenT > 0) {
    // ice block
    ctx.save();
    const w = R * 2.3;
    const top = -R * 1.15;
    const g = ctx.createLinearGradient(-w / 2, top, w / 2, feet);
    g.addColorStop(0, 'rgba(200,245,255,0.55)');
    g.addColorStop(1, 'rgba(120,200,255,0.35)');
    ctx.fillStyle = g;
    ctx.strokeStyle = 'rgba(230,250,255,0.95)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-w / 2, top, w, feet - top + 4, 12);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.35, top + 12);
    ctx.lineTo(-w * 0.15, top + 40);
    ctx.moveTo(w * 0.25, top + 20);
    ctx.lineTo(w * 0.38, top + 32);
    ctx.stroke();
    ctx.restore();
  }
  if (p.reversedT > 0) {
    ctx.save();
    ctx.translate(0, -R - 28);
    ctx.rotate(Math.sin(t * 6) * 0.3);
    ctx.fillStyle = '#ff5ea8';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⇄', 0, 1);
    ctx.restore();
  }
  if (p.fireT > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 8;
      const h = 14 + Math.sin(t * 20 + i * 1.7) * 6;
      ctx.fillStyle = i % 2 ? 'rgba(255,80,20,0.7)' : 'rgba(255,200,60,0.7)';
      ctx.beginPath();
      ctx.moveTo(x - 5, feet);
      ctx.quadraticCurveTo(x, feet - h * 1.4, x + 5, feet);
      ctx.fill();
    }
    ctx.restore();
  }
  if (p.jumpBoostT > 0) {
    ctx.save();
    ctx.strokeStyle = '#7cff6b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) ctx.lineTo((i % 2 ? -7 : 7) + p.facing * 4, feet + 2 - i * 3);
    ctx.stroke();
    ctx.restore();
  }
}

/** Draws just the head (used by the game and by the hero-select portraits). */
export function drawHead(ctx: CanvasRenderingContext2D, p: Player, R: number, f: 1 | -1, t: number): void {
  const L = p.char.look;
  const face = p.char.face;
  const art = HERO_ART[p.char.id] ?? {};
  const h: HeadDraw = { ctx, R, t, expr: p.expr };

  ctx.save();
  ctx.scale(f, 1);
  art.back?.(h);

  if (face.ear) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.ellipse(-R * 0.86, R * 0.08, R * 0.2, R * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // head ball
  const grad = ctx.createRadialGradient(-R * 0.35 * f, -R * 0.45, R * 0.1, 0, 0, R * 1.05);
  grad.addColorStop(0, lighten(L.skin));
  grad.addColorStop(0.55, L.skin);
  grad.addColorStop(1, L.skinShade);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.fill();

  if (art.skin) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.clip();
    art.skin(h);
    // keep the shading on top of skin patterns
    const sh = ctx.createRadialGradient(-R * 0.35, -R * 0.45, R * 0.3, 0, 0, R * 1.05);
    sh.addColorStop(0, 'rgba(255,255,255,0.12)');
    sh.addColorStop(0.6, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = sh;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.restore();
  }

  ctx.lineWidth = 4.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();

  if (face.cheeks) {
    ctx.fillStyle = 'rgba(255,90,90,0.22)';
    ctx.beginPath();
    ctx.ellipse(R * 0.5, R * 0.32, R * 0.17, R * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // looking direction in mirrored space
  const lx = clamp(p.lookX, -1, 1) * f;
  const ly = clamp(p.lookY, -1, 1);
  drawEyes(ctx, p, face, R, lx, ly, t);
  drawNose(ctx, face, R);
  drawMouth(ctx, face, R, p.expr, t);
  art.front?.(h);
  ctx.restore();
}

// ------------------------------------------------------------------ face parts (mirrored space)

const EYES = [
  { x: 0.12, s: 0.9 },
  { x: 0.54, s: 1 },
];

function drawEyes(
  ctx: CanvasRenderingContext2D,
  p: Player,
  face: FaceStyle,
  R: number,
  lx: number,
  ly: number,
  t: number,
): void {
  const expr = p.expr;
  const ey = -R * 0.06;
  const blink = p.blink > 0;

  if (face.eyes === 'visor') {
    // robot: dark visor with glowing LED eyes
    ctx.fillStyle = '#10141f';
    ctx.beginPath();
    ctx.roundRect(-R * 0.15, -R * 0.36, R * 1.1, R * 0.5, R * 0.18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.fillStyle = '#4fd1ff';
    ctx.shadowColor = '#4fd1ff';
    ctx.shadowBlur = 10;
    for (const e of EYES) {
      const cx = R * e.x + lx * R * 0.07;
      const cy = ey + ly * R * 0.05;
      ctx.beginPath();
      if (blink) ctx.rect(cx - R * 0.12, cy - 1.5, R * 0.24, 3);
      else if (expr === 'happy') {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#4fd1ff';
        ctx.arc(cx, cy + R * 0.06, R * 0.1, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      } else {
        const hh = expr === 'angry' || expr === 'effort' ? R * 0.1 : expr === 'sad' ? R * 0.12 : R * 0.18;
        ctx.roundRect(cx - R * 0.1, cy - hh / 2, R * 0.2, hh, 3);
      }
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    return;
  }

  if (face.eyes === 'alien') {
    for (const [i, e] of EYES.entries()) {
      const cx = R * e.x + R * 0.04;
      ctx.save();
      ctx.translate(cx, ey);
      ctx.rotate(i === 0 ? -0.35 : 0.35);
      ctx.fillStyle = '#0d0d1a';
      ctx.beginPath();
      if (blink) ctx.ellipse(0, 0, R * 0.22, R * 0.03, 0, 0, Math.PI * 2);
      else if (expr === 'happy') {
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#0d0d1a';
        ctx.arc(0, R * 0.08, R * 0.16, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
        continue;
      } else ctx.ellipse(0, 0, R * 0.2, R * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = INK;
      ctx.stroke();
      if (!blink) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(-R * 0.05 + lx * R * 0.06, -R * 0.1 + ly * R * 0.08, R * 0.06, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(199,125,255,0.6)';
        ctx.beginPath();
        ctx.arc(R * 0.06 + lx * R * 0.04, R * 0.1, R * 0.035, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    return;
  }

  const sleepy = face.eyes === 'sleepy';
  const closed = blink || expr === 'happy';
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  for (const e of EYES) {
    const ex = R * e.x;
    const rx = R * 0.18 * e.s;
    const ry = R * 0.23 * e.s;
    if (closed) {
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      if (expr === 'happy') ctx.arc(ex, ey + ry * 0.3, rx, Math.PI * 1.1, Math.PI * 1.9);
      else {
        ctx.moveTo(ex - rx, ey);
        ctx.quadraticCurveTo(ex, ey + ry * 0.45, ex + rx, ey);
      }
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();
    // iris + pupil follow the ball
    const px = ex + lx * rx * 0.48;
    const py = ey + ly * ry * 0.45;
    if (face.iris) {
      ctx.fillStyle = face.iris;
      ctx.beginPath();
      ctx.arc(px, py, R * 0.13 * e.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    if (sleepy) ctx.ellipse(px, py, R * 0.035 * e.s, R * 0.1 * e.s, 0, 0, Math.PI * 2);
    else ctx.arc(px, py, R * (expr === 'shock' ? 0.06 : 0.092) * e.s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px - R * 0.035, py - R * 0.04, R * 0.032, 0, Math.PI * 2);
    ctx.fill();

    // lids: always half closed for sleepy eyes, plus mood lids
    const lid = sleepy && expr !== 'shock' ? 0.5 : expr === 'sad' || expr === 'effort' || expr === 'angry' ? 0.35 : 0;
    if (lid > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx + 1, ry + 1, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = p.char.look.skinShade;
      ctx.translate(ex, ey - ry + ry * 2 * lid);
      const tilt = expr === 'sad' ? (e === EYES[0] ? 0.3 : -0.3) : expr === 'angry' ? (e === EYES[0] ? -0.3 : 0.3) : 0;
      ctx.rotate(tilt);
      ctx.fillRect(-rx * 2, -ry * 3, rx * 4, ry * 3);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-rx * 1.5, 0);
      ctx.lineTo(rx * 1.5, 0);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  if (face.brows) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK;
    for (const e of EYES) {
      const bx = R * e.x;
      const by = ey - R * 0.33 * e.s;
      const inner = e === EYES[0] ? 1 : -1;
      let tilt = 0;
      if (expr === 'angry' || expr === 'effort') tilt = 0.35;
      if (expr === 'sad') tilt = -0.35;
      const w = R * 0.16;
      const dy = tilt * w * inner;
      ctx.beginPath();
      ctx.moveTo(bx - w, by - dy);
      ctx.lineTo(bx + w, by + dy);
      ctx.stroke();
    }
  }
  void t;
}

function drawNose(ctx: CanvasRenderingContext2D, face: FaceStyle, R: number): void {
  ctx.strokeStyle = INK;
  if (face.nose === 'human') {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(R * 0.78, R * 0.14, R * 0.09, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
  } else if (face.nose === 'cat') {
    ctx.fillStyle = '#ff8fab';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(R * 0.7, R * 0.12);
    ctx.lineTo(R * 0.9, R * 0.12);
    ctx.lineTo(R * 0.8, R * 0.24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawMouth(ctx: CanvasRenderingContext2D, face: FaceStyle, R: number, expr: Expression, t: number): void {
  if (face.mouth === 'mask') return;
  ctx.strokeStyle = INK;
  ctx.lineCap = 'round';

  if (face.mouth === 'led') {
    const mx = R * 0.45;
    const my = R * 0.5;
    ctx.fillStyle = '#10141f';
    ctx.beginPath();
    ctx.roundRect(mx - R * 0.28, my - R * 0.1, R * 0.56, R * 0.2, 4);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#4fd1ff';
    const cols = 7;
    for (let i = 0; i < cols; i++) {
      const u = i / (cols - 1) - 0.5;
      let dy = 0;
      if (expr === 'happy') dy = -(0.25 - u * u) * R * 0.25;
      else if (expr === 'sad' || expr === 'angry') dy = (0.25 - u * u) * R * 0.22;
      else if (expr === 'effort' || expr === 'shock') dy = Math.sin(t * 30 + i) * R * 0.04;
      ctx.fillRect(mx + u * R * 0.46 - 2, my + dy * -1 - 2, 4, 4);
    }
    return;
  }

  if (face.mouth === 'cat') {
    const mx = R * 0.8;
    const my = R * 0.3;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (expr === 'happy' || expr === 'shock' || expr === 'effort') {
      ctx.fillStyle = '#5a1020';
      ctx.ellipse(mx - R * 0.05, my + R * 0.12, R * 0.12, R * (expr === 'happy' ? 0.12 : 0.09), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (expr === 'sad' || expr === 'angry') {
      ctx.moveTo(mx - R * 0.2, my + R * 0.16);
      ctx.quadraticCurveTo(mx - R * 0.05, my + R * 0.04, mx + R * 0.1, my + R * 0.16);
      ctx.stroke();
    } else {
      // "ω"
      ctx.moveTo(mx - R * 0.2, my + R * 0.04);
      ctx.quadraticCurveTo(mx - R * 0.12, my + R * 0.14, mx - R * 0.02, my + R * 0.02);
      ctx.quadraticCurveTo(mx + R * 0.06, my + R * 0.14, mx + R * 0.14, my + R * 0.04);
      ctx.stroke();
    }
    return;
  }

  // human mouth
  const mx = R * 0.38;
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
