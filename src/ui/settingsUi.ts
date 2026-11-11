import type { Difficulty } from '../ai/aiController';
import type { Settings } from '../core/storage';
import { getLang, setLang, t, type Lang } from '../i18n/i18n';
import {
  ACTION_KEYS,
  ACTIONS,
  cloneBinding,
  DEFAULT_P1,
  DEFAULT_P2,
  keyLabel,
  RESERVED_KEYS,
  type Action,
} from '../input/controls';
import { cleanName, MAX_NAME } from '../net/protocol';
import { button, h, keycap, optionRow, sliderRow, textRow, type NavItem, type Screen, type UI } from './ui';

export type SettingsTab = 'sound' | 'game' | 'display' | 'buttons' | 'controls' | 'online' | 'language';
const TABS: SettingsTab[] = ['sound', 'game', 'display', 'buttons', 'controls', 'online', 'language'];

/** The part of the game the settings screen talks to. */
export interface SettingsHost {
  settings: Settings;
  readonly ui: UI;
  saveSettings(): void;
  onSettingsChanged(): void;
  resetProgress(): void;
  /** phone / tablet buttons are in use */
  readonly touchMode: boolean;
  /** opens the on-screen button layout editor */
  editTouchLayout(back: () => void): void;
}

interface TabContent {
  el: HTMLElement;
  items: NavItem[];
  onKey?: (code: string) => boolean;
}

const durations = (): Array<{ value: 30 | 60 | 90; label: string }> => [
  { value: 30, label: t('sec', { n: 30 }) },
  { value: 60, label: t('sec', { n: 60 }) },
  { value: 90, label: t('sec', { n: 90 }) },
];

const difficulties = (): Array<{ value: Difficulty; label: string }> => [
  { value: 'easy', label: t('diff.easy') },
  { value: 'medium', label: t('diff.medium') },
  { value: 'hard', label: t('diff.hard') },
];

const onOff = (): Array<{ value: boolean; label: string }> => [
  { value: true, label: t('on') },
  { value: false, label: t('off') },
];

/** Match length row (also used on the vs-computer setup screen). */
export function durationRow(host: SettingsHost): NavItem {
  return optionRow(t('cpu.duration'), durations(), () => host.settings.duration, (v) => {
    host.settings.duration = v;
    host.saveSettings();
  });
}

export function difficultyRow(host: SettingsHost, label = t('settings.cpuDiff'), after?: () => void): NavItem {
  return optionRow(label, difficulties(), () => host.settings.difficulty, (v) => {
    host.settings.difficulty = v;
    host.saveSettings();
    after?.();
  });
}

export function controlSetRow(host: SettingsHost): NavItem {
  return optionRow<'wasd' | 'arrows'>(
    t('cpu.controls'),
    [
      { value: 'wasd', label: t('player1') },
      { value: 'arrows', label: t('player2') },
    ],
    () => host.settings.humanScheme,
    (v) => {
      host.settings.humanScheme = v;
      host.saveSettings();
    },
  );
}

// ------------------------------------------------------------------ tabs

function soundTab(host: SettingsHost): TabContent {
  const s = host.settings;
  const changed = (): void => {
    host.saveSettings();
    host.onSettingsChanged();
  };
  const sfx = sliderRow(t('settings.sfx'), () => s.sfxVolume, (v) => {
    s.sfxVolume = v;
    changed();
  });
  const music = sliderRow(t('settings.music'), () => s.musicVolume, (v) => {
    s.musicVolume = v;
    changed();
  });
  const crowd = sliderRow(t('settings.crowd'), () => s.crowdVolume, (v) => {
    s.crowdVolume = v;
    changed();
  });
  const el = h('div', 'tab-body');
  el.append(sfx.el, music.el, crowd.el);
  return { el, items: [sfx, music, crowd] };
}

