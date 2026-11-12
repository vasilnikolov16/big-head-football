import { t, tr } from '../i18n/i18n';
import { menuKeys } from '../input/controls';
import { CHARACTERS, getCharacter } from '../game/characters';
import { DEFAULT_EQUIP, type Equip } from '../game/cosmetics';
import type { Game } from '../game/game';
import { Match } from '../game/match';
import { MatchTracker } from '../game/tracker';
import { heroSelect, type OnlineSelectApi } from '../ui/heroSelect';
import { lobbyScreen, onlineMenu, onlinePause, type OnlineMenuApi } from '../ui/onlineUi';
import { postMatch } from '../ui/screens';
import { cleanName, CODE_LEN, EMOTES, normalizeCode, type LobbyOptions, type MatchEnd, type Msg, cleanOpts, cleanEquip } from './protocol';
import { Room, RoomFailure, type LeaveReason } from './room';
import { GuestInputSender, GuestSync, HostSync } from './sync';

type Phase = 'off' | 'lobby' | 'select' | 'match' | 'post';

const POST_DELAY = 1.6;
const EMOTE_GAP = 700;

/**
 * Online play: owns the room and walks both players through
 * lobby → hero select → match → post-match (rematch / change heroes / leave).
 *
 * The host's browser runs the real match; the guest's browser shows a mirror
 * of it (see sync.ts) and sends its controls.
 */
export class OnlineSession {
  room: Room | null = null;
  private phase: Phase = 'off';
  private note = '';
  private mid = 0;
  private localPick = { hero: '', ready: false };
  private remotePick: { hero: string; ready: boolean } | null = null;
  private selectApi: OnlineSelectApi | null = null;
  private lobbyRefresh: (() => void) | null = null;
  private menuApi: OnlineMenuApi | null = null;
  private busy = false;

  // match
  private heroes: [string, string] = ['bobo', 'penka'];
  private hostSync: HostSync | null = null;
  private guestSync: GuestSync | null = null;
  private sender: GuestInputSender | null = null;
  private tracker: MatchTracker | null = null;
  private endSent = false;
  private endMsg: MatchEnd | null = null;
  private postShown = false;
  private rematch = { me: false, them: false };
  private postUpdate: ((status: string, iWant: boolean) => void) | null = null;
  private lastEmote = 0;
  /** the guest's mirror match, created as soon as the start message arrives */
  private pendingMirror: Match | null = null;

  constructor(private game: Game) {}

  get active(): boolean {
    return this.room !== null && !this.room.isClosed;
  }

  get inMatch(): boolean {
    return this.phase === 'match';
  }

  /** the side this browser plays: host = left, guest = right */
  get side(): 0 | 1 {
    return this.room?.role === 'guest' ? 1 : 0;
  }

  private get isHost(): boolean {
    return this.room?.role === 'host';
  }

  /** this browser runs the real simulation (host); the guest only mirrors it */
  get simulates(): boolean {
    return this.room?.role !== 'guest';
  }

  private get names(): [string, string] {
    const r = this.room;
    if (!r) return ['', ''];
    return r.role === 'host' ? [r.localName, r.remoteName] : [r.remoteName, r.localName];
  }

  private get remoteName(): string {
    return this.room?.remoteName || '?';
  }

  // ================================================================== menu

  /** Online menu (name + create/join). code: pre-filled from a shared link. */
  open(code = '', status = '', autoJoin = false): void {
    const g = this.game;
    const hadName = !!g.settings.onlineName;
    if (!g.settings.onlineName) {
      g.settings.onlineName = t('online.defaultName', { n: 100 + Math.floor(Math.random() * 900) });
      g.saveSettings();
    }
    this.phase = 'off';
    this.lobbyRefresh = null;
    let joinCode = normalizeCode(code);
    const { screen, api } = onlineMenu({
      name: g.settings.onlineName,
      code: joinCode,
      onName: (n) => {
        g.settings.onlineName = n;
        g.saveSettings();
      },
      onCreate: () => void this.create(),
      onJoin: (c) => {
        joinCode = c;
        void this.join(c);
      },
      onBack: () => {
        if (this.busy) return;
        g.showMain();
      },
    });
    this.menuApi = api;
    g.ui.show(screen);
    if (status) api.setStatus(status, 'err');
    // a shared link joins straight away (first-timers pick a name first)
    if (autoJoin && hadName && joinCode.length === CODE_LEN) void this.join(joinCode);
    else if (autoJoin) api.focusName();
  }

