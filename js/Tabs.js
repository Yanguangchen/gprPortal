/**
 * Swipeable tab screens.
 *
 * Markup: a [role="tablist"] of [role="tab"] buttons (each with a
 * `data-tab` name), plus a horizontally scroll-snapping track whose
 * [role="tabpanel"] children are the screens, in the same order.
 * Screens switch on tab click, arrow keys, or by swiping the track;
 * the tab indicator follows the scroll position as you swipe.
 *
 * Usage:
 *   const tabs = new Tabs(tablistEl, trackEl);
 *   tabs.select(1);                 // slide to the second screen
 *   tabs.setBadge('gallery', 12);   // count shown on a tab
 */
export class Tabs {
  constructor(tablist, track) {
    this._tablist = tablist;
    this._track   = track;
    this._tabs    = [...tablist.querySelectorAll('[role="tab"]')];
    this._panels  = [...track.querySelectorAll(':scope > [role="tabpanel"]')];
    this._index   = -1;
    this._target  = null; // destination of an in-flight tab-click scroll
    this._badges  = {};

    tablist.style.setProperty('--n', this._tabs.length);

    this._tabs.forEach((tab, i) => tab.addEventListener('click', () => this.select(i)));
    tablist.addEventListener('keydown', e => this._onKey(e));

    let raf = 0;
    track.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this._onScroll());
    }, { passive: true });
    // Touching the track mid-slide hands control back to the swipe.
    ['pointerdown', 'touchstart', 'wheel'].forEach(type =>
      track.addEventListener(type, () => { this._target = null; }, { passive: true }));
    window.addEventListener('resize', () => this._align());
    window.addEventListener('hashchange', () => {
      const i = this._fromHash();
      if (i !== -1) this.select(i);
    });

    const start = this._fromHash();
    this.select(start === -1 ? 0 : start, { smooth: false });
  }

  get index() { return this._index; }

  select(i, { smooth = true } = {}) {
    i = Math.min(Math.max(i, 0), this._tabs.length - 1);
    this._setActive(i);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const animate = smooth && !reduce;
    this._target = animate ? i : null;
    this._scrollTo(i * this._track.clientWidth, animate);
    if (!animate) this._setProgress(i);
  }

  /** Show `n` in the badge of the tab named `name` (hidden when 0); bumps when it grows. */
  setBadge(name, n) {
    const el = this._tabs.find(t => t.dataset.tab === name)?.querySelector('.tab-badge');
    if (!el) return;
    const prev = this._badges[name];
    this._badges[name] = n;
    el.textContent = n;
    el.hidden = !n;
    if (prev != null && n > prev) {
      el.classList.remove('bump');
      void el.offsetWidth; // restart the animation
      el.classList.add('bump');
    }
  }

  // ── Private ──────────────────────────────────────────────────────

  _onScroll() {
    const w = this._track.clientWidth;
    if (!w) return;
    const p = this._track.scrollLeft / w;
    this._setProgress(p);
    if (this._target != null) {
      // Ignore the intermediate positions of a tab-click slide.
      if (Math.abs(p - this._target) < 0.02) this._target = null;
      return;
    }
    this._setActive(Math.round(p));
  }

  _setActive(i) {
    if (i === this._index) return;
    const initial = this._index === -1;
    this._index = i;
    this._tabs.forEach((tab, k) => {
      tab.setAttribute('aria-selected', String(k === i));
      tab.tabIndex = k === i ? 0 : -1;
    });
    // Off-screen screens can't take focus or clicks.
    this._panels.forEach((panel, k) => panel.toggleAttribute('inert', k !== i));
    if (!initial) history.replaceState(null, '', `#${this._tabs[i].dataset.tab}`);
  }

  _setProgress(p) {
    const max = this._tabs.length - 1;
    this._tablist.style.setProperty('--p', Math.min(Math.max(p, 0), max).toFixed(4));
  }

  _scrollTo(left, smooth) {
    if (typeof this._track.scrollTo === 'function') {
      this._track.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      this._track.scrollLeft = left;
    }
  }

  _align() {
    this._target = null;
    this._scrollTo(this._index * this._track.clientWidth, false);
    this._setProgress(this._index);
  }

  _fromHash() {
    return this._tabs.findIndex(t => `#${t.dataset.tab}` === location.hash);
  }

  _onKey(e) {
    const cur = this._tabs.indexOf(document.activeElement);
    if (cur === -1) return;
    const n = this._tabs.length;
    const next = { ArrowRight: (cur + 1) % n, ArrowLeft: (cur - 1 + n) % n, Home: 0, End: n - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    this.select(next);
    this._tabs[next].focus();
  }
}