function gameTab(host: SettingsHost): TabContent {
  const s = host.settings;
  const changed = (): void => {
    host.saveSettings();
    host.onSettingsChanged();
  };
  const dur = durationRow(host);
  const diff = difficultyRow(host);
  const set = controlSetRow(host);
  const bonuses = optionRow(t('settings.powerups'), onOff(), () => s.powerups, (v) => {
    s.powerups = v;
    changed();
  });
  const replays = optionRow(t('settings.replays'), onOff(), () => s.replays, (v) => {
    s.replays = v;
    changed();
  });
  const cinematic = optionRow(t('settings.cinematic'), onOff(), () => s.cinematic, (v) => {
    s.cinematic = v;
    changed();
  });
  let armed = false;
  const reset = button(
    t('settings.reset'),
    () => {
      const label = reset.el.querySelector('.btn-label')!;
      if (!armed) {
        armed = true;
        label.textContent = t('settings.resetConfirm');
        return;
      }
      armed = false;
      host.resetProgress();
      label.textContent = t('settings.resetDone');
    },
    'btn btn-alt btn-small btn-danger',
  );
  const el = h('div', 'tab-body');
  // the keyboard set against the computer only matters with a keyboard
  const rows = host.touchMode ? [dur, diff, bonuses, replays, cinematic] : [dur, diff, set, bonuses, replays, cinematic];
  el.append(...rows.map((r) => r.el), h('div', 'row-buttons', undefined, [reset.el]));
  return { el, items: [...rows, reset] };
}

function displayTab(host: SettingsHost): TabContent {
  const s = host.settings;
  const changed = (): void => {
    host.saveSettings();
    host.onSettingsChanged();
  };
  const shake = optionRow(t('settings.shake'), onOff(), () => s.shake, (v) => {
    s.shake = v;
    changed();
  });
  const quality = optionRow<'high' | 'normal' | 'saver'>(
    t('settings.quality'),
    [
      { value: 'high', label: t('q.high') },
      { value: 'normal', label: t('q.normal') },
      { value: 'saver', label: t('q.saver') },
    ],
    () => s.quality,
    (v) => {
      s.quality = v;
      changed();
    },
  );
  const fps = optionRow(t('settings.fps'), onOff(), () => s.showFps, (v) => {
    s.showFps = v;
    changed();
  });
  const el = h('div', 'tab-body');
  el.append(shake.el, quality.el, h('p', 'desc small', t('settings.qualityDesc')), fps.el);
  return { el, items: [shake, quality, fps] };
}

function buttonsTab(host: SettingsHost, rerender: () => void): TabContent {
  const s = host.settings;
  const changed = (): void => {
    host.saveSettings();
    host.onSettingsChanged();
  };
  const touch = optionRow<'auto' | 'on' | 'off'>(
    t('settings.touch'),
    [
      { value: 'auto', label: t('auto') },
      { value: 'on', label: t('on') },
      { value: 'off', label: t('off') },
    ],
    () => s.touch,
    (v) => {
      s.touch = v;
      changed();
    },
  );
  const size = optionRow<'small' | 'normal' | 'large'>(
    t('settings.touchSize'),
    [
      { value: 'small', label: t('size.small') },
      { value: 'normal', label: t('size.normal') },
      { value: 'large', label: t('size.large') },
    ],
    () => s.touchSize,
    (v) => {
      s.touchSize = v;
      changed();
    },
  );
  const opacity = optionRow<'solid' | 'normal' | 'clear'>(
    t('settings.touchOpacity'),
    [
      { value: 'solid', label: t('op.solid') },
      { value: 'normal', label: t('op.normal') },
      { value: 'clear', label: t('op.clear') },
    ],
    () => s.touchOpacity,
    (v) => {
      s.touchOpacity = v;
      changed();
    },
  );
  const custom = Object.keys(s.touchLayout).length > 0;
  const edit = button(t('settings.touchEdit'), () => host.editTouchLayout(rerender), 'btn btn-go btn-small');
  const reset = button(
    t('settings.touchReset'),
    () => {
      s.touchLayout = {};
      changed();
      rerender();
    },
    'btn btn-alt btn-small',
    !custom,
  );
  const el = h('div', 'tab-body');
  el.append(
    touch.el,
    size.el,
    opacity.el,
    h('p', 'desc small', t(custom ? 'settings.touchCustom' : 'settings.touchDesc')),
    h('div', 'row-buttons', undefined, [edit.el, reset.el]),
  );
  return { el, items: [touch, size, opacity, edit, reset] };
}

