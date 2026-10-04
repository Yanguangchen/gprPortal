import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audio.js', () => ({
  audio: {
    success: vi.fn(),
    error: vi.fn(),
    upload: vi.fn(),
    click: vi.fn(),
    action: vi.fn(),
  },
}));

import { UploadPanel } from './UploadPanel.js';

URL.createObjectURL = vi.fn(() => 'blob:scan-preview');
URL.revokeObjectURL = vi.fn();

function makeMount() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function chooseFiles(mount, files) {
  const input = mount.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { get: () => files, configurable: true });
  input.dispatchEvent(new Event('change'));
  return files;
}

function chooseFile(mount, file = new File(['scan'], 'scan.jpg', { type: 'image/jpeg' })) {
  return chooseFiles(mount, [file])[0];
}

function fillRequired(mount) {
  mount.querySelector('#up-company').value = 'ACME';
  mount.querySelector('#up-project').value = 'Alpha';
  mount.querySelector('#up-work-site').value = 'Zone 7';
  mount.querySelector('#up-date').value = '2026-06-22';
}

// Identity "compression" and no stage padding keep tests fast and deterministic.
const fast = { compress: f => f, pace: 0 };

function finishedModal() {
  return [...document.querySelectorAll('.up-modal')].find(m => !m.querySelector('.js-done').hidden);
}

