import type { Keyboard } from './keyboard';

export interface KeyScheme {
  id: 'wasd' | 'arrows';
  label: string;
  left: string[];
  right: string[];
  jump: string[];
  kick: string[];
  super: string[];
}

export const SCHEME_WASD: KeyScheme = {
  id: 'wasd',
  label: 'WASD',
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['KeyW'],
  kick: ['KeyS'],
  super: ['ShiftLeft'],
};

export const SCHEME_ARROWS: KeyScheme = {
  id: 'arrows',
  label: 'Стрелки',
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  jump: ['ArrowUp'],
  kick: ['ArrowDown'],
  super: ['ShiftRight', 'Enter', 'NumpadEnter'],
};

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
    public scheme: KeyScheme,
  ) {}

  read(out: PlayerIntent): void {
    const s = this.scheme;
    const l = this.kb.order(s.left);
    const r = this.kb.order(s.right);
    // Both held: the most recently pressed direction wins (feels much better than stopping).
    out.move = l === 0 && r === 0 ? 0 : l > r ? -1 : 1;
    out.jumpHeld = this.kb.anyDown(s.jump);
    out.jumpPressed = this.kb.consume(s.jump);
    out.kickPressed = this.kb.consume(s.kick);
    out.superPressed = this.kb.consume(s.super);
  }
}
