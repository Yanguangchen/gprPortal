import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audio.js', () => ({
  audio: { click: vi.fn(), action: vi.fn() },
}));

import { UploadModal } from './UploadModal.js';

URL.createObjectURL = vi.fn(() => 'blob:scan');
URL.revokeObjectURL = vi.fn();

const INFO = { width: 4000, height: 3000, outWidth: 1440, outHeight: 1080, quality: 0.82 };

function scan(name, bytes) {
  return new File([new Uint8Array(bytes)], name, { type: 'image/png' });
}

function jpeg(bytes) {
  return new File([new Uint8Array(bytes)], 'out.jpg', { type: 'image/jpeg' });
}

describe('UploadModal', () => {
  let modal;

  beforeEach(() => {
    vi.clearAllMocks();
    modal = new UploadModal({ pace: 0 });
  });

  afterEach(() => {
    modal.destroy();
    document.body.style.overflow = '';
  });

  const $ = sel => document.querySelector(`.up-modal ${sel}`);

  it('opens with one queued chip per file', () => {
    modal.open([scan('a.png', 10), scan('b.png', 10)]);

    expect(document.querySelector('.up-modal').hidden).toBe(false);
    const chips = document.querySelectorAll('.up-file');
    expect(chips).toHaveLength(2);
    expect(chips[0].querySelector('.up-file-name').textContent).toBe('a.png');
    expect(chips[1].className).toContain('is-queued');
  });

  it('resolves compress() with the real result and shows before/after stats', async () => {
    modal.open([scan('a.png', 4000)]);

    const out = await modal.compress(0, onDecoded => { onDecoded(INFO); return jpeg(1000); });

    expect(out.name).toBe('out.jpg');
    expect($('.js-saved').textContent).toBe('−75%');
    expect($('.up-step[data-step="decode"] .up-step-val').textContent).toBe('4000×3000');
    expect($('.up-step[data-step="resample"] .up-step-val').textContent).toBe('1440×1080');
    // 1440×1080 at 4:2:0 → 180×135 luma + 2 × 90×68 chroma blocks
    expect($('.up-step[data-step="dct"] .up-step-val').textContent).toBe('36,540 blk');
    expect($('.up-step[data-step="quant"] .up-step-val').textContent).toBe('q 0.82');
    expect($('.up-step[data-step="entropy"]').className).toContain('is-done');
    expect($('.up-step[data-step="upload"]').className).toContain('is-active');
  });

  it('holds each stage on screen for its minimum time when the work is instant', async () => {
    modal.destroy();
    modal = new UploadModal({ pace: 0.05 }); // 3.26s of stages → ~163ms
    modal.open([scan('a.png', 10)]);

    const t0 = performance.now();
    await modal.compress(0, () => jpeg(5));

    expect(performance.now() - t0).toBeGreaterThanOrEqual(150);
  });

  it('waits for slow work before finishing the entropy stage', async () => {
    modal.open([scan('a.png', 10)]);
    let finish;
    const pending = modal.compress(0, onDecoded => {
      onDecoded(INFO);
      return new Promise(r => { finish = r; });
    });

    await new Promise(r => setTimeout(r, 20));
    expect($('.up-step[data-step="entropy"]').className).toContain('is-active');

    finish(jpeg(5));
    await pending;
    expect($('.up-step[data-step="entropy"]').className).toContain('is-done');
  });

  it('rejects compress() when the work fails', async () => {
    modal.open([scan('a.png', 10)]);

    await expect(modal.compress(0, async () => { throw new Error('Failed to load image'); }))
      .rejects.toThrow('Failed to load image');
  });

  it('tracks upload progress and moves on to indexing at 100%', async () => {
    modal.open([scan('a.png', 10)]);
    await modal.compress(0, () => jpeg(5));

    modal.setUploadProgress(0, 40);
    expect($('.up-step[data-step="upload"] .up-step-val').textContent).toBe('40%');
    expect($('.up-file-state').textContent).toBe('Uploading 40%');

    modal.setUploadProgress(0, 100);
    expect($('.up-step[data-step="index"]').className).toContain('is-active');

    await modal.completeFile(0);
    expect($('.up-file').className).toContain('is-done');
    expect($('.js-overall-pct').textContent).toBe('100%');
  });

  it('marks a failed file and reports it in the summary', async () => {
    modal.open([scan('a.png', 4000), scan('b.png', 10)]);
    await modal.compress(0, () => jpeg(1000));
    await modal.completeFile(0);
    await modal.compress(1, () => jpeg(5));
    modal.failFile(1, 'Access denied.');

    modal.finish();

    expect($('.js-title').textContent).toBe('Upload finished with errors');
    expect($('.js-summary').textContent).toContain('1 failed');
    expect(document.querySelectorAll('.up-file')[1].className).toContain('is-error');
    expect($('.js-log').textContent).toContain('Access denied.');
  });

  it('only closes after finishing, and finish() resolves on Done', async () => {
    modal.open([scan('a.png', 10)]);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.up-modal').hidden).toBe(false);

    await modal.compress(0, () => jpeg(5));
    await modal.completeFile(0);
    const closed = modal.finish();
    expect($('.js-done').hidden).toBe(false);

    $('.js-done').click();
    await closed;
    expect(document.querySelector('.up-modal').hidden).toBe(true);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:scan');
  });
});
