import { GROUND_Y, INK } from '../core/constants';
import { lerp } from '../core/math';
import { ITEM_R, POWER_INFO, type PowerItem, type PowerType } from '../game/powerups';

/** White glyph for a power-up, drawn in a box of size ~r. */
function glyph(ctx: CanvasRenderingContext2D, type: PowerType, r: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (type) {
    case 'bigBall':
    case 'smallBall': {
      const big = type === 'bigBall';
      ctx.beginPath();
      ctx.arc(-r * 0.12, r * 0.05, r * (big ? 0.5 : 0.28), 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(r * 0.45, -r * 0.55);
      ctx.lineTo(r * 0.75, -r * 0.55);
      if (big) {
        ctx.moveTo(r * 0.6, -r * 0.7);
        ctx.lineTo(r * 0.6, -r * 0.4);
      }
      ctx.stroke();
      break;
    }
    case 'highJump':
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.6);
      for (let i = 0; i < 4; i++) ctx.lineTo((i % 2 ? -0.4 : 0.4) * r, r * (0.45 - i * 0.18));
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.2);
      ctx.lineTo(0, -r * 0.65);
      ctx.lineTo(r * 0.4, -r * 0.2);
      ctx.stroke();
      break;
    case 'fireBall':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.55, -r * 0.1, r * 0.35, r * 0.4);
      ctx.quadraticCurveTo(0, r * 0.75, -r * 0.35, r * 0.4);
      ctx.quadraticCurveTo(-r * 0.5, 0, -r * 0.1, -r * 0.25);
      ctx.quadraticCurveTo(-r * 0.05, -r * 0.45, 0, -r * 0.7);
      ctx.fill();
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.3, r * 0.17, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'freeze':
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.rotate((i * Math.PI) / 3);
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.65);
        ctx.lineTo(0, r * 0.65);
        ctx.moveTo(-r * 0.2, -r * 0.45);
        ctx.lineTo(0, -r * 0.3);
        ctx.lineTo(r * 0.2, -r * 0.45);
        ctx.moveTo(-r * 0.2, r * 0.45);
        ctx.lineTo(0, r * 0.3);
        ctx.lineTo(r * 0.2, r * 0.45);
        ctx.stroke();
        ctx.restore();
      }
      break;
    case 'bigHead':
      ctx.beginPath();
      ctx.arc(0, -r * 0.15, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(-r * 0.12, r * 0.25, r * 0.24, r * 0.42);
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(r * 0.08, -r * 0.2, r * 0.07, 0, Math.PI * 2);
      ctx.arc(r * 0.28, -r * 0.2, r * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'smallGoal':
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, r * 0.55);
      ctx.lineTo(-r * 0.5, -r * 0.1);
      ctx.lineTo(r * 0.5, -r * 0.1);
      ctx.lineTo(r * 0.5, r * 0.55);
      ctx.stroke();
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.25, -r * 0.65);
      ctx.lineTo(0, -r * 0.35);
      ctx.lineTo(r * 0.25, -r * 0.65);
      ctx.stroke();
      break;
    case 'reverse':
      ctx.beginPath();
      ctx.moveTo(-r * 0.55, -r * 0.2);
      ctx.lineTo(r * 0.5, -r * 0.2);
      ctx.moveTo(r * 0.25, -r * 0.45);
      ctx.lineTo(r * 0.5, -r * 0.2);
      ctx.lineTo(r * 0.25, r * 0.05);
      ctx.moveTo(r * 0.55, r * 0.3);
      ctx.lineTo(-r * 0.5, r * 0.3);
      ctx.moveTo(-r * 0.25, r * 0.05);
      ctx.lineTo(-r * 0.5, r * 0.3);
      ctx.lineTo(-r * 0.25, r * 0.55);
      ctx.stroke();
      break;
  }
}

/** Round badge with the power-up glyph (used on the pitch and in the HUD). */
export function drawPowerIcon(ctx: CanvasRenderingContext2D, type: PowerType, x: number, y: number, r: number): void {
  const color = POWER_INFO[type].color;
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.13);
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  glyph(ctx, type, r * 0.85);
  ctx.restore();
}

/** Power-ups on the pitch: parachute while falling, hovering bubble with a timer ring. */
export function drawPowerItems(ctx: CanvasRenderingContext2D, items: PowerItem[], alpha: number, t: number): void {
  for (const it of items) {
    const x = lerp(it.px, it.x, alpha);
    const y = lerp(it.py, it.y, alpha);
    const color = POWER_INFO[it.type].color;
    if (it.landed && it.life < 1.6 && Math.sin(t * 24) > 0) continue; // blink before vanishing
    // shadow on the grass
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(x, GROUND_Y + 2, ITEM_R * 0.8, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!it.landed) {
      // little parachute
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - ITEM_R * 0.8, y - ITEM_R * 0.4);
      ctx.lineTo(x - 26, y - 60);
      ctx.moveTo(x + ITEM_R * 0.8, y - ITEM_R * 0.4);
      ctx.lineTo(x + 26, y - 60);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - 58, 32, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.arc(x, y - 58, 32, Math.PI, Math.PI * 1.35);
      ctx.lineTo(x, y - 58);
      ctx.fill();
    }
    // glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, ITEM_R * 0.6, x, y, ITEM_R * 2.2);
    g.addColorStop(0, color + '88');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, ITEM_R * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    drawPowerIcon(ctx, it.type, x, y, ITEM_R * (1 + Math.sin(t * 5) * 0.04));
    if (it.landed) {
      // remaining time
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, ITEM_R + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (it.life / 7));
      ctx.stroke();
    }
  }
}
