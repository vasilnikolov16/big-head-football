import { t, tr } from '../i18n/i18n';
import { keyLabel, type Binding } from '../input/controls';
import type { CareerResult } from '../game/career';
import { getCharacter } from '../game/characters';
import type { Match } from '../game/match';
import { drawBall } from '../render/ballDraw';
import { controlSetRow, difficultyRow, durationRow, type SettingsHost } from './settingsUi';
import { button, h, keycap, type NavItem, type Screen } from './ui';

export type MatchMode = 'cpu' | 'pvp' | 'tournament' | 'demo' | 'online';

/** What the screens can ask the game to do. */
export interface AppActions extends SettingsHost {
  readonly touchMode: boolean;
  showMain(): void;
  showCpuSetup(): void;
  showHowTo(back: () => void): void;
  showSettings(back: () => void): void;
  showHeroSelect(mode: 'cpu' | 'pvp' | 'tournament'): void;
  showTournament(): void;
  showStats(): void;
  showOnline(): void;
  startPvp(): void;
  rematch(): void;
  changeHeroes(): void;
  resume(): void;
  showPause(): void;
  restart(): void;
  quitToMenu(): void;
}

function logo(): HTMLElement {
  const wrap = h('div', 'logo');
  const ball = document.createElement('canvas');
  ball.className = 'logo-ball';
  ball.width = 120;
  ball.height = 120;
  const g = ball.getContext('2d')!;
  g.scale(2, 2);
  drawBall(g, 30, 30, 26, 0.4);
  wrap.append(h('div', 'logo-title', t('game.title1')), ball, h('div', 'logo-title', t('game.title2')));
  const sub = h('div', 'logo-sub', t('game.subtitle'));
  return h('div', 'logo-wrap', undefined, [wrap, sub]);
}

/** Phones in the browser: how to install the game as a full-screen app. */
function installTip(): string | null {
  const nav = navigator as Navigator & { standalone?: boolean };
  const installed = nav.standalone === true || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
  if (installed) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return t(ios ? 'menu.installIos' : 'menu.installAndroid');
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
    button(t('menu.cpu'), () => app.showCpuSetup()),
    button(t('menu.online'), () => app.showOnline(), 'btn', false, '🌐'),
    // two players need a keyboard (one phone screen is too small for 2 sets of buttons)
    button(t('menu.pvp'), () => app.startPvp(), 'btn', app.touchMode, app.touchMode ? t('keyboardOnly') : undefined),
    button(t('menu.tournament'), () => app.showTournament()),
    button(t('menu.stats'), () => app.showStats(), 'btn btn-alt'),
    button(t('menu.howto'), () => app.showHowTo(() => app.showMain()), 'btn btn-alt'),
    button(t('menu.settings'), () => app.showSettings(() => app.showMain()), 'btn btn-alt'),
  ];
  for (const it of items) list.append(it.el);
  root.append(list);
  if (!app.touchMode) root.append(hints(t('menu.hints')));
  else {
    const tip = installTip();
    if (tip) root.append(hints(tip));
  }
  return { id: 'main', root, items };
}

// ------------------------------------------------------------------ vs CPU setup

