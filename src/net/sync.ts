import { lerp } from '../core/math';
import type { GameEvents } from '../core/events';
import { t, tr } from '../i18n/i18n';
import { emptyIntent, type Controller, type PlayerIntent } from '../input/controls';
import type { Expression, SuperId } from '../game/characters';
import type { Match } from '../game/match';
import type { Player } from '../game/player';
import { POWER_INFO, type PowerType } from '../game/powerups';
import { SUPER_INFO, type SuperShot } from '../game/supers';
import { EVENT_NAMES, type GuestInput, type NetEvent, type PlayerPack, type Snapshot } from './protocol';
import type { Room } from './room';

const r1 = (v: number): number => Math.round(v * 10) / 10;
const r2 = (v: number): number => Math.round(v * 100) / 100;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** host waits for the guest when its input has not arrived for this long */
export const GUEST_STALE_MS = 700;
/** guest shows "waiting for the host" after this long without a snapshot */
export const HOST_STALE_MS = 700;

// ====================================================================== host

/** The guest's player on the host: driven by the input stream from the network. */
export class RemoteController implements Controller {
  private move = 0;
  private jumpHeld = false;
  private counts = [0, 0, 0, 0, 0];
  private used = [0, 0, 0, 0, 0];
  private lastSeq = -1;
  /** host clock of the last input */
  lastAt = performance.now();
  /** sequence number of the last applied input */
  get seq(): number {
    return this.lastSeq;
  }

  constructor(private mid: number) {}

  onInput(m: GuestInput): void {
    if (m.mid !== this.mid || typeof m.n !== 'number' || m.n <= this.lastSeq) return;
    this.lastSeq = m.n;
    this.lastAt = performance.now();
    this.move = m.m < 0 ? -1 : m.m > 0 ? 1 : 0;
    this.jumpHeld = m.j === 1;
    if (Array.isArray(m.c)) for (let i = 0; i < 5; i++) this.counts[i] = Math.max(this.counts[i], Number(m.c[i]) || 0);
  }

  read(out: PlayerIntent): void {
    out.move = this.move;
    out.jumpHeld = this.jumpHeld;
    // one buffered press per simulation step
    const take = (i: number): boolean => {
      if (this.counts[i] > this.used[i]) {
        this.used[i]++;
        return true;
      }
      return false;
    };
    out.jumpPressed = take(0);
    out.kickPressed = take(1);
    out.superPressed = take(2);
    out.dash = take(3) ? -1 : take(4) ? 1 : 0;
  }
}

const packPlayer = (p: Player): PlayerPack => [
  r1(p.x),
  r1(p.y),
  r1(p.vx),
  r1(p.vy),
  p.grounded ? 1 : 0,
  r1(p.footX),
  r1(p.footY),
  r3(p.footAngle),
  r3(p.kickT),
  p.expr,
  r3(p.squash),
  r2(p.lookX),
  r2(p.lookY),
  r3(p.headScale),
  r2(p.frozenT),
  r2(p.stunT),
  r2(p.fireT),
  p.charged ? 1 : 0,
  r2(p.runPhase),
  r3(p.blink),
  r3(p.energy),
  r2(p.reversedT),
  r2(p.jumpBoostT),
  r3(p.dashT),
  p.dashDir,
];

/**
 * Runs next to the authoritative match on the host: collects the match events,
 * and streams snapshots (+ the events of that moment) to the guest.
 */
export class HostSync {
  readonly remote: RemoteController;
  private events: Array<[EventName2, unknown]> = [];
  private unsub: Array<() => void> = [];
  private stepsSinceSend = 0;
  private lastSend = 0;
  private superSeq = 0;
  private lastSuper: SuperShot | null = null;

  constructor(
    private room: Room,
    private m: Match,
    readonly mid: number,
  ) {
    this.remote = new RemoteController(mid);
    for (const name of EVENT_NAMES) {
      this.unsub.push(m.events.on(name, (payload) => this.events.push([name, payload])));
    }
  }

  dispose(): void {
    for (const u of this.unsub) u();
    this.unsub = [];
  }

  /** the guest's input has not arrived for a while (tab hidden, connection hiccup) */
  get guestStale(): boolean {
    return performance.now() - this.remote.lastAt > GUEST_STALE_MS;
  }

  afterStep(): void {
    this.stepsSinceSend++;
  }

