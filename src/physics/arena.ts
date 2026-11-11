import { BAR_THICK, GOAL_DEPTH, GOAL_TOP, W } from '../core/constants';
import type { Rect } from './collide';

/**
 * Static level geometry: floor, side walls, ceiling and the two crossbars.
 * Goal heights are per side so a "small goal" power-up can shrink one of them.
 */
export class Arena {
  /** y of the crossbar centre for [left goal, right goal] */
  readonly defaultGoalTop = GOAL_TOP;
  goalTop: [number, number] = [GOAL_TOP, GOAL_TOP];
  bars: [Rect, Rect] = [
    { x: 0, y: 0, w: 0, h: 0 },
    { x: 0, y: 0, w: 0, h: 0 },
  ];

  constructor() {
    this.rebuild();
  }

  setGoalTop(side: 0 | 1, y: number): void {
    this.goalTop[side] = y;
    this.rebuild();
  }

  rebuild(): void {
    const w = GOAL_DEPTH + 16;
    const left = this.bars[0];
    left.x = -10;
    left.y = this.goalTop[0] - BAR_THICK / 2;
    left.w = w;
    left.h = BAR_THICK;
    const right = this.bars[1];
    right.x = W - GOAL_DEPTH - 6;
    right.y = this.goalTop[1] - BAR_THICK / 2;
    right.w = w;
    right.h = BAR_THICK;
  }
}
