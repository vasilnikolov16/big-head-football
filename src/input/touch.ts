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
  private seq = 0;
  private taps = new DoubleTap();
  private visible = true;
  onPause: () => void = () => {};
  /** online: an emote was picked from the emote row */
  onEmote: (i: number) => void = () => {};
  private emoteBtn: HTMLElement;
  private emoteRow: HTMLElement;
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
      el.innerHTML = `<span class="tb-icon">${icon}</span>` + (label ? `<span class="tb-label" data-k="${label}"></span>` : '');
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
    pause.innerHTML = '<span>❚❚</span>';
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.onPause();
    });
    root.append(pause);
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
    root.addEventListener('pointermove', this.move, { passive: false });
    root.addEventListener('pointerup', this.up);
    root.addEventListener('pointercancel', this.up);
    root.addEventListener('lostpointercapture', this.up);
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
    const b = this.btnAt(e.clientX, e.clientY);
    this.fingers.set(e.pointerId, b);
    this.press(b);
    try {
      this.root.setPointerCapture?.(e.pointerId);
    } catch {
      /* some browsers refuse capture for this pointer: tracking still works */
    }
  };

  private move = (e: PointerEvent): void => {
    if (!this.fingers.has(e.pointerId)) return;
    e.preventDefault();
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
    const b = this.fingers.get(e.pointerId) ?? null;
    this.fingers.delete(e.pointerId);
    this.release(b);
  };

  setVisible(v: boolean): void {
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
