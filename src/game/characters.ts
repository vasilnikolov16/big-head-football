import { INK } from '../core/constants';

export type Expression = 'idle' | 'happy' | 'sad' | 'angry' | 'effort' | 'shock';

/** Everything a character's custom drawing code needs. Origin = head centre. */
export interface HeadDraw {
  ctx: CanvasRenderingContext2D;
  R: number;
  facing: 1 | -1;
  t: number;
  expr: Expression;
}

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
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  stats: CharacterStats;
  look: CharacterLook;
  /** drawn behind the head circle (back hair, ears…) */
  drawBack?: (h: HeadDraw) => void;
  /** drawn on top of the face (hair, hats, glasses…) */
  drawFront?: (h: HeadDraw) => void;
}

// --- Stage 1 placeholder heroes. The full cast arrives in stage 3. ---

const spikyHair = (color: string) => (h: HeadDraw) => {
  const { ctx, R, facing } = h;
  ctx.save();
  ctx.scale(facing, 1);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-R * 1.0, -R * 0.05);
  const spikes = 6;
  for (let i = 0; i <= spikes; i++) {
    const a = Math.PI + (i / spikes) * Math.PI * 0.95;
    const rr = i % 2 === 0 ? R * 1.32 : R * 1.02;
    ctx.lineTo(Math.cos(a) * rr - R * 0.08, Math.sin(a) * rr + R * 0.05);
  }
  ctx.quadraticCurveTo(R * 0.6, -R * 0.55, R * 0.2, -R * 0.62);
  ctx.quadraticCurveTo(-R * 0.3, -R * 0.4, -R * 0.55, -R * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

const capHat = (color: string, brim: string) => (h: HeadDraw) => {
  const { ctx, R, facing } = h;
  ctx.save();
  ctx.scale(facing, 1);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  // dome
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -R * 0.12, R * 1.02, Math.PI * 1.02, Math.PI * 1.98);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // brim towards facing side
  ctx.fillStyle = brim;
  ctx.beginPath();
  ctx.ellipse(R * 0.72, -R * 0.2, R * 0.62, R * 0.15, -0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // button
  ctx.fillStyle = brim;
  ctx.beginPath();
  ctx.arc(0, -R * 1.12, R * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
};

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'blaze',
    name: 'Жаро',
    tagline: 'Бърз като искра',
    stats: { speed: 4, jump: 3, power: 3, head: 3 },
    look: {
      skin: '#f3c49b',
      skinShade: '#d99a73',
      shirt: '#ff4d4d',
      shirtTrim: '#ffd23f',
      shorts: '#2b2d5c',
      sock: '#ff4d4d',
      shoe: '#ffd23f',
      shoeSole: '#ffffff',
    },
    drawFront: spikyHair('#ff8a1f'),
  },
  {
    id: 'frost',
    name: 'Ледко',
    tagline: 'Хладнокръвен защитник',
    stats: { speed: 3, jump: 3, power: 4, head: 3 },
    look: {
      skin: '#c98d63',
      skinShade: '#a86f49',
      shirt: '#2f8cff',
      shirtTrim: '#ffffff',
      shorts: '#ffffff',
      sock: '#2f8cff',
      shoe: '#1d1d2e',
      shoeSole: '#5ef2ff',
    },
    drawFront: capHat('#2f8cff', '#1652b8'),
  },
];

export const getCharacter = (id: string): CharacterDef =>
  CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