function onlineTab(host: SettingsHost): TabContent {
  const s = host.settings;
  const changed = (): void => {
    host.saveSettings();
    host.onSettingsChanged();
  };
  const name = textRow(t('settings.onlineName'), () => s.onlineName, (v) => {
    s.onlineName = v.slice(0, MAX_NAME);
    host.saveSettings();
  }, { max: MAX_NAME, placeholder: t('online.namePh') });
  name.input.addEventListener('blur', () => {
    s.onlineName = cleanName(name.input.value);
    name.input.value = s.onlineName;
    host.saveSettings();
  });
  const buffer = optionRow<'fast' | 'normal' | 'smooth'>(
    t('settings.netBuffer'),
    [
      { value: 'fast', label: t('buf.fast') },
      { value: 'normal', label: t('buf.normal') },
      { value: 'smooth', label: t('buf.smooth') },
    ],
    () => s.netBuffer,
    (v) => {
      s.netBuffer = v;
      changed();
    },
  );
  const ping = optionRow(t('settings.showPing'), onOff(), () => s.showPing, (v) => {
    s.showPing = v;
    changed();
  });
  const el = h('div', 'tab-body');
  el.append(name.el, buffer.el, h('p', 'desc small', t('settings.netBufferDesc')), ping.el);
  return { el, items: [name, buffer, ping] };
}

function languageTab(host: SettingsHost, rerender: () => void): TabContent {
  const lang = optionRow<Lang>(
    t('settings.language'),
    [
      { value: 'bg', label: 'Български' },
      { value: 'en', label: 'English' },
    ],
    () => getLang(),
    (v) => {
      host.settings.lang = v;
      host.saveSettings();
      setLang(v);
      rerender();
    },
  );
  const el = h('div', 'tab-body');
  el.append(lang.el);
  return { el, items: [lang] };
}

function controlsTab(host: SettingsHost): TabContent {
  const c = host.settings.controls;
  const players: Array<['p1' | 'p2', string, string]> = [
    ['p1', t('controls.p1'), '#ff4d4d'],
    ['p2', t('controls.p2'), '#2f8cff'],
  ];
  let capturing: { pl: 'p1' | 'p2'; action: Action } | null = null;
  const msg = h('p', 'desc bind-msg', t('controls.help'));
  const rowEls: Array<{ pl: 'p1' | 'p2'; action: Action; keys: HTMLElement; el: HTMLElement }> = [];
  const items: NavItem[] = [];
  const cols = h('div', 'ctrl-cards');

  const refresh = (): void => {
    for (const r of rowEls) {
      r.keys.innerHTML = '';
      c[r.pl][r.action].forEach((k, i) => {
        if (i > 0) r.keys.append(h('span', 'or', t('or')));
        r.keys.append(keycap(keyLabel(k), keyLabel(k).length > 2));
      });
      r.el.classList.remove('capturing');
    }
  };

  for (const [pl, title, color] of players) {
    const card = h('div', 'ctrl-card');
    card.style.setProperty('--team', color);
    card.append(h('h3', '', title));
    for (const action of ACTIONS) {
      const el = h('div', 'bind-row');
      const keys = h('div', 'bind-keys');
      el.append(h('span', 'bind-label', t(ACTION_KEYS[action])), keys);
      card.append(el);
      rowEls.push({ pl, action, keys, el });
      items.push({
        el,
        activate: () => {
          refresh();
          capturing = { pl, action };
          el.classList.add('capturing');
          keys.innerHTML = '';
          keys.append(h('span', 'press', t('controls.press')));
          msg.textContent = t('controls.pressHint');
        },
      });
    }
    cols.append(card);
  }

  const bind = (pl: 'p1' | 'p2', action: Action, code: string): void => {
    const old = c[pl][action][0];
    let swapped = '';
    for (const other of ['p1', 'p2'] as const) {
      for (const a of ACTIONS) {
        if (other === pl && a === action) continue;
        const list = c[other][a];
        const i = list.indexOf(code);
        if (i < 0) continue;
        list.splice(i, 1);
        if (list.length === 0) list.push(old); // swap the two keys
        swapped = t('controls.swapped', {
          k: keyLabel(code),
          a: t(ACTION_KEYS[a]),
          p: other === 'p1' ? t('player1') : t('player2'),
          o: keyLabel(c[other][a][0]),
        });
      }
    }
    c[pl][action].splice(0, c[pl][action].length, code);
    host.saveSettings();
    host.onSettingsChanged();
    msg.textContent = swapped || t('controls.set', { a: t(ACTION_KEYS[action]), k: keyLabel(code) });
  };

  const reset = button(
    t('controls.reset'),
    () => {
      const d1 = cloneBinding(DEFAULT_P1);
      const d2 = cloneBinding(DEFAULT_P2);
      for (const a of ACTIONS) {
        c.p1[a].splice(0, c.p1[a].length, ...d1[a]);
        c.p2[a].splice(0, c.p2[a].length, ...d2[a]);
      }
      host.saveSettings();
      host.onSettingsChanged();
      msg.textContent = t('controls.resetDone');
      refresh();
    },
    'btn btn-alt btn-small',
  );
  items.push(reset);
  const el = h('div', 'tab-body');
  el.append(cols, msg, h('div', 'row-buttons', undefined, [reset.el]));
  refresh();

  const onKey = (code: string): boolean => {
    if (capturing) {
      const cap = capturing;
      capturing = null;
      if (code === 'Escape') msg.textContent = t('controls.cancelled');
      else if (RESERVED_KEYS.has(code)) msg.textContent = t('controls.reserved', { k: keyLabel(code) });
      else bind(cap.pl, cap.action, code);
      refresh();
      return true;
    }
    // ←/→ jumps between the two players' columns (item 0 is the tab bar)
    const i = host.ui.selectedIndex - 1;
    const n = ACTIONS.length;
    if ((code === 'ArrowLeft' || code === 'ArrowRight' || code === 'KeyA' || code === 'KeyD') && i >= 0 && i < n * 2) {
      host.ui.select(1 + (i < n ? i + n : i - n));
      return true;
    }
    return false;
  };
  return { el, items, onKey };
}

