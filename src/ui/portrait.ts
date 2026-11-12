import type { CharacterDef } from '../game/characters';
import { Player } from '../game/player';
import { drawHead } from '../render/playerDraw';
import { drawHat } from '../render/hats';

/** A static head portrait of a hero drawn into a small canvas. */
export function heroPortrait(def: CharacterDef, size: number, opts: { silhouette?: boolean; happy?: boolean; hat?: string } = {}): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = 'portrait';
  const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5;
  c.width = Math.round(size * dpr);
  c.height = Math.round(size * dpr);
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  const p = new Player(0, def);
  p.placeAt(0, 0);
  p.lookX = 0.5;
  p.lookY = 0.1;
  if (opts.happy) p.expr = 'happy';
  g.setTransform(dpr, 0, 0, dpr, (size / 2) * dpr, size * 0.6 * dpr);
  drawHead(g, p, size * 0.27, 1, 1);
  if (opts.hat) drawHat(g, opts.hat, size * 0.27, 1);
  if (opts.silhouette) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#14112e';
    g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}
