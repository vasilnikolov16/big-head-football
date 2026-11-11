/**
 * Hero data: stats, colours, face style and super shot. Drawing code for the
 * individual looks lives in render/heroArt.ts, super-shot logic in game/supers.ts.
 */
export type Expression = 'idle' | 'happy' | 'sad' | 'angry' | 'effort' | 'shock';

export type SuperId = 'razor' | 'pounce' | 'laser' | 'sonic' | 'yarn' | 'warp' | 'thunder' | 'shadow';

export interface CharacterStats {
  speed: number; // 1..5
  jump: number;
  power: number;
  head: number;
}

export interface CharacterLook {
  skin: string;
  skinShade: string;
  shirt: string;
  shirtTrim: string;
  shorts: string;
  sock: string;
  shoe: string;
  shoeSole: string;
  /** limbs (arms) colour, defaults to skin */
  arms?: string;
}

export interface FaceStyle {
  ear: boolean;
  eyes: 'normal' | 'sleepy' | 'visor' | 'alien';
  nose: 'human' | 'cat' | 'none';
  mouth: 'human' | 'cat' | 'led' | 'mask';
  brows: boolean;
  cheeks: boolean;
  iris?: string;
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  stats: CharacterStats;
  look: CharacterLook;
  face: FaceStyle;
  super: SuperId;
  /** must be won in the tournament before it can be picked (stage 5) */
  unlock?: 'tournament';
}

const HUMAN: FaceStyle = { ear: true, eyes: 'normal', nose: 'human', mouth: 'human', brows: true, cheeks: true };

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bobo',
    name: 'Бобо',
    tagline: 'Бръснарят с най-острите ножици в квартала',
    stats: { speed: 3, jump: 3, power: 4, head: 3 },
    look: {
      skin: '#f1c39a',
      skinShade: '#d39a70',
      shirt: '#ffffff',
      shirtTrim: '#e63946',
      shorts: '#1d3557',
      sock: '#e63946',
      shoe: '#1d1d2e',
      shoeSole: '#ffffff',
    },
    face: HUMAN,
    super: 'razor',
  },
  {
    id: 'penka',
    name: 'Пенка',
    tagline: 'Котка. Спи 20 часа на ден, а останалите 4 — вкарва',
    stats: { speed: 4, jump: 5, power: 2, head: 3 },
    look: {
      skin: '#9b6a43',
      skinShade: '#6e4628',
      shirt: '#8d939e',
      shirtTrim: '#ffffff',
      shorts: '#5d636e',
      sock: '#ffffff',
      shoe: '#ff8fab',
      shoeSole: '#ffffff',
      arms: '#8d939e',
    },
    face: { ear: false, eyes: 'sleepy', nose: 'cat', mouth: 'cat', brows: false, cheeks: false, iris: '#9ccc3c' },
    super: 'pounce',
  },
  {
    id: 'bip',
    name: 'Бип-0',
    tagline: 'Робот-нападател, версия 0.9 бета',
    stats: { speed: 2, jump: 2, power: 5, head: 4 },
    look: {
      skin: '#b9c6d8',
      skinShade: '#7d8ba3',
      shirt: '#4a5568',
      shirtTrim: '#4fd1ff',
      shorts: '#2d3748',
      sock: '#718096',
      shoe: '#2d3748',
      shoeSole: '#4fd1ff',
      arms: '#9aa8bd',
    },
    face: { ear: false, eyes: 'visor', nose: 'none', mouth: 'led', brows: false, cheeks: false },
    super: 'laser',
  },
  {
    id: 'roko',
    name: 'Роко',
    tagline: 'Свири соло на китара и на терена',
    stats: { speed: 4, jump: 3, power: 3, head: 3 },
    look: {
      skin: '#e8b48c',
      skinShade: '#c48a62',
      shirt: '#1f1f2b',
      shirtTrim: '#c0c6d6',
      shorts: '#3a2e5c',
      sock: '#1f1f2b',
      shoe: '#d62828',
      shoeSole: '#ffffff',
    },
    face: HUMAN,
    super: 'sonic',
  },
  {
    id: 'gica',
    name: 'Баба Гица',
    tagline: 'Плете чорапи. И противниците си',
    stats: { speed: 2, jump: 2, power: 3, head: 5 },
    look: {
      skin: '#f6d2b8',
      skinShade: '#dba98a',
      shirt: '#9b5de5',
      shirtTrim: '#ffd6e8',
      shorts: '#5a3d8a',
      sock: '#ffd6e8',
      shoe: '#7a4a2a',
      shoeSole: '#e9d8c4',
    },
    face: { ...HUMAN, iris: '#6b8cce' },
    super: 'yarn',
  },
  {
    id: 'zig',
    name: 'Зиг',
    tagline: 'Дойде за футбола, остана за баничките',
    stats: { speed: 3, jump: 5, power: 2, head: 4 },
    look: {
      skin: '#7ddc5a',
      skinShade: '#4fa83a',
      shirt: '#d9e2ec',
      shirtTrim: '#c77dff',
      shorts: '#9aa5b1',
      sock: '#c77dff',
      shoe: '#c77dff',
      shoeSole: '#ffffff',
    },
    face: { ear: false, eyes: 'alien', nose: 'none', mouth: 'human', brows: false, cheeks: false },
    super: 'warp',
    unlock: 'tournament',
  },
  {
    id: 'ulf',
    name: 'Улф',
    tagline: 'Викинг. Не знае правилата, но ги чупи силно',
    stats: { speed: 2, jump: 3, power: 5, head: 4 },
    look: {
      skin: '#f2c7a5',
      skinShade: '#cf9a76',
      shirt: '#7a5230',
      shirtTrim: '#c9a227',
      shorts: '#3e2c1c',
      sock: '#a3a3a3',
      shoe: '#4a3020',
      shoeSole: '#c9a227',
    },
    face: HUMAN,
    super: 'thunder',
    unlock: 'tournament',
  },
  {
    id: 'senko',
    name: 'Сенко',
    tagline: 'Нинджа. Никой не го е виждал да тича',
    stats: { speed: 5, jump: 4, power: 3, head: 1 },
    look: {
      skin: '#e9b993',
      skinShade: '#c48f69',
      shirt: '#22223b',
      shirtTrim: '#e63946',
      shorts: '#22223b',
      sock: '#22223b',
      shoe: '#22223b',
      shoeSole: '#e63946',
      arms: '#22223b',
    },
    face: { ear: false, eyes: 'normal', nose: 'none', mouth: 'mask', brows: true, cheeks: false },
    super: 'shadow',
    unlock: 'tournament',
  },
];

export const getCharacter = (id: string): CharacterDef => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
