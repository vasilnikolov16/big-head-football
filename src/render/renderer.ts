import { FONT_DISPLAY, FONT_TEXT, H, INK, SCREEN, W } from '../core/constants';
import { clamp, easeOutBack, lerp } from '../core/math';
import { t as tx } from '../i18n/i18n';
import { drawBall, drawBallShadow } from './ballDraw';
import { EMOTE_TIME, Fx } from './fx';
import { drawCrossbar, drawGoalBack } from './goals';
import { drawBanner, drawHud } from './hud';
import { drawPlayer, drawPlayerShadow } from './playerDraw';
import { drawPowerItems } from './powerDraw';
import { Stadium } from './stadium';
import { SuperFx } from './superFx';
import type { RenderView } from './view';

export interface RenderOptions {
  /** scoreboard + banners (hidden for the menu background match) */
  hud: boolean;
  /** seconds into a slow-motion replay, or null */
  replayT?: number | null;
  /** replay data: super glow colour of the current frame */
  replayGlow?: string | null;
  /** online: ping in the corner and a centred note ("waiting for…") */
  net?: { ping: number | null; note: string | null };
}

/** How far (world units) the stadium may continue past the pitch on each side before the rest is letterboxed. */
const MAX_EXTRA_X = 380;
const MAX_EXTRA_Y = 170;

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly stadium = new Stadium();
  readonly fx = new Fx(this.stadium);
  readonly superFx = new SuperFx();
  private lastDt = 0;
  scale = 1;
  cssScale = 1;
  /** world units shown left of / above the pitch */
  ox = 0;
  oy = 0;
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
    // iOS reports the new size a moment after rotating
    window.addEventListener('orientationchange', () => window.setTimeout(() => this.resize(), 250));
    window.visualViewport?.addEventListener('resize', () => this.resize());
  }

  private lastSize = '';
  /** highest device-pixel ratio to render at (settings: quality) */
  private maxDpr = 2;

  setMaxDpr(v: number): void {
    if (v === this.maxDpr) return;
    this.maxDpr = v;
    this.lastSize = '';
    this.resize();
  }

  resize(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    // a window with no size yet (app still opening, hidden tab): try again on the next frame
    if (!(vw > 1 && vh > 1)) {
      this.lastSize = '';
      return;
    }
    const key = `${vw}x${vh}@${dpr}`;
    if (key === this.lastSize) return;
    this.lastSize = key;
    // the whole pitch always fits; the stadium fills the rest of the screen
    const s = Math.min(vw / W, vh / H);
    const ox = Math.min(MAX_EXTRA_X, Math.max(0, (vw / s - W) / 2));
    const oy = Math.min(MAX_EXTRA_Y, Math.max(0, (vh / s - H) / 2));
    const lw = W + ox * 2;
    const lh = H + oy * 2;
    const cssW = Math.min(vw, Math.round(lw * s));
    const cssH = Math.min(vh, Math.round(lh * s));
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    const stage = this.canvas.parentElement!;
    stage.style.width = `${cssW}px`;
    stage.style.height = `${cssH}px`;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.scale = this.canvas.width / lw;
    this.cssScale = s;
    this.ox = ox;
    this.oy = oy;
    SCREEN.x = -ox;
    SCREEN.y = -oy;
    SCREEN.w = lw;
    SCREEN.h = lh;
    // The UI layer is authored in logical units (the pitch is 1280x720) and scaled as a whole;
    // it covers the whole screen, so menus and touch buttons can use the extra room.
    this.ui.style.width = `${lw}px`;
    this.ui.style.height = `${lh}px`;
    this.ui.style.transformOrigin = '0 0';
    this.ui.style.transform = `scale(${s})`;
    this.ui.style.setProperty('--ui-scale', String(s));
    this.stadium.build(this.scale, ox, oy);
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

  render(m: RenderView, alpha: number, t: number, opts: RenderOptions): void {
    if (!this.lastSize) this.resize();
    const ctx = this.ctx;
    const fx = this.fx;
    const replay = opts.replayT != null;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // world transform + screen shake
    const sx = fx.shake > 0 ? (Math.random() * 2 - 1) * fx.shake : 0;
    const sy = fx.shake > 0 ? (Math.random() * 2 - 1) * fx.shake * 0.7 : 0;
    const k = this.scale;
    ctx.setTransform(k, 0, 0, k, (this.ox + sx) * k, (this.oy + sy) * k);

    // super-shot cinematic: zoom the camera on the shooter
    const cin = fx.cinematic;
    let focusX = 0;
    let focusY = 0;
    if (cin.active) {
      const sp = m.players[cin.side];
      focusX = lerp(sp.px, sp.x, alpha);
      focusY = sp.headY + (lerp(sp.py, sp.y, alpha) - sp.y);
      const z = cin.zoom();
      ctx.translate(focusX, focusY);
      ctx.scale(z, z);
      ctx.translate(-focusX, -focusY);
    }

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
    const hidden = (m.superShot?.hidden ?? false) || (b as { hiddenInReplay?: boolean }).hiddenInReplay === true;
    const br = b.r * sfx.ballScale(m);
    fx.trackBall(bx, by, Math.hypot(b.vx, b.vy) || (replay ? this.replaySpeed(bx, by) : 0), !hidden);
    this.lastDt = 0;

    drawPlayerShadow(ctx, m.players[0], alpha);
    drawPlayerShadow(ctx, m.players[1], alpha);
    if (!hidden) drawBallShadow(ctx, bx, by, br);

    drawPowerItems(ctx, m.powerups.items, alpha, t);
    this.drawArmBursts(ctx, m, t, true);
    drawPlayer(ctx, m.players[0], alpha, t);
    drawPlayer(ctx, m.players[1], alpha, t);
    this.drawArmBursts(ctx, m, t, false);

    const fire = b.fireT > 0;
    const glow = opts.replayGlow ?? null;
    fx.drawTrail(ctx, br, fire ? '#ff7a1f' : glow ?? '#ffffff');
    sfx.drawBack(ctx, t);
    sfx.drawDecoys(ctx, m, alpha);
    if (!hidden) {
      if (fire) this.drawFireAura(ctx, bx, by, br, t);
      if (glow) this.drawGlow(ctx, bx, by, br, glow);
      drawBall(ctx, bx, by, br, ba);
    }
    sfx.drawFront(ctx, m, bx, by, br, t);
    fx.particles.draw(ctx);
    this.drawEmotes(ctx, m, alpha);

    drawCrossbar(ctx, 0, m.arena, fx.barFlash[0]);
    drawCrossbar(ctx, 1, m.arena, fx.barFlash[1]);
    if (cin.active) cin.drawWorld(ctx, focusX, focusY, t);

    // HUD does not shake
    ctx.setTransform(k, 0, 0, k, this.ox * k, this.oy * k);
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,240,${fx.flash * 0.55})`;
      ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
    }
    if (replay) this.drawReplayOverlay(ctx, opts.replayT ?? 0);
    else if (opts.hud) {
      if (!cin.active) sfx.drawCallout(ctx, m);
      drawHud(ctx, m, t);
      if (m.banner) drawBanner(ctx, m.banner);
    }
    cin.drawScreen(ctx, t);
    if (opts.net) this.drawNet(ctx, opts.net, t);

    if (this.showFps) {
      ctx.font = `14px ${FONT_TEXT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = this.fps >= 58 ? '#7cff6b' : '#ff6b6b';
      ctx.fillText(`${this.fps.toFixed(0)} FPS`, 10, H - 24);
    }
  }

  /** Rings collapsing into the player + a light pillar when the super is armed. */
  private drawArmBursts(ctx: CanvasRenderingContext2D, m: RenderView, t: number, behind: boolean): void {
    for (const b of this.fx.armBursts) {
      const p = m.players[b.player];
      const k = b.t / 0.7;
      const cx = p.x;
      const cy = p.headY;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      if (behind) {
        // pillar of light
        const w = 120 * (1 - k * 0.6);
        const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
        g.addColorStop(0, b.color + '00');
        g.addColorStop(0.5, b.color + 'aa');
        g.addColorStop(1, b.color + '00');
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = g;
        ctx.fillRect(cx - w / 2, -20, w, p.y + 20);
      } else {
        for (let i = 0; i < 3; i++) {
          const rk = clamp(k * 1.4 - i * 0.18, 0, 1);
          if (rk <= 0 || rk >= 1) continue;
          ctx.strokeStyle = i === 1 ? '#ffffff' : b.color;
          ctx.globalAlpha = rk;
          ctx.lineWidth = 6 * (1 - rk) + 2;
          ctx.beginPath();
          ctx.arc(cx, cy, (1 - rk) * 170 + p.headR * 0.8, 0, Math.PI * 2);
          ctx.stroke();
        }
        void t;
      }
      ctx.restore();
    }
  }

  /** Speech bubbles with an emoji above the players (online). */
  private drawEmotes(ctx: CanvasRenderingContext2D, m: RenderView, alpha: number): void {
    for (const e of this.fx.emotes) {
      const p = m.players[e.player];
      if (!p) continue;
      const x = lerp(p.px, p.x, alpha);
      const y = p.headY + (lerp(p.py, p.y, alpha) - p.y) - p.headR - 46 - Math.min(1, e.t / 0.3) * 8;
      const pop = easeOutBack(clamp(e.t / 0.28, 0, 1));
      const fade = clamp((EMOTE_TIME - e.t) / 0.35, 0, 1);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(x, y);
      ctx.scale(pop, pop);
      ctx.rotate(Math.sin(e.t * 9) * 0.06 * (1 - clamp(e.t, 0, 1)));
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-32, -28, 64, 54, 18);
      ctx.moveTo(-8, 25);
      ctx.lineTo(0, 38);
      ctx.lineTo(8, 25);
      ctx.fill();
      ctx.stroke();
      // hide the stroke between the tail and the bubble
      ctx.fillRect(-7, 21, 14, 6);
      ctx.font = `34px ${EMOJI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = INK;
      ctx.fillText(e.icon, 0, 1);
      ctx.restore();
    }
  }

  /** Ping pill (top-right) and the "waiting for…" note. */
  private drawNet(ctx: CanvasRenderingContext2D, net: { ping: number | null; note: string | null }, t: number): void {
    if (net.ping !== null) {
      const ms = Math.round(net.ping);
      const color = ms < 90 ? '#7cff6b' : ms < 160 ? '#ffd23f' : '#ff6b6b';
      ctx.save();
      ctx.font = `14px ${FONT_TEXT}`;
      const label = `${ms} ms`;
      const w = ctx.measureText(label).width + 38;
      const x = W - w - 14;
      const y = 14;
      ctx.fillStyle = 'rgba(12,10,32,0.7)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, 24, 12);
      ctx.fill();
      // signal bars
      for (let i = 0; i < 3; i++) {
        const on = i === 0 || (i === 1 && ms < 160) || (i === 2 && ms < 90);
        ctx.fillStyle = on ? color : 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + 10 + i * 6, y + 16 - (i + 1) * 3.5, 4, (i + 1) * 3.5);
      }
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 32, y + 12.5);
      ctx.restore();
    }
    if (net.note) {
      ctx.save();
      ctx.fillStyle = 'rgba(5,4,20,0.45)';
      ctx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h);
      ctx.font = `30px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const dots = '.'.repeat(1 + (Math.floor(t * 3) % 3));
      const text = net.note.replace(/…$/, '') + dots;
      const w = ctx.measureText(net.note).width + 90;
      ctx.fillStyle = 'rgba(12,10,32,0.92)';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(W / 2 - w / 2, H / 2 - 36, w, 72, 20);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, W / 2, H / 2 + 2);
      ctx.restore();
    }
  }

  private lastReplayPos: { x: number; y: number } | null = null;
  /** speed estimate from positions (replay frames carry no velocity) */
  private replaySpeed(x: number, y: number): number {
    const l = this.lastReplayPos;
    this.lastReplayPos = { x, y };
    if (!l) return 0;
    return Math.hypot(x - l.x, y - l.y) * 120;
  }

  private drawFireAura(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
    g.addColorStop(0, 'rgba(255,170,40,0.85)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + t * 6;
      const len = r * (1.2 + 0.5 * Math.sin(t * 25 + i * 2));
      ctx.fillStyle = i % 2 ? 'rgba(255,90,20,0.8)' : 'rgba(255,210,60,0.8)';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.35) * r * 0.8, y + Math.sin(a - 0.35) * r * 0.8);
      ctx.lineTo(x + Math.cos(a) * (r + len), y + Math.sin(a) * (r + len) - 6);
      ctx.lineTo(x + Math.cos(a + 0.35) * r * 0.8, y + Math.sin(a + 0.35) * r * 0.8);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.4);
    g.addColorStop(0, color + 'aa');
    g.addColorStop(1, color + '00');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Cinema bars, "ПОВТОРЕНИЕ" badge, film grain lines. */
  private drawReplayOverlay(ctx: CanvasRenderingContext2D, t: number): void {
    const bar = Math.min(1, t / 0.3) * 62;
    const S = SCREEN;
    ctx.fillStyle = '#000000';
    ctx.fillRect(S.x, S.y, S.w, bar - S.y);
    ctx.fillRect(S.x, H - bar, S.w, bar + S.y + S.h - H);
    // subtle sepia-ish tint
    ctx.fillStyle = 'rgba(40,30,80,0.12)';
    ctx.fillRect(S.x, bar, S.w, H - bar * 2);
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = `30px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    const blink = Math.sin(t * 6) > -0.3;
    if (blink) {
      ctx.fillStyle = '#ff3b4f';
      ctx.beginPath();
      ctx.arc(46, bar / 2, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tx('replay.title'), 66, bar / 2 + 2);
    ctx.font = `16px ${FONT_TEXT}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(tx('replay.skip'), W - 30, H - bar / 2);
    ctx.font = `18px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('SLOW-MO', W - 30, bar / 2 + 2);
    ctx.restore();
    ctx.strokeStyle = INK;
  }
}
