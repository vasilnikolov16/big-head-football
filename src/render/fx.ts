import type { Match } from '../game/match';
import type { NetState } from './goals';

/**
 * Presentation-only effects driven by match events (screen shake, net wobble,
 * crossbar flash). Particles, trails and hit-stop are added in a later stage.
 */
export class Fx {
  shake = 0;
  nets: [NetState | null, NetState | null] = [null, null];
  barFlash: [number, number] = [0, 0];
  private unsub: Array<() => void> = [];

  attach(m: Match): void {
    this.detach();
    this.nets = [null, null];
    this.shake = 0;
    const ev = m.events;
    this.unsub.push(
      ev.on('goal', (e) => {
        const side = e.scorer === 0 ? 1 : 0;
        this.nets[side] = { push: 1, y: e.y, t: 0 };
        this.addShake(14);
      }),
      ev.on('kick', (e) => this.addShake(2 + 5 * e.sweet)),
      ev.on('bounce', (e) => {
        if (e.surface === 'bar') {
          const side = e.x < 640 ? 0 : 1;
          this.barFlash[side] = Math.min(1, e.speed / 900);
          this.addShake(Math.min(8, e.speed / 120));
        }
      }),
      ev.on('land', (e) => {
        if (e.force > 1100) this.addShake(2);
      }),
    );
  }

  detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  addShake(a: number): void {
    this.shake = Math.min(22, Math.max(this.shake, a));
  }

  update(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 40);
    for (let i = 0; i < 2; i++) {
      const n = this.nets[i];
      if (n) {
        n.t += dt;
        n.push = Math.max(0, 1 - n.t / 1.4);
        if (n.push <= 0) this.nets[i] = null;
      }
      this.barFlash[i] = Math.max(0, this.barFlash[i] - dt * 4);
    }
  }
}
