import { FONT_DISPLAY, FONT_TEXT, H, INK, W } from '../core/constants';
import { clamp, easeOutBack, formatTime } from '../core/math';
import type { Banner, Match } from '../game/match';

function plate(ctx: CanvasRenderingContext2D, side: 0 | 1, color: string, name: string): void {
  const dir = side === 0 ? -1 : 1;
  const inner = W / 2 + dir * 96;
  const outer = W / 2 + dir * 330;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(inner, 18);
  ctx.lineTo(outer + dir * 0, 18);
  ctx.lineTo(outer - dir * 16, 60);
  ctx.lineTo(inner, 60);
  ctx.closePath();
  ctx.fillStyle = 'rgba(12,10,32,0.82)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // colour stripe
  ctx.beginPath();
  ctx.moveTo(inner, 18);
  ctx.lineTo(inner + dir * 12, 18);
  ctx.lineTo(inner + dir * 12, 60);
  ctx.lineTo(inner, 60);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `22px ${FONT_DISPLAY}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = side === 0 ? 'right' : 'left';
  ctx.fillText(name.toUpperCase(), inner + dir * 26, 40);
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, m: Match, t: number): void {
  plate(ctx, 0, m.players[0].char.look.shirt, m.config.names[0]);
  plate(ctx, 1, m.players[1].char.look.shirt, m.config.names[1]);

  // score box
  ctx.save();
  ctx.fillStyle = 'rgba(12,10,32,0.92)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 96, 8, 192, 64, 14);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(W / 2 - 90, 13, 180, 54, 10);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.font = `44px ${FONT_DISPLAY}`;
  ctx.fillText(String(m.score[0]), W / 2 - 46, 42);
  ctx.fillText(String(m.score[1]), W / 2 + 46, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `30px ${FONT_DISPLAY}`;
  ctx.fillText(':', W / 2, 40);

  // timer pill
  const low = !m.golden && m.timeLeft <= 10 && m.phase === 'playing';
  const pulse = low ? 1 + Math.max(0, Math.sin(t * Math.PI * 2)) * 0.08 : 1;
  ctx.translate(W / 2, 84);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = m.golden ? '#ffd23f' : low ? '#ff3b4f' : '#ffffff';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(-58, -15, 116, 30, 15);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = m.golden ? INK : low ? '#ffffff' : INK;
  ctx.font = `${m.golden ? 15 : 20}px ${FONT_DISPLAY}`;
  ctx.fillText(m.golden ? 'ЗЛАТЕН ГОЛ' : formatTime(m.timeLeft), 0, 1);
  ctx.restore();
}

export function drawBanner(ctx: CanvasRenderingContext2D, b: Banner): void {
  const inT = clamp(b.t / 0.35, 0, 1);
  const outT = clamp((b.dur - b.t) / 0.3, 0, 1);
  const scale = easeOutBack(inT) * (0.85 + 0.15 * outT);
  ctx.save();
  ctx.globalAlpha = outT;
  ctx.translate(W / 2, H * 0.4);
  ctx.rotate(-0.04);
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const big = b.text.length <= 5 ? 130 : 84;
  ctx.font = `${big}px ${FONT_DISPLAY}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 16;
  ctx.strokeStyle = INK;
  ctx.strokeText(b.text, 0, 0);
  ctx.fillStyle = b.color;
  ctx.fillText(b.text, 0, 0);
  if (b.sub) {
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.lineWidth = 9;
    ctx.strokeText(b.sub, 0, big * 0.62);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.sub, 0, big * 0.62);
  }
  ctx.restore();
}

export function drawCenterOverlay(ctx: CanvasRenderingContext2D, title: string, lines: string[], color = '#ffffff'): void {
  ctx.save();
  ctx.fillStyle = 'rgba(6,5,20,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `80px ${FONT_DISPLAY}`;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 14;
  ctx.strokeStyle = INK;
  ctx.strokeText(title, W / 2, H * 0.36);
  ctx.fillStyle = color;
  ctx.fillText(title, W / 2, H * 0.36);
  ctx.font = `26px ${FONT_TEXT}`;
  ctx.fillStyle = '#e6e8ff';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H * 0.36 + 80 + i * 40));
  ctx.restore();
}
