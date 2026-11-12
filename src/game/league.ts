import { CHARACTERS, getCharacter } from './characters';
import type { LeagueRun, LeagueTeam } from './progress';

/**
 * League season: 8 teams (heroes), everyone plays everyone once (7 rounds,
 * 3 points a win, 1 a draw). The top 4 go to the play-offs: semi-finals
 * (1–4, 2–3) and a final, where a draw is decided by a golden goal.
 * The player is always team 0; the other matches are simulated.
 */

export const LEAGUE_WIN_COINS = 500;

const team = (hero: string): LeagueTeam => ({ hero, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 });

/** circle method: 8 teams -> 7 rounds of 4 matches */
function schedule(n: number): Array<Array<[number, number]>> {
  const ids = Array.from({ length: n }, (_, i) => i);
  const rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < n / 2; i++) pairs.push([ids[i], ids[n - 1 - i]]);
    rounds.push(pairs);
    // keep the first fixed, rotate the rest
    ids.splice(1, 0, ids.pop()!);
  }
  return rounds;
}

export function newLeague(hero: string, difficulty: LeagueRun['difficulty']): LeagueRun {
  const others = CHARACTERS.filter((c) => c.id !== hero)
    .sort(() => Math.random() - 0.5)
    .slice(0, 7)
    .map((c) => c.id);
  return {
    hero,
    difficulty,
    teams: [team(hero), ...others.map(team)],
    rounds: schedule(8),
    round: 0,
    stage: 'season',
    opponent: -1,
    champion: false,
    last: '',
  };
}

/** the player's opponent this round (team index) */
export function nextOpponent(run: LeagueRun): number {
  if (run.stage === 'season') {
    const pair = run.rounds[run.round]?.find(([a, b]) => a === 0 || b === 0);
    return pair ? (pair[0] === 0 ? pair[1] : pair[0]) : -1;
  }
  return run.opponent;
}

const strength = (hero: string): number => {
  const s = getCharacter(hero).stats;
  return s.speed + s.jump + s.power + s.head;
};

/** a believable random score for two computer teams */
function simulate(a: string, b: string): [number, number] {
  const edge = (strength(a) - strength(b)) * 0.12;
  const goals = (mean: number): number => {
    let g = 0;
    for (let i = 0; i < 6; i++) if (Math.random() < mean / 6) g++;
    return g;
  };
  return [goals(Math.max(0.4, 1.7 + edge)), goals(Math.max(0.4, 1.7 - edge))];
}

function add(t: LeagueTeam, gf: number, ga: number): void {
  t.p++;
  t.gf += gf;
  t.ga += ga;
  if (gf > ga) t.w++;
  else if (gf === ga) t.d++;
  else t.l++;
}

export const points = (t: LeagueTeam): number => t.w * 3 + t.d;

/** table order: points, goal difference, goals scored */
export function standings(run: LeagueRun): number[] {
  return run.teams
    .map((_, i) => i)
    .sort((x, y) => {
      const a = run.teams[x];
      const b = run.teams[y];
      return points(b) - points(a) || b.gf - b.ga - (a.gf - a.ga) || b.gf - a.gf || x - y;
    });
}

/**
 * Records the player's result (goals for / against) and plays the rest of the
 * round / the other semi-final. Returns true when the season is over.
 */
export function playRound(run: LeagueRun, gf: number, ga: number, won: boolean): void {
  const name = (i: number): string => getCharacter(run.teams[i].hero).id;
  if (run.stage === 'season') {
    const lines: string[] = [];
    for (const [a, b] of run.rounds[run.round]) {
      let sa: number;
      let sb: number;
      if (a === 0 || b === 0) {
        [sa, sb] = a === 0 ? [gf, ga] : [ga, gf];
      } else [sa, sb] = simulate(run.teams[a].hero, run.teams[b].hero);
      add(run.teams[a], sa, sb);
      add(run.teams[b], sb, sa);
      lines.push(`${name(a)}|${sa}|${sb}|${name(b)}`);
    }
    run.last = lines.join(';');
    run.round++;
    if (run.round >= run.rounds.length) {
      const order = standings(run);
      const pos = order.indexOf(0);
      if (pos > 3) {
        run.stage = 'done';
        run.champion = false;
        return;
      }
      // semi-finals 1–4 and 2–3
      run.stage = 'semi';
      run.opponent = order[3 - pos];
    }
    return;
  }
  if (run.stage === 'semi') {
    if (!won) {
      run.stage = 'done';
      run.champion = false;
      return;
    }
    // the other semi-final, simulated
    const order = standings(run);
    const me = order.indexOf(0);
    const rest = order.slice(0, 4).filter((i) => i !== 0 && i !== order[3 - me]);
    const [x, y] = rest;
    let [sx, sy] = simulate(run.teams[x].hero, run.teams[y].hero);
    if (sx === sy) Math.random() < 0.5 ? sx++ : sy++;
    run.last = `${name(x)}|${sx}|${sy}|${name(y)}`;
    run.opponent = sx > sy ? x : y;
    run.stage = 'final';
    return;
  }
  if (run.stage === 'final') {
    run.stage = 'done';
    run.champion = won;
  }
}
