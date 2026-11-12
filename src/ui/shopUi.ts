import type { Career } from '../game/career';
import { CHARACTERS, getCharacter } from '../game/characters';
import { COSMETICS, SHOE_COLORS, TRAIL_COLORS, type CosCat, type CosItem } from '../game/cosmetics';
import { t, tr } from '../i18n/i18n';
import { drawBall } from '../render/ballDraw';
import { heroPortrait } from './portrait';
import { button, h, type NavItem, type Screen } from './ui';

export type ShopTab = CosCat | 'heroes';
const TABS: ShopTab[] = ['ball', 'hat', 'shoes', 'trail', 'celebration', 'heroes'];

export interface ShopOptions {
  career: Career;
  /** the hero shown wearing hats in the previews */
  heroId: string;
  tab: ShopTab;
  /** reopen the shop (after a purchase / on a tab switch) */
  reopen: (tab: ShopTab) => void;
  /** ask before spending: shows the confirm screen */
  confirm: (o: { title: string; price: number; onYes: () => void; onNo: () => void }) => void;
  sound: (s: 'buy' | 'equip' | 'nope') => void;
  toast: (icon: string, title: string, body: string) => void;
  back: () => void;
}

const coinsPill = (n: number): HTMLElement => h('div', 'coins-pill', `🪙 ${n}`);

function preview(it: CosItem, heroId: string): HTMLElement {
  const box = h('div', 'shop-prev');
  if (it.cat === 'ball') {
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d')!;
    g.scale(2, 2);
    drawBall(g, 30, 30, 22, 0.5, it.id);
    box.append(c);
  } else if (it.cat === 'hat') {
    box.append(heroPortrait(getCharacter(heroId), 74, { hat: it.id }));
  } else if (it.cat === 'shoes') {
    const sc = SHOE_COLORS[it.id];
    const sw = h('div', 'shoe-swatch', it.icon);
    if (sc) {
      sw.textContent = '';
      sw.style.background = `linear-gradient(180deg, ${sc[0]} 0 70%, ${sc[1]} 70% 100%)`;
    }
    box.append(sw);
  } else if (it.cat === 'trail') {
    const col = TRAIL_COLORS[it.id];
    const sw = h('div', 'trail-swatch');
    sw.style.background =
      col === 'rainbow'
        ? 'linear-gradient(90deg, transparent, #ff4d4d, #ffd23f, #7cff6b, #4fd1ff, #c77dff)'
        : `linear-gradient(90deg, transparent, ${col ?? '#ffffff'})`;
    box.append(sw);
  } else box.append(h('div', 'shop-emoji', it.icon));
  return box;
}

