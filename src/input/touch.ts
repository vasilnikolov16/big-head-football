import type { Settings, TouchLayout } from '../core/storage';
import { t } from '../i18n/i18n';
import { DoubleTap, emptyIntent, type Controller, type PlayerIntent } from './controls';

type Btn = 'left' | 'right' | 'jump' | 'kick' | 'super';

/**
 * On-screen buttons for phones/tablets: ◀ ▶ bottom-left, and a row of
 * super / kick / jump bottom-right (jump on the outside, under the thumb).
 * Multi-touch: every finger is tracked, a thumb can slide from button to
 * button, and a quick double tap on ◀ or ▶ dashes.
 */
export class TouchControls implements Controller {
  readonly root: HTMLElement;
  private els = new Map<Btn, HTMLElement>();
  private held = new Map<Btn, number>(); // button -> order it was pressed in
  private pressed = new Set<Btn>();
  private fingers = new Map<number, Btn | null>();
  /** where each finger was last seen (to find fingers whose "up" never arrived) */
  private fingerPos = new Map<number, { x: number; y: number }>();
  private seq = 0;
  private taps = new DoubleTap();
  private visible = true;
  onPause: () => void = () => {};
  /** online: an emote was picked from the emote row */
  onEmote: (i: number) => void = () => {};
  private emoteBtn: HTMLElement;
  private emoteRow: HTMLElement;
  private pauseBtn: HTMLElement;
  private layout: TouchLayout = {};
  /** layout editor: buttons are dragged instead of pressed */
  private editing = false;
  private drag: { id: number; el: HTMLElement; key: keyof TouchLayout; dx: number; dy: number } | null = null;
  private onLayoutChange: ((l: TouchLayout) => void) | null = null;
  /** first touch anywhere (used to switch on touch mode and go fullscreen) */
  onFirstTouch: () => void = () => {};

