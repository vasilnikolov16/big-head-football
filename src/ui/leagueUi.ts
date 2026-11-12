import { getCharacter } from '../game/characters';
import { dailyChallenge, type DailyChallenge } from '../game/daily';
import { nextOpponent, points, standings } from '../game/league';
import type { LeagueRun } from '../game/progress';
import { PARTY_MODES, STADIUMS } from '../game/stadiums';
import { t, tr } from '../i18n/i18n';
import { heroPortrait } from './portrait';
import { button, h, optionRow, type NavItem, type Screen } from './ui';

// ------------------------------------------------------------------ league

export interface LeagueOptions {
  run: LeagueRun | null;
  difficulty: () => LeagueRun['difficulty'];
  setDifficulty: (d: LeagueRun['difficulty']) => void;
  /** pick a hero and start a new season */
  start: () => void;
  play: () => void;
  abandon: () => void;
  back: () => void;
}

const heroName = (id: string): string => tr(getCharacter(id).name);

/** League: a new season, or the table with the next match. */
export function leagueScreen(o: LeagueOptions): Screen {
  const root = h('div', 'scr scr-panel league');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('league.title')));
  const run = o.run;

  if (!run) {
    box.append(h('p', 'desc', t('league.intro')));
    const diff = optionRow<LeagueRun['difficulty']>(
      t('cpu.difficulty'),
      [
        { value: 'easy', label: t('diff.easy') },
        { value: 'medium', label: t('diff.medium') },
        { value: 'hard', label: t('diff.hard') },
      ],
      o.difficulty,
      (v) => o.setDifficulty(v),
    );
    const go = button(t('league.start'), o.start, 'btn btn-go');
    box.append(diff.el, h('div', 'row-buttons', undefined, [go.el]));
    return { id: 'league', root, items: [diff, go], initial: 1, back: o.back };
  }

  // stage line
  const stage =
    run.stage === 'season'
      ? t('league.round', { n: run.round + 1 })
      : run.stage === 'semi'
        ? t('league.semi')
        : run.stage === 'final'
          ? t('league.final')
          : run.champion
            ? t('league.champion')
            : t('league.over');
  box.append(h('div', `league-stage${run.stage === 'done' && run.champion ? ' gold' : ''}`, stage));

  // table
  const table = h('div', 'league-table');
  table.append(
    h('div', 'lt-row lt-head', undefined, [
      h('span', 'lt-pos', '#'),
      h('span', 'lt-name', t('league.team')),
      ...['P', 'W', 'D', 'L'].map((k) => h('span', 'lt-num', t(`league.col.${k}`))),
      h('span', 'lt-goals', t('league.col.G')),
      h('span', 'lt-pts', t('league.col.Pts')),
    ]),
  );
  const order = standings(run);
  order.forEach((ti, pos) => {
    const tm = run.teams[ti];
    const row = h('div', `lt-row${ti === 0 ? ' me' : ''}${pos < 4 ? ' top' : ''}`);
    const pic = heroPortrait(getCharacter(tm.hero), 30);
    row.append(
      h('span', 'lt-pos', String(pos + 1)),
      h('span', 'lt-name', undefined, [pic, h('span', '', heroName(tm.hero) + (ti === 0 ? ` (${t('you')})` : ''))]),
      ...[tm.p, tm.w, tm.d, tm.l].map((v) => h('span', 'lt-num', String(v))),
      h('span', 'lt-goals', `${tm.gf}:${tm.ga}`),
      h('span', 'lt-pts', String(points(tm))),
    );
    table.append(row);
  });

  // last results
  const results = h('div', 'league-results');
  if (run.last) {
    for (const line of run.last.split(';')) {
      const [a, sa, sb, b] = line.split('|');
      results.append(h('span', 'lr', `${heroName(a)} ${sa}:${sb} ${heroName(b)}`));
    }
  }

  const items: NavItem[] = [];
  const btns: HTMLElement[] = [];
  if (run.stage !== 'done') {
    const opp = nextOpponent(run);
    const oppHero = run.teams[opp]?.hero;
    const play = button(t('league.play', { n: oppHero ? heroName(oppHero) : '?' }), o.play, 'btn btn-go');
    items.push(play);
    btns.push(play.el);
  }
  let armed = false;
  const abandon = button(
    run.stage === 'done' ? t('league.new') : t('league.abandon'),
    () => {
      if (run.stage !== 'done' && !armed) {
        armed = true;
        abandon.el.querySelector('.btn-label')!.textContent = t('league.abandonConfirm');
        return;
      }
      o.abandon();
    },
    run.stage === 'done' ? 'btn btn-go' : 'btn btn-alt btn-small',
  );
  items.push(abandon);
  btns.push(abandon.el);
  box.append(h('div', 'league-body', undefined, [table, results]), h('div', 'row-buttons', undefined, btns));
  return { id: 'league', root, items, back: o.back };
}

// ------------------------------------------------------------------ daily challenge

/** the task in words, e.g. "Score 3 goals with Granny Gitsa vs Rex" */
export function dailyText(c: DailyChallenge): string {
  return t(`daily.goal.${c.goal}`, { n: c.n, h: heroName(c.hero), o: heroName(c.opponent) });
}

export function dailyDetails(c: DailyChallenge): string {
  const st = STADIUMS[c.stadium];
  const parts = [t(`diff.${c.difficulty}`), st.icon + ' ' + tr(st.name), t('sec', { n: 60 })];
  if (c.party) parts.push(PARTY_MODES[c.party].icon + ' ' + tr(PARTY_MODES[c.party].name));
  return parts.join(' · ');
}

export function dailyScreen(o: { done: boolean; play: () => void; back: () => void }): Screen {
  const c = dailyChallenge();
  const root = h('div', 'scr scr-panel daily');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('daily.title')));
  const card = h('div', 'daily-card');
  card.append(
    heroPortrait(getCharacter(c.hero), 96, { happy: true }),
    h('div', 'daily-info', undefined, [h('div', 'daily-task', dailyText(c)), h('div', 'daily-details', dailyDetails(c)), h('div', 'daily-reward', o.done ? '✓ ' + t('daily.doneToday') : t('daily.reward', { n: c.reward }))]),
    heroPortrait(getCharacter(c.opponent), 96),
  );
  box.append(card, h('p', 'desc small', t('daily.note')));
  const play = button(o.done ? t('daily.again') : t('daily.play'), o.play, 'btn btn-go');
  box.append(h('div', 'row-buttons', undefined, [play.el]));
  return { id: 'daily', root, items: [play], back: o.back };
}