  private nameOk(): string | null {
    const g = this.game;
    const n = cleanName(g.settings.onlineName);
    g.settings.onlineName = n;
    g.saveSettings();
    if (!n) {
      this.menuApi?.setStatus(t('online.needName'), 'err');
      this.menuApi?.focusName();
      return null;
    }
    return n;
  }

  private errorText(e: unknown, code = ''): string {
    const reason = e instanceof RoomFailure ? e.reason : 'network';
    return t(`online.err.${reason}`, { c: code });
  }

  private async create(): Promise<void> {
    if (this.busy) return;
    const name = this.nameOk();
    if (!name) return;
    const g = this.game;
    this.busy = true;
    this.menuApi?.setBusy(true);
    this.menuApi?.setStatus(t('online.creating'), 'busy');
    try {
      const st = g.settings.stadium;
      const room = await Room.create(name, { duration: g.settings.duration, powerups: g.settings.powerups, stadium: st === 'random' ? 'classic' : st });
      this.attach(room);
      this.note = '';
      this.showLobby();
    } catch (e) {
      this.menuApi?.setStatus(this.errorText(e), 'err');
    } finally {
      this.busy = false;
      this.menuApi?.setBusy(false);
    }
  }

  private async join(raw: string): Promise<void> {
    if (this.busy) return;
    const code = normalizeCode(raw);
    if (code.length !== CODE_LEN) {
      this.menuApi?.setStatus(t('online.err.code'), 'err');
      return;
    }
    const name = this.nameOk();
    if (!name) return;
    this.busy = true;
    this.menuApi?.setBusy(true);
    this.menuApi?.setStatus(t('online.joining', { c: code }), 'busy');
    try {
      const room = await Room.join(code, name);
      this.attach(room);
      this.note = '';
      this.showLobby();
      this.game.audio.play('uiSelect');
    } catch (e) {
      this.menuApi?.setStatus(this.errorText(e, code), 'err');
    } finally {
      this.busy = false;
      this.menuApi?.setBusy(false);
    }
  }

  private attach(room: Room): void {
    this.room?.close();
    this.room = room;
    room.onMessage = (m) => this.handle(m);
    room.onJoin = () => {
      this.note = '';
      this.game.audio.play('whistleStart');
      if (this.phase === 'lobby') this.lobbyRefresh?.();
      else this.showLobby();
    };
    room.onLeave = (reason, name) => this.onLeave(reason, name);
  }

  // ================================================================== lobby

  private showLobby(): void {
    const room = this.room;
    if (!room) return;
    this.stopMatch();
    this.phase = 'lobby';
    this.selectApi = null;
    this.remotePick = null;
    const g = this.game;
    const { screen, refresh } = lobbyScreen({
      get: () => ({
        code: room.code,
        isHost: room.role === 'host',
        localName: room.localName,
        remoteName: room.remoteName,
        ping: room.rtt,
        opts: room.opts,
        note: this.note,
      }),
      setOpts: (o) => this.setOpts(o),
      toHeroes: () => {
        if (!room.connected) return;
        room.send({ t: 'goSelect' });
        this.showSelect();
      },
      leave: () => this.leave(),
      link: () => `${location.origin}${location.pathname}?room=${room.code}`,
      sound: () => g.audio.play('uiSelect'),
    });
    this.lobbyRefresh = refresh;
    g.ui.show(screen);
  }

  private setOpts(o: LobbyOptions): void {
    const room = this.room;
    if (!room || room.role !== 'host') return;
    room.opts = cleanOpts(o);
    // remember them as the defaults for next time
    this.game.settings.duration = o.duration;
    this.game.settings.powerups = o.powerups;
    this.game.saveSettings();
    room.send({ t: 'opts', opts: room.opts });
    this.lobbyRefresh?.();
  }

  // ================================================================== hero select

  private showSelect(): void {
    const room = this.room;
    if (!room) return;
    this.stopMatch();
    this.phase = 'select';
    this.lobbyRefresh = null;
    this.rematch = { me: false, them: false };
    this.remotePick = null;
    const g = this.game;
    const side = this.side;
    const saved = g.settings.heroes.p1;
    const initial: [string, string] = side === 0 ? [saved, g.settings.heroes.p2] : [g.settings.heroes.p2, saved];
    this.localPick = { hero: saved, ready: false };
    g.ui.show(
      heroSelect({
        mode: 'online',
        initial,
        isLocked: (c) => !g.career.isUnlocked(c.id),
        rightLabel: '',
        keys: [menuKeys(g.settings.controls.p1, 'Space', 'KeyQ'), menuKeys(g.settings.controls.p2, 'Enter', 'Backspace')],
        sound: (snd) => g.ui.onSound(snd),
        onBack: () => {
          room.send({ t: 'goLobby' });
          this.showLobby();
        },
        onDone: () => this.onSplashDone(),
        online: {
          side,
          isHost: room.role === 'host',
          names: this.names,
          send: (hero, ready) => {
            this.localPick = { hero, ready };
            g.settings.heroes.p1 = hero;
            g.saveSettings();
            room.send({ t: 'pick', hero, ready, cos: g.career.p.equipped });
          },
          requestStart: () => this.requestStart(),
          bind: (api) => {
            this.selectApi = api;

          },
        },
      }),
    );
  }

