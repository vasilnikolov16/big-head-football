import { CHARACTERS, type CharacterDef } from '../game/characters';
import { Player } from '../game/player';
import { SUPER_INFO } from '../game/supers';
import { drawHead, drawPlayer } from '../render/playerDraw';
import { h, type Screen } from './ui';

export interface HeroSelectOptions {
  mode: 'cpu' | 'pvp';
  /** hero ids pre-selected for [left, right] */
  initial: [string, string];
  isLocked: (c: CharacterDef) => boolean;
  /** e.g. "CPU · трудно" */
  rightLabel: string;
  onDone: (left: CharacterDef, right: CharacterDef) => void;
  onBack: () => void;
}

const COLS = 4;
const STAT_LABELS: Array<[keyof CharacterDef['stats'], string]> = [
  ['speed', 'Скорост'],
  ['jump', 'Скок'],
  ['power', 'Сила'],
  ['head', 'Глава'],
];

// keys for the two cursors
const P1_MOVE: Record<string, [number, number]> = { KeyA: [-1, 0], KeyD: [1, 0], KeyW: [0, -1], KeyS: [0, 1] };
const P2_MOVE: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};
const P1_OK = ['Space', 'ShiftLeft', 'KeyF'];
const P2_OK = ['Enter', 'NumpadEnter', 'ShiftRight'];

