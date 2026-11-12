/**
 * Hero data: stats, colours, face style and super shot. Drawing code for the
 * individual looks lives in render/heroArt.ts, super-shot logic in game/supers.ts.
 */
export type Expression = 'idle' | 'happy' | 'sad' | 'angry' | 'effort' | 'shock';

export type SuperId =
  | 'razor'
  | 'pounce'
  | 'laser'
  | 'sonic'
  | 'yarn'
  | 'warp'
  | 'thunder'
  | 'shadow'
  | 'pan'
  | 'bats'
  | 'hose'
  | 'avalanche'
  | 'cannon'
  | 'hook'
  | 'magic'
  | 'roar';

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
  name: { bg: string; en: string };
  tagline: { bg: string; en: string };
  stats: CharacterStats;
  look: CharacterLook;
  face: FaceStyle;
  super: SuperId;
  /** must be won in the tournament, or bought in the shop, before it can be picked */
  unlock?: 'tournament' | 'shop';
  /** shop price in coins (unlock: 'shop') */
  price?: number;
}

const HUMAN: FaceStyle = { ear: true, eyes: 'normal', nose: 'human', mouth: 'human', brows: true, cheeks: true };

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'bobo',
    name: { bg: 'Бобо', en: 'Bobo' },
    tagline: { bg: 'Бръснарят с най-острите ножици в квартала', en: 'The barber with the sharpest scissors in town' },
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
    name: { bg: 'Пенка', en: 'Penka' },
    tagline: { bg: 'Котка. Спи 20 часа на ден, а останалите 4 — вкарва', en: 'A cat. Sleeps 20 hours a day and scores in the other 4' },
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
    name: { bg: 'Бип-0', en: 'Bip-0' },
    tagline: { bg: 'Робот-нападател, версия 0.9 бета', en: 'Robot striker, version 0.9 beta' },
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
    name: { bg: 'Роко', en: 'Roko' },
    tagline: { bg: 'Свири соло на китара и на терена', en: 'Plays guitar solos on the pitch too' },
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
    name: { bg: 'Баба Гица', en: 'Granny Gitsa' },
    tagline: { bg: 'Плете чорапи. И противниците си', en: 'Knits socks. And her opponents' },
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
    name: { bg: 'Зиг', en: 'Zig' },
    tagline: { bg: 'Дойде за футбола, остана за баничките', en: 'Came for the football, stayed for the pastries' },
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
    name: { bg: 'Улф', en: 'Ulf' },
    tagline: { bg: 'Викинг. Не знае правилата, но ги чупи силно', en: 'A viking. Doesn’t know the rules, breaks them hard' },
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
    name: { bg: 'Сенко', en: 'Senko' },
    tagline: { bg: 'Нинджа. Никой не го е виждал да тича', en: 'A ninja. Nobody has ever seen him run' },
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

