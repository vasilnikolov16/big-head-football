import { INK } from '../core/constants';
import { TOURNAMENT_DIFFICULTY, type Career } from '../game/career';
import { getCharacter } from '../game/characters';
import { t, tr } from '../i18n/i18n';
import { heroPortrait } from './portrait';
import { button, h, optionRow, type NavItem, type Screen } from './ui';

/** The tournament ladder: your hero, the 7 opponents and the next match. */
export function tournamentScreen(
  career: Career,
  actions: { play: () => void; restart: () => void; back: () => void; setExpert: (on: boolean) => void },
): Screen {
  const run = career.p.tournament!;
  const me = getCharacter(run.hero);
  const root = h('div', 'scr scr-panel tournament');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', '🏆 ' + t('tour.title')));
  box.append(h('p', 'desc', t(run.expert ? 'tour.subExpert' : 'tour.sub', { n: run.order.length })));
  // the level can be picked until the first match is won
  const level =
    run.round === 0
      ? optionRow<boolean>(
          t('tour.level'),
          [
            { value: false, label: t('tour.normal') },
            { value: true, label: t('tour.expert') },
          ],
          () => run.expert === true,
          (v) => actions.setExpert(v),
        )
      : null;

  const head = h('div', 'tour-head');
  head.append(
    heroPortrait(me, 64),
    h('div', 'tour-me', undefined, [
      h('div', 'tour-me-name', t('tour.hero', { h: tr(me.name) })),
      h('div', 'tour-me-sub', `${t('tour.losses', { n: run.losses })}   ·   ${t('tour.wins', { n: career.p.stats.cupsWon })}`),
    ]),
  );
  box.append(head);

  const ladder = h('div', 'ladder');
  run.order.forEach((id, i) => {
    const c = getCharacter(id);
    const locked = !career.isUnlocked(id);
    const state = i < run.round ? 'done' : i === run.round ? 'next' : 'later';
    const card = h('div', `rung ${state}${i === run.order.length - 1 ? ' final' : ''}`);
    card.append(
      h('div', 'rung-round', i === run.order.length - 1 ? t('tour.final') : t('tour.round', { n: i + 1 })),
      heroPortrait(c, 74, { silhouette: locked && state !== 'done' }),
      h('div', 'rung-name', locked && state !== 'done' ? '???' : tr(c.name)),
      h('div', `rung-diff d-${TOURNAMENT_DIFFICULTY(i, run.expert)}`, t(`diff.${TOURNAMENT_DIFFICULTY(i, run.expert)}`)),
    );
    if (state === 'done') card.append(h('div', 'rung-check', '✓'));
    if (locked && state !== 'done') card.title = t('tour.lockedOpp');
    ladder.append(card);
  });
  if (level) box.append(level.el);
  box.append(ladder);

  const last = run.round === run.order.length - 1;
  const play = button(last ? t('tour.playFinal') : t('tour.play', { n: run.round + 1 }), actions.play, 'btn btn-go');
  let armed = false;
  const fresh = button(
    t('tour.new'),
    () => {
      if (!armed) {
        armed = true;
        fresh.el.querySelector('.btn-label')!.textContent = t('tour.newConfirm');
        return;
      }
      actions.restart();
    },
    'btn btn-alt btn-small',
  );
  const buttons: NavItem[] = [play, fresh];
  box.append(h('div', 'row-buttons', undefined, buttons.map((i) => i.el)));
  const items: NavItem[] = level ? [level, ...buttons] : buttons;
  return { id: 'tournament', root, items, back: actions.back, initial: items.indexOf(play) };
}