function makeCanvas(w: number, h: number, cls: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = cls;
  const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5;
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${h}px`;
  return c;
}

interface Side {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  name: HTMLElement;
  tag: HTMLElement;
  tagline: HTMLElement;
  stats: HTMLElement[];
  superName: HTMLElement;
  superDesc: HTMLElement;
  player: Player;
  heroId: string;
}

export function heroSelect(o: HeroSelectOptions): Screen {
  const chars = CHARACTERS;
  const idx = (id: string): number => Math.max(0, chars.findIndex((c) => c.id === id));
  const cursor: [number, number] = [idx(o.initial[0]), idx(o.initial[1])];
  if (cursor[0] === cursor[1]) cursor[1] = (cursor[0] + 1) % chars.length;
  const ready: [boolean, boolean] = [false, false];
  let step = 0; // cpu mode: 0 = pick hero, 1 = pick opponent
  let launching = false;

  const root = h('div', `scr scr-select mode-${o.mode}`);
  const title = h('h2', 'sel-title', 'Избери герой');
  const subtitle = h('div', 'sel-sub', '');
  root.append(title, subtitle);
  const layout = h('div', 'sel-layout');
  root.append(layout);

  // ---------------------------------------------------------------- side panels
  const makeSide = (i: 0 | 1): Side => {
    const el = h('div', `sel-side s${i}`);
    const badge = h('div', 'sel-badge', i === 0 ? (o.mode === 'cpu' ? 'ТИ' : 'P1') : o.mode === 'cpu' ? 'CPU' : 'P2');
    const canvas = makeCanvas(250, 230, 'sel-preview');
    const name = h('div', 'sel-name');
    const tag = h('div', 'sel-ready', 'ГОТОВ!');
    const tagline = h('div', 'sel-tagline');
    const statsBox = h('div', 'sel-stats');
    const stats: HTMLElement[] = [];
    for (const [, label] of STAT_LABELS) {
      const row = h('div', 'stat-line');
      const pips = h('div', 'pips');
      for (let k = 0; k < 5; k++) pips.append(h('span', 'pip'));
      row.append(h('span', 'stat-name', label), pips);
      statsBox.append(row);
      stats.push(pips);
    }
    const sup = h('div', 'sel-super');
    const superName = h('div', 'super-name');
    const superDesc = h('div', 'super-desc');
    sup.append(h('div', 'super-label', 'СУПЕР УДАР'), superName, superDesc);
    el.append(badge, canvas, tag, name, tagline, statsBox, sup);
    const player = new Player(i, chars[cursor[i]]);
    player.placeAt(0, 0);
    return { root: el, canvas, name, tag, tagline, stats, superName, superDesc, player, heroId: '' };
  };
  const sides: [Side, Side] = [makeSide(0), makeSide(1)];

  // ---------------------------------------------------------------- grid
  const grid = h('div', 'sel-grid');
  const cards = chars.map((c, i) => {
    const card = h('div', 'hero-card');
    const cv = makeCanvas(104, 96, 'hero-portrait');
    card.append(cv, h('div', 'hero-name', c.name));
    if (o.isLocked(c)) {
      card.classList.add('locked');
      card.append(h('div', 'lock', '🔒'));
    }
    card.append(h('div', 'cur-badge b1', o.mode === 'cpu' ? 'ТИ' : 'P1'), h('div', 'cur-badge b2', o.mode === 'cpu' ? 'CPU' : 'P2'));
    card.addEventListener('click', () => onCardClick(i));
    grid.append(card);
    const portrait = new Player(0, c);
    portrait.placeAt(0, 0);
    return { card, cv, portrait };
  });

  layout.append(sides[0].root, grid, sides[1].root);
  const vs = h('div', 'vs-splash');
  root.append(vs);
  const hints = h('div', 'hints');
  root.append(hints);

  // ---------------------------------------------------------------- state -> DOM
  const refresh = (): void => {
    const cpu = o.mode === 'cpu';
    if (cpu) {
      title.textContent = step === 0 ? 'Избери герой' : 'Избери противник';
      subtitle.textContent = step === 0 ? 'С кого ще играеш?' : `Срещу кого? (${o.rightLabel})`;
      hints.textContent =
        step === 0
          ? '← → ↑ ↓ избор   ·   Enter потвърди   ·   Esc назад'
          : '← → ↑ ↓ избор   ·   Enter потвърди   ·   R случаен   ·   Esc назад';
    } else {
      title.textContent = 'Изберете герои';
      subtitle.textContent = 'И двамата избирате едновременно';
      hints.textContent = 'P1: WASD + Space   ·   P2: стрелки + Enter   ·   Esc назад';
    }
    cards.forEach(({ card }, i) => {
      const show1 = true;
      const show2 = !cpu || step === 1 || ready[1];
      card.classList.toggle('c1', show1 && cursor[0] === i);
      card.classList.toggle('c2', show2 && cursor[1] === i);
      card.classList.toggle('r1', ready[0] && cursor[0] === i);
      card.classList.toggle('r2', ready[1] && cursor[1] === i);
    });
    for (const i of [0, 1] as const) {
      const s = sides[i];
      const c = chars[cursor[i]];
      const hiddenRight = cpu && i === 1 && step === 0 && !ready[1];
      s.root.classList.toggle('waiting', hiddenRight);
      s.root.classList.toggle('ready', ready[i]);
      if (s.heroId !== c.id) {
        s.heroId = c.id;
        s.player = new Player(i, c);
        s.player.placeAt(0, 0);
        s.root.classList.remove('swap');
        void s.root.offsetWidth;
        s.root.classList.add('swap');
      }
      s.name.textContent = hiddenRight ? '???' : c.name;
      s.tagline.textContent = hiddenRight ? 'Първо избери своя герой' : c.tagline;
      STAT_LABELS.forEach(([key], k) => {
        const v = c.stats[key];
        [...s.stats[k].children].forEach((pip, n) => pip.classList.toggle('on', !hiddenRight && n < v));
      });
      const sup = SUPER_INFO[c.super];
      s.superName.textContent = hiddenRight ? '—' : sup.name;
      s.superName.style.color = sup.color;
      s.superDesc.textContent = hiddenRight ? '' : sup.desc;
      s.root.style.setProperty('--hero', c.look.shirt === '#ffffff' ? '#e63946' : c.look.shirt);
    }
  };

  const shake = (i: number): void => {
    const el = cards[cursor[i]].card;
    el.classList.remove('nope');
    void el.offsetWidth;
    el.classList.add('nope');
  };

  const canPick = (i: 0 | 1): boolean => {
    const c = chars[cursor[i]];
    if (o.isLocked(c)) return false;
    const other = (1 - i) as 0 | 1;
    if ((ready[other] || (o.mode === 'cpu' && i === 1)) && cursor[other] === cursor[i]) return false;
    return true;
  };

  const confirm = (i: 0 | 1): void => {
    if (launching) return;
    if (ready[i]) {
      if (o.mode === 'pvp') ready[i] = false; // toggle off
      refresh();
      return;
    }
    if (!canPick(i)) {
      shake(i);
      return;
    }
    ready[i] = true;
    sides[i].player.setExpression('happy', 1.2);
    if (o.mode === 'cpu' && i === 0) {
      step = 1;
      if (cursor[1] === cursor[0]) cursor[1] = (cursor[0] + 1) % chars.length;
    }
    refresh();
    if (ready[0] && ready[1]) launch();
  };

  const move = (i: 0 | 1, dx: number, dy: number): void => {
    if (launching || ready[i]) return;
    let c = cursor[i];
    if (dx) c = (c + dx + chars.length) % chars.length;
    if (dy) c = (c + dy * COLS + chars.length) % chars.length;
    cursor[i] = c;
    refresh();
  };

  const randomOpponent = (): void => {
    const pool = chars.map((_, i) => i).filter((i) => i !== cursor[0] && !o.isLocked(chars[i]));
    cursor[1] = pool[Math.floor(Math.random() * pool.length)];
    refresh();
    confirm(1);
  };

  const launch = (): void => {
    launching = true;
    vs.innerHTML = '';
    vs.append(
      h('div', 'vs-name l', chars[cursor[0]].name),
      h('div', 'vs-text', 'VS'),
      h('div', 'vs-name r', chars[cursor[1]].name),
    );
    vs.classList.add('show');
    window.setTimeout(() => o.onDone(chars[cursor[0]], chars[cursor[1]]), 1100);
  };

  function onCardClick(i: number): void {
    if (launching) return;
    if (o.mode === 'cpu') {
      const who = step === 0 ? 0 : 1;
      cursor[who] = i;
      refresh();
      confirm(who);
    } else {
      if (ready[0] && ready[1]) return;
      const who: 0 | 1 = !ready[0] ? 0 : 1;
      cursor[who] = i;
      refresh();
      confirm(who);
    }
  }

  const onKey = (code: string): boolean => {
    if (launching) return true;
    if (code === 'Escape' || code === 'Backspace') {
      if (o.mode === 'cpu' && step === 1) {
        step = 0;
        ready[0] = false;
        ready[1] = false;
        refresh();
      } else o.onBack();
      return true;
    }
    if (o.mode === 'cpu') {
      const who = step === 0 ? 0 : 1;
      const d = P1_MOVE[code] ?? P2_MOVE[code];
      if (d) move(who, d[0], d[1]);
      else if (P1_OK.includes(code) || P2_OK.includes(code)) confirm(who);
      else if (code === 'KeyR' && step === 1) randomOpponent();
      return true;
    }
    if (P1_MOVE[code]) move(0, ...P1_MOVE[code]);
    else if (P2_MOVE[code]) move(1, ...P2_MOVE[code]);
    else if (P1_OK.includes(code)) confirm(0);
    else if (P2_OK.includes(code)) confirm(1);
    return true;
  };

  // ---------------------------------------------------------------- animation
  let raf = 0;
  let last = performance.now();
  let t = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    for (const i of [0, 1] as const) {
      const s = sides[i];
      const p = s.player;
      p.tickAnimation(dt);
      p.lookX = p.facing * 0.5 + Math.sin(t * 0.9 + i) * 0.4;
      p.lookY = Math.sin(t * 0.7 + i * 2) * 0.4;
      const g = s.canvas.getContext('2d')!;
      const k = s.canvas.width / 250;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, s.canvas.width, s.canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      // podium
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(125, 214, 70, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.translate(125, 212);
      const scale = 1.25 * (48 / Math.max(48, p.headR));
      g.scale(scale, scale);
      drawPlayer(g, p, 1, t);
    }
    cards.forEach(({ cv, portrait }, i) => {
      portrait.tickAnimation(dt);
      portrait.lookX = Math.sin(t * 0.8 + i) * 0.6;
      portrait.lookY = Math.cos(t * 0.6 + i * 1.3) * 0.4;
      const g = cv.getContext('2d')!;
      const k = cv.width / 104;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(k, 0, 0, k, 52 * k, 56 * k);
      drawHead(g, portrait, 30, 1, t);
    });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  refresh();
  return {
    id: 'select',
    root,
    items: [],
    onKey,
    back: o.onBack,
    dispose: () => cancelAnimationFrame(raf),
  };
}
