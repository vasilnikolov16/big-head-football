import type { Difficulty } from '../ai/aiController';

export interface Settings {
  duration: 30 | 60 | 90;
  humanScheme: 'wasd' | 'arrows';
  difficulty: Difficulty;
}

const SETTINGS_KEY = 'kratunball.settings.v1';

const DEFAULT_SETTINGS: Settings = {
  duration: 60,
  humanScheme: 'wasd',
  difficulty: 'medium',
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
  if (![30, 60, 90].includes(s.duration)) s.duration = 60;
  if (s.humanScheme !== 'wasd' && s.humanScheme !== 'arrows') s.humanScheme = 'wasd';
  if (!['easy', 'medium', 'hard'].includes(s.difficulty)) s.difficulty = 'medium';
  return s;
}

export function saveSettings(s: Settings): void {
  write(SETTINGS_KEY, s);
}