  private requestStart(): void {
    const room = this.room;
    if (!room || room.role !== 'host' || this.phase !== 'select') return;
    const r = this.remotePick;
    const l = this.localPick;
    if (!r?.ready || !l.ready || r.hero === l.hero) return;
    this.mid++;
    const heroes: [string, string] = [l.hero, r.hero];
    room.send({ t: 'start', mid: this.mid, heroes, opts: room.opts });
    this.beginMatch(this.mid, heroes, room.opts);
  }

  // ================================================================== match

  private matchConfig(heroes: [string, string], opts: LobbyOptions): ConstructorParameters<typeof Match>[0] {
    const names = this.names;
    const side = this.side;
    return {
      chars: [getCharacter(heroes[0]), getCharacter(heroes[1])],
      names,
      tags: side === 0 ? [t('you'), ''] : ['', t('you')],
      duration: opts.duration,
      powerups: opts.powerups,
      stadium: opts.stadium,
    };
  }

  /** Both browsers: the match is on. Plays the VS splash when coming from hero select. */
  private beginMatch(mid: number, heroes: [string, string], opts: LobbyOptions): void {
    this.mid = mid;
    this.heroes = heroes;
    if (this.room) this.room.opts = opts;
    this.endSent = false;
    this.endMsg = null;
    this.postShown = false;
    this.rematch = { me: false, them: false };
    this.postUpdate = null;
    if (!this.isHost) {
      // start buffering the host's stream right away (it may arrive during the splash)
      const mirror = new Match(this.matchConfig(heroes, opts));
      this.pendingMirror = mirror;
      this.guestSync = new GuestSync(mid, mirror);
      this.guestSync.buffer = this.game.settings.netBuffer;
    }
    if (this.phase === 'select' && this.selectApi) {
      this.selectApi.launch(heroes);
    } else {
      this.onSplashDone();
    }
  }

  /** the other player's shop cosmetics (from their hero pick) */
  private remoteCos: Equip = { ...DEFAULT_EQUIP };

  /** both players wear their own cosmetics; the ball is the host's */
  private dress(m: Match): void {
    const mine = { ...this.game.career.p.equipped };
    const side = this.side;
    m.players[side].cos = mine;
    m.players[1 - side].cos = this.remoteCos;
    m.ballSkin = side === 0 ? mine.ball : this.remoteCos.ball;
  }

  private onSplashDone(): void {
    const room = this.room;
    if (!room) return;
    const g = this.game;
    this.phase = 'match';
    this.selectApi = null;
    g.ui.hide();
    if (room.role === 'host') {
      const m = new Match(this.matchConfig(this.heroes, room.opts));
      this.hostSync?.dispose();
      this.hostSync = new HostSync(room, m, this.mid);
      this.tracker = new MatchTracker(m);
      m.controllers[0] = g.localController();
      m.controllers[1] = this.hostSync.remote;
      this.dress(m);
      g.beginOnlineMatch(m);
    } else {
      const m = this.pendingMirror ?? new Match(this.matchConfig(this.heroes, room.opts));
      this.pendingMirror = null;
      if (!this.guestSync || this.guestSync.mid !== this.mid) this.guestSync = new GuestSync(this.mid, m);
      this.guestSync.setMatch(m);
      this.sender = new GuestInputSender(room, this.mid, g.localController());
      this.dress(m);
      g.beginOnlineMatch(m);
    }
  }

  /** stop feeding the current match (leaving it, going back to the lobby…) */
  private stopMatch(): void {
    this.hostSync?.dispose();
    this.hostSync = null;
    this.guestSync = null;
    this.sender = null;
    this.tracker = null;
    this.pendingMirror = null;
    this.postUpdate = null;
    if (this.game.setup?.mode === 'online') this.game.endOnlineMatch();
  }

