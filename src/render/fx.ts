import { GROUND_Y } from '../core/constants';
import type { Match } from '../game/match';
import { SUPER_INFO } from '../game/supers';
import type { NetState } from './goals';
import { SuperCinematic } from './cinematic';
import { Particles } from './particles';
import type { Stadium } from './stadium';

export const EMOTE_TIME = 2.2;

interface TrailPt {
  x: number;
  y: number;
}

/**
 * Presentation-only "game feel" driven by match events: screen shake, hit-stop
 * requests, particles, ball trail, goal flash, net wobble, crowd reactions.
 */
export class Fx {
  shake = 0;
  /** seconds of hit-stop requested; the game loop consumes it */
  hitStop = 0;
  flash = 0;
  nets: [NetState | null, NetState | null] = [null, null];
  barFlash: [number, number] = [0, 0];
  readonly particles = new Particles();
  trail: TrailPt[] = [];
  readonly cinematic = new SuperCinematic();
  /** power-up bursts when a player arms the super shot */
  armBursts: Array<{ player: number; t: number; color: string }> = [];
  /** online emote bubbles above the players */
  emotes: Array<{ player: number; icon: string; t: number }> = [];
  private unsub: Array<() => void> = [];

  constructor(private stadium: Stadium) {}

  /** cinematic: play the super-shot cut-in (off for the silent menu demo) */
  attach(m: Match, cinematic = true): void {
    this.detach();
    this.nets = [null, null];
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.trail = [];
    this.armBursts = [];
    this.emotes = [];
    this.particles.clear();
    const st = this.stadium;
    const ev = m.events;
    this.unsub.push(
      ev.on('goal', (e) => {
        const side = e.scorer === 0 ? 1 : 0;
        this.nets[side] = { push: 1, y: e.y, t: 0 };
        this.addShake(16);
        this.flash = 0.7;
        this.hitStop = Math.max(this.hitStop, 0.16);
        this.particles.confetti(side);
        this.particles.sparks(e.x, e.y, 30, '#ffe680', 700);
        st.excitement = 1;
        st.cheerSide = e.scorer;
      }),
      ev.on('kick', (e) => {
        const perfect = e.sweet > 0.75;
        this.addShake(perfect ? 7 : 2 + 3 * e.sweet);
        this.particles.sparks(e.x, e.y, perfect ? 16 : 6, perfect ? '#ffd23f' : '#ffffff', perfect ? 650 : 380);
        if (perfect) this.hitStop = Math.max(this.hitStop, 0.07);
        if (e.y > GROUND_Y - 60) this.particles.grass(e.x, perfect ? 1 : 0.5);
      }),
      ev.on('header', (e) => {
        if (e.speed > 500) this.particles.sparks(e.x, e.y, 5, '#ffffff', 300);
      }),
      ev.on('bounce', (e) => {
        if (e.surface === 'bar') {
          const side = e.x < 640 ? 0 : 1;
          this.barFlash[side] = Math.min(1, e.speed / 900);
          this.addShake(Math.min(9, e.speed / 110));
          this.particles.sparks(e.x, e.y - 10, 10, '#ffffff', 420);
          if (e.speed > 500) {
            this.hitStop = Math.max(this.hitStop, 0.05);
            st.excitement = Math.max(st.excitement, 0.7); // "ooooh!"
          }
        } else if (e.surface === 'ground' && e.speed > 380) {
          this.particles.grass(e.x, Math.min(1, e.speed / 1200));
        }
      }),
      ev.on('land', (e) => {
        if (e.force > 1100) this.addShake(2);
        this.particles.dust(e.x, Math.min(1, e.force / 1500));
      }),
      ev.on('jump', (e) => this.particles.dust(e.x, 0.3)),
      ev.on('superShot', (e) => {
        const color = SUPER_INFO[e.id as keyof typeof SUPER_INFO]?.color ?? '#ffffff';
        this.addShake(12);
        this.particles.sparks(e.x, e.y, 40, color, 900);
        this.particles.stars(e.x, e.y, 14, color);
        if (cinematic) this.cinematic.start(e.player as 0 | 1, m.players[e.player].char);
        st.excitement = Math.max(st.excitement, 0.8);
      }),
      ev.on('superArmed', (e) => {
        const p = m.players[e.player];
        const color = SUPER_INFO[p.char.super].color;
        this.armBursts.push({ player: e.player, t: 0, color });
        this.particles.stars(p.headX, p.headY, 10, color);
        this.particles.sparks(p.x, p.y - 40, 18, color, 500);
        this.addShake(4);
      }),
      ev.on('superHit', (e) => {
        this.addShake(6);
        this.particles.stars(e.x, e.y, 6, '#ffe14d');
      }),
      ev.on('powerPick', (e) => {
        this.particles.stars(e.x, e.y, 12, e.color);
        this.particles.sparks(e.x, e.y, 14, e.color, 420);
      }),
    );
  }

  detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  /** show an emote bubble above a player (replaces their previous one) */
  emote(player: number, icon: string): void {
    this.emotes = this.emotes.filter((e) => e.player !== player);
    this.emotes.push({ player, icon, t: 0 });
  }

  addShake(a: number): void {
    this.shake = Math.min(22, Math.max(this.shake, a));
  }

  /** Record the ball position for the motion trail. */
  trackBall(x: number, y: number, speed: number, visible: boolean): void {
    if (!visible || speed < 650) {
      if (this.trail.length) this.trail.shift();
      if (this.trail.length) this.trail.shift();
      return;
    }
    this.trail.push({ x, y });
    if (this.trail.length > 10) this.trail.shift();
  }

  drawTrail(ctx: CanvasRenderingContext2D, r: number, color: string): void {
    const tr = this.trail;
    const n = tr.length;
    if (n < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (let i = 1; i < n; i++) {
      const k = i / n;
      ctx.strokeStyle = color;
      ctx.globalAlpha = k * 0.45;
      ctx.lineWidth = r * 1.7 * k;
      ctx.beginPath();
      ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
      ctx.lineTo(tr[i].x, tr[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 40);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.cinematic.update(dt);
    for (const b of this.armBursts) b.t += dt;
    this.armBursts = this.armBursts.filter((b) => b.t < 0.7);
    for (const e of this.emotes) e.t += dt;
    this.emotes = this.emotes.filter((e) => e.t < EMOTE_TIME);
    this.particles.update(dt);
    for (let i = 0; i < 2; i++) {
      const n = this.nets[i];
      if (n) {
        n.t += dt;
        n.push = Math.max(0, 1 - n.t / 1.4);
        if (n.push <= 0) this.nets[i] = null;
      }
      this.barFlash[i] = Math.max(0, this.barFlash[i] - dt * 4);
    }
    if (this.stadium.excitement < 0.3) this.stadium.cheerSide = -1;
  }
}
