import type { Difficulty } from '../ai/aiController';
import type { Settings } from '../core/storage';
import type { Match } from '../game/match';
import { drawBall } from '../render/ballDraw';
import {
  ACTION_LABELS,
  ACTIONS,
  cloneBinding,
  DEFAULT_P1,
  DEFAULT_P2,
  keyLabel,
  RESERVED_KEYS,
  type Action,
  type Binding,
} from '../input/controls';
import { button, h, keycap, optionRow, sliderRow, type NavItem, type Screen, type UI } from './ui';

export type MatchMode = 'cpu' | 'pvp' | 'demo';

/** What the screens can ask the game to do. */
export interface AppActions {
  settings: Settings;
  saveSettings(): void;
  showMain(): void;
  showCpuSetup(): void;
  showHowTo(back: () => void): void;
  showSettings(back: () => void): void;
  showControls(back: () => void): void;
  onSettingsChanged(): void;
  readonly ui: UI;
  showHeroSelect(mode: 'cpu' | 'pvp'): void;
  startPvp(): void;
  rematch(): void;
  changeHeroes(): void;
  resume(): void;
  showPause(): void;
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
    'Твоите контроли',
    [
      { value: 'wasd', label: 'Играч 1' },
      { value: 'arrows', label: 'Играч 2' },
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
  const start = button('Избери герой ▸', () => app.showHeroSelect('cpu'), 'btn btn-go');
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

function bindingCaps(codes: string[]): HTMLElement[] {
  return codes.slice(0, 2).map((c) => keycap(keyLabel(c), keyLabel(c).length > 2));
}

function controlsCard(title: string, color: string, b: Binding): HTMLElement {
  const card = h('div', 'ctrl-card');
  card.style.setProperty('--team', color);
  card.append(h('h3', '', title));
  const rows: Array<[HTMLElement[], string]> = [
    [[...bindingCaps(b.left).slice(0, 1), ...bindingCaps(b.right).slice(0, 1)], 'движение'],
    [bindingCaps(b.jump), 'скок (задръж = по-високо)'],
    [bindingCaps(b.kick), 'ритник'],
    [bindingCaps(b.super), 'супер удар'],
  ];
  for (const [caps, label] of rows) {
    const row = h('div', 'ctrl-row');
    const kk = h('div', 'ctrl-keys');
    caps.forEach((c) => kk.append(c));
    row.append(kk, h('span', 'ctrl-label', label));
    card.append(row);
  }
  return card;
}

export function howToPlay(app: AppActions, back: () => void): Screen {
  const { root, body } = panel('Как се играе', 'wide');
  const cards = h('div', 'ctrl-cards');
  cards.append(
    controlsCard('Играч 1 · ляв', '#ff4d4d', app.settings.controls.p1),
    controlsCard('Играч 2 · десен', '#2f8cff', app.settings.controls.p2),
  );
  const tips = h('ul', 'tips');
  for (const t of [
    'Ритникът е най-силен, ако го натиснеш малко преди топката да стигне до крака. Късният ритник праща топката високо.',
    'Докосвай топката, за да пълниш лентата. Пълна лента → супер бутона → следващото докосване изстрелва супер удара.',
    'Удряй бонусите с топката (или ги докосни), за да ги вземеш.',
    'При равенство след края на времето — златен гол: следващият печели.',
    'Esc или P — пауза. Клавишите се сменят от Настройки → Управление.',
  ])
    tips.append(h('li', '', t));
  const ok = button('Разбрах!', back, 'btn btn-go btn-small');
  body.append(cards, tips, h('div', 'row-buttons', undefined, [ok.el]));
  return { id: 'howto', root, items: [ok], back };
}

// ------------------------------------------------------------------ key bindings

export function controlsScreen(app: AppActions, back: () => void): Screen {
  const { root, body } = panel('Управление', 'wide controls');
  const c = app.settings.controls;
  const players: Array<['p1' | 'p2', string, string]> = [
    ['p1', 'Играч 1 · ляв', '#ff4d4d'],
    ['p2', 'Играч 2 · десен', '#2f8cff'],
  ];
  let capturing: { pl: 'p1' | 'p2'; action: Action } | null = null;
  const msg = h('p', 'desc bind-msg', 'Избери действие, натисни Enter (или кликни), после натисни новия клавиш.');
  const rowEls: Array<{ pl: 'p1' | 'p2'; action: Action; keys: HTMLElement; el: HTMLElement }> = [];
  const items: NavItem[] = [];

  const cols = h('div', 'ctrl-cards');
  for (const [pl, title, color] of players) {
    const card = h('div', 'ctrl-card');
    card.style.setProperty('--team', color);
    card.append(h('h3', '', title));
    for (const action of ACTIONS) {
      const el = h('div', 'bind-row');
      const keys = h('div', 'bind-keys');
      el.append(h('span', 'bind-label', ACTION_LABELS[action]), keys);
      card.append(el);
      rowEls.push({ pl, action, keys, el });
      items.push({
        el,
        activate: () => {
          refresh();
          capturing = { pl, action };
          el.classList.add('capturing');
          keys.innerHTML = '';
          keys.append(h('span', 'press', 'Натисни клавиш…'));
          msg.textContent = 'Натисни новия клавиш (Esc — отказ).';
        },
      });
    }
    cols.append(card);
  }

  function refresh(): void {
    for (const r of rowEls) {
      r.keys.innerHTML = '';
      c[r.pl][r.action].forEach((k, i) => {
        if (i > 0) r.keys.append(h('span', 'or', 'или'));
        r.keys.append(keycap(keyLabel(k), keyLabel(k).length > 2));
      });
      r.el.classList.remove('capturing');
    }
  }

  const bind = (pl: 'p1' | 'p2', action: Action, code: string): void => {
    const old = c[pl][action][0];
    let swapped = '';
    for (const other of ['p1', 'p2'] as const) {
      for (const a of ACTIONS) {
        if (other === pl && a === action) continue;
        const list = c[other][a];
        const i = list.indexOf(code);
        if (i < 0) continue;
        list.splice(i, 1);
        if (list.length === 0) list.push(old); // swap the two keys
        swapped = `${keyLabel(code)} беше „${ACTION_LABELS[a]}“ на ${other === 'p1' ? 'Играч 1' : 'Играч 2'} — сега там е ${keyLabel(c[other][a][0])}.`;
      }
    }
    c[pl][action].splice(0, c[pl][action].length, code);
    app.saveSettings();
    app.onSettingsChanged();
    msg.textContent = swapped || `Готово: ${ACTION_LABELS[action]} = ${keyLabel(code)}`;
  };

  const reset = button(
    'По подразбиране',
    () => {
      const d1 = cloneBinding(DEFAULT_P1);
      const d2 = cloneBinding(DEFAULT_P2);
      for (const a of ACTIONS) {
        c.p1[a].splice(0, c.p1[a].length, ...d1[a]);
        c.p2[a].splice(0, c.p2[a].length, ...d2[a]);
      }
      app.saveSettings();
      app.onSettingsChanged();
      msg.textContent = 'Върнато е стандартното управление.';
      refresh();
    },
    'btn btn-alt btn-small',
  );
  const done = button('Готово', back, 'btn btn-go btn-small');
  items.push(reset, done);
  body.append(cols, msg, h('div', 'row-buttons', undefined, [reset.el, done.el]));
  refresh();

  const onKey = (code: string): boolean => {
    if (capturing) {
      const cap = capturing;
      capturing = null;
      if (code === 'Escape') msg.textContent = 'Отказано.';
      else if (RESERVED_KEYS.has(code)) msg.textContent = `${keyLabel(code)} е запазен (пауза/меню) — избери друг клавиш.`;
      else bind(cap.pl, cap.action, code);
      refresh();
      return true;
    }
    // ←/→ jumps between the two players' columns
    const i = app.ui.selectedIndex;
    const n = ACTIONS.length;
    if ((code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') && i < n * 2) {
      app.ui.select(i < n ? i + n : i - n);
      return true;
    }
    return false;
  };
  return { id: 'controls', root, items, back, onKey };
}

// ------------------------------------------------------------------ settings

export function settingsScreen(app: AppActions, back: () => void): Screen {
  const { root, body } = panel('Настройки');
  const s = app.settings;
  const changed = (): void => {
    app.saveSettings();
    app.onSettingsChanged();
  };
  const sfx = sliderRow('Звукови ефекти', () => s.sfxVolume, (v) => {
    s.sfxVolume = v;
    changed();
  });
  const music = sliderRow('Музика', () => s.musicVolume, (v) => {
    s.musicVolume = v;
    changed();
  });
  const onOff = [
    { value: true, label: 'Вкл.' },
    { value: false, label: 'Изкл.' },
  ];
  const bonuses = optionRow('Бонуси на терена', onOff, () => s.powerups, (v) => {
    s.powerups = v;
    changed();
  });
  const replays = optionRow('Повторение на гола', onOff, () => s.replays, (v) => {
    s.replays = v;
    changed();
  });
  const dur = durationRow(app);
  const diff = optionRow('Трудност (комп.)', DIFFICULTIES, () => s.difficulty, (v) => {
    s.difficulty = v;
    changed();
  });
  const keys = button('Управление (клавиши) ▸', () => app.showControls(() => app.showSettings(back)), 'btn btn-alt btn-small');
  const ok = button('Готово', back, 'btn btn-go btn-small');
  body.append(sfx.el, music.el, bonuses.el, replays.el, dur.el, diff.el, h('div', 'row-buttons', undefined, [keys.el, ok.el]));
  return { id: 'settings', root, items: [sfx, music, bonuses, replays, dur, diff, keys, ok], back };
}

// ------------------------------------------------------------------ pause

export function pauseScreen(app: AppActions): Screen {
  const { root, body } = panel('Пауза', 'pause');
  const items = [
    button('Продължи', () => app.resume(), 'btn btn-go'),
    button('Започни отначало', () => app.restart()),
    button('Как се играе', () => app.showHowTo(() => app.showPause()), 'btn btn-alt'),
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
