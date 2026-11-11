import type { Difficulty } from '../ai/aiController';
import type { Lang } from '../i18n/i18n';
import { ACTIONS, cloneBinding, DEFAULT_P1, DEFAULT_P2, type Binding } from '../input/controls';

export interface Settings {
  duration: 30 | 60 | 90;
  /** which control set the human uses against the computer */
  humanScheme: 'wasd' | 'arrows';
  difficulty: Difficulty;
  /** last picked heroes: left player, right player in 2P, CPU opponent */
  heroes: { p1: string; p2: string; cpu: string };
  /** key bindings for player 1 (left) and player 2 (right) */
  controls: { p1: Binding; p2: Binding };
  /** 0..1 */
  sfxVolume: number;
  musicVolume: number;
  powerups: boolean;
  replays: boolean;
  lang: Lang;
  /** on-screen touch buttons */
  touch: 'auto' | 'on' | 'off';
  showFps: boolean;
  /** settings format version (for migrations) */
  version: number;
}

const VERSION = 2;

const SETTINGS_KEY = 'kratunball.settings.v1';

const defaults = (): Settings => ({
  duration: 60,
  humanScheme: 'wasd',
  difficulty: 'medium',
  heroes: { p1: 'bobo', p2: 'penka', cpu: 'bip' },
  controls: { p1: cloneBinding(DEFAULT_P1), p2: cloneBinding(DEFAULT_P2) },
  sfxVolume: 0.8,
  musicVolume: 0.5,
  powerups: true,
  replays: false,
  lang: 'bg',
  touch: 'auto',
  showFps: false,
  version: VERSION,
});

export function read<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full: the game still works, it just won't remember */
  }
}

function validBinding(b: unknown): b is Binding {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return ACTIONS.every((a) => Array.isArray(o[a]) && (o[a] as unknown[]).length > 0 && (o[a] as unknown[]).every((k) => typeof k === 'string'));
}

const clamp01 = (v: unknown, d: number): number => (typeof v === 'number' && v >= 0 && v <= 1 ? v : d);

export function loadSettings(): Settings {
  const d = defaults();
  const saved = read<Settings>(SETTINGS_KEY);
  const s: Settings = { ...d, ...saved };
  s.heroes = { ...d.heroes, ...(saved.heroes ?? {}) };
  s.controls = {
    p1: validBinding(saved.controls?.p1) ? saved.controls!.p1 : d.controls.p1,
    p2: validBinding(saved.controls?.p2) ? saved.controls!.p2 : d.controls.p2,
  };
  if (![30, 60, 90].includes(s.duration)) s.duration = 60;
  if (s.humanScheme !== 'wasd' && s.humanScheme !== 'arrows') s.humanScheme = 'wasd';
  if (!['easy', 'medium', 'hard'].includes(s.difficulty)) s.difficulty = 'medium';
  s.sfxVolume = clamp01(s.sfxVolume, d.sfxVolume);
  s.musicVolume = clamp01(s.musicVolume, d.musicVolume);
  s.powerups = s.powerups !== false;
  s.replays = s.replays === true;
  // v1 had goal replays on by default: switch them off once
  if ((saved.version ?? 1) < 2) s.replays = false;
  s.version = VERSION;
  if (s.lang !== 'bg' && s.lang !== 'en') s.lang = 'bg';
  if (!['auto', 'on', 'off'].includes(s.touch)) s.touch = 'auto';
  s.showFps = s.showFps === true;
  return s;
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}
