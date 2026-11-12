import type { GameEvents } from '../core/events';
import { STADIUM_IDS, type StadiumId } from '../game/stadiums';
import type { PlayerMatchStats } from '../game/player';
import type { MatchSummary } from '../game/tracker';

/** Bump when the messages change: players on different versions can't play together. */
export const PROTOCOL = 5;
/** Public signalling ids are global: prefix them so we never collide with other apps. */
export const ROOM_PREFIX = 'kratunball-r1-';
/** No I, O, 0, 1: nothing that can be misread when a code is dictated. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 4;

export type Role = 'host' | 'guest';

export interface LobbyOptions {
  duration: 30 | 60 | 90;
  powerups: boolean;
  stadium: StadiumId;
}

/** keeps only what is valid from options received over the network */
export function cleanOpts(o: Partial<LobbyOptions> | undefined): LobbyOptions {
  const d = o?.duration;
  return {
    duration: d === 30 || d === 90 ? d : 60,
    powerups: o?.powerups !== false,
    stadium: o?.stadium && STADIUM_IDS.includes(o.stadium) ? o.stadium : 'classic',
  };
}

export const EVENT_NAMES = [
  'kick',
  'header',
  'touch',
  'jump',
  'land',
  'dash',
  'bump',
  'bounce',
  'clash',
  'goal',
  'whistle',
  'matchEnd',
  'superArmed',
  'superWindup',
  'superShot',
  'superHit',
  'superBlocked',
  'powerSpawn',
  'powerPick',
  'powerEnd',
] as const satisfies ReadonlyArray<keyof GameEvents>;

export type EventName = (typeof EVENT_NAMES)[number];
/** [host time ms, event name, payload] */
export type NetEvent = [number, EventName, GameEvents[EventName]];

/** Player state for drawing, packed in an array to keep packets small. */
export type PlayerPack = [
  x: number,
  y: number,
  vx: number,
  vy: number,
  grounded: 0 | 1,
  footX: number,
  footY: number,
  footAngle: number,
  kickT: number,
  expr: string,
  squash: number,
  lookX: number,
  lookY: number,
  headScale: number,
  frozenT: number,
  stunT: number,
  fireT: number,
  charged: 0 | 1,
  runPhase: number,
  blink: number,
  energy: number,
  reversedT: number,
  jumpBoostT: number,
  dashT: number,
  dashDir: number,
  slowT: number,
  noJumpT: number,
  shrinkT: number,
  burnT: number,
];

/** Everything the guest needs to draw one moment of the match. */
export interface Snapshot {
  t: 's';
  /** match id */
  mid: number;
  /** host clock (performance.now) when this state was produced */
  ht: number;
  /** match time, phase, phase time, time left */
  mt: number;
  ph: 'kickoff' | 'playing' | 'goal' | 'ended';
  pt: number;
  tl: number;
  g: 0 | 1;
  sc: [number, number];
  w: number;
  /** ball: x, y, angle, r, vx, vy, fireT */
  b: [number, number, number, number, number, number, number];
  p: [PlayerPack, PlayerPack];
  gt: [number, number];
  /** power-up items: type, x, y, life, landed, t */
  it: Array<[string, number, number, number, 0 | 1, number]>;
  /** active effects: type, player, left, dur */
  ae: Array<[string, number, number, number]>;
  /** super shot: seq, id, owner, phase, t, hidden, done */
  ss: [number, string, number, number, number, 0 | 1, 0 | 1] | null;
  /** decoys: x, y, angle */
  dc: Array<[number, number, number]>;
  sw: [number, number] | null;
  /** callout: kind, id, player, t, color */
  co: ['super' | 'power', string, number, number, string] | null;
  /** banner: key, subKey, subPlayer, t, dur, color */
  bn: [string, string, number, number, number, string] | null;
  /** last guest input the host has applied */
  ack: number;
  /** the host is waiting for this guest's input (the game stands still) */
  hw: 0 | 1;
}

export interface GuestInput {
  t: 'in';
  mid: number;
  /** sequence number (unordered channel) */
  n: number;
  m: number;
  j: 0 | 1;
  /** cumulative presses: jump, kick, super, dash left, dash right */
  c: [number, number, number, number, number];
}

export interface MatchEnd {
  t: 'end';
  mid: number;
  summary: MatchSummary;
  stats: [PlayerMatchStats, PlayerMatchStats];
  possession: [number, number];
  supersUsed: [number, number];
  score: [number, number];
  winner: number;
  golden: boolean;
}

export type Msg =
  | { t: 'hello'; v: number; name: string }
  | { t: 'welcome'; v: number; name: string; opts: LobbyOptions }
  | { t: 'reject'; reason: 'full' | 'version' }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'bye' }
  | { t: 'opts'; opts: LobbyOptions }
  | { t: 'goSelect' }
  | { t: 'goLobby' }
  | { t: 'pick'; hero: string; ready: boolean }
  | { t: 'unready' }
  | { t: 'start'; mid: number; heroes: [string, string]; opts: LobbyOptions }
  | { t: 'ev'; mid: number; l: NetEvent[] }
  | Snapshot
  | GuestInput
  | MatchEnd
  | { t: 'rematch'; want: boolean }
  | { t: 'emote'; p: number; i: number };

export const EMOTES = ['😂', '👏', '😡', '😱'];

export const MAX_NAME = 14;

/** Trim, drop control characters and cap the length of a player name. */
export function cleanName(s: unknown): string {
  if (typeof s !== 'string') return '';
  const clean = Array.from(s)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      // control characters, zero-width and bidi marks, line/paragraph separators
      return !(c < 0x20 || (c >= 0x7f && c <= 0x9f) || (c >= 0x200b && c <= 0x200f) || (c >= 0x2028 && c <= 0x202e) || c === 0xfeff);
    })
    .join('');
  return clean.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

export function normalizeCode(s: string): string {
  return s
    .toUpperCase()
    .split('')
    .filter((c) => CODE_ALPHABET.includes(c))
    .join('')
    .slice(0, CODE_LEN);
}

export function randomCode(): string {
  let s = '';
  const buf = new Uint32Array(CODE_LEN);
  crypto.getRandomValues(buf);
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[buf[i] % CODE_ALPHABET.length];
  return s;
}
