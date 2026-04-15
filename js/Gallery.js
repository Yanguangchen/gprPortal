import { buildCard }       from './ImageCard.js';
import { esc, formatDate } from './utils.js';

/**
 * Gallery — manages filter bar, image grid, and lightbox.
 *
 * Usage:
 *   const gallery = new Gallery(mountEl, { onEdit, onDelete });
 *   gallery.setRecords(records);   // initial load
 *   gallery.addRecord(rec);        // after upload
 *   gallery.updateRecord(id, fields); // after edit
 *   gallery.removeRecord(id);      // after delete
 */
export class Gallery {
  constructor(mountEl, { onEdit, onDelete } = {}) {
    this._records  = [];
    this._onEdit   = onEdit;
    this._onDelete = onDelete;

    // ── Filter bar + grid shell ──────────────────────────────────
    mountEl.innerHTML = `
      <section class="glass filter-section">
        <h2 class="section-title">Image Gallery</h2>
        <div class="filter-bar">
          <div class="filter-item">
            <label>Company</label>
            <select class="js-f-company"><option value="">All Companies</option></select>
          </div>
          <div class="filter-item">
            <label>Project</label>
            <select class="js-f-project"><option value="">All Projects</option></select>
          </div>
          <div class="filter-item">
            <label>Date From</label>
            <input type="date" class="js-f-from" />
          </div>
          <div class="filter-item">
            <label>Date To</label>
            <input type="date" class="js-f-to" />
          </div>
          <div class="filter-item filter-search">
            <label>Search</label>
            <input type="text" class="js-f-search" placeholder="Company, project…" />
          </div>
          <button class="btn-ghost js-f-clear" type="button">Clear</button>
        </div>
        <p class="gallery-count js-count"></p>
      </section>

      <section class="gallery-section">
        <div class="gallery-grid js-grid"></div>
        <p class="empty-state js-empty" hidden>No images match the current filters.</p>
      </section>
    `;

    const q = s => mountEl.querySelector(s);
    this._fCompany  = q('.js-f-company');
    this._fProject  = q('.js-f-project');
    this._fFrom     = q('.js-f-from');
    this._fTo       = q('.js-f-to');
    this._fSearch   = q('.js-f-search');
    this._clearBtn  = q('.js-f-clear');
    this._grid      = q('.js-grid');
    this._countEl   = q('.js-count');
    this._emptyEl   = q('.js-empty');

    [this._fCompany, this._fProject, this._fFrom, this._fTo, this._fSearch]
      .forEach(el => el.addEventListener('input', () => this._render()));

    this._clearBtn.addEventListener('click', () => {
      this._fCompany.value = '';
      this._fProject.value = '';
      this._fFrom.value    = '';
      this._fTo.value      = '';
      this._fSearch.value  = '';
      this._render();
    });

    // ── Lightbox (appended to body, shared across gallery instances) ──
    this._lb = document.createElement('div');
    this._lb.className = 'lightbox';
    this._lb.hidden = true;
    this._lb.innerHTML = `
      <div class="lightbox-backdrop"></div>
      <div class="lightbox-content">
        <button class="lightbox-close" type="button" aria-label="Close">✕</button>
        <img class="js-lb-img" src="" alt="Full size GPR image" />
        <div class="js-lb-meta lightbox-meta"></div>
      </div>
    `;
    document.body.appendChild(this._lb);
    this._lb.querySelector('.lightbox-close')
      .addEventListener('click', () => this._closeLightbox());
    this._lb.querySelector('.lightbox-backdrop')
      .addEventListener('click', () => this._closeLightbox());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this._closeLightbox();
    });
  }

  // ── Public record management ─────────────────────────────────────

  setRecords(records) {
    this._records = records;
    this._rebuildDropdowns();
    this._render();
  }

  addRecord(rec) {
    this._records.unshift(rec);
    this._rebuildDropdowns();
    this._render();
  }

  updateRecord(id, fields) {
    const rec = this._records.find(r => r.id === id);
    if (rec) Object.assign(rec, fields);
    this._rebuildDropdowns();
    this._render();
  }

  removeRecord(id) {
    this._records = this._records.filter(r => r.id !== id);
    this._rebuildDropdowns();
    this._render();
  }

  // ── Private ──────────────────────────────────────────────────────

  _filter() {
    const company  = this._fCompany.value.toLowerCase();
    const project  = this._fProject.value.toLowerCase();
    const dateFrom = this._fFrom.value;
    const dateTo   = this._fTo.value;
    const search   = this._fSearch.value.trim().toLowerCase();

    return this._records.filter(r => {
      if (company  && r.companyName.toLowerCase() !== company) return false;
      if (project  && r.projectName.toLowerCase() !== project) return false;
      if (dateFrom && r.imageDate < dateFrom)                  return false;
      if (dateTo   && r.imageDate > dateTo)                    return false;
      if (search) {
        const hay = `${r.companyName} ${r.projectName} ${r.imageName}`.toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  _render() {
    const filtered = this._filter();
    this._countEl.textContent = `${filtered.length} image${filtered.length !== 1 ? 's' : ''} shown`;
    this._grid.innerHTML = '';
    this._emptyEl.hidden = filtered.length > 0;

    filtered.forEach(rec => {
      const card = buildCard(rec, {
        onView:   r => this._openLightbox(r),
        onEdit:   r => this._onEdit?.(r),
        onDelete: r => this._onDelete?.(r),
      });
      this._grid.appendChild(card);
    });
  }

  _rebuildDropdowns() {
    const companies = [...new Set(this._records.map(r => r.companyName))].sort();
    const projects  = [...new Set(this._records.map(r => r.projectName))].sort();
    const prevCo    = this._fCompany.value;
    const prevPr    = this._fProject.value;

    this._fCompany.innerHTML = '<option value="">All Companies</option>' +
      companies.map(c => `<option value="${esc(c.toLowerCase())}">${esc(c)}</option>`).join('');
    this._fProject.innerHTML = '<option value="">All Projects</option>' +
      projects.map(p => `<option value="${esc(p.toLowerCase())}">${esc(p)}</option>`).join('');

    this._fCompany.value = prevCo;
    this._fProject.value = prevPr;
  }

  _openLightbox(rec) {
    this._lb.querySelector('.js-lb-img').src = rec.imageUrl;
    this._lb.querySelector('.js-lb-meta').innerHTML =
      `<strong>${esc(rec.companyName)}</strong> · ${esc(rec.projectName)}<br/>` +
      formatDate(rec.imageDate, { dateStyle: 'long' });
    this._lb.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  _closeLightbox() {
    if (this._lb.hidden) return;
    this._lb.hidden = true;
    this._lb.querySelector('.js-lb-img').src = '';
    document.body.style.overflow = '';
  }
}
