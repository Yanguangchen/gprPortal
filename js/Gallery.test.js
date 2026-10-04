import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audio.js', () => ({
  audio: {
    action: vi.fn(),
  },
}));

import { Gallery } from './Gallery.js';

const records = [
  {
    id: 'rec1',
    imageUrl: 'https://example.com/one.jpg',
    imageName: 'one.jpg',
    companyName: 'ACME Corp',
    projectName: 'Site Survey',
    workSite: 'Downtown',
    imageDate: '2026-06-22',
    referencePointNumber: 'RP-12A',
    remarks: 'Near column B2',
  },
  {
    id: 'rec2',
    imageUrl: 'https://example.com/two.jpg',
    imageName: 'two.jpg',
    companyName: 'Beta Corp',
    projectName: 'Road Scan',
    workSite: 'Uptown',
    imageDate: '2026-06-21',
    referencePointNumber: 'RP-99',
    remarks: 'North wall',
  },
];

describe('Gallery', () => {
  let mount;
  let gallery;

  beforeEach(() => {
    mount = document.createElement('div');
    document.body.appendChild(mount);
    gallery = new Gallery(mount);
  });

  afterEach(() => {
    mount.remove();
    document.querySelectorAll('.lightbox').forEach(el => el.remove());
    document.body.style.overflow = '';
  });

  it('searches reference point number and remarks fields', () => {
    gallery.setRecords(records);

    mount.querySelector('.js-f-search').value = 'column b2';
    mount.querySelector('.js-f-search').dispatchEvent(new Event('input'));

    const cards = mount.querySelectorAll('.image-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].dataset.id).toBe('rec1');
  });

  it('shows reference point number and remarks in the lightbox metadata', () => {
    gallery.setRecords(records);

    mount.querySelector('[data-id="rec1"] .card-img-wrap').click();

    const meta = document.querySelector('.js-lb-meta').textContent;
    expect(meta).toContain('RP-12A');
    expect(meta).toContain('Near column B2');
  });

  it('only shows "Clear filters" while a filter is active', () => {
    gallery.setRecords(records);
    const clear = mount.querySelector('.js-f-clear');
    expect(clear.hidden).toBe(true);

    const search = mount.querySelector('.js-f-search');
    search.value = 'acme';
    search.dispatchEvent(new Event('input'));
    expect(clear.hidden).toBe(false);

    clear.click();
    expect(search.value).toBe('');
    expect(clear.hidden).toBe(true);
  });

  it('animates cards in only the first time they are shown', () => {
    gallery.setRecords(records);
    const first = [...mount.querySelectorAll('.image-card')];
    expect(first.every(c => c.classList.contains('is-new'))).toBe(true);
    expect(first.map(c => c.style.getPropertyValue('--i'))).toEqual(['0', '1']);

    gallery.addRecord({ ...records[0], id: 'rec3' });
    const cards = [...mount.querySelectorAll('.image-card')];
    expect(cards.filter(c => c.classList.contains('is-new')).map(c => c.dataset.id)).toEqual(['rec3']);
  });

  it('leaves empty optional fields out of the lightbox', () => {
    gallery.setRecords([{ ...records[0], referencePointNumber: '', remarks: '' }]);

    mount.querySelector('.card-img-wrap').click();

    const meta = document.querySelector('.js-lb-meta').textContent;
    expect(meta).toContain('Downtown');
    expect(meta).not.toMatch(/Not specified|None|Ref:/);
  });
});
