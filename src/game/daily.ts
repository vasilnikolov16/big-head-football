import type { Difficulty } from '../ai/aiController';
import { mulberry32 } from '../core/math';
import { CHARACTERS } from './characters';
import { PARTY_IDS, STADIUM_IDS, type PartyMode, type StadiumId } from './stadiums';
import type { MatchSummary } from './tracker';

/**
 * The challenge of the day: the same task for everybody on the same date
 * (seeded from the date), rewarded once a day.
 */

export type GoalKind = 'win' | 'winBy' | 'score' | 'clean' | 'header' | 'super' | 'block';

export interface DailyChallenge {
  date: string;
  hero: string;
  opponent: string;
  difficulty: Difficulty;
  stadium: StadiumId;
  /** sometimes a crazy rule too */
  party: PartyMode | null;
  goal: GoalKind;
  n: number;
  reward: number;
}

export const DAILY_REWARD = 150;

/** local date as YYYY-MM-DD */
export function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dailyChallenge(date = todayKey()): DailyChallenge {
  const seed = Number(date.replace(/-/g, ''));
  const rnd = mulberry32(seed * 2654435761);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length) % a.length];
  // the hero must be playable by everybody: one of the starting heroes
  const open = CHARACTERS.filter((c) => !c.unlock);
  const hero = pick(open).id;
  const opponent = pick(CHARACTERS.filter((c) => c.id !== hero)).id;
  const difficulty = pick<Difficulty>(['easy', 'medium', 'medium', 'hard']);
  const stadium = pick(STADIUM_IDS);
  const party = rnd() < 0.25 ? pick(PARTY_IDS) : null;
  const goal = pick<GoalKind>(['win', 'winBy', 'score', 'clean', 'header', 'super', 'block']);
  const n = goal === 'winBy' ? 2 : goal === 'score' ? (difficulty === 'hard' ? 2 : 3) : 1;
  return { date, hero, opponent, difficulty, stadium, party, goal, n, reward: DAILY_REWARD };
}

/** did the human (player 0) do it? */
export function dailyDone(c: DailyChallenge, s: MatchSummary): boolean {
  const won = s.winner === 0;
  const [mine, theirs] = s.score;
  switch (c.goal) {
    case 'win':
      return won;
    case 'winBy':
      return won && mine - theirs >= c.n;
    case 'score':
      return mine >= c.n;
    case 'clean':
      return won && theirs === 0;
    case 'header':
      return s.headerGoals[0] >= c.n;
    case 'super':
      return s.superGoals[0] >= c.n;
    case 'block':
      return s.blocks[0] >= c.n;
  }
}
