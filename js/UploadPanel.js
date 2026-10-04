import { DropZone }      from './DropZone.js';
import { UploadModal }   from './UploadModal.js';
import { compressImage } from './utils.js';
import { audio }         from './audio.js';

const MAX_FILES = 3;

/**
 * Upload panel — multi-file drop zone (up to 3 scans) + shared metadata form.
 *
 * On submit each scan is compressed (with the UploadModal narrating the
 * pipeline), then handed to `onUpload` already compressed. The metadata
 * applies to every scan in the batch.
 *
 * Usage:
 *   new UploadPanel(mountEl, {
 *     onUpload: async (file, { companyName, projectName, workSite, imageDate, referencePointNumber, remarks }, onProgress) => {
 *       const rec = await api.create(file, meta, onProgress);
 *       gallery.addRecord(rec);
 *       return rec;
 *     },
 *   });
 *
 * `onUpload` should throw on failure; the panel catches and displays the error.
 * Options `compress` (default compressImage) and `pace` (modal stage-timing
 * multiplier, default 1) exist mainly for tests.
 */
export class UploadPanel {
  constructor(mountEl, { onUpload, compress = compressImage, pace = 1 }) {
    this._onUpload = onUpload;
    this._compress = compress;
    this._modal    = new UploadModal({ pace });

    mountEl.innerHTML = `
      <section class="surface upload-card reveal" style="--i:2">
        <div class="upload-left">
          <h2 class="panel-label">Scan files</h2>
          <div class="js-drop-mount"></div>
          <p class="drop-help">Up to ${MAX_FILES} scans per upload, max 25&nbsp;MB each. The details apply to all of them.</p>
        </div>

        <div class="upload-right">
          <h2 class="panel-label">Scan details</h2>
          <div class="fields">
            <div class="field">
              <label for="up-company">Company name <span class="req" aria-hidden="true">*</span></label>
              <input type="text" id="up-company" placeholder="e.g. Acme Engineering" autocomplete="organization" />
            </div>
            <div class="field">
              <label for="up-project">Project name <span class="req" aria-hidden="true">*</span></label>
              <input type="text" id="up-project" placeholder="e.g. Downtown Utility Survey" />
            </div>
            <div class="field">
              <label for="up-work-site">Work site <span class="req" aria-hidden="true">*</span></label>
              <input type="text" id="up-work-site" placeholder="e.g. Block 123, Main Street" />
            </div>
            <div class="field">
              <label for="up-date">Scan date <span class="req" aria-hidden="true">*</span></label>
              <input type="date" id="up-date" />
            </div>
            <div class="field">
              <label for="up-reference-point-number">Reference point number</label>
              <input type="text" id="up-reference-point-number" placeholder="e.g. RP-12A" />
            </div>
            <div class="field">
              <label for="up-remarks">Remarks</label>
              <input type="text" id="up-remarks" placeholder="e.g. Near column B2" />
            </div>
          </div>

          <div class="submit-area">
            <p class="status js-status" role="status" aria-live="polite"></p>
            <button class="btn-primary js-submit" type="button">
              <svg class="js-submit-ic" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16V4M7 9l5-5 5 5"/>
                <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>
              </svg>
              <span class="spinner" hidden></span>
              <span class="js-submit-text">Upload to Portal</span>
            </button>
          </div>
        </div>
      </section>
    `;

    this._dropZone   = new DropZone(mountEl.querySelector('.js-drop-mount'), { maxFiles: MAX_FILES });
    this._companyEl  = mountEl.querySelector('#up-company');
    this._projectEl  = mountEl.querySelector('#up-project');
    this._workSiteEl = mountEl.querySelector('#up-work-site');
    this._dateEl     = mountEl.querySelector('#up-date');
    this._referencePointNumberEl = mountEl.querySelector('#up-reference-point-number');
    this._remarksEl   = mountEl.querySelector('#up-remarks');
    this._submitBtn  = mountEl.querySelector('.js-submit');
    this._submitIc   = mountEl.querySelector('.js-submit-ic');
    this._submitText = mountEl.querySelector('.js-submit-text');
    this._spinner    = mountEl.querySelector('.spinner');
    this._statusEl   = mountEl.querySelector('.js-status');

    this._dropZone.onChange = files => {
      this._updateSubmitLabel(files.length);
      if (this._statusEl.classList.contains('error')) this._setStatus('');
    };
    this._dropZone.onLimit = skipped => this._setStatus(
      `Up to ${MAX_FILES} scans per upload — ${skipped} file${skipped > 1 ? 's were' : ' was'} skipped.`, 'error');

    this._submitBtn.addEventListener('click', () => this._submit());
  }

