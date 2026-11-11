import { FONT_TEXT, H, W } from '../core/constants';
import { lerp } from '../core/math';
import type { Match } from '../game/match';
import { drawBall, drawBallShadow } from './ballDraw';
import { Fx } from './fx';
import { drawCrossbar, drawGoalBack } from './goals';
import { drawBanner, drawHud } from './hud';
import { drawPlayer, drawPlayerShadow } from './playerDraw';
import { Stadium } from './stadium';
import { SuperFx } from './superFx';

export interface RenderOptions {
  /** scoreboard + banners (hidden for the menu background match) */
  hud: boolean;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly stadium = new Stadium();
  readonly fx = new Fx();
  readonly superFx = new SuperFx();
  private lastDt = 0;
  scale = 1;
  cssScale = 1;
  showFps = false;
  private fps = 60;
  private fpsAcc = 0;
  private fpsFrames = 0;

  constructor(canvas: HTMLCanvasElement, private ui: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const cssW = Math.floor(W * s);
    const cssH = Math.floor(H * s);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const stage = this.canvas.parentElement!;
    stage.style.width = `${cssW}px`;
    stage.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / W;
    this.cssScale = s;
    // UI layer is authored in logical 1280x720 units and scaled as a whole.
    this.ui.style.width = `${W}px`;
    this.ui.style.height = `${H}px`;
    this.ui.style.transformOrigin = '0 0';
    this.ui.style.transform = `scale(${s})`;
    this.stadium.build(this.scale);
  }

  update(dtReal: number): void {
    this.lastDt = dtReal;
    this.fx.update(dtReal);
    this.stadium.update(dtReal);
    this.fpsAcc += dtReal;
    this.fpsFrames++;
    if (this.fpsAcc >= 0.5) {
      this.fps = this.fpsFrames / this.fpsAcc;
      this.fpsAcc = 0;
      this.fpsFrames = 0;
    }
  }

  get currentFps(): number {
    return this.fps;
  }

  render(m: Match, alpha: number, t: number, opts: RenderOptions): void {
    const ctx = this.ctx;
    const fx = this.fx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // world transform + screen shake
    const sx = fx.shake > 0 ? (Math.random() * 2 - 1) * fx.shake : 0;
    const sy = fx.shake > 0 ? (Math.random() * 2 - 1) * fx.shake * 0.7 : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, sx * this.scale, sy * this.scale);

    const st = this.stadium;
    st.drawBackground(ctx);
    st.drawCrowd(ctx, t);
    st.drawBoards(ctx, t);
    st.drawLights(ctx);

    drawGoalBack(ctx, 0, m.arena, fx.nets[0], t);
    drawGoalBack(ctx, 1, m.arena, fx.nets[1], t);

    const b = m.ball;
    const bx = lerp(b.px, b.x, alpha);
    const by = lerp(b.py, b.y, alpha);
    const ba = lerp(b.pangle, b.angle, alpha);

    const sfx = this.superFx;
    sfx.update(m, this.lastDt, bx, by);
    this.lastDt = 0;
    const hidden = m.superShot?.hidden ?? false;
    const br = b.r * sfx.ballScale(m);

    drawPlayerShadow(ctx, m.players[0], alpha);
    drawPlayerShadow(ctx, m.players[1], alpha);
    if (!hidden) drawBallShadow(ctx, bx, by, br);

    drawPlayer(ctx, m.players[0], alpha, t);
    drawPlayer(ctx, m.players[1], alpha, t);
    sfx.drawBack(ctx, t);
    sfx.drawDecoys(ctx, m, alpha);
    if (!hidden) drawBall(ctx, bx, by, br, ba);
    sfx.drawFront(ctx, m, bx, by, br, t);

    drawCrossbar(ctx, 0, m.arena, fx.barFlash[0]);
    drawCrossbar(ctx, 1, m.arena, fx.barFlash[1]);

    // HUD does not shake
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (opts.hud) {
      sfx.drawCallout(ctx, m);
      drawHud(ctx, m, t);
      if (m.banner) drawBanner(ctx, m.banner);
    }

    if (this.showFps) {
      ctx.font = `14px ${FONT_TEXT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = this.fps >= 58 ? '#7cff6b' : '#ff6b6b';
      ctx.fillText(`${this.fps.toFixed(0)} FPS`, 10, H - 24);
    }
  }
}
