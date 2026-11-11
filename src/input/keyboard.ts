/**
 * Keyboard state tracker based on `KeyboardEvent.code` (layout independent:
 * works the same with a Bulgarian or English layout active).
 *
 * - `isDown` for held keys
 * - `consume` for "pressed" edges; presses expire after PRESS_TTL so a key
 *   tapped during a pause does not fire later.
 * - `order` returns a sequence number so "last pressed wins" for left/right.
 */
const PRESS_TTL = 220; // ms

const BLOCKED = new Set([
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Tab',
  'ShiftLeft',
  'ShiftRight',
  'Enter',
  'NumpadEnter',
  'Backspace',
]);

export class Keyboard {
  private down = new Map<string, number>();
  private presses = new Map<string, number>();
  private seq = 0;
  private listeners: Array<(code: string) => void> = [];

  constructor(target: Window = window) {
    target.addEventListener('keydown', this.onDown, { passive: false });
    target.addEventListener('keyup', this.onUp, { passive: false });
    target.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  private onDown = (e: KeyboardEvent): void => {
    if (BLOCKED.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    if (!this.down.has(e.code)) this.down.set(e.code, ++this.seq);
    this.presses.set(e.code, performance.now());
    for (const fn of this.listeners) fn(e.code);
  };

  private onUp = (e: KeyboardEvent): void => {
    if (BLOCKED.has(e.code)) e.preventDefault();
    this.down.delete(e.code);
  };

  reset = (): void => {
    this.down.clear();
    this.presses.clear();
  };

  /** Subscribe to raw key presses (used by menus). */
  onPress(fn: (code: string) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  anyDown(codes: readonly string[]): boolean {
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }

  /** Highest press-order among codes, 0 if none held. */
  order(codes: readonly string[]): number {
    let best = 0;
    for (const c of codes) {
      const o = this.down.get(c);
      if (o !== undefined && o > best) best = o;
    }
    return best;
  }

  consume(codes: readonly string[]): boolean {
    const now = performance.now();
    let hit = false;
    for (const c of codes) {
      const t = this.presses.get(c);
      if (t === undefined) continue;
      this.presses.delete(c);
      if (now - t <= PRESS_TTL) hit = true;
    }
    return hit;
  }

  flushPresses(): void {
    this.presses.clear();
  }
}
