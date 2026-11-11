import type { Difficulty } from '../ai/aiController';
import type { Settings } from '../core/storage';
import type { Match } from '../game/match';
import { drawBall } from '../render/ballDraw';
import { button, h, keycap, optionRow, type NavItem, type Screen } from './ui';

export type MatchMode = 'cpu' | 'pvp' | 'demo';

/** What the screens can ask the game to do. */
export interface AppActions {
  settings: Settings;
  saveSettings(): void;
  showMain(): void;
  showCpuSetup(): void;
  showHowTo(back: () => void): void;
  showSettings(back: () => void): void;
  startCpu(): void;
  startPvp(): void;
  rematch(): void;
  changeHeroes(): void;
  resume(): void;
  restart(): void;
  quitToMenu(): void;
}

const DIFFICULTIES: Array<{ value: Difficulty; label: string }> = [
  { value: 'easy', label: 'Лесно' },
  { value: 'medium', label: 'Средно' },
  { value: 'hard', label: 'Трудно' },
];

function logo(): HTMLElement {
  const wrap = h('div', 'logo');
  const ball = document.createElement('canvas');
  ball.className = 'logo-ball';
  ball.width = 120;
  ball.height = 120;
  const g = ball.getContext('2d')!;
  g.scale(2, 2);
  drawBall(g, 30, 30, 26, 0.4);
  wrap.append(h('div', 'logo-title', 'КРАТУН'), ball, h('div', 'logo-title', 'БОЛ'));
  const sub = h('div', 'logo-sub', 'футбол с големи глави');
  return h('div', 'logo-wrap', undefined, [wrap, sub]);
}

function hints(text: string): HTMLElement {
  return h('div', 'hints', text);
}

function panel(title: string, cls = ''): { root: HTMLElement; body: HTMLElement } {
  const root = h('div', `scr scr-panel ${cls}`);
  const box = h('div', 'panel');
  box.append(h('h2', 'panel-title', title));
  const body = h('div', 'panel-body');
  box.append(body);
  root.append(box);
  return { root, body };
}

// ------------------------------------------------------------------ main menu

export function mainMenu(app: AppActions): Screen {
  const root = h('div', 'scr scr-main');
  root.append(logo());
  const list = h('div', 'menu-list');
  const items: NavItem[] = [
    button('Срещу компютъра', () => app.showCpuSetup()),
    button('Двама играчи', () => app.startPvp()),
    button('Турнир', () => {}, 'btn', true, 'скоро'),
    button('Как се играе', () => app.showHowTo(() => app.showMain()), 'btn btn-alt'),
    button('Настройки', () => app.showSettings(() => app.showMain()), 'btn btn-alt'),
  ];
  for (const it of items) list.append(it.el);
  root.append(list);
  root.append(hints('↑ ↓ избор   ·   Enter избери'));
  return { id: 'main', root, items };
}

// ------------------------------------------------------------------ vs CPU setup

export function cpuSetup(app: AppActions): Screen {
  const { root, body } = panel('Срещу компютъра');
  const s = app.settings;
  const diff = optionRow(
    'Трудност',
    DIFFICULTIES,
    () => s.difficulty,
    (v) => {
      s.difficulty = v;
      app.saveSettings();
      updateDesc();
    },
  );
  const ctrl = optionRow<'wasd' | 'arrows'>(
    'Управление',
    [
      { value: 'wasd', label: 'WASD' },
      { value: 'arrows', label: 'Стрелки' },
    ],
    () => s.humanScheme,
    (v) => {
      s.humanScheme = v;
      app.saveSettings();
    },
  );
  const dur = durationRow(app);
  const desc = h('p', 'desc');
  const updateDesc = (): void => {
    desc.textContent =
      s.difficulty === 'easy'
        ? 'Бавен, мисли дълго и често греши. За загрявка.'
        : s.difficulty === 'medium'
          ? 'Чете траекторията, пази вратата и отвръща на удара.'
          : 'Безмилостен: предвижда всичко, засича ударите с глава и не прощава.';
  };
  updateDesc();
  const start = button('Започни мача', () => app.startCpu(), 'btn btn-go');
  const back = button('Назад', () => app.showMain(), 'btn btn-alt btn-small');
  body.append(diff.el, desc, ctrl.el, dur.el, h('div', 'row-buttons', undefined, [start.el, back.el]));
  return { id: 'cpu', root, items: [diff, ctrl, dur, start, back], back: () => app.showMain(), initial: 3 };
}

