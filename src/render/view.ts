import type { Match } from '../game/match';
import type { ActiveEffect, PowerItem } from '../game/powerups';
import type { SuperShot } from '../game/supers';

/**
 * What the renderer needs to draw a frame. A live Match satisfies it, and so
 * does the replay player's stand-in object.
 */
export type RenderView = Pick<
  Match,
  'arena' | 'ball' | 'players' | 'decoys' | 'shockwave' | 'callout' | 'banner' | 'config' | 'score' | 'timeLeft' | 'golden' | 'phase'
> & {
  superShot: SuperShot | null;
  powerups: { items: PowerItem[]; active: ActiveEffect[] };
};
