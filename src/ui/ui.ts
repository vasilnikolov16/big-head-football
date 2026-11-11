/**
 * Minimal DOM screen manager: animated transitions + keyboard/mouse navigation.
 * Screens are plain DOM trees; navigation works on an ordered list of items.
 */
export interface NavItem {
  el: HTMLElement;
  activate?: () => void;
  left?: () => void;
  right?: () => void;
  disabled?: boolean;
}

export interface Screen {
  id: string;
  root: HTMLElement;
  items: NavItem[];
  /** called on Esc / Backspace */
  back?: () => void;
  /** initially selected item */
  initial?: number;
  /** extra key handling, return true if consumed */
  onKey?: (code: string) => boolean;
  /** called once when removed */
  dispose?: () => void;
}

const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];
const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const OK = ['Enter', 'NumpadEnter', 'Space'];
const BACK = ['Escape', 'Backspace'];

export type UiSound = 'move' | 'select' | 'back';

export class UI {
  private current: Screen | null = null;
  private index = 0;
  /** hook for menu sounds (wired in the audio stage) */
  onSound: (s: UiSound) => void = () => {};

  constructor(private host: HTMLElement) {}

  get active(): boolean {
    return this.current !== null;
  }

  get selectedIndex(): number {
    return this.index;
  }

  get screenId(): string | null {
    return this.current?.id ?? null;
  }

  /** instant: swap without the transition (e.g. switching tabs) */
  show(screen: Screen, instant = false): void {
    this.leave(instant);
    this.current = screen;
    screen.root.classList.add('screen');
    if (!instant) screen.root.classList.add('entering');
    this.host.appendChild(screen.root);
    // force layout so the enter transition runs
    void screen.root.offsetWidth;
    screen.root.classList.remove('entering');
    screen.items.forEach((item, i) => {
      item.el.classList.add('nav');
      item.el.addEventListener('mouseenter', () => {
        if (!item.disabled) this.select(i, false);
      });
      item.el.addEventListener('click', (e) => {
        e.preventDefault();
        if (item.disabled) return;
        this.select(i, false);
        this.activate();
      });
      if (item.disabled) item.el.classList.add('disabled');
    });
    this.index = -1;
    const first = screen.initial ?? screen.items.findIndex((it) => !it.disabled);
    if (first >= 0) this.select(first, false);
  }

  hide(): void {
    this.leave();
    this.current = null;
  }

  private leave(instant = false): void {
    const old = this.current;
    if (!old) return;
    old.dispose?.();
    const el = old.root;
    if (instant) {
      el.remove();
      return;
    }
    el.classList.add('leaving');
    el.style.pointerEvents = 'none';
    window.setTimeout(() => el.remove(), 260);
  }

  select(i: number, sound = true): void {
    const s = this.current;
    if (!s || i === this.index || !s.items[i]) return;
    s.items[this.index]?.el.classList.remove('sel');
    this.index = i;
    s.items[i].el.classList.add('sel');
    if (sound) this.onSound('move');
  }

  private step(dir: number): void {
    const s = this.current;
    if (!s || s.items.length === 0) return;
    let i = this.index;
    for (let n = 0; n < s.items.length; n++) {
      i = (i + dir + s.items.length) % s.items.length;
      if (!s.items[i].disabled) break;
    }
    this.select(i);
  }

  private activate(): void {
    const item = this.current?.items[this.index];
    if (!item || item.disabled) return;
    item.el.classList.remove('pressed');
    void item.el.offsetWidth;
    item.el.classList.add('pressed');
    if (item.activate) {
      this.onSound('select');
      item.activate();
    } else if (item.right) {
      item.right();
      this.onSound('move');
    }
  }

  handleKey(code: string): void {
    const s = this.current;
    if (!s) return;
    if (s.onKey?.(code)) return;
    const item = s.items[this.index];
    if (UP.includes(code)) this.step(-1);
    else if (DOWN.includes(code)) this.step(1);
    else if (LEFT.includes(code)) {
      if (item?.left) {
        item.left();
        this.onSound('move');
      } else this.step(-1);
    } else if (RIGHT.includes(code)) {
      if (item?.right) {
        item.right();
        this.onSound('move');
      } else this.step(1);
    } else if (OK.includes(code)) this.activate();
    else if (BACK.includes(code) && s.back) {
      this.onSound('back');
      s.back();
    }
  }
}

// ------------------------------------------------------------------ helpers

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
  children: Array<HTMLElement | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  for (const c of children) el.append(c);
  return el;
}

export function button(label: string, activate: () => void, cls = 'btn', disabled = false, tag?: string): NavItem {
  const el = h('button', cls);
  el.type = 'button';
  el.append(h('span', 'btn-label', label));
  if (tag) el.append(h('span', 'btn-tag', tag));
  return { el, activate, disabled };
}

/** A row with a label and a set of values cycled with ←/→. */
export function optionRow<T>(
  label: string,
  values: Array<{ value: T; label: string }>,
  get: () => T,
  set: (v: T) => void,
): NavItem {
  const el = h('div', 'opt-row');
  el.append(h('span', 'opt-label', label));
  const seg = h('div', 'opt-seg');
  const chips = values.map((v) => {
    const c = h('span', 'opt-chip', v.label);
    c.addEventListener('click', (e) => {
      e.stopPropagation();
      set(v.value);
      refresh();
    });
    seg.append(c);
    return c;
  });
  el.append(seg);
  const refresh = (): void => {
    const cur = get();
    values.forEach((v, i) => chips[i].classList.toggle('on', v.value === cur));
  };
  const shift = (d: number): void => {
    const i = values.findIndex((v) => v.value === get());
    set(values[(i + d + values.length) % values.length].value);
    refresh();
  };
  refresh();
  return { el, left: () => shift(-1), right: () => shift(1) };
}

/** A 0..1 value with a real 0–100 % slider (drag, click, or ←/→ in steps of 5 %). */
export function sliderRow(label: string, get: () => number, set: (v: number) => void): NavItem {
  const el = h('div', 'opt-row');
  el.append(h('span', 'opt-label', label));
  const wrap = h('div', 'slider');
  const input = h('input', 'range');
  input.type = 'range';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  const val = h('span', 'slider-val');
  wrap.append(input, val);
  el.append(wrap);
  const refresh = (): void => {
    const v = Math.round(get() * 100);
    input.value = String(v);
    input.style.setProperty('--fill', `${v}%`);
    val.textContent = `${v}%`;
  };
  input.addEventListener('input', () => {
    set(Number(input.value) / 100);
    refresh();
  });
  // keep clicks on the slider from triggering the row action
  for (const ev of ['click', 'pointerdown', 'keydown']) input.addEventListener(ev, (e) => e.stopPropagation());
  const shift = (d: number): void => {
    const v = Math.max(0, Math.min(100, Math.round(get() * 100 / 5) * 5 + d));
    set(v / 100);
    refresh();
  };
  refresh();
  return { el, left: () => shift(-5), right: () => shift(5) };
}

export function keycap(text: string, wide = false): HTMLElement {
  const arrow = /^[←→↑↓]$/.test(text);
  return h('kbd', `key${wide ? ' wide' : ''}${arrow ? ' arrow' : ''}`, text);
}