// ------------------------------------------------------------------ screen

/** Settings with tabs on top. Works from the main menu and from the pause menu. */
export function settingsScreen(host: SettingsHost, back: () => void, tab: SettingsTab = 'sound', focusTabs = true): Screen {
  const root = h('div', 'scr scr-panel settings');
  const box = h('div', 'panel');
  root.append(box);
  box.append(h('h2', 'panel-title', t('settings.title')));

  const go = (next: SettingsTab): void => host.ui.show(settingsScreen(host, back, next, true), true);
  const idx = TABS.indexOf(tab);

  const bar = h('div', 'tabs');
  TABS.forEach((name) => {
    const b = h('button', `tab${name === tab ? ' on' : ''}`, t(`tab.${name}`));
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (name !== tab) go(name);
    });
    bar.append(b);
  });
  const tabItem: NavItem = {
    el: bar,
    left: () => go(TABS[(idx + TABS.length - 1) % TABS.length]),
    right: () => go(TABS[(idx + 1) % TABS.length]),
  };
  box.append(bar);

  const content =
    tab === 'sound'
      ? soundTab(host)
      : tab === 'game'
        ? gameTab(host)
        : tab === 'display'
          ? displayTab(host)
          : tab === 'buttons'
            ? buttonsTab(host, () => host.ui.show(settingsScreen(host, back, 'buttons', false), true))
        : tab === 'controls'
          ? controlsTab(host)
          : tab === 'online'
            ? onlineTab(host)
            : languageTab(host, () => host.ui.show(settingsScreen(host, back, 'language', true), true));
  box.append(content.el);

  const done = button(t('done'), back, 'btn btn-go btn-small');
  box.append(h('div', 'row-buttons', undefined, [done.el]), h('div', 'hints', t('settings.tabHint')));

  return {
    id: 'settings',
    root,
    items: [tabItem, ...content.items, done],
    initial: focusTabs ? 0 : 1,
    back,
    onKey: (code) => {
      if (content.onKey?.(code)) return true;
      if (code === 'KeyQ') {
        tabItem.left!();
        return true;
      }
      if (code === 'KeyE') {
        tabItem.right!();
        return true;
      }
      return false;
    },
  };
}
