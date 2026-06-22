import { DropZone } from './DropZone.js';
import { audio }    from './audio.js';

/**
 * Upload panel — drop zone + metadata form.
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
 */
export class UploadPanel {
  constructor(mountEl, { onUpload }) {
    this._onUpload = onUpload;

    mountEl.innerHTML = `
      <section class="glass upload-card">
        <div class="upload-grid">

          <!-- Left: drop zone -->
          <div class="upload-left">
            <div class="panel-label"><span class="num">1</span>Radar scan file</div>
            <div class="js-drop-mount"></div>
            <div class="drop-help">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 8h.01M11 12h1v4h1"/>
              </svg>
              High-resolution exports give the clearest results. Max file size 25&nbsp;MB.
            </div>
          </div>

          <!-- Right: form -->
          <div class="upload-right">
            <div class="panel-label"><span class="num">2</span>Scan details</div>
            <div class="fields">

              <div class="field">
                <label for="up-company">
                  Company Name <span class="req" aria-hidden="true">*</span>
                </label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3"/>
                    <path d="M9 9v.01M9 13v.01M9 17v.01"/>
                  </svg>
                  <input type="text" id="up-company" placeholder="e.g. Acme Engineering" />
                </div>
              </div>

              <div class="field">
                <label for="up-project">
                  Project Name <span class="req" aria-hidden="true">*</span>
                </label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <path d="M3 7l2-3h6l1 2h7"/>
                  </svg>
                  <input type="text" id="up-project" placeholder="e.g. Downtown Utility Survey" />
                </div>
              </div>

              <div class="field">
                <label for="up-work-site">
                  Work Site <span class="req" aria-hidden="true">*</span>
                </label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z"/>
                    <circle cx="12" cy="10" r="2.5"/>
                  </svg>
                  <input type="text" id="up-work-site" placeholder="e.g. Block 123, Main Street" />
                </div>
              </div>

              <div class="field">
                <label for="up-date">
                  Scan Date <span class="req" aria-hidden="true">*</span>
                </label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="3" y="5" width="18" height="16" rx="2"/>
                    <path d="M3 9h18M8 3v4M16 3v4"/>
                  </svg>
                  <input type="date" id="up-date" />
                </div>
              </div>

              <div class="field">
                <label for="up-reference-point-number">Reference Point Number</label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16M4 12h16M4 19h16"/>
                    <path d="M8 3 6 21M18 3l-2 18"/>
                  </svg>
                  <input type="text" id="up-reference-point-number" placeholder="e.g. RP-12A" />
                </div>
              </div>

              <div class="field">
                <label for="up-remarks">Remarks</label>
                <div class="input-wrap">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16v10H7l-3 3z"/>
                    <path d="M8 9h8M8 12h5"/>
                  </svg>
                  <input type="text" id="up-remarks" placeholder="e.g. Near column B2" />
                </div>
              </div>

            </div>

            <div class="submit-area">
              <div class="prog js-prog" hidden>
                <div class="bar"><div class="fill js-prog-fill"></div></div>
                <div class="pct js-prog-pct">0%</div>
              </div>
              <p class="status js-status"></p>
              <button class="btn-primary js-submit" type="button">
                <svg class="js-submit-ic" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 16V4M7 9l5-5 5 5"/>
                  <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>
                </svg>
                <span class="spinner" hidden></span>
                <span class="js-submit-text">Upload to Portal</span>
              </button>
              <div class="submit-foot">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="5" y="11" width="14" height="9" rx="2"/>
                  <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
                </svg>
                Stored securely · only your team can access this scan
              </div>
            </div>
          </div>

        </div>
      </section>
    `;

    this._dropZone   = new DropZone(mountEl.querySelector('.js-drop-mount'));
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
    this._progEl     = mountEl.querySelector('.js-prog');
    this._progFill   = mountEl.querySelector('.js-prog-fill');
    this._progPct    = mountEl.querySelector('.js-prog-pct');

    this._submitBtn.addEventListener('click', () => this._submit());
  }

  // ── Private ──────────────────────────────────────────────────────

  async _submit() {
    const file     = this._dropZone.file;
    const company  = this._companyEl.value.trim();
    const project  = this._projectEl.value.trim();
    const workSite = this._workSiteEl.value.trim();
    const date     = this._dateEl.value;
    const referencePointNumber = this._referencePointNumberEl.value.trim();
    const remarks = this._remarksEl.value.trim();

    if (!file)     { this._setStatus('Please select a radar scan file.', 'error'); return; }
    if (!company)  { this._setStatus('Company name is required.', 'error'); this._companyEl.focus(); return; }
    if (!project)  { this._setStatus('Project name is required.', 'error'); this._projectEl.focus(); return; }
    if (!workSite) { this._setStatus('Work site is required.', 'error'); this._workSiteEl.focus(); return; }
    if (!date)     { this._setStatus('Scan date is required.', 'error'); this._dateEl.focus(); return; }

    this._setLoading(true);
    this._setStatus('');
    this._setProgress(0);
    this._progEl.hidden = false;

    try {
      await this._onUpload(
        file,
        { companyName: company, projectName: project, workSite, imageDate: date, referencePointNumber, remarks },
        pct => this._setProgress(pct),
      );
      this._setProgress(100);
      await new Promise(r => setTimeout(r, 250));
      this._reset();
      audio.success();
      this._setStatus('Scan uploaded successfully.', 'success');
      this._showToast();
    } catch (err) {
      audio.error();
      this._setStatus(err.message || 'Upload failed. Check console.', 'error');
    } finally {
      this._setLoading(false);
      this._progEl.hidden = true;
      this._setProgress(0);
    }
  }

  _reset() {
    this._dropZone.reset();
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

  _setProgress(pct) {
    const v = Math.min(Math.max(pct, 0), 100);
    this._progFill.style.width = v + '%';
    this._progPct.textContent  = v + '%';
  }

  _showToast() {
    const toast = document.getElementById('upload-toast');
    if (!toast) return;
    toast.hidden = false;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.hidden = true; }, 450);
    }, 3200);
  }
}
