import { read, write } from '../core/storage';
import { CHARACTERS } from './characters';

/** Career numbers, saved in localStorage. */
export interface Stats {
  played: number;
  cpuWon: number;
  cpuLost: number;
  pvpPlayed: number;
  goals: number;
  conceded: number;
  supers: number;
  powerups: number;
  perfectKicks: number;
  cupsWon: number;
  bestWinMargin: number;
  bestWinScore: string;
  mostGoals: number;
  /** seconds from the kick-off whistle, 0 = none yet */
  fastestGoal: number;
  longestStreak: number;
  streak: number;
  heroGames: Record<string, number>;
  /** heroes that scored a super-shot goal */
  superGoalHeroes: string[];
}

export interface TournamentRun {
  hero: string;
  /** opponent ids in round order */
  order: string[];
  /** index of the next round to play */
  round: number;
  losses: number;
}

export interface Progress {
  version: number;
  stats: Stats;
  unlocked: string[];
  /** achievement id -> time unlocked */
  achievements: Record<string, number>;
  tournament: TournamentRun | null;
}

const KEY = 'kratunball.progress.v1';

const emptyStats = (): Stats => ({
  played: 0,
  cpuWon: 0,
  cpuLost: 0,
  pvpPlayed: 0,
  goals: 0,
  conceded: 0,
  supers: 0,
  powerups: 0,
  perfectKicks: 0,
  cupsWon: 0,
  bestWinMargin: 0,
  bestWinScore: '',
  mostGoals: 0,
  fastestGoal: 0,
  longestStreak: 0,
  streak: 0,
  heroGames: {},
  superGoalHeroes: [],
});

/** Heroes available from the start (the rest are won in the tournament). */
export const startingHeroes = (): string[] => CHARACTERS.filter((c) => !c.unlock).map((c) => c.id);

export function freshProgress(): Progress {
  return { version: 1, stats: emptyStats(), unlocked: startingHeroes(), achievements: {}, tournament: null };
}

export function loadProgress(): Progress {
  const saved = read<Progress>(KEY);
  const p = freshProgress();
  if (saved.stats) p.stats = { ...p.stats, ...saved.stats };
  if (Array.isArray(saved.unlocked)) p.unlocked = [...new Set([...p.unlocked, ...saved.unlocked])];
  if (saved.achievements && typeof saved.achievements === 'object') p.achievements = saved.achievements;
  if (saved.tournament && Array.isArray(saved.tournament.order)) p.tournament = saved.tournament;
  return p;
}

export function saveProgress(p: Progress): void {
  write(KEY, p);
}