  /**
   * Called by the game loop every frame during an online match.
   * Returns whether the host may advance the simulation this frame.
   */
  frameBefore(now: number): boolean {
    if (this.phase !== 'match' && this.phase !== 'post') return false;
    const g = this.game;
    if (this.isHost) {
      const sync = this.hostSync;
      if (!sync) return false;
      // wait for the guest (tab hidden / connection hiccup) instead of playing against nobody
      return !(sync.guestStale && g.match.phase !== 'ended');
    }
    this.sender?.update(now, this.phase === 'match' && !g.ui.active);
    if (this.guestSync) {
      this.guestSync.buffer = g.settings.netBuffer;
      this.guestSync.update(now);
    }
    return false;
  }

  afterStep(): void {
    this.hostSync?.afterStep();
  }

  frameAfter(now: number): void {
    if (this.isHost && this.hostSync) {
      this.hostSync.endFrame(now);
      this.checkHostEnd();
    } else if (!this.isHost) this.checkGuestEnd();
  }

  /** ping + "waiting for…" for the renderer */
  netInfo(): { ping: number | null; note: string | null } {
    const room = this.room;
    const g = this.game;
    let note: string | null = null;
    if (this.phase === 'match' && g.match.phase !== 'ended') {
      if (this.isHost && this.hostSync?.guestStale) note = t('online.waitOpp', { n: this.remoteName });
      if (!this.isHost && this.guestSync?.hostStale) note = t('online.waitHost');
      else if (!this.isHost && this.guestSync?.hostWaiting) note = t('online.slow');
    }
    const ping = g.settings.showPing && room?.connected && room.rtt > 0 ? room.rtt : null;
    return { ping, note };
  }

  private checkHostEnd(): void {
    const m = this.game.match;
    if (m.phase !== 'ended' || !this.room) return;
    if (!this.endSent && this.tracker) {
      this.endSent = true;
      const msg: MatchEnd = {
        t: 'end',
        mid: this.mid,
        summary: this.tracker.finish(),
        stats: [{ ...m.players[0].stats }, { ...m.players[1].stats }],
        possession: [m.possession[0], m.possession[1]],
        supersUsed: [m.supersUsed[0], m.supersUsed[1]],
        score: [m.score[0], m.score[1]],
        winner: m.winner,
        golden: m.golden,
      };
      this.endMsg = msg;
      this.room.send(msg);
    }
    if (m.phaseT >= POST_DELAY) this.showPost();
  }

  private checkGuestEnd(): void {
    const m = this.game.match;
    if (this.phase !== 'match' || m.phase !== 'ended' || m.phaseT < POST_DELAY || !this.endMsg) return;
    this.showPost();
  }

  // ================================================================== post match

  private showPost(): void {
    if (this.postShown || !this.endMsg) return;
    this.postShown = true;
    this.phase = 'post';
    const g = this.game;
    const m = g.match;
    const e = this.endMsg;
    // the guest's mirror has no stats of its own: take the host's
    m.score[0] = e.score[0];
    m.score[1] = e.score[1];
    m.winner = e.winner;
    m.golden = e.golden;
    m.players[0].stats = { ...e.stats[0] };
    m.players[1].stats = { ...e.stats[1] };
    m.possession = [e.possession[0], e.possession[1]];
    m.supersUsed = [e.supersUsed[0], e.supersUsed[1]];
    const result = g.career.record({
      mode: 'online',
      humans: [this.side],
      heroes: [this.heroes[0], this.heroes[1]],
      difficulty: 'medium',
      summary: e.summary,
    });
    for (const a of result.achievements) g.toast(a.icon, t('ach.unlocked'), tr(a.name));
    g.ui.show(
      postMatch(g, m, 'online', {
        career: null,
        online: {
          side: this.side,
          rematch: () => this.toggleRematch(),
          change: () => {
            this.room?.send({ t: 'goSelect' });
            this.showSelect();
          },
          leave: () => this.leave(),
          bind: (update) => {
            this.postUpdate = update;
            this.updatePost();
          },
        },
      }),
    );
  }

  private updatePost(): void {
    const n = this.remoteName;
    const r = this.rematch;
    const status = r.them && !r.me ? t('online.rematchAsk', { n }) : r.me && !r.them ? t('online.rematchWait', { n }) : '';
    this.postUpdate?.(status, r.me);
  }

  private toggleRematch(): void {
    if (this.phase !== 'post') return;
    this.rematch.me = !this.rematch.me;
    this.room?.send({ t: 'rematch', want: this.rematch.me });
    this.updatePost();
    this.tryRematch();
  }

