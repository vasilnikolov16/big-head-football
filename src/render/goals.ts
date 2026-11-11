import { GOAL_DEPTH, GROUND_Y, INK, W } from '../core/constants';
import type { Arena } from '../physics/arena';

const DEPTH_UP = 26; // how much higher the far frame of the goal appears

/** Wobble of the net after a goal: set by the fx layer, decays over time. */
export interface NetState {
  push: number; // 0..1
  y: number; // where the ball hit
  t: number;
}

function mirror(ctx: CanvasRenderingContext2D, side: number): void {
  if (side === 1) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
}

/** Net + posts, drawn behind players and the ball. */
export function drawGoalBack(ctx: CanvasRenderingContext2D, side: number, arena: Arena, net: NetState | null, t: number): void {
  const top = arena.goalTop[side];
  const gl = GOAL_DEPTH;
  const D = DEPTH_UP;
  ctx.save();
  mirror(ctx, side);

  // shadow of the goal on the grass
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(gl * 0.5, GROUND_Y + 2, gl * 0.75, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // net panels
  ctx.fillStyle = 'rgba(220,230,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(0, top - D);
  ctx.lineTo(gl - 8, top - D);
  ctx.lineTo(gl - 8, GROUND_Y - D);
  ctx.lineTo(gl, GROUND_Y);
  ctx.lineTo(0, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // net mesh with bulge
  const push = net ? net.push : 0;
  const hitY = net ? net.y : (top + GROUND_Y) / 2;
  const wob = net ? Math.sin(net.t * 22) * 0.35 + 0.65 : 0;
  const bulgeAt = (y: number): number => {
    const d = (y - hitY) / 110;
    return -push * wob * 34 * Math.exp(-d * d);
  };
  ctx.strokeStyle = 'rgba(235,240,255,0.42)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const step = 12;
  // near side panel: vertical strands (bulge backwards where the ball hit)
  for (let x = step; x < gl; x += step) {
    const k = x / gl;
    for (let y = top; y <= GROUND_Y; y += 8) {
      const bx = x + bulgeAt(y) * k;
      if (y === top) ctx.moveTo(bx, y);
      else ctx.lineTo(bx, y);
    }
  }
  // horizontal strands
  for (let y = top + step; y < GROUND_Y; y += step) {
    const b = bulgeAt(y);
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(gl * 0.5 + b * 0.8, y, gl + b * 0.1, y);
  }
  // roof strip
  for (let x = 0; x <= gl; x += step) {
    ctx.moveTo(x, top);
    ctx.lineTo((x * (gl - 8)) / gl, top - D);
  }
  ctx.moveTo(0, top - D * 0.5);
  ctx.lineTo(gl - 4, top - D * 0.5);
  ctx.stroke();
  void t;

  // far frame
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(200,210,240,0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-10, top - D);
  ctx.lineTo(gl - 8, top - D);
  ctx.lineTo(gl - 8, GROUND_Y - D);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(gl - 8, top - D);
  ctx.lineTo(gl, top);
  ctx.stroke();

  // near post (the goal line)
  ctx.strokeStyle = INK;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(gl, top);
  ctx.lineTo(gl, GROUND_Y);
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(gl, top);
  ctx.lineTo(gl, GROUND_Y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(gl + 2, top + 8);
  ctx.lineTo(gl + 2, GROUND_Y);
  ctx.stroke();
  ctx.restore();
}

/** Crossbar, drawn in front of everything that can pass under it. */
export function drawCrossbar(ctx: CanvasRenderingContext2D, side: number, arena: Arena, flash: number): void {
  const bar = arena.bars[side];
  ctx.save();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(bar.x - 2, bar.y - 2, bar.w + 4, bar.h + 4, 8);
  ctx.fill();
  const g = ctx.createLinearGradient(0, bar.y, 0, bar.y + bar.h);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#c9d2ee');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(bar.x, bar.y, bar.w, bar.h, 6);
  ctx.fill();
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,240,150,${flash})`;
    ctx.fill();
  }
  ctx.restore();
}