function durationRow(app: AppActions): NavItem {
  return optionRow<30 | 60 | 90>(
    'Продължителност',
    [
      { value: 30, label: '30 сек' },
      { value: 60, label: '60 сек' },
      { value: 90, label: '90 сек' },
    ],
    () => app.settings.duration,
    (v) => {
      app.settings.duration = v;
      app.saveSettings();
    },
  );
}

// ------------------------------------------------------------------ how to play

function controlsCard(title: string, color: string, keys: Array<[HTMLElement[], string]>): HTMLElement {
  const card = h('div', 'ctrl-card');
  card.style.setProperty('--team', color);
  card.append(h('h3', '', title));
  for (const [caps, label] of keys) {
    const row = h('div', 'ctrl-row');
    const kk = h('div', 'ctrl-keys');
    caps.forEach((c) => kk.append(c));
    row.append(kk, h('span', 'ctrl-label', label));
    card.append(row);
  }
  return card;
}

export function howToPlay(back: () => void): Screen {
  const { root, body } = panel('Как се играе', 'wide');
  const cards = h('div', 'ctrl-cards');
  cards.append(
    controlsCard('Играч 1 · ляв', '#ff4d4d', [
      [[keycap('A'), keycap('D')], 'движение'],
      [[keycap('W')], 'скок (задръж = по-високо)'],
      [[keycap('S')], 'ритник'],
      [[keycap('L Shift', true)], 'супер удар'],
    ]),
    controlsCard('Играч 2 · десен', '#2f8cff', [
      [[keycap('←'), keycap('→')], 'движение'],
      [[keycap('↑')], 'скок (задръж = по-високо)'],
      [[keycap('↓')], 'ритник'],
      [[keycap('R Shift', true), keycap('Enter', true)], 'супер удар'],
    ]),
  );
  const tips = h('ul', 'tips');
  for (const t of [
    'Ритникът е най-силен, ако го натиснеш малко преди топката да стигне до крака. Късният ритник праща топката високо.',
    'Ударът с глава отскача по-живо, особено ако скочиш срещу топката.',
    'Голът се брои, когато цялата топка мине линията под гредата.',
    'При равенство след края на времето — златен гол: следващият печели.',
    'Esc или P — пауза. Срещу компютъра можеш да играеш с WASD или стрелките.',
  ])
    tips.append(h('li', '', t));
  const ok = button('Разбрах!', back, 'btn btn-go btn-small');
  body.append(cards, tips, h('div', 'row-buttons', undefined, [ok.el]));
  return { id: 'howto', root, items: [ok], back };
}

// ------------------------------------------------------------------ settings

export function settingsScreen(app: AppActions, back: () => void): Screen {
  const { root, body } = panel('Настройки');
  const dur = durationRow(app);
  const diff = optionRow(
    'Трудност (комп.)',
    DIFFICULTIES,
    () => app.settings.difficulty,
    (v) => {
      app.settings.difficulty = v;
      app.saveSettings();
    },
  );
  const ok = button('Готово', back, 'btn btn-go btn-small');
  body.append(dur.el, diff.el, h('p', 'desc', 'Звук, музика и бонуси идват в следващите етапи.'), h('div', 'row-buttons', undefined, [ok.el]));
  return { id: 'settings', root, items: [dur, diff, ok], back };
}

// ------------------------------------------------------------------ pause