/** The shop: cosmetics and heroes, bought with coins (always with a confirmation). */
export function shopScreen(o: ShopOptions): Screen {
  const c = o.career;
  const root = h('div', 'scr scr-panel shop');
  const box = h('div', 'panel');
  root.append(box);
  const head = h('div', 'shop-head', undefined, [h('h2', 'panel-title', t('shop.title')), coinsPill(c.coins)]);
  box.append(head);

  const idx = TABS.indexOf(o.tab);
  const bar = h('div', 'tabs');
  TABS.forEach((name) => {
    const b = h('button', `tab${name === o.tab ? ' on' : ''}`, t(`shop.tab.${name}`));
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (name !== o.tab) o.reopen(name);
    });
    bar.append(b);
  });
  const tabItem: NavItem = {
    el: bar,
    left: () => o.reopen(TABS[(idx + TABS.length - 1) % TABS.length]),
    right: () => o.reopen(TABS[(idx + 1) % TABS.length]),
  };
  box.append(bar);

  const grid = h('div', 'shop-grid');
  const items: NavItem[] = [];
  const nope = (el: HTMLElement, msg: string): void => {
    o.sound('nope');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    status.textContent = msg;
  };

  if (o.tab === 'heroes') {
    for (const def of CHARACTERS.filter((d) => d.unlock === 'shop')) {
      const owned = c.isUnlocked(def.id);
      const card = h('button', `shop-card${owned ? ' owned' : ''}`);
      card.type = 'button';
      card.append(h('div', 'shop-prev', undefined, [heroPortrait(def, 74)]), h('div', 'shop-name', tr(def.name)));
      card.append(h('div', 'shop-price', owned ? t('shop.unlocked') : `🪙 ${def.price ?? 0}`));
      grid.append(card);
      items.push({
        el: card,
        activate: () => {
          if (owned) return;
          const price = def.price ?? 0;
          if (c.coins < price) return nope(card, t('shop.noMoney', { n: price - c.coins }));
          o.confirm({
            title: t('shop.confirmHero', { n: tr(def.name) }),
            price,
            onYes: () => {
              if (c.buyHero(def.id, price)) {
                o.sound('buy');
                o.toast('🔓', t('shop.bought'), tr(def.name));
              }
              o.reopen('heroes');
            },
            onNo: () => o.reopen('heroes'),
          });
        },
      });
    }
  } else {
    for (const it of COSMETICS.filter((x) => x.cat === o.tab)) {
      const owned = c.owns(it.cat, it.id);
      const on = c.p.equipped[it.cat] === it.id;
      const card = h('button', `shop-card${owned ? ' owned' : ''}${on ? ' on' : ''}`);
      card.type = 'button';
      card.append(preview(it, o.heroId), h('div', 'shop-name', tr(it.name)));
      let price: string;
      if (on) price = '✓ ' + t('shop.equipped');
      else if (owned) price = t('shop.owned');
      else if (it.achievement) price = '🔒 ' + t('shop.byAchievement');
      else price = `🪙 ${it.price}`;
      card.append(h('div', 'shop-price', price));
      grid.append(card);
      items.push({
        el: card,
        activate: () => {
          if (owned) {
            if (!on) {
              c.equip(it.cat, it.id);
              o.sound('equip');
            }
            o.reopen(o.tab);
            return;
          }
          if (it.achievement) return nope(card, t('shop.achievementHint'));
          const p = it.price ?? 0;
          if (c.coins < p) return nope(card, t('shop.noMoney', { n: p - c.coins }));
          o.confirm({
            title: t('shop.confirm', { n: tr(it.name) }),
            price: p,
            onYes: () => {
              const r = c.buy(it.cat, it.id);
              if (r.ok) {
                o.sound('buy');
                o.toast(it.icon, t('shop.bought'), tr(it.name));
                for (const a of r.achievements) o.toast(a.icon, t('ach.unlocked'), tr(a.name));
              }
              o.reopen(it.cat);
            },
            onNo: () => o.reopen(it.cat),
          });
        },
      });
    }
  }
  const status = h('div', 'shop-status', o.tab === 'heroes' ? t('shop.heroesHint') : t('shop.hint'));
  box.append(grid, status);
  return { id: 'shop', root, items: [tabItem, ...items], back: o.back, initial: items.length ? 1 : 0, onKey: (code) => {
    if (code === 'KeyQ') {
      tabItem.left!();
      return true;
    }
    if (code === 'KeyE') {
      tabItem.right!();
      return true;
    }
    return false;
  } };
}

/** "Are you sure?" before every purchase, so nothing is bought by a mis-click. */
export function confirmScreen(o: { title: string; price: number; coins: number; onYes: () => void; onNo: () => void }): Screen {
  const root = h('div', 'scr scr-panel confirm');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('shop.confirmTitle')), h('p', 'confirm-text', o.title));
  box.append(h('p', 'desc', t('shop.balance', { a: o.coins, b: o.coins - o.price })));
  const no = button(t('shop.cancel'), o.onNo, 'btn btn-alt btn-small');
  const yes = button(t('shop.buyFor', { n: o.price }), o.onYes, 'btn btn-go btn-small');
  box.append(h('div', 'row-buttons', undefined, [yes.el, no.el]));
  // the cancel button is selected first: Enter by accident never buys
  return { id: 'confirm', root, items: [yes, no], initial: 1, back: o.onNo };
}
