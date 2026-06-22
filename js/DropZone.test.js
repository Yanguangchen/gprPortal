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

  describe('constructor', () => {
    it('renders a .drop-zone element', () => {
      new DropZone(container);
      expect(container.querySelector('.drop-zone')).not.toBeNull();
    });

    it('renders a hidden file input accepting images', () => {
      new DropZone(container);
      const input = container.querySelector('input[type="file"]');
      expect(input).not.toBeNull();
      expect(input.accept).toBe('image/*');
      expect(input.hidden).toBe(true);
    });

    it('renders the "browse file" button', () => {
      new DropZone(container);
      expect(container.querySelector('.link-btn')).not.toBeNull();
    });

    it('renders a preview image that starts hidden', () => {
      new DropZone(container);
      expect(container.querySelector('.preview-img').hidden).toBe(true);
    });
  });

  describe('initial state', () => {
    it('file is null before any selection', () => {
      const dz = new DropZone(container);
      expect(dz.file).toBeNull();
    });
  });

  describe('file selection via input change', () => {
    it('sets the file property', () => {
      const dz = new DropZone(container);
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      expect(dz.file).toBe(file);
    });

    it('shows the file name', () => {
      new DropZone(container);
      const file = makeFile('scan-001.jpg');
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      expect(container.querySelector('.file-name').textContent).toBe('scan-001.jpg');
    });

    it('shows the preview image and creates an object URL', () => {
      new DropZone(container);
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      const preview = container.querySelector('.preview-img');
      expect(preview.hidden).toBe(false);
      expect(preview.src).toContain('blob:');
      expect(URL.createObjectURL).toHaveBeenCalledWith(file);
    });

    it('calls onSelect callback with the file', () => {
      const dz = new DropZone(container);
      dz.onSelect = vi.fn();
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));
      expect(dz.onSelect).toHaveBeenCalledOnce();
      expect(dz.onSelect).toHaveBeenCalledWith(file);
    });

    it('does not call onSelect when no callback is registered', () => {
      new DropZone(container);
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      expect(() => input.dispatchEvent(new Event('change'))).not.toThrow();
    });
  });

  describe('drop event', () => {
    it('sets file from dropped data', () => {
      const dz = new DropZone(container);
      const file = makeFile('dropped.png', 'image/png');
      const root = container.querySelector('.drop-zone');
      const dropEvent = new Event('drop', { cancelable: true });
      Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } });
      root.dispatchEvent(dropEvent);
      expect(dz.file).toBe(file);
    });

    it('removes the dragover class on drop', () => {
      new DropZone(container);
      const root = container.querySelector('.drop-zone');
      root.classList.add('dragover');
      const dropEvent = new Event('drop', { cancelable: true });
      const file = makeFile();
      Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [file] } });
      root.dispatchEvent(dropEvent);
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

  describe('reset()', () => {
    it('clears file, preview, and filename after a selection', () => {
      const dz = new DropZone(container);
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));

      dz.reset();

      expect(dz.file).toBeNull();
      expect(container.querySelector('.preview-img').hidden).toBe(true);
      expect(container.querySelector('.preview-img').src).toBe('');
      expect(container.querySelector('.file-name').textContent).toBe('');
    });

    it('restores the drop zone inner visibility', () => {
      const dz = new DropZone(container);
      const file = makeFile();
      const input = container.querySelector('input[type="file"]');
      Object.defineProperty(input, 'files', { get: () => [file], configurable: true });
      input.dispatchEvent(new Event('change'));

      dz.reset();

      expect(container.querySelector('.drop-zone-inner').style.display).toBe('');
    });
  });
});
