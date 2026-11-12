/**
 * Stadiums (weather changes how the ball and the players behave) and the
 * "crazy" party rules. Both end up in one Env object on the arena that the
 * physics reads every step.
 */

export type StadiumId = 'classic' | 'night' | 'rain' | 'snow' | 'beach';
export const STADIUM_IDS: StadiumId[] = ['classic', 'night', 'rain', 'snow', 'beach'];

export interface Env {
  /** bounce and friction of the ground */
  groundBounce: number;
  groundFriction: number;
  /** constant rolling friction, px/s² */
  rollDecel: number;
  /** air drag multiplier */
  dragMul: number;
  /** gravity multipliers */
  ballGravity: number;
  playerGravity: number;
  /** players: top speed, grip (acceleration on the ground), jump strength */
  runMul: number;
  grip: number;
  jumpMul: number;
  /** party rule: kicks do nothing, only heads and bodies */
  noKicks: boolean;
}

export const BASE_ENV: Env = {
  groundBounce: 0.86,
  groundFriction: 0.45,
  rollDecel: 60,
  dragMul: 1,
  ballGravity: 1,
  playerGravity: 1,
  runMul: 1,
  grip: 1,
  jumpMul: 1,
  noKicks: false,
};

export interface StadiumInfo {
  name: { bg: string; en: string };
  desc: { bg: string; en: string };
  icon: string;
  env: Partial<Env>;
}

export const STADIUMS: Record<StadiumId, StadiumInfo> = {
  classic: {
    name: { bg: 'Класически', en: 'Classic' },
    desc: { bg: 'Вечерен мач при нормални условия.', en: 'An evening match, normal conditions.' },
    icon: '🏟️',
    env: {},
  },
  night: {
    name: { bg: 'Нощ', en: 'Night' },
    desc: { bg: 'Тъмно небе и ярки прожектори.', en: 'A dark sky and bright floodlights.' },
    icon: '🌙',
    env: {},
  },
  rain: {
    name: { bg: 'Дъжд', en: 'Rain' },
    desc: { bg: 'Мокра трева: топката се плъзга, а героите се подхлъзват.', en: 'Wet grass: the ball skids and the heroes slip.' },
    icon: '🌧️',
    env: { groundFriction: 0.15, rollDecel: 18, groundBounce: 0.8, grip: 0.42, dragMul: 1.1 },
  },
  snow: {
    name: { bg: 'Сняг', en: 'Snow' },
    desc: { bg: 'Тежка снежна топка и бавни крака.', en: 'A heavy snowy ball and slow legs.' },
    icon: '❄️',
    env: { dragMul: 1.45, groundBounce: 0.66, rollDecel: 170, runMul: 0.86, grip: 0.8, ballGravity: 1.1 },
  },
  beach: {
    name: { bg: 'Плаж', en: 'Beach' },
    desc: { bg: 'Пясъкът поглъща отскока и спира топката.', en: 'The sand soaks up bounces and stops the ball.' },
    icon: '🏖️',
    env: { groundBounce: 0.5, groundFriction: 0.75, rollDecel: 320, runMul: 0.92, jumpMul: 0.95 },
  },
};

/** Crazy party rules (one at a time, chosen in the party menu). */
export interface MatchRules {
  headsOnly?: boolean;
  lowGravity?: boolean;
  doubleBall?: boolean;
  allSuper?: boolean;
}

export type PartyMode = 'lowgrav' | 'double' | 'allsuper';
export const PARTY_IDS: PartyMode[] = ['lowgrav', 'double', 'allsuper'];

export const PARTY_MODES: Record<PartyMode, { name: { bg: string; en: string }; desc: { bg: string; en: string }; icon: string; rules: MatchRules }> = {
  lowgrav: {
    name: { bg: 'Ниска гравитация', en: 'Low Gravity' },
    desc: { bg: 'Мач на Луната: огромни скокове и топка, която не пада.', en: 'A match on the Moon: huge jumps and a ball that won’t come down.' },
    icon: '🌕',
    rules: { lowGravity: true },
  },
  double: {
    name: { bg: 'Двойна топка', en: 'Double Ball' },
    desc: { bg: 'Две топки на терена едновременно.', en: 'Two balls on the pitch at once.' },
    icon: '⚽',
    rules: { doubleBall: true },
  },
  allsuper: {
    name: { bg: 'Всеки удар е супер', en: 'Every Kick Is Super' },
    desc: { bg: 'Всеки ритник изстрелва супер удара на героя.', en: 'Every kick fires the hero’s super shot.' },
    icon: '⚡',
    rules: { allSuper: true },
  },
};

export function makeEnv(stadium: StadiumId = 'classic', rules: MatchRules = {}): Env {
  const env: Env = { ...BASE_ENV, ...STADIUMS[stadium]?.env };
  if (rules.lowGravity) {
    env.ballGravity *= 0.5;
    env.playerGravity *= 0.5;
    env.dragMul *= 0.7;
  }
  if (rules.headsOnly) env.noKicks = true;
  return env;
}

/** 'random' is resolved when a match starts */
export function pickStadium(choice: StadiumId | 'random'): StadiumId {
  if (choice !== 'random') return choice;
  return STADIUM_IDS[Math.floor(Math.random() * STADIUM_IDS.length)];
}
