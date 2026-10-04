import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DropZone } from './DropZone.js';

// URL.createObjectURL is not available in happy-dom
const mockObjectUrl = 'blob:mock-url';
URL.createObjectURL = vi.fn(() => mockObjectUrl);
URL.revokeObjectURL = vi.fn();

function makeContainer() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return el;
}

function makeFile(name = 'photo.jpg', type = 'image/jpeg') {
  return new File(['fake-image-data'], name, { type });
}

describe('DropZone', () => {
  let container;

  beforeEach(() => {
    container = makeContainer();
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  function select(files) {
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { get: () => files, configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  function drop(files) {
    const root = container.querySelector('.drop-zone');
    const dropEvent = new Event('drop', { cancelable: true });
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files } });
    root.dispatchEvent(dropEvent);
  }

  describe('constructor', () => {
    it('renders a .drop-zone element', () => {
      new DropZone(container);
      expect(container.querySelector('.drop-zone')).not.toBeNull();
    });

    it('renders a hidden multi-select file input accepting images', () => {
      new DropZone(container);
      const input = container.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input.accept).toBe('image/*');
      expect(input.multiple).toBe(true);
      expect(input.hidden).toBe(true);
    });

    it('renders the "browse file" button', () => {
      new DropZone(container);
      expect(container.querySelector('.link-btn')).not.toBeNull();
    });

    it('mentions the file limit in the prompt', () => {
      new DropZone(container, { maxFiles: 3 });
      expect(container.querySelector('.drop-title').textContent).toContain('up to 3');
    });

    it('starts with the preview grid hidden', () => {
      new DropZone(container);
      expect(container.querySelector('.dz-grid').hidden).toBe(true);
    });
  });

  describe('initial state', () => {
    it('has no files before any selection', () => {
      const dz = new DropZone(container);
      expect(dz.files).toEqual([]);
      expect(dz.file).toBeNull();
    });
  });

  describe('file selection via input change', () => {
    it('stages every selected file', () => {
      const dz = new DropZone(container);
      const a = makeFile('a.jpg'), b = makeFile('b.jpg');
      select([a, b]);
      expect(dz.files).toEqual([a, b]);
      expect(dz.file).toBe(a);
    });

    it('renders one preview tile per file with its name', () => {
      new DropZone(container);
      select([makeFile('scan-001.jpg'), makeFile('scan-002.jpg')]);
      const names = [...container.querySelectorAll('.dz-tile .preview-bar-name')].map(n => n.textContent);
      expect(names).toEqual(['scan-001.jpg', 'scan-002.jpg']);
      expect(container.querySelector('.dz-grid').hidden).toBe(false);
      expect(container.querySelector('.dz-grid').dataset.count).toBe('2');
      expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });

    it('escapes file names in the preview markup', () => {
      new DropZone(container);
      select([makeFile('<img src=x onerror=alert(1)>.jpg')]);
      expect(container.querySelector('.dz-tile img[onerror]')).toBeNull();
      expect(container.querySelector('.preview-bar-name').textContent).toBe('<img src=x onerror=alert(1)>.jpg');
    });

    it('appends later selections to the staged list', () => {
      const dz = new DropZone(container);
      const a = makeFile('a.jpg'), b = makeFile('b.jpg');
      select([a]);
      select([b]);
      expect(dz.files).toEqual([a, b]);
    });

    it('ignores a file that is already staged', () => {
      const dz = new DropZone(container);
      const a = makeFile('a.jpg');
      select([a]);
      select([a]);
      expect(dz.files).toEqual([a]);
    });

    it('caps the selection at maxFiles and reports how many were skipped', () => {
      const dz = new DropZone(container, { maxFiles: 3 });
      dz.onLimit = vi.fn();
      const files = ['1', '2', '3', '4', '5'].map(n => makeFile(`${n}.jpg`));
      select(files);
      expect(dz.files).toEqual(files.slice(0, 3));
      expect(dz.onLimit).toHaveBeenCalledWith(2);
      expect(container.querySelector('.drop-zone').classList.contains('is-full')).toBe(true);
    });

    it('calls onChange with the staged files', () => {
      const dz = new DropZone(container);
      dz.onChange = vi.fn();
      const file = makeFile();
      select([file]);
      expect(dz.onChange).toHaveBeenCalledOnce();
      expect(dz.onChange).toHaveBeenCalledWith([file]);
    });

    it('does not throw when no callbacks are registered', () => {
      new DropZone(container, { maxFiles: 1 });
      expect(() => select([makeFile('a.jpg'), makeFile('b.jpg')])).not.toThrow();
    });
  });

  describe('drop event', () => {
    it('stages dropped files', () => {
      const dz = new DropZone(container);
      const file = makeFile('dropped.png', 'image/png');
      drop([file]);
      expect(dz.files).toEqual([file]);
    });

    it('removes the dragover class on drop', () => {
      new DropZone(container);
      const root = container.querySelector('.drop-zone');
      root.classList.add('dragover');
      drop([makeFile()]);
      expect(root.classList.contains('dragover')).toBe(false);
    });
  });

  describe('drag UI feedback', () => {
    it('adds dragover class on dragover event', () => {
      new DropZone(container);
      const root = container.querySelector('.drop-zone');
      root.dispatchEvent(new Event('dragover', { cancelable: true }));
      expect(root.classList.contains('dragover')).toBe(true);
    });

    it('removes dragover class on dragleave', () => {
      new DropZone(container);
      const root = container.querySelector('.drop-zone');
      root.classList.add('dragover');
      root.dispatchEvent(new Event('dragleave'));
      expect(root.classList.contains('dragover')).toBe(false);
    });
  });

  describe('browsing', () => {
    it('opens the picker while there is room', () => {
      new DropZone(container, { maxFiles: 2 });
      const input = container.querySelector('input[type="file"]');
      input.click = vi.fn();
      container.querySelector('.drop-zone').click();
      expect(input.click).toHaveBeenCalledOnce();
    });

    it('does not open the picker once full', () => {
      new DropZone(container, { maxFiles: 1 });
      select([makeFile()]);
      const input = container.querySelector('input[type="file"]');
      input.click = vi.fn();
      container.querySelector('.drop-zone').click();
      expect(input.click).not.toHaveBeenCalled();
    });
  });

  describe('removing files', () => {
    it('removes a file via its tile button and revokes its preview URL', () => {
      const dz = new DropZone(container);
      dz.onChange = vi.fn();
      const a = makeFile('a.jpg'), b = makeFile('b.jpg');
      select([a, b]);
      container.querySelectorAll('.preview-x')[0].click();
      expect(dz.files).toEqual([b]);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
      expect(dz.onChange).toHaveBeenLastCalledWith([b]);
    });

    it('removeFile() ignores files that are not staged', () => {
      const dz = new DropZone(container);
      const a = makeFile('a.jpg');
      select([a]);
      dz.removeFile(makeFile('other.jpg'));
      expect(dz.files).toEqual([a]);
    });
  });

  describe('reset()', () => {
    it('clears files and previews after a selection', () => {
      const dz = new DropZone(container);
      select([makeFile('a.jpg'), makeFile('b.jpg')]);

      dz.reset();

      expect(dz.files).toEqual([]);
      expect(container.querySelectorAll('.dz-tile')).toHaveLength(0);
      expect(container.querySelector('.dz-grid').hidden).toBe(true);
      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });

    it('restores the drop zone inner visibility', () => {
      const dz = new DropZone(container);
      select([makeFile()]);

      dz.reset();

      expect(container.querySelector('.drop-zone-inner').style.display).toBe('');
    });
  });
});
