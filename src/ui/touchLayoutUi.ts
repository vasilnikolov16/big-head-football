import type { Settings } from '../core/storage';
import { t } from '../i18n/i18n';
import type { TouchControls } from '../input/touch';
import { button, h, optionRow, type Screen } from './ui';

export interface TouchLayoutOptions {
  settings: Settings;
  touch: TouchControls;
  /** save + apply the settings */
  save: () => void;
  back: () => void;
}

/**
 * Layout editor for the on-screen buttons: the real buttons are shown over the
 * stadium and can be dragged anywhere; every move is saved right away.
 */
export function touchLayoutScreen(o: TouchLayoutOptions): Screen {
  const s = o.settings;
  const root = h('div', 'scr scr-touchedit');
  const box = h('div', 'panel edit-panel');
  box.append(h('h2', 'panel-title', t('layout.title')), h('p', 'desc', t('layout.help')));
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
      o.save();
    },
  );
  const done = button(t('layout.done'), () => o.back(), 'btn btn-go btn-small');
  const reset = button(
    t('settings.touchReset'),
    () => {
      s.touchLayout = {};
      o.save();
    },
    'btn btn-alt btn-small',
  );
  box.append(size.el, h('div', 'row-buttons', undefined, [done.el, reset.el]));
  root.append(box);
  o.touch.setEditing(true, (layout) => {
    s.touchLayout = layout;
    o.save();
  });
  return {
    id: 'touchLayout',
    root,
    items: [size, done, reset],
    initial: 1,
    back: o.back,
    dispose: () => o.touch.setEditing(false),
  };
}
