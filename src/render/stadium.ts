import { FONT_DISPLAY, GRASS_TOP, GROUND_Y, H, W } from '../core/constants';
import { mulberry32 } from '../core/math';
import { t as tx } from '../i18n/i18n';

/** Extra margin around the cached background so screen shake never shows edges. */
export const BG_MARGIN = 28;

interface Fan {
  x: number;
  y: number;
  s: number;
  sprite: number;
  phase: number;
  speed: number;
  jumpy: number;
  seed: number;
}

const SKIN = ['#f6d0b1', '#eab48c', '#c98d63', '#9c6644', '#6e4529', '#f3c49b'];
const LEFT_SHIRTS = ['#ff4d4d', '#ff7a3c', '#ffd23f', '#ff4d6d', '#e83a3a', '#ffffff'];
const RIGHT_SHIRTS = ['#2f8cff', '#4fd1ff', '#ffffff', '#5b6cff', '#1f6fe0', '#8be9ff'];
const NEUTRAL = ['#7cd67c', '#c77dff', '#ff9ff3', '#2e2e48', '#f4a261', '#e9ecef'];

const ADS = [
  { text: 'ad.1', color: '#ff4d4d' },
  { text: 'ad.2', color: '#ff9f1c' },
  { text: 'ad.3', color: '#ffd23f' },
  { text: 'ad.4', color: '#4fd1ff' },
  { text: 'ad.5', color: '#7cff6b' },
  { text: 'ad.6', color: '#c77dff' },
];

export const LAMPS: Array<{ x: number; y: number; aimX: number }> = [
  { x: 60, y: 38, aimX: 520 },
  { x: 330, y: 70, aimX: 760 },
  { x: W - 330, y: 70, aimX: 520 },
  { x: W - 60, y: 38, aimX: 760 },
];

const makeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
};

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export class Stadium {
  private bg: HTMLCanvasElement = makeCanvas(1, 1);
  private lights: HTMLCanvasElement = makeCanvas(1, 1);
  private sprites: HTMLCanvasElement[] = [];
  private spritesUp: HTMLCanvasElement[] = [];
  private fans: Fan[] = [];
  /** 0..1 – how wild the crowd is right now */
  excitement = 0.12;
  /** which side the crowd is cheering for (-1 none, 0 left, 1 right) */
  cheerSide = -1;

  constructor() {
    this.buildFans();
  }

  build(scale: number): void {
    const m = BG_MARGIN;
    this.bg = makeCanvas((W + m * 2) * scale, (H + m * 2) * scale);
    const g = this.bg.getContext('2d')!;
    g.setTransform(scale, 0, 0, scale, m * scale, m * scale);
    this.drawSky(g);
    this.drawStructure(g);
    this.drawGrass(g);

    this.lights = makeCanvas((W + m * 2) * scale, (H + m * 2) * scale);
    const l = this.lights.getContext('2d')!;
    l.setTransform(scale, 0, 0, scale, m * scale, m * scale);
    this.drawLightLayer(l);

    this.buildSprites(Math.min(3, scale * 1.5));
  }

  // ---------------------------------------------------------------- crowd

  private buildFans(): void {
    const rnd = mulberry32(1337);
    this.fans = [];
    const rows: Array<{ y: number; s: number }> = [];
    for (let i = 0; i < 6; i++) rows.push({ y: 128 + i * 20, s: 0.68 + i * 0.02 });
    for (let i = 0; i < 8; i++) rows.push({ y: 296 + i * 21, s: 0.84 + i * 0.022 });
    for (const row of rows) {
      const step = 17 * row.s + 2;
      for (let x = 6 + rnd() * 8; x < W - 4; x += step + rnd() * 6) {
        if (rnd() < 0.07) continue; // empty seat
        const side = x < W / 2 - 40 ? 0 : x > W / 2 + 40 ? 1 : 2;
        this.fans.push({
          x,
          y: row.y + rnd() * 3,
          s: row.s * (0.92 + rnd() * 0.16),
          sprite: side * 12 + Math.floor(rnd() * 12),
          phase: rnd() * Math.PI * 2,
          speed: 5 + rnd() * 5,
          jumpy: 0.5 + rnd() * 0.8,
          seed: rnd(),
        });
      }
    }
  }

  private buildSprites(res: number): void {
    this.sprites = [];
    this.spritesUp = [];
    const rnd = mulberry32(99);
    for (let side = 0; side < 3; side++) {
      for (let i = 0; i < 12; i++) {
        const pal = side === 0 ? LEFT_SHIRTS : side === 1 ? RIGHT_SHIRTS : NEUTRAL;
        const shirt = rnd() < 0.8 ? pal[Math.floor(rnd() * pal.length)] : NEUTRAL[Math.floor(rnd() * NEUTRAL.length)];
        const skin = SKIN[Math.floor(rnd() * SKIN.length)];
        const hair = ['#2b1d12', '#5a3a1f', '#e8c46a', '#1a1a1a', '#b5502b', '#d9d9d9'][Math.floor(rnd() * 6)];
        const hat = rnd() < 0.25 ? pal[Math.floor(rnd() * pal.length)] : null;
        this.sprites.push(this.drawFanSprite(res, shirt, skin, hair, hat, false));
        this.spritesUp.push(this.drawFanSprite(res, shirt, skin, hair, hat, true));
      }
    }
  }

  private drawFanSprite(
    res: number,
    shirt: string,
    skin: string,
    hair: string,
    hat: string | null,
    armsUp: boolean,
  ): HTMLCanvasElement {
    const w = 26;
    const h = 40;
    const c = makeCanvas(w * res, h * res);
    const g = c.getContext('2d')!;
    g.scale(res, res);
    g.lineWidth = 1.6;
    g.strokeStyle = 'rgba(10,8,25,0.9)';
    // arms
    if (armsUp) {
      g.strokeStyle = shirt;
      g.lineWidth = 3.4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(7, 26);
      g.lineTo(3, 10);
      g.moveTo(19, 26);
      g.lineTo(23, 10);
      g.stroke();
      g.fillStyle = skin;
      g.beginPath();
      g.arc(3, 9, 2.4, 0, Math.PI * 2);
      g.arc(23, 9, 2.4, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(10,8,25,0.9)';
      g.lineWidth = 1.6;
    }
    // body
    g.fillStyle = shirt;
    roundRect(g, 5, 22, 16, 18, 6);
    g.fill();
    g.stroke();
    // head
    g.fillStyle = skin;
    g.beginPath();
    g.arc(13, 16, 6.6, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // hair / hat
    g.fillStyle = hat ?? hair;
    g.beginPath();
    g.arc(13, 15, 6.8, Math.PI * 1.05, Math.PI * 1.95);
    g.closePath();
    g.fill();
    if (hat) {
      g.fillRect(12, 6.5, 2, 3);
    }
    // eyes
    g.fillStyle = '#16122b';
    g.fillRect(10.5, 16, 1.6, 1.8);
    g.fillRect(14, 16, 1.6, 1.8);
    return c;
  }

  update(dt: number): void {
    this.excitement += (0.12 - this.excitement) * Math.min(1, dt * 0.35);
  }

  drawCrowd(ctx: CanvasRenderingContext2D, t: number): void {
    const e = this.excitement;
    for (const f of this.fans) {
      const side = f.sprite < 12 ? 0 : f.sprite < 24 ? 1 : -1;
      const cheering = this.cheerSide === -1 || side === this.cheerSide || side === -1;
      const energy = cheering ? e : e * 0.15;
      const amp = (0.6 + energy * 9) * f.jumpy;
      const bob = Math.abs(Math.sin(t * f.speed * (0.4 + energy * 0.7) + f.phase)) * amp;
      const up = energy > 0.45 && f.seed < energy;
      const spr = up ? this.spritesUp[f.sprite] : this.sprites[f.sprite];
      const w = 26 * f.s;
      const h = 40 * f.s;
      ctx.drawImage(spr, f.x - w / 2, f.y - h - bob, w, h);
    }
  }

  // ---------------------------------------------------------------- static layers

  private drawSky(g: CanvasRenderingContext2D): void {
    const m = BG_MARGIN;
    const sky = g.createLinearGradient(0, -m, 0, 320);
    sky.addColorStop(0, '#050722');
    sky.addColorStop(0.5, '#141a4a');
    sky.addColorStop(1, '#2b1f5e');
    g.fillStyle = sky;
    g.fillRect(-m, -m, W + m * 2, H + m * 2);
    const rnd = mulberry32(7);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      const s = rnd() * 1.6 + 0.4;
      g.fillRect(rnd() * W, rnd() * 100 - m, s, s);
    }
  }

  private drawStructure(g: CanvasRenderingContext2D): void {
    const m = BG_MARGIN;
    // roof silhouette
    g.fillStyle = '#0d0f2a';
    g.beginPath();
    g.moveTo(-m, 104);
    g.lineTo(-m, 70);
    g.quadraticCurveTo(W / 2, 46, W + m, 70);
    g.lineTo(W + m, 104);
    g.closePath();
    g.fill();
    // roof truss lines
    g.strokeStyle = 'rgba(120,130,220,0.18)';
    g.lineWidth = 1.5;
    for (let x = -20; x < W + 20; x += 40) {
      g.beginPath();
      g.moveTo(x, 70);
      g.lineTo(x + 20, 100);
      g.lineTo(x + 40, 70);
      g.stroke();
    }

    // stands back walls
    const upper = g.createLinearGradient(0, 100, 0, 252);
    upper.addColorStop(0, '#1a1840');
    upper.addColorStop(1, '#2a2660');
    g.fillStyle = upper;
    g.fillRect(-m, 100, W + m * 2, 152);
    const lower = g.createLinearGradient(0, 270, 0, 458);
    lower.addColorStop(0, '#24224f');
    lower.addColorStop(1, '#3a3478');
    g.fillStyle = lower;
    g.fillRect(-m, 270, W + m * 2, 188);

    // seat rows
    for (let i = 0; i < 7; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
      g.fillRect(-m, 112 + i * 20, W + m * 2, 10);
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.12)';
      g.fillRect(-m, 280 + i * 21, W + m * 2, 10);
    }
    // aisles (stairs)
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (const ax of [210, 640, 1070]) {
      g.fillRect(ax - 9, 100, 18, 152);
      g.fillRect(ax - 11, 270, 22, 188);
    }

    // concourse band between tiers
    const band = g.createLinearGradient(0, 248, 0, 274);
    band.addColorStop(0, '#4a4590');
    band.addColorStop(1, '#2b2862');
    g.fillStyle = band;
    g.fillRect(-m, 248, W + m * 2, 24);
    g.fillStyle = '#ffd23f';
    g.globalAlpha = 0.85;
    g.fillRect(-m, 254, W + m * 2, 3);
    g.globalAlpha = 1;
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let x = 0; x < W; x += 64) g.fillRect(x, 260, 30, 6);

    // light tower structures
    for (const lamp of LAMPS) {
      g.fillStyle = '#0b0c22';
      g.fillRect(lamp.x - 5, lamp.y + 18, 10, 120);
      g.fillStyle = '#1d1f45';
      roundRect(g, lamp.x - 40, lamp.y - 20, 80, 40, 6);
      g.fill();
      g.strokeStyle = '#3c3f86';
      g.lineWidth = 2;
      g.stroke();
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 4; c++) {
          g.fillStyle = '#fffbe6';
          g.beginPath();
          g.arc(lamp.x - 27 + c * 18, lamp.y - 8 + r * 16, 6, 0, Math.PI * 2);
          g.fill();
        }
      }
    }

    // ad boards frame
    g.fillStyle = '#07070f';
    g.fillRect(-m, 456, W + m * 2, 46);
    g.fillStyle = '#1b1b30';
    g.fillRect(-m, 456, W + m * 2, 4);
    g.fillRect(-m, 498, W + m * 2, 4);
    for (let x = 0; x <= W; x += W / 6) {
      g.fillStyle = '#1b1b30';
      g.fillRect(x - 2, 456, 4, 46);
    }
  }

  private drawGrass(g: CanvasRenderingContext2D): void {
    const m = BG_MARGIN;
    const top = GRASS_TOP;
    const bottom = H + m;
    const base = g.createLinearGradient(0, top, 0, bottom);
    base.addColorStop(0, '#2f8f3a');
    base.addColorStop(0.45, '#3fae45');
    base.addColorStop(1, '#2a7d33');
    g.fillStyle = base;
    g.fillRect(-m, top, W + m * 2, bottom - top);

    // perspective mowing stripes
    const stripes = 16;
    const farK = 0.86;
    const sw = (W + m * 2) / stripes;
    for (let i = 0; i < stripes; i++) {
      if (i % 2) continue;
      const x0 = -m + i * sw;
      const x1 = x0 + sw;
      const f0 = W / 2 + (x0 - W / 2) * farK;
      const f1 = W / 2 + (x1 - W / 2) * farK;
      g.fillStyle = 'rgba(255,255,255,0.055)';
      g.beginPath();
      g.moveTo(f0, top);
      g.lineTo(f1, top);
      g.lineTo(x1 + (x1 - W / 2) * 0.12, bottom);
      g.lineTo(x0 + (x0 - W / 2) * 0.12, bottom);
      g.closePath();
      g.fill();
    }

    // grass speckles
    const rnd = mulberry32(42);
    for (let i = 0; i < 2600; i++) {
      const y = top + rnd() * (bottom - top);
      const x = rnd() * W;
      g.fillStyle = rnd() < 0.5 ? 'rgba(20,70,25,0.35)' : 'rgba(160,240,140,0.12)';
      g.fillRect(x, y, 1.2, 2.5 + rnd() * 2);
    }

    // field markings
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-m, top + 10);
    g.lineTo(W + m, top + 10);
    g.stroke();
    g.beginPath();
    g.moveTo(W / 2, top + 10);
    g.lineTo(W / 2, bottom);
    g.stroke();
    g.beginPath();
    g.ellipse(W / 2, GROUND_Y - 12, 128, 48, 0, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.beginPath();
    g.ellipse(W / 2, GROUND_Y - 12, 6, 3, 0, 0, Math.PI * 2);
    g.fill();
    // penalty areas
    for (const side of [0, 1]) {
      const dir = side === 0 ? 1 : -1;
      const gx = side === 0 ? 0 : W;
      g.beginPath();
      g.moveTo(gx, top + 34);
      g.lineTo(gx + dir * 250, top + 34);
      g.lineTo(gx + dir * 270, 708);
      g.lineTo(gx, 708);
      g.stroke();
      g.beginPath();
      g.ellipse(gx + dir * 180, GROUND_Y - 6, 4, 2.5, 0, 0, Math.PI * 2);
      g.fill();
    }

    // dark near edge for depth
    const near = g.createLinearGradient(0, 660, 0, bottom);
    near.addColorStop(0, 'rgba(0,0,0,0)');
    near.addColorStop(1, 'rgba(0,10,0,0.45)');
    g.fillStyle = near;
    g.fillRect(-m, 660, W + m * 2, bottom - 660);
    // board shadow on the far grass
    const sh = g.createLinearGradient(0, top, 0, top + 30);
    sh.addColorStop(0, 'rgba(0,0,0,0.4)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = sh;
    g.fillRect(-m, top, W + m * 2, 30);
  }

  private drawLightLayer(g: CanvasRenderingContext2D): void {
    // soft beams, drawn additively over the crowd and the pitch
    for (const lamp of LAMPS) {
      const grad = g.createLinearGradient(lamp.x, lamp.y, lamp.aimX, GROUND_Y);
      grad.addColorStop(0, 'rgba(255,250,220,0.16)');
      grad.addColorStop(1, 'rgba(255,250,220,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(lamp.x - 30, lamp.y);
      g.lineTo(lamp.x + 30, lamp.y);
      g.lineTo(lamp.aimX + 300, GROUND_Y + 40);
      g.lineTo(lamp.aimX - 300, GROUND_Y + 40);
      g.closePath();
      g.fill();
      const glow = g.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 120);
      glow.addColorStop(0, 'rgba(255,250,225,0.85)');
      glow.addColorStop(0.2, 'rgba(255,240,200,0.35)');
      glow.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = glow;
      g.fillRect(lamp.x - 120, lamp.y - 120, 240, 240);
    }
    // pool of light on the pitch
    const pool = g.createRadialGradient(W / 2, GROUND_Y, 40, W / 2, GROUND_Y, 700);
    pool.addColorStop(0, 'rgba(255,255,230,0.12)');
    pool.addColorStop(1, 'rgba(255,255,230,0)');
    g.fillStyle = pool;
    g.fillRect(0, GRASS_TOP, W, H - GRASS_TOP);
  }

  // ---------------------------------------------------------------- per frame

  drawBackground(ctx: CanvasRenderingContext2D): void {
    const m = BG_MARGIN;
    ctx.drawImage(this.bg, -m, -m, W + m * 2, H + m * 2);
  }

  drawLights(ctx: CanvasRenderingContext2D): void {
    const m = BG_MARGIN;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(this.lights, -m, -m, W + m * 2, H + m * 2);
    ctx.restore();
  }

  drawBoards(ctx: CanvasRenderingContext2D, t: number): void {
    const segW = W / 6;
    ctx.save();
    ctx.font = `20px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (let i = 0; i < 6; i++) {
      const x0 = i * segW + 3;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, 460, segW - 6, 38);
      ctx.clip();
      const ad = ADS[(((i + Math.floor(t / 6)) % ADS.length) + ADS.length) % ADS.length];
      ctx.fillStyle = '#0d0d1c';
      ctx.fillRect(x0, 460, segW - 6, 38);
      const slide = ((t / 6) % 1) * 6; // 0..6 s
      const off = slide < 0.4 ? (1 - slide / 0.4) * 40 : 0;
      ctx.shadowColor = ad.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = ad.color;
      ctx.fillText(tx(ad.text), x0 + (segW - 6) / 2, 480 + off);
      ctx.restore();
    }
    ctx.restore();
  }
}