  /** Called once per rendered frame on the host. */
  endFrame(now: number): void {
    // ~60 Hz: every 2 simulation steps, plus a heartbeat while the simulation stands still
    if (this.stepsSinceSend < 2 && now - this.lastSend < 33) return;
    this.stepsSinceSend = 0;
    this.lastSend = now;
    const snap = this.snapshot(now);
    if (this.events.length) {
      const l = this.events.map(([n, p]) => [now, n, p] as NetEvent);
      this.events = [];
      this.room.send({ t: 'ev', mid: this.mid, l });
    }
    this.room.send(snap, true);
  }

  private snapshot(now: number): Snapshot {
    const m = this.m;
    const b = m.ball;
    const s = m.superShot;
    if (s && s !== this.lastSuper) this.superSeq++;
    this.lastSuper = s;
    const co = m.callout;
    const bn = m.banner;
    return {
      t: 's',
      mid: this.mid,
      ht: now,
      mt: r3(m.time),
      ph: m.phase,
      pt: r3(m.phaseT),
      tl: r2(m.timeLeft),
      g: m.golden ? 1 : 0,
      sc: [m.score[0], m.score[1]],
      w: m.winner,
      b: [r1(b.x), r1(b.y), r2(b.angle), r1(b.r), r1(b.vx), r1(b.vy), r2(b.fireT)],
      p: [packPlayer(m.players[0]), packPlayer(m.players[1])],
      gt: [r1(m.arena.goalTop[0]), r1(m.arena.goalTop[1])],
      it: m.powerups.items.map((it) => [it.type, r1(it.x), r1(it.y), r2(it.life), it.landed ? 1 : 0, r2(it.t)]),
      ae: m.powerups.active.map((e) => [e.type, e.player, r2(e.left), e.dur]),
      ss: s ? [this.superSeq, s.id, s.owner, s.phase, r3(s.t), s.hidden ? 1 : 0, s.done ? 1 : 0] : null,
      dc: m.decoys.map((d) => [r1(d.x), r1(d.y), r2(d.angle)]),
      sw: m.shockwave ? [r1(m.shockwave.x), r3(m.shockwave.t)] : null,
      co: co?.ref ? [co.ref.kind, co.ref.id, co.player, r3(co.t), co.color] : null,
      bn: bn?.key ? [bn.key, bn.subKey ?? '', bn.subPlayer ?? -1, r3(bn.t), bn.dur, bn.color] : null,
      ack: this.remote.seq,
      hw: this.guestStale ? 1 : 0,
    };
  }
}

type EventName2 = (typeof EVENT_NAMES)[number];

// ====================================================================== guest

/** What the guest's player sends: held buttons + cumulative press counters. */
export class GuestInputSender {
  private seq = 0;
  private counts: GuestInput['c'] = [0, 0, 0, 0, 0];
  private intent: PlayerIntent = emptyIntent();
  private lastMove = 0;
  private lastJump = false;
  private lastSent = 0;

  constructor(
    private room: Room,
    private mid: number,
    private local: Controller,
  ) {}

  /** read the local controls and send them (every frame) */
  update(now: number, enabled: boolean): void {
    const it = this.intent;
    this.local.read(it);
    if (!enabled) {
      it.move = 0;
      it.jumpHeld = it.jumpPressed = it.kickPressed = it.superPressed = false;
      it.dash = 0;
    }
    let changed = it.move !== this.lastMove || it.jumpHeld !== this.lastJump;
    if (it.jumpPressed) this.counts[0]++;
    if (it.kickPressed) this.counts[1]++;
    if (it.superPressed) this.counts[2]++;
    if (it.dash < 0) this.counts[3]++;
    if (it.dash > 0) this.counts[4]++;
    changed ||= it.jumpPressed || it.kickPressed || it.superPressed || it.dash !== 0;
    // send on every change, otherwise ~60 times a second so a lost packet is repaired quickly
    if (!changed && now - this.lastSent < 16) return;
    this.lastMove = it.move;
    this.lastJump = it.jumpHeld;
    this.lastSent = now;
    const msg: GuestInput = { t: 'in', mid: this.mid, n: this.seq++, m: it.move, j: it.jumpHeld ? 1 : 0, c: [...this.counts] as GuestInput['c'] };
    this.room.send(msg, true);
  }
}

/** Interpolation buffer (ms of host time the guest stays behind), by setting. */
const BUFFER_BASE: Record<'fast' | 'normal' | 'smooth', number> = { fast: 0, normal: 8, smooth: 35 };

interface MirrorShot {
  seq: number;
  obj: SuperShot;
}

/**
 * Shows the host's match on the guest: buffers snapshots, plays them back a
 * few milliseconds behind (smooth even with jittery networks), and fires the
 * match events at the moment they happened so sounds and effects line up.
 */
