import { CHARACTERS } from './characters';
import { COSMETICS, type CosItem } from './cosmetics';

/**
 * Wheel of fortune: one free spin every 12 hours. Coins are the most common,
 * a shop item is rarer, a hero is the rarest prize.
 */

export const SPIN_EVERY = 12 * 60 * 60 * 1000;

export type WheelPrize = { kind: 'coins'; n: number } | { kind: 'item' } | { kind: 'hero' };

export interface WheelSegment {
  prize: WheelPrize;
  /** relative chance */
  weight: number;
  label: string;
  icon: string;
  color: string;
}

export const SEGMENTS: WheelSegment[] = [
  { prize: { kind: 'coins', n: 25 }, weight: 26, label: '25', icon: '🪙', color: '#4f6bd8' },
  { prize: { kind: 'coins', n: 100 }, weight: 13, label: '100', icon: '🪙', color: '#e0565b' },
  { prize: { kind: 'item' }, weight: 9, label: '', icon: '🎁', color: '#9b5de5' },
  { prize: { kind: 'coins', n: 50 }, weight: 22, label: '50', icon: '🪙', color: '#2fb47c' },
  { prize: { kind: 'coins', n: 200 }, weight: 8, label: '200', icon: '💰', color: '#f08c2e' },
  { prize: { kind: 'hero' }, weight: 2, label: '', icon: '🦸', color: '#d6336c' },
  { prize: { kind: 'coins', n: 50 }, weight: 16, label: '50', icon: '🪙', color: '#3aa0c8' },
  { prize: { kind: 'coins', n: 500 }, weight: 4, label: '500', icon: '💎', color: '#c9a227' },
];

/** a weighted random segment index */
export function rollSegment(rnd = Math.random): number {
  const total = SEGMENTS.reduce((a, s) => a + s.weight, 0);
  let x = rnd() * total;
  for (let i = 0; i < SEGMENTS.length; i++) {
    x -= SEGMENTS[i].weight;
    if (x < 0) return i;
  }
  return 0;
}

/** shop items the player doesn't have yet (cheaper ones a bit more likely) */
export function pickItem(owns: (it: CosItem) => boolean): CosItem | null {
  const left = COSMETICS.filter((c) => c.price !== undefined && !owns(c));
  if (!left.length) return null;
  const weights = left.map((c) => 1000 / (c.price ?? 1000));
  let x = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < left.length; i++) {
    x -= weights[i];
    if (x < 0) return left[i];
  }
  return left[0];
}

/** a shop hero the player hasn't unlocked yet */
export function pickHero(unlocked: (id: string) => boolean): string | null {
  const left = CHARACTERS.filter((c) => c.unlock === 'shop' && !unlocked(c.id));
  return left.length ? left[Math.floor(Math.random() * left.length)].id : null;
}
