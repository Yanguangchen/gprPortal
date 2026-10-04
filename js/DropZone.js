import { esc, formatBytes } from './utils.js';

/**
 * Self-contained drag-and-drop / click-to-browse picker for up to
 * `maxFiles` images. New selections are appended to the staged list;
 * anything past the limit is skipped and reported via `onLimit`.
 *
 * Usage:
 *   const dz = new DropZone(containerEl, { maxFiles: 3 });
 *   dz.onChange = files => console.log(files.length);
 *   dz.onLimit  = skipped => console.warn(`${skipped} file(s) skipped`);
 *   const files = dz.files;  // staged files (array copy)
 *   dz.removeFile(file);     // unstage one file
 *   dz.reset();              // clear selection and previews
 */
export class DropZone {
  constructor(container, { maxFiles = 3 } = {}) {
    this._max     = maxFiles;
    this._items   = []; // [{ file, url }]
    this.onChange = null; // optional callback(files)
    this.onLimit  = null; // optional callback(skippedCount)

    container.innerHTML = `
      <div class="drop-zone" tabindex="0" role="button" aria-label="Click or drag to add up to ${maxFiles} images">
        <input type="file" accept="image/*" multiple hidden />
        <div class="drop-zone-inner">
          <span class="drop-ic">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 16V4M7 9l5-5 5 5"
                    stroke="currentColor" stroke-width="1.8"
                    stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
                    stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </span>
          <span class="drop-title">Drop up to ${maxFiles} scans here</span>
          <span class="drop-sub">or <button class="link-btn" type="button">browse files</button></span>
        </div>
        <div class="dz-grid" hidden></div>
        <div class="dz-count" hidden></div>
      </div>
    `;

    this._root    = container.querySelector('.drop-zone');
    this._input   = container.querySelector('input[type="file"]');
    this._inner   = container.querySelector('.drop-zone-inner');
    this._grid    = container.querySelector('.dz-grid');
    this._countEl = container.querySelector('.dz-count');
    const browseBtn = container.querySelector('.link-btn');

    browseBtn.addEventListener('click', e => { e.stopPropagation(); this._browse(); });
    this._root.addEventListener('click',     () => this._browse());
    this._root.addEventListener('keydown',   e => {
      if (e.target !== this._root) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._browse(); }
    });
    this._root.addEventListener('dragover',  e => { e.preventDefault(); this._root.classList.add('dragover'); });
    this._root.addEventListener('dragleave', () => this._root.classList.remove('dragover'));
    this._root.addEventListener('drop', e => {
      e.preventDefault();
      this._root.classList.remove('dragover');
      this._addFiles(e.dataTransfer.files);
    });
    this._input.addEventListener('change', () => {
      this._addFiles(this._input.files);
      this._input.value = ''; // allow re-selecting the same file after removing it
    });
  }

  get files() { return this._items.map(it => it.file); }

  /** First staged file, or null. */
  get file() { return this._items[0]?.file ?? null; }

  get maxFiles() { return this._max; }

  removeFile(file) {
    const idx = this._items.findIndex(it => it.file === file);
    if (idx === -1) return;
    URL.revokeObjectURL(this._items[idx].url);
    this._items.splice(idx, 1);
    this._render();
    this.onChange?.(this.files);
  }

  reset() {
    this._items.forEach(it => URL.revokeObjectURL(it.url));
    this._items = [];
    this._input.value = '';
    this._render();
  }

  // ── Private ──────────────────────────────────────────────────────

  _browse() {
    if (this._items.length < this._max) this._input.click();
  }

  _addFiles(list) {
    const incoming = Array.from(list || []).filter(f => !this._items.some(it =>
      it.file.name === f.name && it.file.size === f.size && it.file.lastModified === f.lastModified
    ));
    if (!incoming.length) return;

    const room    = this._max - this._items.length;
    const accept  = incoming.slice(0, Math.max(room, 0));
    const skipped = incoming.length - accept.length;

    accept.forEach(file => this._items.push({ file, url: URL.createObjectURL(file) }));
    if (accept.length) {
      this._render();
      this.onChange?.(this.files);
    }
    if (skipped) this.onLimit?.(skipped);
  }

  _render() {
    const n = this._items.length;
    this._inner.style.display = n ? 'none' : '';
    this._grid.hidden    = !n;
    this._countEl.hidden = !n;
    this._root.classList.toggle('has-files', n > 0);
    this._root.classList.toggle('is-full', n >= this._max);
    this._grid.dataset.count = n;

    this._grid.innerHTML = this._items.map((it, i) => `
      <figure class="dz-tile">
        <img src="${esc(it.url)}" alt="Selected scan ${i + 1} preview" />
        <figcaption class="preview-bar">
          <span class="preview-bar-info">
            <span class="preview-bar-name">${esc(it.file.name)}</span>
            <span class="preview-bar-size">${formatBytes(it.file.size)} · ready</span>
          </span>
          <button class="preview-x" type="button" data-idx="${i}"
                  title="Remove file" aria-label="Remove ${esc(it.file.name)}">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </figcaption>
      </figure>
    `).join('');

    this._grid.querySelectorAll('.preview-x').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.removeFile(this._items[Number(btn.dataset.idx)].file);
      });
    });

    const full = n >= this._max;
    this._countEl.innerHTML = `
      <span class="dz-count-n">${n} / ${this._max}</span>
      <span class="dz-count-txt">${full ? 'Max reached' : '+ Add scan'}</span>
    `;
  }
}
