/**
 * Cosmetics bought with coins in the shop (or unlocked by achievements):
 * ball skins, hats, shoes, ball trails and goal celebrations.
 */

type L = { bg: string; en: string };

export type CosCat = 'ball' | 'hat' | 'shoes' | 'trail' | 'celebration';
export const COS_CATS: CosCat[] = ['ball', 'hat', 'shoes', 'trail', 'celebration'];

/** what a player wears in a match */
export interface Equip {
  ball: string;
  hat: string;
  shoes: string;
  trail: string;
  celebration: string;
}

export const DEFAULT_EQUIP: Equip = { ball: 'classic', hat: 'none', shoes: 'none', trail: 'none', celebration: 'none' };

export interface CosItem {
  id: string;
  cat: CosCat;
  name: L;
  icon: string;
  /** coins; missing = free (the defaults) or achievement-only */
  price?: number;
  /** unlocked by this achievement instead of being sold */
  achievement?: string;
}

export const COSMETICS: CosItem[] = [
  // balls
  { id: 'classic', cat: 'ball', name: { bg: 'Класическа', en: 'Classic' }, icon: '⚽' },
  { id: 'beach', cat: 'ball', name: { bg: 'Плажна', en: 'Beach ball' }, icon: '🏐', price: 250 },
  { id: 'retro', cat: 'ball', name: { bg: 'Ретро кожена', en: 'Retro leather' }, icon: '🟤', price: 300 },
  { id: 'basket', cat: 'ball', name: { bg: 'Баскетболна', en: 'Basketball' }, icon: '🏀', price: 350 },
  { id: 'melon', cat: 'ball', name: { bg: 'Диня', en: 'Watermelon' }, icon: '🍉', price: 400 },
  { id: 'gold', cat: 'ball', name: { bg: 'Златна', en: 'Golden' }, icon: '🟡', price: 700 },
  { id: 'planet', cat: 'ball', name: { bg: 'Планета', en: 'Planet' }, icon: '🪐', price: 900 },
  { id: 'disco', cat: 'ball', name: { bg: 'Диско', en: 'Disco' }, icon: '🪩', achievement: 'party_animal' },
  // hats
  { id: 'none', cat: 'hat', name: { bg: 'Без шапка', en: 'No hat' }, icon: '🙂' },
  { id: 'cap', cat: 'hat', name: { bg: 'Шапка с козирка', en: 'Cap' }, icon: '🧢', price: 150 },
  { id: 'party', cat: 'hat', name: { bg: 'Парти шапка', en: 'Party hat' }, icon: '🥳', price: 200 },
  { id: 'santa', cat: 'hat', name: { bg: 'Коледна шапка', en: 'Santa hat' }, icon: '🎅', price: 250 },
  { id: 'tophat', cat: 'hat', name: { bg: 'Цилиндър', en: 'Top hat' }, icon: '🎩', price: 300 },
  { id: 'propeller', cat: 'hat', name: { bg: 'Шапка с перка', en: 'Propeller cap' }, icon: '🚁', price: 400 },
  { id: 'crown', cat: 'hat', name: { bg: 'Корона', en: 'Crown' }, icon: '👑', achievement: 'league_champ' },
  { id: 'halo', cat: 'hat', name: { bg: 'Ореол', en: 'Halo' }, icon: '😇', achievement: 'hero_tester' },
  // shoes
  { id: 'none', cat: 'shoes', name: { bg: 'На героя', en: 'Hero’s own' }, icon: '👟' },
  { id: 'black', cat: 'shoes', name: { bg: 'Черни', en: 'Black' }, icon: '⚫', price: 100 },
  { id: 'neon', cat: 'shoes', name: { bg: 'Неон', en: 'Neon' }, icon: '🟢', price: 150 },
  { id: 'pink', cat: 'shoes', name: { bg: 'Розови', en: 'Pink' }, icon: '🩷', price: 150 },
  { id: 'fire', cat: 'shoes', name: { bg: 'Огнени', en: 'Fire' }, icon: '🔥', price: 250 },
  { id: 'gold', cat: 'shoes', name: { bg: 'Златни', en: 'Golden' }, icon: '🥇', price: 400 },
  { id: 'ice', cat: 'shoes', name: { bg: 'Ледени', en: 'Ice' }, icon: '🧊', achievement: 'weather_master' },
  // trails
  { id: 'none', cat: 'trail', name: { bg: 'Обикновена', en: 'Plain' }, icon: '💨' },
  { id: 'neon', cat: 'trail', name: { bg: 'Неон', en: 'Neon' }, icon: '💚', price: 250 },
  { id: 'fire', cat: 'trail', name: { bg: 'Огнена', en: 'Fire' }, icon: '🧡', price: 300 },
  { id: 'ice', cat: 'trail', name: { bg: 'Ледена', en: 'Ice' }, icon: '🩵', price: 300 },
  { id: 'gold', cat: 'trail', name: { bg: 'Златна', en: 'Golden' }, icon: '💛', price: 500 },
  { id: 'rainbow', cat: 'trail', name: { bg: 'Дъга', en: 'Rainbow' }, icon: '🌈', achievement: 'shopper' },
  // goal celebrations
  { id: 'none', cat: 'celebration', name: { bg: 'Конфети', en: 'Confetti' }, icon: '🎊' },
  { id: 'emoji', cat: 'celebration', name: { bg: 'Емоджи дъжд', en: 'Emoji rain' }, icon: '😎', price: 250 },
  { id: 'lightning', cat: 'celebration', name: { bg: 'Мълнии', en: 'Lightning' }, icon: '⚡', price: 350 },
  { id: 'fireworks', cat: 'celebration', name: { bg: 'Фойерверки', en: 'Fireworks' }, icon: '🎆', price: 450 },
  { id: 'stars', cat: 'celebration', name: { bg: 'Звезден дъжд', en: 'Star shower' }, icon: '🌟', achievement: 'daily_hero' },
  { id: 'money', cat: 'celebration', name: { bg: 'Пари!', en: 'Money!' }, icon: '💰', achievement: 'millionaire' },
];

export const cosKey = (cat: CosCat, id: string): string => `${cat}:${id}`;

export const cosItem = (cat: CosCat, id: string): CosItem | undefined => COSMETICS.find((c) => c.cat === cat && c.id === id);

/** free defaults everybody owns */
export const isDefault = (c: CosItem): boolean => c.price === undefined && c.achievement === undefined;

/** shoe colours: upper, sole */
export const SHOE_COLORS: Record<string, [string, string]> = {
  black: ['#1b1b22', '#ffffff'],
  neon: ['#39ff6a', '#1b1b22'],
  pink: ['#ff6fb5', '#ffffff'],
  fire: ['#ff4d1a', '#ffd23f'],
  gold: ['#ffcc33', '#a0761a'],
  ice: ['#9be7ff', '#ffffff'],
};

/** ball trail colours ('rainbow' is drawn specially) */
export const TRAIL_COLORS: Record<string, string> = {
  neon: '#39ff6a',
  fire: '#ff7a1f',
  ice: '#7fdcff',
  gold: '#ffd23f',
  rainbow: 'rainbow',
};
