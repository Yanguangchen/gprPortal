import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs.js';

const WIDTH = 400;

function setup() {
  document.body.innerHTML = `
    <nav class="tabs" role="tablist">
      <button role="tab" data-tab="upload">Upload</button>
      <button role="tab" data-tab="gallery">Gallery <span class="tab-badge" hidden></span></button>
    </nav>
    <main id="screens">
      <section role="tabpanel" id="p-upload"><input id="in-upload" /></section>
      <section role="tabpanel" id="p-gallery"><input id="in-gallery" /></section>
    </main>
  `;
  const tablist = document.querySelector('.tabs');
  const track   = document.getElementById('screens');
  // happy-dom has no layout: give the track a width and a scroll position we control.
  let left = 0;
  Object.defineProperty(track, 'clientWidth', { get: () => WIDTH, configurable: true });
  Object.defineProperty(track, 'scrollLeft', { get: () => left, set: v => { left = v; }, configurable: true });
  track.scrollTo = vi.fn(({ left: l }) => { left = l; });
  return { tablist, track, tabEls: [...tablist.querySelectorAll('[role="tab"]')] };
}

/** Simulate the user swiping the track to `left` and the scroll handler running. */
async function swipeTo(track, left) {
  track.scrollLeft = left;
  track.dispatchEvent(new Event('pointerdown'));
  track.dispatchEvent(new Event('scroll'));
  await new Promise(r => requestAnimationFrame(r));
}

describe('Tabs', () => {
  beforeEach(() => {
    history.replaceState(null, '', location.pathname);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts on the first tab with the other screen inert', () => {
    const { tablist, tabEls } = setup();
    const tabs = new Tabs(tablist, document.getElementById('screens'));

    expect(tabs.index).toBe(0);
    expect(tabEls.map(t => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(tabEls.map(t => t.tabIndex)).toEqual([0, -1]);
    expect(document.getElementById('p-upload').hasAttribute('inert')).toBe(false);
    expect(document.getElementById('p-gallery').hasAttribute('inert')).toBe(true);
    expect(tablist.style.getPropertyValue('--n')).toBe('2');
  });

  it('opens the tab named in the URL hash', () => {
    history.replaceState(null, '', '#gallery');
    const { tablist, track } = setup();
    const tabs = new Tabs(tablist, track);

    expect(tabs.index).toBe(1);
    expect(track.scrollLeft).toBe(WIDTH);
  });

  it('slides to a screen when its tab is clicked and records it in the hash', () => {
    const { tablist, track, tabEls } = setup();
    const tabs = new Tabs(tablist, track);

    tabEls[1].click();

    expect(tabs.index).toBe(1);
    expect(track.scrollTo).toHaveBeenLastCalledWith({ left: WIDTH, behavior: 'smooth' });
    expect(tabEls[1].getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('p-upload').hasAttribute('inert')).toBe(true);
    expect(document.getElementById('p-gallery').hasAttribute('inert')).toBe(false);
    expect(location.hash).toBe('#gallery');
  });

  it('switches tabs when the screens are swiped past halfway', async () => {
    const { tablist, track } = setup();
    const tabs = new Tabs(tablist, track);

    await swipeTo(track, WIDTH * 0.4);
    expect(tabs.index).toBe(0);
    expect(tablist.style.getPropertyValue('--p')).toBe('0.4000');

    await swipeTo(track, WIDTH * 0.6);
    expect(tabs.index).toBe(1);
  });

  it('ignores intermediate scroll positions while a tab click is sliding', async () => {
    const { tablist, track, tabEls } = setup();
    const tabs = new Tabs(tablist, track);
    track.scrollTo = vi.fn(); // the smooth scroll hasn't moved yet

    tabEls[1].click();
    track.scrollLeft = WIDTH * 0.2;
    track.dispatchEvent(new Event('scroll'));
    await new Promise(r => requestAnimationFrame(r));

    expect(tabs.index).toBe(1);
  });

  it('moves between tabs with the arrow, Home and End keys', () => {
    const { tablist, track, tabEls } = setup();
    const tabs = new Tabs(tablist, track);

    tabEls[0].focus();
    tabEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(tabs.index).toBe(1);
    expect(document.activeElement).toBe(tabEls[1]);

    tabEls[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(tabs.index).toBe(0);

    tabEls[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(tabs.index).toBe(1);
  });

  it('shows a badge count, hides it at zero and bumps it when it grows', () => {
    const { tablist, track } = setup();
    const tabs = new Tabs(tablist, track);
    const badge = tablist.querySelector('.tab-badge');

    tabs.setBadge('gallery', 0);
    expect(badge.hidden).toBe(true);

    tabs.setBadge('gallery', 5);
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('5');
    expect(badge.classList.contains('bump')).toBe(true);

    badge.classList.remove('bump');
    tabs.setBadge('gallery', 4);
    expect(badge.classList.contains('bump')).toBe(false);
  });
});
