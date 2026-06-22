import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { esc, formatDate, delay, compressImage } from './utils.js';

describe('utils.js', () => {
  describe('esc', () => {
    it('escapes HTML special characters', () => {
      expect(esc('<div>"test" & \'rest\'</div>')).toBe('&lt;div&gt;&quot;test&quot; &amp; &#39;rest&#39;&lt;/div&gt;');
    });

    it('handles null and undefined gracefully', () => {
      expect(esc(null)).toBe('');
      expect(esc(undefined)).toBe('');
    });
  });

  describe('formatDate', () => {
    it('returns an em-dash if no date is provided', () => {
      expect(formatDate(null)).toBe('—');
      expect(formatDate('')).toBe('—');
      expect(formatDate(undefined)).toBe('—');
    });

    it('formats a valid ISO string', () => {
      // formatDate uses new Date(iso + 'T00:00:00') which implies local timezone based on that string
      expect(formatDate('2023-01-01')).toMatch(/Jan 1, 2023/);
    });
  });

  describe('delay', () => {
    it('resolves after the specified time', async () => {
      const start = Date.now();
      await delay(50);
      const end = Date.now();
      expect(end - start).toBeGreaterThanOrEqual(40); // with a small buffer for timing variability
    });
  });

  describe('compressImage', () => {
    const fakeBlob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

    function mockCanvasFor(width, height) {
      let _w = width, _h = height;
      return {
        get width() { return _w; },
        set width(v) { _w = v; },
        get height() { return _h; },
        set height(v) { _h = v; },
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (cb) => cb(fakeBlob),
      };
    }

    beforeEach(() => {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });

    function stubImage(w, h, fail = false) {
      vi.stubGlobal('Image', class {
        get width() { return w; }
        get height() { return h; }
        set src(_) {
          queueMicrotask(() => fail ? this.onerror?.() : this.onload?.());
        }
      });
    }

    it('resolves with a JPEG File with .jpg extension', async () => {
      stubImage(800, 600);
      const canvas = mockCanvasFor(800, 600);
      const orig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tag =>
        tag === 'canvas' ? canvas : orig(tag)
      );
      const input = new File(['fake'], 'scan.png', { type: 'image/png' });
      const result = await compressImage(input);
      expect(result).toBeInstanceOf(File);
      expect(result.type).toBe('image/jpeg');
      expect(result.name).toBe('scan.jpg');
    });

    it('does not scale images within the size limit', async () => {
      stubImage(800, 600);
      const canvas = mockCanvasFor(800, 600);
      const orig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tag =>
        tag === 'canvas' ? canvas : orig(tag)
      );
      const input = new File(['fake'], 'small.png', { type: 'image/png' });
      await compressImage(input);
      expect(canvas.width).toBe(800);
      expect(canvas.height).toBe(600);
    });

    it('scales down an oversized image to fit within maxWidth/maxHeight', async () => {
      stubImage(3840, 2160);
      const canvas = mockCanvasFor(0, 0);
      const orig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tag =>
        tag === 'canvas' ? canvas : orig(tag)
      );
      const input = new File(['fake'], 'big.jpg', { type: 'image/jpeg' });
      await compressImage(input);
      // 3840×2160 → ratio = min(1920/3840, 1080/2160) = 0.5 → 1920×1080
      expect(canvas.width).toBe(1920);
      expect(canvas.height).toBe(1080);
    });

    it('rejects with an error when toBlob returns null', async () => {
      stubImage(400, 300);
      const nullBlobCanvas = {
        width: 0, height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (cb) => cb(null),
      };
      const orig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tag =>
        tag === 'canvas' ? nullBlobCanvas : orig(tag)
      );
      const input = new File(['fake'], 'photo.jpg', { type: 'image/jpeg' });
      await expect(compressImage(input)).rejects.toThrow('Image compression failed');
    });

    it('rejects when the image fails to load', async () => {
      stubImage(0, 0, true); // fail = true triggers onerror
      const input = new File(['fake'], 'broken.jpg', { type: 'image/jpeg' });
      await expect(compressImage(input)).rejects.toThrow('Failed to load image');
    });

    it('revokes the object URL after the image loads', async () => {
      stubImage(200, 200);
      const canvas = mockCanvasFor(200, 200);
      const orig = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation(tag =>
        tag === 'canvas' ? canvas : orig(tag)
      );
      const input = new File(['fake'], 'img.jpg', { type: 'image/jpeg' });
      await compressImage(input);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
    });
  });
});
