import type { Keyboard } from './keyboard';

export type Action = 'left' | 'right' | 'jump' | 'kick' | 'super';

export const ACTIONS: Action[] = ['left', 'right', 'jump', 'kick', 'super'];

export const ACTION_LABELS: Record<Action, string> = {
  left: 'Наляво',
  right: 'Надясно',
  jump: 'Скок',
  kick: 'Ритник',
  super: 'Супер удар',
};

/** Key codes (KeyboardEvent.code) per action. The first one is the main key. */
export type Binding = Record<Action, string[]>;

export const DEFAULT_P1: Binding = {
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyW'],
  kick: ['KeyS'],
  super: ['ShiftLeft'],
};

export const DEFAULT_P2: Binding = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['ArrowUp'],
  kick: ['ArrowDown'],
  super: ['ShiftRight', 'Enter', 'NumpadEnter'],
};

export const cloneBinding = (b: Binding): Binding => ({
  left: [...b.left],
  right: [...b.right],
  jump: [...b.jump],
  kick: [...b.kick],
  super: [...b.super],
});

/** Keys that keep their global meaning and can't be bound (pause, FPS counter…). */
export const RESERVED_KEYS = new Set(['Escape', 'KeyP', 'F3', 'Backquote', 'Tab', 'MetaLeft', 'MetaRight', 'ContextMenu']);

const NAMED: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  Space: 'Space',
  Enter: 'Enter',
  NumpadEnter: 'Num Enter',
  Backspace: 'Backspace',
  CapsLock: 'Caps',
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Insert: 'Ins',
  Delete: 'Del',
  Home: 'Home',
  End: 'End',
  PageUp: 'PgUp',
  PageDown: 'PgDn',
  NumpadAdd: 'Num +',
  NumpadSubtract: 'Num -',
  NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /',
  NumpadDecimal: 'Num .',
};

/** Human readable key name for a KeyboardEvent.code. */
export function keyLabel(code: string): string {
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** What a player wants to do this simulation step. Same shape for humans and AI. */
export interface PlayerIntent {
  move: number; // -1..1
  jumpHeld: boolean;
  jumpPressed: boolean;
  kickPressed: boolean;
  superPressed: boolean;
}

export const emptyIntent = (): PlayerIntent => ({
  move: 0,
  jumpHeld: false,
  jumpPressed: false,
  kickPressed: false,
  superPressed: false,
});

export interface Controller {
  read(out: PlayerIntent): void;
}

export class KeyboardController implements Controller {
  constructor(
    private kb: Keyboard,
    /** live reference: rebinding in the settings applies immediately */
    public binding: Binding,
  ) {}

  read(out: PlayerIntent): void {
    const b = this.binding;
    const l = this.kb.order(b.left);
    const r = this.kb.order(b.right);
    // Both held: the most recently pressed direction wins (feels much better than stopping).
    out.move = l === 0 && r === 0 ? 0 : l > r ? -1 : 1;
    out.jumpHeld = this.kb.anyDown(b.jump);
    out.jumpPressed = this.kb.consume(b.jump);
    out.kickPressed = this.kb.consume(b.kick);
    out.superPressed = this.kb.consume(b.super);
  }
}

/** Keys a player uses in menus derived from their game binding. */
export interface MenuKeys {
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  ok: string[];
  cancel: string[];
}

export function menuKeys(b: Binding, extraOk: string, cancel: string): MenuKeys {
  const used = new Set([...b.left, ...b.right, ...b.jump, ...b.kick]);
  const ok = used.has(extraOk) ? [...b.super] : [extraOk, ...b.super.filter((k) => k !== extraOk)];
  return { left: b.left, right: b.right, up: b.jump, down: b.kick, ok, cancel: used.has(cancel) ? [] : [cancel] };
}
