import { CHARACTERS, type CharacterDef } from '../game/characters';
import { Player } from '../game/player';
import { SUPER_INFO } from '../game/supers';
import { t, tr } from '../i18n/i18n';
import { keyLabel, type MenuKeys } from '../input/controls';
import { drawHead, drawPlayer } from '../render/playerDraw';
import { h, type Screen, type UiSound } from './ui';

export interface HeroSelectOptions {
  /** tournament = pick only your own hero */
  mode: 'cpu' | 'pvp' | 'tournament';
  /** hero ids pre-selected for [left, right] */
  initial: [string, string];
  isLocked: (c: CharacterDef) => boolean;
  /** e.g. "CPU · трудно" */
  rightLabel: string;
  /** menu keys of player 1 and player 2 (derived from their bindings) */
  keys: [MenuKeys, MenuKeys];
  sound: (s: UiSound) => void;
  onDone: (left: CharacterDef, right: CharacterDef) => void;
  onBack: () => void;
}

const COLS = 4;
const STAT_LABELS: Array<[keyof CharacterDef['stats'], string]> = [
  ['speed', 'sel.speed'],
  ['jump', 'sel.jumpStat'],
  ['power', 'sel.power'],
  ['head', 'sel.head'],
];

function makeCanvas(w: number, hgt: number, cls: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.className = cls;
  const dpr = Math.min(2, window.devicePixelRatio || 1) * 1.5;
  c.width = Math.round(w * dpr);
  c.height = Math.round(hgt * dpr);
  c.style.width = `${w}px`;
  c.style.height = `${hgt}px`;
  return c;
}

interface Side {
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  name: HTMLElement;
  tagline: HTMLElement;
  stats: HTMLElement[];
  superName: HTMLElement;
  superDesc: HTMLElement;
  readyBtn: HTMLButtonElement;
  player: Player;
  heroId: string;
}

const keysText = (k: MenuKeys): string => {
  const mv = [k.left[0], k.right[0], k.up[0], k.down[0]].map(keyLabel).join(' ');
  return t('sel.keys', { m: mv, o: keyLabel(k.ok[0]) });
};

/**
 * Hero select. Everybody browses freely (the big preview follows the cursor),
 * locks in with "Готов", and the match starts only with the START button once
 * both sides are ready.
 */
