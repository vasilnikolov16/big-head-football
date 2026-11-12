import type { Match } from '../game/match';
import type { AudioEngine, SuperSfx } from './audio';

/** Maps match events to sounds. */
export class GameAudio {
  private unsub: Array<() => void> = [];

  constructor(private audio: AudioEngine) {}

  attach(m: Match, quiet = false): void {
    this.detach();
    const a = this.audio;
    const ev = m.events;
    // the background demo in the menu only plays the important sounds, softly
    const v = quiet ? 0.35 : 1;
    this.unsub.push(
      ev.on('kick', (e) => a.play(e.sweet > 0.75 ? 'kickPerfect' : 'kick', (e.speed / 1400) * v)),
      ev.on('header', (e) => a.play('header', (e.speed / 900) * v)),
      ev.on('bounce', (e) => {
        if (e.surface === 'bar') a.play('post', (e.speed / 900) * v);
        else if (e.surface === 'ground') {
          if (e.speed > 160) a.play('bounce', (e.speed / 1000) * v);
        } else if (e.speed > 140) a.play('wall', (e.speed / 1000) * v);
      }),
      ev.on('jump', () => {
        if (!quiet) a.play('jump', 0.6);
      }),
      ev.on('dash', () => {
        if (!quiet) a.play('dash', 0.8);
      }),
      ev.on('clash', () => a.play('kickPerfect', 0.8 * v)),
      ev.on('bump', (e) => a.play('bump', (0.5 + e.force / 1600) * v)),
      ev.on('land', (e) => {
        if (!quiet && e.force > 500) a.play('land', e.force / 1600);
      }),
      ev.on('whistle', (e) => {
        if (quiet) return;
        a.play(e.kind === 'start' ? 'whistleStart' : e.kind === 'end' ? 'whistleEnd' : 'whistleGolden');
      }),
      ev.on('goal', () => a.play('goal', v)),
      ev.on('superArmed', (e) => {
        a.play('superArmed', 0.6 * v);
        a.playArm(m.players[e.player].char.super as SuperSfx);
      }),
      ev.on('superWindup', (e) => a.playCharge(e.id as SuperSfx)),
      ev.on('superShot', (e) => a.playSuper(e.id as SuperSfx)),
      ev.on('superHit', () => a.play('superHit', v)),
      ev.on('superBlocked', () => a.play('superBlock', v)),
      ev.on('powerSpawn', () => {
        if (!quiet) a.play('powerSpawn');
      }),
      ev.on('powerPick', (e) => {
        if (e.type === 'freeze') a.play('freeze', v);
        else if (e.type === 'reverse') a.play('powerBad', v);
        else a.play('powerPick', v);
      }),
    );
  }

  detach(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }
}
