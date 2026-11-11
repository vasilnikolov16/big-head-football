import type { Difficulty } from '../ai/aiController';

export interface Settings {
  duration: 30 | 60 | 90;
  humanScheme: 'wasd' | 'arrows';
  difficulty: Difficulty;
  /** last picked heroes: [left player, right player in 2P, CPU opponent] */
  heroes: { p1: string; p2: string; cpu: string };
}

const SETTINGS_KEY = 'kratunball.settings.v1';

const DEFAULT_SETTINGS: Settings = {
  duration: 60,
  humanScheme: 'wasd',
  difficulty: 'medium',
  heroes: { p1: 'bobo', p2: 'penka', cpu: 'bip' },
};

function read<T>(key: string): Partial<T> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Partial<T>) : {};
  } catch {
    return {};
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / storage full: the game still works, it just won't remember */
  }
}

export function loadSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS, ...read<Settings>(SETTINGS_KEY) };
  s.heroes = { ...DEFAULT_SETTINGS.heroes, ...(s.heroes ?? {}) };
  if (![30, 60, 90].includes(s.duration)) s.duration = 60;
  if (s.humanScheme !== 'wasd' && s.humanScheme !== 'arrows') s.humanScheme = 'wasd';
  if (!['easy', 'medium', 'hard'].includes(s.difficulty)) s.difficulty = 'medium';
  return s;
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}