export function heroSelect(o: HeroSelectOptions): Screen {
  const chars = CHARACTERS;
  const idx = (id: string): number => Math.max(0, chars.findIndex((c) => c.id === id));
  const cursor: [number, number] = [idx(o.initial[0]), idx(o.initial[1])];
  if (cursor[0] === cursor[1]) cursor[1] = (cursor[0] + 1) % chars.length;
  const ready: [boolean, boolean] = [false, false];
  let step = 0; // cpu mode: 0 = pick your hero, 1 = pick the opponent
  let launching = false;
  const tour = o.mode === 'tournament';
  const cpu = o.mode === 'cpu' || tour;
  const allReady = (): boolean => ready[0] && (tour || ready[1]);
  // the first available hero if the saved one is locked
  const firstFree = (): number => Math.max(0, chars.findIndex((c) => !o.isLocked(c)));
  if (o.isLocked(chars[cursor[0]])) cursor[0] = firstFree();

  const root = h('div', `scr scr-select mode-${o.mode}`);
  const title = h('h2', 'sel-title', t('sel.pickHero'));
  const subtitle = h('div', 'sel-sub', '');
  root.append(title, subtitle);
  const layout = h('div', 'sel-layout');
  root.append(layout);

  // ---------------------------------------------------------------- side panels
  const makeSide = (i: 0 | 1): Side => {
    const el = h('div', `sel-side s${i}`);
    const badge = h('div', 'sel-badge', i === 0 ? (cpu ? t('you') : 'P1') : cpu ? t('cpu') : 'P2');
    const canvas = makeCanvas(250, 220, 'sel-preview');
    const name = h('div', 'sel-name');
    const stamp = h('div', 'sel-ready', t('sel.stamp'));
    const tagline = h('div', 'sel-tagline');
    const statsBox = h('div', 'sel-stats');
    const stats: HTMLElement[] = [];
    for (const [, label] of STAT_LABELS) {
      const row = h('div', 'stat-line');
      const pips = h('div', 'pips');
      for (let k = 0; k < 5; k++) pips.append(h('span', 'pip'));
      row.append(h('span', 'stat-name', t(label)), pips);
      statsBox.append(row);
      stats.push(pips);
    }
    const sup = h('div', 'sel-super');
    const superName = h('div', 'super-name');
    const superDesc = h('div', 'super-desc');
    sup.append(h('div', 'super-label', t('sel.super')), superName, superDesc);
    const readyBtn = h('button', 'btn btn-small sel-ready-btn');
    readyBtn.type = 'button';
    readyBtn.addEventListener('click', () => onReadyClick(i));
    el.append(badge, canvas, stamp, name, tagline, statsBox, sup, readyBtn);
    const player = new Player(i, chars[cursor[i]]);
    player.placeAt(0, 0);
    return { root: el, canvas, name, tagline, stats, superName, superDesc, readyBtn, player, heroId: '' };
  };
  const sides: [Side, Side] = [makeSide(0), makeSide(1)];

  // ---------------------------------------------------------------- grid + start
  const center = h('div', 'sel-center');
  const grid = h('div', 'sel-grid');
  const cards = chars.map((c, i) => {
    const card = h('div', 'hero-card');
    const cv = makeCanvas(104, 96, 'hero-portrait');
    card.append(cv, h('div', 'hero-name', tr(c.name)));
    if (o.isLocked(c)) {
      card.classList.add('locked');
      card.append(h('div', 'lock', '🔒'));
    }
    card.append(h('div', 'cur-badge b1', cpu ? t('you') : 'P1'), h('div', 'cur-badge b2', cpu ? t('cpu') : 'P2'));
    card.addEventListener('click', () => onCardClick(i));
    grid.append(card);
    const portrait = new Player(0, c);
    portrait.placeAt(0, 0);
    return { card, cv, portrait };
  });
  const startBtn = h('button', 'btn btn-go sel-start');
  startBtn.type = 'button';
  startBtn.addEventListener('click', () => start());
  center.append(grid, startBtn);

  layout.append(sides[0].root, center, sides[1].root);
  const vs = h('div', 'vs-splash');
  root.append(vs);
  const hints = h('div', 'hints');
  root.append(hints);

  // ---------------------------------------------------------------- state -> DOM
  const refresh = (): void => {
    if (cpu) {
      title.textContent = allReady() ? t('sel.allReady') : tour ? t('sel.tournament') : step === 0 ? t('sel.pickHero') : t('sel.pickOpp');
      subtitle.textContent = allReady() ? t('sel.pressStart') : step === 0 ? t('sel.browse') : t('sel.vsWho', { l: o.rightLabel });
      hints.textContent = allReady() ? t('sel.hint.ready') : step === 0 ? t('sel.hint.cpu0') : t('sel.hint.cpu1');
    } else {
      title.textContent = allReady() ? t('sel.allReady') : t('sel.pvpTitle');
      subtitle.textContent = allReady() ? t('sel.pressStart') : t('sel.pvpSub');
      hints.textContent = allReady()
        ? t('sel.hint.pvpReady', { a: keyLabel(o.keys[0].ok[0]), b: keyLabel(o.keys[1].ok[0]) })
        : t('sel.hint.pvp', { a: keysText(o.keys[0]), b: keysText(o.keys[1]) });
    }
    startBtn.textContent = allReady() ? t('sel.start') : cpu ? t('sel.pickBoth') : t('sel.waitBoth');
    startBtn.classList.toggle('disabled', !allReady());
    startBtn.classList.toggle('sel', allReady());

    cards.forEach(({ card }, i) => {
      const show2 = !cpu || step === 1 || ready[1];
      card.classList.toggle('c1', cursor[0] === i);
      card.classList.toggle('c2', show2 && cursor[1] === i);
      card.classList.toggle('r1', ready[0] && cursor[0] === i);
      card.classList.toggle('r2', ready[1] && cursor[1] === i);
    });
    for (const i of [0, 1] as const) {
      const s = sides[i];
      const c = chars[cursor[i]];
      const hiddenRight = cpu && i === 1 && (step === 0 || tour);
      s.root.classList.toggle('waiting', hiddenRight);
      s.root.classList.toggle('ready', ready[i]);
      const active = !cpu || (i === 0 ? step === 0 : step === 1);
      s.root.classList.toggle('active', active && !ready[i]);
      if (s.heroId !== c.id) {
        s.heroId = c.id;
        s.player = new Player(i, c);
        s.player.placeAt(0, 0);
        s.root.classList.remove('swap');
        void s.root.offsetWidth;
        s.root.classList.add('swap');
      }
      const locked = o.isLocked(c);
      s.name.textContent = hiddenRight ? (tour ? t('tour.title') : '???') : tr(c.name);
      s.tagline.textContent = hiddenRight ? (tour ? '' : t('sel.firstPick')) : locked ? '🔒 ' + t('sel.locked') : tr(c.tagline);
      s.root.classList.toggle('locked', !hiddenRight && locked);
      STAT_LABELS.forEach(([key], k) => {
        const v = c.stats[key];
        [...s.stats[k].children].forEach((pip, n) => pip.classList.toggle('on', !hiddenRight && n < v));
      });
      const sup = SUPER_INFO[c.super];
      s.superName.textContent = hiddenRight ? '—' : tr(sup.name);
      s.superName.style.color = sup.color;
      s.superDesc.textContent = hiddenRight ? '' : tr(sup.desc);
      s.root.style.setProperty('--hero', c.look.shirt === '#ffffff' ? '#e63946' : c.look.shirt);
      s.readyBtn.textContent = ready[i] ? t('sel.change') : t('sel.ready');
      s.readyBtn.classList.toggle('btn-alt', ready[i]);
      s.readyBtn.classList.toggle('btn-go', !ready[i]);
      s.readyBtn.style.visibility = hiddenRight ? 'hidden' : 'visible';
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
    return !(ready[other] && cursor[other] === cursor[i]);
  };

  const setReady = (i: 0 | 1): void => {
    if (!canPick(i)) {
      shake(i);
      o.sound('back');
      return;
    }
    ready[i] = true;
    o.sound('select');
    sides[i].player.setExpression('happy', 1.2);
    if (cpu && i === 0 && !tour) {
      step = 1;
      if (cursor[1] === cursor[0] || o.isLocked(chars[cursor[1]])) {
        cursor[1] = chars.findIndex((c, k) => k !== cursor[0] && !o.isLocked(c));
      }
    }
    refresh();
  };

  const unready = (i: 0 | 1): void => {
    if (!ready[i]) return;
    ready[i] = false;
    if (cpu && i === 0) {
      ready[1] = false;
      step = 0;
    }
    o.sound('back');
    refresh();
  };

  /** the player presses their "OK" key */
  const confirm = (i: 0 | 1): void => {
    if (launching) return;
    if (allReady()) {
      start();
      return;
    }
    if (ready[i]) unready(i);
    else setReady(i);
  };

  const move = (i: 0 | 1, dx: number, dy: number): void => {
    if (launching || ready[i]) return;
    let c = cursor[i];
    if (dx) c = (c + dx + chars.length) % chars.length;
    if (dy) c = (c + dy * COLS + chars.length) % chars.length;
    cursor[i] = c;
    o.sound('move');
    refresh();
  };

  const start = (): void => {
    if (!allReady() || launching) return;
    launching = true;
    o.sound('select');
    vs.innerHTML = '';
    if (tour) vs.append(h('div', 'vs-name l', tr(chars[cursor[0]].name)), h('div', 'vs-text', '🏆'));
    else vs.append(h('div', 'vs-name l', tr(chars[cursor[0]].name)), h('div', 'vs-text', 'VS'), h('div', 'vs-name r', tr(chars[cursor[1]].name)));
    vs.classList.add('show');
    window.setTimeout(() => o.onDone(chars[cursor[0]], chars[cursor[1]]), 1100);
  };

  function onReadyClick(i: 0 | 1): void {
    if (launching) return;
    if (ready[i]) unready(i);
    else if (!cpu || (i === 0 ? step === 0 : step === 1)) setReady(i);
  }

  /** Mouse: first click browses, clicking the selected card again locks it in. */
  function onCardClick(i: number): void {
    if (launching) return;
    let who: 0 | 1;
    if (cpu) {
      if (allReady()) return;
      who = step === 0 ? 0 : 1;
    } else {
      if (allReady()) return;
      who = !ready[0] ? 0 : 1;
    }
    if (cursor[who] === i) setReady(who);
    else {
      cursor[who] = i;
      o.sound('move');
      refresh();
    }
  }

  const dirOf = (k: MenuKeys, code: string): [number, number] | null => {
    if (k.left.includes(code)) return [-1, 0];
    if (k.right.includes(code)) return [1, 0];
    if (k.up.includes(code)) return [0, -1];
    if (k.down.includes(code)) return [0, 1];
    return null;
  };

  const onKey = (code: string): boolean => {
    if (launching) return true;
    if (code === 'Escape') {
      if (cpu) {
        if (ready[1]) unready(1);
        else if (ready[0] || step === 1) unready(0);
        else o.onBack();
      } else if (ready[0] || ready[1]) {
        ready[0] = ready[1] = false;
        o.sound('back');
        refresh();
      } else o.onBack();
      return true;
    }
    if (cpu) {
      // one person picks both: accept everybody's keys + the usual menu keys
      const who = step === 0 ? 0 : 1;
      const d = dirOf(o.keys[0], code) ?? dirOf(o.keys[1], code) ?? dirOf(FALLBACK, code);
      if (d) {
        if (!allReady()) move(who, d[0], d[1]);
      } else if (['Enter', 'NumpadEnter', 'Space', ...o.keys[0].ok, ...o.keys[1].ok].includes(code)) {
        if (allReady()) start();
        else setReady(who);
      } else if (code === 'KeyR' && step === 1 && !ready[1]) {
        const pool = chars.map((_, i) => i).filter((i) => i !== cursor[0] && !o.isLocked(chars[i]));
        cursor[1] = pool[Math.floor(Math.random() * pool.length)];
        o.sound('move');
        refresh();
      } else if (code === 'Backspace') {
        if (ready[1]) unready(1);
        else unready(0);
      }
      return true;
    }
    for (const i of [0, 1] as const) {
      const k = o.keys[i];
      const d = dirOf(k, code);
      if (d) {
        move(i, d[0], d[1]);
        return true;
      }
      if (k.ok.includes(code)) {
        confirm(i);
        return true;
      }
      if (k.cancel.includes(code)) {
        unready(i);
        return true;
      }
    }
    return true;
  };

  // ---------------------------------------------------------------- animation
  let raf = 0;
  let last = performance.now();
  let time = 0;
  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    for (const i of [0, 1] as const) {
      const s = sides[i];
      const p = s.player;
      p.tickAnimation(dt);
      p.lookX = p.facing * 0.5 + Math.sin(time * 0.9 + i) * 0.4;
      p.lookY = Math.sin(time * 0.7 + i * 2) * 0.4;
      const g = s.canvas.getContext('2d')!;
      const k = s.canvas.width / 250;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, s.canvas.width, s.canvas.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.beginPath();
      g.ellipse(125, 206, 70, 12, 0, 0, Math.PI * 2);
      g.fill();
      g.translate(125, 204);
      const scale = 1.2 * (48 / Math.max(48, p.headR));
      g.scale(scale, scale);
      drawPlayer(g, p, 1, time);
    }
    cards.forEach(({ cv, portrait }, i) => {
      portrait.tickAnimation(dt);
      portrait.lookX = Math.sin(time * 0.8 + i) * 0.6;
      portrait.lookY = Math.cos(time * 0.6 + i * 1.3) * 0.4;
      const g = cv.getContext('2d')!;
      const k = cv.width / 104;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, cv.width, cv.height);
      g.setTransform(k, 0, 0, k, 52 * k, 56 * k);
      drawHead(g, portrait, 30, 1, time);
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

/** Arrow keys and WASD always work for browsing in single-player selection. */
const FALLBACK: MenuKeys = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'],
  down: ['ArrowDown', 'KeyS'],
  ok: [],
  cancel: [],
};
