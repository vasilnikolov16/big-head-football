import type { Difficulty } from '../ai/aiController';
import { CHARACTERS } from './characters';
import { loadProgress, saveProgress, freshProgress, type Progress, type TournamentRun } from './progress';
import type { MatchSummary } from './tracker';

type L = { bg: string; en: string };

export interface Achievement {
  id: string;
  icon: string;
  name: L;
  desc: L;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_goal', icon: '⚽', name: { bg: 'Първи гол', en: 'First goal' }, desc: { bg: 'Вкарай гол.', en: 'Score a goal.' } },
  { id: 'first_win', icon: '🥇', name: { bg: 'Първа победа', en: 'First win' }, desc: { bg: 'Спечели мач срещу компютъра.', en: 'Win a match against the computer.' } },
  { id: 'hat_trick', icon: '🎩', name: { bg: 'Хеттрик', en: 'Hat-trick' }, desc: { bg: 'Вкарай 3 гола в един мач.', en: 'Score 3 goals in one match.' } },
  { id: 'clean_sheet', icon: '🧤', name: { bg: 'Суха мрежа', en: 'Clean sheet' }, desc: { bg: 'Спечели, без да допуснеш гол.', en: 'Win without conceding.' } },
  { id: 'comeback', icon: '🔄', name: { bg: 'Обрат', en: 'Comeback' }, desc: { bg: 'Спечели, след като си губил с 2 гола.', en: 'Win after being 2 goals down.' } },
  { id: 'golden', icon: '🌟', name: { bg: 'Златно момче', en: 'Golden boy' }, desc: { bg: 'Спечели със златен гол.', en: 'Win with a golden goal.' } },
  { id: 'super_goal', icon: '⚡', name: { bg: 'Супер!', en: 'Super!' }, desc: { bg: 'Вкарай гол със супер удар.', en: 'Score with a super shot.' } },
  { id: 'super_collector', icon: '🎴', name: { bg: 'Колекционер', en: 'Collector' }, desc: { bg: 'Вкарай супер гол с 4 различни героя.', en: 'Score a super goal with 4 different heroes.' } },
  { id: 'header_goal', icon: '🧠', name: { bg: 'Главата мисли', en: 'Use your head' }, desc: { bg: 'Вкарай гол с глава.', en: 'Score a header.' } },
  { id: 'sniper', icon: '🎯', name: { bg: 'Снайперист', en: 'Sniper' }, desc: { bg: '5 перфектни ритника в един мач.', en: '5 perfectly timed kicks in one match.' } },
  { id: 'cold_shower', icon: '🧊', name: { bg: 'Студен душ', en: 'Cold shower' }, desc: { bg: 'Вкарай, докато противникът е замразен.', en: 'Score while the opponent is frozen.' } },
  { id: 'hunter', icon: '🎁', name: { bg: 'Ловец на бонуси', en: 'Power hunter' }, desc: { bg: 'Вземи общо 15 бонуса.', en: 'Collect 15 power-ups in total.' } },
  { id: 'lightning', icon: '🚀', name: { bg: 'Светкавица', en: 'Lightning' }, desc: { bg: 'Вкарай до 3 секунди след началния удар.', en: 'Score within 3 seconds of kick-off.' } },
  { id: 'rout', icon: '💥', name: { bg: 'Разгром', en: 'Rout' }, desc: { bg: 'Спечели с 5 или повече гола разлика.', en: 'Win by 5 or more goals.' } },
  { id: 'no_mercy', icon: '😈', name: { bg: 'Без милост', en: 'No mercy' }, desc: { bg: 'Победи компютъра на „Трудно“.', en: 'Beat the computer on Hard.' } },
  { id: 'streak3', icon: '🔥', name: { bg: 'В серия', en: 'On fire' }, desc: { bg: '3 поредни победи срещу компютъра.', en: '3 wins in a row against the computer.' } },
  { id: 'online_win', icon: '🌐', name: { bg: 'Световна звезда', en: 'World star' }, desc: { bg: 'Спечели онлайн мач.', en: 'Win an online match.' } },
  { id: 'friendly', icon: '🤝', name: { bg: 'Приятелски мач', en: 'Friendly' }, desc: { bg: 'Изиграй мач за двама.', en: 'Play a two-player match.' } },
  { id: 'veteran', icon: '🎖️', name: { bg: 'Ветеран', en: 'Veteran' }, desc: { bg: 'Изиграй 25 мача.', en: 'Play 25 matches.' } },
  { id: 'champion', icon: '🏆', name: { bg: 'Шампион', en: 'Champion' }, desc: { bg: 'Спечели турнира.', en: 'Win the tournament.' } },
  { id: 'flawless', icon: '👑', name: { bg: 'Непобедим', en: 'Invincible' }, desc: { bg: 'Спечели турнира без нито една загуба.', en: 'Win the tournament without a loss.' } },
  { id: 'full_squad', icon: '🧑‍🤝‍🧑', name: { bg: 'Пълен отбор', en: 'Full squad' }, desc: { bg: 'Отключи всички герои.', en: 'Unlock every hero.' } },
];

export const TOURNAMENT_DIFFICULTY = (round: number): Difficulty => (round < 2 ? 'easy' : round < 5 ? 'medium' : 'hard');

export interface MatchInfo {
  mode: 'cpu' | 'pvp' | 'tournament' | 'online' | 'party' | 'league' | 'daily';
  /** indices of the human players */
  humans: number[];
  heroes: [string, string];
  difficulty: Difficulty;
  summary: MatchSummary;
}

