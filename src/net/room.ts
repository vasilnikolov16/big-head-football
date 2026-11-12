import type { DataConnection, Peer, PeerError } from 'peerjs';
import { ICE_CONFIG } from './ice';
import { cleanName, PROTOCOL, randomCode, ROOM_PREFIX, type LobbyOptions, type Msg, type Role } from './protocol';

/**
 * A two-player "room" on top of WebRTC (PeerJS). The host registers the room
 * code on the free public PeerJS signalling server; the guest connects to it
 * directly, browser to browser (see ice.ts for the relay used when a direct
 * connection is impossible).
 *
 * Two data channels: a reliable ordered one for lobby/events, and an
 * unordered one for the 60 Hz state/input stream (a lost packet never holds
 * up the newer ones).
 */

export type RoomError = 'notFound' | 'network' | 'full' | 'version' | 'unsupported' | 'timeout' | 'taken';
export type LeaveReason = 'left' | 'lost';

type PeerCtor = typeof import('peerjs').Peer;
let PeerClass: PeerCtor | null = null;
/** PeerJS is loaded only when somebody actually goes online. */
async function loadPeer(): Promise<PeerCtor> {
  if (!PeerClass) PeerClass = (await import('peerjs')).Peer;
  return PeerClass;
}

const OPEN_TIMEOUT = 15000;
const JOIN_TIMEOUT = 20000;
/** no message at all for this long = the other player is gone */
const LOST_AFTER = 12000;
const PING_EVERY = 500;

export class RoomFailure extends Error {
  constructor(readonly reason: RoomError) {
    super(reason);
  }
}

function isMsg(d: unknown): d is Msg {
  return !!d && typeof d === 'object' && typeof (d as { t?: unknown }).t === 'string';
}

function mapPeerError(e: PeerError<string> | Error): RoomError {
  const type = (e as { type?: string }).type ?? '';
  if (type === 'peer-unavailable') return 'notFound';
  if (type === 'unavailable-id') return 'taken';
  if (type === 'browser-incompatible') return 'unsupported';
  return 'network';
}

function waitOpen(peer: Peer): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new RoomFailure('timeout')), OPEN_TIMEOUT);
    peer.once('open', (id) => {
      clearTimeout(timer);
      resolve(id);
    });
    peer.once('error', (e) => {
      clearTimeout(timer);
      reject(new RoomFailure(mapPeerError(e)));
    });
  });
}

export class Room {
  readonly role: Role;
  readonly code: string;
  /** the other player's name ('' while nobody is connected) */
  remoteName = '';
  /** host: options of the room (the guest gets them in the welcome) */
  opts: LobbyOptions;
  /** smoothed round-trip time in ms */
  rtt = 0;
  private lastRecv = 0;
  private rel: DataConnection | null = null;
  private fast: DataConnection | null = null;
  private remotePeer = '';
  private closed = false;
  private timer = 0;

  onMessage: (m: Msg) => void = () => {};
  /** host: a guest finished the handshake */
  onJoin: () => void = () => {};
  /** the other player left / the connection died */
  onLeave: (reason: LeaveReason, name: string) => void = () => {};

  private constructor(
    private peer: Peer,
    role: Role,
    code: string,
    readonly localName: string,
    opts: LobbyOptions,
  ) {
    this.role = role;
    this.code = code;
    this.opts = opts;
    this.timer = window.setInterval(() => this.tick(), PING_EVERY);
    window.addEventListener('pagehide', this.onPageHide);
    // the signalling server dropped us (not the game connection): rejoin it so new guests can still find the room
    peer.on('disconnected', () => {
      if (!this.closed && !peer.destroyed) window.setTimeout(() => !this.closed && !peer.destroyed && peer.reconnect(), 1500);
    });
  }

  get connected(): boolean {
    return this.remoteName !== '';
  }

  // ------------------------------------------------------------------ create / join

