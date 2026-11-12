import { CHARACTERS } from '../game/characters';
import { t } from '../i18n/i18n';
import { drawBall } from '../render/ballDraw';
import { heroPortrait } from './portrait';
import './loader.css';

/**
 * The opening loading screen: a show more than a real load (the game is tiny
 * and already loaded). On phones it only starts once the phone is turned
 * sideways, so nobody misses it behind the "rotate your phone" screen. It ends
 * with "tap to play", which also unlocks the sound on iPhone.
 */

const TIPS = ['ld.tip1', 'ld.tip2', 'ld.tip3', 'ld.tip4', 'ld.tip5', 'ld.tip6', 'ld.tip7', 'ld.tip8'];

/** fake progress: [time in s, percent] key points, uneven on purpose */
const CURVE: Array<[number, number]> = [
  [0, 0],
  [0.35, 18],
  [0.7, 24],
  [1.25, 52],
  [1.55, 61],
  [2.1, 79],
  [2.55, 87],
  [2.85, 96],
  [3.3, 99],
  [3.6, 100],
];

function progressAt(s: number): number {
  for (let i = 1; i < CURVE.length; i++) {
    const [t1, p1] = CURVE[i];
    const [t0, p0] = CURVE[i - 1];
    if (s <= t1) {
      const k = (s - t0) / (t1 - t0);
      return p0 + (p1 - p0) * (k * k * (3 - 2 * k));
    }
  }
  return 100;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
};

export interface LoaderOptions {
  /** the tap that closes it (sound is unlocked by now) */
  onClose: () => void;
}