export interface CareerResult {
  achievements: Achievement[];
  unlockedHeroes: string[];
  /** tournament: the round was won / the cup was won */
  roundWon: boolean;
  cupWon: boolean;
  flawless: boolean;
}

/** Owns the saved progress: records matches, unlocks heroes and achievements, runs the tournament. */
export class Career {
  p: Progress = loadProgress();

  save(): void {
    saveProgress(this.p);
  }

  reset(): void {
    this.p = freshProgress();
    this.save();
  }

  isUnlocked(id: string): boolean {
    return this.p.unlocked.includes(id);
  }

  has(id: string): boolean {
    return this.p.achievements[id] !== undefined;
  }

  private award(id: string, out: Achievement[]): void {
    if (this.has(id)) return;
    this.p.achievements[id] = Date.now();
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (a) out.push(a);
  }

  private unlockHero(id: string, out: string[]): void {
    if (this.isUnlocked(id)) return;
    this.p.unlocked.push(id);
    out.push(id);
  }

  // ------------------------------------------------------------------ tournament

  startTournament(hero: string): TournamentRun {
    const others = CHARACTERS.filter((c) => c.id !== hero);
    const locked = others.filter((c) => c.unlock === 'tournament'); // the final bosses
    const open = others
      .filter((c) => c.unlock !== 'tournament')
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.max(0, 7 - locked.length));
    const run: TournamentRun = { hero, order: [...open, ...locked].map((c) => c.id), round: 0, losses: 0 };
    this.p.tournament = run;
    this.save();
    return run;
  }

  abandonTournament(): void {
    this.p.tournament = null;
    this.save();
  }

  // ------------------------------------------------------------------ matches

  record(info: MatchInfo): CareerResult {
    const st = this.p.stats;
    const s = info.summary;
    const res: CareerResult = { achievements: [], unlockedHeroes: [], roundWon: false, cupWon: false, flawless: false };
    const vsCpu = info.mode === 'cpu' || info.mode === 'tournament' || info.mode === 'league' || info.mode === 'daily';
    const online = info.mode === 'online';
    st.played++;
    if (info.mode === 'pvp') {
      st.pvpPlayed++;
      this.award('friendly', res.achievements);
    }

    for (const h of info.humans) {
      const o = 1 - h;
      const goals = s.score[h];
      const against = s.score[o];
      const won = s.winner === h;
      st.goals += goals;
      st.conceded += vsCpu || online ? against : 0;
      st.supers += s.supers[h];
      st.powerups += s.powerups[h];
      st.perfectKicks += s.perfectKicks[h];
      st.heroGames[info.heroes[h]] = (st.heroGames[info.heroes[h]] ?? 0) + 1;
      st.mostGoals = Math.max(st.mostGoals, goals);
      if (s.fastestGoal[h] > 0 && (st.fastestGoal === 0 || s.fastestGoal[h] < st.fastestGoal)) st.fastestGoal = s.fastestGoal[h];
      if (won && goals - against > st.bestWinMargin) {
        st.bestWinMargin = goals - against;
        st.bestWinScore = `${goals}:${against}`;
      }
      if (s.superGoals[h] > 0 && !st.superGoalHeroes.includes(info.heroes[h])) st.superGoalHeroes.push(info.heroes[h]);

      if (online) {
        st.onlinePlayed++;
        if (won) {
          st.onlineWon++;
          this.award('online_win', res.achievements);
        } else if (s.winner === o) st.onlineLost++;
      }
      if (vsCpu) {
        if (won) {
          st.cpuWon++;
          st.streak++;
          st.longestStreak = Math.max(st.longestStreak, st.streak);
        } else if (s.winner === o) {
          st.cpuLost++;
          st.streak = 0;
        }
      }

      const a = res.achievements;
      if (goals > 0) this.award('first_goal', a);
      if (won && vsCpu) this.award('first_win', a);
      if (goals >= 3) this.award('hat_trick', a);
      if (won && against === 0) this.award('clean_sheet', a);
      if (won && s.worstDeficit[h] <= -2) this.award('comeback', a);
      if (won && s.golden) this.award('golden', a);
      if (s.superGoals[h] > 0) this.award('super_goal', a);
      if (st.superGoalHeroes.length >= 4) this.award('super_collector', a);
      if (s.headerGoals[h] > 0) this.award('header_goal', a);
      if (s.perfectKicks[h] >= 5) this.award('sniper', a);
      if (s.frozenGoals[h] > 0) this.award('cold_shower', a);
      if (st.powerups >= 15) this.award('hunter', a);
      if (s.fastestGoal[h] > 0 && s.fastestGoal[h] <= 3) this.award('lightning', a);
      if (won && goals - against >= 5) this.award('rout', a);
      if (won && vsCpu && info.difficulty === 'hard') this.award('no_mercy', a);
      if (vsCpu && st.streak >= 3) this.award('streak3', a);
    }
    if (st.played >= 25) this.award('veteran', res.achievements);

    // tournament progress
    const run = this.p.tournament;
    if (info.mode === 'tournament' && run) {
      if (s.winner === 0) {
        const beaten = run.order[run.round];
        this.unlockHero(beaten, res.unlockedHeroes);
        run.round++;
        res.roundWon = true;
        if (run.round >= run.order.length) {
          res.cupWon = true;
          res.flawless = run.losses === 0;
          st.cupsWon++;
          this.award('champion', res.achievements);
          if (res.flawless) this.award('flawless', res.achievements);
          this.p.tournament = null;
        }
      } else run.losses++;
    }
    if (CHARACTERS.every((c) => this.isUnlocked(c.id))) this.award('full_squad', res.achievements);
    this.save();
    return res;
  }
}