/** Draws a shiny golden cup (procedural, no images). */
function drawCup(g: CanvasRenderingContext2D, t: number): void {
  const W = 360;
  const H = 360;
  g.clearRect(0, 0, W, H);
  // rays
  g.save();
  g.translate(W / 2, H * 0.42);
  g.rotate(t * 0.25);
  for (let i = 0; i < 14; i++) {
    g.rotate((Math.PI * 2) / 14);
    g.fillStyle = i % 2 ? 'rgba(255,220,90,0.16)' : 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-22, -200);
    g.lineTo(22, -200);
    g.closePath();
    g.fill();
  }
  g.restore();
  const gold = g.createLinearGradient(110, 0, 250, 0);
  gold.addColorStop(0, '#b8860b');
  gold.addColorStop(0.35, '#ffe066');
  gold.addColorStop(0.5, '#fff7c2');
  gold.addColorStop(0.7, '#ffd23f');
  gold.addColorStop(1, '#a8740a');
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.lineJoin = 'round';
  // handles
  g.lineWidth = 16;
  g.strokeStyle = INK;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(180 + s * 88, 120, 34, s > 0 ? -1.2 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.2);
    g.stroke();
  }
  g.lineWidth = 9;
  g.strokeStyle = '#ffd23f';
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(180 + s * 88, 120, 34, s > 0 ? -1.2 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.2);
    g.stroke();
  }
  // bowl
  g.fillStyle = gold;
  g.strokeStyle = INK;
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(92, 70);
  g.lineTo(268, 70);
  g.quadraticCurveTo(262, 200, 180, 222);
  g.quadraticCurveTo(98, 200, 92, 70);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = '#fff3a0';
  g.beginPath();
  g.ellipse(180, 70, 88, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // stem + base
  g.fillStyle = gold;
  g.beginPath();
  g.roundRect(162, 220, 36, 46, 6);
  g.fill();
  g.stroke();
  g.beginPath();
  g.roundRect(120, 262, 120, 26, 8);
  g.fill();
  g.stroke();
  g.fillStyle = '#3a2a8a';
  g.beginPath();
  g.roundRect(108, 286, 144, 34, 8);
  g.fill();
  g.stroke();
  // star on the bowl
  g.fillStyle = '#ffffff';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    const r = i % 2 ? 11 : 26;
    g.lineTo(180 + Math.cos(a) * r, 135 + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  // moving shine
  const x = 60 + ((t * 120) % 360);
  const sh = g.createLinearGradient(x - 30, 0, x + 30, 0);
  sh.addColorStop(0, 'rgba(255,255,255,0)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.save();
  g.beginPath();
  g.moveTo(92, 70);
  g.lineTo(268, 70);
  g.quadraticCurveTo(262, 200, 180, 222);
  g.quadraticCurveTo(98, 200, 92, 70);
  g.clip();
  g.fillStyle = sh;
  g.fillRect(0, 0, W, H);
  g.restore();
  // sparkles
  for (let i = 0; i < 6; i++) {
    const a = t * 1.3 + i;
    const sx = 180 + Math.cos(a * 1.7 + i) * 150;
    const sy = 150 + Math.sin(a * 1.3 + i * 2) * 120;
    const s = 4 + Math.sin(t * 6 + i) * 3;
    g.fillStyle = '#fffbe0';
    g.beginPath();
    g.moveTo(sx, sy - s * 2);
    g.lineTo(sx + s * 0.5, sy);
    g.lineTo(sx, sy + s * 2);
    g.lineTo(sx - s * 0.5, sy);
    g.closePath();
    g.fill();
  }
}

/** Victory screen with the cup after winning the final. */
export function trophyScreen(heroId: string, flawless: boolean, unlocked: string[], onDone: () => void): Screen {
  const hero = getCharacter(heroId);
  const root = h('div', 'scr scr-panel trophy');
  const box = h('div', 'panel');
  root.append(box);
  const cv = document.createElement('canvas');
  cv.className = 'cup';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = 360 * dpr;
  cv.height = 360 * dpr;
  cv.style.width = '300px';
  cv.style.height = '300px';
  const g = cv.getContext('2d')!;
  g.scale(dpr, dpr);
  let raf = 0;
  const t0 = performance.now();
  const frame = (): void => {
    drawCup(g, (performance.now() - t0) / 1000);
    raf = requestAnimationFrame(frame);
  };
  frame();
  box.append(
    h('h2', 'result win champion', t('tour.champion')),
    cv,
    h('p', 'trophy-text', t('tour.cupText', { h: tr(hero.name) })),
  );
  if (flawless) box.append(h('p', 'trophy-flawless', '👑 ' + t('tour.flawless')));
  for (const id of unlocked) box.append(h('p', 'unlock-note', '🔓 ' + t('tour.unlocked', { h: tr(getCharacter(id).name) })));
  const ok = button(t('post.menu'), onDone, 'btn btn-go');
  box.append(h('div', 'row-buttons', undefined, [ok.el]));
  return { id: 'trophy', root, items: [ok], back: onDone, dispose: () => cancelAnimationFrame(raf) };
}
