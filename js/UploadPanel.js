import { DropZone } from './DropZone.js';
import { audio }    from './audio.js';
import { Modal }    from './Modal.js';

/**
 * Upload panel — drop zone + metadata form.
 *
 * Usage:
 *   new UploadPanel(mountEl, {
 *     onUpload: async (file, { companyName, projectName, workSite, imageDate }, onProgress) => {
 *       const rec = await api.create(file, meta, onProgress);
 *       gallery.addRecord(rec);
 *       return rec;
 *     },
 *   });
 *
 * `onUpload` should throw on failure; the panel catches and displays the error.
 */
export class UploadPanel {
  constructor(mountEl, { onUpload }) {
    this._onUpload = onUpload;

    this._successModal = new Modal({
      title: 'Upload Successful!',
      bodyHTML: `
        <div class="upload-success-content">
          <div class="success-icon">👍</div>
          <p class="modal-body">Your GPR image has been processed and added to the portal.</p>
        </div>
      `,
      confirmLabel: 'Great!',
      confirmVariant: 'primary',
      size: 'sm',
    });

    mountEl.innerHTML = `
      <section class="glass upload-section">
        <h2 class="section-title">Upload GPR Image</h2>
        <div class="upload-grid">
          <div class="js-drop-mount"></div>
          <div class="upload-fields">
            <div class="field-group">
              <label for="up-company">Company Name</label>
              <input type="text" id="up-company" placeholder="e.g. Acme Engineering" />
            </div>
            <div class="field-group">
              <label for="up-project">Project Name</label>
              <input type="text" id="up-project" placeholder="e.g. Downtown Utility Survey" />
            </div>
            <div class="field-group">
              <label for="up-work-site">Work Site</label>
              <input type="text" id="up-work-site" placeholder="e.g. Block 123, Main Street" />
            </div>
            <div class="field-group">
              <label for="up-date">Scan Date</label>
              <input type="date" id="up-date" />
            </div>
            <button class="btn-primary js-submit" type="button">
              <span class="js-submit-text">Upload GPR Image</span>
              <span class="spinner" hidden></span>
            </button>
            <p class="upload-status js-status"></p>
          </div>
        </div>
      </section>
    `;

    this._dropZone   = new DropZone(mountEl.querySelector('.js-drop-mount'));
    this._companyEl  = mountEl.querySelector('#up-company');
    this._projectEl  = mountEl.querySelector('#up-project');
    this._workSiteEl = mountEl.querySelector('#up-work-site');
    this._dateEl     = mountEl.querySelector('#up-date');
    this._submitBtn  = mountEl.querySelector('.js-submit');
    this._submitText = mountEl.querySelector('.js-submit-text');
    this._spinner    = mountEl.querySelector('.spinner');
    this._statusEl   = mountEl.querySelector('.js-status');

    this._submitBtn.addEventListener('click', () => this._submit());
  }

  // ── Private ──────────────────────────────────────────────────────

  async _submit() {
    const file    = this._dropZone.file;
    const company = this._companyEl.value.trim();
    const project = this._projectEl.value.trim();
    const workSite = this._workSiteEl.value.trim();
    const date    = this._dateEl.value;

    if (!file)    { this._setStatus('Please select an image file.', 'error'); return; }
    if (!company) { this._setStatus('Company name is required.', 'error'); return; }
    if (!project) { this._setStatus('Project name is required.', 'error'); return; }
    if (!workSite) { this._setStatus('Work site is required.', 'error'); return; }
    if (!date)    { this._setStatus('Scan date is required.', 'error'); return; }

    this._setLoading(true);
    this._setStatus('Uploading…', '');

    try {
      await this._onUpload(
        file,
        { companyName: company, projectName: project, workSite, imageDate: date },
        pct => this._setStatus(`Uploading… ${pct}%`, ''),
      );
      this._reset();
      audio.success();
      await this._successModal.open();
      this._successModal.close();
      this._setStatus('Image uploaded successfully.', 'success');
    } catch (err) {
      audio.error();
      this._setStatus(err.message || 'Upload failed. Check console.', 'error');
    } finally {
      this._setLoading(false);
    }
  }

  _reset() {
    this._dropZone.reset();
    this._companyEl.value = '';
    this._projectEl.value = '';
    this._workSiteEl.value = '';
    this._dateEl.value    = '';
  }

  _setLoading(on) {
    this._submitBtn.disabled = on;
    this._submitText.hidden  = on;
    this._spinner.hidden     = !on;
  }

  _setStatus(msg, type) {
    this._statusEl.textContent = msg;
    this._statusEl.className   = `upload-status js-status${type ? ' ' + type : ''}`;
  }
}
