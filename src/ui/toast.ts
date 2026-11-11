import { h } from './ui';

/** Small pop-up notifications (achievements, unlocks) in the top-right corner. */
export class Toaster {
  private box: HTMLElement;
  private queue: Array<() => void> = [];
  private visible = 0;

  constructor(host: HTMLElement, private onShow: () => void = () => {}) {
    this.box = h('div', 'toasts');
    host.append(this.box);
  }

  show(icon: string, title: string, text: string): void {
    this.queue.push(() => this.pop(icon, title, text));
    this.pump();
  }

  private pump(): void {
    while (this.visible < 3 && this.queue.length) this.queue.shift()!();
  }

  private pop(icon: string, title: string, text: string): void {
    this.visible++;
    this.onShow();
    const el = h('div', 'toast', undefined, [
      h('div', 'toast-icon', icon),
      h('div', 'toast-text', undefined, [h('div', 'toast-title', title), h('div', 'toast-body', text)]),
    ]);
    this.box.append(el);
    void el.offsetWidth;
    el.classList.add('in');
    window.setTimeout(() => {
      el.classList.remove('in');
      el.classList.add('out');
      window.setTimeout(() => {
        el.remove();
        this.visible--;
        this.pump();
      }, 350);
    }, 3600);
  }
}
