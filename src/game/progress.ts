import { read, write } from '../core/storage';
import { CHARACTERS } from './characters';
import { COS_CATS, cosItem, DEFAULT_EQUIP, type Equip } from './cosmetics';

/** a league season: 8 teams, 7 rounds, then the play-offs */
export interface LeagueTeam {
  hero: string;
  p: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
}

export interface LeagueRun {
  hero: string;
  difficulty: 'easy' | 'medium' | 'hard';
  teams: LeagueTeam[];
  /** round-robin pairs per round (indices into teams; team 0 is the player) */
  rounds: Array<Array<[number, number]>>;
  round: number;
  /** 'season' | 'semi' | 'final' | 'done' */
  stage: 'season' | 'semi' | 'final' | 'done';
  /** play-off opponent (team index) and the result of the season */
  opponent: number;
  champion: boolean;
  /** results of the player's last round (for the screen) */
  last: string;
}

/** Career numbers, saved in localStorage. */
export interface Stats {
  played: number;
  cpuWon: number;
  cpuLost: number;
  pvpPlayed: number;
  onlinePlayed: number;
  onlineWon: number;
  onlineLost: number;
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
  /** super shots stopped */
  blocks: number;
  /** stadiums won on, crazy modes played */
  stadiumWins: string[];
  partyModes: string[];
  coinsEarned: number;
  purchases: number;
  dailyDone: number;
  leaguesWon: number;
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
  /** coins to spend in the shop */
  coins: number;
  /** bought cosmetics ("cat:id") */
  owned: string[];
  equipped: Equip;
  /** daily challenge: the last day it was completed (YYYY-MM-DD) */
  dailyDate: string;
  /** league season in progress */
  league: LeagueRun | null;
}

const KEY = 'kratunball.progress.v1';

const emptyStats = (): Stats => ({
  played: 0,
  cpuWon: 0,
  cpuLost: 0,
  pvpPlayed: 0,
  onlinePlayed: 0,
  onlineWon: 0,
  onlineLost: 0,
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
  blocks: 0,
  stadiumWins: [],
  partyModes: [],
  coinsEarned: 0,
  purchases: 0,
  dailyDone: 0,
  leaguesWon: 0,
});

/** Heroes available from the start (the rest are won in the tournament). */
export const startingHeroes = (): string[] => CHARACTERS.filter((c) => !c.unlock).map((c) => c.id);

export function freshProgress(): Progress {
  return {
    version: 1,
    stats: emptyStats(),
    unlocked: startingHeroes(),
    achievements: {},
    tournament: null,
    coins: 0,
    owned: [],
    equipped: { ...DEFAULT_EQUIP },
    dailyDate: '',
    league: null,
  };
}

export function loadProgress(): Progress {
  const saved = read<Progress>(KEY);
  const p = freshProgress();
  if (saved.stats) p.stats = { ...p.stats, ...saved.stats };
  if (Array.isArray(saved.unlocked)) p.unlocked = [...new Set([...p.unlocked, ...saved.unlocked])];
  if (saved.achievements && typeof saved.achievements === 'object') p.achievements = saved.achievements;
  if (saved.tournament && Array.isArray(saved.tournament.order)) p.tournament = saved.tournament;
  if (typeof saved.coins === 'number' && saved.coins >= 0) p.coins = Math.floor(saved.coins);
  if (Array.isArray(saved.owned)) p.owned = saved.owned.filter((k) => typeof k === 'string');
  if (saved.equipped && typeof saved.equipped === 'object') {
    for (const cat of COS_CATS) {
      const id = (saved.equipped as unknown as Record<string, unknown>)[cat];
      if (typeof id === 'string' && cosItem(cat, id)) p.equipped[cat] = id;
    }
  }
  if (typeof saved.dailyDate === 'string') p.dailyDate = saved.dailyDate;
  if (saved.league && Array.isArray(saved.league.teams)) p.league = saved.league;
  for (const k of ['stadiumWins', 'partyModes', 'superGoalHeroes'] as const) if (!Array.isArray(p.stats[k])) p.stats[k] = [];
  return p;
}

export function saveProgress(p: Progress): void {
  write(KEY, p);
}