export class GuestSync {
  private snaps: Snapshot[] = [];
  private events: NetEvent[] = [];
  /** host clock - local clock */
  private offset = 0;
  private offsetReady = false;
  private samples: Array<[number, number]> = []; // [local time, ht - local]
  private jitter = 8;
  private delay = 40;
  private lastSnapAt = 0;
  private shot: MirrorShot | null = null;
  private bannerKey = '';
  /** last host time shown */
  shownHt = 0;
  buffer: 'fast' | 'normal' | 'smooth' = 'normal';

  constructor(
    readonly mid: number,
    private m: Match,
  ) {}

  /** a new match object for the same stream (created when the VS splash ends) */
  setMatch(m: Match): void {
    this.m = m;
  }

  get match(): Match {
    return this.m;
  }

  /** the host says it is not getting our input */
  get hostWaiting(): boolean {
    return this.snaps[this.snaps.length - 1]?.hw === 1;
  }

  get hostStale(): boolean {
    return this.lastSnapAt > 0 && performance.now() - this.lastSnapAt > HOST_STALE_MS;
  }

  get started(): boolean {
    return this.snaps.length > 0;
  }

  onSnapshot(s: Snapshot): void {
    if (s.mid !== this.mid || typeof s.ht !== 'number') return;
    const now = performance.now();
    this.lastSnapAt = now;
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.ht <= last.ht) {
      // late packet (unordered channel): slot it in if it is still useful
      if (s.ht > this.shownHt) {
        let i = this.snaps.length - 1;
        while (i > 0 && this.snaps[i - 1].ht > s.ht) i--;
        if (this.snaps[i - 1]?.ht !== s.ht) this.snaps.splice(i, 0, s);
      }
    } else this.snaps.push(s);
    if (this.snaps.length > 90) this.snaps.splice(0, this.snaps.length - 90);
    this.sampleClock(s.ht, now);
  }

  onEvents(mid: number, list: NetEvent[]): void {
    if (mid !== this.mid || !Array.isArray(list)) return;
    for (const e of list) if (Array.isArray(e) && (EVENT_NAMES as readonly string[]).includes(e[1])) this.events.push(e);
  }

  /** Clock sync: the least delayed packets tell the offset; their spread tells the jitter. */
  private sampleClock(ht: number, now: number): void {
    const sample = ht - now;
    this.samples.push([now, sample]);
    while (this.samples.length && now - this.samples[0][0] > 4000) this.samples.shift();
    let best = -Infinity;
    for (const [, v] of this.samples) best = Math.max(best, v);
    if (!this.offsetReady) {
      this.offset = best;
      this.offsetReady = true;
    } else if (best > this.offset) this.offset = best; // a faster packet: trust it at once
    else this.offset += (best - this.offset) * 0.02; // the route got slower: drift there gently
    this.jitter = this.jitter * 0.95 + (this.offset - sample) * 0.05;
  }

  /** Apply the state for this frame to the mirror match and fire due events. */
  update(now: number): void {
    if (!this.snaps.length) return;
    const target = Math.min(220, Math.max(10, BUFFER_BASE[this.buffer] + 17 + this.jitter * 1.6));
    this.delay += (target - this.delay) * 0.05;
    const renderHt = now + this.offset - this.delay;
    const snaps = this.snaps;
    let i = snaps.length - 1;
    while (i > 0 && snaps[i].ht > renderHt) i--;
    const a = snaps[i];
    const b = snaps[Math.min(i + 1, snaps.length - 1)];
    const k = b === a ? 0 : Math.min(1, Math.max(0, (renderHt - a.ht) / (b.ht - a.ht)));
    // never go back in time (clock re-sync)
    const ht = Math.max(this.shownHt, lerp(a.ht, b.ht, k));
    this.shownHt = ht;
    this.apply(a, b, k);
    // drop what is no longer needed
    if (i > 2) snaps.splice(0, i - 1);
    // events up to now
    if (this.events.length) {
      const due = this.events.filter((e) => e[0] <= ht);
      if (due.length) {
        this.events = this.events.filter((e) => e[0] > ht);
        // after a long pause (hidden tab) skip stale effects instead of firing them all at once
        for (const [at, name, payload] of due) if (ht - at < 500) this.m.events.emit(name, payload as GameEvents[typeof name]);
      }
    }
  }

  /** delay the guest sees the host's world with (ms), for the ping display */
  get latency(): number {
    return this.delay;
  }

  private apply(a: Snapshot, b: Snapshot, k: number): void {
    const m = this.m;
    m.time = lerp(a.mt, b.mt, k);
    m.phase = b.ph;
    m.phaseT = b.ph === a.ph ? lerp(a.pt, b.pt, k) : b.pt;
    m.timeLeft = lerp(a.tl, b.tl, k);
    m.golden = b.g === 1;
    m.score[0] = b.sc[0];
    m.score[1] = b.sc[1];
    m.winner = b.w;

    const ball = m.ball;
    ball.px = ball.x = lerp(a.b[0], b.b[0], k);
    ball.py = ball.y = lerp(a.b[1], b.b[1], k);
    ball.pangle = ball.angle = lerp(a.b[2], b.b[2], k);
    ball.r = b.b[3];
    ball.vx = b.b[4];
    ball.vy = b.b[5];
    ball.fireT = b.b[6];

    for (let n = 0; n < 2; n++) {
      const p = m.players[n];
      const pa = a.p[n];
      const pb = b.p[n];
      p.px = p.x = lerp(pa[0], pb[0], k);
      p.py = p.y = lerp(pa[1], pb[1], k);
      p.vx = pb[2];
      p.vy = pb[3];
      p.grounded = pb[4] === 1;
      p.footX = lerp(pa[5], pb[5], k);
      p.footY = lerp(pa[6], pb[6], k);
      p.footAngle = lerp(pa[7], pb[7], k);
      p.kickT = pb[8];
      p.expr = pb[9] as Expression;
      p.squash = lerp(pa[10], pb[10], k);
      p.lookX = lerp(pa[11], pb[11], k);
      p.lookY = lerp(pa[12], pb[12], k);
      p.headScale = lerp(pa[13], pb[13], k);
      p.frozenT = pb[14];
      p.stunT = pb[15];
      p.fireT = pb[16];
      p.charged = pb[17] === 1;
      p.runPhase = lerp(pa[18], pb[18], k);
      p.blink = pb[19];
      p.energy = pb[20];
      p.reversedT = pb[21];
      p.jumpBoostT = pb[22];
      p.dashT = pb[23] ?? 0;
      p.dashDir = pb[24] ?? 0;
    }

    if (m.arena.goalTop[0] !== b.gt[0]) m.arena.setGoalTop(0, b.gt[0]);
    if (m.arena.goalTop[1] !== b.gt[1]) m.arena.setGoalTop(1, b.gt[1]);

    m.powerups.items = b.it.map(([type, x, y, life, landed, t]) => ({
      type: type as PowerType,
      x,
      y,
      px: x,
      py: y,
      vy: 0,
      life,
      landed: landed === 1,
      t,
    }));
    m.powerups.active = b.ae.map(([type, player, left, dur]) => ({ type: type as PowerType, player, left, dur }));

    // super shot: the renderer keeps per-shot trails, so keep the same object for the same shot
    if (!b.ss) {
      m.superShot = null;
      this.shot = null;
    } else {
      const [seq, id, owner, phase, st, hidden, done] = b.ss;
      if (!this.shot || this.shot.seq !== seq) {
        this.shot = { seq, obj: { id: id as SuperId, owner, phase: 0, t: 0, hidden: false, done: false, dir: owner === 0 ? 1 : -1 } as unknown as SuperShot };
      }
      const o = this.shot.obj as { phase: number; t: number; hidden: boolean; done: boolean };
      o.phase = phase;
      o.t = st;
      o.hidden = hidden === 1;
      o.done = done === 1;
      m.superShot = this.shot.obj;
    }

    m.decoys = b.dc.map(([x, y, angle]) => ({ x, y, px: x, py: y, vx: 0, vy: 0, angle, pangle: angle, t: 0, alive: true }));
    m.shockwave = b.sw ? { x: b.sw[0], t: b.sw[1] } : null;

    if (b.co) {
      const [kind, id, player, ct, color] = b.co;
      const name = kind === 'super' ? SUPER_INFO[id as SuperId]?.name : POWER_INFO[id as PowerType]?.name;
      m.callout = { text: name ? tr(name).toUpperCase() + '!' : '', color, player, t: ct, ref: { kind, id } };
    } else m.callout = null;

    if (b.bn) {
      const [key, subKey, subPlayer, bt, dur, color] = b.bn;
      const sub = subKey ? t(subKey) : subPlayer >= 0 ? m.config.names[subPlayer] : undefined;
      const sameKey = a.bn?.[0] === key;
      const tt = sameKey && a.bn ? lerp(a.bn[3], bt, k) : bt;
      if (!m.banner || this.bannerKey !== key) {
        m.banner = { text: t(key), sub, color, dur, t: tt, key };
        this.bannerKey = key;
      } else {
        m.banner.t = tt;
        m.banner.dur = dur;
      }
    } else {
      m.banner = null;
      this.bannerKey = '';
    }
  }
}
