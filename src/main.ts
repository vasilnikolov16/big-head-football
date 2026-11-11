import '@fontsource/russo-one/400.css';
import '@fontsource/rubik/400.css';
import '@fontsource/rubik/700.css';
import './style.css';
import './ui/ui.css';
import { Game } from './game/game';
import { onLangChange, t } from './i18n/i18n';

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
  const rotate = document.getElementById('rotate-text');
  const setRotate = (): void => {
    if (rotate) rotate.textContent = t('touch.rotate');
  };
  onLangChange(setRotate);
  const game = new Game(canvas, ui);
  setRotate();
  game.start();
  if (import.meta.env.DEV) (window as unknown as { __game: Game }).__game = game;
}

void boot();

// installed app (Add to Home Screen): works offline after the first visit
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
