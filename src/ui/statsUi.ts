import { ACHIEVEMENTS, type Career } from '../game/career';
import { CHARACTERS, getCharacter } from '../game/characters';
import { t, tr } from '../i18n/i18n';
import { heroPortrait } from './portrait';
import { button, h, type NavItem, type Screen, type UI } from './ui';

type Tab = 'stats' | 'ach';

/** Career numbers, records, unlocked heroes and the achievements wall. */
export function statsScreen(career: Career, ui: UI, back: () => void, tab: Tab = 'stats'): Screen {
  const p = career.p;
  const st = p.stats;
  const root = h('div', 'scr scr-panel stats-screen');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('stats.title')));

  const go = (next: Tab): void => ui.show(statsScreen(career, ui, back, next), true);
  const bar = h('div', 'tabs');
  for (const name of ['stats', 'ach'] as Tab[]) {
    const b = h('button', `tab${name === tab ? ' on' : ''}`, t(name === 'stats' ? 'stats.tab.stats' : 'stats.tab.ach'));
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (name !== tab) go(name);
    });
    bar.append(b);
  }
  const tabItem: NavItem = { el: bar, left: () => go(tab === 'stats' ? 'ach' : 'stats'), right: () => go(tab === 'stats' ? 'ach' : 'stats') };
  box.append(bar);

  const got = ACHIEVEMENTS.filter((a) => career.has(a.id)).length;
  if (tab === 'stats') {
    const none = t('stats.none');
    const fav = Object.entries(st.heroGames).sort((a, b) => b[1] - a[1])[0];
    const tiles: Array<[string, string]> = [
      [t('stats.played'), String(st.played)],
      [t('stats.cpuRecord'), `${st.cpuWon} / ${st.cpuLost}`],
      [t('stats.pvp'), String(st.pvpPlayed)],
      [t('stats.goals'), String(st.goals)],
      [t('stats.conceded'), String(st.conceded)],
      [t('stats.supers'), String(st.supers)],
      [t('stats.powerups'), String(st.powerups)],
      [t('stats.perfect'), String(st.perfectKicks)],
      [t('stats.cups'), '🏆 ' + st.cupsWon],
      [t('stats.bestWin'), st.bestWinScore || none],
      [t('stats.mostGoals'), String(st.mostGoals)],
      [t('stats.fastest'), st.fastestGoal ? t('sec', { n: st.fastestGoal.toFixed(1) }) : none],
      [t('stats.streak'), String(st.longestStreak)],
      [t('stats.favHero'), fav ? tr(getCharacter(fav[0]).name) : none],
    ];
    const grid = h('div', 'stat-tiles');
    for (const [label, value] of tiles) grid.append(h('div', 'tile', undefined, [h('div', 'tile-v', value), h('div', 'tile-l', label)]));
    box.append(grid);
    const heroes = h('div', 'hero-strip');
    for (const c of CHARACTERS) {
      const open = career.isUnlocked(c.id);
      const cell = h('div', `hero-mini${open ? '' : ' locked'}`, undefined, [heroPortrait(c, 52, { silhouette: !open })]);
      cell.title = open ? tr(c.name) : t('sel.locked');
      heroes.append(cell);
    }
    box.append(h('div', 'strip-title', `${t('stats.heroes')}: ${p.unlocked.length} / ${CHARACTERS.length}`), heroes);
  } else {
    box.append(h('div', 'strip-title', t('stats.achProgress', { a: got, b: ACHIEVEMENTS.length })));
    const prog = h('div', 'ach-progress');
    const fill = h('div', 'ach-fill');
    fill.style.width = `${(got / ACHIEVEMENTS.length) * 100}%`;
    prog.append(fill);
    box.append(prog);
    const grid = h('div', 'ach-grid');
    for (const a of ACHIEVEMENTS) {
      const done = career.has(a.id);
      grid.append(
        h('div', `ach${done ? ' done' : ''}`, undefined, [
          h('div', 'ach-icon', done ? a.icon : '🔒'),
          h('div', 'ach-text', undefined, [h('div', 'ach-name', tr(a.name)), h('div', 'ach-desc', tr(a.desc))]),
        ]),
      );
    }
    box.append(grid);
  }

  const ok = button(t('back'), back, 'btn btn-go btn-small');
  box.append(h('div', 'row-buttons', undefined, [ok.el]));
  return {
    id: 'stats',
    root,
    items: [tabItem, ok],
    initial: 0,
    back,
    onKey: (code) => {
      if (code === 'KeyQ' || code === 'KeyE') {
        tabItem.right!();
        return true;
      }
      return false;
    },
  };
}
