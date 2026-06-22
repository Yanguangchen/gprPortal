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
});
