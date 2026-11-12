type Handler<T> = (payload: T) => void;

/** Tiny typed event bus. Gameplay emits, audio/fx/ui listen. */
export class Emitter<E extends Record<string, unknown>> {
  private handlers = new Map<keyof E, Set<Handler<never>>>();

  on<K extends keyof E>(key: K, fn: Handler<E[K]>): () => void {
    let set = this.handlers.get(key);
    if (!set) {
      set = new Set();
      this.handlers.set(key, set);
    }
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof E>(key: K, payload: E[K]): void {
    const set = this.handlers.get(key);
    if (!set) return;
    for (const fn of set) (fn as Handler<E[K]>)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}

export type Surface = 'ground' | 'wall' | 'bar' | 'ceiling';

export type GameEvents = {
  kick: { player: number; x: number; y: number; speed: number; sweet: number };
  header: { player: number; x: number; y: number; speed: number };
  touch: { player: number };
  jump: { player: number; x: number; y: number };
  /** quick burst of speed (double tap left/right) */
  dash: { player: number; x: number; y: number; dir: number };
  /** a dashing player crashed into the other one */
  bump: { player: number; x: number; y: number; force: number };
  land: { player: number; x: number; y: number; force: number };
  /** both players hit the ball at once: it pops up */
  clash: { x: number; y: number };
  bounce: { surface: Surface; x: number; y: number; speed: number };
  goal: { scorer: number; x: number; y: number; golden: boolean };
  whistle: { kind: 'start' | 'end' | 'golden' };
  matchEnd: { winner: number };
  superArmed: { player: number };
  /** a charged player touched the ball: the wind-up before the super shot */
  superWindup: { player: number; id: string; x: number; y: number };
  superShot: { player: number; id: string; x: number; y: number };
  /** the opponent stopped a super shot */
  superBlocked: { player: number; id: string; x: number; y: number };
  superHit: { player: number; x: number; y: number };
  powerSpawn: { type: string; x: number };
  powerPick: { player: number; type: string; x: number; y: number; color: string; good: boolean };
  powerEnd: { player: number; type: string };
};
