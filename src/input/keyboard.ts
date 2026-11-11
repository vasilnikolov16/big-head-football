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

/**
 * Some environments (remote desktops, a few browsers/automation tools) send an
 * empty `code`; derive it from `key` + `location` so controls still work.
 */
function codeOf(e: KeyboardEvent): string {
  if (e.code) return e.code;
  const k = e.key;
  if (k === 'Shift') return e.location === 2 ? 'ShiftRight' : 'ShiftLeft';
  if (k === 'Enter') return e.location === 3 ? 'NumpadEnter' : 'Enter';
  if (k === ' ') return 'Space';
  if (k.startsWith('Arrow') || k === 'Escape' || k === 'Backspace' || k === 'Tab') return k;
  if (/^[a-z]$/i.test(k)) return 'Key' + k.toUpperCase();
  return k;
}

/** Typing a name or a room code: the game must not react to those keys. */
function typing(e: KeyboardEvent): boolean {
  const el = e.target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || el.isContentEditable) return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return type === 'text' || type === 'search' || type === 'url' || type === 'email' || type === 'password' || type === 'number' || type === 'tel';
}

export class Keyboard {
  private down = new Map<string, number>();
  private presses = new Map<string, number>();
  private seq = 0;
  private listeners: Array<(code: string) => void> = [];
  /** keys bound to gameplay: the browser must not scroll/act on them */
  private gameKeys = new Set<string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', this.onDown, { passive: false });
    target.addEventListener('keyup', this.onUp, { passive: false });
    target.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.reset();
    });
  }

  private onDown = (e: KeyboardEvent): void => {
    if (typing(e)) return;
    const code = codeOf(e);
    if (BLOCKED.has(code) || this.gameKeys.has(code)) e.preventDefault();
    if (e.repeat) return;
    if (!this.down.has(code)) this.down.set(code, ++this.seq);
    this.presses.set(code, performance.now());
    for (const fn of this.listeners) fn(code);
  };

  private onUp = (e: KeyboardEvent): void => {
    const code = codeOf(e);
    if (typing(e)) {
      this.down.delete(code);
      return;
    }
    if (BLOCKED.has(code) || this.gameKeys.has(code)) e.preventDefault();
    this.down.delete(code);
  };

  setGameKeys(codes: string[]): void {
    this.gameKeys = new Set(codes);
  }

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
