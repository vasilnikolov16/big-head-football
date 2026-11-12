import type { Match } from './match';

/** What happened in one match, from both players' points of view. */
export interface MatchSummary {
  score: [number, number];
  winner: number;
  golden: boolean;
  /** goals per player that were super shots / headers */
  superGoals: [number, number];
  headerGoals: [number, number];
  /** goals scored while the opponent was frozen */
  frozenGoals: [number, number];
  /** fastest goal after a kick-off whistle, seconds (0 = none) */
  fastestGoal: [number, number];
  perfectKicks: [number, number];
  supers: [number, number];
  powerups: [number, number];
  /** worst score difference each player had to face during the match */
  worstDeficit: [number, number];
  /** super shots each player stopped */
  blocks: [number, number];
}

type Action = 'touch' | 'kick' | 'header' | 'super';

/** Listens to match events and builds a MatchSummary. */
export class MatchTracker {
  private s: MatchSummary = {
    score: [0, 0],
    winner: -1,
    golden: false,
    superGoals: [0, 0],
    headerGoals: [0, 0],
    frozenGoals: [0, 0],
    fastestGoal: [0, 0],
    perfectKicks: [0, 0],
    supers: [0, 0],
    powerups: [0, 0],
    worstDeficit: [0, 0],
    blocks: [0, 0],
  };
  private last: { player: number; action: Action } = { player: -1, action: 'touch' };
  private whistleAt = 0;

  constructor(private m: Match) {
    const ev = m.events;
    const s = this.s;
    ev.on('touch', (e) => (this.last = { player: e.player, action: 'touch' }));
    ev.on('kick', (e) => {
      this.last = { player: e.player, action: 'kick' };
      if (e.sweet > 0.75) s.perfectKicks[e.player]++;
    });
    ev.on('header', (e) => (this.last = { player: e.player, action: 'header' }));
    ev.on('superBlocked', (e) => s.blocks[e.player]++);
    ev.on('superShot', (e) => {
      this.last = { player: e.player, action: 'super' };
      s.supers[e.player]++;
    });
    ev.on('powerPick', (e) => s.powerups[e.player]++);
    ev.on('whistle', (e) => {
      if (e.kind === 'start') this.whistleAt = m.time;
    });
    ev.on('goal', (e) => {
      const p = e.scorer;
      const byScorer = this.last.player === p;
      if (byScorer && (this.last.action === 'super' || m.superShot?.owner === p)) s.superGoals[p]++;
      else if (byScorer && this.last.action === 'header') s.headerGoals[p]++;
      if (m.players[1 - p].frozenT > 0) s.frozenGoals[p]++;
      const since = m.time - this.whistleAt;
      if (s.fastestGoal[p] === 0 || since < s.fastestGoal[p]) s.fastestGoal[p] = since;
      for (const i of [0, 1]) {
        const diff = m.score[i] - m.score[1 - i];
        s.worstDeficit[i] = Math.min(s.worstDeficit[i], diff);
      }
    });
  }

  finish(): MatchSummary {
    const m = this.m;
    this.s.score = [m.score[0], m.score[1]];
    this.s.winner = m.winner;
    this.s.golden = m.golden;
    return this.s;
  }
}
