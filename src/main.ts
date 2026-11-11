import '@fontsource/russo-one/400.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/700.css';
import './style.css';
import { Game } from './game/game';

async function boot(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ui = document.getElementById('ui') as HTMLElement;
  // Make sure the display font is ready before the first frame is drawn on canvas.
  try {
    await Promise.race([
      Promise.all([document.fonts.load('40px "Russo One"', 'ГОЛ 0123'), document.fonts.load('20px "Rubik"', 'ГОЛ')]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
  const game = new Game(canvas, ui);
  game.start();
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
}

void boot();