  static async create(name: string, opts: LobbyOptions): Promise<Room> {
    const PeerC = await loadPeer();
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = randomCode();
      const peer = new PeerC(ROOM_PREFIX + code, { debug: 0, config: ICE_CONFIG });
      try {
        await waitOpen(peer);
      } catch (e) {
        peer.destroy();
        if (e instanceof RoomFailure && e.reason === 'taken') continue; // code in use: roll a new one
        throw e;
      }
      const room = new Room(peer, 'host', code, name, opts);
      peer.on('connection', (c) => room.onIncoming(c));
      peer.on('error', (e) => console.warn('[room]', e.type));
      return room;
    }
    throw new RoomFailure('network');
  }

  static async join(code: string, name: string): Promise<Room> {
    const PeerC = await loadPeer();
    const peer = new PeerC({ debug: 0, config: ICE_CONFIG });
    try {
      await waitOpen(peer);
    } catch (e) {
      peer.destroy();
      throw e;
    }
    const room = new Room(peer, 'guest', code, name, { duration: 60, powerups: true, stadium: 'classic', party: 'none' });
    try {
      await room.connectToHost();
    } catch (e) {
      room.close(false);
      throw e;
    }
    return room;
  }

  private connectToHost(): Promise<void> {
    const peer = this.peer;
    const target = ROOM_PREFIX + this.code;
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (err?: RoomFailure): void => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };
      const timer = window.setTimeout(() => finish(new RoomFailure('timeout')), JOIN_TIMEOUT);
      peer.on('error', (e) => {
        if (!done) finish(new RoomFailure(mapPeerError(e)));
      });
      const rel = peer.connect(target, { label: 'r', reliable: true, serialization: 'json' });
      const fast = peer.connect(target, { label: 'f', reliable: false, serialization: 'json' });
      this.rel = rel;
      this.fast = fast;
      this.remotePeer = target;
      fast.on('data', (d) => this.receive(d));
      fast.on('error', () => {});
      rel.on('error', () => {});
      rel.on('open', () => {
        rel.send({ t: 'hello', v: PROTOCOL, name: this.localName } satisfies Msg);
      });
      rel.on('data', (d) => {
        if (!done && isMsg(d)) {
          if (d.t === 'welcome') {
            this.remoteName = cleanName(d.name) || '?';
            if (d.opts) this.opts = d.opts;
            this.lastRecv = performance.now();
            finish();
            return;
          }
          if (d.t === 'reject') {
            finish(new RoomFailure(d.reason === 'version' ? 'version' : 'full'));
            return;
          }
        }
        this.receive(d);
      });
      rel.on('close', () => {
        if (!done) finish(new RoomFailure('network'));
        else this.drop('lost');
      });
    });
  }

  /** host: a guest knocks */
  private onIncoming(c: DataConnection): void {
    if (this.closed) {
      c.close();
      return;
    }
    if (this.remotePeer && c.peer !== this.remotePeer) {
      // the room is taken: politely say so
      c.on('open', () => {
        if (c.label === 'r') c.send({ t: 'reject', reason: 'full' } satisfies Msg);
        window.setTimeout(() => c.close(), 400);
      });
      return;
    }
    this.remotePeer = c.peer;
    // a knock that never finishes the handshake is dropped
    window.setTimeout(() => {
      if (this.remotePeer === c.peer && !this.connected) this.resetGuest();
    }, JOIN_TIMEOUT);
    if (c.label === 'f') {
      this.fast = c;
      c.on('data', (d) => this.receive(d));
      c.on('error', () => {});
      return;
    }
    this.rel = c;
    c.on('error', () => {});
    c.on('data', (d) => {
      if (!this.connected) {
        if (isMsg(d) && d.t === 'hello') {
          if (d.v !== PROTOCOL) {
            c.send({ t: 'reject', reason: 'version' } satisfies Msg);
            window.setTimeout(() => this.resetGuest(), 400);
            return;
          }
          this.remoteName = cleanName(d.name) || '?';
          this.lastRecv = performance.now();
          c.send({ t: 'welcome', v: PROTOCOL, name: this.localName, opts: this.opts } satisfies Msg);
          this.onJoin();
        }
        return;
      }
      this.receive(d);
    });
    c.on('close', () => {
      if (this.rel === c) this.drop('lost');
    });
  }

  // ------------------------------------------------------------------ messages

  private receive(d: unknown): void {
    if (!isMsg(d) || this.closed) return;
    this.lastRecv = performance.now();
    switch (d.t) {
      case 'ping':
        this.send({ t: 'pong', ts: d.ts });
        return;
      case 'pong': {
        const rtt = performance.now() - d.ts;
        if (rtt >= 0 && rtt < 10000) this.rtt = this.rtt === 0 ? rtt : this.rtt * 0.8 + rtt * 0.2;
        return;
      }
      case 'bye':
        this.drop('left');
        return;
    }
    if (this.connected) this.onMessage(d);
  }

  /** fast = the unordered 60 Hz channel (falls back to the reliable one) */
  send(m: Msg, fast = false): void {
    if (this.closed) return;
    const c = fast && this.fast?.open ? this.fast : this.rel;
    if (!c?.open) return;
    try {
      void c.send(m);
    } catch {
      /* channel closing: the watchdog will notice */
    }
  }

  /** ms since anything arrived from the other player */
  get silence(): number {
    return this.connected ? performance.now() - this.lastRecv : 0;
  }

  private tick(): void {
    if (this.closed || !this.connected) return;
    this.send({ t: 'ping', ts: performance.now() });
    if (this.silence > LOST_AFTER) this.drop('lost');
  }

  private resetGuest(): void {
    const rel = this.rel;
    const fast = this.fast;
    this.rel = this.fast = null;
    this.remotePeer = '';
    this.remoteName = '';
    this.rtt = 0;
    rel?.close();
    fast?.close();
  }

  /** the other side is gone */
  private drop(reason: LeaveReason): void {
    if (this.closed || !this.connected) {
      if (this.role === 'host') this.resetGuest();
      return;
    }
    const name = this.remoteName;
    if (this.role === 'host') {
      this.resetGuest();
      this.onLeave(reason, name);
    } else {
      this.close(false);
      this.onLeave(reason, name);
    }
  }

  private onPageHide = (): void => {
    this.close();
  };

  /** Leave the room. sayBye: tell the other player first (faster than a timeout). */
  close(sayBye = true): void {
    if (this.closed) return;
    if (sayBye && this.connected) this.send({ t: 'bye' });
    this.closed = true;
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.onPageHide);
    const rel = this.rel;
    const fast = this.fast;
    const peer = this.peer;
    this.remoteName = '';
    // let the goodbye leave the building before tearing the connection down
    window.setTimeout(() => {
      rel?.close();
      fast?.close();
      peer.destroy();
    }, sayBye ? 250 : 0);
  }

  get isClosed(): boolean {
    return this.closed;
  }
}
