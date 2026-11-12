import { t, tr } from '../i18n/i18n';
import { STADIUM_IDS, STADIUMS, type StadiumId } from '../game/stadiums';
import { CODE_LEN, MAX_NAME, cleanName, normalizeCode, type LobbyOptions } from '../net/protocol';
import { button, h, optionRow, textRow, type NavItem, type Screen } from './ui';

function panel(title: string, cls = ''): { root: HTMLElement; box: HTMLElement; body: HTMLElement } {
  const root = h('div', `scr scr-panel online ${cls}`);
  const box = h('div', 'panel');
  box.append(h('h2', 'panel-title', title));
  const body = h('div', 'panel-body');
  box.append(body);
  root.append(box);
  return { root, box, body };
}

function setDisabled(item: NavItem, off: boolean): void {
  item.disabled = off;
  item.el.classList.toggle('disabled', off);
}

/** Copy text; falls back to a hidden field where the clipboard API is missing. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    ta.remove();
    return ok;
  }
}

// ------------------------------------------------------------------ online menu

export interface OnlineMenuOptions {
  name: string;
  code: string;
  onName: (n: string) => void;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onBack: () => void;
}

export interface OnlineMenuApi {
  setStatus(text: string, kind?: 'info' | 'err' | 'busy'): void;
  setBusy(busy: boolean): void;
  focusName(): void;
}

export function onlineMenu(o: OnlineMenuOptions): { screen: Screen; api: OnlineMenuApi } {
  const { root, body } = panel(t('online.title'));
  let code = o.code;
  body.append(h('p', 'desc', t('online.desc')));
  const name = textRow(t('online.name'), () => o.name, (v) => o.onName(v), {
    max: MAX_NAME,
    placeholder: t('online.namePh'),
    clean: (v) => v.slice(0, MAX_NAME),
    cls: 'name-row',
  });
  name.input.addEventListener('blur', () => {
    const c = cleanName(name.input.value);
    name.input.value = c;
    o.onName(c);
  });
  const create = button(t('online.create'), () => o.onCreate(), 'btn btn-go');
  const codeRow = textRow(
    t('online.code'),
    () => code,
    (v) => (code = v),
    { max: CODE_LEN, placeholder: t('online.codePh'), clean: normalizeCode, cls: 'code-row', onEnter: () => o.onJoin(code) },
  );
  const join = button(t('online.join'), () => o.onJoin(code));
  const status = h('div', 'net-status');

  const createBox = h('div', 'online-col', undefined, [create.el]);
  const joinBox = h('div', 'online-col', undefined, [codeRow.el, join.el]);
  const or = h('div', 'online-or', t('or'));
  body.append(name.el, h('div', 'online-cols', undefined, [createBox, or, joinBox]), status);

  const items: NavItem[] = [name, create, codeRow, join];
  const api: OnlineMenuApi = {
    setStatus(text, kind = 'info') {
      status.textContent = text;
      status.className = `net-status ${kind}`;
    },
    setBusy(busy) {
      for (const it of [create, join, codeRow, name]) setDisabled(it, busy);
      name.input.disabled = busy;
      codeRow.input.disabled = busy;
    },
    focusName() {
      name.input.focus();
    },
  };
  return {
    screen: { id: 'online', root, items, initial: o.name ? (o.code ? 3 : 1) : 0, back: o.onBack },
    api,
  };
}

// ------------------------------------------------------------------ lobby

export interface LobbyState {
  code: string;
  isHost: boolean;
  localName: string;
  remoteName: string;
  ping: number;
  opts: LobbyOptions;
  note: string;
}

export interface LobbyOptionsUi {
  get: () => LobbyState;
  setOpts: (o: LobbyOptions) => void;
  toHeroes: () => void;
  leave: () => void;
  link: () => string;
  sound: () => void;
}

export function lobbyScreen(o: LobbyOptionsUi): { screen: Screen; refresh: () => void } {
  const st0 = o.get();
  const { root, body } = panel(`${t('online.lobby')} ${st0.code}`, 'lobby');

  // ---- the code, big, with copy buttons
  const codeBox = h('div', 'room-code');
  codeBox.append(h('div', 'room-code-label', t('online.code')));
  const letters = h('div', 'room-code-letters');
  for (const ch of st0.code) letters.append(h('span', '', ch));
  codeBox.append(letters, h('div', 'room-code-share', t('online.share')));
  const flash = (item: NavItem, label: string): void => {
    const el = item.el.querySelector('.btn-label');
    if (!el) return;
    el.textContent = t('online.copied');
    window.setTimeout(() => (el.textContent = label), 1300);
  };
  const copyCode = button(t('online.copyCode'), () => void copyText(st0.code).then((ok) => ok && flash(copyCode, t('online.copyCode'))), 'btn btn-alt btn-small');
  const copyLink = button(t('online.copyLink'), () => void copyText(o.link()).then((ok) => ok && flash(copyLink, t('online.copyLink'))), 'btn btn-alt btn-small');
  codeBox.append(h('div', 'row-buttons', undefined, [copyCode.el, copyLink.el]));

  // ---- players
  const players = h('div', 'room-players');
  const rowHost = h('div', 'room-player host');
  const rowGuest = h('div', 'room-player');
  players.append(rowHost, rowGuest);

  // ---- match settings (host edits, guest sees)
  const setBox = h('div', 'room-settings');
  setBox.append(h('h3', '', t('online.matchSettings')));
  const items: NavItem[] = [];
  let durItem: NavItem | null = null;
  let puItem: NavItem | null = null;
  const durLabel = h('span', 'opt-chip on');
  const puLabel = h('span', 'opt-chip on');
  const stLabel = h('span', 'opt-chip on');
  let stItem: NavItem | null = null;
  if (st0.isHost) {
    durItem = optionRow(
      t('cpu.duration'),
      [30, 60, 90].map((v) => ({ value: v as 30 | 60 | 90, label: t('sec', { n: v }) })),
      () => o.get().opts.duration,
      (v) => o.setOpts({ ...o.get().opts, duration: v }),
    );
    puItem = optionRow(
      t('settings.powerups'),
      [
        { value: true, label: t('on') },
        { value: false, label: t('off') },
      ],
      () => o.get().opts.powerups,
      (v) => o.setOpts({ ...o.get().opts, powerups: v }),
    );
    stItem = optionRow<StadiumId>(
      t('stadium'),
      STADIUM_IDS.map((id) => ({ value: id, label: STADIUMS[id].icon + ' ' + tr(STADIUMS[id].name) })),
      () => o.get().opts.stadium,
      (v) => o.setOpts({ ...o.get().opts, stadium: v }),
    );
    setBox.append(durItem.el, puItem.el, stItem.el);
  } else {
    const r1 = h('div', 'opt-row static');
    r1.append(h('span', 'opt-label', t('cpu.duration')), h('div', 'opt-seg', undefined, [durLabel]));
    const r2 = h('div', 'opt-row static');
    r2.append(h('span', 'opt-label', t('settings.powerups')), h('div', 'opt-seg', undefined, [puLabel]));
    const r3 = h('div', 'opt-row static');
    r3.append(h('span', 'opt-label', t('stadium')), h('div', 'opt-seg', undefined, [stLabel]));
    setBox.append(r1, r2, r3, h('p', 'desc small', t('online.hostPicks')));
  }

  const note = h('div', 'net-status info');
  const go = button(t('online.toHeroes'), () => o.toHeroes(), 'btn btn-go');
  const leave = button(t('online.leave'), () => o.leave(), 'btn btn-alt btn-small');
  const grid = h('div', 'lobby-grid', undefined, [codeBox, h('div', 'lobby-side', undefined, [players, setBox])]);
  body.append(grid, note, h('div', 'row-buttons', undefined, st0.isHost ? [go.el, leave.el] : [leave.el]));

  if (st0.isHost) items.push(go, durItem!, puItem!, stItem!, copyCode, copyLink, leave);
  else items.push(copyCode, copyLink, leave);

  let hadGuest = !!st0.remoteName;
  const refresh = (): void => {
    const s = o.get();
    const hostName = s.isHost ? s.localName : s.remoteName;
    const guestName = s.isHost ? s.remoteName : s.localName;
    const pingText = s.ping > 0 ? t('online.ping', { n: Math.round(s.ping) }) : '';
    const fill = (row: HTMLElement, name: string, isHostRow: boolean, local: boolean): void => {
      row.innerHTML = '';
      if (!name) {
        row.classList.add('empty');
        row.append(h('span', 'spinner'), h('span', 'room-player-name', t('online.waiting')));
        return;
      }
      row.classList.remove('empty');
      row.append(h('span', 'room-player-icon', isHostRow ? '👑' : '⚽'), h('span', 'room-player-name', name));
      const tags = h('span', 'room-player-tags');
      if (isHostRow) tags.append(h('span', 'tag', t('online.host')));
      if (local) tags.append(h('span', 'tag you', t('online.you')));
      else if (pingText) tags.append(h('span', `tag ping ${s.ping < 90 ? 'good' : s.ping < 160 ? 'ok' : 'bad'}`, pingText));
      row.append(tags);
    };
    fill(rowHost, hostName, true, s.isHost);
    fill(rowGuest, guestName, false, !s.isHost);
    durLabel.textContent = t('sec', { n: s.opts.duration });
    puLabel.textContent = s.opts.powerups ? t('on') : t('off');
    const sti = STADIUMS[s.opts.stadium] ?? STADIUMS.classic;
    stLabel.textContent = sti.icon + ' ' + tr(sti.name);
    note.textContent = s.note;
    note.style.display = s.note ? '' : 'none';
    if (s.isHost) setDisabled(go, !s.remoteName);
    if (!hadGuest && s.remoteName) o.sound();
    hadGuest = !!s.remoteName;
  };
  refresh();
  const timer = window.setInterval(refresh, 500);

  return {
    screen: {
      id: 'lobby',
      root,
      items,
      initial: 0,
      back: () => o.leave(),
      dispose: () => clearInterval(timer),
    },
    refresh,
  };
}

// ------------------------------------------------------------------ in-match menu

export interface OnlinePauseOptions {
  resume: () => void;
  settings: () => void;
  howTo: () => void;
  leave: () => void;
  touch: boolean;
}

export function onlinePause(o: OnlinePauseOptions): Screen {
  const { root, body } = panel(t('online.menuTitle'), 'pause');
  body.append(h('p', 'desc', t('online.noPause')));
  const items = [
    button(t('pause.resume'), o.resume, 'btn btn-go'),
    button(t('pause.settings'), o.settings, 'btn btn-alt'),
    button(t('menu.howto'), o.howTo, 'btn btn-alt'),
    button(t('online.quitMatch'), o.leave, 'btn btn-alt btn-danger'),
  ];
  const list = h('div', 'menu-list compact');
  items.forEach((i) => list.append(i.el));
  body.append(list);
  if (!o.touch) body.append(h('div', 'hints', t('online.emotes')));
  return {
    id: 'onlinePause',
    root,
    items,
    back: o.resume,
    onKey: (code) => {
      if (code === 'KeyP') {
        o.resume();
        return true;
      }
      return false;
    },
  };
}