  // ── Private ──────────────────────────────────────────────────────

  async _submit() {
    const files    = this._dropZone.files;
    const company  = this._companyEl.value.trim();
    const project  = this._projectEl.value.trim();
    const workSite = this._workSiteEl.value.trim();
    const date     = this._dateEl.value;
    const referencePointNumber = this._referencePointNumberEl.value.trim();
    const remarks = this._remarksEl.value.trim();

    if (!files.length) { this._setStatus('Please select at least one radar scan file.', 'error'); return; }
    if (!company)  { this._setStatus('Company name is required.', 'error'); this._companyEl.focus(); return; }
    if (!project)  { this._setStatus('Project name is required.', 'error'); this._projectEl.focus(); return; }
    if (!workSite) { this._setStatus('Work site is required.', 'error'); this._workSiteEl.focus(); return; }
    if (!date)     { this._setStatus('Scan date is required.', 'error'); this._dateEl.focus(); return; }

    const meta = { companyName: company, projectName: project, workSite, imageDate: date, referencePointNumber, remarks };

    this._setLoading(true);
    this._setStatus('');
    audio.upload();
    this._modal.open(files);

    const failures = [];
    for (const [i, file] of files.entries()) {
      try {
        const compressed = await this._modal.compress(i, onDecoded => this._compress(file, { onDecoded }));
        await this._onUpload(compressed, meta, pct => this._modal.setUploadProgress(i, pct));
        await this._modal.completeFile(i);
        this._dropZone.removeFile(file);
      } catch (err) {
        this._modal.failFile(i, err.message || 'Upload failed. Check console.');
        failures.push(err);
      }
    }

    const uploaded = files.length - failures.length;
    if (!failures.length) {
      this._reset();
      audio.success();
      this._setStatus(uploaded > 1 ? `${uploaded} scans uploaded successfully.` : 'Scan uploaded successfully.', 'success');
    } else {
      audio.error();
      const reason = failures[0].message || 'Upload failed. Check console.';
      this._setStatus(uploaded
        ? `${uploaded} of ${files.length} scans uploaded. ${failures.length} failed (${reason}) and ${failures.length > 1 ? 'remain' : 'remains'} selected for retry.`
        : reason, 'error');
    }
    this._setLoading(false);

    await this._modal.finish();
    if (uploaded) this._showToast(uploaded);
  }

  _reset() {
    this._dropZone.reset();
    this._updateSubmitLabel(0);
    this._companyEl.value  = '';
    this._projectEl.value  = '';
    this._workSiteEl.value = '';
    this._dateEl.value     = '';
    this._referencePointNumberEl.value = '';
    this._remarksEl.value   = '';
  }

  _setLoading(on) {
    this._submitBtn.disabled = on;
    this._submitIc.hidden    = on;
    this._submitText.hidden  = on;
    this._spinner.hidden     = !on;
  }

  _setStatus(msg, type) {
    this._statusEl.textContent = msg;
    this._statusEl.className   = `status js-status${type ? ' ' + type : ''}`;
  }

  _updateSubmitLabel(count) {
    this._submitText.textContent = count > 1 ? `Upload ${count} scans` : 'Upload to Portal';
  }

  _showToast(count = 1) {
    const toast = document.getElementById('upload-toast');
    if (!toast) return;
    const title = toast.querySelector('.toast-title');
    if (title) title.textContent = count > 1 ? `${count} scans uploaded` : 'Scan uploaded';
    toast.hidden = false;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 450);
    }, 3200);
  }
}