export function pauseScreen(app: AppActions): Screen {
  const { root, body } = panel('Пауза', 'pause');
  const items = [
    button('Продължи', () => app.resume(), 'btn btn-go'),
    button('Започни отначало', () => app.restart()),
    button('Как се играе', () => app.showHowTo(() => app.resume()), 'btn btn-alt'),
    button('Към менюто', () => app.quitToMenu(), 'btn btn-alt'),
  ];
  const list = h('div', 'menu-list compact');
  items.forEach((i) => list.append(i.el));
  body.append(list);
  return {
    id: 'pause',
    root,
    items,
    back: () => app.resume(),
    onKey: (code) => {
      if (code === 'KeyP') {
        app.resume();
        return true;
      }
      return false;
    },
  };
}

// ------------------------------------------------------------------ post match

export function postMatch(app: AppActions, m: Match, mode: MatchMode): Screen {
  const root = h('div', 'scr scr-panel post');
  const box = h('div', 'panel');
  root.append(box);

  let title: string;
  let cls: string;
  if (mode === 'cpu') {
    title = m.winner === 0 ? 'ПОБЕДА!' : m.winner === 1 ? 'ЗАГУБА' : 'РАВЕНСТВО';
    cls = m.winner === 0 ? 'win' : m.winner === 1 ? 'lose' : 'draw';
  } else {
    title = m.winner < 0 ? 'РАВЕНСТВО' : `ПЕЧЕЛИ ${m.config.names[m.winner].toUpperCase()}!`;
    cls = m.winner < 0 ? 'draw' : 'win';
  }
  box.append(h('h2', `result ${cls}`, title));
  if (m.golden) box.append(h('div', 'golden-tag', 'решено със златен гол'));

  const score = h('div', 'score-row');
  for (let i = 0; i < 2; i++) {
    const side = h('div', `score-side s${i}`);
    side.style.setProperty('--team', m.players[i].char.look.shirt);
    side.append(h('div', 'score-name', m.config.names[i]), h('div', 'score-tag', m.config.tags[i]));
    score.append(side);
    if (i === 0) score.append(h('div', 'score-num', `${m.score[0]} : ${m.score[1]}`));
  }
  box.append(score);

  const [a, b] = m.players;
  const totalPos = m.possession[0] + m.possession[1] || 1;
  const posA = Math.round((m.possession[0] / totalPos) * 100);
  const rows: Array<[string, number, number, boolean?]> = [
    ['Удари', a.stats.shots, b.stats.shots],
    ['Удари с глава', a.stats.headers, b.stats.headers],
    ['Докосвания', a.stats.touches, b.stats.touches],
    ['Скокове', a.stats.jumps, b.stats.jumps],
    ['Владеене %', posA, 100 - posA, true],
  ];
  const table = h('div', 'stats');
  for (const [label, va, vb] of rows) {
    const row = h('div', 'stat-row');
    const total = va + vb || 1;
    const bar = h('div', 'stat-bar');
    const fa = h('div', 'stat-fill a');
    fa.style.width = `${(va / total) * 100}%`;
    fa.style.background = a.char.look.shirt;
    const fb = h('div', 'stat-fill b');
    fb.style.width = `${(vb / total) * 100}%`;
    fb.style.background = b.char.look.shirt;
    bar.append(fa, fb);
    row.append(h('span', 'stat-v', String(va)), h('div', 'stat-mid', undefined, [h('span', 'stat-label', label), bar]), h('span', 'stat-v', String(vb)));
    table.append(row);
  }
  box.append(table);

  const items = [
    button('Реванш', () => app.rematch(), 'btn btn-go'),
    button('Смени герой', () => app.changeHeroes()),
    button('Меню', () => app.quitToMenu(), 'btn btn-alt'),
  ];
  box.append(h('div', 'row-buttons', undefined, items.map((i) => i.el)));
  box.append(hints('← → избор   ·   Enter избери'));
  return { id: 'post', root, items, back: () => app.quitToMenu() };
}