CHARACTERS.push(
  {
    id: 'chef',
    name: { bg: 'Пипер', en: 'Pepper' },
    tagline: { bg: 'Готвач. Сервира голове с гарнитура', en: 'A chef. Serves goals with a side dish' },
    stats: { speed: 3, jump: 3, power: 4, head: 3 },
    look: {
      skin: '#f3c9a8',
      skinShade: '#d9a07c',
      shirt: '#ffffff',
      shirtTrim: '#e63946',
      shorts: '#2b2d42',
      sock: '#ffffff',
      shoe: '#2b2d42',
      shoeSole: '#e63946',
    },
    face: HUMAN,
    super: 'pan',
  },
  {
    id: 'vlad',
    name: { bg: 'Влад', en: 'Vlad' },
    tagline: { bg: 'Вампир. Играе само нощни мачове', en: 'A vampire. Only plays night games' },
    stats: { speed: 4, jump: 4, power: 3, head: 2 },
    look: {
      skin: '#e6e1f0',
      skinShade: '#b4abc9',
      shirt: '#1b1b2f',
      shirtTrim: '#c1121f',
      shorts: '#1b1b2f',
      sock: '#c1121f',
      shoe: '#1b1b2f',
      shoeSole: '#c1121f',
    },
    face: { ...HUMAN, cheeks: false, iris: '#d00000' },
    super: 'bats',
  },
  {
    id: 'ogi',
    name: { bg: 'Огнян', en: 'Ogi' },
    tagline: { bg: 'Пожарникар. Гаси всяка атака', en: 'A firefighter. Puts out every attack' },
    stats: { speed: 3, jump: 3, power: 4, head: 4 },
    look: {
      skin: '#e9b48d',
      skinShade: '#c48a62',
      shirt: '#d62828',
      shirtTrim: '#ffd60a',
      shorts: '#3a3a3a',
      sock: '#ffd60a',
      shoe: '#1d1d2e',
      shoeSole: '#ffd60a',
    },
    face: HUMAN,
    super: 'hose',
  },
  {
    id: 'sneg',
    name: { bg: 'Снежко', en: 'Snowy' },
    tagline: { bg: 'Снежен човек. Топи се само от победи', en: 'A snowman. Only melts for victories' },
    stats: { speed: 2, jump: 3, power: 4, head: 4 },
    look: {
      skin: '#f4f8ff',
      skinShade: '#c3d2e8',
      shirt: '#e63946',
      shirtTrim: '#ffffff',
      shorts: '#1d3557',
      sock: '#ffffff',
      shoe: '#1d1d2e',
      shoeSole: '#a8dadc',
      arms: '#7a4a2a',
    },
    face: { ear: false, eyes: 'normal', nose: 'none', mouth: 'human', brows: false, cheeks: true, iris: '#1d1d2e' },
    super: 'avalanche',
  },
  {
    id: 'rum',
    name: { bg: 'Капитан Рум', en: 'Captain Rum' },
    tagline: { bg: 'Пират. Търси съкровище в чуждата врата', en: 'A pirate. Looking for treasure in your goal' },
    stats: { speed: 3, jump: 2, power: 5, head: 3 },
    look: {
      skin: '#d9a37c',
      skinShade: '#b47c56',
      shirt: '#f1e3c6',
      shirtTrim: '#1d3557',
      shorts: '#5c3d2e',
      sock: '#1d3557',
      shoe: '#3e2723',
      shoeSole: '#c9a227',
    },
    face: HUMAN,
    super: 'cannon',
  },
  {
    id: 'boyko',
    name: { bg: 'Бойко', en: 'Boyko' },
    tagline: { bg: 'Боксьор. Удря топката с нокаут', en: 'A boxer. Knocks the ball out' },
    stats: { speed: 4, jump: 3, power: 4, head: 2 },
    look: {
      skin: '#c98d63',
      skinShade: '#a46a44',
      shirt: '#d00000',
      shirtTrim: '#ffd60a',
      shorts: '#ffd60a',
      sock: '#ffffff',
      shoe: '#d00000',
      shoeSole: '#ffffff',
    },
    face: HUMAN,
    super: 'hook',
  },
  {
    id: 'zvezdan',
    name: { bg: 'Звездан', en: 'Zvezdan' },
    tagline: { bg: 'Магьосник. Топката просто изчезва… и се появява в мрежата', en: 'A wizard. The ball vanishes… and appears in the net' },
    stats: { speed: 3, jump: 4, power: 3, head: 4 },
    look: {
      skin: '#f1c9a5',
      skinShade: '#d1a27e',
      shirt: '#3a0ca3',
      shirtTrim: '#ffd60a',
      shorts: '#240046',
      sock: '#ffd60a',
      shoe: '#240046',
      shoeSole: '#ffd60a',
    },
    face: { ...HUMAN, cheeks: false, iris: '#4cc9f0' },
    super: 'magic',
    unlock: 'shop',
    price: 900,
  },
  {
    id: 'rex',
    name: { bg: 'Рекс', en: 'Rex' },
    tagline: { bg: 'Динозавър. Отборът му изчезна, той остана', en: 'A dinosaur. His team went extinct, he stayed' },
    stats: { speed: 3, jump: 2, power: 5, head: 4 },
    look: {
      skin: '#6ab04c',
      skinShade: '#3d7a2a',
      shirt: '#f9a03f',
      shirtTrim: '#2d5016',
      shorts: '#2d5016',
      sock: '#6ab04c',
      shoe: '#2d5016',
      shoeSole: '#f9a03f',
      arms: '#6ab04c',
    },
    face: { ear: false, eyes: 'normal', nose: 'none', mouth: 'human', brows: true, cheeks: false, iris: '#ffd60a' },
    super: 'roar',
    unlock: 'shop',
    price: 1200,
  },
);

export const getCharacter = (id: string): CharacterDef => CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
