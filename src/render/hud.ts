import { FONT_DISPLAY, H, INK, W } from '../core/constants';
import { clamp, easeOutBack, formatTime } from '../core/math';
import type { Banner, Match } from '../game/match';

function plate(ctx: CanvasRenderingContext2D, side: 0 | 1, color: string, name: string, tag: string): void {
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
  if (tag) {
    const w = ctx.measureText(name.toUpperCase()).width;
    ctx.font = `12px ${FONT_DISPLAY}`;
    const tw = ctx.measureText(tag).width + 12;
    const tx = inner + dir * (36 + w) + (side === 0 ? -tw : 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(tx, 31, tw, 18, 5);
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.textAlign = 'left';
    ctx.fillText(tag, tx + 6, 40.5);
  }
  ctx.restore();
}

/** Super energy bar under a name plate. */
function energyBar(ctx: CanvasRenderingContext2D, m: Match, side: 0 | 1, t: number): void {
  const p = m.players[side];
  const dir = side === 0 ? -1 : 1;
  const inner = W / 2 + dir * 100;
  const outer = W / 2 + dir * 300;
  const x0 = Math.min(inner, outer);
  const w = Math.abs(outer - inner);
  const y = 64;
  const h = 14;
  const full = p.energy >= 1;
  ctx.save();
  ctx.fillStyle = 'rgba(12,10,32,0.85)';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x0 - 2, y - 2, w + 4, h + 4, 8);
  ctx.fill();
  ctx.stroke();
  const fw = w * Math.min(1, p.energy);
  // fill grows from the centre outwards
  const fx = side === 0 ? x0 + w - fw : x0;
  if (fw > 0) {
    const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
    const c = p.char.look.shirt === '#ffffff' ? '#ff4d6d' : p.char.look.shirt;
    if (full) {
      g.addColorStop(0, '#ffd23f');
      g.addColorStop(0.5, '#fff3a0');
      g.addColorStop(1, '#ffd23f');
    } else {
      g.addColorStop(0, c);
      g.addColorStop(1, '#ffd23f');
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(fx, y, fw, h, 6);
    ctx.fill();
    // shine sweep
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(fx, y + 2, fw, 3);
  }
  if (full || p.charged) {
    const pulse = 0.5 + 0.5 * Math.sin(t * (p.charged ? 18 : 7));
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 10 + pulse * 14;
    ctx.strokeStyle = p.charged ? '#ffffff' : '#ffd23f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x0 - 2, y - 2, w + 4, h + 4, 8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `12px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = INK;
    ctx.fillText(p.charged ? 'ЗАРЕДЕН — ДОКОСНИ ТОПКАТА!' : 'СУПЕР УДАР — ГОТОВ!', x0 + w / 2, y + h / 2 + 1);
  }
  ctx.restore();
}

export function drawHud(ctx: CanvasRenderingContext2D, m: Match, t: number): void {
  energyBar(ctx, m, 0, t);
  energyBar(ctx, m, 1, t);
  plate(ctx, 0, m.players[0].char.look.shirt, m.config.names[0], m.config.tags[0]);
  plate(ctx, 1, m.players[1].char.look.shirt, m.config.names[1], m.config.tags[1]);

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
