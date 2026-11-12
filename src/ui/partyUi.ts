import { tr, t } from '../i18n/i18n';
import { PARTY_IDS, PARTY_MODES, type PartyMode } from '../game/stadiums';
import { stadiumRow, type SettingsHost } from './settingsUi';
import { button, h, optionRow, type NavItem, type Screen } from './ui';

export interface PartyOptions {
  host: SettingsHost;
  /** last picked mode / opponent */
  mode: PartyMode;
  twoPlayers: boolean;
  touchMode: boolean;
  start: (mode: PartyMode, twoPlayers: boolean) => void;
  back: () => void;
}

/** Crazy modes: pick one of the four rule sets, the opponent and the stadium. */
export function partyScreen(o: PartyOptions): Screen {
  const root = h('div', 'scr scr-panel party');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('party.title')), h('p', 'desc', t('party.sub')));
  let mode = o.mode;
  let two = o.twoPlayers && !o.touchMode;

  const grid = h('div', 'party-grid');
  const cards: NavItem[] = PARTY_IDS.map((id) => {
    const info = PARTY_MODES[id];
    const el = h('button', 'party-card');
    el.type = 'button';
    el.append(h('div', 'party-icon', info.icon), h('div', 'party-name', tr(info.name)), h('div', 'party-desc', tr(info.desc)));
    grid.append(el);
    return {
      el,
      activate: () => {
        mode = id;
        refresh();
      },
    };
  });
  const refresh = (): void => {
    cards.forEach((c, i) => c.el.classList.toggle('on', PARTY_IDS[i] === mode));
  };
  refresh();

  const vs = optionRow<boolean>(
    t('party.vs'),
    [
      { value: false, label: t('party.vsCpu') },
      ...(o.touchMode ? [] : [{ value: true, label: t('party.vsFriend') }]),
    ],
    () => two,
    (v) => {
      two = v;
    },
  );
  const stadium = stadiumRow(o.host);
  const go = button(t('cpu.pick'), () => o.start(mode, two), 'btn btn-go');
  box.append(grid, vs.el, stadium.el, h('div', 'row-buttons', undefined, [go.el]));
  const items = [...cards, vs, stadium, go];
  return { id: 'party', root, items, back: o.back, initial: items.indexOf(go) };
}