export function showLoader(o: LoaderOptions): void {
  const root = h('div', 'ld');
  // sweeping floodlights
  const beams = h('div', 'ld-beams');
  for (let i = 0; i < 4; i++) beams.append(h('div', `ld-beam b${i}`));
  root.append(beams, h('div', 'ld-grass'));

  // the logo: slams in
  const logo = h('div', 'ld-logo');
  const ball = document.createElement('canvas');
  ball.className = 'ld-logo-ball';
  ball.width = ball.height = 160;
  const bg = ball.getContext('2d')!;
  bg.scale(2, 2);
  drawBall(bg, 40, 40, 34, 0.4);
  logo.append(h('span', 'ld-word', t('game.title1')), ball, h('span', 'ld-word', t('game.title2')));
  const sub = h('div', 'ld-sub', t('game.subtitle'));

  // every hero pops in
  const heroes = h('div', 'ld-heroes');
  CHARACTERS.forEach((c, i) => {
    const cv = heroPortrait(c, 52, { happy: i % 3 === 0 });
    cv.style.animationDelay = `${0.55 + i * 0.07}s`;
    heroes.append(cv);
  });

  // the bar is a little pitch; a ball rolls along it
  const bar = h('div', 'ld-bar');
  const fill = h('div', 'ld-fill');
  const runner = document.createElement('canvas');
  runner.className = 'ld-runner';
  runner.width = runner.height = 72;
  const rg = runner.getContext('2d')!;
  rg.scale(2, 2);
  bar.append(fill, runner);
  const pct = h('div', 'ld-pct', '0%');
  const tip = h('div', 'ld-tip', t(TIPS[0]));
  const tap = h('div', 'ld-tap', t('ld.tap'));
  const fx = document.createElement('canvas');
  fx.className = 'ld-fx';

  const stage = h('div', 'ld-stage');
  stage.append(logo, sub, heroes, bar, pct, tip);
  // (the "tap to play" sits on the grass, outside the stage)
  root.append(stage, tap, fx);
  document.body.append(root);

  // ---------------------------------------------------------------- particles (sparks + confetti)
  const fg = fx.getContext('2d')!;
  type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: string; s: number; spark: boolean };
  const parts: P[] = [];
  const COLORS = ['#ffd23f', '#ff4d4d', '#4fd1ff', '#7cff6b', '#ff8fc7', '#c77dff', '#ffffff'];
  const burst = (x: number, y: number, n: number, spark: boolean): void => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = spark ? 300 + Math.random() * 600 : 200 + Math.random() * 500;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (spark ? 0 : 300), life: 0, max: spark ? 0.5 + Math.random() * 0.4 : 1.4 + Math.random(), c: COLORS[i % COLORS.length], s: spark ? 2 + Math.random() * 2 : 5 + Math.random() * 5, spark });
    }
  };
  const resize = (): void => {
    const d = Math.min(2, window.devicePixelRatio || 1);
    fx.width = Math.round(innerWidth * d);
    fx.height = Math.round(innerHeight * d);
    fg.setTransform(d, 0, 0, d, 0, 0);
  };
  resize();
  window.addEventListener('resize', resize);

  // ---------------------------------------------------------------- run
  // phones held upright: wait until the phone is turned (the rotate screen is up meanwhile)
  const upright = window.matchMedia('(orientation: portrait) and (pointer: coarse)');
  let started = false;
  let t0 = 0;
  let last = performance.now();
  let done = false;
  let closing = false;
  let tipI = 0;
  let slammed = false;
  let raf = 0;

  const start = (): void => {
    if (started || upright.matches) return;
    started = true;
    t0 = performance.now();
    root.classList.add('go');
  };
  upright.addEventListener?.('change', start);
  window.addEventListener('resize', start);
  start();

  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (started) {
      const s = (now - t0) / 1000;
      const p = progressAt(s);
      fill.style.width = `${p}%`;
      runner.style.left = `${p}%`;
      rg.clearRect(0, 0, 36, 36);
      drawBall(rg, 18, 18, 15, s * 9);
      pct.textContent = `${Math.floor(p)}%`;
      const ti = Math.min(TIPS.length - 1, Math.floor(p / (100 / TIPS.length)));
      if (ti !== tipI) {
        tipI = ti;
        tip.textContent = t(TIPS[ti]);
        tip.classList.remove('swap');
        void tip.offsetWidth;
        tip.classList.add('swap');
      }
      if (!slammed && s > 0.42) {
        slammed = true;
        const r = logo.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, 46, true);
      }
      if (!done && p >= 100) {
        done = true;
        root.classList.add('done');
        const r = bar.getBoundingClientRect();
        burst(r.right, r.top + r.height / 2, 70, false);
      }
    }
    // particles
    fg.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = parts.length - 1; i >= 0; i--) {
      const q = parts[i];
      q.life += dt;
      if (q.life >= q.max) {
        parts.splice(i, 1);
        continue;
      }
      q.vy += (q.spark ? 500 : 700) * dt;
      q.vx *= 1 - dt * (q.spark ? 1 : 1.6);
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      const k = 1 - q.life / q.max;
      fg.globalAlpha = k;
      fg.fillStyle = q.c;
      if (q.spark) {
        fg.beginPath();
        fg.arc(q.x, q.y, q.s, 0, Math.PI * 2);
        fg.fill();
      } else {
        fg.save();
        fg.translate(q.x, q.y);
        fg.rotate(q.life * 8);
        fg.fillRect(-q.s / 2, -q.s / 3, q.s, q.s * 0.66);
        fg.restore();
      }
    }
    fg.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  // ---------------------------------------------------------------- close on a tap / key once loaded
  const close = (e: Event): void => {
    e.preventDefault();
    // nothing behind the loader may react (menus listen on the same window)
    e.stopImmediatePropagation();
    if (!done || closing) return;
    closing = true;
    root.classList.add('out');
    const r = logo.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, 90, false);
    o.onClose();
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('resize', start);
      window.removeEventListener('keydown', onKey, true);
      root.remove();
    }, 900);
  };
  // keys must not reach the menus behind the loader
  const onKey = (e: KeyboardEvent): void => {
    if (root.isConnected) close(e);
  };
  root.addEventListener('pointerup', close);
  window.addEventListener('keydown', onKey, true);
}