  constructor(host: HTMLElement) {
    const root = document.createElement('div');
    root.className = 'touch-pad';
    this.root = root;
    const make = (b: Btn, icon: string, label?: string): void => {
      const el = document.createElement('div');
      el.className = `tbtn tb-${b}`;
      el.dataset.btn = b;
      // actions show just their name, the arrows just an arrow
      el.innerHTML = label ? `<span class="tb-label" data-k="${label}"></span>` : `<span class="tb-icon">${icon}</span>`;
      root.append(el);
      this.els.set(b, el);
    };
    make('left', '◀');
    make('right', '▶');
    make('super', '⚡', 'act.superShort');
    make('kick', '👟', 'act.kick');
    make('jump', '⬆', 'act.jump');
    this.relabel();
    const pause = document.createElement('div');
    pause.className = 'tbtn tb-pause';
    pause.dataset.btn = 'pause';
    pause.innerHTML = '<span>❚❚</span>';
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (!this.editing) this.onPause();
    });
    root.append(pause);
    this.pauseBtn = pause;
    // online emotes: a button that opens a row of emojis
    const emoteBtn = document.createElement('div');
    emoteBtn.className = 'tbtn tb-emote';
    emoteBtn.innerHTML = '<span>😀</span>';
    const row = document.createElement('div');
    row.className = 'emote-row';
    ['😂', '👏', '😡', '😱'].forEach((icon, i) => {
      const b = document.createElement('div');
      b.className = 'emote-pick';
      b.textContent = icon;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        row.classList.remove('open');
        this.onEmote(i);
      });
      row.append(b);
    });
    emoteBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.toggle('open');
    });
    root.append(emoteBtn, row);
    this.emoteBtn = emoteBtn;
    this.emoteRow = row;
    this.setEmotes(false);
    host.append(root);

    root.addEventListener('pointerdown', this.down, { passive: false });
    // iPhone: stops the long-press magnifier / text selection that hitches the game
    // while a button is held (pointer events still arrive)
    root.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    root.addEventListener('pointermove', this.move, { passive: false });
    // the finger can be lifted anywhere (it may have slid off the button): listen on the whole window
    window.addEventListener('pointerup', this.up, true);
    window.addEventListener('pointercancel', this.up, true);
    root.addEventListener('lostpointercapture', this.up);
    // safety net: iPhone sometimes never reports a lifted finger (system swipes, the volume
    // pop-up, a third finger...). Every touch event carries the list of fingers really on the
    // screen, so any button held by a finger that is no longer there is let go.
    const sync = (e: TouchEvent): void => {
      const list = e.touches;
      window.setTimeout(() => this.syncTouches(list), 0);
    };
    window.addEventListener('touchstart', sync, { capture: true, passive: true });
    window.addEventListener('touchend', sync, { capture: true, passive: true });
    window.addEventListener('touchcancel', sync, { capture: true, passive: true });
    // the app went to the background / lost focus: nothing stays pressed
    window.addEventListener('blur', () => this.letGoAll());
    window.addEventListener('pagehide', () => this.letGoAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.letGoAll();
    });
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.onFirstTouch();
    });
    this.setVisible(false);
  }

  /** button captions in the current language */
  relabel(): void {
    for (const el of this.root.querySelectorAll<HTMLElement>('.tb-label')) el.textContent = t(el.dataset.k ?? '');
  }

  private btnAt(x: number, y: number): Btn | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const b = el?.closest<HTMLElement>('.tbtn')?.dataset.btn as Btn | undefined;
    return b && this.els.has(b) ? b : null;
  }

  private press(b: Btn | null): void {
    if (!b) return;
    if (!this.held.has(b)) {
      this.pressed.add(b);
      if (b === 'left' || b === 'right') this.taps.press(b === 'left' ? -1 : 1, performance.now());
    }
    this.held.set(b, ++this.seq);
    this.els.get(b)!.classList.add('down');
  }

  private release(b: Btn | null): void {
    if (!b) return;
    // still held by another finger?
    for (const f of this.fingers.values()) if (f === b) return;
    this.held.delete(b);
    this.els.get(b)!.classList.remove('down');
  }

  /** the emote button is only there in online matches */
  setEmotes(on: boolean): void {
    this.emoteBtn.style.display = on ? '' : 'none';
    if (!on) this.emoteRow.classList.remove('open');
  }

  private down = (e: PointerEvent): void => {
    e.preventDefault();
    if (this.editing) {
      this.startDrag(e);
      return;
    }
    const b = this.btnAt(e.clientX, e.clientY);
    this.fingers.set(e.pointerId, b);
    this.fingerPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.press(b);
    try {
      this.root.setPointerCapture?.(e.pointerId);
    } catch {
      /* some browsers refuse capture for this pointer: tracking still works */
    }
  };

  private move = (e: PointerEvent): void => {
    if (this.drag) {
      if (e.pointerId === this.drag.id) this.dragTo(e);
      return;
    }
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
    this.fingerPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const was = this.fingers.get(e.pointerId) ?? null;
    const now = this.btnAt(e.clientX, e.clientY);
    // a sliding thumb moves from button to button (rolling from kick onto jump presses jump)
    if (now !== was && now !== null) {
      this.fingers.set(e.pointerId, now);
      this.release(was);
      this.press(now);
    }
  };

  private up = (e: PointerEvent): void => {
    if (this.drag && e.pointerId === this.drag.id) {
      this.drag.el.classList.remove('dragging');
      this.drag = null;
      this.onLayoutChange?.({ ...this.layout });
      return;
    }
    if (!this.fingers.has(e.pointerId)) return;
    const b = this.fingers.get(e.pointerId) ?? null;
    this.fingers.delete(e.pointerId);
    this.fingerPos.delete(e.pointerId);
    this.release(b);
  };

  /** let go of every button (taps not read yet still count) */
  private letGoAll(): void {
    const btns = [...this.fingers.values()];
    this.fingers.clear();
    this.fingerPos.clear();
    for (const b of btns) this.release(b);
  }

  /**
   * Compare our fingers with the touches really on the screen. Fingers that are
   * no longer there (their "up" got lost) let go of their buttons. Each real
   * touch keeps the closest of our fingers.
   */
  private syncTouches(list: TouchList): void {
    if (this.drag || this.fingers.size === 0) return;
    if (list.length === 0) {
      this.letGoAll();
      return;
    }
    if (this.fingers.size <= list.length) return;
    const keep = new Set<number>();
    for (let i = 0; i < list.length; i++) {
      const tch = list[i];
      let best = -1;
      let bestD = Infinity;
      for (const [id, p] of this.fingerPos) {
        if (keep.has(id)) continue;
        const d = (p.x - tch.clientX) ** 2 + (p.y - tch.clientY) ** 2;
        if (d < bestD) {
          bestD = d;
          best = id;
        }
      }
      if (best !== -1) keep.add(best);
    }
    for (const id of [...this.fingers.keys()]) {
      if (keep.has(id)) continue;
      const b = this.fingers.get(id) ?? null;
      this.fingers.delete(id);
      this.fingerPos.delete(id);
      this.release(b);
    }
  }

  // ------------------------------------------------------------------ look & layout

  /** size, see-through-ness and custom positions from the settings */
  applySettings(s: Pick<Settings, 'touchSize' | 'touchOpacity' | 'touchLayout'>): void {
    this.root.style.setProperty('--tsize', String(s.touchSize === 'small' ? 0.8 : s.touchSize === 'large' ? 1.25 : 1));
    this.root.style.setProperty('--topac', String(s.touchOpacity === 'solid' ? 1 : s.touchOpacity === 'clear' ? 0.45 : 0.8));
    this.layout = { ...s.touchLayout };
    this.placeAll();
  }

  private elFor(k: keyof TouchLayout): HTMLElement | undefined {
    return k === 'pause' ? this.pauseBtn : this.els.get(k);
  }

  private placeAll(): void {
    for (const k of ['left', 'right', 'super', 'kick', 'jump', 'pause'] as const) {
      const el = this.elFor(k);
      if (!el) continue;
      const p = this.layout[k];
      if (p) {
        el.style.left = `${p.x * 100}%`;
        el.style.top = `${p.y * 100}%`;
        el.style.right = el.style.bottom = 'auto';
        el.style.translate = '-50% -50%';
      } else {
        el.style.left = el.style.top = el.style.right = el.style.bottom = el.style.translate = '';
      }
    }
  }

  /** Layout editor on/off: buttons can be dragged anywhere; changes are reported. */
  setEditing(on: boolean, onChange: ((l: TouchLayout) => void) | null = null): void {
    this.editing = on;
    this.onLayoutChange = onChange;
    this.drag = null;
    this.root.classList.toggle('editing', on);
    this.clear();
    if (on) {
      this.visible = false;
      this.setVisible(true);
      this.setEmotes(false);
    }
  }

  private startDrag(e: PointerEvent): void {
    const el = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('.tbtn');
    const key = el?.dataset.btn as keyof TouchLayout | undefined;
    if (!el || !key || !['left', 'right', 'super', 'kick', 'jump', 'pause'].includes(key)) return;
    const r = el.getBoundingClientRect();
    this.drag = { id: e.pointerId, el, key, dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height / 2) };
    el.classList.add('dragging');
    try {
      this.root.setPointerCapture?.(e.pointerId);
    } catch {
      /* fine */
    }
    this.dragTo(e);
  }

  private dragTo(e: PointerEvent): void {
    const d = this.drag!;
    const pad = this.root.getBoundingClientRect();
    const b = d.el.getBoundingClientRect();
    const hw = b.width / 2 / pad.width;
    const hh = b.height / 2 / pad.height;
    const x = Math.min(1 - hw, Math.max(hw, (e.clientX - d.dx - pad.left) / pad.width));
    const y = Math.min(1 - hh, Math.max(hh, (e.clientY - d.dy - pad.top) / pad.height));
    this.layout[d.key] = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
    this.placeAll();
  }

  setVisible(v: boolean): void {
    if (this.editing && !v) return;
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? '' : 'none';
    if (!v) this.clear();
  }

  /** Lights up the super button when the energy bar is full. */
  setSuperReady(ready: boolean, charged: boolean): void {
    const el = this.els.get('super')!;
    el.classList.toggle('ready', ready);
    el.classList.toggle('charged', charged);
  }

  clear(): void {
    this.held.clear();
    this.pressed.clear();
    this.fingers.clear();
    this.fingerPos.clear();
    this.taps.clear();
    for (const el of this.els.values()) el.classList.remove('down');
  }

  read(out: PlayerIntent): void {
    const l = this.held.get('left') ?? 0;
    const r = this.held.get('right') ?? 0;
    out.move = l === 0 && r === 0 ? 0 : l > r ? -1 : 1;
    out.jumpHeld = this.held.has('jump');
    out.jumpPressed = this.pressed.delete('jump');
    out.kickPressed = this.pressed.delete('kick');
    out.superPressed = this.pressed.delete('super');
    this.pressed.delete('left');
    this.pressed.delete('right');
    out.dash = this.taps.take();
  }
}

/** Merges several controllers (keyboard + touch for the same player). */
export class MultiController implements Controller {
  private tmp: PlayerIntent = emptyIntent();

  constructor(private list: Controller[]) {}

  read(out: PlayerIntent): void {
    out.move = 0;
    out.jumpHeld = out.jumpPressed = out.kickPressed = out.superPressed = false;
    out.dash = 0;
    for (const c of this.list) {
      c.read(this.tmp);
      if (this.tmp.move !== 0) out.move = this.tmp.move;
      out.jumpHeld ||= this.tmp.jumpHeld;
      out.jumpPressed ||= this.tmp.jumpPressed;
      out.kickPressed ||= this.tmp.kickPressed;
      out.superPressed ||= this.tmp.superPressed;
      if (this.tmp.dash) out.dash = this.tmp.dash;
    }
  }
}