describe('UploadPanel', () => {
  let mount;

  beforeEach(() => {
    mount = makeMount();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mount.remove();
    document.querySelectorAll('.up-modal').forEach(m => m.remove());
  });

  it('renders optional reference point number and remarks free-text fields', () => {
    new UploadPanel(mount, { onUpload: vi.fn(), ...fast });

    const referenceInput = mount.querySelector('#up-reference-point-number');
    const remarksInput = mount.querySelector('#up-remarks');

    expect(referenceInput).not.toBeNull();
    expect(referenceInput.type).toBe('text');
    expect(mount.querySelector('label[for="up-reference-point-number"]').textContent).toContain('Reference Point Number');
    expect(mount.querySelector('label[for="up-reference-point-number"]').textContent).not.toContain('*');

    expect(remarksInput).not.toBeNull();
    expect(remarksInput.type).toBe('text');
    expect(mount.querySelector('label[for="up-remarks"]').textContent).toContain('Remarks');
    expect(mount.querySelector('label[for="up-remarks"]').textContent).not.toContain('*');
  });

  it('submits trimmed reference point number and remarks metadata', async () => {
    const onUpload = vi.fn(async () => {});
    new UploadPanel(mount, { onUpload, ...fast });
    const file = chooseFile(mount);

    mount.querySelector('#up-company').value = ' ACME ';
    mount.querySelector('#up-project').value = ' Alpha ';
    mount.querySelector('#up-work-site').value = ' Zone 7 ';
    mount.querySelector('#up-date').value = '2026-06-22';
    mount.querySelector('#up-reference-point-number').value = ' RP-12A ';
    mount.querySelector('#up-remarks').value = ' Near column B2 ';

    mount.querySelector('.js-submit').click();
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());

    expect(onUpload).toHaveBeenCalledWith(
      file,
      {
        companyName: 'ACME',
        projectName: 'Alpha',
        workSite: 'Zone 7',
        imageDate: '2026-06-22',
        referencePointNumber: 'RP-12A',
        remarks: 'Near column B2',
      },
      expect.any(Function),
    );
  });

  it('allows reference point number and remarks to be blank', async () => {
    const onUpload = vi.fn(async () => {});
    new UploadPanel(mount, { onUpload, ...fast });
    chooseFile(mount);
    fillRequired(mount);

    mount.querySelector('.js-submit').click();
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalled());

    expect(onUpload).toHaveBeenCalledOnce();
    expect(onUpload.mock.calls[0][1]).toMatchObject({
      referencePointNumber: '',
      remarks: '',
    });
  });

  it('requires at least one file', () => {
    const onUpload = vi.fn();
    new UploadPanel(mount, { onUpload, ...fast });
    fillRequired(mount);

    mount.querySelector('.js-submit').click();

    expect(onUpload).not.toHaveBeenCalled();
    expect(mount.querySelector('.js-status').textContent).toContain('at least one');
  });

  it('labels the submit button with the number of staged scans', () => {
    new UploadPanel(mount, { onUpload: vi.fn(), ...fast });
    expect(mount.querySelector('.js-submit-text').textContent).toBe('Upload to Portal');

    chooseFiles(mount, [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')]);
    expect(mount.querySelector('.js-submit-text').textContent).toBe('Upload 2 scans');
  });

  it('warns when more than 3 files are selected', () => {
    new UploadPanel(mount, { onUpload: vi.fn(), ...fast });
    chooseFiles(mount, ['1', '2', '3', '4'].map(n => new File([n], `${n}.jpg`)));

    expect(mount.querySelectorAll('.dz-tile')).toHaveLength(3);
    expect(mount.querySelector('.js-status').textContent).toContain('1 file was skipped');
  });

  it('compresses and uploads every staged scan with the shared metadata, then resets', async () => {
    const files = ['a', 'b', 'c'].map(n => new File([n], `${n}.png`, { type: 'image/png' }));
    const compress = vi.fn(async (f, { onDecoded }) => {
      onDecoded({ width: 4000, height: 3000, outWidth: 1440, outHeight: 1080, quality: 0.82 });
      return new File(['jpg'], f.name.replace('.png', '.jpg'), { type: 'image/jpeg' });
    });
    const onUpload = vi.fn(async (_file, _meta, onProgress) => { onProgress(50); onProgress(100); });
    new UploadPanel(mount, { onUpload, compress, pace: 0 });
    chooseFiles(mount, files);
    fillRequired(mount);

    mount.querySelector('.js-submit').click();
    await vi.waitFor(() => expect(finishedModal()).toBeTruthy());

    expect(compress).toHaveBeenCalledTimes(3);
    expect(onUpload.mock.calls.map(c => c[0].name)).toEqual(['a.jpg', 'b.jpg', 'c.jpg']);
    onUpload.mock.calls.forEach(c => expect(c[1]).toMatchObject({ companyName: 'ACME', workSite: 'Zone 7' }));
    expect(mount.querySelectorAll('.dz-tile')).toHaveLength(0);
    expect(mount.querySelector('#up-company').value).toBe('');
    expect(mount.querySelector('.js-status').textContent).toBe('3 scans uploaded successfully.');
    expect(finishedModal().querySelector('.js-title').textContent).toBe('Upload complete');
  });

  it('keeps failed scans and the form filled when part of a batch fails', async () => {
    const [a, b] = [new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg')];
    const onUpload = vi.fn(async file => {
      if (file === b) throw new Error('Access denied.');
    });
    new UploadPanel(mount, { onUpload, ...fast });
    chooseFiles(mount, [a, b]);
    fillRequired(mount);

    mount.querySelector('.js-submit').click();
    await vi.waitFor(() => expect(finishedModal()).toBeTruthy());

    expect(onUpload).toHaveBeenCalledTimes(2);
    expect([...mount.querySelectorAll('.preview-bar-name')].map(n => n.textContent)).toEqual(['b.jpg']);
    expect(mount.querySelector('#up-company').value).toBe('ACME');
    const status = mount.querySelector('.js-status');
    expect(status.classList.contains('error')).toBe(true);
    expect(status.textContent).toContain('1 of 2 scans uploaded');
    expect(status.textContent).toContain('Access denied.');
    expect(mount.querySelector('.js-submit').disabled).toBe(false);
  });

  it('reports a compression failure without calling onUpload', async () => {
    const onUpload = vi.fn();
    const compress = vi.fn(async () => { throw new Error('Failed to load image'); });
    new UploadPanel(mount, { onUpload, compress, pace: 0 });
    chooseFile(mount);
    fillRequired(mount);

    mount.querySelector('.js-submit').click();
    await vi.waitFor(() => expect(finishedModal()).toBeTruthy());

    expect(onUpload).not.toHaveBeenCalled();
    expect(mount.querySelector('.js-status').textContent).toBe('Failed to load image');
    expect(finishedModal().querySelector('.js-title').textContent).toBe('Upload failed');
  });
});
