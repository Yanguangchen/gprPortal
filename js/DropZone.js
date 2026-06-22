/**
 * Self-contained drag-and-drop / click-to-browse file picker.
 *
 * Usage:
 *   const dz = new DropZone(containerEl);
 *   dz.onSelect = file => console.log(file.name);
 *   const file = dz.file;  // currently staged file (null if none)
 *   dz.reset();            // clear selection and preview
 */
export class DropZone {
  constructor(container) {
    this._file    = null;
    this.onSelect = null; // optional callback(file)

    container.innerHTML = `
      <div class="drop-zone" tabindex="0" role="button" aria-label="Click or drag to upload an image">
        <div class="sweep" aria-hidden="true"></div>
        <svg class="rings" width="240" height="240" viewBox="0 0 300 300" aria-hidden="true">
          <circle cx="150" cy="150" r="60"/>
          <circle cx="150" cy="150" r="100"/>
          <circle cx="150" cy="150" r="140"/>
        </svg>
        <input type="file" accept="image/*" hidden />
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
          <span class="drop-title">Drag &amp; drop your scan here</span>
          <span class="drop-sub">or <button class="link-btn" type="button">browse files</button></span>
          <span class="drop-formats">
            <span class="chip">PNG</span><span class="chip">JPG</span><span class="chip">TIFF</span>
          </span>
        </div>
        <img class="preview-img" alt="Selected image preview" hidden />
        <p class="file-name" hidden></p>
      </div>
    `;

    this._root      = container.querySelector('.drop-zone');
    this._input     = container.querySelector('input[type="file"]');
    this._inner     = container.querySelector('.drop-zone-inner');
    this._nameEl    = container.querySelector('.file-name');
    this._preview   = container.querySelector('.preview-img');
    const browseBtn = container.querySelector('.link-btn');

    browseBtn.addEventListener('click', e => { e.stopPropagation(); this._input.click(); });
    this._root.addEventListener('click',     () => this._input.click());
    this._root.addEventListener('keydown',   e => { if (e.key === 'Enter' || e.key === ' ') this._input.click(); });
    this._root.addEventListener('dragover',  e => { e.preventDefault(); this._root.classList.add('dragover'); });
    this._root.addEventListener('dragleave', () => this._root.classList.remove('dragover'));
    this._root.addEventListener('drop', e => {
      e.preventDefault();
      this._root.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) this._setFile(f);
    });
    this._input.addEventListener('change', () => {
      if (this._input.files[0]) this._setFile(this._input.files[0]);
    });
  }

  get file() { return this._file; }

  reset() {
    this._file = null;
    this._input.value         = '';
    this._preview.hidden      = true;
    this._preview.src         = '';
    this._nameEl.hidden       = true;
    this._nameEl.textContent  = '';
    this._inner.style.display = '';
    this._root.querySelector('.preview-bar')?.remove();
  }

  _setFile(file) {
    this._file = file;
    this._nameEl.textContent = file.name;
    this._preview.src        = URL.createObjectURL(file);
    this._preview.hidden     = false;
    this._inner.style.display = 'none';

    // Preview bar with filename, size, and a remove button
    let bar = this._root.querySelector('.preview-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'preview-bar';
      this._root.appendChild(bar);
    }
    const sz = file.size > 1e6
      ? (file.size / 1048576).toFixed(1) + ' MB'
      : Math.round(file.size / 1024) + ' KB';
    bar.innerHTML = `
      <div class="preview-bar-info">
        <span class="preview-bar-name"></span>
        <span class="preview-bar-size">${sz} · ready to upload</span>
      </div>
      <button class="preview-x" type="button" title="Remove file" aria-label="Remove file">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    `;
    bar.querySelector('.preview-bar-name').textContent = file.name;
    bar.querySelector('.preview-x').addEventListener('click', e => {
      e.stopPropagation();
      this.reset();
    });

    this.onSelect?.(file);
  }
}
