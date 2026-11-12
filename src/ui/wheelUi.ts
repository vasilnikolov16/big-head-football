import type { Career, WheelResult } from '../game/career';
import { getCharacter } from '../game/characters';
import { SEGMENTS } from '../game/wheel';
import { t, tr } from '../i18n/i18n';
import { button, h, type Screen } from './ui';

export interface WheelOptions {
  career: Career;
  /** a click each time a segment passes the pointer */
  tick: () => void;
  win: (big: boolean) => void;
  toast: (icon: string, title: string, body: string) => void;
  back: () => void;
}

const SPIN_TIME = 4.2;
const SEG = (Math.PI * 2) / SEGMENTS.length;

function hms(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

/** draws the wheel turned by `rot` (radians); segment i is centred at the top when rot = -i·SEG */
function drawWheel(g: CanvasRenderingContext2D, size: number, rot: number): void {
  const c = size / 2;
  const R = c - 8;
  g.clearRect(0, 0, size, size);
  g.save();
  g.translate(c, c);
  // rim with lights
  g.fillStyle = '#1b1640';
  g.beginPath();
  g.arc(0, 0, R + 6, 0, Math.PI * 2);
  g.fill();
  g.rotate(rot);
  SEGMENTS.forEach((sg, i) => {
    const a0 = -Math.PI / 2 + i * SEG - SEG / 2;
    g.fillStyle = sg.color;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, R, a0, a0 + SEG);
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(22,18,43,0.85)';
    g.lineWidth = 3;
    g.stroke();
    // label
    g.save();
    g.rotate(a0 + SEG / 2 + Math.PI / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${Math.round(R * 0.2)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(sg.icon, 0, -R * 0.72);
    if (sg.label) {
      g.font = `${Math.round(R * 0.15)}px "Russo One", sans-serif`;
      g.lineWidth = 5;
      g.strokeStyle = '#16122b';
      g.strokeText(sg.label, 0, -R * 0.47);
      g.fillStyle = '#ffffff';
      g.fillText(sg.label, 0, -R * 0.47);
    }
    g.restore();
  });
  g.restore();
  // bulbs around the rim
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.fillStyle = i % 2 ? '#fff3b0' : '#ffd23f';
    g.beginPath();
    g.arc(c + Math.cos(a) * (R + 2), c + Math.sin(a) * (R + 2), 4, 0, Math.PI * 2);
    g.fill();
  }
  // hub
  g.fillStyle = '#ffd23f';
  g.strokeStyle = '#16122b';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(c, c, R * 0.14, 0, Math.PI * 2);
  g.fill();
  g.stroke();
}

/** Wheel of fortune: a free spin every 12 hours. */
export function wheelScreen(o: WheelOptions): Screen {
  const c = o.career;
  const root = h('div', 'scr scr-panel wheel');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('wheel.title')), h('p', 'desc', t('wheel.sub')));

  const size = 330;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const cv = document.createElement('canvas');
  cv.width = cv.height = Math.round(size * dpr);
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  const wrap = h('div', 'wheel-wrap', undefined, [h('div', 'wheel-pointer'), cv]);

  const status = h('div', 'wheel-status');
  const result = h('div', 'wheel-result');
  const spinBtn = button(t('wheel.spin'), () => spin(), 'btn btn-go');
  const side = h('div', 'wheel-side', undefined, [status, spinBtn.el, result, h('p', 'desc small', t('wheel.chances'))]);
  box.append(h('div', 'wheel-row', undefined, [wrap, side]));

  let rot = 0;
  let anim: { from: number; to: number; t: number; res: WheelResult } | null = null;
  let lastTickSeg = 0;
  let raf = 0;
  let last = performance.now();

  const refresh = (): void => {
    const ready = c.canSpin() && !anim;
    spinBtn.el.classList.toggle('disabled', !ready);
    spinBtn.disabled = !ready;
    if (anim) status.textContent = '';
    else status.textContent = ready ? t('wheel.ready') : t('wheel.wait', { t: hms(c.nextSpinAt - Date.now()) });
  };

  const reveal = (res: WheelResult): void => {
    let text: string;
    let icon = SEGMENTS[res.segment].icon;
    if (res.hero) {
      text = t('wheel.hero', { n: tr(getCharacter(res.hero).name) });
      icon = '🦸';
    } else if (res.item) {
      text = t('wheel.item', { n: tr(res.item.name) });
      icon = res.item.icon;
    } else text = t('wheel.coins', { n: res.coins });
    result.textContent = `${icon} ${text}`;
    result.style.animation = 'none';
    void result.offsetWidth;
    result.style.animation = '';
    o.win(!!res.hero || res.coins >= 200);
    o.toast(icon, t('wheel.title'), text);
    for (const a of res.achievements) o.toast(a.icon, t('ach.unlocked'), tr(a.name));
  };

  const spin = (): void => {
    if (anim || !c.canSpin()) return;
    const res = c.spin();
    if (!res) return;
    // land in the middle of the prize's segment (a little random) after several turns
    const target = -res.segment * SEG + (Math.random() - 0.5) * SEG * 0.6;
    const base = rot - (rot % (Math.PI * 2));
    const to = base + Math.PI * 2 * 6 + target;
    anim = { from: rot, to, t: 0, res };
    lastTickSeg = Math.floor(rot / SEG);
    result.textContent = '';
    refresh();
  };

  const frame = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (anim) {
      anim.t += dt;
      const k = Math.min(1, anim.t / SPIN_TIME);
      const e = 1 - Math.pow(1 - k, 4); // fast start, long slow ending
      rot = anim.from + (anim.to - anim.from) * e;
      const seg = Math.floor((rot + SEG / 2) / SEG);
      if (seg !== lastTickSeg) {
        lastTickSeg = seg;
        o.tick();
      }
      if (k >= 1) {
        const res = anim.res;
        anim = null;
        reveal(res);
        refresh();
      }
    }
    drawWheel(g, size, rot);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const timer = window.setInterval(refresh, 1000);
  refresh();
  return {
    id: 'wheel',
    root,
    items: [spinBtn],
    back: () => {
      if (!anim) o.back();
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      clearInterval(timer);
    },
  };
}