  private tryRematch(): void {
    const room = this.room;
    if (!room || room.role !== 'host' || this.phase !== 'post') return;
    if (!this.rematch.me || !this.rematch.them) return;
    this.mid++;
    room.send({ t: 'start', mid: this.mid, heroes: this.heroes, opts: room.opts });
    this.beginMatch(this.mid, this.heroes, room.opts);
  }

  // ================================================================== emotes

  emote(i: number): void {
    if (!this.room || (this.phase !== 'match' && this.phase !== 'post') || i < 0 || i >= EMOTES.length) return;
    const now = performance.now();
    if (now - this.lastEmote < EMOTE_GAP) return;
    this.lastEmote = now;
    this.game.renderer.fx.emote(this.side, EMOTES[i]);
    this.game.audio.play('uiMove');
    this.room.send({ t: 'emote', p: this.side, i });
  }

  // ================================================================== network

  private handle(msg: Msg): void {
    const host = this.isHost;
    switch (msg.t) {
      case 'opts':
        if (!host && this.room && msg.opts) {
          this.room.opts = cleanOpts(msg.opts);
          this.lobbyRefresh?.();
        }
        return;
      case 'goSelect':
        if (this.phase !== 'select') this.showSelect();
        return;
      case 'goLobby':
        if (this.phase !== 'lobby') this.showLobby();
        return;
      case 'pick': {
        if (typeof msg.hero !== 'string' || !CHARACTERS.some((c) => c.id === msg.hero)) return;
        let ready = msg.ready === true;
        // host settles a tie: both locked in the same hero -> the guest has to pick again
        if (host && ready && this.localPick.ready && msg.hero === this.localPick.hero) {
          ready = false;
          this.room?.send({ t: 'unready' });
        }
        this.remotePick = { hero: msg.hero, ready };
        this.remoteCos = cleanEquip(msg.cos);
        this.selectApi?.setRemote(msg.hero, ready);
        return;
      }
      case 'unready':
        if (!host) {
          this.localPick.ready = false;
          this.selectApi?.unreadyLocal();
        }
        return;
      case 'start': {
        if (host || !Array.isArray(msg.heroes)) return;
        const heroes = msg.heroes.map((h) => (CHARACTERS.some((c) => c.id === h) ? h : 'bobo')) as [string, string];
        const opts: LobbyOptions = cleanOpts(msg.opts);
        this.beginMatch(msg.mid, heroes, opts);
        return;
      }
      case 's':
        if (!host) this.guestSync?.onSnapshot(msg);
        return;
      case 'ev':
        if (!host) this.guestSync?.onEvents(msg.mid, msg.l);
        return;
      case 'in':
        if (host) this.hostSync?.remote.onInput(msg);
        return;
      case 'end':
        if (!host && msg.mid === this.mid) this.endMsg = msg;
        return;
      case 'rematch':
        this.rematch.them = msg.want === true;
        if (this.phase === 'post') {
          if (this.rematch.them) this.game.audio.play('uiSelect');
          this.updatePost();
          this.tryRematch();
        }
        return;
      case 'emote': {
        const other = 1 - this.side;
        if (typeof msg.i === 'number' && EMOTES[msg.i] && (this.phase === 'match' || this.phase === 'post')) {
          this.game.renderer.fx.emote(other, EMOTES[msg.i]);
          this.game.audio.play('uiMove');
        }
        return;
      }
    }
  }

  private onLeave(reason: LeaveReason, who: string): void {
    const room = this.room;
    const name = who || '?';
    const g = this.game;
    g.audio.play('uiBack');
    if (room && room.role === 'host' && !room.isClosed) {
      // the room stays open: wait for the next friend
      this.note = t(reason === 'left' ? 'online.left' : 'online.lost', { n: name });
      this.showLobby();
      return;
    }
    // guest: the room is gone
    this.stopMatch();
    this.room = null;
    this.phase = 'off';
    this.open('', reason === 'left' ? t('online.hostLeft') : t('online.lost', { n: name }));
  }

  /** Leave the room for good and go back to the main menu. */
  leave(): void {
    this.stopMatch();
    this.room?.close();
    this.room = null;
    this.phase = 'off';
    this.game.showMain();
  }

  /** Esc during an online match: a menu that does not stop the game. */
  showMenu(): void {
    const g = this.game;
    const back = (): void => this.showMenu();
    g.ui.show(
      onlinePause({
        resume: () => {
          g.ui.hide();
          g.kb.flushPresses();
        },
        settings: () => g.showSettings(back),
        howTo: () => g.showHowTo(back),
        leave: () => this.leave(),
        touch: g.touchMode,
      }),
    );
  }
}
