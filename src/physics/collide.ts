import { clamp } from '../core/math';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Contact normal points from the obstacle towards the circle. */
export interface Contact {
  nx: number;
  ny: number;
  pen: number;
}

export const makeContact = (): Contact => ({ nx: 0, ny: 0, pen: 0 });

export function circleCircle(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
  out: Contact,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  const d2 = dx * dx + dy * dy;
  if (d2 >= rr * rr) return false;
  if (d2 < 1e-8) {
    out.nx = 0;
    out.ny = -1;
    out.pen = rr;
    return true;
  }
  const d = Math.sqrt(d2);
  out.nx = dx / d;
  out.ny = dy / d;
  out.pen = rr - d;
  return true;
}

export function circleRect(cx: number, cy: number, r: number, rect: Rect, out: Contact): boolean {
  const qx = clamp(cx, rect.x, rect.x + rect.w);
  const qy = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - qx;
  const dy = cy - qy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    out.nx = dx / d;
    out.ny = dy / d;
    out.pen = r - d;
    return true;
  }
  // Centre is inside the rectangle: push out along the shallowest axis.
  const left = cx - rect.x;
  const right = rect.x + rect.w - cx;
  const top = cy - rect.y;
  const bottom = rect.y + rect.h - cy;
  const m = Math.min(left, right, top, bottom);
  out.nx = 0;
  out.ny = 0;
  if (m === top) {
    out.ny = -1;
    out.pen = top + r;
  } else if (m === bottom) {
    out.ny = 1;
    out.pen = bottom + r;
  } else if (m === left) {
    out.nx = -1;
    out.pen = left + r;
  } else {
    out.nx = 1;
    out.pen = right + r;
  }
  return true;
}
