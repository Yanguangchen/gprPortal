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
        <input type="file" accept="image/*" hidden />
        <div class="drop-zone-inner">
          <svg class="drop-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
            <path d="M32 12v28M20 24l12-12 12 12" stroke="currentColor" stroke-width="3"
              stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M12 44v4a4 4 0 004 4h32a4 4 0 004-4v-4" stroke="currentColor"
              stroke-width="3" stroke-linecap="round"/>
          </svg>
          <p class="drop-label">Drag &amp; drop image here</p>
          <p class="drop-sub">or <button class="link-btn" type="button">browse file</button></p>
          <p class="drop-sub file-name"></p>
        </div>
        <img class="preview-img" alt="Selected image preview" hidden />
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
    this._input.value    = '';
    this._preview.hidden = true;
    this._preview.src    = '';
    this._inner.style.display = '';
    this._nameEl.textContent  = '';
  }

  _setFile(file) {
    this._file = file;
    this._nameEl.textContent  = file.name;
    this._preview.src         = URL.createObjectURL(file);
    this._preview.hidden      = false;
    this._inner.style.display = 'none';
    this.onSelect?.(file);
  }
}