export function cpuSetup(app: AppActions): Screen {
  const { root, body } = panel(t('cpu.title'));
  const desc = h('p', 'desc');
  const updateDesc = (): void => {
    desc.textContent = t(`cpu.desc.${app.settings.difficulty}`);
  };
  const diff = difficultyRow(app, t('cpu.difficulty'), updateDesc);
  updateDesc();
  const set = controlSetRow(app);
  const dur = durationRow(app);
  const start = button(t('cpu.pick'), () => app.showHeroSelect('cpu'), 'btn btn-go');
  const back = button(t('back'), () => app.showMain(), 'btn btn-alt btn-small');
  const items = app.touchMode ? [diff, dur, start, back] : [diff, set, dur, start, back];
  body.append(diff.el, desc, ...(app.touchMode ? [] : [set.el]), dur.el, h('div', 'row-buttons', undefined, [start.el, back.el]));
  return { id: 'cpu', root, items, back: () => app.showMain(), initial: items.indexOf(start) };
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
    [[...bindingCaps(b.left).slice(0, 1), ...bindingCaps(b.right).slice(0, 1)], t('howto.move')],
    [bindingCaps(b.jump), t('howto.jump')],
    [bindingCaps(b.kick), t('howto.kick')],
    [bindingCaps(b.super), t('howto.super')],
    [[...bindingCaps(b.left).slice(0, 1), ...bindingCaps(b.left).slice(0, 1)], t('howto.dash')],
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

function touchCard(): HTMLElement {
  const card = h('div', 'ctrl-card touch-card');
  card.style.setProperty('--team', '#ffd23f');
  card.append(h('h3', '', t('howto.touchTitle')));
  const demo = h('div', 'touch-demo');
  for (const [cls, txt] of [
    ['l', '◀'],
    ['r', '▶'],
    ['s', '⚡'],
    ['k', '👟'],
    ['j', '⬆'],
  ])
    demo.append(h('span', `td td-${cls}`, txt));
  card.append(demo, h('p', 'ctrl-label', t('howto.touch')));
  return card;
}

export function howToPlay(app: AppActions, back: () => void): Screen {
  const { root, body } = panel(t('howto.title'), 'wide');
  const cards = h('div', 'ctrl-cards');
  if (app.touchMode) cards.append(touchCard(), controlsCard(t('controls.p1'), '#ff4d4d', app.settings.controls.p1));
  else
    cards.append(
      controlsCard(t('controls.p1'), '#ff4d4d', app.settings.controls.p1),
      controlsCard(t('controls.p2'), '#2f8cff', app.settings.controls.p2),
    );
  const tips = h('ul', 'tips');
  for (const k of ['howto.tip1', 'howto.tip2', 'howto.tip3', 'howto.tip4', 'howto.tip5', 'howto.tip8', 'howto.tip6', 'howto.tip7']) tips.append(h('li', '', t(k)));
  const ok = button(t('howto.ok'), back, 'btn btn-go btn-small');
  body.append(cards, tips, h('div', 'row-buttons', undefined, [ok.el]));
  return { id: 'howto', root, items: [ok], back };
}

// ------------------------------------------------------------------ pause

export function pauseScreen(app: AppActions): Screen {
  const { root, body } = panel(t('pause.title'), 'pause');
  const items = [
    button(t('pause.resume'), () => app.resume(), 'btn btn-go'),
    button(t('pause.restart'), () => app.restart()),
    button(t('pause.settings'), () => app.showSettings(() => app.showPause()), 'btn btn-alt'),
    button(t('menu.howto'), () => app.showHowTo(() => app.showPause()), 'btn btn-alt'),
    button(t('pause.quit'), () => app.quitToMenu(), 'btn btn-alt'),
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

export interface PostMatchExtra {
  career: CareerResult | null;
  /** tournament: go back to the ladder (or the trophy) */
  onContinue?: () => void;
  online?: PostOnline;
}

/** Online post-match: rematch needs both players, the status line updates live. */
export interface PostOnline {
  side: 0 | 1;
  rematch: () => void;
  change: () => void;
  leave: () => void;
  /** the session calls update(status, wantsRematch) whenever something changes */
  bind: (update: (status: string, iWant: boolean) => void) => void;
}

export function postMatch(app: AppActions, m: Match, mode: MatchMode, extra: PostMatchExtra): Screen {
  const root = h('div', 'scr scr-panel post');
  const box = h('div', 'panel');
  root.append(box);

  let title: string;
  let cls: string;
  const online = extra.online;
  if (mode === 'cpu' || mode === 'tournament' || online) {
    const me = online?.side ?? 0;
    title = m.winner === me ? t('post.win') : m.winner === 1 - me ? t('post.lose') : t('post.draw');
    cls = m.winner === me ? 'win' : m.winner === 1 - me ? 'lose' : 'draw';
  } else {
    title = m.winner < 0 ? t('post.draw') : t('post.winner', { n: m.config.names[m.winner].toUpperCase() });
    cls = m.winner < 0 ? 'draw' : 'win';
  }
  box.append(h('h2', `result ${cls}`, title));
  if (m.golden) box.append(h('div', 'golden-tag', t('post.golden')));

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
  const rows: Array<[string, number, number]> = [
    [t('stat.shots'), a.stats.shots, b.stats.shots],
    [t('stat.headers'), a.stats.headers, b.stats.headers],
    [t('stat.supers'), m.supersUsed[0], m.supersUsed[1]],
    [t('stat.touches'), a.stats.touches, b.stats.touches],
    [t('stat.possession'), posA, 100 - posA],
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

  // heroes unlocked in this match
  const unlocked = extra.career?.unlockedHeroes ?? [];
  if (unlocked.length) {
    const u = h('div', 'unlock-note');
    for (const id of unlocked) u.append(h('div', '', '🔓 ' + t('tour.unlocked', { h: tr(getCharacter(id).name) })));
    box.append(u);
  }

  let items: NavItem[];
  let statusEl: HTMLElement | null = null;
  if (online) {
    const rem = button(t('post.rematch'), () => online.rematch(), 'btn btn-go');
    items = [rem, button(t('post.change'), () => online.change()), button(t('online.leave'), () => online.leave(), 'btn btn-alt')];
    const status = h('div', 'net-status info');
    statusEl = status;
    online.bind((text, iWant) => {
      status.textContent = text;
      status.style.visibility = text ? 'visible' : 'hidden';
      const label = rem.el.querySelector('.btn-label');
      if (label) label.textContent = iWant ? t('online.rematchCancel') : t('post.rematch');
      rem.el.classList.toggle('btn-go', !iWant);
      rem.el.classList.toggle('btn-alt', iWant);
    });
  } else if (mode === 'tournament') {
    const won = m.winner === 0;
    items = won
      ? [button(t('post.continue'), () => extra.onContinue?.(), 'btn btn-go'), button(t('post.menu'), () => app.quitToMenu(), 'btn btn-alt')]
      : [
          button(t('post.retry'), () => app.rematch(), 'btn btn-go'),
          button(t('post.continue'), () => extra.onContinue?.()),
          button(t('post.menu'), () => app.quitToMenu(), 'btn btn-alt'),
        ];
  } else {
    items = [
      button(t('post.rematch'), () => app.rematch(), 'btn btn-go'),
      button(t('post.change'), () => app.changeHeroes()),
      button(t('post.menu'), () => app.quitToMenu(), 'btn btn-alt'),
    ];
  }
  if (statusEl) box.append(statusEl);
  box.append(h('div', 'row-buttons', undefined, items.map((i) => i.el)));
  if (!app.touchMode) box.append(hints(t('post.hints')));
  return { id: 'post', root, items, back: online ? () => {} : () => app.quitToMenu() };
}
