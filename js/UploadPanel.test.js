import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./audio.js', () => ({
  audio: {
    success: vi.fn(),
    error: vi.fn(),
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

function chooseFile(mount, file = new File(['scan'], 'scan.jpg', { type: 'image/jpeg' })) {
  const input = mount.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
  input.dispatchEvent(new Event('change'));
  return file;
}

async function flush() {
  await Promise.resolve();
}

describe('UploadPanel', () => {
  let mount;

  beforeEach(() => {
    mount = makeMount();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mount.remove();
  });

  it('renders optional reference point number and remarks free-text fields', () => {
    new UploadPanel(mount, { onUpload: vi.fn() });

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
    new UploadPanel(mount, { onUpload });
    const file = chooseFile(mount);

    mount.querySelector('#up-company').value = ' ACME ';
    mount.querySelector('#up-project').value = ' Alpha ';
    mount.querySelector('#up-work-site').value = ' Zone 7 ';
    mount.querySelector('#up-date').value = '2026-06-22';
    mount.querySelector('#up-reference-point-number').value = ' RP-12A ';
    mount.querySelector('#up-remarks').value = ' Near column B2 ';

    mount.querySelector('.js-submit').click();
    await flush();

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
    new UploadPanel(mount, { onUpload });
    chooseFile(mount);

    mount.querySelector('#up-company').value = 'ACME';
    mount.querySelector('#up-project').value = 'Alpha';
    mount.querySelector('#up-work-site').value = 'Zone 7';
    mount.querySelector('#up-date').value = '2026-06-22';

    mount.querySelector('.js-submit').click();
    await flush();

    expect(onUpload).toHaveBeenCalledOnce();
    expect(onUpload.mock.calls[0][1]).toMatchObject({
      referencePointNumber: '',
      remarks: '',
    });
  });
});
